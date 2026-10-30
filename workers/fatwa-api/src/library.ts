// Public read-only library API used by the Books tab: list works, read a work page by page, read the Quran by surah.
import { normalize, searchKb, type KbEnv } from './kb';

type Row = Record<string, any>;
export interface LibResult { status: number; body: unknown }

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : lo));
type Surah = { number: number; name: string; ayat: number; refs: string[] };
let surahCache: Surah[] | null = null;

async function surahs(env: KbEnv, arabicWork: number) {
  if (surahCache) return surahCache;
  // Order by the surah:ayah numbers inside the reference, so it does not depend on insertion order.
  const rows = (await env.KB.prepare('SELECT ref FROM kb_passages WHERE work_id=?').bind(arabicWork).all<Row>()).results;
  const parsed: Array<{ s: number; a: number; name: string; ref: string }> = [];
  for (const r of rows) {
    const m = /^(.*)\s(\d+):(\d+)$/.exec(String(r.ref || ''));
    if (m) parsed.push({ s: Number(m[2]), a: Number(m[3]), name: m[1], ref: String(r.ref) });
  }
  parsed.sort((x, y) => x.s - y.s || x.a - y.a);
  const out: Surah[] = [];
  for (const p of parsed) {
    const last = out[out.length - 1];
    if (!last || last.number !== p.s) out.push({ number: p.s, name: p.name, ayat: 1, refs: [p.ref] });
    else { last.ayat += 1; last.refs.push(p.ref); }
  }
  if (out.length === 114) surahCache = out;
  return out;
}

// Quran passages are stored as "<surah name> N — <text>" or "<surah> N:A — <text>"; strip the label so only the verse remains.
const verseText = (t: string) => {
  const i = t.indexOf(' — ');
  const text = i > -1 && i < 60 ? t.slice(i + 3) : t;
  // Tanzil prefixes the basmala to ayah 1 of most surahs; the reader shows ayat only.
  const words = text.split(' ');
  return words.length > 4 && normalize(words.slice(0, 4).join(' ')).replace(/\u0671/g, 'ا') === normalize('بسم الله الرحمن الرحيم') ? words.slice(4).join(' ') : text;
};

export async function libraryRoute(env: KbEnv, path: string, params: URLSearchParams): Promise<LibResult | null> {
  if (path === '/library/works') {
    const res = await env.KB.prepare(
      `SELECT w.id,w.title,w.author,w.lang,w.genre,w.rights_status AS rights,w.verification_status AS verification,s.name AS source,s.url AS sourceUrl,s.license_note AS license,
              (SELECT COUNT(*) FROM kb_passages p WHERE p.work_id=w.id) AS passages
       FROM kb_works w LEFT JOIN kb_sources s ON s.id=w.source_id ORDER BY w.genre,w.author,w.lang`).all<Row>();
    return { status: 200, body: { works: res.results } };
  }
  let m = /^\/library\/works\/(\d+)$/.exec(path);
  if (m) {
    const id = Number(m[1]);
    const size = clamp(Number(params.get('size') || 20), 1, 50);
    const page = clamp(Number(params.get('page') || 1), 1, 100000);
    const work = await env.KB.prepare(
      `SELECT w.id,w.title,w.author,w.lang,w.genre,w.rights_status AS rights,w.verification_status AS verification,s.name AS source,s.url AS sourceUrl,s.license_note AS license,
              (SELECT COUNT(*) FROM kb_passages p WHERE p.work_id=w.id) AS passages
       FROM kb_works w LEFT JOIN kb_sources s ON s.id=w.source_id WHERE w.id=?`).bind(id).first<Row>();
    if (!work) return { status: 404, body: { error: 'Not found' } };
    const order = work.genre === 'hadith' ? "CAST(substr(ref, instr(ref,'#')+1) AS INTEGER), id" : 'seq,id';
    const rows = (await env.KB.prepare(`SELECT id,ref,lang,text,url FROM kb_passages WHERE work_id=? ORDER BY ${order} LIMIT ? OFFSET ?`).bind(id, size, (page - 1) * size).all<Row>()).results;
    return { status: 200, body: { work, page, size, pages: Math.ceil(Number(work.passages) / size), passages: rows } };
  }
  if (path === '/library/quran') {
    const works = (await env.KB.prepare("SELECT id,lang,title FROM kb_works WHERE genre='quran' ORDER BY id").all<Row>()).results;
    const ar = works.find((w) => w.lang === 'ar');
    if (!ar) return { status: 404, body: { error: 'Quran not loaded' } };
    return { status: 200, body: { editions: works, surahs: (await surahs(env, ar.id)).map(({ number, name, ayat }) => ({ number, name, ayat })) } };
  }
  m = /^\/library\/quran\/(\d+)$/.exec(path);
  if (m) {
    const works = (await env.KB.prepare("SELECT id,lang,title FROM kb_works WHERE genre='quran' ORDER BY id").all<Row>()).results;
    const ar = works.find((w) => w.lang === 'ar');
    if (!ar) return { status: 404, body: { error: 'Quran not loaded' } };
    const list = await surahs(env, ar.id);
    const surah = list.find((s) => s.number === Number(m![1]));
    if (!surah) return { status: 404, body: { error: 'No such surah' } };
    const from = clamp(Number(params.get('from') || 1), 1, surah.ayat);
    const limit = clamp(Number(params.get('limit') || 15), 1, 40);
    const refs = surah.refs.slice(from - 1, from - 1 + limit);
    const marks = refs.map(() => '?').join(',');
    const sets = await env.KB.batch(works.map((w) => env.KB.prepare(`SELECT ref,text FROM kb_passages WHERE work_id=? AND ref IN (${marks})`).bind(w.id, ...refs)));
    const ayat = refs.map((ref, i) => {
      const verse: Row = { n: from + i };
      works.forEach((w, k) => { const r = (sets[k].results as Row[]).find((x) => x.ref === ref); if (r) verse[w.lang] = verseText(String(r.text)); });
      return verse;
    });
    const count = refs.length;
    return { status: 200, body: { surah: { number: surah.number, name: surah.name, ayat: surah.ayat }, from, ayat, next: from + count <= surah.ayat ? from + count : null } };
  }
  if (path === '/library/search') {
    const q = (params.get('q') || '').trim().slice(0, 300);
    if (q.length < 2) return { status: 200, body: { hits: [] } };
    const hits = await searchKb(env, q, 12);
    return { status: 200, body: { hits: hits.map((h) => ({ id: h.id, work: h.work, author: h.author, ref: h.ref, lang: h.lang, source: h.source, rights: h.rights, url: h.url, text: h.text.slice(0, 700) })) } };
  }
  return null;
}
