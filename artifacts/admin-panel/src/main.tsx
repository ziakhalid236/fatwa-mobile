import { useEffect, useMemo, useState } from "react";
import { BookOpen, CheckCircle2, ClipboardList, ExternalLink, LayoutDashboard, LogOut, MessageSquare, Plus, Send, Trash2, type LucideIcon } from "lucide-react";
import "./styles.css";

type Category = "Aqeedah" | "Namaz" | "Roza" | "Zakat" | "Hajj & Umrah" | "Nikah & Family" | "Muamalat" | "Tafseer & Quran";
type Fatwa = { id: string; title: string; question: string; answer: string; category: Category; scholar: string; institution: string; sourceUrl: string; status: "published" | "draft"; };
type Question = { id: string; name: string; city?: string; question: string; category: Category; status: "submitted" | "under_review" | "answered"; answer?: string; answeredBy?: string; };
type Stats = { publishedFatwas: number; draftFatwas: number; submittedQuestions: number; answeredQuestions: number };

const categories: Category[] = ["Aqeedah", "Namaz", "Roza", "Zakat", "Hajj & Umrah", "Nikah & Family", "Muamalat", "Tafseer & Quran"];
const API = import.meta.env.VITE_API_URL ?? "";
const metricDefinitions: Array<[string, keyof Stats, LucideIcon]> = [["Published fatwas", "publishedFatwas", BookOpen], ["Drafts", "draftFatwas", ClipboardList], ["Pending questions", "submittedQuestions", MessageSquare], ["Answered", "answeredQuestions", CheckCircle2]];

async function request<T>(path: string, options: RequestInit = {}, token = "") {
  const response = await fetch(`${API}/api${path}`, { ...options, headers: { "Content-Type": "application/json", ...(token ? { "x-admin-token": token } : {}), ...(options.headers ?? {}) } });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? `Request failed (${response.status})`);
  return response.status === 204 ? undefined as T : await response.json() as T;
}

function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem("fatwa-admin-token") ?? import.meta.env.VITE_ADMIN_TOKEN ?? "");
  const [stats, setStats] = useState<Stats | null>(null);
  const [fatwas, setFatwas] = useState<Fatwa[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [tab, setTab] = useState<"overview" | "fatwas" | "questions">("overview");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    try {
      setError("");
      const [nextStats, nextFatwas, nextQuestions] = await Promise.all([
        request<Stats>("/admin/stats", {}, token),
        request<{ fatwas: Fatwa[] }>("/admin/fatwas", {}, token),
        request<{ questions: Question[] }>("/admin/questions", {}, token),
      ]);
      setStats(nextStats); setFatwas(nextFatwas.fatwas); setQuestions(nextQuestions.questions);
      sessionStorage.setItem("fatwa-admin-token", token);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to load dashboard"); }
  };

  useEffect(() => { void load(); }, []);
  const pendingQuestions = useMemo(() => questions.filter((item) => item.status !== "answered"), [questions]);

  if (!stats && error) return <main className="login-shell"><div className="login-card"><div className="logo-mark">F</div><h1>Fatwa Admin</h1><p>Enter the admin token configured on the API server.</p><input value={token} onChange={(event) => setToken(event.target.value)} placeholder="ADMIN_TOKEN" type="password" /><button onClick={() => void load()}>Sign in</button><small>{error}</small></div></main>;

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="logo-mark">F</div><div><strong>Fatwa</strong><span>Admin workspace</span></div></div>
      <nav>
        <button className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}><LayoutDashboard size={18} /> Overview</button>
        <button className={tab === "fatwas" ? "active" : ""} onClick={() => setTab("fatwas")}><BookOpen size={18} /> Fatwas <b>{fatwas.length}</b></button>
        <button className={tab === "questions" ? "active" : ""} onClick={() => setTab("questions")}><MessageSquare size={18} /> Questions <b>{pendingQuestions.length}</b></button>
      </nav>
      <button className="logout" onClick={() => { sessionStorage.removeItem("fatwa-admin-token"); setToken(""); setStats(null); setError("Signed out"); }}><LogOut size={17} /> Sign out</button>
    </aside>
    <main className="main-content">
      <header><div><p className="eyebrow">CONTENT CONTROL</p><h1>{tab === "overview" ? "Good morning, editor" : tab === "fatwas" ? "Fatwa library" : "Questions inbox"}</h1><p className="subtitle">Review, publish and maintain traceable scholarly guidance.</p></div><button className="primary" onClick={() => setShowForm(true)}><Plus size={17} /> Add fatwa</button></header>
      {error && <div className="alert error">{error}</div>}{notice && <div className="alert success"><CheckCircle2 size={17} />{notice}</div>}
      {tab === "overview" && <><section className="metric-grid">{metricDefinitions.map(([label, key, Icon]) => <div className="metric" key={label}><div className="metric-icon"><Icon size={19} /></div><span>{label}</span><strong>{stats?.[key] ?? 0}</strong></div>)}</section><div className="content-grid"><section className="panel"><div className="panel-heading"><div><h2>Latest published guidance</h2><p>Every record keeps its institutional source.</p></div><button className="text-button" onClick={() => setTab("fatwas")}>View library</button></div>{fatwas.slice(0, 4).map((fatwa) => <FatwaRow key={fatwa.id} fatwa={fatwa} onDelete={async () => { await request(`/admin/fatwas/${fatwa.id}`, { method: "DELETE" }, token); await load(); }} />)}</section><section className="panel"><div className="panel-heading"><div><h2>Needs a response</h2><p>Answer users from the admin workspace.</p></div><button className="text-button" onClick={() => setTab("questions")}>Open inbox</button></div>{pendingQuestions.slice(0, 4).map((question) => <QuestionRow key={question.id} question={question} token={token} afterSave={async () => { await load(); setNotice("Question answered and published to the user timeline."); }} />)}{pendingQuestions.length === 0 && <div className="empty">No pending questions.</div>}</section></div></>}
      {tab === "fatwas" && <section className="panel"><div className="panel-heading"><div><h2>All fatwas</h2><p>Published answers are visible in the mobile app.</p></div></div>{fatwas.map((fatwa) => <FatwaRow key={fatwa.id} fatwa={fatwa} onDelete={async () => { await request(`/admin/fatwas/${fatwa.id}`, { method: "DELETE" }, token); await load(); setNotice("Fatwa deleted."); }} />)}</section>}
      {tab === "questions" && <section className="panel"><div className="panel-heading"><div><h2>User questions</h2><p>Write a reviewed answer and it will be visible to the user.</p></div></div>{questions.map((question) => <QuestionRow key={question.id} question={question} token={token} afterSave={async () => { await load(); setNotice("Question answered and published to the user timeline."); }} />)}</section>}
    </main>
    {showForm && <FatwaForm token={token} onClose={() => setShowForm(false)} onSaved={async () => { setShowForm(false); await load(); setNotice("Fatwa published successfully."); }} />}
  </div>;
}

