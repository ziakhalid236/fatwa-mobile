import { useState } from "react";
import { Search } from "lucide-react";
import { api } from "../api";
import { Badge, Btn, Spinner, Stat, useLoad } from "../ui";

export default function Library() {
  const stats = useLoad(() => api("/admin/kb/stats")); const works = useLoad(() => api("/library/works"));
  const [q, setQ] = useState(""); const [hits, setHits] = useState<any>(null);
  if (!stats.data || !works.data) return <Spinner />;
  const s = stats.data;
  return <>
    <div className="grid g4" style={{ marginBottom: 14 }}><Stat label="Books" value={s.works} /><Stat label="Passages" value={Number(s.passages).toLocaleString()} /><Stat label="Scholars" value={s.scholars} /><Stat label="Sources" value={s.sources} /></div>
    <div className="card" style={{ marginBottom: 14 }}><h3>Test library search</h3><div className="row"><input style={{ flex: 1 }} placeholder="e.g. sajdah sahw / سجدہ سہو" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && q && api(`/admin/kb/search?q=${encodeURIComponent(q)}`).then(setHits)} /><Btn tone="primary" onClick={async () => setHits(await api(`/admin/kb/search?q=${encodeURIComponent(q)}`))}><Search size={14} /> Search</Btn></div>
      {hits && <div style={{ marginTop: 12 }}>{(hits.hits || []).length === 0 ? <span className="meta">No results.</span> : hits.hits.map((h: any, i: number) => <div key={i} style={{ padding: "8px 0", borderBottom: "1px solid #eff4f1" }}><b>{h.work}</b> <span className="meta">{h.ref} · {h.author}</span><p style={{ margin: "4px 0", fontSize: 13 }}>{h.snippet || h.text?.slice(0, 220)}</p></div>)}</div>}
    </div>
    <div className="card tw"><h3>Books in the library</h3><table><thead><tr><th>Title</th><th>Author</th><th>Lang</th><th>Passages</th><th>Rights</th><th>Review</th></tr></thead><tbody>
      {(works.data.works as any[]).map((w) => <tr key={w.id}><td><b>{w.title}</b></td><td>{w.author}</td><td>{w.lang}</td><td>{Number(w.passages).toLocaleString()}</td><td><Badge tone={w.rights === "public_domain" ? "green" : "amber"}>{w.rights}</Badge></td><td><Badge tone={w.verification === "verified" ? "green" : "gray"}>{w.verification}</Badge></td></tr>)}
    </tbody></table></div>
  </>;
}
