interface Env {
  DB: D1Database;
  MEDIA: R2Bucket;
  AI?: { run: (model: string, input: unknown) => Promise<unknown> };
  ADMIN_TOKEN?: string;
  ALLOWED_ORIGINS?: string;
}

type Row = Record<string, any>;
const MAX_BODY = 2 * 1024 * 1024;
const IMAGE_MAX = 8 * 1024 * 1024;
const CATEGORIES = new Set(['Aqeedah', 'Namaz', 'Roza', 'Zakat', 'Hajj & Umrah', 'Nikah & Family', 'Muamalat', 'Tafseer & Quran']);

const CHAT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

const CHAT_SYSTEM_PROMPT = [
  'You are the Islamic guidance assistant inside the Fatwa mobile app.',
  'Purpose: help Muslims understand their religion and give general, respectful Islamic guidance.',
  '',
  'Language:',
  '- Understand the user first, then answer in the SAME language the user wrote in.',
  '- You may answer in any language (Urdu, Arabic, English, Pashto, Sindhi, Punjabi, Bengali, Turkish, etc.).',
  '- If the user mixes languages, reply in the dominant one. Keep the tone warm, calm and respectful.',
  '',
  'Islamic adab (always respect these):',
  '- Open with a short greeting such as "السلام علیکم" when it fits, and keep a humble, kind tone.',
  '- Base answers on the Quran, authentic Sunnah, and mainstream scholarship (Hanafi fiqh and the scholars of Deoband unless the user asks for another school).',
  '- Quote a Quran verse or hadith only when you are confident it is accurate. Never invent verses, hadith, references, or numbers.',
  '- When scholars differ, say so briefly and neutrally; do not issue a ruling on disputed matters.',
  '- Be especially careful and gentle with sensitive topics (divorce, inheritance, apostasy, medical, legal, financial disputes).',
  '- Never give a definitive fatwa. For serious, personal, or disputed matters, advise consulting a qualified mufti or scholar.',
  '- For a specific ruling about prayer validity, missed or extra rakats, do not infer from memory. If no directly relevant verified source is provided, say you cannot verify a reliable ruling and refer the user to a qualified scholar.',
  '- Before answering a ruling question, check that every step is consistent and that no sentence contradicts another.',
  '- Do not speak for Allah or claim certainty about the unseen.',
  '',
  'How to answer:',
  '- First show you understood the question in one short line.',
  '- Then give a clear, well-organised answer in short paragraphs or a few bullets.',
  '- Prefer practical guidance the person can act on today.',
  '- If the question is unclear, ask one focused follow-up question instead of guessing.',
  '- If the question is outside Islamic guidance (e.g. coding, politics, harmful requests), politely redirect to what you can help with.',
  '- Keep answers concise: aim for a few short paragraphs, not an essay.',
  '- End with a brief reminder that this is general guidance, not a formal fatwa, when the topic is a ruling.',
].join('\n');

const id = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
const now = () => new Date().toISOString();
const json = (body: unknown, status = 200, origin = '*') => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': origin, 'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS', 'access-control-allow-headers': 'Content-Type, Authorization, X-Admin-Token', 'access-control-max-age': '86400', 'x-content-type-options': 'nosniff' } });
const text = (body: string, status: number, origin: string) => new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8', 'access-control-allow-origin': origin, 'x-content-type-options': 'nosniff' } });

