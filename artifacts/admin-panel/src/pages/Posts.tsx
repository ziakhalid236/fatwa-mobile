import { useState } from "react";
import { Check, Pin, Plus, Send, Trash2, X } from "lucide-react";
import { api, ago, del, patch, post } from "../api";
import { Badge, Btn, Empty, Modal, Spinner, Tabs, useLoad, useToast } from "../ui";

const CATS = ["Aqeedah", "Namaz", "Roza", "Zakat", "Hajj & Umrah", "Nikah & Family", "Muamalat", "Tafseer & Quran"];
const Avatar = ({ src, name }: { src?: string; name?: string }) => src ? <img className="avatar" src={src} /> : <div className="avatar">{(name || "?")[0]}</div>;

export default function Posts() {
  const [tab, setTab] = useState("pending");
  const [creating, setCreating] = useState(false);
  const [rejecting, setRejecting] = useState<any>(null);
  const subs = useLoad(() => api("/admin/post-submissions"));
  const live = useLoad(() => api("/admin/posts"));
  const toast = useToast();
  const reloadAll = () => { subs.reload(); live.reload(); };
  if (!subs.data || !live.data) return <Spinner />;
  const all: any[] = subs.data.submissions, posts: any[] = live.data.posts;
  const pending = all.filter((s) => s.status === "pending"), rejected = all.filter((s) => s.status === "rejected");
  const approve = async (s: any, notify: string) => { const r = await patch(`/admin/post-submissions/${s.id}`, { action: "approve", notify: notify || undefined }); toast(r.broadcast?.notified ? `Approved · ${r.broadcast.notified} users notified` : "Approved and live"); reloadAll(); };

  return <>
    <div className="row sp" style={{ marginBottom: 14 }}>
      <Tabs value={tab} onChange={setTab} items={[["pending", "Pending", pending.length], ["live", "Live", posts.length], ["rejected", "Rejected", rejected.length]]} />
      <div className="row"><Btn onClick={async () => { const r = await post("/admin/purge-expired"); toast(`Expired posts removed: ${r.posts ?? 0}`); reloadAll(); }}>Purge expired</Btn><Btn tone="primary" onClick={() => setCreating(true)}><Plus size={15} /> New post</Btn></div>
    </div>
    {tab === "pending" && (pending.length === 0 ? <Empty text="No posts waiting. All caught up." /> : pending.map((s) => <Pending key={s.id} s={s} onApprove={approve} onReject={() => setRejecting(s)} onDelete={async () => { if (confirm("Delete this submission?")) { await del(`/admin/post-submissions/${s.id}`); reloadAll(); } }} />))}
    {tab === "live" && (posts.length === 0 ? <Empty text="No live posts." /> : posts.map((p) => <Live key={p.id} p={p} reload={reloadAll} />))}
    {tab === "rejected" && (rejected.length === 0 ? <Empty text="No rejected posts." /> : rejected.map((s) => <div className="item" key={s.id}><Avatar src={s.authorImageUrl} name={s.name} /><div className="body"><div className="row"><b>{s.name}</b><Badge tone="red">Rejected</Badge><span className="meta">{ago(s.createdAt)}</span></div><p>{s.body}</p><span className="meta">Reason: {s.rejectionReason}</span></div><Btn tone="danger" small onClick={async () => { await del(`/admin/post-submissions/${s.id}`); reloadAll(); }}><Trash2 size={13} /></Btn></div>))}
    {creating && <Create onClose={() => setCreating(false)} onDone={() => { setCreating(false); reloadAll(); }} />}
    {rejecting && <Reject s={rejecting} onClose={() => setRejecting(null)} onDone={() => { setRejecting(null); reloadAll(); }} />}
  </>;
}

