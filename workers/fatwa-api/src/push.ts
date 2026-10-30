// Push delivery through Firebase Cloud Messaging (HTTP v1). Needs the secret FCM_SERVICE_ACCOUNT (service-account JSON).
// Messages wait in push_queue and are sent in small slices by the cron trigger (and right after a broadcast).

type Row = Record<string, any>;
export interface PushEnv { DB: D1Database; FCM_SERVICE_ACCOUNT?: string }

export const pushSchemaStatements = (db: D1Database) => [
  db.prepare('CREATE TABLE IF NOT EXISTS push_tokens (token TEXT PRIMARY KEY,user_id TEXT NOT NULL,platform TEXT NOT NULL DEFAULT \'android\',created_at TEXT NOT NULL,updated_at TEXT NOT NULL)'),
  db.prepare('CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON push_tokens(user_id)'),
  db.prepare("CREATE TABLE IF NOT EXISTS push_queue (id INTEGER PRIMARY KEY AUTOINCREMENT,token TEXT NOT NULL,title TEXT NOT NULL,body TEXT NOT NULL,image_url TEXT,data_json TEXT,status TEXT NOT NULL DEFAULT 'pending',error TEXT,created_at TEXT NOT NULL,sent_at TEXT)"),
  db.prepare('CREATE INDEX IF NOT EXISTS idx_push_queue_status ON push_queue(status,id)'),
];

const b64url = (input: ArrayBuffer | string) => {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
  let s = ''; for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

let cachedToken: { value: string; exp: number } | null = null;
async function accessToken(account: Row): Promise<string> {
  if (cachedToken && cachedToken.exp > Date.now() + 60_000) return cachedToken.value;
  const iat = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({ iss: account.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat, exp: iat + 3600 }));
  const pem = String(account.private_key).replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claim}`));
  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${header}.${claim}.${b64url(signature)}` });
  const data = await res.json() as Row;
  if (!data.access_token) throw new Error('fcm_auth_failed');
  cachedToken = { value: data.access_token, exp: Date.now() + Number(data.expires_in || 3600) * 1000 };
  return cachedToken.value;
}

export async function registerPushToken(env: PushEnv, userId: string, token: string, platform: string) {
  const ts = new Date().toISOString();
  await env.DB.prepare('INSERT INTO push_tokens(token,user_id,platform,created_at,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(token) DO UPDATE SET user_id=excluded.user_id,platform=excluded.platform,updated_at=excluded.updated_at').bind(token, userId, platform, ts, ts).run();
}

// Queues one push per device of every user matched by the (already prepared) user filter.
export async function queueBroadcast(env: PushEnv, filterSql: string, binds: unknown[], msg: { title: string; body: string; imageUrl?: string | null; data?: Record<string, string> }) {
  const res = await env.DB.prepare(`INSERT INTO push_queue(token,title,body,image_url,data_json,created_at) SELECT t.token,?,?,?,?,? FROM push_tokens t JOIN users u ON u.id=t.user_id WHERE ${filterSql}`)
    .bind(msg.title, msg.body, msg.imageUrl || null, JSON.stringify(msg.data || {}), new Date().toISOString(), ...binds).run();
  return Number(res.meta?.changes ?? 0);
}

// Sends up to `limit` pending messages. Returns counts; leaves messages pending when FCM is not configured.
export async function processPushQueue(env: PushEnv, limit = 40) {
  if (!env.FCM_SERVICE_ACCOUNT) return { configured: false, sent: 0, failed: 0 };
  const account = JSON.parse(env.FCM_SERVICE_ACCOUNT) as Row;
  const rows = await env.DB.prepare("SELECT * FROM push_queue WHERE status='pending' ORDER BY id LIMIT ?").bind(limit).all<Row>();
  if (!rows.results.length) return { configured: true, sent: 0, failed: 0 };
  const bearer = await accessToken(account);
  let sent = 0, failed = 0;
  await Promise.all(rows.results.map(async (row) => {
    const message: Row = {
      token: row.token,
      notification: { title: row.title, body: row.body, ...(row.image_url ? { image: row.image_url } : {}) },
      data: JSON.parse(row.data_json || '{}'),
      android: { priority: 'HIGH', notification: { channel_id: 'broadcast', ...(row.image_url ? { image: row.image_url } : {}) } },
    };
    try {
      const res = await fetch(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, { method: 'POST', headers: { authorization: `Bearer ${bearer}`, 'content-type': 'application/json' }, body: JSON.stringify({ message }) });
      if (res.ok) { sent++; await env.DB.prepare("UPDATE push_queue SET status='sent',sent_at=? WHERE id=?").bind(new Date().toISOString(), row.id).run(); return; }
      const err = await res.text(); failed++;
      if (/UNREGISTERED|NOT_FOUND|INVALID_ARGUMENT/.test(err)) await env.DB.prepare('DELETE FROM push_tokens WHERE token=?').bind(row.token).run();
      await env.DB.prepare("UPDATE push_queue SET status='failed',error=? WHERE id=?").bind(err.slice(0, 300), row.id).run();
    } catch (error) { failed++; await env.DB.prepare("UPDATE push_queue SET status='failed',error=? WHERE id=?").bind(String(error).slice(0, 300), row.id).run(); }
  }));
  await env.DB.prepare("DELETE FROM push_queue WHERE created_at<?").bind(new Date(Date.now() - 3 * 86400000).toISOString()).run();
  return { configured: true, sent, failed };
}
