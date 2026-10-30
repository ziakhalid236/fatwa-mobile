import { useState } from "react";
import { Bot } from "lucide-react";
import { post } from "../api";
import { Badge, Btn } from "../ui";

const SAMPLES = ["نماز میں سجدہ سہو کب واجب ہوتا ہے؟", "What is the nisab for zakat?", "Roza mein bhool kar kha lein to kya hukm hai?", "ما حكم الجمع بين الصلاتين في السفر؟"];
export default function AiTester() {
  const [q, setQ] = useState(SAMPLES[0]); const [r, setR] = useState<any>(null); const [busy, setBusy] = useState(false);
  const run = async (m: string) => { setBusy(true); setR(null); try { setR(await post("/admin/ai/test", { message: m })); } catch (e: any) { setR({ error: e.message }); } finally { setBusy(false); } };
  return <>
    <div className="card"><h3>Ask the assistant exactly as a user would</h3>
      <textarea value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="row" style={{ marginTop: 10 }}><Btn tone="primary" disabled={busy || !q} onClick={() => run(q)}><Bot size={14} /> {busy ? "Thinking…" : "Run test"}</Btn>{SAMPLES.map((s) => <Btn key={s} small onClick={() => { setQ(s); run(s); }}>{s.slice(0, 26)}…</Btn>)}</div>
    </div>
    {r && <div style={{ marginTop: 14 }}>{r.error ? <div className="hint" style={{ background: "#fde3df", color: "#a52a1d" }}>{r.error}</div> : <>
      <div className="row" style={{ marginBottom: 8 }}><Badge tone="green">{(r.ms / 1000).toFixed(1)} s</Badge><Badge tone={r.sources?.length ? "green" : "amber"}>{r.sources?.length || 0} sources</Badge></div>
      <div className="chat">{r.answer}</div>
      {r.sources?.length > 0 && <div className="card" style={{ marginTop: 10 }}><h3>Sources used</h3>{r.sources.map((s: any, i: number) => <div key={i} className="meta" style={{ padding: "3px 0" }}>{s.work} — {s.ref} ({s.source})</div>)}</div>}
    </>}</div>}
  </>;
}