function Pending({ s, onApprove, onReject, onDelete }: any) {
  const [notify, setNotify] = useState("");
  return <div className="item">
    <Avatar src={s.authorImageUrl} name={s.name} />
    <div className="body">
      <div className="row"><b>{s.name}</b><span className="meta">{[s.city, s.country].filter(Boolean).join(", ")} · {ago(s.createdAt)}</span><Badge tone="amber">Pending</Badge></div>
      {s.title && <h4>{s.title}</h4>}<p>{s.body}</p>
      {s.imageUrl && <img className="thumb" style={{ width: "min(100%,360px)", height: "auto" }} src={s.imageUrl} />}
      <div className="row" style={{ marginTop: 10 }}>
        <select style={{ width: 190 }} value={notify} onChange={(e) => setNotify(e.target.value)}><option value="">No notification</option><option value="all">Notify all users</option><option value="country">Notify same country</option><option value="city">Notify same city</option></select>
        <Btn tone="primary" small onClick={() => onApprove(s, notify)}><Check size={14} /> Approve</Btn>
        <Btn tone="warn" small onClick={onReject}><X size={14} /> Reject</Btn>
        <Btn tone="danger" small onClick={onDelete}><Trash2 size={14} /></Btn>
      </div>
    </div>
  </div>;
}

function Live({ p, reload }: { p: any; reload: () => void }) {
  const toast = useToast();
  return <div className="item">
    <Avatar src={p.authorImageUrl} name={p.author} />
    <div className="body">
      <div className="row"><b>{p.author}</b><span className="meta">{[p.city, p.country].filter(Boolean).join(", ")} · {ago(p.createdAt)}</span>{p.featured && <Badge tone="blue">Pinned</Badge>}<Badge tone="green">{p.likes} likes</Badge><span className="meta">expires {new Date(p.expiresAt).toLocaleDateString()}</span></div>
      {p.title && <h4>{p.title}</h4>}<p>{p.body}</p>
      {p.imageUrl && <img className="thumb" style={{ width: "min(100%,360px)", height: "auto" }} src={p.imageUrl} />}
      <div className="row" style={{ marginTop: 10 }}>
        <Btn small onClick={async () => { await patch(`/admin/posts/${p.id}`, { action: p.featured ? "unpin" : "pin" }); reload(); }}><Pin size={13} /> {p.featured ? "Unpin" : "Pin"}</Btn>
        <Btn small onClick={async () => { const scope = prompt("Send a notification to: all / country / city", "all"); if (!scope) return; const r = await post(`/admin/posts/${p.id}/notify`, { scope, force: true }); toast(`Notified ${r.notified ?? 0} users`); }}><Send size={13} /> Notify</Btn>
        <Btn tone="danger" small onClick={async () => { if (!confirm("Delete this live post for everyone?")) return; await del(`/admin/posts/${p.id}`); toast("Post deleted"); reload(); }}><Trash2 size={13} /> Delete</Btn>
      </div>
    </div>
  </div>;
}

function Reject({ s, onClose, onDone }: any) {
  const [reason, setReason] = useState("This post does not follow the community guidelines.");
  return <Modal title="Reject post" onClose={onClose}><p className="meta">The author is notified with this reason.</p><textarea value={reason} onChange={(e) => setReason(e.target.value)} /><div className="row" style={{ marginTop: 14, justifyContent: "flex-end" }}><Btn onClick={onClose}>Cancel</Btn><Btn tone="danger" onClick={async () => { await patch(`/admin/post-submissions/${s.id}`, { action: "reject", reason }); onDone(); }}>Reject</Btn></div></Modal>;
}

function Create({ onClose, onDone }: any) {
  const [f, setF] = useState({ author: "Fatwa team", city: "", category: "Aqeedah", title: "", body: "" });
  const [file, setFile] = useState<File | null>(null); const toast = useToast();
  return <Modal title="Publish a post" onClose={onClose}>
    <label>Author</label><input value={f.author} onChange={(e) => setF({ ...f, author: e.target.value })} />
    <label>Title (optional)</label><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
    <label>Text</label><textarea value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
    <div className="row"><div className="grow"><label>Category</label><select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></div><div className="grow"><label>City</label><input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></div></div>
    <label>Image (optional)</label><input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
    <div className="row" style={{ marginTop: 16, justifyContent: "flex-end" }}><Btn onClick={onClose}>Cancel</Btn><Btn tone="primary" onClick={async () => { const fd = new FormData(); Object.entries(f).forEach(([k, v]) => fd.append(k, v)); if (file) fd.append("image", file); await api("/admin/posts", { method: "POST", form: fd }); toast("Published"); onDone(); }}>Publish now</Btn></div>
  </Modal>;
}
