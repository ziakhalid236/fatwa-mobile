import { Activity, AlertTriangle, FileText, Flag, Globe2, Heart, MapPin, MessageSquare, ShieldBan, Smartphone, Users } from "lucide-react";
import { api, ago } from "../api";
import { Bars, Badge, Spinner, Stat, useLoad } from "../ui";

const flag = (code?: string) => code && /^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...[...code].map((c) => 127397 + c.charCodeAt(0))) : "🌐";

function Ranked({ rows, label, value, sub, max }: { rows: any[]; label: (r: any) => string; value: (r: any) => number; sub: (r: any) => string; max: number }) {
  if (!rows.length) return <span className="meta">No data yet.</span>;
  return <div className="ranked">{rows.map((r, i) => <div key={i} className="rk"><div className="rk-top"><span>{label(r)}</span><b>{value(r)}</b></div><div className="rk-bar"><i style={{ width: `${Math.max(3, (value(r) / max) * 100)}%` }} /></div><small>{sub(r)}</small></div>)}</div>;
}

function Traffic() {
  const { data, error } = useLoad(() => api("/admin/traffic"));
  if (error) return <div className="hint">{error}</div>;
  if (!data) return <Spinner />;
  const w = data.windows;
  const maxC = Math.max(1, ...data.byCountry.map((r: any) => r.devices));
  const maxCity = Math.max(1, ...data.byCity.map((r: any) => r.devices));
  const maxUC = Math.max(1, ...data.usersCountry.map((r: any) => r.users));
  const maxUCity = Math.max(1, ...data.usersCity.map((r: any) => r.users));
  return <>
    <h2 className="sec">Traffic</h2>
    <div className="grid g4">
      <Stat label="Active devices · 24h" value={w.day.devices} sub={`${w.day.visits} app opens`} icon={<Activity size={16} />} tone="good" />
      <Stat label="Active devices · 7 days" value={w.week.devices} sub={`${w.week.visits} app opens`} icon={<Smartphone size={16} />} />
      <Stat label="Active devices · 30 days" value={w.month.devices} sub={`${w.month.visits} app opens`} icon={<Smartphone size={16} />} />
      <Stat label="New users · 7 days" value={data.newUsersWeek} icon={<Users size={16} />} />
    </div>
    <div className="grid g2" style={{ marginTop: 14 }}>
      <div className="card"><h3>Active devices per day · 14 days</h3><Bars data={data.series.map((d: any) => ({ date: d.date, count: d.devices }))} /></div>
      <div className="card"><h3>App opens per day · 14 days</h3><Bars data={data.series.map((d: any) => ({ date: d.date, count: d.visits }))} color="#c9a24a" /></div>
      <div className="card"><h3><Globe2 size={15} style={{ verticalAlign: -2 }} /> Traffic by country · 30 days</h3>
        <Ranked rows={data.byCountry} max={maxC} label={(r) => `${flag(r.code)} ${r.country}`} value={(r) => r.devices} sub={(r) => `${r.visits} opens`} /></div>
      <div className="card"><h3><MapPin size={15} style={{ verticalAlign: -2 }} /> Traffic by city · 30 days</h3>
        <Ranked rows={data.byCity} max={maxCity} label={(r) => r.city} value={(r) => r.devices} sub={(r) => `${r.country} · ${r.visits} opens`} /></div>
      <div className="card"><h3>Registered users by country</h3>
        <Ranked rows={data.usersCountry} max={maxUC} label={(r) => r.country} value={(r) => r.users} sub={() => "users"} /></div>
      <div className="card"><h3>Registered users by city</h3>
        <Ranked rows={data.usersCity} max={maxUCity} label={(r) => r.city} value={(r) => r.users} sub={(r) => r.country} /></div>
    </div>
    <div className="grid g2" style={{ marginTop: 14 }}>
      <div className="card"><h3>Platforms · 30 days</h3>
        {data.platforms.length === 0 ? <span className="meta">No data yet.</span> : data.platforms.map((p: any) => <div key={p.platform} className="row sp" style={{ padding: "5px 0" }}><span style={{ textTransform: "capitalize" }}>{p.platform}</span><Badge tone="green">{p.devices} devices</Badge></div>)}</div>
      <div className="card"><h3>Latest opens</h3>
        {data.recent.length === 0 ? <span className="meta">No data yet.</span> : data.recent.map((r: any, i: number) => <div key={i} className="row sp" style={{ padding: "5px 0", borderBottom: "1px solid #eff4f1" }}><span>{r.user || "Guest"} <span className="meta">· {[r.city, r.country].filter(Boolean).join(", ") || "Unknown"}</span></span><span className="meta">{ago(r.at)}</span></div>)}</div>
    </div>
  </>;
}

export default function Dashboard({ go }: { go: (p: string) => void }) {
  const { data, error } = useLoad(() => api("/admin/dashboard"));
  if (error) return <div className="hint">{error}</div>;
  if (!data) return <Spinner />;
  const t = data.totals;
  return <>
    <h2 className="sec">Overview</h2>
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
    <Traffic />
    <div className="card" style={{ marginTop: 14 }}><h3>Recent admin activity</h3>
      {data.recent.length === 0 ? <span className="meta">Nothing yet.</span> : data.recent.map((r: any, i: number) => <div key={i} className="row sp" style={{ padding: "6px 0", borderBottom: "1px solid #eff4f1" }}><span><b>{r.action}</b> · {r.entityType}</span><span className="meta">{ago(r.createdAt)}</span></div>)}
    </div>
  </>;
}
