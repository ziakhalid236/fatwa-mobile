import { useEffect, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { Bell, BookOpen, Bot, FileText, Flag, History, LayoutDashboard, LogOut, MessageSquare, Users as UsersIcon } from "lucide-react";
import "./app.css";
import { api, getToken, setToken } from "./api";
import { Btn, ToastHost } from "./ui";
import Dashboard from "./pages/Dashboard";
import Posts from "./pages/Posts";
import Users from "./pages/Users";
import Reports from "./pages/Reports";
import Questions from "./pages/Questions";
import Notifications from "./pages/Notifications";
import Library from "./pages/Library";
import AiTester from "./pages/AiTester";
import Activity from "./pages/Activity";

const PAGES: [string, string, string, ReactNode][] = [
  ["dashboard", "Dashboard", "Live overview of the whole app", <LayoutDashboard size={17} />],
  ["posts", "Posts", "Approve, publish, pin and delete community posts", <FileText size={17} />],
  ["users", "Users", "Accounts, suspensions and deletions", <UsersIcon size={17} />],
  ["reports", "Reports", "Problems sent by users, with screenshots", <Flag size={17} />],
  ["questions", "Questions & Fatwas", "Answer questions and manage verified fatwas", <MessageSquare size={17} />],
  ["notifications", "Notifications", "Announcements to your users", <Bell size={17} />],
  ["library", "Library", "Books, passages and search testing", <BookOpen size={17} />],
  ["ai", "AI tester", "Check the assistant's answers", <Bot size={17} />],
  ["activity", "Activity log", "Everything admins changed", <History size={17} />],
];

function Login({ onDone }: { onDone: () => void }) {
  const [t, setT] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const go = async () => { setBusy(true); setToken(t.trim()); try { await api("/admin/stats"); onDone(); } catch (e: any) { setToken(""); setErr(e.status === 401 ? "Wrong admin token." : e.message); } finally { setBusy(false); } };
  return <div className="login"><div className="card"><img src="/fatwa-icon.png" /><h2 style={{ margin: "0 0 4px" }}>Fatwa Control Room</h2><p className="meta">Enter the admin token to continue.</p>
    <input type="password" autoFocus placeholder="Admin token" value={t} onChange={(e) => setT(e.target.value)} onKeyDown={(e) => e.key === "Enter" && t && go()} />
    {err && <p style={{ color: "#c0392b", fontSize: 13 }}>{err}</p>}<div style={{ marginTop: 14 }}><button className="btn primary" disabled={!t || busy} onClick={go}>{busy ? "Checking…" : "Sign in"}</button></div></div></div>;
}

function App() {
  const [authed, setAuthed] = useState(Boolean(getToken())); const [page, setPage] = useState(() => location.hash.slice(1) || "dashboard");
  const [badge, setBadge] = useState<{ posts: number; reports: number }>({ posts: 0, reports: 0 });
  useEffect(() => { const h = () => setPage(location.hash.slice(1) || "dashboard"); window.addEventListener("hashchange", h); return () => window.removeEventListener("hashchange", h); }, []);
  useEffect(() => { if (!authed) return; const load = () => api("/admin/dashboard").then((d) => setBadge({ posts: d.totals.pendingPosts, reports: d.totals.newReports })).catch((e) => e.status === 401 && (setToken(""), setAuthed(false))); load(); const i = setInterval(load, 30000); return () => clearInterval(i); }, [authed, page]);
  if (!authed) return <Login onDone={() => setAuthed(true)} />;
  const go = (p: string) => { location.hash = p; setPage(p); };
  const cur = PAGES.find((p) => p[0] === page) ?? PAGES[0];
  const body = { dashboard: <Dashboard go={go} />, posts: <Posts />, users: <Users />, reports: <Reports />, questions: <Questions />, notifications: <Notifications />, library: <Library />, ai: <AiTester />, activity: <Activity /> }[cur[0]];
  return <ToastHost><div className="shell">
    <aside className="side"><div className="brand"><img src="/fatwa-icon.png" /><div>Fatwa<small>Control Room</small></div></div>
      {PAGES.map(([k, label, , icon]) => <button key={k} className={`nav ${cur[0] === k ? "on" : ""}`} onClick={() => go(k)}>{icon}{label}{k === "posts" && badge.posts > 0 && <span className="pill">{badge.posts}</span>}{k === "reports" && badge.reports > 0 && <span className="pill">{badge.reports}</span>}</button>)}
      <div className="grow" /><button className="nav" onClick={() => { setToken(""); setAuthed(false); }}><LogOut size={17} />Sign out</button></aside>
    <main className="main"><div className="head"><div><h1>{cur[1]}</h1><p>{cur[2]}</p></div></div>{body}</main>
  </div></ToastHost>;
}
createRoot(document.getElementById("root")!).render(<App />);
