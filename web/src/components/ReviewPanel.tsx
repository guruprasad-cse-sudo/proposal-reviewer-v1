import { DIMS, DIM_NAME, SECTIONS, fmt, num } from "../../../shared/src";
import type { AiReview, Evaluation, ProposalInput } from "../../../shared/src";

const lvl = (v: number) => (v >= 75 ? "var(--good)" : v >= 55 ? "var(--warn)" : "var(--bad)");
const PRI: Record<string, string> = { h: "High", m: "Medium", l: "Low" };

export function ReviewPanel({ ev, input, children }: { ev: Evaluation; input: ProposalInput; children?: React.ReactNode }) {
  const C = ev.scheme;
  const arc = 2 * Math.PI * 42;
  const color = ev.bandLevel === "good" ? "var(--good)" : ev.bandLevel === "warn" ? "var(--warn)" : "var(--bad)";
  const gc = { pass: 0, warn: 0, fail: 0, info: 0 };
  ev.gates.forEach((g) => gc[g.st]++);
  const [w0, w1] = C.trl, s = num(input.trlS), e = num(input.trlE);
  return (
    <aside className="panel sheet" aria-live="polite">
      <div className="verdict">
        <svg className="dial" viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r="42" fill="none" stroke="var(--rule)" strokeWidth="9" />
          <circle cx="50" cy="50" r="42" fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" transform="rotate(-90 50 50)" strokeDasharray={`${(ev.overall / 100) * arc} ${arc}`} />
          <text x="50" y="57" textAnchor="middle" fontSize="24" fill="var(--ink)">{ev.overall}</text>
        </svg>
        <div>
          <h2>Readiness</h2>
          <span className={"band b-" + ev.bandLevel}>{ev.band}</span>
          <div className="meta">{ev.agencyName} · {C.name} · ₹{fmt(ev.budget.total)} lakh · {num(input.dur)} months</div>
        </div>
      </div>

      <section className="blk">
        <h3>Eligibility and compliance <small>{gc.fail} fail · {gc.warn} warn · {gc.pass} pass</small></h3>
        <ul className="gates">{ev.gates.map((g, i) => <li key={i}><span className={"pill p-" + g.st}>{g.st}</span><span>{g.text}</span></li>)}</ul>
      </section>

      <section className="blk">
        <h3>Scorecard <small>score · weight for this call</small></h3>
        <div className="dims">{DIMS.map(([k, l]) => <div className="dim" key={k}><span>{l}</span><span className="bar"><i style={{ width: ev.scores[k] + "%", background: lvl(ev.scores[k]) }} /></span><span className="num">{ev.scores[k]}</span><span className="wt">{C.weights[k]}%</span></div>)}</div>
      </section>

      <section className="blk">
        <h3>TRL plan <small>{C.kind === "infra" ? "not scored for infrastructure grants" : ev.trlJump > 0 ? `${ev.trlJump} levels in ${fmt(num(input.dur) / 12)} yrs · ${fmt(ev.trlRate)} per year` : "no progression stated"}</small></h3>
        <div className="trl">{Array.from({ length: 9 }, (_, i) => i + 1).map((i) => {
          const cls = [i >= w0 && i <= w1 ? "win" : "", i > s && i < e ? "path" : "", i === s ? "s" : "", i === e ? "e" : ""].join(" ");
          return <div key={i} className={cls} title={"TRL " + i}>{i}</div>;
        })}</div>
        <div className="trl-legend"><span className="lg-win">Range this call usually funds</span><span className="lg-se">Your start and end</span></div>
      </section>

      <section className="blk">
        <h3>Sections found in the proposal {ev.text.has && <small>{C.requiredSections.length - ev.missing.length} of {C.requiredSections.length} expected</small>}</h3>
        {ev.text.has
          ? <div className="chips">{C.requiredSections.map((k) => <span key={k} className={"chip " + (ev.text.found[k] ? "ok" : "miss")}>{ev.text.found[k] ? "✓" : "✕"} {SECTIONS[k]?.[0] ?? k}</span>)}</div>
          : <p className="note">Upload or paste the proposal text in tab 04 to check its sections.</p>}
      </section>

      <section className="blk">
        <h3>Suggestions <small>most important first</small></h3>
        <ol className="sugg">{ev.suggestions.slice(0, 14).map((x, i) => <li key={i} className={x.p}><span className="tag">{PRI[x.p]} · {DIM_NAME[x.dim]}</span>{x.text}</li>)}
          {!ev.suggestions.length && <li className="l">No issues found by the checks. Run the Claude review for comments on the text itself.</li>}</ol>
      </section>
      {children}
    </aside>
  );
}

export function AiReviewView({ r }: { r: AiReview }) {
  const cls = /^Recommend$/i.test(r.likely_outcome || "") ? "b-good" : /revision|borderline/i.test(r.likely_outcome || "") ? "b-warn" : "b-bad";
  const L = ({ a }: { a?: string[] }) => (a?.length ? <ul>{a.map((x, i) => <li key={i}>{x}</li>)}</ul> : null);
  return (
    <div className="ai-out">
      {r.likely_outcome && <p style={{ margin: "10px 0 6px" }}><span className={"band " + cls}>{r.likely_outcome}</span></p>}
      {r.verdict && <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{r.verdict}</p>}
      {r.scores && <><h4>Panel scores (out of 10)</h4><div className="chips">{DIMS.filter(([k]) => r.scores![k] !== undefined).map(([k, l]) => <span key={k} className="chip">{l}: <b>{r.scores![k]}</b></span>)}</div></>}
      {!!r.top_fixes?.length && <><h4>Top fixes</h4><ol>{r.top_fixes.map((x, i) => <li key={i}>{x}</li>)}</ol></>}
      {!!r.strengths?.length && <><h4>Strengths</h4><L a={r.strengths} /></>}
      {!!r.weaknesses?.length && <><h4>Weaknesses</h4><L a={r.weaknesses} /></>}
      {!!r.section_comments?.length && <><h4>Section comments</h4><ul>{r.section_comments.map((s, i) => <li key={i}><b>{s.section}</b>: {s.comment}{s.rewrite && <><br /><span className="note">Suggested wording: {s.rewrite}</span></>}</li>)}</ul></>}
      {!!r.reviewer_questions?.length && <><h4>Questions the panel may ask</h4><L a={r.reviewer_questions} /></>}
    </div>
  );
}
