import { queueBroadcast } from './push';
import { mailEnabled, otpMail, sendMail, welcomeMail } from './mail';
// Reports, public profiles, account control, dashboard stats and Google / email-OTP sign-in.
type Row = Record<string, any>;
export interface Ctx {
  env: any; request: Request; url: URL; path: string; origin: string;
  json: (body: unknown, status?: number, origin?: string) => Response;
  id: (prefix: string) => string; now: () => string;
  hash: (v: string) => Promise<string>; readJson: (r: Request) => Promise<Row>;
  userFor: (env: any, r: Request) => Promise<Row | null>;
  rateLimit: (env: any, r: Request, bucket: string, limit: number) => Promise<boolean>;
  storeImage: (env: any, origin: string, folder: string, file: File, max: number) => Promise<{ url: string } | { error: string; status: number }>;
  publicUser: (u: Row) => Row; audit: (env: any, a: string, t: string, i: string | null, m?: Row) => Promise<void>;
  notify: (env: any, uid: string, n: any) => Promise<void>;
  chat?: (message: string) => Promise<unknown>;
}

export const extraSchema = (db: any) => [
  db.prepare("CREATE TABLE IF NOT EXISTS reports (id TEXT PRIMARY KEY,user_id TEXT,name TEXT,message TEXT NOT NULL,page TEXT,app_version TEXT,platform TEXT,screenshots TEXT NOT NULL DEFAULT '[]',status TEXT NOT NULL DEFAULT 'new',admin_note TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)"),
  db.prepare('CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, created_at)'),
  db.prepare('CREATE TABLE IF NOT EXISTS visits (id TEXT PRIMARY KEY,device_id TEXT NOT NULL,user_id TEXT,country TEXT,country_code TEXT,city TEXT,platform TEXT,app_version TEXT,created_at TEXT NOT NULL)'),
  db.prepare('CREATE INDEX IF NOT EXISTS idx_visits_created ON visits(created_at)'),
  db.prepare('CREATE INDEX IF NOT EXISTS idx_visits_device ON visits(device_id, created_at)'),
  db.prepare('CREATE TABLE IF NOT EXISTS auth_otps (email TEXT PRIMARY KEY,code_hash TEXT NOT NULL,expires_at INTEGER NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL)'),
];
export const extraColumns: Record<string, Array<[string, string]>> = {
  users: [['email', 'TEXT'], ['google_sub', 'TEXT'], ['banned_at', 'TEXT'], ['ban_reason', 'TEXT'], ['bio', 'TEXT'], ['auth_provider', 'TEXT'], ['welcomed_at', 'TEXT'], ['cover_url', 'TEXT']],
};

const count = async (env: any, sql: string, ...b: unknown[]) => Number((await env.DB.prepare(sql).bind(...b).first())?.c ?? 0);
const isEmail = (v: string) => /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/.test(v) && v.length <= 160;
const publicPostRow = (r: Row) => ({ id: r.id, title: r.title, body: r.body, category: r.category, imageUrl: r.image_url || '', createdAt: r.created_at, featured: Boolean(r.featured), likes: Number(r.likes || 0), views: Number(r.views || 0) });

async function newSession(c: Ctx, userId: string) {
  const raw = `${crypto.randomUUID()}-${crypto.randomUUID()}`; const t = c.now();
  await c.env.DB.prepare('INSERT INTO sessions(id,user_id,token_hash,expires_at,created_at,last_seen_at) VALUES(?,?,?,?,?,?)').bind(c.id('session'), userId, await c.hash(raw), new Date(Date.now() + 180 * 86400000).toISOString(), t, t).run();
  return raw;
}
let regionNames: any = null;
export function geoOf(request: Request): { country: string; code: string; city: string } {
  const cf: Row = (request as any).cf || {}; const code = String(cf.country || '').toUpperCase();
  let country = '';
  if (/^[A-Z]{2}$/.test(code) && code !== 'XX' && code !== 'T1') { try { regionNames ||= new (Intl as any).DisplayNames(['en'], { type: 'region' }); country = regionNames.of(code) || code; } catch { country = code; } }
  return { country, code, city: String(cf.city || '').slice(0, 80) };
}

