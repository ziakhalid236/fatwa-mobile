import { AlertTriangle, FileText, Flag, Heart, MessageSquare, ShieldBan, Users } from "lucide-react";
import { api, ago } from "../api";
import { Bars, Badge, Spinner, Stat, useLoad } from "../ui";

export default function Dashboard({ go }: { go: (p: string) => void }) {
  const { data, error } = useLoad(() => api("/admin/dashboard"));
  if (error) return <div className="hint">{error}</div>;
  if (!data) return <Spinner />;
  const t = data.totals;
  return <>
    <div className="grid g4">
      <Stat label="Users" value={t.users} sub={`${t.bannedUsers} suspended`} icon={<Users size={16} />} />
      <Stat label="Live posts" value={t.livePosts} sub={`${t.likes} likes in total`} tone="good" icon={<FileText size={16} />} />
      <div onClick={() => go("posts")} style={{ cursor: "pointer" }}><Stat label="Awaiting approval" value={t.pendingPosts} sub={`${t.rejectedPosts} rejected`} tone={t.pendingPosts ? "warn" : ""} icon={<AlertTriangle size={16} />} /></div>
      <div onClick={() => go("reports")} style={{ cursor: "pointer" }}><Stat label="New reports" value={t.newReports} sub={`${t.reports} total`} tone={t.newReports ? "bad" : ""} icon={<Flag size={16} />} /></div>
      <Stat label="Open questions" value={t.openQuestions} icon={<MessageSquare size={16} />} />
      <Stat label="Verified fatwas" value={t.fatwas} icon={<ShieldBan size={16} />} />
      <Stat label="AI chats (logged)" value={t.aiChats} icon={<Heart size={16} />} />
    </div>
    <div className="grid g2" style={{ marginTop: 14 }}>
      <div className="card"><h3>New users · 14 days</h3><Bars data={data.series.users} /></div>
      <div className="card"><h3>Posts submitted · 14 days</h3><Bars data={data.series.posts} color="#c9a24a" /></div>
      <div className="card"><h3>Reports · 14 days</h3><Bars data={data.series.reports} color="#c0392b" /></div>
      <div className="card"><h3>Live posts by category</h3>
        {data.categories.length === 0 ? <span className="meta">No live posts yet.</span> : data.categories.map((c: any) => <div key={c.category} className="row sp" style={{ padding: "5px 0" }}><span>{c.category || "—"}</span><Badge tone="green">{c.c}</Badge></div>)}
      </div>
    </div>
    <div className="card" style={{ marginTop: 14 }}><h3>Recent admin activity</h3>
      {data.recent.length === 0 ? <span className="meta">Nothing yet.</span> : data.recent.map((r: any, i: number) => <div key={i} className="row sp" style={{ padding: "6px 0", borderBottom: "1px solid #eff4f1" }}><span><b>{r.action}</b> · {r.entityType}</span><span className="meta">{ago(r.createdAt)}</span></div>)}
    </div>
  </>;
}
