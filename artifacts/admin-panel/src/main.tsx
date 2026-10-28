import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  UserRound,
  Plus,
  Pin,
  Send,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import "./styles.css";
import "./brand.css";

type Category =
  | "Aqeedah"
  | "Namaz"
  | "Roza"
  | "Zakat"
  | "Hajj & Umrah"
  | "Nikah & Family"
  | "Muamalat"
  | "Tafseer & Quran";

type Fatwa = {
  id: string;
  title?: string;
  question: string;
  answer: string;
  category: Category;
  scholar: string;
  institution: string;
  sourceUrl?: string | null;
  status: "published" | "draft";
};

type Question = {
  id: string;
  name: string;
  gender?: "male" | "female" | "unspecified";
  country?: string;
  city?: string;
  question: string;
  category: Category;
  status: "submitted" | "under_review" | "answered";
  answer?: string;
  answeredBy?: string;
};

type PostSubmission = {
  id: string;
  name: string;
  country?: string;
  city?: string;
  title: string;
  body: string;
  category?: string;
  language: "en" | "ur" | "ar";
  imageUrl?: string;
  status: "pending" | "approved" | "rejected";
  rejectionReason?: string;
  createdAt: string;
};

type PublishedPost = {
  id: string;
  title: string;
  body: string;
  category: string;
  city?: string;
  author: string;
  authorImageUrl?: string;
  imageUrl?: string;
  featured: boolean;
  status: string;
  createdAt: string;
};

type AgentCandidate = {
  id: string;
  source_url: string;
  institution: string;
  category?: string | null;
  scholar?: string;
  question?: string;
  answer?: string;
  urdu_draft?: string;
  source_title?: string;
  confidence: number;
  status: "draft" | "needs_review" | "approved" | "rejected";
  model?: string;
  reasons?: string[] | string;
  created_at: string;
};

type AgentStatus = {
  enabled: boolean;
  mode?: string;
  lastRun?: { started_at?: string; finished_at?: string; status?: string; processed?: number; errors?: number | string[] | Record<string, unknown>[]; message?: string } | null;
  candidates: AgentCandidate[];
  sources?: Array<{ status: string; count: number }>;
};

type Stats = {
  publishedFatwas: number;
  draftPosts: number;
  pendingQuestions: number;
  answeredQuestions: number;
  maleQuestions?: number;
  femaleQuestions?: number;
};

type QuestionFilter = "all" | "male" | "female" | "pending" | "answered";

const categories: Category[] = [
  "Aqeedah",
  "Namaz",
  "Roza",
  "Zakat",
  "Hajj & Umrah",
  "Nikah & Family",
  "Muamalat",
  "Tafseer & Quran",
];

const API = (import.meta.env.VITE_API_URL ?? "https://fatwa-api.ziakhalid236.workers.dev").replace(/\/$/, "");
const metricDefinitions: Array<[string, keyof Stats, LucideIcon]> = [
  ["Published fatwas", "publishedFatwas", BookOpen],
  ["Draft posts", "draftPosts", ClipboardList],
  ["Pending questions", "pendingQuestions", MessageSquare],
  ["Answered questions", "answeredQuestions", CheckCircle2],
  ["Male questions", "maleQuestions", UserRound],
  ["Female questions", "femaleQuestions", UserRound],
];