function corsOrigin(request: Request, env: Env) {
  const requestOrigin = request.headers.get('origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((v) => v.trim()).filter(Boolean);
  return allowed.includes(requestOrigin) ? requestOrigin : (allowed[0] || '*');
}
function clientKey(request: Request) { return request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown'; }
async function hash(value: string) { const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)); return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join(''); }
async function readJson(request: Request) { const length = Number(request.headers.get('content-length') || 0); if (length > MAX_BODY) throw new Error('payload_too_large'); return await request.json() as Row; }
function bearer(request: Request) { return (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim() || request.headers.get('x-admin-token') || ''; }
function safeError(error: unknown) { const message = String(error); if (message.includes('payload_too_large')) return ['Payload is too large.', 413] as const; console.error('worker error', message); return ['Request could not be completed.', 500] as const; }

async function rateLimit(env: Env, request: Request, bucket: string, limit: number) {
  const key = `${bucket}:${clientKey(request)}`;
  const window = Math.floor(Date.now() / 60_000) * 60_000;
  const row = await env.DB.prepare('SELECT window_started_at, count FROM rate_limits WHERE key=?').bind(key).first<Row>();
  if (!row || Number(row.window_started_at) !== window) {
    await env.DB.prepare('INSERT INTO rate_limits(key,window_started_at,count) VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET window_started_at=excluded.window_started_at,count=1').bind(key, window).run();
    return true;
  }
  if (Number(row.count) >= limit) return false;
  await env.DB.prepare('UPDATE rate_limits SET count=count+1 WHERE key=?').bind(key).run();
  return true;
}

// Schema creation is idempotent but costs a batch of DDL statements, so run it
// at most once per Worker isolate instead of on every request.
let schemaReady: Promise<void> | null = null;
function ensureSchema(env: Env): Promise<void> {
  if (!schemaReady) {
    schemaReady = createSchema(env).catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

async function createSchema(env: Env) {
  await env.DB.batch([
    env.DB.prepare('CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,token_hash TEXT NOT NULL UNIQUE,expires_at TEXT NOT NULL,created_at TEXT NOT NULL,last_seen_at TEXT NOT NULL,revoked_at TEXT)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS fatwa_revisions (id TEXT PRIMARY KEY,fatwa_id TEXT NOT NULL,question TEXT NOT NULL,answer TEXT NOT NULL,category TEXT NOT NULL,scholar TEXT NOT NULL,institution TEXT NOT NULL,source_url TEXT,status TEXT NOT NULL,changed_by TEXT,created_at TEXT NOT NULL)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS notification_deliveries (id TEXT PRIMARY KEY,notification_id TEXT NOT NULL,channel TEXT NOT NULL DEFAULT \'in_app\',status TEXT NOT NULL DEFAULT \'pending\',failure_reason TEXT,attempted_at TEXT,delivered_at TEXT)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS admin_audit_logs (id TEXT PRIMARY KEY,admin_id TEXT NOT NULL,action TEXT NOT NULL,entity_type TEXT NOT NULL,entity_id TEXT,metadata_json TEXT,created_at TEXT NOT NULL)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY,window_started_at INTEGER NOT NULL,count INTEGER NOT NULL DEFAULT 0)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY,device_id TEXT NOT NULL UNIQUE,name TEXT NOT NULL,gender TEXT,country TEXT,city TEXT,avatar_url TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)'),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS fatwas (id TEXT PRIMARY KEY,question TEXT NOT NULL,answer TEXT NOT NULL,category TEXT NOT NULL,scholar TEXT NOT NULL DEFAULT 'Qualified scholar',institution TEXT NOT NULL DEFAULT '',source_url TEXT,status TEXT NOT NULL DEFAULT 'published',created_at TEXT NOT NULL,updated_at TEXT NOT NULL)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS questions (id TEXT PRIMARY KEY,user_id TEXT,name TEXT NOT NULL,gender TEXT NOT NULL DEFAULT 'unspecified',country TEXT,city TEXT,question TEXT NOT NULL,category TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'submitted',answer TEXT,answered_by TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS post_submissions (id TEXT PRIMARY KEY,name TEXT NOT NULL,country TEXT,city TEXT,title TEXT,body TEXT,category TEXT,language TEXT NOT NULL DEFAULT 'en',status TEXT NOT NULL DEFAULT 'pending',rejection_reason TEXT,submitter_device_id TEXT,image_url TEXT,author_image_url TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS posts (id TEXT PRIMARY KEY,title TEXT,body TEXT,category TEXT,featured INTEGER NOT NULL DEFAULT 0,status TEXT NOT NULL DEFAULT 'published',city TEXT,author TEXT,image_url TEXT,author_image_url TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)"),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS post_likes (post_id TEXT NOT NULL,device_id TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(post_id,device_id))'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,title TEXT NOT NULL,body TEXT NOT NULL,question_id TEXT,post_id TEXT,read_at TEXT,created_at TEXT NOT NULL)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at)'),
  ]);
}

async function userFor(env: Env, request: Request, body?: Row) {
  const token = bearer(request);
  if (token) {
    const tokenHash = await hash(token);
    const session = await env.DB.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>?').bind(tokenHash, now()).first<Row>();
    if (session) return session;
  }
  const deviceId = String(body?.deviceId || new URL(request.url).searchParams.get('deviceId') || '').trim();
  if (!deviceId) return null;
  return await env.DB.prepare('SELECT * FROM users WHERE device_id=?').bind(deviceId).first<Row>();
}

async function createOrUpdateUser(env: Env, body: Row) {
  const deviceId = String(body.deviceId || '').trim();
  const name = String(body.name || '').trim();
  const country = String(body.country || '').trim();
  const city = String(body.city || '').trim();
  if (deviceId.length < 8 || name.length < 2 || country.length < 2 || city.length < 2) throw new Error('invalid_profile');
  const timestamp = now();
  let user = await env.DB.prepare('SELECT * FROM users WHERE device_id=?').bind(deviceId).first<Row>();
  if (user) await env.DB.prepare('UPDATE users SET name=?,country=?,city=?,updated_at=? WHERE id=?').bind(name, country, city, timestamp, user.id).run();
  else { user = { id: id('user'), device_id: deviceId, name, country, city, created_at: timestamp, updated_at: timestamp }; await env.DB.prepare('INSERT INTO users(id,device_id,name,country,city,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').bind(user.id, deviceId, name, country, city, timestamp, timestamp).run(); }
  const rawToken = `${crypto.randomUUID()}-${crypto.randomUUID()}`;
  await env.DB.prepare('INSERT INTO sessions(id,user_id,token_hash,expires_at,created_at,last_seen_at) VALUES(?,?,?,?,?,?)').bind(id('session'), user.id, await hash(rawToken), new Date(Date.now() + 30 * 86400000).toISOString(), timestamp, timestamp).run();
  return { user, sessionToken: rawToken };
}

function publicFatwa(row: Row) { return { id: row.id, question: row.question, answer: row.answer, category: row.category, scholar: row.scholar, institution: row.institution, sourceUrl: row.source_url || undefined, status: row.status, createdAt: row.created_at }; }
function publicPost(row: Row) { return { id: row.id, title: row.title, body: row.body, category: row.category, featured: Boolean(row.featured), status: row.status, author: row.author || 'Fatwa editorial team', city: row.city || '', imageUrl: row.image_url || '', authorImageUrl: row.author_image_url || '', likes: Number(row.likes || 0), likedByDevice: Boolean(row.likedByDevice), createdAt: row.created_at }; }
function adminQuestion(row: Row) { return { id: row.id, name: row.name, gender: row.gender, country: row.country, city: row.city, question: row.question, category: row.category, status: row.status, answer: row.answer || undefined, answeredBy: row.answered_by || undefined, createdAt: row.created_at, updatedAt: row.updated_at }; }
function adminSubmission(row: Row) { return { id: row.id, name: row.name, country: row.country, city: row.city, title: row.title, body: row.body, category: row.category, language: row.language, imageUrl: row.image_url || undefined, authorImageUrl: row.author_image_url || undefined, status: row.status, rejectionReason: row.rejection_reason || undefined, createdAt: row.created_at }; }
async function notifySubmitter(env: Env, submission: Row, postId: string) {
  const deviceId = String(submission.submitter_device_id || '');
  if (!deviceId) return;
  const user = await env.DB.prepare('SELECT id FROM users WHERE device_id=?').bind(deviceId).first<Row>();
  if (!user) return;
  await env.DB.prepare('INSERT INTO notifications(id,user_id,title,body,question_id,post_id,read_at,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(id('notification'), user.id, 'Your post was published', 'Your community post is now live in the app.', null, postId, null, now()).run();
}

async function adminOk(env: Env, request: Request) { const token = bearer(request); return Boolean(token && env.ADMIN_TOKEN && token === env.ADMIN_TOKEN); }
async function audit(env: Env, action: string, entityType: string, entityId: string | null, metadata: Row = {}) { await env.DB.prepare('INSERT INTO admin_audit_logs(id,admin_id,action,entity_type,entity_id,metadata_json,created_at) VALUES(?,?,?,?,?,?,?)').bind(id('audit'), 'admin', action, entityType, entityId, JSON.stringify(metadata), now()).run(); }

type ChatTurn = { role: 'user' | 'assistant' | 'system'; content: string };

function chatHistory(value: unknown): ChatTurn[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Row => Boolean(item) && typeof item === 'object')
    .map((item) => ({ role: item.role === 'assistant' ? 'assistant' : 'user', content: String(item.content ?? '').slice(0, 4000) }) as ChatTurn)
    .filter((item) => item.content.trim().length > 0)
    .slice(-8);
}

function cautiousPrayerReply(message: string): string | null {
  const hasPrayerContext = /\b(?:prayer|salah|salat|namaz|rak(?:at|ats|aah|[’']ah)|rakaat|fajr)\b/i.test(message) || /نماز|رکعت|فجر|صلاة|ركعة/.test(message);
  if (!hasPrayerContext) return null;

  const asksForRuling = /\b(?:should i|do i need to|what should i|what do i|valid|invalid|repeat|redo|mistake|accidental(?:ly)?|extra|missed|forgot)\b/i.test(message)
    || /غلطی|اضافی|زیادہ|بھول|دوبارہ|کیا کروں|کیا حکم|صحیح|باطل|خطأ|زائد|نسيت|أعيد|ماذا أفعل|الحكم/.test(message);
  if (!asksForRuling) return null;

  if (/\b(?:prayer|salah|salat|namaz|rak(?:at|ats|aah|[’']ah)|rakaat|fajr)\b/i.test(message)) {
    return 'Whether a prayer needs repeating or correcting depends on exactly what happened and the school of law followed. I cannot verify a reliable ruling for your specific case here. Please ask a qualified scholar before repeating or changing the prayer.';
  }
  if (/کیا|نماز|رکعت|فجر|غلطی|دوبارہ/.test(message)) {
    return 'نماز دہرانے یا اس کی اصلاح کا حکم اس بات پر منحصر ہے کہ اصل میں کیا ہوا، اور اس میں فقہی تفصیل ہو سکتی ہے۔ میں اس صورت کا معتبر حکم یہاں تصدیق نہیں کر سکتا؛ نماز دہرانے یا بدلنے سے پہلے کسی مستند مفتی سے پوچھیں۔';
  }
  return 'حكم إعادة الصلاة أو تصحيحها يعتمد على تفاصيل ما وقع، وقد تختلف فيه الأحكام الفقهية. لا أستطيع التحقق من حكم موثوق لهذه الحالة هنا؛ اسأل عالمًا مؤهلًا قبل إعادة الصلاة أو تغييرها.';
}

function cleanAnswer(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object') {
    const record = value as Row;
    for (const key of ['response', 'answer', 'text', 'result']) {
      if (typeof record[key] === 'string') return record[key].trim();
    }
  }
  return '';
}

async function chatReply(env: Env, turns: ChatTurn[]): Promise<string> {
  if (!env.AI) throw new Error('ai_unavailable');
  const result = await env.AI.run(CHAT_MODEL, { messages: [{ role: 'system', content: CHAT_SYSTEM_PROMPT }, ...turns], max_tokens: 1024, temperature: 0.3 });
  const answer = cleanAnswer(result);
  if (!answer) throw new Error('empty_answer');
  return answer;
}

async function handle(request: Request, env: Env) {
  const origin = corsOrigin(request, env);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'access-control-allow-origin': origin, 'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS', 'access-control-allow-headers': 'Content-Type, Authorization, X-Admin-Token', 'access-control-max-age': '86400' } });
  const url = new URL(request.url); const path = url.pathname.replace(/^\/api/, '') || '/';
  if (path === '/' || path === '/health' || path === '/healthz') return json({ ok: true, service: 'fatwa-api', backend: 'cloudflare-d1', timestamp: now() }, 200, origin);
  try {
    await ensureSchema(env);
    if (path === '/fatwas' && request.method === 'GET') { const search = (url.searchParams.get('search') || '').trim(); const like = `%${search}%`; const q = search ? await env.DB.prepare("SELECT * FROM fatwas WHERE status='published' AND (question LIKE ? OR answer LIKE ? OR category LIKE ? OR institution LIKE ?) ORDER BY created_at DESC").bind(like, like, like, like).all<Row>() : await env.DB.prepare("SELECT * FROM fatwas WHERE status='published' ORDER BY created_at DESC").all<Row>(); return json({ fatwas: q.results.map(publicFatwa) }, 200, origin); }
    if (path === '/posts' && request.method === 'GET') {
      const search = (url.searchParams.get('search') || '').trim();
      const deviceId = (url.searchParams.get('deviceId') || '').trim();
      const selection = 'SELECT posts.*,(SELECT COUNT(*) FROM post_likes WHERE post_id=posts.id) AS likes,EXISTS(SELECT 1 FROM post_likes WHERE post_id=posts.id AND device_id=?) AS likedByDevice FROM posts';
      const q = search
        ? await env.DB.prepare(`${selection} WHERE status='published' AND (title LIKE ? OR body LIKE ? OR category LIKE ?) ORDER BY created_at DESC`).bind(deviceId, `%${search}%`, `%${search}%`, `%${search}%`).all<Row>()
        : await env.DB.prepare(`${selection} WHERE status='published' ORDER BY created_at DESC`).bind(deviceId).all<Row>();
      return json({ posts: q.results.map(publicPost) }, 200, origin);
    }
    const postLikeMatch = path.match(/^\/posts\/([^/]+)\/like$/);
    if (postLikeMatch && request.method === 'POST') {
      if (!await rateLimit(env, request, 'post-like', 120)) return json({ error: 'Too many requests.' }, 429, origin);
      const body = await readJson(request);
      const deviceId = String(body.deviceId || '').trim();
      if (deviceId.length < 8 || typeof body.liked !== 'boolean') return json({ error: 'A valid device and like state are required.' }, 400, origin);
      const postId = decodeURIComponent(postLikeMatch[1]);
      const post = await env.DB.prepare("SELECT id FROM posts WHERE id=? AND status='published'").bind(postId).first<Row>();
      if (!post) return json({ error: 'Post not found.' }, 404, origin);
      if (body.liked) await env.DB.prepare('INSERT OR IGNORE INTO post_likes(post_id,device_id,created_at) VALUES(?,?,?)').bind(postId, deviceId, now()).run();
      else await env.DB.prepare('DELETE FROM post_likes WHERE post_id=? AND device_id=?').bind(postId, deviceId).run();
      const count = await env.DB.prepare('SELECT COUNT(*) AS count FROM post_likes WHERE post_id=?').bind(postId).first<Row>();
      return json({ liked: body.liked, likes: Number(count?.count || 0) }, 200, origin);
    }
    if (path === '/profile' && request.method === 'POST') { if (!await rateLimit(env, request, 'profile', 20)) return json({ error: 'Too many requests.' }, 429, origin); const body = await readJson(request); const result = await createOrUpdateUser(env, body); return json({ ok: true, sessionToken: result.sessionToken, user: { id: result.user.id, name: body.name, country: body.country, city: body.city } }, 200, origin); }
    if (path === '/questions' && request.method === 'POST') { if (!await rateLimit(env, request, 'question', 10)) return json({ error: 'Too many requests.' }, 429, origin); const body = await readJson(request); const user = await userFor(env, request, body); if (!user) return json({ error: 'Complete your profile before submitting.' }, 401, origin); const question = String(body.question || '').trim(); const category = String(body.category || ''); if (question.length < 20 || !CATEGORIES.has(category)) return json({ error: 'Question and a valid category are required.' }, 400, origin); const timestamp = now(); const questionId = id('question'); await env.DB.prepare('INSERT INTO questions(id,user_id,name,gender,country,city,question,category,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(questionId, user.id, user.name, ['male','female'].includes(body.gender) ? body.gender : 'unspecified', user.country || body.country || '', user.city || body.city || '', question, category, 'submitted', timestamp, timestamp).run(); return json({ id: questionId, userId: user.id, status: 'submitted', createdAt: timestamp }, 201, origin); }
    if (path === '/questions' && request.method === 'GET') { const user = await userFor(env, request); const q = user ? await env.DB.prepare('SELECT id,name,gender,country,city,question,category,status,answer,answered_by AS answeredBy,created_at AS createdAt,updated_at AS updatedAt FROM questions WHERE user_id=? ORDER BY created_at DESC').bind(user.id).all<Row>() : { results: [] }; return json({ questions: q.results }, 200, origin); }
    if (path === '/notifications' && request.method === 'GET') { const user = await userFor(env, request); const q = user ? await env.DB.prepare('SELECT id,title,body,question_id AS questionId,post_id AS postId,read_at AS readAt,created_at AS createdAt FROM notifications WHERE user_id=? ORDER BY created_at DESC').bind(user.id).all<Row>() : { results: [] }; return json({ notifications: q.results }, 200, origin); }
    if (/^\/notifications\/[^/]+\/read$/.test(path) && request.method === 'POST') { const user = await userFor(env, request, await readJson(request)); if (!user) return json({ error: 'Notification not found.' }, 404, origin); const notificationId = path.split('/')[2]; await env.DB.prepare('UPDATE notifications SET read_at=? WHERE id=? AND user_id=?').bind(now(), notificationId, user.id).run(); return json({ ok: true }, 200, origin); }
    if (path === '/notifications/read-all' && request.method === 'POST') { const user = await userFor(env, request, await readJson(request)); if (!user) return json({ error: 'Notification not found.' }, 404, origin); const result = await env.DB.prepare('UPDATE notifications SET read_at=? WHERE user_id=? AND read_at IS NULL').bind(now(), user.id).run(); return json({ ok: true, updated: Number(result.meta?.changes ?? 0) }, 200, origin); }
    if (path === '/chat' && request.method === 'POST') {
      if (!await rateLimit(env, request, 'chat', 20)) return json({ error: 'Too many requests. Please wait a moment and try again.' }, 429, origin);
      const body = await readJson(request);
      const message = String(body.message || '').trim();
      if (!message) return json({ error: 'Please write your question.' }, 400, origin);
      if (message.length > 4000) return json({ error: 'Question is too long.' }, 413, origin);
      const turns: ChatTurn[] = [...chatHistory(body.history), { role: 'user', content: message }];
      const cautiousReply = cautiousPrayerReply(message);
      if (cautiousReply) return json({ answer: cautiousReply }, 200, origin);
      if (!env.AI) return json({ error: 'The assistant is temporarily unavailable. Please try again later.' }, 503, origin);
      try {
        const answer = await chatReply(env, turns);
        return json({ answer }, 200, origin);
      } catch (error) {
        console.error('chat error', String(error));
        return json({ error: 'The assistant could not answer right now. Please try again.' }, 502, origin);
      }
    }
    if (path === '/post-submissions' && request.method === 'POST') { if (!await rateLimit(env, request, 'post', 10)) return json({ error: 'Too many requests.' }, 429, origin); const form = await request.formData(); const body = String(form.get('body') || '').trim(); const deviceId = String(form.get('deviceId') || '').trim(); const user = await userFor(env, request, { deviceId }); if (!user) return json({ error: 'Complete your profile before submitting.' }, 401, origin); const image = form.get('image'); if (!body && !(image instanceof File)) return json({ error: 'Description or image is required.' }, 400, origin); let imageUrl = ''; if (image instanceof File) { if (!/^image\/(jpeg|png|webp|gif)$/.test(image.type)) return json({ error: 'Only JPG, PNG, WEBP or GIF images are allowed.' }, 415, origin); if (image.size > IMAGE_MAX) return json({ error: 'Image must be smaller than 8 MB.' }, 413, origin); const key = `posts/${crypto.randomUUID()}.${image.type.split('/')[1].replace('jpeg','jpg')}`; await env.MEDIA.put(key, image.stream(), { httpMetadata: { contentType: image.type } }); imageUrl = `${url.origin}/api/media/${encodeURIComponent(key)}`; } const timestamp = now(); const submissionId = id('submission'); await env.DB.prepare('INSERT INTO post_submissions(id,name,country,city,title,body,category,language,status,rejection_reason,submitter_device_id,image_url,author_image_url,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(submissionId, user.name, user.country || '', user.city || '', body.slice(0, 80) || 'Community image', body, String(form.get('category') || ''), ['ur','ar'].includes(String(form.get('language'))) ? String(form.get('language')) : 'en', 'pending', null, user.device_id, imageUrl || null, user.avatar_url || null, timestamp, timestamp).run(); return json({ id: submissionId, status: 'pending', createdAt: timestamp, imageUrl }, 201, origin); }
    if (path.startsWith('/media/') && request.method === 'GET') { const key = decodeURIComponent(path.slice(7)); const object = await env.MEDIA.get(key); if (!object) return text('Not found', 404, origin); const headers = new Headers({ 'cache-control': 'public, max-age=31536000, immutable', 'access-control-allow-origin': origin, 'x-content-type-options': 'nosniff' }); if (object.httpMetadata?.contentType) headers.set('content-type', object.httpMetadata.contentType); return new Response(object.body, { headers }); }
    if (path.startsWith('/admin')) {
      if (!await adminOk(env, request)) return json({ error: 'Admin authentication required.' }, 401, origin);

      if (path === '/admin/stats' && request.method === 'GET') {
        const [posts, fatwas, questions, users, submissions] = await Promise.all([
          env.DB.prepare("SELECT COUNT(*) AS count FROM posts").first<Row>(),
          env.DB.prepare("SELECT COUNT(*) AS count FROM fatwas").first<Row>(),
          env.DB.prepare("SELECT COUNT(*) AS count FROM questions WHERE status!='answered'").first<Row>(),
          env.DB.prepare("SELECT COUNT(*) AS count FROM users").first<Row>(),
          env.DB.prepare("SELECT COUNT(*) AS count FROM post_submissions WHERE status='pending'").first<Row>(),
        ]);
        return json({ publishedPosts: Number(posts?.count || 0), publishedFatwas: Number(fatwas?.count || 0), pendingQuestions: Number(questions?.count || 0), users: Number(users?.count || 0), pendingPosts: Number(submissions?.count || 0) }, 200, origin);
      }
      if (path === '/admin/users' && request.method === 'GET') { const q = await env.DB.prepare('SELECT id,name,country,city,avatar_url AS avatarUrl,device_id AS deviceId,created_at AS createdAt,updated_at AS updatedAt FROM users ORDER BY updated_at DESC').all<Row>(); return json({ users: q.results }, 200, origin); }
      if (path === '/admin/posts' && request.method === 'GET') { const q = await env.DB.prepare('SELECT * FROM posts ORDER BY created_at DESC').all<Row>(); return json({ posts: q.results.map(publicPost) }, 200, origin); }
      if (path === '/admin/fatwas' && request.method === 'GET') { const q = await env.DB.prepare('SELECT * FROM fatwas ORDER BY created_at DESC').all<Row>(); return json({ fatwas: q.results.map(publicFatwa) }, 200, origin); }
      if (path === '/admin/questions' && request.method === 'GET') { const q = await env.DB.prepare('SELECT * FROM questions ORDER BY created_at DESC').all<Row>(); return json({ questions: q.results.map(adminQuestion) }, 200, origin); }
      if (path === '/admin/post-submissions' && request.method === 'GET') { const q = await env.DB.prepare('SELECT * FROM post_submissions ORDER BY created_at DESC').all<Row>(); return json({ submissions: q.results.map(adminSubmission) }, 200, origin); }
      if (path === '/admin/audit' && request.method === 'GET') { const q = await env.DB.prepare('SELECT * FROM admin_audit_logs ORDER BY created_at DESC LIMIT 100').all<Row>(); return json({ audit: q.results }, 200, origin); }

      if (path === '/admin/fatwas' && request.method === 'POST') {
        const body = await readJson(request);
        const question = String(body.question || '').trim();
        const answer = String(body.answer || '').trim();
        if (!question || !answer || !CATEGORIES.has(String(body.category || ''))) return json({ error: 'Question, answer and a valid category are required.' }, 400, origin);
        const timestamp = now();
        const fatwaId = id('fatwa');
        await env.DB.prepare('INSERT INTO fatwas(id,question,answer,category,scholar,institution,source_url,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(fatwaId, question, answer, body.category, String(body.scholar || 'Qualified scholar'), String(body.institution || ''), String(body.sourceUrl || ''), body.status === 'draft' ? 'draft' : 'published', timestamp, timestamp).run();
        await audit(env, 'create', 'fatwa', fatwaId);
        return json({ ok: true, id: fatwaId }, 201, origin);
      }
      const fatwaMatch = path.match(/^\/admin\/fatwas\/([^/]+)$/);
      if (fatwaMatch) {
        const fatwaId = fatwaMatch[1];
        if (request.method === 'PATCH') {
          const body = await readJson(request);
          const current = await env.DB.prepare('SELECT * FROM fatwas WHERE id=?').bind(fatwaId).first<Row>();
          if (!current) return json({ error: 'Fatwa not found.' }, 404, origin);
          const next = {
            question: String(body.question ?? current.question).trim(),
            answer: String(body.answer ?? current.answer).trim(),
            category: CATEGORIES.has(String(body.category)) ? String(body.category) : current.category,
            scholar: String(body.scholar ?? current.scholar),
            institution: String(body.institution ?? current.institution),
            sourceUrl: String(body.sourceUrl ?? current.source_url ?? ''),
            status: body.status === 'draft' ? 'draft' : body.status === 'published' ? 'published' : current.status,
          };
          if (!next.question || !next.answer) return json({ error: 'Question and answer are required.' }, 400, origin);
          const timestamp = now();
          await env.DB.prepare('INSERT INTO fatwa_revisions(id,fatwa_id,question,answer,category,scholar,institution,source_url,status,changed_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(id('revision'), fatwaId, current.question, current.answer, current.category, current.scholar, current.institution, current.source_url, current.status, 'admin', timestamp).run();
          await env.DB.prepare('UPDATE fatwas SET question=?,answer=?,category=?,scholar=?,institution=?,source_url=?,status=?,updated_at=? WHERE id=?').bind(next.question, next.answer, next.category, next.scholar, next.institution, next.sourceUrl, next.status, timestamp, fatwaId).run();
          await audit(env, 'update', 'fatwa', fatwaId, { status: next.status });
          return json({ ok: true, id: fatwaId, status: next.status }, 200, origin);
        }
        if (request.method === 'DELETE') {
          const current = await env.DB.prepare('SELECT id FROM fatwas WHERE id=?').bind(fatwaId).first<Row>();
          if (!current) return json({ error: 'Fatwa not found.' }, 404, origin);
          await env.DB.prepare('DELETE FROM fatwas WHERE id=?').bind(fatwaId).run();
          await audit(env, 'delete', 'fatwa', fatwaId);
          return json({ ok: true }, 200, origin);
        }
      }
      const questionAnswerMatch = path.match(/^\/admin\/questions\/([^/]+)\/answer$/);
      if (questionAnswerMatch && request.method === 'PATCH') {
        const questionId = questionAnswerMatch[1];
        const body = await readJson(request);
        const answer = String(body.answer || '').trim();
        if (answer.length < 2) return json({ error: 'Write the answer before publishing.' }, 400, origin);
        const question = await env.DB.prepare('SELECT * FROM questions WHERE id=?').bind(questionId).first<Row>();
        if (!question) return json({ error: 'Question not found.' }, 404, origin);
        const timestamp = now();
        const answeredBy = String(body.answeredBy || 'Fatwa editorial team').trim();
        await env.DB.prepare("UPDATE questions SET answer=?,answered_by=?,status='answered',updated_at=? WHERE id=?").bind(answer, answeredBy, timestamp, questionId).run();
        if (question.user_id) {
          await env.DB.prepare('INSERT INTO notifications(id,user_id,title,body,question_id,read_at,created_at) VALUES(?,?,?,?,?,?,?)').bind(id('notification'), question.user_id, 'Your question was answered', answer.slice(0, 160), questionId, null, timestamp).run();
        }
        await audit(env, 'answer', 'question', questionId);
        return json({ ok: true, id: questionId, status: 'answered' }, 200, origin);
      }
      const submissionMatch = path.match(/^\/admin\/post-submissions\/([^/]+)(?:\/(approve|reject))?$/);
      if (submissionMatch && request.method === 'POST' && submissionMatch[2]) {
        const submission = await env.DB.prepare('SELECT * FROM post_submissions WHERE id=?').bind(submissionMatch[1]).first<Row>();
        if (!submission) return json({ error: 'Submission not found.' }, 404, origin);
        const body = await readJson(request).catch(() => ({} as Row));
        const timestamp = now();
        if (submissionMatch[2] === 'approve') {
          const postId = id('post');
          await env.DB.prepare('INSERT INTO posts(id,title,body,category,featured,status,created_at,updated_at,city,author,image_url,author_image_url) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(postId, submission.title, submission.body, submission.category, 0, 'published', timestamp, timestamp, submission.city || '', submission.name, submission.image_url, submission.author_image_url).run();
          await env.DB.prepare('UPDATE post_submissions SET status=?,updated_at=? WHERE id=?').bind('approved', timestamp, submission.id).run();
          await notifySubmitter(env, submission, postId);
        } else {
          await env.DB.prepare('UPDATE post_submissions SET status=?,rejection_reason=?,updated_at=? WHERE id=?').bind('rejected', String(body.reason || 'Not approved'), timestamp, submission.id).run();
        }
        await audit(env, submissionMatch[2], 'post_submission', submission.id, { reason: body.reason || null });
        return json({ ok: true, status: submissionMatch[2] === 'approve' ? 'approved' : 'rejected' }, 200, origin);
      }
      if (submissionMatch && request.method === 'PATCH') {
        const submission = await env.DB.prepare('SELECT * FROM post_submissions WHERE id=?').bind(submissionMatch[1]).first<Row>();
        if (!submission) return json({ error: 'Submission not found.' }, 404, origin);
        const body = await readJson(request);
        const action = body.action === 'approve' ? 'approve' : body.action === 'reject' ? 'reject' : '';
        if (!action) return json({ error: 'A valid action is required.' }, 400, origin);
        const timestamp = now();
        if (action === 'approve') {
          if (submission.status !== 'approved') {
            const postId = id('post');
            await env.DB.prepare('INSERT INTO posts(id,title,body,category,featured,status,created_at,updated_at,city,author,image_url,author_image_url) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(postId, submission.title, submission.body, submission.category, 0, 'published', timestamp, timestamp, submission.city || '', submission.name, submission.image_url, submission.author_image_url).run();
            await notifySubmitter(env, submission, postId);
          }
          await env.DB.prepare('UPDATE post_submissions SET status=?,updated_at=? WHERE id=?').bind('approved', timestamp, submission.id).run();
        } else {
          await env.DB.prepare('UPDATE post_submissions SET status=?,rejection_reason=?,updated_at=? WHERE id=?').bind('rejected', String(body.reason || 'Not approved'), timestamp, submission.id).run();
        }
        await audit(env, action, 'post_submission', submission.id, { reason: body.reason || null });
        return json({ ok: true, status: action === 'approve' ? 'approved' : 'rejected' }, 200, origin);
      }
      const postMatch = path.match(/^\/admin\/posts\/([^/]+)$/);
      if (postMatch) {
        const postId = postMatch[1];
        const post = await env.DB.prepare('SELECT * FROM posts WHERE id=?').bind(postId).first<Row>();
        if (!post) return json({ error: 'Post not found.' }, 404, origin);
        if (request.method === 'PATCH') {
          const body = await readJson(request);
          const timestamp = now();
          const featured = body.action === 'pin' ? 1 : body.action === 'unpin' ? 0 : body.featured ? 1 : 0;
          await env.DB.prepare('UPDATE posts SET featured=?,updated_at=? WHERE id=?').bind(featured, timestamp, postId).run();
          await audit(env, 'update', 'post', postId, { featured: Boolean(featured) });
          return json({ ok: true, id: postId, featured: Boolean(featured) }, 200, origin);
        }
        if (request.method === 'DELETE') {
          await env.DB.prepare('DELETE FROM posts WHERE id=?').bind(postId).run();
          await audit(env, 'delete', 'post', postId);
          return json({ ok: true }, 200, origin);
        }
      }
    }
    return json({ error: 'Not found.' }, 404, origin);
  } catch (error) { const [message, status] = safeError(error); return json({ error: message }, status, origin); }
}

export default { fetch(request: Request, env: Env) { return handle(request, env); } };
