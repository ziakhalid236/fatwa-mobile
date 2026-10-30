import { processPushQueue, pushSchemaStatements, queueBroadcast, registerPushToken } from './push';
import { libraryRoute } from './library';
import { withTurso } from './turso';
import { adminExtras, extraColumns, extraSchema, publicExtras, type Ctx } from './extras';
import { expandQuery, tokens as kbTokens, kbSchemaStatements, searchKb, kbContext, publicHit, ingest as kbIngest, importScholars, kbStats, kbMigrate, reseq as kbReseq, type KbHit } from './kb';
interface Env {
  DB: D1Database;
  KB: D1Database;
  MEDIA: R2Bucket;
  AI?: { run: (model: string, input: unknown) => Promise<unknown> };
  ADMIN_TOKEN?: string;
  FCM_SERVICE_ACCOUNT?: string;
  ALLOWED_ORIGINS?: string;
  TURSO_DB_URL?: string;
  TURSO_DB_TOKEN?: string;
  TURSO_KB_URL?: string;
  TURSO_KB_TOKEN?: string;
  GOOGLE_CLIENT_IDS?: string;
  RESEND_API_KEY?: string;
  MAIL_FROM?: string;
  SMTP_USER?: string;
  SMTP_PASS?: string;
}

type Row = Record<string, any>;
const MAX_BODY = 4 * 1024 * 1024;
const IMAGE_MAX = 8 * 1024 * 1024;
const CATEGORIES = new Set(['Aqeedah', 'Namaz', 'Roza', 'Zakat', 'Hajj & Umrah', 'Nikah & Family', 'Muamalat', 'Tafseer & Quran']);

const CHAT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

const CHAT_SYSTEM_PROMPT = [
  'You are the Islamic guidance assistant inside the Fatwa mobile app. You answer every question the user asks about Islam: worship, creed, character, family, finance, daily life, Quran, hadith, seerah, history and more.',
  '',
  'Language:',
  '- Understand the user first, then answer in the SAME language and script the user wrote in (Urdu, Arabic, English, Pashto, Sindhi, Punjabi, Bengali, Turkish, Roman Urdu...). Write natural, correct, simple language.',
  '- Keep a warm, calm, respectful tone.',
  '- Use ONLY the user\'s own script. When answering in Urdu or Arabic never put Cyrillic, Chinese, Korean or other foreign-script words in the answer; if you do not know the Urdu word, use a simple Urdu or Arabic synonym. Never mix English words with underscores or Latin letters inside Urdu sentences.',
  '',
  'How to answer:',
  '- Answer the question directly and completely. Do not refuse a question just because it is about a ruling; give the ruling that is standard in mainstream Hanafi fiqh (as taught by the scholars of Deoband and Ahl-e-Sunnat) first, then briefly mention if other schools differ.',
  '- Be precise and step by step for practical questions (prayer mistakes, wudu, fasting, zakat, travel). Make sure every step is consistent and nothing contradicts itself.',
  '- Use the "Reference notes" and "Verified fatwas" below when they apply; they take priority over your memory.',
  '- Quote a Quran verse or hadith only when you are sure it is accurate. Never invent verses, hadith, book names, page numbers or scholars. If you are not sure of a detail, say plainly that this detail should be confirmed with a mufti.',
  '- For very serious or personal matters (divorce, inheritance, oaths, apostasy, legal disputes) give the general principle and advise asking a qualified mufti with the full facts.',
  '- Format: short paragraphs or a few numbered steps. No tables. No headings with symbols. No more than about 250 words unless the user asks for detail.',
  '- If the question is not about Islam or daily guidance (e.g. coding), politely say you help with Islamic questions.',
  '- For ruling questions, end with one short line that this is general guidance and a qualified mufti should be consulted for personal situations.',
].join('\n');

