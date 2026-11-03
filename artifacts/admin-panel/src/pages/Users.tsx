import { useState } from "react";
import { Ban, Check, Crown, Trash2, UserCheck, X } from "lucide-react";
import { api, ago, del, patch, post } from "../api";
import { Badge, Btn, Empty, Modal, Spinner, useLoad, useToast } from "../ui";

export default function Users() {
  const { data, reload } = useLoad(async () => { const [users, requests] = await Promise.all([api("/admin/users"), api("/admin/subscription-requests")]); return { ...users, requests: requests.requests || [] } as any; }); const [q, setQ] = useState(""); const [editingPlan, setEditingPlan] = useState<any>(null); const toast = useToast();
  if (!data) return <Spinner />;
  const users = (data.users as any[]).filter((u) => !q || `${u.name} ${u.email || ""} ${u.city} ${u.country}`.toLowerCase().includes(q.toLowerCase()));
  const reviewRequest = async (request: any, action: "approve" | "reject") => {
    if (!confirm(`${action === "approve" ? "Approve" : "Reject"} ${request.name}'s ${request.plan === "high_premium" ? "High Premium" : "Premium"} request?`)) return;
    await patch(`/admin/subscription-requests/${request.id}`, { action });
    toast(action === "approve" ? "Membership approved" : "Membership rejected");
    reload();
  };
  return <>
    <section className="panel" style={{ marginBottom: 18 }}>
      <div className="panel-heading"><div><h2>Membership requests</h2><p>Users submit here; only an admin can approve or reject access.</p></div><Badge tone="amber">{data.requests.length} pending</Badge></div>
      {data.requests.length === 0 ? <Empty text="No pending membership requests." /> : data.requests.map((r: any) => <div className="row" key={r.id}>
        <div className="row-main"><div className="row-meta"><Badge tone={r.plan === "high_premium" ? "blue" : "amber"}>{r.plan === "high_premium" ? "High Premium" : "Premium"}</Badge><span>{ago(r.createdAt)}</span></div><h3>{r.name}</h3><p>{[r.email, r.city, r.country].filter(Boolean).join(" · ") || "Account details unavailable"}</p></div>
        <div className="row" style={{ borderTop: 0, padding: 0 }}><Btn tone="primary" small onClick={() => void reviewRequest(r, "approve")}><Check size={13} /> Approve</Btn><Btn tone="danger" small onClick={() => void reviewRequest(r, "reject")}><X size={13} /> Reject</Btn></div>
      </div>)}
    </section>
    <div className="row sp" style={{ marginBottom: 14 }}><input style={{ maxWidth: 340 }} placeholder="Search name, email, city…" value={q} onChange={(e) => setQ(e.target.value)} /><span className="meta">{users.length} of {data.users.length} users</span></div>
    {users.length === 0 ? <Empty text="No users found." /> : <div className="card tw"><table><thead><tr><th>User</th><th>Location</th><th>Sign-in</th><th>Membership</th><th>Posts</th><th>Reports</th><th>Joined</th><th></th></tr></thead><tbody>
      {users.map((u) => <tr key={u.id}>
        <td><div className="row">{u.avatarUrl ? <img className="avatar" src={u.avatarUrl} /> : <div className="avatar">{u.name[0]}</div>}<div><b>{u.name}</b>{u.bannedAt && <> <Badge tone="red">Suspended</Badge></>}<div className="meta">{u.email || "—"}</div></div></div></td>
        <td>{[u.city, u.country].filter(Boolean).join(", ") || "—"}</td><td>{u.provider || "device"}</td>
        <td><div className="row" style={{ flexWrap: "nowrap" }}><Badge tone={u.tier === "high_premium" ? "blue" : u.tier === "premium" ? "amber" : "gray"}>{u.tier === "high_premium" ? "High Premium" : u.tier === "premium" ? "Premium" : "Free"}</Badge><span className="meta">{u.tier !== "free" ? (u.expiresAt ? `to ${new Date(u.expiresAt).toLocaleDateString()}` : "no expiry") : ""}</span><Btn small onClick={() => setEditingPlan(u)} title="Change membership"><Crown size={13} /> Manage</Btn></div></td>
        <td>{u.livePosts} live{u.pendingPosts ? ` · ${u.pendingPosts} pending` : ""}</td><td>{u.reports}</td><td className="meta">{ago(u.createdAt)}</td>
        <td><div className="row" style={{ flexWrap: "nowrap" }}>
          {u.bannedAt ? <Btn small onClick={async () => { await post(`/admin/users/${u.id}/unban`); toast("User restored"); reload(); }}><UserCheck size={13} /> Restore</Btn>
            : <Btn tone="warn" small onClick={async () => { const reason = prompt("Reason for suspending (optional)"); if (reason === null) return; await post(`/admin/users/${u.id}/ban`, { reason }); toast("User suspended"); reload(); }}><Ban size={13} /> Suspend</Btn>}
          <Btn tone="danger" small onClick={async () => { if (!confirm(`Delete ${u.name} and all their posts?`)) return; await del(`/admin/users/${u.id}`); toast("User deleted"); reload(); }}><Trash2 size={13} /></Btn>
        </div></td>
      </tr>)}
    </tbody></table></div>}
    {editingPlan && <MembershipEditor user={editingPlan} onClose={() => setEditingPlan(null)} onDone={() => { setEditingPlan(null); toast("Membership updated"); reload(); }} />}
  </>;
}

function MembershipEditor({ user, onClose, onDone }: { user: any; onClose: () => void; onDone: () => void }) {
  const [tier, setTier] = useState(user.tier || "free");
  const [expiresOn, setExpiresOn] = useState(user.tier !== "free" && user.expiresAt ? new Date(user.expiresAt).toISOString().slice(0, 10) : "");
  return <Modal title={`Manage membership · ${user.name}`} onClose={onClose}>
    <label>Plan</label>
    <select value={tier} onChange={(e) => { setTier(e.target.value); if (e.target.value === "free") setExpiresOn(""); }}>
      <option value="free">Free</option><option value="premium">Premium</option><option value="high_premium">High Premium</option>
    </select>
    {tier !== "free" && <><label>Expires on (optional)</label><input type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} /><p className="meta">Leave blank for an admin-granted plan with no expiry.</p></>}
    <div className="row" style={{ marginTop: 16, justifyContent: "flex-end" }}>
      <Btn onClick={onClose}>Cancel</Btn>
      <Btn tone="primary" onClick={async () => {
        const expiresAt = tier !== "free" && expiresOn ? new Date(`${expiresOn}T23:59:59.999Z`).toISOString() : null;
        await patch(`/admin/users/${user.id}/subscription`, { tier, expiresAt });
        onDone();
      }}>Save membership</Btn>
    </div>
  </Modal>;
}
