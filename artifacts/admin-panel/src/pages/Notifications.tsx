import { useState } from "react";
import { Send } from "lucide-react";
import { api, post } from "../api";
import { Badge, Btn, Spinner, Stat, useLoad, useToast } from "../ui";

export default function Notifications() {
  const { data } = useLoad(() => api("/admin/push/stats")); const toast = useToast();
  const [f, setF] = useState({ title: "", body: "", scope: "all", value: "" });
  if (!data) return <Spinner />;
  return <>
    <div className="grid g4" style={{ marginBottom: 14 }}>
      <Stat label="Devices with push" value={data.devices} /><Stat label="Queued" value={data.pending} tone={data.pending ? "warn" : ""} /><Stat label="Sent" value={data.sent} tone="good" /><Stat label="Failed" value={data.failed} tone={data.failed ? "bad" : ""} />
    </div>
    {!data.fcmConfigured && <div className="hint">Phone push is not connected yet (Firebase key missing). Announcements still appear inside the app's notification list.</div>}
    <div className="card" style={{ maxWidth: 620 }}><h3>Send an announcement</h3>
      <label>Title</label><input maxLength={80} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
      <label>Message</label><textarea maxLength={240} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
      <div className="row"><div className="grow"><label>Audience</label><select value={f.scope} onChange={(e) => setF({ ...f, scope: e.target.value })}><option value="all">Everyone</option><option value="country">One country</option><option value="city">One city</option></select></div>
        {f.scope !== "all" && <div className="grow"><label>{f.scope === "country" ? "Country" : "City"}</label><input value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} /></div>}</div>
      <div style={{ marginTop: 16 }}><Btn tone="primary" onClick={async () => { if (!confirm("Send this announcement now?")) return; const r = await post("/admin/broadcast", f); toast(`Sent to ${r.notified} users`); setF({ ...f, title: "", body: "" }); }}><Send size={14} /> Send</Btn> <Badge tone="gray">cannot be recalled</Badge></div>
    </div>
  </>;
}
