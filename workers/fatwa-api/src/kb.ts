// Islamic knowledge library: sources -> works -> passages (full-text indexed) with cross-language retrieval.
// Retrieval = LLM keyword expansion (Arabic/Urdu/English) -> FTS5 candidates -> multilingual embedding rerank.

type Row = Record<string, any>;
export interface KbEnv {
  KB: D1Database;
  AI?: { run: (model: string, input: unknown) => Promise<unknown> };
}

const EXPAND_MODEL = '@cf/meta/llama-3.1-8b-instruct-fast';
const EMBED_MODEL = '@cf/baai/bge-m3';

export const kbSchemaStatements = (db: D1Database) => [
  db.prepare("CREATE TABLE IF NOT EXISTS kb_sources (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL UNIQUE,url TEXT,type TEXT,rights_status TEXT NOT NULL DEFAULT 'unknown',license_note TEXT,notes TEXT,last_checked TEXT)"),
  db.prepare("CREATE TABLE IF NOT EXISTS kb_scholars (id INTEGER PRIMARY KEY AUTOINCREMENT,seq INTEGER,name_ar TEXT,name_ur TEXT,name_en TEXT,era TEXT,region TEXT,tradition TEXT,known_works TEXT,source_url TEXT,verification_status TEXT NOT NULL DEFAULT 'unverified',ai_status TEXT NOT NULL DEFAULT 'catalogue_only',created_at TEXT NOT NULL)"),
  db.prepare("CREATE TABLE IF NOT EXISTS kb_works (id INTEGER PRIMARY KEY AUTOINCREMENT,source_id INTEGER,scholar_id INTEGER,title TEXT NOT NULL,author TEXT,lang TEXT,genre TEXT,url TEXT,edition TEXT,rights_status TEXT NOT NULL DEFAULT 'unknown',verification_status TEXT NOT NULL DEFAULT 'unverified',created_at TEXT NOT NULL,UNIQUE(source_id,title))"),
  db.prepare("CREATE TABLE IF NOT EXISTS kb_passages (id INTEGER PRIMARY KEY AUTOINCREMENT,work_id INTEGER NOT NULL,ref TEXT,lang TEXT,text TEXT NOT NULL,url TEXT,hash TEXT NOT NULL,created_at TEXT NOT NULL,seq INTEGER,UNIQUE(work_id,hash))"),
  db.prepare("CREATE VIRTUAL TABLE IF NOT EXISTS kb_fts USING fts5(text_norm, content='', contentless_delete=1, tokenize='unicode61 remove_diacritics 2')"),
  db.prepare('CREATE INDEX IF NOT EXISTS idx_kb_passages_work ON kb_passages(work_id)'),
];

// Older databases lack the reading-order column; add it, then index it.
export async function kbMigrate(db: D1Database) {
  try { await db.prepare('ALTER TABLE kb_passages ADD COLUMN seq INTEGER').run(); } catch { /* already present */ }
  try { await db.prepare('ALTER TABLE kb_works ADD COLUMN cover_url TEXT').run(); } catch { /* already present */ }
  // The index only speeds up ordered reading; never let a failure here take the API down.
  try { await db.prepare('CREATE INDEX IF NOT EXISTS idx_kb_passages_seq ON kb_passages(work_id, seq)').run(); } catch (error) { console.error('kb index', String(error)); }
}

// Removes Arabic harakat/tatweel and unifies Arabic/Urdu/Persian letter variants so one search matches all spellings.
export function normalize(input: string): string {
  return input
    .normalize('NFKC')
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640\u200c\u200d]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/[ىيیۍ]/g, 'ي').replace(/[ےۓ]/g, 'ي')
    .replace(/[كک]/g, 'ك')
    .replace(/[ةۃہھە]/g, 'ه')
    .replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
    .toLowerCase();
}

