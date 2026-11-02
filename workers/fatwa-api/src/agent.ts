type Row = Record<string, any>;
type AgentEnv = { DB: any; AI?: { run: (model: string, input: unknown) => Promise<any> } };

const DRAFT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const MAX_ITEM_AGE_MS = 48 * 60 * 60 * 1000;
const MAX_FEED_BYTES = 600_000;

export const agentSchema = (db: any) => [
  db.prepare("CREATE TABLE IF NOT EXISTS content_sources (id TEXT PRIMARY KEY,name TEXT NOT NULL,url TEXT NOT NULL UNIQUE,kind TEXT NOT NULL DEFAULT 'news',language TEXT NOT NULL DEFAULT 'en',active INTEGER NOT NULL DEFAULT 1,auto_publish INTEGER NOT NULL DEFAULT 0,last_fetched_at TEXT,last_error TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)"),
  db.prepare("CREATE TABLE IF NOT EXISTS agent_runs (id TEXT PRIMARY KEY,status TEXT NOT NULL,started_at TEXT NOT NULL,finished_at TEXT,source_count INTEGER NOT NULL DEFAULT 0,fetched_count INTEGER NOT NULL DEFAULT 0,draft_count INTEGER NOT NULL DEFAULT 0,skipped_count INTEGER NOT NULL DEFAULT 0,error TEXT)"),
  db.prepare("CREATE TABLE IF NOT EXISTS source_items (id TEXT PRIMARY KEY,source_id TEXT NOT NULL,external_id TEXT NOT NULL,title TEXT NOT NULL,url TEXT NOT NULL UNIQUE,published_at TEXT,summary TEXT,raw_text TEXT,hash TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(source_id,external_id))"),
  db.prepare("CREATE TABLE IF NOT EXISTS content_drafts (id TEXT PRIMARY KEY,source_item_id TEXT NOT NULL UNIQUE,run_id TEXT NOT NULL,kind TEXT NOT NULL,language TEXT NOT NULL,title TEXT,body TEXT NOT NULL,source_name TEXT NOT NULL,source_url TEXT NOT NULL,source_published_at TEXT,claims_json TEXT NOT NULL DEFAULT '[]',status TEXT NOT NULL DEFAULT 'needs_review',confidence REAL NOT NULL DEFAULT 0,ai_model TEXT NOT NULL,review_note TEXT,reviewed_at TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)"),
  db.prepare("CREATE TABLE IF NOT EXISTS agent_events (id TEXT PRIMARY KEY,run_id TEXT NOT NULL,stage TEXT NOT NULL,message TEXT NOT NULL,metadata_json TEXT,created_at TEXT NOT NULL)"),
  db.prepare('CREATE INDEX IF NOT EXISTS idx_agent_drafts_status ON content_drafts(status, created_at)'),
  db.prepare('CREATE INDEX IF NOT EXISTS idx_agent_events_run ON agent_events(run_id, created_at)'),
];

const id = (p: string) => `${p}-${crypto.randomUUID()}`;
const now = () => new Date().toISOString();
const clean = (v: unknown, max = 10000) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
async function sha(value: string) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join(''); }
function event(env: AgentEnv, runId: string, stage: string, message: string, metadata: Row = {}) { return env.DB.prepare('INSERT INTO agent_events(id,run_id,stage,message,metadata_json,created_at) VALUES(?,?,?,?,?,?)').bind(id('agent-event'), runId, stage, message, JSON.stringify(metadata), now()).run(); }
function tag(xml: string, name: string) { const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i')); return m ? clean(m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, ' '), 12000) : ''; }
function link(xml: string) { return tag(xml, 'link') || (xml.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1] || ''); }
function parseFeed(xml: string) {
  const blocks = [...xml.matchAll(/<(item|entry)(?:\s[^>]*)?>[\s\S]*?<\/\1>/gi)].map((m) => m[0]);
  return blocks.slice(0, 30).map((b) => ({ title: tag(b, 'title'), url: link(b), publishedAt: tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'updated'), summary: tag(b, 'description') || tag(b, 'summary') || tag(b, 'content') })).filter((x) => x.title && x.url);
}
function parseDate(value: string) { const d = Date.parse(value); return Number.isFinite(d) ? new Date(d).toISOString() : null; }
function jsonFromAi(value: any): Row | null { const raw = typeof value === 'string' ? value : value?.response ?? value?.choices?.[0]?.message?.content ?? ''; const m = String(raw).match(/\{[\s\S]*\}/); if (!m) return null; try { return JSON.parse(m[0]) as Row; } catch { return null; } }

