import { useState } from "react";
import { Bot, Check, ExternalLink, Play, Plus, RefreshCw, X } from "lucide-react";
import { api, ago } from "../api";
import { Badge, Btn, Empty, Spinner, Tabs, useLoad, useToast } from "../ui";

export default function Agent() {
  const [tab, setTab] = useState("drafts");
  const drafts = useLoad(() => api("/admin/agent/drafts?status=needs_review"));
  const sources = useLoad(() => api("/admin/agent/sources"));
  const runs = useLoad(() => api("/admin/agent/runs"));
  const toast = useToast();
  const reload = () => { drafts.reload(); sources.reload(); runs.reload(); };
  if (!drafts.data || !sources.data || !runs.data) return <Spinner />;
  const pending = drafts.data.drafts || [];
  const runNow = async () => { const r = await api("/admin/agent/run", { method: "POST", json: {} }); toast(`Agent finished: ${r.drafts ?? 0} draft(s) created`); reload(); };
  return <>
    <div className="row sp" style={{ marginBottom: 14 }}><Tabs value={tab} onChange={setTab} items={[["drafts", "Review queue", pending.length], ["sources", "Sources", sources.data.sources.length], ["runs", "Runs", runs.data.runs.length]]} /><div className="row"><Btn onClick={runNow}><Play size={14} /> Run now</Btn>{tab === "sources" && <AddSource onDone={reload} />}</div></div>
    {tab === "drafts" && <Drafts rows={pending} reload={reload} />}
    {tab === "sources" && <Sources rows={sources.data.sources} reload={reload} />}
    {tab === "runs" && <Runs rows={runs.data.runs} />}
  </>;
}
function Drafts({ rows, reload }: { rows: any[]; reload: () => void }) {
  const toast = useToast();
  if (!rows.length) return <Empty text="No AI drafts waiting for review." />;
  const act = async (id: string, action: string) => { const note = action === "reject" ? prompt("Reason (optional)", "Not suitable for publication") || "" : ""; const r = await api(`/admin/agent/drafts/${id}`, { method: "PATCH", json: { action, note } }); toast(r.status === "published" ? "Draft published" : "Draft rejected"); reload(); };
  return <>{rows.map((d: any) => <div className="item" key={d.id}><div className="body"><div className="row"><Badge tone="amber">Needs review</Badge><Badge tone="blue">{d.kind}</Badge><Badge tone={Number(d.confidence) >= .75 ? "green" : "amber"}>{Math.round(Number(d.confidence) * 100)}% confidence</Badge><span className="meta">{ago(d.created_at)}</span></div><h3>{d.title || "Untitled draft"}</h3><p style={{ whiteSpace: "pre-wrap" }}>{d.body}</p><div className="meta" style={{ marginTop: 8 }}>Source: <a href={d.source_url} target="_blank" rel="noreferrer">{d.source_name} <ExternalLink size={12} /></a>{d.source_published_at ? ` · published ${new Date(d.source_published_at).toLocaleString()}` : ""}</div>{d.claims_json && JSON.parse(d.claims_json).length > 0 && <div className="hint" style={{ marginTop: 8 }}>Claims checked against source: {JSON.parse(d.claims_json).join(" · ")}</div>}<div className="row" style={{ marginTop: 12 }}><Btn tone="primary" small onClick={() => act(d.id, "approve")}><Check size={14} /> Approve & publish</Btn><Btn tone="danger" small onClick={() => act(d.id, "reject")}><X size={14} /> Reject</Btn></div></div></div>)}</>;
}
function Sources({ rows, reload }: { rows: any[]; reload: () => void }) { return <div className="card tw"><table><thead><tr><th>Source</th><th>Type</th><th>Language</th><th>Status</th><th>Last fetch</th><th /></tr></thead><tbody>{rows.map((s: any) => <tr key={s.id}><td><b>{s.name}</b><br /><span className="meta">{s.url}</span>{s.last_error && <div className="meta" style={{ color: "#c0392b" }}>{s.last_error}</div>}</td><td>{s.kind}</td><td>{s.language}</td><td><Badge tone={s.active ? "green" : "gray"}>{s.active ? "Active" : "Paused"}</Badge></td><td>{s.last_fetched_at ? ago(s.last_fetched_at) : "Never"}</td><td><Btn small onClick={async () => { await api(`/admin/agent/sources/${s.id}`, { method: "PATCH", json: { active: !s.active, kind: s.kind, language: s.language } }); reload(); }}>{s.active ? "Pause" : "Enable"}</Btn></td></tr>)}</tbody></table></div>;
}
function Runs({ rows }: { rows: any[] }) { return <div className="card tw"><table><thead><tr><th>Status</th><th>Started</th><th>Sources</th><th>Fetched</th><th>Drafts</th><th>Skipped</th></tr></thead><tbody>{rows.map((r: any) => <tr key={r.id}><td><Badge tone={r.status === "completed" ? "green" : r.status === "failed" ? "red" : "amber"}>{r.status}</Badge></td><td>{new Date(r.started_at).toLocaleString()}</td><td>{r.source_count}</td><td>{r.fetched_count}</td><td>{r.draft_count}</td><td>{r.skipped_count}</td></tr>)}</tbody></table></div>;
}
function AddSource({ onDone }: { onDone: () => void }) { const [open, setOpen] = useState(false); const [name, setName] = useState(""); const [url, setUrl] = useState(""); const [kind, setKind] = useState("news"); const [language, setLanguage] = useState("en"); if (!open) return <Btn tone="primary" onClick={() => setOpen(true)}><Plus size={14} /> Add source</Btn>; return <div className="card" style={{ position: "absolute", right: 24, top: 72, zIndex: 2, width: 360 }}><h3>Add approved RSS source</h3><input placeholder="Source name" value={name} onChange={e => setName(e.target.value)} /><input placeholder="https://example.com/rss.xml" value={url} onChange={e => setUrl(e.target.value)} /><div className="row"><select value={kind} onChange={e => setKind(e.target.value)}><option>news</option><option>islamic_news</option><option>poetry</option><option>quote</option><option>reflection</option></select><select value={language} onChange={e => setLanguage(e.target.value)}><option value="en">English</option><option value="ur">Urdu</option><option value="ar">Arabic</option></select></div><div className="row" style={{ marginTop: 10 }}><Btn onClick={() => setOpen(false)}>Cancel</Btn><Btn tone="primary" onClick={async () => { await api("/admin/agent/sources", { method: "POST", json: { name, url, kind, language } }); setOpen(false); onDone(); }}>Save source</Btn></div></div>; }