const STOP = new Set(['the', 'and', 'for', 'what', 'how', 'can', 'does', 'are', 'is', 'of', 'in', 'to', 'a', 'an', 'on', 'with', 'about', 'ruling', 'islam', 'islamic',
  'كيا', 'هي', 'هيں', 'كي', 'كا', 'كے', 'ميں', 'سے', 'اور', 'كو', 'پر', 'تو', 'اگر', 'هو', 'جايے', 'كرنا', 'چاهيے', 'هے', 'يه', 'وه', 'كرتا', 'كريں', 'بتايں', 'بتائيں', 'جائے', 'جايے',
  'من', 'في', 'على', 'الي', 'عن', 'ما', 'هل', 'لا', 'ان', 'او', 'هذا', 'هذه']);

export function tokens(text: string, max = 24): string[] {
  const out: string[] = [];
  for (const raw of normalize(text).split(/[^\p{L}\p{N}]+/u)) {
    if (raw.length < 2 || STOP.has(raw) || out.includes(raw)) continue;
    out.push(raw);
    if (out.length >= max) break;
  }
  return out;
}

const ftsQuery = (words: string[]) => words.map((w) => `"${w.replace(/"/g, '')}"`).join(' OR ');

export async function expandQuery(env: KbEnv, message: string): Promise<string[]> {
  if (!env.AI) return [];
  try {
    const result = await env.AI.run(EXPAND_MODEL, {
      messages: [
        { role: 'system', content: 'You prepare an Islamic question for searching a library of Arabic, Urdu and English books. Reply with ONLY a JSON object {"ar":"","ur":"","en":""}. Each value: the question rewritten in that language (Arabic in classical fiqh/hadith wording as books use it) followed by 4 to 6 related key terms. No explanations.' },
        { role: 'user', content: message.slice(0, 500) },
      ],
      max_tokens: 300, temperature: 0,
    }) as Row;
    const rawValue = result?.response ?? result?.choices?.[0]?.message?.content ?? '';
    let parsed: Record<string, unknown>;
    if (rawValue && typeof rawValue === 'object') parsed = rawValue as Record<string, unknown>;
    else { const match = String(rawValue).match(/\{[\s\S]*\}/); if (!match) return []; parsed = JSON.parse(match[0]) as Record<string, unknown>; }
    const words: string[] = [];
    for (const key of ['ar', 'ur', 'en']) {
      const value = parsed[key];
      const text = Array.isArray(value) ? value.join(' ') : typeof value === 'string' ? value : '';
      words.push(...tokens(text, 14));
    }
    return words;
  } catch (error) { console.error('expand failed', String(error)); return []; }
}

export interface KbHit { id: number; source: string; work: string; author: string; ref: string; lang: string; text: string; url: string; rights: string; score: number }

const cosine = (a: number[], b: number[]) => { let d = 0, x = 0, y = 0; for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; x += a[i] * a[i]; y += b[i] * b[i]; } return d / (Math.sqrt(x * y) || 1); };

