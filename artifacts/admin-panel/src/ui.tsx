import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";

type Toast = { id: number; text: string; bad?: boolean };
const ToastCtx = createContext<(text: string, bad?: boolean) => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastHost({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string, bad?: boolean) => {
    const id = Date.now() + Math.random(); setItems((l) => [...l, { id, text, bad }]);
    setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), 3800);
  }, []);
  return <ToastCtx.Provider value={push}>{children}<div className="toasts">{items.map((t) => <div key={t.id} className={`toast ${t.bad ? "bad" : ""}`}>{t.text}</div>)}</div></ToastCtx.Provider>;
}

export const Badge = ({ tone = "gray", children }: { tone?: "green" | "amber" | "red" | "blue" | "gray"; children: ReactNode }) => <span className={`badge ${tone}`}>{children}</span>;
export const Empty = ({ text }: { text: string }) => <div className="empty">{text}</div>;
export const Spinner = () => <div className="spinner" />;

export function Btn({ children, onClick, tone = "ghost", small, disabled, title }: { children: ReactNode; onClick?: () => void | Promise<void>; tone?: "primary" | "ghost" | "danger" | "warn"; small?: boolean; disabled?: boolean; title?: string }) {
  const [busy, setBusy] = useState(false); const toast = useToast();
  return <button title={title} className={`btn ${tone} ${small ? "sm" : ""}`} disabled={disabled || busy} onClick={async () => { setBusy(true); try { await onClick?.(); } catch (e: any) { toast(e.message || "Failed", true); } finally { setBusy(false); } }}>{busy ? "…" : children}</button>;
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => { const h = (e: KeyboardEvent) => e.key === "Escape" && onClose(); window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, [onClose]);
  return <div className="modal-bg" onMouseDown={onClose}><div className={`modal ${wide ? "wide" : ""}`} onMouseDown={(e) => e.stopPropagation()}><div className="modal-head"><h3>{title}</h3><button className="x" onClick={onClose}><X size={18} /></button></div>{children}</div></div>;
}

export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null); const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => { setLoading(true); try { setData(await fn()); setError(""); } catch (e: any) { setError(e.message); } finally { setLoading(false); } }, deps); // eslint-disable-line
  useEffect(() => { reload(); }, [reload]);
  return { data, error, loading, reload };
}

export const Stat = ({ label, value, sub, tone, icon }: { label: string; value: ReactNode; sub?: string; tone?: string; icon?: ReactNode }) => <div className={`stat ${tone || ""}`}><div className="stat-top"><span>{label}</span>{icon}</div><b>{value}</b>{sub && <small>{sub}</small>}</div>;

export function Bars({ data, color = "#0f7a5f" }: { data: { date: string; count: number }[]; color?: string }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return <div className="bars">{data.map((d) => <div key={d.date} className="bar" title={`${d.date}: ${d.count}`}><i style={{ height: `${(d.count / max) * 100}%`, background: color }} /><em>{d.date.slice(8)}</em></div>)}</div>;
}
export const Tabs = ({ items, value, onChange }: { items: [string, string, number?][]; value: string; onChange: (v: string) => void }) => <div className="tabs">{items.map(([k, label, n]) => <button key={k} className={value === k ? "on" : ""} onClick={() => onChange(k)}>{label}{n != null && <span>{n}</span>}</button>)}</div>;
