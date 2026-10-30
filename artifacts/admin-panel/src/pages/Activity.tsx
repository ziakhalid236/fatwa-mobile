import { api, ago } from "../api";
import { Badge, Empty, Spinner, useLoad } from "../ui";

export default function Activity() {
  const { data } = useLoad(() => api("/admin/audit"));
  if (!data) return <Spinner />;
  const rows: any[] = data.audit || data.logs || [];
  return rows.length === 0 ? <Empty text="No admin activity yet." /> : <div className="card tw"><table><thead><tr><th>When</th><th>Action</th><th>Item</th><th>Details</th></tr></thead><tbody>{rows.map((r) => <tr key={r.id}><td className="meta">{ago(r.created_at || r.createdAt)}</td><td><Badge tone="green">{r.action}</Badge></td><td>{r.entity_type || r.entityType} <span className="meta">{String(r.entity_id || r.entityId || "").slice(0, 18)}</span></td><td className="meta">{r.metadata_json || ""}</td></tr>)}</tbody></table></div>;
}