export async function searchKb(env: KbEnv, message: string, limit = 5): Promise<KbHit[]> {
  const direct = tokens(message, 12);
  const expanded = await expandQuery(env, message);
  const words = [...new Set([...direct, ...expanded])].slice(0, 36);
  if (!words.length) return [];
  let rows: Row[] = [];
  try {
    const res = await env.KB.prepare(
      `SELECT p.id,p.ref,p.lang,p.text,p.url AS purl,w.title,w.author,w.url AS wurl,w.genre,w.rights_status,s.name AS source,bm25(kb_fts) AS score
       FROM kb_fts JOIN kb_passages p ON p.id=kb_fts.rowid JOIN kb_works w ON w.id=p.work_id LEFT JOIN kb_sources s ON s.id=w.source_id
       WHERE kb_fts MATCH ? ORDER BY score LIMIT 40`).bind(ftsQuery(words)).all<Row>();
    rows = res.results;
  } catch { return []; }
  if (!rows.length) return [];
  let ranked = rows.map((r, i) => ({ r, s: -i }));
  if (env.AI && rows.length > limit) {
    try {
      const out = await env.AI.run(EMBED_MODEL, { text: [message.slice(0, 600), ...rows.map((r) => String(r.text).slice(0, 700))] }) as Row;
      const vectors = out?.data as number[][] | undefined;
      if (vectors && vectors.length === rows.length + 1) {
        // Blend the embedding similarity with the keyword rank so exact-term matches are not lost.
        ranked = rows.map((r, i) => ({ r, s: cosine(vectors[0], vectors[i + 1]) - i * 0.004 })).sort((a, b) => b.s - a.s);
      }
    } catch { /* fall back to keyword order */ }
  }
  // Keep two slots for Hanafi fiqh books when the candidates contain any, so rulings are grounded in the school's own texts.
  const picked = ranked.slice(0, limit - 2);
  for (const item of ranked) { if (picked.length >= limit) break; if (item.r.genre === 'fiqh_hanafi' && !picked.includes(item)) picked.push(item); }
  for (const item of ranked) { if (picked.length >= limit) break; if (!picked.includes(item)) picked.push(item); }
  return picked.map(({ r, s }) => ({
    id: r.id, source: r.source || '', work: r.title, author: r.author || '', ref: r.ref || '', lang: r.lang || '',
    text: String(r.text), url: r.purl || r.wurl || '', rights: r.rights_status, score: s,
  }));
}

export function kbContext(hits: KbHit[]): string {
  if (!hits.length) return '';
  const lines = hits.map((h, i) => `[${i + 1}] ${h.work}${h.author ? ' — ' + h.author : ''}${h.ref ? ' (' + h.ref + ')' : ''} [${h.lang || '?'}; ${h.source}]\n${h.text.slice(0, 900)}`);
  return [
    'Library sources retrieved for this question (may be in Arabic, Urdu or English; they are NOT in the user\'s language necessarily):',
    ...lines,
    'Rules for these sources: base your answer on them when they are relevant, translate the meaning into the user\'s language, name the book/author in your answer (e.g. "Sahih Bukhari"), never invent a reference that is not listed above, and ignore sources that are not relevant. If they do not answer the question, say so and answer cautiously from the reference notes.',
  ].join('\n');
}

export const publicHit = (h: KbHit) => ({ work: h.work, author: h.author, ref: h.ref, source: h.source, url: h.url, snippet: h.text.slice(0, 220) });

