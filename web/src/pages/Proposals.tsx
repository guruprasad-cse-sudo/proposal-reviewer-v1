import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PROPOSAL_STATUS } from "../../../shared/src";
import { api } from "../api";
import { useApp } from "../ctx";

interface Row { id: number; title: string; agency: string; scheme: string; status: string; score: number | null; band: string | null; updated_at: string; owner_name: string; owner_dept: string; comments: number; }

export const bandClass = (b?: string | null) => (b === "Competitive" ? "b-good" : b === "Needs revision" || b === "Major gaps" ? "b-warn" : "b-bad");

export default function Proposals() {
  const { me, rules } = useApp();
  const nav = useNavigate();
  const reviewer = me!.role !== "faculty";
  const [scope, setScope] = useState<"mine" | "all">(reviewer ? "all" : "mine");
  const [status, setStatus] = useState("");
  const [agency, setAgency] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState("");
  const [creating, setCreating] = useState(false);
  const firstAgency = Object.keys(rules)[0] || "anrf";
  const [nw, setNw] = useState({ agency: firstAgency, scheme: Object.keys(rules[firstAgency]?.schemes || {})[0] || "", title: "", copyFrom: "" });

  useEffect(() => {
    const qs = new URLSearchParams({ scope, ...(status && { status }), ...(agency && { agency }) });
    api<{ proposals: Row[] }>(`/proposals?${qs}`).then((r) => setRows(r.proposals)).catch((e) => setErr(e.message));
  }, [scope, status, agency]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const r = await api<{ id: number }>("/proposals", { body: { agency: nw.agency, scheme: nw.scheme, title: nw.title, copyFrom: nw.copyFrom ? Number(nw.copyFrom) : undefined } });
      nav(`/proposals/${r.id}`);
    } catch (x: any) { setErr(x.message); }
  };
  const agencyName = (k: string) => rules[k]?.name || k;
  const schemeName = (a: string, s: string) => rules[a]?.schemes[s]?.name || s;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{scope === "all" ? "All proposals" : "My proposals"}</h1>
          <p>{scope === "all" ? "Proposals sent to the R&D cell, and their progress to the agency." : "Start a proposal, review it against the call, then send it to the R&D cell for approval before you submit to the agency."}</p>
        </div>
        <div className="row">
          {reviewer && <div className="row" role="group" aria-label="Show">
            <button type="button" className={scope === "all" ? "primary" : undefined} onClick={() => setScope("all")}>All proposals</button>
            <button type="button" className={scope === "mine" ? "primary" : undefined} onClick={() => setScope("mine")}>Mine</button>
          </div>}
          <button type="button" className="primary" onClick={() => setCreating(true)}>New proposal</button>
        </div>
      </div>

      <div className="panel">
        <div className="row pad" style={{ paddingBottom: 8 }}>
          <label style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>Status
            <select id="flt-status" value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: "auto" }}>
              <option value="">Any</option>{Object.entries(PROPOSAL_STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select></label>
          <label style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>Agency
            <select id="flt-agency" value={agency} onChange={(e) => setAgency(e.target.value)} style={{ width: "auto" }}>
              <option value="">Any</option>{Object.values(rules).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select></label>
        </div>
        {err && <p className="err pad">{err}</p>}
        {rows && rows.length > 0 && <div className="tblwrap">
          <table className="list">
            <thead><tr><th>Title</th>{scope === "all" && <th>PI</th>}<th>Agency · scheme</th><th>Status</th><th className="num">Score</th><th>Updated</th></tr></thead>
            <tbody>{rows.map((r) => <tr key={r.id} className="click" onClick={() => nav(`/proposals/${r.id}`)}>
              <td><a href={`/proposals/${r.id}`} onClick={(e) => { e.preventDefault(); nav(`/proposals/${r.id}`); }}>{r.title || "Untitled proposal"}</a>{r.comments > 0 && <span className="note"> · {r.comments} comment{r.comments > 1 ? "s" : ""}</span>}</td>
              {scope === "all" && <td>{r.owner_name}<div className="note" style={{ margin: 0 }}>{r.owner_dept}</div></td>}
              <td>{agencyName(r.agency)}<div className="note" style={{ margin: 0 }}>{schemeName(r.agency, r.scheme)}</div></td>
              <td><span className={"status st-" + r.status}>{PROPOSAL_STATUS[r.status] || r.status}</span></td>
              <td className="num">{r.score ?? "–"} {r.band && <span className={"band " + bandClass(r.band)} style={{ marginLeft: 6 }}>{r.band}</span>}</td>
              <td className="note" style={{ whiteSpace: "nowrap" }}>{new Date(r.updated_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</td>
            </tr>)}</tbody>
          </table>
        </div>}
        {rows && !rows.length && <div className="empty">{scope === "all" ? "No proposals match these filters." : <>You have no proposals yet. <button className="link" type="button" onClick={() => setCreating(true)}>Start one</button>.</>}</div>}
      </div>

      {creating && <div className="modal-bg" role="dialog" aria-modal="true" aria-labelledby="new-t">
        <form className="modal" onSubmit={create}>
          <h2 id="new-t">New proposal</h2>
          <label>Funding agency
            <select id="new-agency" value={nw.agency} onChange={(e) => setNw({ ...nw, agency: e.target.value, scheme: Object.keys(rules[e.target.value].schemes)[0] })}>
              {Object.values(rules).map((a) => <option key={a.id} value={a.id}>{a.name} · {a.full}</option>)}
            </select></label>
          <label>Scheme / call
            <select id="new-scheme" value={nw.scheme} onChange={(e) => setNw({ ...nw, scheme: e.target.value })}>
              {Object.entries(rules[nw.agency]?.schemes || {}).map(([k, s]) => <option key={k} value={k}>{s.name}</option>)}
            </select></label>
          <label>Title<input id="new-title" value={nw.title} onChange={(e) => setNw({ ...nw, title: e.target.value })} placeholder="You can change it later" /></label>
          {scope === "mine" && rows && rows.length > 0 && <label>Start from an earlier proposal<span className="hint">Copies its project details and text, useful when resubmitting to another agency</span>
            <select id="new-copy" value={nw.copyFrom} onChange={(e) => setNw({ ...nw, copyFrom: e.target.value })}>
              <option value="">No, start fresh</option>{rows.map((r) => <option key={r.id} value={r.id}>{r.title || "Untitled"} ({agencyName(r.agency)})</option>)}
            </select></label>}
          <p className="note" style={{ margin: 0 }}>Your saved faculty profile is filled in automatically.</p>
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button type="button" onClick={() => setCreating(false)}>Cancel</button>
            <button type="submit" className="primary">Create proposal</button>
          </div>
        </form>
      </div>}
    </>
  );
}