async function makeDraft(env: AgentEnv, item: Row, source: Row) {
  if (!env.AI) throw new Error('ai_unavailable');
  const language = source.language === 'ur' ? 'Urdu' : source.language === 'ar' ? 'Arabic' : 'English';
  const prompt = `You are the editorial AI for a Muslim community app. Create a SHORT draft from the supplied source only. Never invent facts, dates, names, quotes or religious rulings. If this is not clearly suitable for a Muslim audience, still classify it but set publishable=false. Return JSON only with exactly these keys: {"kind":"news|poetry|quote|reflection|islamic_news|other","language":"en|ur|ar","title":"","body":"","claims":[""],"confidence":0.0,"publishable":false}. Use ${language} unless the source text clearly uses another language. For news, include the source attribution in the body. For quotes or poetry, do not attribute unless the source does. Keep body under 900 characters. Do not add a fatwa or religious ruling.`;
  const result = await env.AI.run(DRAFT_MODEL, { messages: [{ role: 'system', content: prompt }, { role: 'user', content: `SOURCE: ${source.name}\nURL: ${item.url}\nPUBLISHED: ${item.publishedAt || 'unknown'}\nTITLE: ${item.title}\nTEXT: ${item.summary}` }], max_tokens: 900, temperature: 0.1 });
  const draft = jsonFromAi(result);
  if (!draft || !clean(draft.body, 2000)) throw new Error('invalid_ai_draft');
  return { kind: ['news', 'poetry', 'quote', 'reflection', 'islamic_news'].includes(String(draft.kind)) ? String(draft.kind) : 'other', language: ['en', 'ur', 'ar'].includes(String(draft.language)) ? String(draft.language) : source.language, title: clean(draft.title, 180), body: clean(draft.body, 1500), claims: Array.isArray(draft.claims) ? draft.claims.map((x: unknown) => clean(x, 300)).filter(Boolean).slice(0, 8) : [], confidence: Math.max(0, Math.min(1, Number(draft.confidence) || 0)), publishable: draft.publishable === true };
}

