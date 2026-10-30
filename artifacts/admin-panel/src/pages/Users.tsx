import { useState } from "react";
import { Ban, Trash2, UserCheck } from "lucide-react";
import { api, ago, del, post } from "../api";
import { Badge, Btn, Empty, Spinner, useLoad, useToast } from "../ui";

export default function Users() {
  const { data, reload } = useLoad(() => api("/admin/users")); const [q, setQ] = useState(""); const toast = useToast();
  if (!data) return <Spinner />;
  const users = (data.users as any[]).filter((u) => !q || `${u.name} ${u.email || ""} ${u.city} ${u.country}`.toLowerCase().includes(q.toLowerCase()));
  return <>
    <div className="row sp" style={{ marginBottom: 14 }}><input style={{ maxWidth: 340 }} placeholder="Search name, email, city…" value={q} onChange={(e) => setQ(e.target.value)} /><span className="meta">{users.length} of {data.users.length} users</span></div>
    {users.length === 0 ? <Empty text="No users found." /> : <div className="card tw"><table><thead><tr><th>User</th><th>Location</th><th>Sign-in</th><th>Posts</th><th>Reports</th><th>Joined</th><th></th></tr></thead><tbody>
      {users.map((u) => <tr key={u.id}>
        <td><div className="row">{u.avatarUrl ? <img className="avatar" src={u.avatarUrl} /> : <div className="avatar">{u.name[0]}</div>}<div><b>{u.name}</b>{u.bannedAt && <> <Badge tone="red">Suspended</Badge></>}<div className="meta">{u.email || "—"}</div></div></div></td>
        <td>{[u.city, u.country].filter(Boolean).join(", ") || "—"}</td><td>{u.provider || "device"}</td>
        <td>{u.livePosts} live{u.pendingPosts ? ` · ${u.pendingPosts} pending` : ""}</td><td>{u.reports}</td><td className="meta">{ago(u.createdAt)}</td>
        <td><div className="row" style={{ flexWrap: "nowrap" }}>
          {u.bannedAt ? <Btn small onClick={async () => { await post(`/admin/users/${u.id}/unban`); toast("User restored"); reload(); }}><UserCheck size={13} /> Restore</Btn>
            : <Btn tone="warn" small onClick={async () => { const reason = prompt("Reason for suspending (optional)"); if (reason === null) return; await post(`/admin/users/${u.id}/ban`, { reason }); toast("User suspended"); reload(); }}><Ban size={13} /> Suspend</Btn>}
          <Btn tone="danger" small onClick={async () => { if (!confirm(`Delete ${u.name} and all their posts?`)) return; await del(`/admin/users/${u.id}`); toast("User deleted"); reload(); }}><Trash2 size={13} /></Btn>
        </div></td>
      </tr>)}
    </tbody></table></div>}
  </>;
}
