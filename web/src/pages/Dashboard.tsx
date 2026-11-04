import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PROPOSAL_STATUS } from "../../../shared/src";
import { api } from "../api";
import { useApp } from "../ctx";

interface Stats {
  byStatus: { status: string; n: number }[];
  byAgency: { agency: string; n: number; avg_score: number | null; sanctioned: number; not_sanctioned: number; avg_score_sanctioned: number | null; avg_score_not: number | null }[];
  byDept: { dept: string; n: number; sanctioned: number }[];
  waiting: { id: number; title: string; agency: string; score: number | null; owner_name: string; updated_at: string }[];
}

export default function Dashboard() {
  const { rules } = useApp();
  const [s, setS] = useState<Stats | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { api<Stats>("/stats").then(setS).catch((e) => setErr(e.message)); }, []);
  if (err) return <p className="err">{err}</p>;
  if (!s) return <p className="note">Loading…</p>;
  const st = Object.fromEntries(s.byStatus.map((r) => [r.status, r.n]));
  const total = s.byStatus.reduce((t, r) => t + r.n, 0);
  const decided = (st.sanctioned || 0) + (st.not_sanctioned || 0);
  const maxDept = Math.max(1, ...s.byDept.map((d) => d.n));
  const days = (d: string) => Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 86400000));
  const tiles: [string, string | number][] = [
    ["Proposals in the system", total],
    ["Waiting for R&D review", st.internal_review || 0],
    ["Approved, not yet submitted", st.approved || 0],
    ["Submitted to agencies", st.submitted || 0],
    ["Sanctioned", st.sanctioned || 0],
    ["Success rate (decided)", decided ? Math.round(((st.sanctioned || 0) / decided) * 100) + "%" : "–"],
  ];
  return (
    <>
      <div className="page-head"><div><h1>R&amp;D dashboard</h1><p>Where proposals stand across departments and agencies. Record sanction outcomes on each proposal to see how readiness scores relate to results.</p></div></div>
      <div className="tiles">{tiles.map(([k, v]) => <div className="panel tile" key={k}><div className="v">{v}</div><div className="k">{k}</div></div>)}</div>
      <div className="grid2">
        <div className="panel pad">
          <h2 style={{ marginBottom: 8 }}>Waiting for your review</h2>
          {s.waiting.length ? <table className="list"><thead><tr><th>Proposal</th><th>PI</th><th className="num">Score</th><th className="num">Days</th></tr></thead>
            <tbody>{s.waiting.map((w) => <tr key={w.id}><td><Link to={`/proposals/${w.id}`}>{w.title || "Untitled"}</Link><div className="note" style={{ margin: 0 }}>{rules[w.agency]?.name || w.agency}</div></td><td>{w.owner_name}</td><td className="num">{w.score ?? "–"}</td><td className="num">{days(w.updated_at)}</td></tr>)}</tbody></table>
            : <p className="note">Nothing waiting.</p>}
        </div>
        <div className="panel pad" style={{ gridColumn: "1 / -1" }}>
          <h2 style={{ marginBottom: 8 }}>By agency</h2>
          <div className="tblwrap"><table className="list"><thead><tr><th>Agency</th><th className="num">Proposals</th><th className="num">Avg score</th><th className="num">Sanctioned</th><th className="num">Avg score, sanctioned / not</th></tr></thead>
            <tbody>{s.byAgency.map((a) => <tr key={a.agency}><td>{rules[a.agency]?.name || a.agency}</td><td className="num">{a.n}</td><td className="num">{a.avg_score ?? "–"}</td><td className="num">{a.sanctioned} of {a.sanctioned + a.not_sanctioned}</td><td className="num">{a.avg_score_sanctioned ?? "–"} / {a.avg_score_not ?? "–"}</td></tr>)}</tbody></table></div>
          <p className="note">Once enough outcomes are recorded, compare the average readiness score of sanctioned and not-sanctioned proposals to check how well the scoring predicts results.</p>
        </div>
        <div className="panel pad">
          <h2 style={{ marginBottom: 8 }}>By department</h2>
          {s.byDept.map((d) => <div className="hbar" key={d.dept}><span>{d.dept}</span><span className="bar"><i style={{ width: (d.n / maxDept) * 100 + "%", background: "var(--accent)" }} /></span><span className="num">{d.n}</span></div>)}
        </div>
        <div className="panel pad">
          <h2 style={{ marginBottom: 8 }}>By status</h2>
          {Object.entries(PROPOSAL_STATUS).map(([k, l]) => <div className="hbar" key={k}><span>{l}</span><span className="bar"><i style={{ width: ((st[k] || 0) / Math.max(1, total)) * 100 + "%", background: "var(--accent)" }} /></span><span className="num">{st[k] || 0}</span></div>)}
        </div>
      </div>
    </>
  );
}