export async function runContentAgent(env: AgentEnv, reason = 'scheduled') {
  const active = await env.DB.prepare("SELECT id FROM agent_runs WHERE status='running' AND started_at>? LIMIT 1").bind(new Date(Date.now() - 30 * 60 * 1000).toISOString()).first();
  if (active) return { runId: active.id, status: 'already_running', sources: 0, fetched: 0, drafts: 0, skipped: 0 };
  const runId = id('agent-run'); const started = now();
  await env.DB.prepare('INSERT INTO agent_runs(id,status,started_at) VALUES(?,?,?)').bind(runId, 'running', started).run();
  let fetched = 0, drafts = 0, skipped = 0;
  try {
    const sources = await env.DB.prepare('SELECT * FROM content_sources WHERE active=1 ORDER BY updated_at DESC').all();
    await event(env, runId, 'start', 'Content agent started', { reason, sources: sources.results.length });
    for (const source of sources.results.slice(0, 10)) {
      try {
        await event(env, runId, 'fetch', `Fetching ${source.name}`, { url: source.url });
        const response = await fetch(source.url, { headers: { 'user-agent': 'FatwaContentAgent/1.0 (+https://fatwa-api.ziakhalid236.workers.dev)' } });
        if (!response.ok) throw new Error(`source_http_${response.status}`);
        const xml = (await response.text()).slice(0, MAX_FEED_BYTES);
        const items = parseFeed(xml); fetched += items.length;
        for (const item of items) {
          const publishedAt = parseDate(item.publishedAt);
          if (publishedAt && Date.now() - Date.parse(publishedAt) > MAX_ITEM_AGE_MS) { skipped++; continue; }
          const hash = await sha(`${item.url}|${item.title}`);
          const exists = await env.DB.prepare('SELECT id FROM source_items WHERE url=? OR hash=?').bind(item.url, hash).first();
          if (exists) { skipped++; continue; }
          const itemId = id('source-item');
          await env.DB.prepare('INSERT INTO source_items(id,source_id,external_id,title,url,published_at,summary,raw_text,hash,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(itemId, source.id, item.url, item.title, item.url, publishedAt, item.summary, item.summary, hash, now()).run();
          try {
            const result = await makeDraft(env, item, source);
            const draftId = id('draft');
            await env.DB.prepare('INSERT INTO content_drafts(id,source_item_id,run_id,kind,language,title,body,source_name,source_url,source_published_at,claims_json,status,confidence,ai_model,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(draftId, itemId, runId, result.kind, result.language, result.title || null, result.body, source.name, item.url, publishedAt, JSON.stringify(result.claims), 'needs_review', result.confidence, DRAFT_MODEL, now(), now()).run();
            drafts++; await event(env, runId, 'draft', `Draft created: ${result.kind}`, { draftId, sourceItemId: itemId, confidence: result.confidence, publishable: result.publishable });
          } catch (error) { skipped++; await event(env, runId, 'error', 'AI draft failed', { itemId, error: String(error) }); }
        }
        await env.DB.prepare('UPDATE content_sources SET last_fetched_at=?,last_error=NULL,updated_at=? WHERE id=?').bind(now(), now(), source.id).run();
      } catch (error) { await env.DB.prepare('UPDATE content_sources SET last_fetched_at=?,last_error=?,updated_at=? WHERE id=?').bind(now(), clean(error, 300), now(), source.id).run(); await event(env, runId, 'error', `Source failed: ${source.name}`, { error: String(error) }); }
    }
    await env.DB.prepare('UPDATE agent_runs SET status=?,finished_at=?,source_count=?,fetched_count=?,draft_count=?,skipped_count=? WHERE id=?').bind('completed', now(), sources.results.length, fetched, drafts, skipped, runId).run();
    return { runId, status: 'completed', sources: sources.results.length, fetched, drafts, skipped };
  } catch (error) {
    await env.DB.prepare('UPDATE agent_runs SET status=?,finished_at=?,fetched_count=?,draft_count=?,skipped_count=?,error=? WHERE id=?').bind('failed', now(), fetched, drafts, skipped, clean(error, 500), runId).run();
    throw error;
  }
}

export async function agentRoutes(env: AgentEnv, path: string, method: string, url: URL, body: Row = {}) : Promise<Row | null> {
  if (path === '/admin/agent/sources' && method === 'GET') return { sources: (await env.DB.prepare('SELECT * FROM content_sources ORDER BY active DESC,updated_at DESC').all()).results };
  if (path === '/admin/agent/sources' && method === 'POST') {
    const name = clean(body.name, 120), sourceUrl = clean(body.url, 500);
    if (!name || !/^https:\/\//i.test(sourceUrl)) throw new Error('A valid HTTPS RSS URL is required.');
    const timestamp = now(); const sourceId = id('source');
    await env.DB.prepare('INSERT INTO content_sources(id,name,url,kind,language,active,auto_publish,last_fetched_at,last_error,created_at,updated_at) VALUES(?,?,?,?,?,1,0,NULL,NULL,?,?)').bind(sourceId, name, sourceUrl, clean(body.kind, 40) || 'news', ['ur','ar'].includes(body.language) ? body.language : 'en', timestamp, timestamp).run();
    return { ok: true, id: sourceId };
  }
  const sourceMatch = path.match(/^\/admin\/agent\/sources\/([^/]+)$/);
  if (sourceMatch && method === 'PATCH') { const active = body.active === false ? 0 : 1; await env.DB.prepare('UPDATE content_sources SET active=?,kind=?,language=?,updated_at=? WHERE id=?').bind(active, clean(body.kind, 40) || 'news', ['ur','ar'].includes(body.language) ? body.language : 'en', now(), sourceMatch[1]).run(); return { ok: true }; }
  if (sourceMatch && method === 'DELETE') { await env.DB.prepare('DELETE FROM content_sources WHERE id=?').bind(sourceMatch[1]).run(); return { ok: true }; }
  if (path === '/admin/agent/run' && method === 'POST') return await runContentAgent(env, 'admin');
  if (path === '/admin/agent/runs' && method === 'GET') return { runs: (await env.DB.prepare('SELECT * FROM agent_runs ORDER BY started_at DESC LIMIT 30').all()).results };
  if (path === '/admin/agent/events' && method === 'GET') { const runId = url.searchParams.get('runId') || ''; return { events: (await env.DB.prepare('SELECT * FROM agent_events WHERE run_id=? ORDER BY created_at ASC LIMIT 300').bind(runId).all()).results }; }
  if (path === '/admin/agent/drafts' && method === 'GET') { const status = url.searchParams.get('status') || 'needs_review'; const allowed = new Set(['needs_review','approved','rejected','published']); const s = allowed.has(status) ? status : 'needs_review'; return { drafts: (await env.DB.prepare('SELECT * FROM content_drafts WHERE status=? ORDER BY created_at DESC LIMIT 200').bind(s).all()).results }; }
  const draftMatch = path.match(/^\/admin\/agent\/drafts\/([^/]+)$/);
  if (draftMatch && method === 'PATCH') {
    const action = body.action === 'approve' ? 'approved' : body.action === 'reject' ? 'rejected' : '';
    if (!action) throw new Error('Action must be approve or reject.');
    const draft = await env.DB.prepare('SELECT * FROM content_drafts WHERE id=?').bind(draftMatch[1]).first(); if (!draft) throw new Error('Draft not found.');
    if (action === 'approved') {
      const postId = id('post'); const timestamp = now();
      await env.DB.prepare("INSERT INTO posts(id,title,body,category,featured,status,author,image_url,created_at,updated_at) VALUES(?,?,?,?,0,'published',?,?,?,?)").bind(postId, draft.title || null, draft.body, draft.kind, 'Fatwa AI editorial', null, timestamp, timestamp).run();
      await env.DB.prepare('UPDATE content_drafts SET status=?,review_note=?,reviewed_at=?,updated_at=? WHERE id=?').bind('published', clean(body.note, 500), timestamp, timestamp, draft.id).run();
      await env.DB.prepare('INSERT INTO admin_audit_logs(id,admin_id,action,entity_type,entity_id,metadata_json,created_at) VALUES(?,?,?,?,?,?,?)').bind(id('audit'), 'admin', 'publish', 'content_draft', draft.id, JSON.stringify({ postId, sourceUrl: draft.source_url }), timestamp).run();
      return { ok: true, status: 'published', postId };
    }
    await env.DB.prepare('UPDATE content_drafts SET status=?,review_note=?,reviewed_at=?,updated_at=? WHERE id=?').bind(action, clean(body.note, 500), now(), now(), draft.id).run();
    return { ok: true, status: action };
  }
  return null;
}

export function seedAgentSources(db: any) {
  const t = now();
  return db.batch([
    db.prepare("INSERT OR IGNORE INTO content_sources(id,name,url,kind,language,active,auto_publish,created_at,updated_at) VALUES(?,?,?,?,?,1,0,?,?)").bind('source-aljazeera', 'Al Jazeera English RSS', 'https://www.aljazeera.com/xml/rss/all.xml', 'islamic_news', 'en', t, t),
    db.prepare("INSERT OR IGNORE INTO content_sources(id,name,url,kind,language,active,auto_publish,created_at,updated_at) VALUES(?,?,?,?,?,1,0,?,?)").bind('source-bbc-urdu', 'BBC Urdu RSS', 'https://feeds.bbci.co.uk/urdu/rss.xml', 'news', 'ur', t, t),
    db.prepare("INSERT OR IGNORE INTO content_sources(id,name,url,kind,language,active,auto_publish,created_at,updated_at) VALUES(?,?,?,?,?,1,0,?,?)").bind('source-middle-east-eye', 'Middle East Eye RSS', 'https://www.middleeasteye.net/rss', 'islamic_news', 'en', t, t),
  ]);
}