const REFERENCE_NOTES = [
  'Reference notes (mainstream Hanafi):',
  '- Fard rakats: Fajr 2, Zuhr 4, Asr 4, Maghrib 3, Isha 4, plus 3 rakats witr (wajib) after Isha.',
  '- Sajdah sahw (prostration of forgetfulness) becomes wajib when a wajib of prayer is missed, delayed or changed (e.g. forgetting Surah Fatihah or the Surah, wrong order, extra rakat). Method: at the end, after the tashahhud, give salam to the right side only, do two sajdahs, then sit, recite tashahhud, durood and dua again and give salam to both sides.',
  '- Extra (fifth) rakat in a four-rakat fard prayer: if the person had sat for the last qadah (tashahhud) in the fourth rakat and stood up by mistake, he should return and sit as soon as he remembers before the sajdah of the fifth rakat, do sajdah sahw, and the prayer is valid. If he already did the sajdah of the fifth rakat, he adds a sixth rakat (the extra two are nafl), then does sajdah sahw, and the fard is valid. If he did NOT sit for the last qadah in the fourth rakat and then did the sajdah of the fifth rakat, the fard prayer is invalid and must be prayed again.',
  '- Forgetful eating or drinking does not break the fast. Deliberately breaking a Ramadan fast without excuse by eating, drinking or intimacy requires qada plus kaffarah (fast 60 consecutive days, or feed 60 poor people).',
  '- Wudu breaks by anything leaving the front or back passage, flowing blood or pus, vomiting a mouthful, deep sleep lying or leaning, fainting, and laughing aloud inside a prayer with ruku and sajdah. Touching a spouse does not break wudu in Hanafi fiqh.',
  '- Fard acts of ghusl: rinsing the mouth, rinsing the nose, and washing the whole body.',
  '- Iddah (waiting period): a divorced woman who has menses waits three full menstrual cycles (Hanafi); one who no longer menstruates (or never has) waits three lunar months; a pregnant woman waits until delivery; a widow waits four months and ten days (also if pregnant, until delivery if later). A slave woman waits two cycles if divorced. Do NOT say "three months ten days".',
  '- Combining two prayers while travelling: mainstream Hanafi fiqh does not allow real combining (jam haqiqi) except Zuhr+Asr at Arafat and Maghrib+Isha at Muzdalifah on Hajj. A traveller may pray each prayer at the end of its own time and the next at the start of its time (jam suri). Shafi\'i, Maliki and Hanbali scholars allow combining while travelling.',
  '- The hadith on forgetful eating in a fast (whoever eats or drinks forgetfully should complete his fast, for Allah fed him) is reported in Sahih al-Bukhari and Sahih Muslim; cite those, not any other book, unless a retrieved source says otherwise.',
  '- Zakat is 2.5% of zakatable wealth held for one lunar year above the nisab (7.5 tola gold = 87.48 g, or 52.5 tola silver = 612.36 g; silver nisab is usually used for cash).',
  '- A traveller shortens 4-rakat fard prayers to 2 after leaving the city limits on a journey of about 77 km (48 miles) or more, until he intends to stay 15 days or more in one place.',
  '- Wudu method (Hanafi). Four fards: wash the whole face; wash both arms including the elbows; wipe (masah) a quarter of the head; wash both feet including the ankles. Sunnahs in order: intention, Bismillah, wash both hands to the wrists three times, miswak, rinse the mouth three times, sniff water into the nose and blow it out three times, wash the face three times, arms (right then left) three times, wipe the whole head once with wet hands, wipe the ears, wash the feet (right then left) three times, run wet fingers between fingers and toes, keep the order and do not pause long. Do NOT say the head or nose is "washed" and do not wash the hands twice as a separate step.',
  '- Ghusl method: intention, wash hands and private parts, wudu, pour water over the head three times and then over the right and left shoulder so the whole body is wet; rinsing mouth, rinsing nose and washing the whole body are fard.',
  '- Salah basics: five daily prayers are fard on every sane adult Muslim. Fard of prayer: takbir tahrimah, standing (qiyam), recitation of some Quran, ruku, sajdah, final sitting (qadah akhirah) for the length of tashahhud. Wajibs include Surah Fatihah and another surah in the first two rakats of fard, and witr, and salam.',
  '- Fasting: Ramadan fasting is fard. A fast begins at subh sadiq (dawn) and ends at sunset (Maghrib). The sick, travellers, menstruating and postnatal women may delay it and make qada later; the elderly who can never fast pay fidyah (feeding one poor person per day).',
  '- Eid prayer is wajib for those on whom Jumu\'ah is wajib; Jumu\'ah is two rakats fard after the khutbah and is wajib for free, resident, sane, healthy adult men.',
  '- Riba (interest) is haram: taking, giving, writing and witnessing it (Sahih Muslim).',
].join('\n');

