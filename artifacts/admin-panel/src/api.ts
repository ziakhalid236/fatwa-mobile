export const API = (import.meta.env.VITE_API_URL ?? "https://fatwa-api.ziakhalid236.workers.dev").replace(/\/$/, "");
const KEY = "fatwa-admin-token";
export const getToken = () => sessionStorage.getItem(KEY) ?? "";
export const setToken = (t: string) => (t ? sessionStorage.setItem(KEY, t) : sessionStorage.removeItem(KEY));

export async function api<T = any>(path: string, init: RequestInit & { form?: FormData; json?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { "x-admin-token": getToken() };
  let body: BodyInit | undefined = init.body ?? undefined;
  if (init.form) body = init.form;
  else if (init.json !== undefined) { body = JSON.stringify(init.json); headers["Content-Type"] = "application/json"; }
  const res = await fetch(`${API}/api${path}`, { ...init, body, headers: { ...headers, ...(init.headers as Record<string, string>) } });
  if (!res.ok) {
    const p = await res.json().catch(() => null);
    const e: any = new Error(p?.error ?? `Request failed (${res.status})`); e.status = res.status; throw e;
  }
  return res.status === 204 ? (undefined as T) : res.json();
}
export const post = <T = any>(path: string, json?: unknown) => api<T>(path, { method: "POST", json: json ?? {} });
export const patch = <T = any>(path: string, json: unknown) => api<T>(path, { method: "PATCH", json });
export const del = <T = any>(path: string) => api<T>(path, { method: "DELETE" });

export const ago = (iso?: string) => {
  if (!iso) return "";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now"; if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`; if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
};