async function signInOrCreate(c: Ctx, p: { email: string; name: string; sub?: string; provider: string; avatar?: string; deviceId?: string }) {
  const { env } = c;
  let u = (p.sub ? await env.DB.prepare('SELECT * FROM users WHERE google_sub=?').bind(p.sub).first() : null) || await env.DB.prepare('SELECT * FROM users WHERE lower(email)=?').bind(p.email.toLowerCase()).first();
  if (u?.banned_at) return c.json({ error: 'This account has been suspended.' }, 403, c.origin);
  const t = c.now(); let created = false;
  if (!u) {
    created = true;
    const geo = geoOf(c.request); const uid = c.id('user'); const device = `${(p.deviceId || p.provider).slice(0, 40)}-${crypto.randomUUID().slice(0, 8)}`;
    await env.DB.prepare('INSERT INTO users(id,device_id,name,country,city,avatar_url,email,google_sub,auth_provider,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(uid, device, p.name.slice(0, 60) || p.email.split('@')[0], geo.country, geo.city, p.avatar || null, p.email.toLowerCase(), p.sub || null, p.provider, t, t).run();
    u = await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(uid).first();
  } else {
    if (p.sub && !u.google_sub) await env.DB.prepare('UPDATE users SET google_sub=?,updated_at=? WHERE id=?').bind(p.sub, t, u.id).run();
    if (!u.country && !u.city) { const geo = geoOf(c.request); if (geo.country) await env.DB.prepare('UPDATE users SET country=?,city=?,updated_at=? WHERE id=?').bind(geo.country, geo.city, t, u.id).run(); }
    u = await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(u.id).first();
  }
  // Welcome mail goes out once per account, on the first sign-in (Google or email code).
  if (p.email && !u!.welcomed_at) {
    await env.DB.prepare('UPDATE users SET welcomed_at=? WHERE id=?').bind(t, u!.id).run();
    const w = welcomeMail(u!.name, p.provider); await sendMail(env, p.email, w.subject, w.text, w.html).catch((e) => console.error('welcome_mail', String(e)));
  }
  const sessionToken = await newSession(c, u!.id);
  return c.json({ ok: true, sessionToken, user: { ...c.publicUser(u!), email: u!.email || p.email, bio: u!.bio || '' }, needsProfile: false }, 200, c.origin);
}

export async function publicExtras(c: Ctx): Promise<Response | null> {
  const { env, request, path, origin, json } = c; const m = request.method;
  if (path === '/reports' && m === 'POST') {
    if (!await c.rateLimit(env, request, 'report', 6)) return json({ error: 'Too many reports. Try again later.' }, 429, origin);
    const form = await request.formData(); const message = String(form.get('message') || '').trim();
    if (message.length < 5) return json({ error: 'Please describe the problem.' }, 400, origin);
    if (message.length > 3000) return json({ error: 'Message is too long.' }, 413, origin);
    const files = [...form.getAll('screenshots'), ...form.getAll('screenshot')].filter((f): f is File => f instanceof File && f.size > 0).slice(0, 3);
    const urls: string[] = [];
    for (const f of files) { const s = await c.storeImage(env, c.url.origin, 'reports', f, 6 * 1024 * 1024); if ('error' in s) return json({ error: s.error }, s.status, origin); urls.push(s.url); }
    const user = await c.userFor(env, request); const t = c.now(); const rid = c.id('report');
    await env.DB.prepare('INSERT INTO reports(id,user_id,name,message,page,app_version,platform,screenshots,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(rid, user?.id || null, user?.name || String(form.get('name') || '').slice(0, 60) || 'Guest', message, String(form.get('page') || '').slice(0, 60), String(form.get('appVersion') || '').slice(0, 20), String(form.get('platform') || '').slice(0, 20), JSON.stringify(urls), 'new', t, t).run();
    return json({ ok: true, id: rid }, 201, origin);
  }
  if (path === '/ping' && m === 'POST') {
    if (!await c.rateLimit(env, request, 'ping', 40)) return json({ ok: true }, 200, origin);
    const b = await c.readJson(request); const device = String(b.deviceId || '').trim().slice(0, 80);
    if (device.length < 8) return json({ ok: true }, 200, origin);
    const user = await c.userFor(env, request); const geo = geoOf(request); const t = c.now();
    const recent = await env.DB.prepare('SELECT 1 AS x FROM visits WHERE device_id=? AND created_at>?').bind(device, new Date(Date.now() - 30 * 60000).toISOString()).first();
    if (!recent) await env.DB.prepare('INSERT INTO visits(id,device_id,user_id,country,country_code,city,platform,app_version,created_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(c.id('visit'), device, user?.id || null, geo.country, geo.code, geo.city, String(b.platform || '').slice(0, 20), String(b.appVersion || '').slice(0, 20), t).run();
    if (user && !user.country && !user.city && geo.country) await env.DB.prepare('UPDATE users SET country=?,city=? WHERE id=?').bind(geo.country, geo.city, user.id).run();
    return json({ ok: true }, 200, origin);
  }
  const prof = path.match(/^\/users\/([^/]+)\/profile$/);
  if (prof && m === 'GET') {
    const u = await env.DB.prepare('SELECT id,name,country,city,avatar_url,cover_url,bio,created_at,banned_at FROM users WHERE id=?').bind(prof[1]).first();
    if (!u || u.banned_at) return json({ error: 'User not found.' }, 404, origin);
    const posts = await env.DB.prepare("SELECT p.*,(SELECT COUNT(*) FROM post_likes l WHERE l.post_id=p.id) AS likes,(SELECT COUNT(*) FROM post_views v WHERE v.post_id=p.id) AS views FROM posts p WHERE p.user_id=? AND p.status='published' ORDER BY p.created_at DESC LIMIT 100").bind(u.id).all();
    return json({ user: { id: u.id, name: u.name, country: u.country || '', city: u.city || '', avatarUrl: u.avatar_url || '', coverUrl: u.cover_url || '', bio: u.bio || '', joinedAt: u.created_at }, posts: posts.results.map(publicPostRow), likesReceived: posts.results.reduce((a: number, r: Row) => a + Number(r.likes || 0), 0) }, 200, origin);
  }
  if (path === '/profile/bio' && m === 'POST') {
    const user = await c.userFor(env, request); if (!user) return json({ error: 'Sign in required.' }, 401, origin);
    const b = await c.readJson(request); await env.DB.prepare('UPDATE users SET bio=?,updated_at=? WHERE id=?').bind(String(b.bio || '').trim().slice(0, 200), c.now(), user.id).run();
    return json({ ok: true }, 200, origin);
  }
  const mine = path.match(/^\/my\/posts\/([^/]+)$/);
  if (mine && m === 'DELETE') {
    const user = await c.userFor(env, request); if (!user) return json({ error: 'Sign in required.' }, 401, origin);
    const a = await env.DB.prepare('DELETE FROM posts WHERE id=? AND user_id=?').bind(mine[1], user.id).run();
    const b = await env.DB.prepare('DELETE FROM post_submissions WHERE id=? AND (user_id=? OR submitter_device_id=?)').bind(mine[1], user.id, user.device_id).run();
    return json({ ok: true, removed: Number(a.meta?.changes || 0) + Number(b.meta?.changes || 0) }, 200, origin);
  }
  if (path === '/auth/config' && m === 'GET') return json({ google: Boolean(env.GOOGLE_CLIENT_IDS), email: mailEnabled(env) }, 200, origin);
  if (path === '/auth/google' && m === 'POST') {
    if (!env.GOOGLE_CLIENT_IDS) return json({ error: 'Google sign-in is not enabled yet.', code: 'not_configured' }, 503, origin);
    if (!await c.rateLimit(env, request, 'auth', 20)) return json({ error: 'Too many attempts.' }, 429, origin);
    const b = await c.readJson(request); const tok = String(b.idToken || '');
    if (tok.length < 50) return json({ error: 'Invalid token.' }, 400, origin);
    const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(tok)}`);
    if (!r.ok) return json({ error: 'Google rejected the sign-in.' }, 401, origin);
    const info: Row = await r.json(); const ids = String(env.GOOGLE_CLIENT_IDS).split(',').map((s: string) => s.trim());
    if (!ids.includes(info.aud) || !(info.email_verified === true || info.email_verified === 'true') || !info.email) return json({ error: 'Google account could not be verified.' }, 401, origin);
    return signInOrCreate(c, { email: String(info.email), name: String(info.name || ''), sub: String(info.sub), provider: 'google', avatar: info.picture, deviceId: b.deviceId });
  }
  if (path === '/auth/email/start' && m === 'POST') {
    if (!mailEnabled(env)) return json({ error: 'Email sign-in is not enabled yet.', code: 'not_configured' }, 503, origin);
    if (!await c.rateLimit(env, request, 'otp', 6)) return json({ error: 'Too many attempts. Try again later.' }, 429, origin);
    const email = String((await c.readJson(request)).email || '').trim().toLowerCase(); if (!isEmail(email)) return json({ error: 'Enter a valid email.' }, 400, origin);
    const code = String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000));
    await env.DB.prepare('INSERT OR REPLACE INTO auth_otps(email,code_hash,expires_at,attempts,created_at) VALUES(?,?,?,0,?)').bind(email, await c.hash(`${email}:${code}`), Date.now() + 10 * 60000, c.now()).run();
    try { const mail = otpMail(code); await sendMail(env, email, mail.subject, mail.text, mail.html); } catch (e) { console.error('otp_mail', String(e)); return json({ error: 'Could not send the email.' }, 502, origin); }
    return json({ ok: true }, 200, origin);
  }
  if (path === '/auth/email/verify' && m === 'POST') {
    if (!await c.rateLimit(env, request, 'otpv', 30)) return json({ error: 'Too many attempts.' }, 429, origin);
    const b = await c.readJson(request); const email = String(b.email || '').trim().toLowerCase(); const code = String(b.code || '').trim();
    const row = await env.DB.prepare('SELECT * FROM auth_otps WHERE email=?').bind(email).first();
    if (!row || row.expires_at < Date.now() || row.attempts >= 5) return json({ error: 'The code expired. Request a new one.' }, 400, origin);
    if (row.code_hash !== await c.hash(`${email}:${code}`)) { await env.DB.prepare('UPDATE auth_otps SET attempts=attempts+1 WHERE email=?').bind(email).run(); return json({ error: 'Wrong code.' }, 400, origin); }
    await env.DB.prepare('DELETE FROM auth_otps WHERE email=?').bind(email).run();
    return signInOrCreate(c, { email, name: String(b.name || ''), provider: 'email', deviceId: b.deviceId });
  }
  return null;
}

export async function adminExtras(c: Ctx): Promise<Response | null> {
  const { env, request, path, origin, json } = c; const m = request.method;
  if (path === '/admin/dashboard' && m === 'GET') {
    const since = new Date(Date.now() - 14 * 86400000).toISOString();
    const series = async (table: string, extra = '') => { const q = await env.DB.prepare(`SELECT substr(created_at,1,10) AS d, COUNT(*) AS c FROM ${table} WHERE created_at>=? ${extra} GROUP BY d`).bind(since).all(); const mp = new Map(q.results.map((r: Row) => [r.d, Number(r.c)])); return Array.from({ length: 14 }, (_, i) => { const d = new Date(Date.now() - (13 - i) * 86400000).toISOString().slice(0, 10); return { date: d, count: mp.get(d) || 0 }; }); };
    const [totalsRow, uS, pS, rS, cats, recent, ai] = await Promise.all([
      env.DB.prepare(`SELECT
        (SELECT COUNT(*) FROM users) AS users,(SELECT COUNT(*) FROM users WHERE banned_at IS NOT NULL) AS bannedUsers,
        (SELECT COUNT(*) FROM posts WHERE status='published') AS livePosts,(SELECT COUNT(*) FROM post_submissions WHERE status='pending') AS pendingPosts,
        (SELECT COUNT(*) FROM post_submissions WHERE status='rejected') AS rejectedPosts,(SELECT COUNT(*) FROM post_likes) AS likes,
        (SELECT COUNT(*) FROM reports WHERE status='new') AS newReports,(SELECT COUNT(*) FROM reports) AS reports,
        (SELECT COUNT(*) FROM questions WHERE status!='answered') AS openQuestions,(SELECT COUNT(*) FROM fatwas WHERE status='published') AS fatwas`).first(),
      series('users'), series('post_submissions'), series('reports'),
      env.DB.prepare("SELECT category, COUNT(*) AS c FROM posts WHERE status='published' GROUP BY category ORDER BY c DESC").all(),
      env.DB.prepare('SELECT action,entity_type AS entityType,entity_id AS entityId,created_at AS createdAt FROM admin_audit_logs ORDER BY created_at DESC LIMIT 8').all(),
      count(env, 'SELECT COUNT(*) AS c FROM agent_runs').catch(() => 0),
    ]);
    return json({
      totals: { ...totalsRow, aiChats: ai }, series: { users: uS, posts: pS, reports: rS }, categories: cats.results, recent: recent.results,
    }, 200, origin);
  }
  if (path === '/admin/traffic' && m === 'GET') {
    const day = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
    const all = async (sql: string, ...b: unknown[]) => (await env.DB.prepare(sql).bind(...b).all()).results;
    const win = async (n: number) => (await env.DB.prepare('SELECT COUNT(*) AS visits, COUNT(DISTINCT device_id) AS devices FROM visits WHERE created_at>=?').bind(day(n)).first()) as Row;
    const since30 = day(30); const since14 = day(14);
    const [d1, d7, d30, byCountry, byCity, usersCountry, usersCity, platforms, ser, recent, newUsers] = await Promise.all([
      win(1), win(7), win(30),
      all("SELECT COALESCE(NULLIF(country,''),'Unknown') AS country, MAX(country_code) AS code, COUNT(*) AS visits, COUNT(DISTINCT device_id) AS devices FROM visits WHERE created_at>=? GROUP BY 1 ORDER BY devices DESC, visits DESC LIMIT 50", since30),
      all("SELECT COALESCE(NULLIF(city,''),'Unknown') AS city, COALESCE(NULLIF(country,''),'Unknown') AS country, COUNT(*) AS visits, COUNT(DISTINCT device_id) AS devices FROM visits WHERE created_at>=? GROUP BY 1,2 ORDER BY devices DESC, visits DESC LIMIT 100", since30),
      all("SELECT COALESCE(NULLIF(country,''),'Unknown') AS country, COUNT(*) AS users FROM users GROUP BY 1 ORDER BY users DESC LIMIT 50"),
      all("SELECT COALESCE(NULLIF(city,''),'Unknown') AS city, COALESCE(NULLIF(country,''),'Unknown') AS country, COUNT(*) AS users FROM users GROUP BY 1,2 ORDER BY users DESC LIMIT 100"),
      all("SELECT COALESCE(NULLIF(platform,''),'unknown') AS platform, COUNT(DISTINCT device_id) AS devices FROM visits WHERE created_at>=? GROUP BY 1 ORDER BY devices DESC", since30),
      all('SELECT substr(created_at,1,10) AS d, COUNT(*) AS visits, COUNT(DISTINCT device_id) AS devices FROM visits WHERE created_at>=? GROUP BY d', since14),
      all("SELECT v.created_at AS at, v.country, v.city, v.platform, u.name AS user FROM visits v LEFT JOIN users u ON u.id=v.user_id ORDER BY v.created_at DESC LIMIT 12"),
      count(env, 'SELECT COUNT(*) AS c FROM users WHERE created_at>=?', day(7)),
    ]);
    const mp = new Map(ser.map((r: Row) => [r.d, r]));
    const series = Array.from({ length: 14 }, (_, i) => { const d = new Date(Date.now() - (13 - i) * 86400000).toISOString().slice(0, 10); const r = mp.get(d) as Row | undefined; return { date: d, visits: Number(r?.visits || 0), devices: Number(r?.devices || 0) }; });
    return json({ windows: { day: d1, week: d7, month: d30 }, newUsersWeek: newUsers, byCountry, byCity, usersCountry, usersCity, platforms, series, recent }, 200, origin);
  }
  if (path === '/admin/reports' && m === 'GET') {
    const st = c.url.searchParams.get('status'); const q = st ? await env.DB.prepare('SELECT * FROM reports WHERE status=? ORDER BY created_at DESC LIMIT 300').bind(st).all() : await env.DB.prepare('SELECT * FROM reports ORDER BY created_at DESC LIMIT 300').all();
    return json({ reports: q.results.map((r: Row) => ({ id: r.id, userId: r.user_id, name: r.name, message: r.message, page: r.page, appVersion: r.app_version, platform: r.platform, screenshots: JSON.parse(r.screenshots || '[]'), status: r.status, adminNote: r.admin_note || '', createdAt: r.created_at })) }, 200, origin);
  }
  const rep = path.match(/^\/admin\/reports\/([^/]+)$/);
  if (rep && m === 'PATCH') { const b = await c.readJson(request); const st = ['new', 'read', 'resolved'].includes(b.status) ? b.status : 'read'; await env.DB.prepare('UPDATE reports SET status=?,admin_note=COALESCE(?,admin_note),updated_at=? WHERE id=?').bind(st, b.adminNote ?? null, c.now(), rep[1]).run(); await c.audit(env, 'report_' + st, 'report', rep[1]); return json({ ok: true }, 200, origin); }
  if (rep && m === 'DELETE') { await env.DB.prepare('DELETE FROM reports WHERE id=?').bind(rep[1]).run(); await c.audit(env, 'delete', 'report', rep[1]); return json({ ok: true }, 200, origin); }
  if (path === '/admin/users' && m === 'GET') {
    const q = await env.DB.prepare("SELECT u.id,u.name,u.email,u.country,u.city,u.avatar_url AS avatarUrl,u.auth_provider AS provider,u.banned_at AS bannedAt,u.ban_reason AS banReason,u.created_at AS createdAt,u.updated_at AS updatedAt,(SELECT COUNT(*) FROM posts p WHERE p.user_id=u.id) AS livePosts,(SELECT COUNT(*) FROM post_submissions s WHERE s.user_id=u.id AND s.status='pending') AS pendingPosts,(SELECT COUNT(*) FROM reports r WHERE r.user_id=u.id) AS reports FROM users u ORDER BY u.updated_at DESC").all();
    return json({ users: q.results }, 200, origin);
  }
  const usr = path.match(/^\/admin\/users\/([^/]+)(?:\/(ban|unban))?$/);
  if (usr && m === 'POST' && usr[2]) {
    const b = await c.readJson(request).catch(() => ({} as Row));
    if (usr[2] === 'ban') { await env.DB.prepare('UPDATE users SET banned_at=?,ban_reason=? WHERE id=?').bind(c.now(), String(b.reason || '').slice(0, 200), usr[1]).run(); await env.DB.prepare('UPDATE sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL').bind(c.now(), usr[1]).run(); }
    else await env.DB.prepare('UPDATE users SET banned_at=NULL,ban_reason=NULL WHERE id=?').bind(usr[1]).run();
    await c.audit(env, usr[2], 'user', usr[1], { reason: b.reason || null }); return json({ ok: true }, 200, origin);
  }
  if (usr && m === 'DELETE' && !usr[2]) {
    const uid = usr[1];
    await env.DB.batch([
      env.DB.prepare('DELETE FROM post_likes WHERE post_id IN (SELECT id FROM posts WHERE user_id=?)').bind(uid), env.DB.prepare('DELETE FROM posts WHERE user_id=?').bind(uid),
      env.DB.prepare('DELETE FROM post_submissions WHERE user_id=?').bind(uid), env.DB.prepare('DELETE FROM notifications WHERE user_id=?').bind(uid),
      env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(uid), env.DB.prepare('UPDATE reports SET user_id=NULL WHERE user_id=?').bind(uid), env.DB.prepare('DELETE FROM users WHERE id=?').bind(uid),
    ]);
    await c.audit(env, 'delete', 'user', uid); return json({ ok: true }, 200, origin);
  }
  if (path === '/admin/posts' && m === 'POST') {
    const form = await request.formData(); const body = String(form.get('body') || '').trim(); const title = String(form.get('title') || '').trim();
    if (!body && !title) return json({ error: 'Write something first.' }, 400, origin);
    let image = ''; const f = form.get('image');
    if (f instanceof File && f.size > 0) { const s = await c.storeImage(env, c.url.origin, 'posts', f, 8 * 1024 * 1024); if ('error' in s) return json({ error: s.error }, s.status, origin); image = s.url; }
    const pid = c.id('post'); const t = c.now();
    await env.DB.prepare("INSERT INTO posts(id,title,body,category,featured,status,city,author,image_url,created_at,updated_at) VALUES(?,?,?,?,?,'published',?,?,?,?,?)").bind(pid, title, body, String(form.get('category') || 'Aqeedah'), form.get('featured') === '1' ? 1 : 0, String(form.get('city') || ''), String(form.get('author') || 'Fatwa team'), image, t, t).run();
    await c.audit(env, 'create', 'post', pid); return json({ ok: true, id: pid }, 201, origin);
  }
  const sub = path.match(/^\/admin\/post-submissions\/([^/]+)$/);
  if (sub && m === 'DELETE') { await env.DB.prepare('DELETE FROM post_submissions WHERE id=?').bind(sub[1]).run(); await c.audit(env, 'delete', 'post_submission', sub[1]); return json({ ok: true }, 200, origin); }
  if (path === '/admin/broadcast' && m === 'POST') {
    const b = await c.readJson(request); const title = String(b.title || '').trim().slice(0, 80); const body = String(b.body || '').trim().slice(0, 240);
    if (!title || !body) return json({ error: 'Title and message are required.' }, 400, origin);
    let filter = 'u.notify_posts<>0'; const binds: unknown[] = [];
    if (b.scope === 'country' && b.value) { filter += ' AND LOWER(TRIM(u.country))=?'; binds.push(String(b.value).trim().toLowerCase()); }
    if (b.scope === 'city' && b.value) { filter += ' AND LOWER(TRIM(u.city))=?'; binds.push(String(b.value).trim().toLowerCase()); }
    const ins = await env.DB.prepare(`INSERT INTO notifications(id,user_id,title,body,question_id,post_id,kind,image_url,read_at,created_at) SELECT 'notification-'||lower(hex(randomblob(16))),u.id,?,?,NULL,NULL,'announcement',NULL,NULL,? FROM users u WHERE ${filter}`).bind(title, body, c.now(), ...binds).run();
    const queued = await queueBroadcast(env, filter, binds, { title, body, data: { type: 'announcement', kind: 'announcement' } }).catch(() => 0);
    await c.audit(env, 'broadcast', 'notification', null, { title, scope: b.scope || 'all' });
    return json({ ok: true, notified: Number(ins.meta?.changes || 0), queuedPush: queued }, 200, origin);
  }
  if (path === '/admin/ai/test' && m === 'POST' && c.chat) {
    const b = await c.readJson(request); const msg = String(b.message || '').trim(); if (!msg) return json({ error: 'Message required.' }, 400, origin);
    const t0 = Date.now(); try { const r: any = await c.chat(msg); return json({ ...r, ms: Date.now() - t0 }, 200, origin); } catch (e) { return json({ error: String(e), ms: Date.now() - t0 }, 502, origin); }
  }
  return null;
}