const POST_TTL_DAYS = 30;
const POST_TTL_MS = POST_TTL_DAYS * 86400000;
const postCutoff = () => new Date(Date.now() - POST_TTL_MS).toISOString();

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
  const step = async <T>(label: string, fn: () => Promise<T>) => { try { return await fn(); } catch (e) { throw new Error(label + ': ' + String(e)); } };
  await step('kb-schema', () => env.KB.batch(kbSchemaStatements(env.KB)));
  await step('kb-migrate', () => kbMigrate(env.KB));
  await step('push-schema', () => env.DB.batch(pushSchemaStatements(env.DB)));
  await step('extra-schema', () => env.DB.batch(extraSchema(env.DB)));
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
  // Additive columns (idempotent, safe on production data).
  const wanted: Record<string, Array<[string, string]>> = {
    posts: [['country', 'TEXT'], ['user_id', 'TEXT'], ['notified_at', 'TEXT']],
    users: [['notify_posts', 'INTEGER NOT NULL DEFAULT 1'], ...extraColumns.users],
    post_submissions: [['user_id', 'TEXT']],
    notifications: [['kind', 'TEXT'], ['image_url', 'TEXT']],
  };
  for (const [table, columns] of Object.entries(wanted)) {
    const info = await env.DB.prepare(`PRAGMA table_info(${table})`).all<Row>();
    const have = new Set(info.results.map((r) => String(r.name)));
    for (const [name, type] of columns) {
      if (have.has(name)) continue;
      try { await env.DB.prepare(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`).run(); } catch (error) { if (!String(error).includes('duplicate column')) throw error; }
    }
  }
}

async function userFor(env: Env, request: Request, _body?: Row) {
  const token = bearer(request);
  if (!token) return null;
  const tokenHash = await hash(token);
  return await env.DB.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.revoked_at IS NULL AND u.banned_at IS NULL AND s.expires_at>?').bind(tokenHash, now()).first<Row>() || null;
}

function publicUser(user: Row) { return { notifyPosts: user.notify_posts !== 0 && user.notify_posts !== '0', id: user.id, name: user.name, country: user.country || '', city: user.city || '', avatarUrl: user.avatar_url || '', email: user.email || '', bio: user.bio || '' }; }

async function saveProfile(env: Env, existing: Row | null, request: Request, body: Row) {
  const name = String(body.name || '').trim();
  const country = String(body.country || '').trim();
  const city = String(body.city || '').trim();
  if (name.length < 2 || country.length < 2 || city.length < 2) throw new Error('invalid_profile');
  const timestamp = now();
  if (existing) {
    const notifyPosts = typeof body.notifyPosts === 'boolean' ? (body.notifyPosts ? 1 : 0) : (existing.notify_posts === 0 ? 0 : 1);
    await env.DB.prepare('UPDATE users SET name=?,country=?,city=?,notify_posts=?,updated_at=? WHERE id=?').bind(name, country, city, notifyPosts, timestamp, existing.id).run();
    // Keep the author line on already-published posts in sync with the profile.
    await env.DB.prepare('UPDATE posts SET author=?,city=?,country=? WHERE user_id=?').bind(name, city, country, existing.id).run();
    return { user: { ...existing, name, country, city, notify_posts: notifyPosts }, sessionToken: bearer(request) };
  }
  let deviceId = String(body.deviceId || '').trim();
  if (deviceId.length < 8 || await env.DB.prepare('SELECT 1 AS x FROM users WHERE device_id=?').bind(deviceId).first()) deviceId = `${deviceId || 'device'}-${crypto.randomUUID().slice(0, 8)}`;
  const user = { id: id('user'), device_id: deviceId, name, country, city, avatar_url: null, created_at: timestamp, updated_at: timestamp };
  await env.DB.prepare('INSERT INTO users(id,device_id,name,country,city,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').bind(user.id, deviceId, name, country, city, timestamp, timestamp).run();
  const rawToken = `${crypto.randomUUID()}-${crypto.randomUUID()}`;
  await env.DB.prepare('INSERT INTO sessions(id,user_id,token_hash,expires_at,created_at,last_seen_at) VALUES(?,?,?,?,?,?)').bind(id('session'), user.id, await hash(rawToken), new Date(Date.now() + 180 * 86400000).toISOString(), timestamp, timestamp).run();
  return { user, sessionToken: rawToken };
}

async function sniffImage(file: File): Promise<string | null> {
  const b = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return 'image/gif';
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  return null;
}
async function storeImage(env: Env, origin: string, folder: string, file: File, maxBytes: number): Promise<{ url: string } | { error: string; status: number }> {
  if (file.size > maxBytes) return { error: `Image must be smaller than ${Math.round(maxBytes / 1048576)} MB.`, status: 413 };
  const type = await sniffImage(file);
  if (!type) return { error: 'Only JPG, PNG, WEBP or GIF images are allowed.', status: 415 };
  const key = `${folder}/${crypto.randomUUID()}.${type.split('/')[1].replace('jpeg', 'jpg')}`;
  await env.MEDIA.put(key, file.stream(), { httpMetadata: { contentType: type } });
  return { url: `${origin}/api/media/${encodeURIComponent(key)}` };
}

async function notify(env: Env, userId: string, n: { title: string; body: string; kind: string; postId?: string | null; questionId?: string | null; imageUrl?: string | null }) {
  await env.DB.prepare('INSERT INTO notifications(id,user_id,title,body,question_id,post_id,kind,image_url,read_at,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id('notification'), userId, n.title, n.body, n.questionId || null, n.postId || null, n.kind, n.imageUrl || null, null, now()).run();
}

function publicFatwa(row: Row) { return { id: row.id, question: row.question, answer: row.answer, category: row.category, scholar: row.scholar, institution: row.institution, sourceUrl: row.source_url || undefined, status: row.status, createdAt: row.created_at }; }
function publicPost(row: Row) { return { id: row.id, title: row.title, body: row.body, category: row.category, featured: Boolean(row.featured), status: row.status, author: row.author || 'Fatwa editorial team', city: row.city || '', country: row.country || '', authorId: row.user_id || '', imageUrl: row.image_url || '', authorImageUrl: row.author_image_url || '', likes: Number(row.likes || 0), likedByDevice: Boolean(row.likedByDevice), createdAt: row.created_at, expiresAt: new Date(new Date(row.created_at).getTime() + POST_TTL_MS).toISOString() }; }
function adminQuestion(row: Row) { return { id: row.id, name: row.name, gender: row.gender, country: row.country, city: row.city, question: row.question, category: row.category, status: row.status, answer: row.answer || undefined, answeredBy: row.answered_by || undefined, createdAt: row.created_at, updatedAt: row.updated_at }; }
function adminSubmission(row: Row) { return { id: row.id, userId: row.user_id || undefined, name: row.name, country: row.country, city: row.city, title: row.title, body: row.body, category: row.category, language: row.language, imageUrl: row.image_url || undefined, authorImageUrl: row.author_image_url || undefined, status: row.status, rejectionReason: row.rejection_reason || undefined, createdAt: row.created_at }; }
const snippet = (value: string, max: number) => { const t = value.replace(/\s+/g, ' ').trim(); return t.length > max ? `${t.slice(0, max - 1)}…` : t; };

async function submissionUserId(env: Env, submission: Row): Promise<string | null> {
  if (submission.user_id) return String(submission.user_id);
  if (!submission.submitter_device_id) return null;
  const user = await env.DB.prepare('SELECT id FROM users WHERE device_id=?').bind(submission.submitter_device_id).first<Row>();
  return user ? String(user.id) : null;
}
async function approveSubmission(env: Env, submission: Row) {
  if (submission.status === 'approved') return null;
  submission = { ...submission, user_id: await submissionUserId(env, submission) };
  const timestamp = now();
  const postId = id('post');
  const author = submission.user_id ? await env.DB.prepare('SELECT id,name,avatar_url FROM users WHERE id=?').bind(submission.user_id).first<Row>() : null;
  const avatar = author?.avatar_url || submission.author_image_url || null;
  await env.DB.prepare('INSERT INTO posts(id,title,body,category,featured,status,created_at,updated_at,city,country,author,image_url,author_image_url,user_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(postId, submission.title, submission.body, submission.category, 0, 'published', timestamp, timestamp, submission.city || '', submission.country || '', submission.name, submission.image_url, avatar, submission.user_id || null).run();
  await env.DB.prepare('UPDATE post_submissions SET status=?,updated_at=? WHERE id=?').bind('approved', timestamp, submission.id).run();
  if (submission.user_id) await notify(env, submission.user_id, { title: 'Your post is live', body: snippet(String(submission.body || submission.title || 'Your post'), 140), kind: 'post_approved', postId, imageUrl: submission.image_url });
  return postId;
}
async function rejectSubmission(env: Env, submission: Row, reason: string) {
  submission = { ...submission, user_id: await submissionUserId(env, submission) };
  await env.DB.prepare('UPDATE post_submissions SET status=?,rejection_reason=?,updated_at=? WHERE id=?').bind('rejected', reason, now(), submission.id).run();
  if (submission.user_id) await notify(env, submission.user_id, { title: 'Your post was not approved', body: reason, kind: 'post_rejected', imageUrl: submission.image_url });
}

// Notifies users about a published post: in-app notification for everyone matched plus a queued push for each device.
async function broadcastPost(env: Env, postId: string, scope: string, force = false) {
  if (!['all', 'country', 'city'].includes(scope)) return { skipped: true };
  const post = await env.DB.prepare("SELECT * FROM posts WHERE id=? AND status='published'").bind(postId).first<Row>();
  if (!post) return { skipped: true };
  if (post.notified_at && !force) return { skipped: true, already: true };
  let filter = "u.notify_posts<>0 AND u.id<>?";
  const binds: unknown[] = [post.user_id || ''];
  if (scope === 'country') { filter += " AND LOWER(TRIM(u.country))=?"; binds.push(String(post.country || '').trim().toLowerCase()); }
  if (scope === 'city') { filter += " AND LOWER(TRIM(u.city))=?"; binds.push(String(post.city || '').trim().toLowerCase()); }
  const lines = String(post.body || post.title || '').split(/\r?\n+/).map((l) => l.trim()).filter(Boolean);
  const title = snippet(lines[0] || 'New post', 80);
  const rest = lines.slice(1).join(' ');
  const body = snippet(rest || `${post.author || 'Fatwa'}${post.city ? ' · ' + post.city : ''}`, 140);
  const timestamp = now();
  const inserted = await env.DB.prepare(`INSERT INTO notifications(id,user_id,title,body,question_id,post_id,kind,image_url,read_at,created_at) SELECT 'notification-'||lower(hex(randomblob(16))),u.id,?,?,NULL,?,'broadcast',?,NULL,? FROM users u WHERE ${filter}`)
    .bind(title, body, postId, post.image_url || null, timestamp, ...binds).run();
  const queued = await queueBroadcast(env, filter, binds, { title, body, imageUrl: post.image_url, data: { type: 'post', kind: 'post', refId: postId, postId } });
  await env.DB.prepare('UPDATE posts SET notified_at=? WHERE id=?').bind(timestamp, postId).run();
  const delivery = await processPushQueue(env).catch(() => ({ configured: false, sent: 0, failed: 0 }));
  return { notified: Number(inserted.meta?.changes ?? 0), queuedPush: queued, push: delivery };
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

// Llama occasionally leaks Cyrillic/CJK/Hangul tokens into Urdu/Arabic text; the app only serves Arabic-script and Latin text.
const STRAY_SCRIPTS = /[\u0400-\u052F\u0E00-\u0E7F\u1100-\u11FF\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF]+/g;
const stripStray = (text: string) => text.replace(STRAY_SCRIPTS, '');

function cleanAnswer(value: unknown): string {
  if (typeof value === 'string') return stripStray(value).trim();
  if (value && typeof value === 'object') {
    const record = value as Row;
    if (Array.isArray(record.choices) && typeof record.choices[0]?.message?.content === 'string') return stripStray(record.choices[0].message.content).trim();
    for (const key of ['response', 'answer', 'text', 'result']) {
      if (typeof record[key] === 'string') return stripStray(record[key]).trim();
    }
  }
  return '';
}

const STOP_WORDS = new Set(['the', 'and', 'for', 'what', 'how', 'can', 'does', 'are', 'is', 'کیا', 'ہے', 'ہیں', 'کے', 'کی', 'کا', 'میں', 'سے', 'اور', 'کو', 'پر', 'تو', 'اگر', 'ہو', 'جائے', 'کرنا', 'چاہیے']);
async function verifiedFatwas(env: Env, message: string): Promise<string> {
  const words = [...new Set(message.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3 && !STOP_WORDS.has(w)))].slice(0, 6);
  if (!words.length) return '';
  const where = words.map(() => '(question LIKE ? OR answer LIKE ?)').join(' OR ');
  const binds = words.flatMap((w) => [`%${w}%`, `%${w}%`]);
  const rows = await env.DB.prepare(`SELECT question,answer,scholar,institution FROM fatwas WHERE status='published' AND (${where}) ORDER BY created_at DESC LIMIT 12`).bind(...binds).all<Row>();
  const scored = rows.results.map((r) => ({ r, score: words.filter((w) => `${r.question} ${r.answer}`.toLowerCase().includes(w)).length })).filter((x) => x.score >= 2).sort((a, b) => b.score - a.score).slice(0, 2);
  if (!scored.length) return '';
  return 'Verified fatwas from the app:\n' + scored.map(({ r }) => `- Q: ${snippet(String(r.question), 300)}\n  A: ${snippet(String(r.answer), 900)} (${r.scholar}${r.institution ? ', ' + r.institution : ''})`).join('\n');
}

async function chatMessages(env: Env, turns: ChatTurn[], message: string) {
  const [fatwas, hits] = await Promise.all([verifiedFatwas(env, message).catch(() => ''), searchKb(env, message).catch(() => [] as KbHit[])]);
  const arabicScript = (message.match(/[\u0600-\u06FF]/g) || []).length > message.replace(/\s/g, '').length * 0.3;
  const language = arabicScript ? 'The latest user message is in Arabic script: answer in the same language (Urdu if the question is Urdu, Arabic if Arabic).' : 'The latest user message is written in Latin script: answer in that same language (English for English; Roman Urdu only if the user wrote Roman Urdu). Do NOT answer in Urdu script.';
  const greeting = turns.length <= 1 ? 'This is the first message of the chat: begin with "السلام علیکم".' : 'This chat is already in progress: do NOT greet or repeat salam; answer directly.';
  const system = [CHAT_SYSTEM_PROMPT, '', language, greeting, '', REFERENCE_NOTES, fatwas, '', kbContext(hits)].filter(Boolean).join('\n');
  return { hits, body: { messages: [{ role: 'system', content: system }, ...turns], max_tokens: 1200, temperature: 0.15, top_p: 0.8 } };
}

async function chatReply(env: Env, turns: ChatTurn[], message: string) {
  if (!env.AI) throw new Error('ai_unavailable');
  const { hits, body } = await chatMessages(env, turns, message);
  const answer = cleanAnswer(await env.AI.run(CHAT_MODEL, body));
  if (!answer) throw new Error('empty_answer');
  return { answer, sources: hits.map(publicHit) };
}

// Turns Workers AI server-sent events into a minimal `data: {"t":"text"}` stream.
function sseTransform(sources: unknown[] = []): TransformStream<Uint8Array, Uint8Array> {
  const decoder = new TextDecoder(); const encoder = new TextEncoder(); let buffer = '';
  const emit = (line: string, controller: TransformStreamDefaultController<Uint8Array>) => {
    if (!line.startsWith('data:')) return;
    const data = line.slice(5).trim();
    if (data === '[DONE]') { if (sources.length) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ sources })}\n\n`)); controller.enqueue(encoder.encode('data: [DONE]\n\n')); return; }
    try { const parsed = JSON.parse(data); const t = parsed.response ?? parsed.choices?.[0]?.delta?.content; const clean = typeof t === 'string' ? stripStray(t) : ''; if (clean) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ t: clean })}\n\n`)); } catch { /* ignore partial frames */ }
  };
  return new TransformStream({
    transform(chunk, controller) { buffer += decoder.decode(chunk, { stream: true }); const parts = buffer.split('\n'); buffer = parts.pop() || ''; for (const part of parts) emit(part, controller); },
    flush(controller) { if (buffer) emit(buffer, controller); },
  });
}

async function handle(request: Request, env: Env) {
  const origin = corsOrigin(request, env);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'access-control-allow-origin': origin, 'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS', 'access-control-allow-headers': 'Content-Type, Authorization, X-Admin-Token', 'access-control-max-age': '86400' } });
  const url = new URL(request.url); const path = url.pathname.replace(/^\/api/, '') || '/';
  if (path === '/' || path === '/health' || path === '/healthz') return json({ ok: true, service: 'fatwa-api', backend: env.TURSO_DB_URL ? 'turso' : 'cloudflare-d1', timestamp: now() }, 200, origin);
  try {
    await ensureSchema(env);
    if (path === '/fatwas' && request.method === 'GET') { const search = (url.searchParams.get('search') || '').trim(); const like = `%${search}%`; const q = search ? await env.DB.prepare("SELECT * FROM fatwas WHERE status='published' AND (question LIKE ? OR answer LIKE ? OR category LIKE ? OR institution LIKE ?) ORDER BY created_at DESC").bind(like, like, like, like).all<Row>() : await env.DB.prepare("SELECT * FROM fatwas WHERE status='published' ORDER BY created_at DESC").all<Row>(); return json({ fatwas: q.results.map(publicFatwa) }, 200, origin); }
    if (path.startsWith('/library/') && request.method === 'GET') {
      if (path === '/library/search' && !await rateLimit(env, request, 'lib-search', 40)) return json({ error: 'Too many requests.' }, 429, origin);
      const result = await libraryRoute(env, path, url.searchParams);
      if (result) return json(result.body, result.status, origin);
    }
    if (path === '/posts' && request.method === 'GET') {
      const search = (url.searchParams.get('search') || '').trim();
      const deviceId = (url.searchParams.get('deviceId') || '').trim();
      const city = (url.searchParams.get('city') || '').trim().toLowerCase();
      const country = (url.searchParams.get('country') || '').trim().toLowerCase();
      const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 100, 1), 200);
      // Same city first, then same country, then everyone else; newest first inside each group.
      const rank = "CASE WHEN ?<>'' AND LOWER(TRIM(city))=? THEN 0 WHEN ?<>'' AND LOWER(TRIM(country))=? THEN 1 ELSE 2 END";
      const selection = 'SELECT posts.*,(SELECT COUNT(*) FROM post_likes WHERE post_id=posts.id) AS likes,EXISTS(SELECT 1 FROM post_likes WHERE post_id=posts.id AND device_id=?) AS likedByDevice FROM posts';
      const rankBinds = [city, city, country, country];
      const q = search
        ? await env.DB.prepare(`${selection} WHERE status='published' AND created_at>=? AND (title LIKE ? OR body LIKE ? OR category LIKE ? OR author LIKE ?) ORDER BY ${rank}, created_at DESC LIMIT ?`).bind(deviceId, postCutoff(), `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, ...rankBinds, limit).all<Row>()
        : await env.DB.prepare(`${selection} WHERE status='published' AND created_at>=? ORDER BY ${rank}, created_at DESC LIMIT ?`).bind(deviceId, postCutoff(), ...rankBinds, limit).all<Row>();
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
    if (path === '/profile' && request.method === 'POST') {
      if (!await rateLimit(env, request, 'profile', 30)) return json({ error: 'Too many requests.' }, 429, origin);
      const body = await readJson(request);
      const result = await saveProfile(env, await userFor(env, request), request, body);
      return json({ ok: true, sessionToken: result.sessionToken, user: publicUser(result.user) }, 200, origin);
    }
    const xc: Ctx = { env, request, url, path, origin, json, id, now, hash, readJson, userFor, rateLimit, storeImage, publicUser, audit, notify, chat: (message) => chatReply(env, [{ role: 'user', content: message }], message) };
    if (!path.startsWith('/admin')) { const r = await publicExtras(xc); if (r) return r; }
    if (path === '/push-token' && request.method === 'POST') {
      const user = await userFor(env, request); if (!user) return json({ error: 'Sign in required.' }, 401, origin);
      const body = await readJson(request); const token = String(body.token || '').trim();
      if (token.length < 20 || token.length > 4096) return json({ error: 'Invalid token.' }, 400, origin);
      await registerPushToken(env, user.id, token, String(body.platform || 'android').slice(0, 20));
      return json({ ok: true }, 200, origin);
    }
    if (path === '/me' && request.method === 'GET') { const user = await userFor(env, request); if (!user) return json({ error: 'Not signed in.' }, 401, origin); return json({ user: publicUser(user) }, 200, origin); }
    if (path === '/profile/avatar' && request.method === 'POST') {
      if (!await rateLimit(env, request, 'avatar', 10)) return json({ error: 'Too many requests.' }, 429, origin);
      const user = await userFor(env, request); if (!user) return json({ error: 'Create your profile first.' }, 401, origin);
      const form = await request.formData(); const file = form.get('avatar');
      if (!(file instanceof File)) return json({ error: 'Choose a picture.' }, 400, origin);
      const stored = await storeImage(env, url.origin, 'avatars', file, 5 * 1024 * 1024);
      if ('error' in stored) return json({ error: stored.error }, stored.status, origin);
      await env.DB.prepare('UPDATE users SET avatar_url=?,updated_at=? WHERE id=?').bind(stored.url, now(), user.id).run();
      await env.DB.prepare('UPDATE posts SET author_image_url=? WHERE user_id=?').bind(stored.url, user.id).run();
      return json({ ok: true, user: publicUser({ ...user, avatar_url: stored.url }) }, 200, origin);
    }
    if (path === '/my/posts' && request.method === 'GET') { const user = await userFor(env, request); const q = user ? await env.DB.prepare('SELECT id,title,body,category,status,rejection_reason AS rejectionReason,image_url AS imageUrl,created_at AS createdAt FROM post_submissions WHERE user_id=? OR submitter_device_id=? ORDER BY created_at DESC LIMIT 50').bind(user.id, user.device_id).all<Row>() : { results: [] }; return json({ posts: q.results }, 200, origin); }
    if (path === '/questions' && request.method === 'POST') { if (!await rateLimit(env, request, 'question', 10)) return json({ error: 'Too many requests.' }, 429, origin); const body = await readJson(request); const user = await userFor(env, request); if (!user) return json({ error: 'Complete your profile before submitting.' }, 401, origin); const question = String(body.question || '').trim(); const category = String(body.category || ''); if (question.length < 20 || !CATEGORIES.has(category)) return json({ error: 'Question and a valid category are required.' }, 400, origin); const timestamp = now(); const questionId = id('question'); await env.DB.prepare('INSERT INTO questions(id,user_id,name,gender,country,city,question,category,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(questionId, user.id, user.name, ['male','female'].includes(body.gender) ? body.gender : 'unspecified', user.country || body.country || '', user.city || body.city || '', question, category, 'submitted', timestamp, timestamp).run(); return json({ id: questionId, userId: user.id, status: 'submitted', createdAt: timestamp }, 201, origin); }
    if (path === '/questions' && request.method === 'GET') { const user = await userFor(env, request); const q = user ? await env.DB.prepare('SELECT id,name,gender,country,city,question,category,status,answer,answered_by AS answeredBy,created_at AS createdAt,updated_at AS updatedAt FROM questions WHERE user_id=? ORDER BY created_at DESC').bind(user.id).all<Row>() : { results: [] }; return json({ questions: q.results }, 200, origin); }
    if (path === '/notifications' && request.method === 'GET') { const user = await userFor(env, request); const q = user ? await env.DB.prepare('SELECT id,title,body,kind,image_url AS imageUrl,question_id AS questionId,post_id AS postId,read_at AS readAt,created_at AS createdAt FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 100').bind(user.id).all<Row>() : { results: [] }; return json({ notifications: q.results }, 200, origin); }
    if (/^\/notifications\/[^/]+\/read$/.test(path) && request.method === 'POST') { const user = await userFor(env, request); if (!user) return json({ error: 'Sign in required.' }, 401, origin); const notificationId = path.split('/')[2]; await env.DB.prepare('UPDATE notifications SET read_at=? WHERE id=? AND user_id=?').bind(now(), notificationId, user.id).run(); return json({ ok: true }, 200, origin); }
    if (path === '/notifications/read-all' && request.method === 'POST') { const user = await userFor(env, request); if (!user) return json({ error: 'Sign in required.' }, 401, origin); const result = await env.DB.prepare('UPDATE notifications SET read_at=? WHERE user_id=? AND read_at IS NULL').bind(now(), user.id).run(); return json({ ok: true, updated: Number(result.meta?.changes ?? 0) }, 200, origin); }
    if (path === '/chat' && request.method === 'POST') {
      if (!await rateLimit(env, request, 'chat', 30)) return json({ error: 'Too many requests. Please wait a moment and try again.' }, 429, origin);
      const body = await readJson(request);
      const message = String(body.message || '').trim();
      if (!message) return json({ error: 'Please write your question.' }, 400, origin);
      if (message.length > 4000) return json({ error: 'Question is too long.' }, 413, origin);
      const turns: ChatTurn[] = [...chatHistory(body.history), { role: 'user', content: message }];
      if (!env.AI) return json({ error: 'The assistant is temporarily unavailable. Please try again later.' }, 503, origin);
      try {
        if (body.stream === true) {
          const { hits, body: chatBody } = await chatMessages(env, turns, message);
          const stream = await env.AI.run(CHAT_MODEL, { ...chatBody, stream: true }) as ReadableStream<Uint8Array>;
          return new Response(stream.pipeThrough(sseTransform(hits.map(publicHit))), { headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache, no-transform', 'access-control-allow-origin': origin, 'x-content-type-options': 'nosniff' } });
        }
        return json(await chatReply(env, turns, message), 200, origin);
      } catch (error) {
        console.error('chat error', String(error));
        return json({ error: 'The assistant could not answer right now. Please try again.' }, 502, origin);
      }
    }
    if (path === '/post-submissions' && request.method === 'POST') {
      if (!await rateLimit(env, request, 'post', 12)) return json({ error: 'Too many requests.' }, 429, origin);
      const user = await userFor(env, request); if (!user) return json({ error: 'Complete your profile before submitting.' }, 401, origin);
      const form = await request.formData();
      const body = String(form.get('body') || '').trim();
      const image = form.get('image');
      const hasImage = image instanceof File && image.size > 0;
      if (!body && !hasImage) return json({ error: 'Description or image is required.' }, 400, origin);
      if (body.length > 5000) return json({ error: 'Post is too long.' }, 413, origin);
      let imageUrl = '';
      if (hasImage) { const stored = await storeImage(env, url.origin, 'posts', image as File, IMAGE_MAX); if ('error' in stored) return json({ error: stored.error }, stored.status, origin); imageUrl = stored.url; }
      const timestamp = now(); const submissionId = id('submission');
      await env.DB.prepare('INSERT INTO post_submissions(id,name,country,city,title,body,category,language,status,rejection_reason,submitter_device_id,user_id,image_url,author_image_url,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(submissionId, user.name, user.country || '', user.city || '', body.slice(0, 80) || 'Community image', body, String(form.get('category') || ''), ['ur', 'ar'].includes(String(form.get('language'))) ? String(form.get('language')) : 'en', 'pending', null, user.device_id, user.id, imageUrl || null, user.avatar_url || null, timestamp, timestamp).run();
      await notify(env, user.id, { title: 'Post received', body: 'Thank you. Your post is being reviewed and you will be notified when it is live.', kind: 'post_pending', imageUrl });
      return json({ id: submissionId, status: 'pending', createdAt: timestamp, imageUrl }, 201, origin);
    }
    if (path.startsWith('/media/') && request.method === 'GET') { const key = decodeURIComponent(path.slice(7)); const object = await env.MEDIA.get(key); if (!object) return text('Not found', 404, origin); const headers = new Headers({ 'cache-control': 'public, max-age=31536000, immutable', 'access-control-allow-origin': origin, 'x-content-type-options': 'nosniff' }); if (object.httpMetadata?.contentType) headers.set('content-type', object.httpMetadata.contentType); return new Response(object.body, { headers }); }
    if (path.startsWith('/admin')) {
      if (!await adminOk(env, request)) return json({ error: 'Admin authentication required.' }, 401, origin);

      { const r = await adminExtras(xc); if (r) return r; }
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
      if (path === '/admin/kb/ingest' && request.method === 'POST') { try { return json(await kbIngest(env, await readJson(request)), 200, origin); } catch (e) { return json({ error: String(e) }, 400, origin); } }
      if (path === '/admin/kb/reseq' && request.method === 'POST') { try { return json(await kbReseq(env, await readJson(request)), 200, origin); } catch (e) { return json({ error: String(e) }, 400, origin); } }
      if (path === '/admin/kb/scholars' && request.method === 'POST') { const b = await readJson(request); return json(await importScholars(env, Array.isArray(b.scholars) ? b.scholars : []), 200, origin); }
      if (path === '/admin/kb/search' && request.method === 'GET') { const q = url.searchParams.get('q') || ''; return json({ direct: kbTokens(q, 12), expanded: await expandQuery(env, q), hits: await searchKb(env, q, 8) }, 200, origin); }
      if (path === '/admin/kb/stats' && request.method === 'GET') return json(await kbStats(env), 200, origin);
      if (path === '/admin/purge-expired' && request.method === 'POST') return json(await purgeExpired(env), 200, origin);
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
          await notify(env, question.user_id, { title: 'Your question was answered', body: answer.slice(0, 160), kind: 'question_answered', questionId });
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
        let broadcast: Row | null = null;
        if (submissionMatch[2] === 'approve') { const newPost = await approveSubmission(env, submission); if (newPost && body.notify) broadcast = await broadcastPost(env, newPost, String(body.notify)); }
        else await rejectSubmission(env, submission, String(body.reason || 'Not approved'));
        await audit(env, submissionMatch[2], 'post_submission', submission.id, { reason: body.reason || null, notify: body.notify || null });
        return json({ ok: true, status: submissionMatch[2] === 'approve' ? 'approved' : 'rejected', broadcast }, 200, origin);
      }
      if (submissionMatch && request.method === 'PATCH') {
        const submission = await env.DB.prepare('SELECT * FROM post_submissions WHERE id=?').bind(submissionMatch[1]).first<Row>();
        if (!submission) return json({ error: 'Submission not found.' }, 404, origin);
        const body = await readJson(request);
        const action = body.action === 'approve' ? 'approve' : body.action === 'reject' ? 'reject' : '';
        if (!action) return json({ error: 'A valid action is required.' }, 400, origin);
        let broadcast: Row | null = null;
        if (action === 'approve') { const newPost = await approveSubmission(env, submission); if (newPost && body.notify) broadcast = await broadcastPost(env, newPost, String(body.notify)); }
        else await rejectSubmission(env, submission, String(body.reason || 'Not approved'));
        await audit(env, action, 'post_submission', submission.id, { reason: body.reason || null, notify: body.notify || null });
        return json({ ok: true, status: action === 'approve' ? 'approved' : 'rejected', broadcast }, 200, origin);
      }
      const postNotifyMatch = path.match(/^\/admin\/posts\/([^/]+)\/notify$/);
      if (postNotifyMatch && request.method === 'POST') { const body = await readJson(request).catch(() => ({} as Row)); const result = await broadcastPost(env, postNotifyMatch[1], String(body.scope || 'all'), body.force === true); await audit(env, 'notify', 'post', postNotifyMatch[1], { scope: body.scope || 'all' }); return json(result, 200, origin); }
      if (path === '/admin/push/stats' && request.method === 'GET') { const q = async (sql: string) => (await env.DB.prepare(sql).first<Row>())?.c ?? 0; return json({ devices: await q('SELECT COUNT(*) c FROM push_tokens'), pending: await q("SELECT COUNT(*) c FROM push_queue WHERE status='pending'"), sent: await q("SELECT COUNT(*) c FROM push_queue WHERE status='sent'"), failed: await q("SELECT COUNT(*) c FROM push_queue WHERE status='failed'"), fcmConfigured: Boolean(env.FCM_SERVICE_ACCOUNT) }, 200, origin); }
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

// Deletes everything older than the post lifetime: posts, their likes, uploaded images and stale notifications.
async function purgeExpired(env: Env) {
  const cutoff = postCutoff();
  const mediaKey = (url: unknown) => { const m = String(url || '').match(/\/api\/media\/(.+)$/); return m ? decodeURIComponent(m[1]) : null; };
  const posts = await env.DB.prepare('SELECT id,image_url FROM posts WHERE created_at<?').bind(cutoff).all<Row>();
  const subs = await env.DB.prepare("SELECT id,image_url FROM post_submissions WHERE created_at<? AND image_url IS NOT NULL").bind(cutoff).all<Row>();
  const keys = new Set<string>();
  for (const row of [...posts.results, ...subs.results]) { const key = mediaKey(row.image_url); if (key && key.startsWith('posts/')) keys.add(key); }
  if (keys.size) await env.MEDIA.delete([...keys]);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM post_likes WHERE post_id IN (SELECT id FROM posts WHERE created_at<?)').bind(cutoff),
    env.DB.prepare('DELETE FROM posts WHERE created_at<?').bind(cutoff),
    env.DB.prepare("DELETE FROM post_submissions WHERE created_at<?").bind(cutoff),
    env.DB.prepare('DELETE FROM notifications WHERE created_at<?').bind(cutoff),
    env.DB.prepare('DELETE FROM rate_limits WHERE window_started_at<?').bind(Date.now() - 3600_000),
  ]);
  return { posts: posts.results.length, submissions: subs.results.length, images: keys.size };
}

export default {
  fetch(request: Request, rawEnv: Env) { return handle(request, withTurso(rawEnv)); },
  async scheduled(event: { cron?: string }, rawEnv: Env, ctx: { waitUntil: (p: Promise<unknown>) => void }) {
    const env = withTurso(rawEnv);
    const job = event.cron === '* * * * *'
      ? ensureSchema(env).then(() => processPushQueue(env, 45)).then((r) => { if (r.sent || r.failed) console.log('push', JSON.stringify(r)); })
      : ensureSchema(env).then(() => purgeExpired(env)).then((r) => console.log('purge', JSON.stringify(r)));
    ctx.waitUntil(job);
  },
};
