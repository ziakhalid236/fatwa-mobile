import { useState } from "react";
import { Check, Eye, Trash2 } from "lucide-react";
import { api, ago, del, patch } from "../api";
import { Badge, Btn, Empty, Modal, Spinner, Tabs, useLoad } from "../ui";

export default function Reports() {
  const [tab, setTab] = useState("new"); const [zoom, setZoom] = useState(""); const { data, reload } = useLoad(() => api("/admin/reports"));
  if (!data) return <Spinner />;
  const all: any[] = data.reports; const n = (s: string) => all.filter((r) => r.status === s).length;
  const list = tab === "all" ? all : all.filter((r) => r.status === tab);
  const set = async (r: any, status: string) => { await patch(`/admin/reports/${r.id}`, { status }); reload(); };
  return <>
    <Tabs value={tab} onChange={setTab} items={[["new", "New", n("new")], ["read", "Seen", n("read")], ["resolved", "Resolved", n("resolved")], ["all", "All", all.length]]} />
    {list.length === 0 ? <Empty text="No reports here." /> : list.map((r) => <div className="item" key={r.id}>
      <div className="body">
        <div className="row"><b>{r.name}</b><Badge tone={r.status === "new" ? "red" : r.status === "read" ? "amber" : "green"}>{r.status}</Badge>{r.page && <Badge tone="blue">{r.page}</Badge>}<span className="meta">{ago(r.createdAt)}{r.appVersion ? ` · v${r.appVersion}` : ""}{r.platform ? ` · ${r.platform}` : ""}</span></div>
        <p>{r.message}</p>
        {r.screenshots.length > 0 && <div className="shots">{r.screenshots.map((u: string) => <img key={u} src={u} onClick={() => setZoom(u)} />)}</div>}
        <div className="row" style={{ marginTop: 10 }}>
          {r.status !== "read" && r.status !== "resolved" && <Btn small onClick={() => set(r, "read")}><Eye size={13} /> Mark seen</Btn>}
          {r.status !== "resolved" && <Btn tone="primary" small onClick={() => set(r, "resolved")}><Check size={13} /> Resolve</Btn>}
          <Btn tone="danger" small onClick={async () => { if (confirm("Delete this report?")) { await del(`/admin/reports/${r.id}`); reload(); } }}><Trash2 size={13} /></Btn>
        </div>
      </div>
    </div>)}
    {zoom && <Modal wide title="Screenshot" onClose={() => setZoom("")}><img src={zoom} style={{ width: "100%", borderRadius: 12 }} /></Modal>}
  </>;
}
