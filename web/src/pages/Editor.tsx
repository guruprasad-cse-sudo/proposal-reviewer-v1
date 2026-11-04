import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PROFILE_KEYS, PROPOSAL_STATUS, evaluate, fmt } from "../../../shared/src";
import type { AiReview, ProposalInput } from "../../../shared/src";
import { api, download } from "../api";
import { useApp } from "../ctx";
import { Area, Check, FormProvider, Num, ProfileFields, Sel, Text } from "../components/Fields";
import { AiReviewView, ReviewPanel } from "../components/ReviewPanel";

interface Detail {
  id: number; status: string; owner: { name: string; email: string; dept: string }; own: boolean; input: ProposalInput; file_name: string | null;
  ai_review: AiReview | null; ai_reviewed_at: string | null; canEdit: boolean; transitions: { to: string; label: string; by: string }[];
  comments: { id: number; body: string; created_at: string; author: string; role: string }[];
  history: { from_status: string | null; to_status: string; note: string | null; at: string; by_name: string | null }[];
  updated_at: string;
}
const when = (s: string) => new Date(s).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const TRL_OPTS: [number, string][] = Array.from({ length: 9 }, (_, i) => [i + 1, "TRL " + (i + 1)]);

export default function Editor() {
  const { id } = useParams();
  const { rules, app, me, toast } = useApp();
  const nav = useNavigate();
  const [d, setD] = useState<Detail | null>(null);
  const [v, setV] = useState<ProposalInput | null>(null);
  const [tab, setTab] = useState(1);
  const [save, setSave] = useState<"saved" | "dirty" | "saving" | "error">("saved");
  const [err, setErr] = useState("");
  const [ai, setAi] = useState<{ busy: boolean; msg: string }>({ busy: false, msg: "" });
  const [dialog, setDialog] = useState<{ to: string; label: string } | null>(null);
  const [note, setNote] = useState("");
  const [comment, setComment] = useState("");
  const [fileNote, setFileNote] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const timer = useRef<number>();

  const load = useCallback(async () => {
    try { const r = await api<Detail>(`/proposals/${id}`); setD(r); setV(r.input); setSave("saved"); }
    catch (e: any) { setErr(e.message); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const ev = useMemo(() => (v && rules[v.agency] ? evaluate(v, rules) : null), [v, rules]);

  const persist = useCallback(async (next: ProposalInput, fname?: string | null) => {
    setSave("saving");
    try { await api(`/proposals/${id}`, { method: "PUT", body: { input: next, file_name: fname ?? undefined } }); setSave("saved"); }
    catch (e: any) { setSave("error"); toast(e.message); }
  }, [id, toast]);

  const set = (k: string, val: unknown) => {
    setV((cur) => {
      if (!cur) return cur;
      const next: any = { ...cur, [k]: val };
      if (k === "agency") next.scheme = Object.keys(rules[val as string]?.schemes || {})[0];
      window.clearTimeout(timer.current);
      setSave("dirty");
      timer.current = window.setTimeout(() => persist(next), 1200);
      return next;
    });
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);

  if (err) return <div className="panel pad"><p className="err">{err}</p><Link to="/">Back to proposals</Link></div>;
  if (!d || !v || !ev) return <p className="note">Loading…</p>;
  const A = rules[v.agency], C = ev.scheme;
  const locked = !d.canEdit;

  const flush = async () => { if (save === "dirty") { window.clearTimeout(timer.current); await persist(v); } };
  const doTransition = async (to: string, n = "") => {
    try { await flush(); await api(`/proposals/${id}/status`, { body: { to, note: n } }); setDialog(null); setNote(""); await load(); toast(PROPOSAL_STATUS[to]); }
    catch (e: any) { toast(e.message); }
  };
  const askTransition = (t: { to: string; label: string }) => {
    if (["changes_requested", "sanctioned", "not_sanctioned", "internal_review"].includes(t.to)) { setNote(""); setDialog(t); }
    else doTransition(t.to);
  };
  const runAi = async () => {
    setAi({ busy: true, msg: "Claude is reading the proposal. This takes about a minute…" });
    try { await flush(); const r = await api<{ ai_review: AiReview }>(`/proposals/${id}/ai-review`, { method: "POST" }); setD({ ...d, ai_review: r.ai_review, ai_reviewed_at: new Date().toISOString() }); setAi({ busy: false, msg: "" }); }
    catch (e: any) { setAi({ busy: false, msg: e.message }); }
  };
  const dl = async (kind: "docx" | "pdf") => { try { await flush(); await download(`/proposals/${id}/report.${kind}`, `review.${kind}`); } catch (e: any) { toast(e.message); } };
  const upload = async (f: File) => {
    setFileNote(`Reading ${f.name}…`);
    const form = new FormData(); form.append("file", f);
    try {
      const r = await api<{ text: string; words: number; scanned: boolean }>("/parse", { form });
      setFileName(f.name);
      window.clearTimeout(timer.current);
      const next = { ...v, ptext: r.text };
      setV(next);
      await persist(next, f.name);
      setFileNote(r.scanned ? "This PDF has almost no text (it may be a scan). Paste the text instead." : `Read ${f.name}: ${r.words.toLocaleString("en-IN")} words.`);
    } catch (e: any) { setFileNote(e.message); }
  };
  const addComment = async () => {
    if (!comment.trim()) return;
    try { await api(`/proposals/${id}/comments`, { body: { body: comment } }); setComment(""); await load(); } catch (e: any) { toast(e.message); }
  };
  const saveToProfile = async () => {
    const profile = Object.fromEntries(PROFILE_KEYS.map((k) => [k, (v as any)[k]]));
    try { await api("/profile", { method: "PUT", body: { profile } }); toast("Saved to your profile"); } catch (e: any) { toast(e.message); }
  };
  const loadFromProfile = async () => {
    const r = await api<{ profile: any }>("/profile");
    PROFILE_KEYS.forEach((k) => { if (r.profile[k] !== undefined) set(k, r.profile[k]); });
    toast("Profile details loaded");
  };
  const del = async () => { if (!window.confirm("Delete this draft?")) return; try { await api(`/proposals/${id}`, { method: "DELETE" }); nav("/"); } catch (e: any) { toast(e.message); } };

  const T = ev.text;
  return (
    <>
      <div className="page-head">
        <div>
          <p style={{ margin: 0 }}><Link to="/">← Proposals</Link></p>
          <h1>{v.title || "Untitled proposal"}</h1>
          <p>{d.owner.name}{d.owner.dept ? ` · ${d.owner.dept}` : ""} · {ev.agencyName} · {C.name}</p>
        </div>
        <div className="row">
          <button type="button" onClick={() => dl("docx")}>Download Word</button>
          <button type="button" onClick={() => dl("pdf")}>Download PDF</button>
        </div>
      </div>

      <div className="panel workflow">
        <div className="row">
          <span className={"status st-" + d.status}>{PROPOSAL_STATUS[d.status]}</span>
          {locked ? <span className="lock">{d.own ? "Locked while it is with the R&D cell or the agency." : "Read-only: you can comment and change its status."}</span>
            : <span className="saved">{{ saved: "All changes saved", dirty: "Unsaved changes…", saving: "Saving…", error: "Not saved: check your connection" }[save]}</span>}
        </div>
        <div className="row">
          {d.transitions.map((t) => <button key={t.to} type="button" className={t.to === "internal_review" || t.to === "approved" ? "primary" : undefined} onClick={() => askTransition(t)}>{t.label}</button>)}
          {d.status === "draft" && d.own && <button type="button" className="danger" onClick={del}>Delete</button>}
        </div>
      </div>

      <div className="editor">
        <div style={{ display: "grid", gap: 16 }}>
          <div className="panel">
            <div className="tabs" role="tablist">
              {["Call", "Faculty profile", "Project", "Proposal text"].map((l, i) => (
                <button key={l} role="tab" type="button" aria-selected={tab === i + 1} onClick={() => setTab(i + 1)}><span className="n">0{i + 1}</span>{l}</button>
              ))}
            </div>
            <FormProvider v={v} set={set} disabled={locked}>
              {tab === 1 && <div className="tabpane">
                <div className="fields">
                  <Sel k="agency" label="Funding agency" options={Object.values(rules).map((a) => [a.id, `${a.name} · ${a.full}`])} />
                  <Sel k="scheme" label="Scheme / call" options={Object.entries(A.schemes).map(([k, s]) => [k, s.name])} />
                  <Text k="title" label="Proposal title" full />
                  <Text k="thrust" label="Thrust area / topic code from the call" hint="e.g. RESPOND Basket topic ID, NRB/AR&DB panel, MNRE thrust area, ANRF subject area" full />
                  <Check k="thrustMapped" label="The topic is listed in the agency's current thrust areas / call document" full />
                  <Check k="userContact" label="I have discussed the work with a user lab / ISRO centre / industry end-user" full />
                  <Text k="userName" label="User lab or end-user named in the proposal" hint="e.g. NPOL Kochi, ADE Bengaluru, URSC, a DPIIT start-up, a state nodal agency" full />
                  <Check k="dupSubmit" label="The same or an overlapping proposal is under review with another agency or board" full />
                </div>
                <fieldset style={{ marginTop: 16 }}>
                  <legend>What this call looks for</legend>
                  <p className="note" style={{ marginTop: 0 }}>{A.full} · submit via {A.portal}{C.capLakh ? ` · cap ₹${fmt(C.capLakh)} lakh` : ""} · usually up to {C.maxMonths} months · TRL {C.trl[0]}–{C.trl[1]}</p>
                  <ul className="tips">{C.tips.map((t, i) => <li key={i}>{t}</li>)}</ul>
                </fieldset>
              </div>}

              {tab === 2 && <div className="tabpane">
                {!locked && <div className="row" style={{ marginBottom: 12 }}>
                  <button type="button" onClick={loadFromProfile}>Fill from my saved profile</button>
                  <button type="button" onClick={saveToProfile}>Save these details to my profile</button>
                </div>}
                <ProfileFields />
                <p className="sum-line">{ev.track.asPI} as PI · {ev.track.doneOnTime} completed on time · {ev.track.doneExt} with extension · {ev.track.ongoing} ongoing · ₹{fmt(ev.track.totalLakh)} lakh in total</p>
                <fieldset style={{ marginTop: 14 }}>
                  <legend>Team and facilities</legend>
                  <div className="fields">
                    <Num k="coPI" label="Number of Co-PIs" />
                    <Sel k="facil" label="Key facilities in-house" options={[["y", "Available"], ["p", "Partly available / shared"], ["n", "To be procured"]]} />
                    <Check k="interd" label="Team spans disciplines" />
                    <Check k="industry" label="Industry partner with a letter of support" />
                    <Check k="coPIroles" label="Each Co-PI has a defined work package" full />
                  </div>
                </fieldset>
              </div>}

              {tab === 3 && <div className="tabpane">
                <fieldset><legend>Project basics</legend><div className="fields">
                  <Text k="keywords" label="Keywords" full />
                  <Sel k="ptype" label="Type of project" options={[["basic", "Basic"], ["applied", "Applied"], ["futuristic", "Futuristic"], ["tech", "Technology development / demonstration"], ["infra", "Infrastructure / facility"]]} />
                  <Num k="dur" label="Duration (months)" step={6} min={6} />
                  <Sel k="trlS" label="TRL at submission" options={TRL_OPTS} asNumber />
                  <Sel k="trlE" label="TRL at completion" options={TRL_OPTS} asNumber />
                  <Area k="novelty" label="What is new, in one or two lines" hint="State the advance over the best existing result, with a number if you can" />
                  <Area k="deliv" label="Deliverables" hint="One per line: prototype, algorithm, dataset, process, publications, patents" />
                  <Sel k="prelim" label="Preliminary results" options={[["none", "None yet"], ["some", "Some / proof of concept"], ["strong", "Strong, published or demonstrated"]]} />
                  <Check k="risk" label="Risks and fallback plans are stated" />
                </div></fieldset>
                <fieldset><legend>Budget (₹ lakh, whole project)</legend><div className="fields">
                  <Num k="bEq" label="Equipment" step={0.5} /><Num k="bMp" label="Manpower" step={0.5} /><Num k="bCo" label="Consumables" step={0.5} />
                  <Num k="bTr" label="Travel" step={0.5} /><Num k="bCt" label="Contingency" step={0.5} /><Num k="bOt" label="Other / services" step={0.5} />
                  <Num k="bOh" label="Overhead" step={0.5} />
                  <Check k="foreignTravel" label="Budget includes foreign travel" /><Check k="quotes" label="Quotations attached for major equipment" />
                </div>
                <p className="sum-line">Direct ₹{fmt(ev.budget.direct)} lakh + overhead ₹{fmt(ev.budget.oh)} lakh = ₹{fmt(ev.budget.total)} lakh{ev.budget.direct ? ` · equipment ${Math.round((ev.budget.eq / ev.budget.direct) * 100)}% · manpower ${Math.round((ev.budget.mp / ev.budget.direct) * 100)}%` : ""}</p></fieldset>
                <fieldset><legend>Product feasibility and economic viability</legend><div className="fields">
                  <Text k="users" label="Who will use the result" full />
                  <Sel k="route" label="Route to use" options={[["none", "Not defined"], ["pubs", "Knowledge only (papers, students)"], ["tot", "Technology transfer to industry / lab"], ["startup", "Start-up / incubation"], ["partner", "Committed industry or user partner"]]} />
                  <Num k="market" label="Addressable market (₹ crore / yr)" />
                  <Num k="costAdv" label="Cost advantage vs existing (%)" min={-100} />
                  <Sel k="ipr" label="IPR plan" options={[["none", "None"], ["planned", "Patent planned"], ["filed", "Patent already filed"]]} />
                  <Check k="importSub" label="Replaces an imported product (Atmanirbhar)" />
                  <Check k="viksit" label="Links to a named national mission / Viksit Bharat 2047 goal" />
                </div></fieldset>
              </div>}

              {tab === 4 && <div className="tabpane">
                {!locked && <div className="drop" onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("over"); }} onDragLeave={(e) => e.currentTarget.classList.remove("over")}
                  onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove("over"); const f = e.dataTransfer.files[0]; if (f) upload(f); }}>
                  <p style={{ margin: "0 0 8px" }}>Drop the proposal here (.pdf, .docx, .txt) or</p>
                  <input type="file" id="file" accept=".pdf,.docx,.txt,.md" style={{ maxWidth: 280, margin: "0 auto" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
                  <p className="note">{fileNote || (fileName || d.file_name ? `Current text came from ${fileName || d.file_name}.` : "The text is extracted on the server; the file itself is not stored.")}</p>
                </div>}
                <label style={{ marginTop: 12 }}>Proposal text<textarea id="f-ptext" style={{ minHeight: 360 }} value={v.ptext} disabled={locked} onChange={(e) => set("ptext", e.target.value)} /></label>
                <p className="sum-line">{T.has ? `${T.words.toLocaleString("en-IN")} words · ${T.cites} citations detected · ${T.recent} recent years cited · ${T.quant} measurable targets` : "No text yet."}</p>
              </div>}
            </FormProvider>
          </div>

          <div className="panel pad">
            <h2 style={{ marginBottom: 10 }}>Comments</h2>
            <div className="thread">
              {d.comments.map((c) => <div key={c.id} className={"cmt" + (c.role !== "faculty" ? " rd" : "")}><b>{c.author}</b>{c.role !== "faculty" && <span className="note"> · R&amp;D cell</span>}<span className="when">{when(c.created_at)}</span><div style={{ whiteSpace: "pre-wrap" }}>{c.body}</div></div>)}
              {!d.comments.length && <p className="note" style={{ margin: 0 }}>No comments yet.</p>}
            </div>
            <label style={{ marginTop: 12 }}>Add a comment<textarea id="comment" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} /></label>
            <div className="row" style={{ marginTop: 8 }}><button type="button" onClick={addComment} disabled={!comment.trim()}>Post comment</button></div>
            <h3 style={{ margin: "18px 0 6px" }}>History</h3>
            <ul className="hist">{d.history.map((h, i) => <li key={i}>{when(h.at)} · {PROPOSAL_STATUS[h.to_status] || h.to_status}{h.by_name ? ` by ${h.by_name}` : ""}</li>)}</ul>
          </div>
        </div>

        <ReviewPanel ev={ev} input={v}>
          <section className="blk">
            <h3>Expert-panel review by Claude {d.ai_reviewed_at && <small>last run {when(d.ai_reviewed_at)}</small>}</h3>
            {app?.ai ? <>
              <p className="note" style={{ marginTop: 0 }}>Claude reads the full proposal against this call's criteria and writes reviewer-style comments, likely panel questions and rewrites for weak sections. The result is saved and included in the Word and PDF reports.</p>
              <div className="row" style={{ margin: "8px 0" }}><button className="primary" type="button" disabled={ai.busy} onClick={runAi}>{ai.busy ? "Reviewing…" : d.ai_review ? "Run the review again" : "Run expert review"}</button></div>
              {ai.msg && <p className={ai.busy ? "note" : "err"}>{ai.msg}</p>}
            </> : <p className="note" style={{ marginTop: 0 }}>The Claude review is not set up on this server yet{me?.role === "admin" ? ": add ANTHROPIC_API_KEY in the Render environment settings." : ". Ask the administrator to add the API key."}</p>}
            {d.ai_review && <AiReviewView r={d.ai_review} />}
          </section>
        </ReviewPanel>
      </div>

      {dialog && <div className="modal-bg" role="dialog" aria-modal="true" aria-labelledby="dlg-t">
        <div className="modal">
          <h2 id="dlg-t">{dialog.label}</h2>
          <label>{dialog.to === "changes_requested" ? "What needs to change (required)" : dialog.to.includes("sanctioned") ? "Note on the outcome (amount, reviewer comments)" : "Note for the R&D cell (optional)"}
            <textarea id="dlg-note" rows={5} value={note} onChange={(e) => setNote(e.target.value)} autoFocus /></label>
          {dialog.to === "internal_review" && ev.fails > 0 && <p className="err">This proposal still has {ev.fails} eligibility issue{ev.fails > 1 ? "s" : ""} marked FAIL.</p>}
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button type="button" onClick={() => setDialog(null)}>Cancel</button>
            <button type="button" className="primary" disabled={dialog.to === "changes_requested" && !note.trim()} onClick={() => doTransition(dialog.to, note)}>{dialog.label}</button>
          </div>
        </div>
      </div>}
    </>
  );
}