// ---- ingestion (admin only) ----
async function sha(text: string) {
  const bytes = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function ingest(env: KbEnv, body: Row) {
  const now = new Date().toISOString();
  const src = body.source || {};
  if (!src.name) throw new Error('source.name required');
  await env.KB.prepare('INSERT INTO kb_sources(name,url,type,rights_status,license_note,notes,last_checked) VALUES(?,?,?,?,?,?,?) ON CONFLICT(name) DO UPDATE SET url=excluded.url,type=excluded.type,rights_status=excluded.rights_status,license_note=excluded.license_note,notes=excluded.notes,last_checked=excluded.last_checked')
    .bind(src.name, src.url || null, src.type || null, src.rights_status || 'unknown', src.license_note || null, src.notes || null, now).run();
  const source = await env.KB.prepare('SELECT id FROM kb_sources WHERE name=?').bind(src.name).first<Row>();
  const w = body.work || {};
  if (!w.title) throw new Error('work.title required');
  await env.KB.prepare('INSERT OR IGNORE INTO kb_works(source_id,title,author,lang,genre,url,edition,rights_status,verification_status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)')
    .bind(source!.id, w.title, w.author || null, w.lang || null, w.genre || null, w.url || null, w.edition || null, w.rights_status || src.rights_status || 'unknown', w.verification_status || 'unverified', now).run();
  const work = await env.KB.prepare('SELECT id FROM kb_works WHERE source_id=? AND title=?').bind(source!.id, w.title).first<Row>();
  if (w.cover_url) await env.KB.prepare('UPDATE kb_works SET cover_url=? WHERE id=?').bind(String(w.cover_url), work!.id).run();
  const passages = Array.isArray(body.passages) ? body.passages as Row[] : [];
  const statements: D1PreparedStatement[] = [];
  const seen = new Set<string>();
  for (const p of passages) {
    const text = String(p.text || '').trim();
    if (text.length < 8) continue;
    const norm = normalize(text);
    const hash = await sha(text);
    if (seen.has(hash)) continue;
    seen.add(hash);
    statements.push(
      env.KB.prepare('INSERT OR IGNORE INTO kb_passages(work_id,ref,lang,text,url,hash,created_at,seq) VALUES(?,?,?,?,?,?,?,?)').bind(work!.id, p.ref || null, p.lang || w.lang || null, text, p.url || null, hash, now, Number.isFinite(Number(p.seq)) && p.seq !== null ? Number(p.seq) : null),
      env.KB.prepare('INSERT INTO kb_fts(rowid,text_norm) SELECT id, ? FROM kb_passages WHERE work_id=? AND hash=? AND created_at=?').bind(norm, work!.id, hash, now),
    );
  }
  for (let i = 0; i < statements.length; i += 200) await env.KB.batch(statements.slice(i, i + 200));
  return { workId: work!.id, received: passages.length };
}

// Sets reading order for already-ingested passages: hashes[i] gets seq = start + i.
export async function reseq(env: KbEnv, body: Row) {
  const w = await env.KB.prepare('SELECT w.id FROM kb_works w JOIN kb_sources s ON s.id=w.source_id WHERE s.name=? AND w.title=?').bind(String(body.source || ''), String(body.title || '')).first<Row>();
  if (!w) throw new Error('work not found');
  const hashes = Array.isArray(body.hashes) ? body.hashes as string[] : [];
  const start = Number(body.start || 0);
  const statements = hashes.map((h, i) => env.KB.prepare('UPDATE kb_passages SET seq=? WHERE work_id=? AND hash=?').bind(start + i, w.id, h));
  for (let i = 0; i < statements.length; i += 250) await env.KB.batch(statements.slice(i, i + 250));
  return { updated: hashes.length };
}

export async function importScholars(env: KbEnv, rows: Row[]) {
  const now = new Date().toISOString();
  const statements = rows.map((r) => env.KB.prepare('INSERT INTO kb_scholars(seq,name_ar,name_ur,name_en,era,region,tradition,known_works,source_url,verification_status,ai_status,created_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM kb_scholars WHERE seq=?)')
    .bind(r.seq ?? null, r.name_ar || null, r.name_ur || null, r.name_en || null, r.era || null, r.region || null, r.tradition || null, r.known_works || null, r.source_url || null, r.verification_status || 'unverified', r.ai_status || 'catalogue_only', now, r.seq ?? null));
  for (let i = 0; i < statements.length; i += 100) await env.KB.batch(statements.slice(i, i + 100));
  return { imported: rows.length };
}

export async function kbStats(env: KbEnv) {
  const one = async (sql: string) => (await env.KB.prepare(sql).first<Row>())?.c ?? 0;
  const bySource = await env.KB.prepare('SELECT s.name,s.rights_status AS rights,COUNT(p.id) AS passages FROM kb_sources s LEFT JOIN kb_works w ON w.source_id=s.id LEFT JOIN kb_passages p ON p.work_id=w.id GROUP BY s.id ORDER BY passages DESC').all<Row>();
  return { sources: await one('SELECT COUNT(*) c FROM kb_sources'), works: await one('SELECT COUNT(*) c FROM kb_works'), passages: await one('SELECT COUNT(*) c FROM kb_passages'), scholars: await one('SELECT COUNT(*) c FROM kb_scholars'), bySource: bySource.results };
}
