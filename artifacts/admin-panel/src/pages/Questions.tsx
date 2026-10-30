import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { api, ago, del, patch, post } from "../api";
import { Badge, Btn, Empty, Modal, Spinner, Tabs, useLoad, useToast } from "../ui";

const CATS = ["Aqeedah", "Namaz", "Roza", "Zakat", "Hajj & Umrah", "Nikah & Family", "Muamalat", "Tafseer & Quran"];

export default function Questions() {
  const [tab, setTab] = useState("open"); const [answering, setAnswering] = useState<any>(null); const [editing, setEditing] = useState<any>(null);
  const qs = useLoad(() => api("/admin/questions")); const fs = useLoad(() => api("/admin/fatwas")); const toast = useToast();
  if (!qs.data || !fs.data) return <Spinner />;
  const questions: any[] = qs.data.questions, fatwas: any[] = fs.data.fatwas; const open = questions.filter((q) => q.status !== "answered");
  const reload = () => { qs.reload(); fs.reload(); };
  return <>
    <div className="row sp" style={{ marginBottom: 14 }}><Tabs value={tab} onChange={setTab} items={[["open", "Open questions", open.length], ["answered", "Answered", questions.length - open.length], ["fatwas", "Verified fatwas", fatwas.length]]} /><Btn tone="primary" onClick={() => setEditing({})}><Plus size={14} /> Add fatwa</Btn></div>
    {tab !== "fatwas" && ((tab === "open" ? open : questions.filter((q) => q.status === "answered")).length === 0 ? <Empty text="Nothing here." /> : (tab === "open" ? open : questions.filter((q) => q.status === "answered")).map((q) => <div className="item" key={q.id}><div className="body">
      <div className="row"><b>{q.name}</b><Badge tone="blue">{q.category}</Badge><span className="meta">{[q.city, q.country].filter(Boolean).join(", ")} · {ago(q.createdAt)}</span></div>
      <p>{q.question}</p>{q.answer && <p style={{ background: "#eef7f2", padding: 10, borderRadius: 10 }}>{q.answer}</p>}
      <Btn tone="primary" small onClick={() => setAnswering(q)}>{q.answer ? "Edit answer" : "Answer"}</Btn></div></div>))}
    {tab === "fatwas" && (fatwas.length === 0 ? <Empty text="No fatwas yet." /> : fatwas.map((f) => <div className="item" key={f.id}><div className="body">
      <div className="row"><Badge tone="blue">{f.category}</Badge><Badge tone={f.status === "published" ? "green" : "gray"}>{f.status}</Badge><span className="meta">{f.scholar} · {f.institution}</span></div>
      <h4>{f.question}</h4><p>{f.answer.slice(0, 300)}{f.answer.length > 300 ? "…" : ""}</p>
      <div className="row"><Btn small onClick={() => setEditing(f)}>Edit</Btn><Btn small onClick={async () => { await patch(`/admin/fatwas/${f.id}`, { status: f.status === "published" ? "draft" : "published" }); reload(); }}>{f.status === "published" ? "Unpublish" : "Publish"}</Btn><Btn tone="danger" small onClick={async () => { if (confirm("Delete fatwa?")) { await del(`/admin/fatwas/${f.id}`); reload(); } }}><Trash2 size={13} /></Btn></div></div></div>))}
    {answering && <Answer q={answering} onClose={() => setAnswering(null)} onDone={() => { setAnswering(null); toast("Answer published"); reload(); }} />}
    {editing && <FatwaForm f={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); reload(); }} />}
  </>;
}
function Answer({ q, onClose, onDone }: any) {
  const [a, setA] = useState(q.answer || "");
  return <Modal wide title="Answer question" onClose={onClose}><p style={{ whiteSpace: "pre-wrap" }}>{q.question}</p><textarea style={{ minHeight: 180 }} value={a} onChange={(e) => setA(e.target.value)} /><div className="row" style={{ marginTop: 12, justifyContent: "flex-end" }}><Btn onClick={onClose}>Cancel</Btn><Btn tone="primary" onClick={async () => { await patch(`/admin/questions/${q.id}/answer`, { answer: a }); onDone(); }}>Publish answer</Btn></div></Modal>;
}
function FatwaForm({ f, onClose, onDone }: any) {
  const [s, setS] = useState({ question: f.question || "", answer: f.answer || "", category: f.category || CATS[0], scholar: f.scholar || "", institution: f.institution || "", sourceUrl: f.sourceUrl || "", status: f.status || "published" });
  return <Modal wide title={f.id ? "Edit fatwa" : "Add fatwa"} onClose={onClose}>
    <label>Question</label><textarea value={s.question} onChange={(e) => setS({ ...s, question: e.target.value })} /><label>Answer</label><textarea style={{ minHeight: 160 }} value={s.answer} onChange={(e) => setS({ ...s, answer: e.target.value })} />
    <div className="row"><div className="grow"><label>Category</label><select value={s.category} onChange={(e) => setS({ ...s, category: e.target.value })}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></div><div className="grow"><label>Scholar</label><input value={s.scholar} onChange={(e) => setS({ ...s, scholar: e.target.value })} /></div><div className="grow"><label>Institution</label><input value={s.institution} onChange={(e) => setS({ ...s, institution: e.target.value })} /></div></div>
    <label>Source URL</label><input value={s.sourceUrl} onChange={(e) => setS({ ...s, sourceUrl: e.target.value })} />
    <div className="row" style={{ marginTop: 14, justifyContent: "flex-end" }}><Btn onClick={onClose}>Cancel</Btn><Btn tone="primary" onClick={async () => { if (f.id) await patch(`/admin/fatwas/${f.id}`, s); else await post("/admin/fatwas", s); onDone(); }}>Save</Btn></div>
  </Modal>;
}