function FatwaRow({ fatwa, onDelete }: { fatwa: Fatwa; onDelete: () => Promise<void> }) { return <article className="row"><div className="row-icon"><BookOpen size={17} /></div><div className="row-main"><div className="row-meta"><span className="tag">{fatwa.category}</span><span>{fatwa.status}</span></div><h3>{fatwa.title}</h3><p>{fatwa.institution} · {fatwa.scholar}</p></div><a href={fatwa.sourceUrl} target="_blank" rel="noreferrer" className="icon-button" title="Open source"><ExternalLink size={16} /></a><button className="icon-button danger" onClick={() => void onDelete()} title="Delete"><Trash2 size={16} /></button></article>; }

function QuestionRow({ question, token, afterSave }: { question: Question; token: string; afterSave: () => Promise<void> }) { const [answer, setAnswer] = useState(question.answer ?? ""); const [answeredBy, setAnsweredBy] = useState(question.answeredBy ?? ""); const [busy, setBusy] = useState(false); const submit = async () => { setBusy(true); try { await request(`/admin/questions/${question.id}/answer`, { method: "PATCH", body: JSON.stringify({ answer, answeredBy }) }, token); await afterSave(); } finally { setBusy(false); } }; return <article className="question-card"><div className="row-meta"><span className="tag">{question.category}</span><span className={`status ${question.status}`}>{question.status.replace("_", " ")}</span></div><h3>{question.question}</h3><p className="questioner">Asked by {question.name}{question.city ? ` · ${question.city}` : ""}</p>{question.status !== "answered" ? <div className="answer-form"><textarea value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Write the reviewed answer..." /><div className="answer-footer"><input value={answeredBy} onChange={(event) => setAnsweredBy(event.target.value)} placeholder="Scholar / institution name" /><button className="primary small" disabled={busy || answer.length < 10 || answeredBy.length < 2} onClick={() => void submit()}><Send size={15} /> {busy ? "Saving..." : "Publish answer"}</button></div></div> : <div className="published-answer"><strong>{question.answeredBy}</strong><p>{question.answer}</p></div>}</article>; }

function FatwaForm({ token, onClose, onSaved }: { token: string; onClose: () => void; onSaved: () => Promise<void> }) { const [form, setForm] = useState({ title: "", question: "", answer: "", category: "Namaz" as Category, scholar: "", institution: "", sourceUrl: "", sourceQuestionId: "" }); const update = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value })); const save = async () => { await request("/admin/fatwas", { method: "POST", body: JSON.stringify(form) }, token); await onSaved(); }; return <div className="modal-backdrop"><div className="modal"><div className="modal-header"><div><p className="eyebrow">NEW RECORD</p><h2>Add a published fatwa</h2></div><button className="icon-button" onClick={onClose}>×</button></div><div className="form-grid"><label>Title<input value={form.title} onChange={(e) => update("title", e.target.value)} /></label><label>Category<select value={form.category} onChange={(e) => update("category", e.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label><label className="wide">Question<textarea value={form.question} onChange={(e) => update("question", e.target.value)} /></label><label className="wide">Answer<textarea value={form.answer} onChange={(e) => update("answer", e.target.value)} /></label><label>Scholar / responder<input value={form.scholar} onChange={(e) => update("scholar", e.target.value)} /></label><label>Institution<input value={form.institution} onChange={(e) => update("institution", e.target.value)} /></label><label className="wide">Source URL<input value={form.sourceUrl} onChange={(e) => update("sourceUrl", e.target.value)} placeholder="https://..." /></label><label>Source question ID<input value={form.sourceQuestionId} onChange={(e) => update("sourceQuestionId", e.target.value)} /></label></div><div className="modal-footer"><p>Keep a source URL and attribution for every imported answer.</p><button className="primary" disabled={!form.title || !form.answer || !form.sourceUrl} onClick={() => void save()}><CheckCircle2 size={16} /> Publish fatwa</button></div></div></div>; }

import { createRoot } from "react-dom/client";
createRoot(document.getElementById("root")!).render(<App />);