async function request<T>(path: string, options: RequestInit = {}, token = "") {
  const response = await fetch(`${API}/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "x-admin-token": token } : {}),
      ...(options.headers ?? {}),
    },
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? `Request failed (${response.status})`);
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

function App() {
  const [token, setToken] = useState(
    () => sessionStorage.getItem("fatwa-admin-token") ?? import.meta.env.VITE_ADMIN_TOKEN ?? "",
  );
  const [stats, setStats] = useState<Stats | null>(null);
  const [fatwas, setFatwas] = useState<Fatwa[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [tab, setTab] = useState<"overview" | "fatwas" | "questions" | "submissions" | "posts" | "agent">("overview");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState<PostSubmission[]>([]);
  const [posts, setPosts] = useState<PublishedPost[]>([]);
  const [questionFilter, setQuestionFilter] = useState<QuestionFilter>("all");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const nextStats = await request<Stats>("/admin/stats", {}, token);
      setStats(nextStats);
      const [fatwaResult, questionResult, submissionResult, postsResult] = await Promise.allSettled([
        request<{ fatwas: Fatwa[] }>("/admin/fatwas", {}, token),
        request<{ questions: Question[] }>("/admin/questions", {}, token),
        request<{ submissions: PostSubmission[] }>("/admin/post-submissions", {}, token),
        request<{ posts: PublishedPost[] }>("/admin/posts", {}, token),
      ]);
      if (fatwaResult.status === "fulfilled") setFatwas(fatwaResult.value.fatwas);
      if (questionResult.status === "fulfilled") setQuestions(questionResult.value.questions);
      if (submissionResult.status === "fulfilled") setSubmissions(submissionResult.value.submissions);
      if (postsResult.status === "fulfilled") setPosts(postsResult.value.posts);
      sessionStorage.setItem("fatwa-admin-token", token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingQuestions = useMemo(
    () => questions.filter((item) => item.status !== "answered"),
    [questions],
  );
  const visibleQuestions = useMemo(() => questions.filter((item) => {
    if (questionFilter === "male" || questionFilter === "female") return item.gender === questionFilter;
    if (questionFilter === "pending") return item.status !== "answered";
    if (questionFilter === "answered") return item.status === "answered";
    return true;
  }), [questionFilter, questions]);

  if (!stats && !error && loading) {
    return (
      <main className="login-shell">
        <div className="login-card loading-card">
          <img className="logo-image" src="/fatwa-icon.png" alt="Fatwa logo" />
          <h1>Loading Fatwa Admin</h1>
          <p>Connecting to the secure content workspace…</p>
        </div>
      </main>
    );
  }

  if (!stats && error) {
    return (
      <main className="login-shell">
        <div className="login-card">
          <img className="logo-image" src="/fatwa-icon.png" alt="Fatwa logo" />
          <h1>Fatwa Admin</h1>
          <p>Enter the admin token configured on the API server.</p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void load();
            }}
          >
            <input
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="Admin token"
              type="password"
              autoComplete="current-password"
              aria-label="Admin token"
            />
            <button type="submit">Sign in</button>
          </form>
          <small role="alert">{error}</small>
        </div>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <img className="logo-image" src="/fatwa-icon.png" alt="Fatwa logo" />
          <div>
            <strong>Fatwa</strong>
            <span>Admin workspace</span>
          </div>
        </div>
        <nav aria-label="Admin sections">
          <button className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}>
            <LayoutDashboard size={18} /> Overview
          </button>
          <button className={tab === "fatwas" ? "active" : ""} onClick={() => setTab("fatwas")}>
            <BookOpen size={18} /> Fatwas <b>{fatwas.length}</b>
          </button>
          <button className={tab === "questions" ? "active" : ""} onClick={() => setTab("questions")}>
            <MessageSquare size={18} /> Questions <b>{pendingQuestions.length}</b>
          </button>
          <button className={tab === "submissions" ? "active" : ""} onClick={() => setTab("submissions")}>
            <ClipboardList size={18} /> Submissions <b>{submissions.filter((item) => item.status === "pending").length}</b>
          </button>
          <button className={tab === "posts" ? "active" : ""} onClick={() => setTab("posts")}>
            <Pin size={18} /> Live posts <b>{posts.length}</b>
          </button>
        </nav>
        <button
          className="logout"
          onClick={() => {
            sessionStorage.removeItem("fatwa-admin-token");
            setToken("");
            setStats(null);
            setError("Signed out");
          }}
        >
          <LogOut size={17} /> Sign out
        </button>
      </aside>

      <main className="main-content">
        <header>
          <div>
            <p className="eyebrow">CONTENT CONTROL</p>
            <h1>
              {tab === "overview"
                ? "Good morning, editor"
                : tab === "fatwas"
                  ? "Fatwa library"
                  : tab === "questions"
                    ? "Questions inbox"
                    : "Community submissions"}
            </h1>
            <p className="subtitle">Review, publish and maintain traceable scholarly guidance.</p>
          </div>
          <button className="primary" onClick={() => setShowForm(true)}>
            <Plus size={17} /> Add fatwa
          </button>
        </header>

        {error && <div className="alert error" role="alert">{error}</div>}
        {notice && (
          <div className="alert success" role="status">
            <CheckCircle2 size={17} /> {notice}
          </div>
        )}

        {tab === "overview" && (
          <>
            <section className="metric-grid" aria-label="Dashboard statistics">
              {metricDefinitions.map(([label, key, Icon]) => (
                <div className="metric" key={label}>
                  <div className="metric-icon"><Icon size={19} /></div>
                  <span>{label}</span>
                  <strong>{stats?.[key] ?? 0}</strong>
                </div>
              ))}
            </section>
            <div className="content-grid">
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Latest published guidance</h2>
                    <p>Every record keeps its institutional source.</p>
                  </div>
                  <button className="text-button" onClick={() => setTab("fatwas")}>View library</button>
                </div>
                {fatwas.slice(0, 4).map((fatwa) => (
                  <FatwaRow
                    key={fatwa.id}
                    fatwa={fatwa}
                    onApprove={fatwa.status === "draft" ? async () => {
                      await request(`/admin/fatwas/${fatwa.id}`, { method: "PATCH", body: JSON.stringify({ status: "published" }) }, token);
                      await load();
                      setNotice("Fatwa approved and published to the app.");
                    } : undefined}
                    onDelete={async () => {
                      await request(`/admin/fatwas/${fatwa.id}`, { method: "DELETE" }, token);
                      await load();
                    }}
                  />
                ))}
                {fatwas.length === 0 && <div className="empty">No published fatwas yet.</div>}
              </section>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Needs a response</h2>
                    <p>Answer users from the admin workspace.</p>
                  </div>
                  <button className="text-button" onClick={() => setTab("questions")}>Open inbox</button>
                </div>
                {pendingQuestions.slice(0, 4).map((question) => (
                  <QuestionRow
                    key={question.id}
                    question={question}
                    token={token}
                    afterSave={async () => {
                      await load();
                      setNotice("Question answered and published to the user timeline.");
                    }}
                  />
                ))}
                {pendingQuestions.length === 0 && <div className="empty">No pending questions.</div>}
              </section>
            </div>
          </>
        )}

        {tab === "fatwas" && (
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>All fatwas</h2>
                <p>Published answers are visible in the mobile app.</p>
              </div>
            </div>
            {fatwas.map((fatwa) => (
              <FatwaRow
                key={fatwa.id}
                fatwa={fatwa}
                onApprove={fatwa.status === "draft" ? async () => {
                  await request(`/admin/fatwas/${fatwa.id}`, { method: "PATCH", body: JSON.stringify({ status: "published" }) }, token);
                  await load();
                  setNotice("Fatwa approved and published to the app.");
                } : undefined}
                onDelete={async () => {
                  await request(`/admin/fatwas/${fatwa.id}`, { method: "DELETE" }, token);
                  await load();
                  setNotice("Fatwa deleted.");
                }}
              />
            ))}
            {fatwas.length === 0 && <div className="empty">No fatwas yet.</div>}
          </section>
        )}

        {tab === "questions" && (
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>User questions</h2>
                <p>{questions.length} total · {questions.filter((item) => item.gender === "male").length} male · {questions.filter((item) => item.gender === "female").length} female · {pendingQuestions.length} pending · {questions.filter((item) => item.status === "answered").length} answered</p>
              </div>
            </div>
            <div className="filter-row" role="toolbar" aria-label="Question filters">
              {(["all", "male", "female", "pending", "answered"] as QuestionFilter[]).map((filter) => (
                <button key={filter} className={`filter-chip ${questionFilter === filter ? "active" : ""}`} onClick={() => setQuestionFilter(filter)}>
                  {filter === "all" ? "All" : filter === "pending" ? "Pending" : filter === "answered" ? "Answered" : filter === "male" ? "Male" : "Female"}
                </button>
              ))}
            </div>
            {visibleQuestions.map((question) => (
              <QuestionRow
                key={question.id}
                question={question}
                token={token}
                afterSave={async () => {
                  await load();
                  setNotice("Question answered and published to the user timeline.");
                }}
              />
            ))}
            {visibleQuestions.length === 0 && <div className="empty">No questions match this filter.</div>}
          </section>
        )}

        {tab === "posts" && (
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Published community posts</h2>
                <p>Remove a live post or pin one featured post at the top of the feed.</p>
              </div>
            </div>
            {posts.map((post) => (
              <article className="question-card" key={post.id}>
                <div className="row-meta"><span className="status approved">{post.featured ? "Pinned" : "Live"}</span><span>{post.category}</span></div>
                <h3>{post.body?.split(/\r?\n/)[0] || "Image post"}</h3>
                <p className="questioner">By {post.author}{post.city ? ` · ${post.city}` : ""}</p>
                {post.authorImageUrl ? <img className="submission-image" src={post.authorImageUrl} alt={`${post.author} profile`} loading="lazy" /> : null}
                {post.imageUrl ? <img className="submission-image" src={post.imageUrl} alt="Published post attachment" loading="lazy" /> : null}
                <p className="submission-body">{post.body}</p>
                <div className="answer-footer">
                  <button className="primary small" onClick={async () => { await request(`/admin/posts/${post.id}`, { method: "PATCH", body: JSON.stringify({ action: post.featured ? "unpin" : "pin" }) }, token); await load(); setNotice(post.featured ? "Post unpinned." : "Post pinned."); }}><Pin size={15} /> {post.featured ? "Unpin" : "Pin"}</button>
                  <button className="icon-button danger" onClick={async () => { if (!window.confirm("Delete this published post?")) return; await request(`/admin/posts/${post.id}`, { method: "DELETE" }, token); await load(); setNotice("Published post deleted."); }} title="Delete published post"><Trash2 size={16} /></button>
                </div>
              </article>
            ))}
            {posts.length === 0 && <div className="empty">No published community posts yet.</div>}
          </section>
        )}

        {tab === "submissions" && (
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Community submissions</h2>
                <p>Approve a post to publish it, or reject it without making it public.</p>
              </div>
            </div>
            {submissions.map((submission) => (
              <SubmissionRow
                key={submission.id}
                submission={submission}
                token={token}
                afterReview={async (message) => {
                  await load();
                  setNotice(message);
                }}
              />
            ))}
            {submissions.length === 0 && <div className="empty">No community submissions yet.</div>}
          </section>
        )}

      </main>

      {showForm && (
        <FatwaForm
          token={token}
          onClose={() => setShowForm(false)}
          onSaved={async () => {
            setShowForm(false);
            await load();
            setNotice("Fatwa saved as a private draft. Approve it from the Fatwa library to publish it in the app.");
          }}
        />
      )}
    </div>
  );
}

function AgentPanel({
  status,
  liveFatwas,
  token,
  onRefresh,
  onNotice,
}: {
  status: AgentStatus | null;
  liveFatwas: Fatwa[];
  token: string;
  onRefresh: () => Promise<void>;
  onNotice: (message: string) => void;
}) {
  const candidates = status?.candidates ?? [];
  const pending = candidates.filter((item) => item.status === "needs_review" || item.status === "draft");
  const approved = candidates.filter((item) => item.status === "approved");
  const rejected = candidates.filter((item) => item.status === "rejected");
  const [section, setSection] = useState<"pending" | "approved" | "rejected" | "errors" | "live">("pending");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editing, setEditing] = useState<Fatwa | null>(null);
  const parseReasons = (value: AgentCandidate["reasons"]) => {
    if (Array.isArray(value)) return value;
    if (typeof value !== "string" || !value.trim()) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [value];
    } catch {
      return [value];
    }
  };
  const current = section === "pending" ? pending : section === "approved" ? approved : rejected;
  const toggleSelected = (id: string) => setSelectedIds((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);
  const bulkReview = async (action: "reject" | "delete") => {
    if (!selectedIds.length) return;
    if (!window.confirm(`${action === "delete" ? "Delete" : "Reject"} ${selectedIds.length} selected AI records?`)) return;
    const count = selectedIds.length;
    try {
      await Promise.all(selectedIds.map((id) => request(`/admin/fatwa-agent/${encodeURIComponent(id)}`, {
        method: action === "delete" ? "DELETE" : "PATCH",
        ...(action === "delete" ? {} : { body: JSON.stringify({ action }) }),
      }, token)));
      setSelectedIds([]);
      await onRefresh();
      onNotice(`${count} AI records ${action === "delete" ? "deleted" : "rejected"}.`);
    } catch (err) { window.alert(err instanceof Error ? err.message : "Unable to update selected records"); }
  };
  const review = async (candidate: AgentCandidate, action: "approve" | "reject" | "delete") => {
    try {
      await request(`/admin/fatwa-agent/${candidate.id}`, { method: action === "delete" ? "DELETE" : "PATCH", ...(action === "delete" ? {} : { body: JSON.stringify({ action }) }) }, token);
      await onRefresh();
      onNotice(action === "approve" ? "AI fatwa approved and published." : action === "reject" ? "AI fatwa rejected and kept private." : "AI record deleted.");
    } catch (err) { window.alert(err instanceof Error ? err.message : "Unable to update AI record"); }
  };
  const errorItems = Array.isArray(status?.lastRun?.errors) ? status.lastRun.errors : [];
  return (
    <section className="panel agent-panel">
      <div className="panel-heading agent-heading">
        <div><h2>Fatwa AI Agent workspace</h2><p>{status?.enabled ? "Every AI draft stays private until an editor approves it." : "Agent bridge is not configured on the API."}</p></div>
        <div className="agent-actions">
          <button className="agent-action select" onClick={() => setSelectedIds(selectedIds.length === pending.length ? [] : pending.map((item) => item.id))}>Select all <span>{selectedIds.length}/{pending.length}</span></button>
          <button className="agent-action reject" disabled={!selectedIds.length} onClick={() => void bulkReview("reject")}>Reject selected</button>
          <button className="agent-action delete" disabled={!selectedIds.length} onClick={() => void bulkReview("delete")}>Delete selected</button>
          <button className="agent-action refresh" onClick={() => void onRefresh()}>Refresh</button>
        </div>
      </div>
      <div className="agent-run-summary">
        <strong>Last run:</strong> {status?.lastRun?.status ?? "unknown"} · <strong>Processed:</strong> {status?.lastRun?.processed ?? 0} · <strong>Errors:</strong> {Array.isArray(status?.lastRun?.errors) ? status.lastRun.errors.length : status?.lastRun?.errors ?? 0}
        {status?.lastRun?.message ? <span> · {status.lastRun.message}</span> : null}
      </div>
      {status?.sources?.length ? <div className="agent-sources">{status.sources.map((source) => <span key={source.status}>{source.status}: {source.count}</span>)}</div> : null}
      <div className="agent-tabs" role="tablist" aria-label="AI fatwa status sections">
        {([ ["pending", "Pending", pending.length], ["approved", "Approved", approved.length], ["rejected", "Rejected", rejected.length], ["errors", "Errors", errorItems.length || (typeof status?.lastRun?.errors === "number" ? status.lastRun.errors : 0)], ["live", "Live / published", liveFatwas.length] ] as const).map(([key, label, count]) => <button key={key} className={`agent-tab ${section === key ? "active" : ""} ${key === "errors" && count ? "has-errors" : ""}`} onClick={() => setSection(key)} role="tab" aria-selected={section === key}>{label}<b>{count}</b></button>)}
      </div>
      {section === "errors" ? (
        <div className="agent-error-list">
          <h3>Agent errors</h3>
          {status?.lastRun?.message ? <div className="agent-error"><strong>Last run:</strong> {status.lastRun.message}</div> : null}
          {errorItems.length ? errorItems.map((item, index) => <div className="agent-error" key={index}>{typeof item === "string" ? item : JSON.stringify(item)}</div>) : <div className="empty">No detailed error records were returned by the Worker. The run counter is {typeof status?.lastRun?.errors === "number" ? status.lastRun.errors : 0}.</div>}
        </div>
      ) : section === "live" ? (
        <div className="agent-live-list">
          <div className="section-intro"><h3>Live published fatwas</h3><p>Edit the published answer, source, scholar, or category. Changes are saved directly to the public library.</p></div>
          {liveFatwas.map((fatwa) => <article className="agent-live-card" key={fatwa.id}><div><span className="tag">{fatwa.category}</span><h3>{fatwa.title || fatwa.question}</h3><p>{fatwa.institution} · {fatwa.scholar}</p></div><button className="agent-action edit" onClick={() => setEditing(fatwa)}>Edit live fatwa</button></article>)}
          {!liveFatwas.length && <div className="empty">No live published fatwas yet.</div>}
        </div>
      ) : (
        <div className="agent-records">
          {current.map((candidate) => {
            const reasons = parseReasons(candidate.reasons);
            const missing = [!candidate.question?.trim() && "question", !candidate.answer?.trim() && "source answer", !candidate.urdu_draft?.trim() && "Urdu draft"].filter(Boolean) as string[];
            const complete = missing.length === 0 && Boolean(candidate.source_url?.trim());
            return <article className="agent-record" key={candidate.id}>
              {section === "pending" ? <label className="agent-select"><input type="checkbox" checked={selectedIds.includes(candidate.id)} onChange={() => toggleSelected(candidate.id)} /> Select for bulk action</label> : null}
              <div className="row-meta"><span className="tag">{candidate.category || "Needs category"}</span><span className={`status ${candidate.status}`}>{candidate.status.replace("_", " ")}</span><span>{Math.round((candidate.confidence || 0) * 100)}% confidence</span></div>
              <h3>{candidate.source_title || candidate.question || "Untitled source record"}</h3><p className="questioner">{candidate.institution}{candidate.scholar ? ` · ${candidate.scholar}` : ""}</p>
              <p className="submission-body"><strong>Question:</strong> {candidate.question?.trim() || "Not extracted"}</p><p className="submission-body"><strong>Source answer:</strong> {candidate.answer?.trim() || "Not extracted"}</p><p className="submission-body"><strong>Urdu draft:</strong> {candidate.urdu_draft?.trim() || "Not generated"}</p>
              {missing.length ? <p className="agent-warning"><strong>Cannot approve yet:</strong> Missing {missing.join(", ")}.</p> : null}{reasons.length ? <p className="agent-reason"><strong>Review reason:</strong> {reasons.join(" ")}</p> : null}
              <div className="agent-record-actions">{candidate.source_url ? <a className="agent-action source" href={candidate.source_url} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Open source</a> : null}{section === "pending" ? <><button className="agent-action approve" disabled={!complete} onClick={() => void review(candidate, "approve")}>Approve & publish</button><button className="agent-action reject" onClick={() => void review(candidate, "reject")}>Reject</button><button className="agent-action delete" onClick={() => void review(candidate, "delete")}>Delete</button></> : null}</div>
            </article>;
          })}
          {!current.length && <div className="empty">{section === "pending" ? "No AI drafts are waiting for review." : `No ${section} AI records are available.`}</div>}
        </div>
      )}
      {editing ? <FatwaEditForm fatwa={editing} token={token} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await onRefresh(); onNotice("Live fatwa updated."); }} /> : null}
    </section>
  );
}

function FatwaEditForm({ fatwa, token, onClose, onSaved }: { fatwa: Fatwa; token: string; onClose: () => void; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState({ question: fatwa.question, answer: fatwa.answer, category: fatwa.category, scholar: fatwa.scholar, institution: fatwa.institution, sourceUrl: fatwa.sourceUrl || "" });
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const valid = form.question.trim().length >= 10 && form.answer.trim().length >= 10 && form.scholar.trim().length >= 2 && form.institution.trim().length >= 2;
  const save = async () => { setBusy(true); setError(""); try { await request(`/admin/fatwas/${fatwa.id}`, { method: "PATCH", body: JSON.stringify({ ...form, title: form.question.trim().slice(0, 120) }) }, token); await onSaved(); } catch (err) { setError(err instanceof Error ? err.message : "Unable to update live fatwa"); } finally { setBusy(false); } };
  return <div className="modal-backdrop"><div className="modal" role="dialog" aria-modal="true"><div className="modal-header"><div><p className="eyebrow">LIVE RECORD</p><h2>Edit published fatwa</h2></div><button className="icon-button" onClick={onClose} aria-label="Close">×</button></div><div className="form-grid"><label>Category<select value={form.category} onChange={(event) => update("category", event.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label><label>Scholar / responder<input value={form.scholar} onChange={(event) => update("scholar", event.target.value)} /></label><label className="wide">Question<textarea value={form.question} onChange={(event) => update("question", event.target.value)} /></label><label className="wide">Published answer<textarea value={form.answer} onChange={(event) => update("answer", event.target.value)} /></label><label>Institution<input value={form.institution} onChange={(event) => update("institution", event.target.value)} /></label><label>Source URL<input value={form.sourceUrl} onChange={(event) => update("sourceUrl", event.target.value)} /></label></div>{error && <div className="alert error">{error}</div>}<div className="modal-footer"><p>Changes go live after saving.</p><button className="primary" disabled={busy || !valid} onClick={() => void save()}><CheckCircle2 size={16} /> {busy ? "Saving..." : "Save live changes"}</button></div></div></div>;
}

function FatwaRow({ fatwa, onApprove, onDelete }: { fatwa: Fatwa; onApprove?: () => Promise<void>; onDelete: () => Promise<void> }) {
  return (
    <article className="row">
      <div className="row-icon"><BookOpen size={17} /></div>
      <div className="row-main">
        <div className="row-meta">
          <span className="tag">{fatwa.category}</span>
          <span>{fatwa.status}</span>
        </div>
        <h3>{fatwa.title?.trim() || fatwa.question}</h3>
        <p>{fatwa.institution} · {fatwa.scholar}</p>
      </div>
      {fatwa.sourceUrl && (
        <a href={fatwa.sourceUrl} target="_blank" rel="noreferrer" className="icon-button" title="Open source">
          <ExternalLink size={16} />
        </a>
      )}
      {onApprove ? <button className="primary small" onClick={() => void onApprove()} title="Approve and publish fatwa"><CheckCircle2 size={15} /> Approve</button> : null}
      <button className="icon-button danger" onClick={() => void onDelete()} title="Delete fatwa" aria-label="Delete fatwa">
        <Trash2 size={16} />
      </button>
    </article>
  );
}

function QuestionRow({
  question,
  token,
  afterSave,
}: {
  question: Question;
  token: string;
  afterSave: () => Promise<void>;
}) {
  const [answer, setAnswer] = useState(question.answer ?? "");
  const [answeredBy, setAnsweredBy] = useState(question.answeredBy ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await request(
        `/admin/questions/${question.id}/answer`,
        { method: "PATCH", body: JSON.stringify({ answer, answeredBy }) },
        token,
      );
      await afterSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to publish the answer");
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="question-card">
      <div className="row-meta">
        <span className="tag">{question.category}</span>
        <span className={`status ${question.status}`}>{question.status.replace("_", " ")}</span>
      </div>
      <h3>{question.question}</h3>
      <p className="questioner">Asked by {question.name}{question.gender && question.gender !== "unspecified" ? ` · ${question.gender}` : ""}{question.city ? ` · ${question.city}` : ""}{question.country ? `, ${question.country}` : ""}</p>
      {question.status !== "answered" ? (
        <div className="answer-form">
          <textarea
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            placeholder="Write the reviewed answer..."
            aria-label="Reviewed answer"
          />
          <div className="answer-footer">
            <input
              value={answeredBy}
              onChange={(event) => setAnsweredBy(event.target.value)}
              placeholder="Scholar / institution name"
              aria-label="Scholar or institution name"
            />
            <button
              className="primary small"
              disabled={busy || answer.trim().length < 10 || answeredBy.trim().length < 2}
              onClick={() => void submit()}
            >
              <Send size={15} /> {busy ? "Saving..." : "Publish answer"}
            </button>
          </div>
          {error && <div className="alert error" role="alert">{error}</div>}
        </div>
      ) : (
        <div className="published-answer">
          <strong>{question.answeredBy}</strong>
          <p>{question.answer}</p>
        </div>
      )}
    </article>
  );
}

function SubmissionRow({
  submission,
  token,
  afterReview,
}: {
  submission: PostSubmission;
  token: string;
  afterReview: (message: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const review = async (action: "approve" | "reject") => {
    setBusy(true);
    try {
      await request(`/admin/post-submissions/${submission.id}`, { method: "PATCH", body: JSON.stringify({ action }) }, token);
      await afterReview(action === "approve" ? "Post approved and published." : "Post rejected and kept private.");
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Unable to review submission");
    } finally {
      setBusy(false);
    }
  };
  return (
    <article className="question-card">
      <div className="row-meta">
        <span className={`status ${submission.status}`}>{submission.status}</span>
        <span>{submission.language.toUpperCase()}</span>
      </div>
      <h3>{submission.body?.split(/\r?\n/)[0] || "Image post"}</h3>
      <p className="questioner">By {submission.name}{submission.city ? ` · ${submission.city}` : ""}{submission.country ? `, ${submission.country}` : ""}</p>
      {submission.imageUrl ? <img className="submission-image" src={submission.imageUrl} alt="Submitted post attachment" loading="lazy" /> : null}
      {submission.body ? <p className="submission-body">{submission.body}</p> : null}
      {submission.status === "pending" ? (
        <div className="answer-footer">
          <button className="primary small" disabled={busy} onClick={() => void review("approve")}><CheckCircle2 size={15} /> Approve & publish</button>
          <button className="icon-button danger" disabled={busy} onClick={() => void review("reject")} title="Reject submission">Reject</button>
        </div>
      ) : null}
    </article>
  );
}

function FatwaForm({
  token,
  onClose,
  onSaved,
}: {
  token: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState({
    question: "",
    answer: "",
    category: "Namaz" as Category,
    scholar: "",
    institution: "",
    sourceUrl: "",
    sourceQuestionId: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const valid =
    form.question.trim().length >= 10 &&
    form.answer.trim().length >= 10 &&
    form.scholar.trim().length >= 2 &&
    form.institution.trim().length >= 2 &&
    /^https:\/\//i.test(form.sourceUrl.trim());

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await request(
        "/admin/fatwas",
        {
          method: "POST",
                body: JSON.stringify({
                  ...form,
                  status: "draft",
                  // The local Express adapter requires a title; the Cloudflare Worker ignores this extra field.
            title: form.question.trim().slice(0, 120),
          }),
        },
        token,
      );
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to publish this fatwa");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="fatwa-form-title">
        <div className="modal-header">
          <div>
            <p className="eyebrow">NEW RECORD</p>
            <h2 id="fatwa-form-title">Add a published fatwa</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close form">×</button>
        </div>
        <div className="form-grid">
          <label>Category
            <select value={form.category} onChange={(event) => update("category", event.target.value)}>
              {categories.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>Scholar / responder
            <input value={form.scholar} onChange={(event) => update("scholar", event.target.value)} />
          </label>
          <label className="wide">Question
            <textarea value={form.question} onChange={(event) => update("question", event.target.value)} />
          </label>
          <label className="wide">Reviewed answer
            <textarea value={form.answer} onChange={(event) => update("answer", event.target.value)} />
          </label>
          <label>Institution
            <input value={form.institution} onChange={(event) => update("institution", event.target.value)} />
          </label>
          <label>Source URL (required)
            <input value={form.sourceUrl} onChange={(event) => update("sourceUrl", event.target.value)} placeholder="https://..." />
          </label>
          <label className="wide">Source question ID (optional)
            <input value={form.sourceQuestionId} onChange={(event) => update("sourceQuestionId", event.target.value)} />
          </label>
        </div>
        {error && <div className="alert error" role="alert">{error}</div>}
        <div className="modal-footer">
          <p>Attribute each answer to its reviewer and institution; include the source when available.</p>
          <button className="primary" disabled={busy || !valid} onClick={() => void save()}>
            <CheckCircle2 size={16} /> {busy ? "Publishing..." : "Publish fatwa"}
          </button>
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);

import { createRoot } from "react-dom/client";
