// Minimal D1-compatible client for Turso (libSQL) over its HTTP API (Hrana v2 pipeline).
// Supports the subset the Worker uses: prepare().bind().first()/all()/run(), batch() (atomic).
type Json = Record<string, any>;
type Arg = { type: 'null' } | { type: 'integer'; value: string } | { type: 'float'; value: number } | { type: 'text'; value: string } | { type: 'blob'; base64: string };

function encode(v: unknown): Arg {
  if (v === null || v === undefined) return { type: 'null' };
  if (typeof v === 'boolean') return { type: 'integer', value: v ? '1' : '0' };
  if (typeof v === 'number') return Number.isInteger(v) ? { type: 'integer', value: String(v) } : { type: 'float', value: v };
  if (typeof v === 'bigint') return { type: 'integer', value: v.toString() };
  if (v instanceof ArrayBuffer || ArrayBuffer.isView(v)) {
    const bytes = v instanceof ArrayBuffer ? new Uint8Array(v) : new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
    let s = ''; for (const b of bytes) s += String.fromCharCode(b);
    return { type: 'blob', base64: btoa(s) };
  }
  return { type: 'text', value: String(v) };
}

function decode(c: Json): unknown {
  switch (c.type) {
    case 'null': return null;
    case 'integer': { const n = Number(c.value); return Number.isSafeInteger(n) ? n : c.value; }
    case 'float': return Number(c.value);
    case 'blob': { const s = atob(c.base64); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u.buffer; }
    default: return c.value;
  }
}

function toResult(r: Json) {
  const names: string[] = (r.cols || []).map((c: Json) => c.name);
  const results = (r.rows || []).map((row: Json[]) => { const o: Json = {}; names.forEach((n, i) => { o[n] = decode(row[i]); }); return o; });
  return {
    success: true,
    results,
    meta: { changes: r.affected_row_count ?? 0, last_row_id: r.last_insert_rowid ? Number(r.last_insert_rowid) : 0, rows_read: r.rows_read ?? 0, rows_written: r.rows_written ?? 0, duration: r.query_duration_ms ?? 0 },
  };
}

export class TursoStatement {
  args: unknown[] = [];
  constructor(readonly db: TursoDb, readonly sql: string) {}
  bind(...args: unknown[]) { const s = new TursoStatement(this.db, this.sql); s.args = args; return s; }
  stmt() { return { sql: this.sql, args: this.args.map(encode) }; }
  async run() { return (await this.db.pipeline([{ type: 'execute', stmt: this.stmt() }]))[0]; }
  async all() { return this.run(); }
  async first(col?: string) { const row = (await this.run()).results[0]; if (!row) return null; return col ? row[col] ?? null : row; }
  async raw() { const r = await this.run(); return r.results.map((o: Json) => Object.values(o)); }
}

export class TursoDb {
  constructor(readonly url: string, readonly token: string) {}
  prepare(sql: string) { return new TursoStatement(this, sql); }
  async exec(sql: string) { await this.pipeline([{ type: 'execute', stmt: { sql, args: [] } }]); return { count: 1, duration: 0 }; }

  private async call(requests: Json[]): Promise<Json[]> {
    const endpoint = this.url.replace(/^libsql:\/\//, 'https://').replace(/\/$/, '') + '/v2/pipeline';
    let lastError = '';
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(endpoint, { method: 'POST', headers: { authorization: `Bearer ${this.token}`, 'content-type': 'application/json' }, body: JSON.stringify({ requests: [...requests, { type: 'close' }] }) });
        if (res.status >= 500 || res.status === 429) { lastError = `HTTP ${res.status}`; await new Promise((r) => setTimeout(r, 200 * (attempt + 1))); continue; }
        const body = await res.json() as Json;
        if (!res.ok) throw new Error(`Turso ${res.status}: ${body.error || JSON.stringify(body).slice(0, 200)}`);
        return body.results;
      } catch (e) {
        if (e instanceof Error && e.message.startsWith('Turso ')) throw e;
        lastError = String(e); await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
      }
    }
    throw new Error(`Turso request failed: ${lastError}`);
  }

  // Run requests; each "execute" request becomes one result.
  async pipeline(requests: Json[]) {
    const out = await this.call(requests);
    return out.slice(0, requests.length).map((r) => {
      if (r.type === 'error') throw new Error(r.error?.message || 'Turso error');
      return toResult(r.response.result);
    });
  }

  // Atomic batch (all statements or none), like D1's batch().
  async batch(statements: TursoStatement[]) {
    if (!statements.length) return [];
    const steps: Json[] = [{ stmt: { sql: 'BEGIN IMMEDIATE', args: [] } }];
    statements.forEach((s, i) => steps.push({ stmt: s.stmt(), condition: { type: 'ok', step: i } }));
    const commit = steps.length;
    steps.push({ stmt: { sql: 'COMMIT', args: [] }, condition: { type: 'ok', step: commit - 1 } });
    steps.push({ stmt: { sql: 'ROLLBACK', args: [] }, condition: { type: 'not', cond: { type: 'ok', step: commit } } });
    const [res] = await this.call([{ type: 'batch', batch: { steps } }]);
    if (res.type === 'error') throw new Error(res.error?.message || 'Turso error');
    const { step_results, step_errors } = res.response.result as Json;
    for (let i = 0; i < step_errors.length; i++) if (step_errors[i]) throw new Error(step_errors[i].message || 'Turso batch error');
    return statements.map((_, i) => toResult(step_results[i + 1]));
  }
}

// Use Turso when credentials are set; otherwise keep the native D1 binding.
export function withTurso<T extends Record<string, any>>(env: T): T {
  const out: Record<string, any> = { ...env };
  if (env.TURSO_DB_URL && env.TURSO_DB_TOKEN) out.DB = new TursoDb(env.TURSO_DB_URL, env.TURSO_DB_TOKEN);
  if (env.TURSO_KB_URL && env.TURSO_KB_TOKEN) out.KB = new TursoDb(env.TURSO_KB_URL, env.TURSO_KB_TOKEN);
  return out as T;
}
