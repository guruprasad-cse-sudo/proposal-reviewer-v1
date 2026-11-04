/**
 * Rule-based pre-submission review. Pure function: same input + rules -> same result.
 * Runs in the browser (live review) and on the server (stored snapshot, reports).
 */
import { DIMS, SECTIONS } from "./constants";
import type { DimKey, Evaluation, Gate, GateStatus, Priority, ProposalInput, RuleBook, Suggestion, TextStats } from "./types";

export const num = (v: unknown): number => (v === "" || v === undefined || v === null || Number.isNaN(Number(v)) ? 0 : Number(v));
export const clamp = (v: number, a = 0, b = 100) => Math.max(a, Math.min(b, Math.round(v)));
export const fmt = (x: number) => (Math.round(x * 10) / 10).toLocaleString("en-IN");
const pct = (x: number) => Math.round(x * 100) + "%";

export function analyseText(t: string, now = new Date()): TextStats {
  t = t || "";
  const words = (t.match(/\S+/g) || []).length;
  const found: Record<string, boolean> = {};
  for (const k in SECTIONS) found[k] = SECTIONS[k][1].test(t);
  const yNow = now.getFullYear();
  const years = (t.match(/\b(19[89]\d|20[0-3]\d)\b/g) || []).map(Number).filter((y) => y <= yNow);
  const recent = years.filter((y) => y >= yNow - 4).length;
  const cites = (t.match(/\[\d+(?:[,–-]\s?\d+)*\]|\([A-Z][A-Za-z-]+( et al\.?)?,? (19|20)\d\d\)/g) || []).length;
  const quant = (t.match(/\d+(\.\d+)?\s?(%|percent|-?fold|x\b|mAh|Wh|kWh|MW|kW|W\b|V\b|mm|µm|um|nm|kg|MPa|GPa|Hz|kHz|MHz|GHz|dB|°C|K\b|ms\b|cycles|hours?|days|TRL)/gi) || []).length;
  const vague = (t.match(/\b(state[- ]of[- ]the[- ]art|cutting[- ]edge|revolutionary|world[- ]class|first of its kind|paradigm shift|significant(ly)? improve|novel)\b/gi) || []).length;
  return { words, found, recent, cites, quant, vague, has: words > 80 };
}

function kwOverlap(a: string, b: string) {
  const A = (a || "").toLowerCase().split(/[,;]+/).map((s) => s.trim()).filter((s) => s.length > 2);
  const B = (b || "").toLowerCase();
  return A.some((w) => B.includes(w));
}
function kwHit(list: string[], text: string) {
  const t = (text || "").toLowerCase();
  return list.some((w) => new RegExp("\\b" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).test(t));
}

export function bandOf(s: number, fails: number): [string, "good" | "warn" | "bad"] {
  if (fails) return ["Eligibility issue", "bad"];
  if (s >= 75) return ["Competitive", "good"];
  if (s >= 60) return ["Needs revision", "warn"];
  if (s >= 45) return ["Major gaps", "warn"];
  return ["Not ready", "bad"];
}

export function evaluate(S: ProposalInput, book: RuleBook, now = new Date()): Evaluation {
  const A = book[S.agency] || Object.values(book)[0];
  const C = A.schemes[S.scheme] || Object.values(A.schemes)[0];
  const AR = A.rules || {};
  const T = analyseText(S.ptext || "", now);
  const gates: Gate[] = [];
  const sug: Suggestion[] = [];
  const add = (p: Priority, dim: Suggestion["dim"], text: string) => sug.push({ p, dim, text });
  const gate = (st: GateStatus, text: string) => gates.push({ st, text });
  const infra = C.kind === "infra";

  /* ---- track record inputs ---- */
  const P = S.projects || [];
  const asPI = P.filter((p) => p.role === "PI");
  const doneOnTime = asPI.filter((p) => p.st === "done").length;
  const doneExt = asPI.filter((p) => p.st === "ext").length;
  const incomplete = P.filter((p) => p.st === "incomplete").length;
  const ongoing = P.filter((p) => p.st === "ongoing");
  const ongoingPI = ongoing.filter((p) => p.role === "PI");
  const totalLakh = P.reduce((s, p) => s + num(p.amt), 0);

  /* ---- budget ---- */
  const B = { eq: num(S.bEq), mp: num(S.bMp), co: num(S.bCo), tr: num(S.bTr), ct: num(S.bCt), ot: num(S.bOt), oh: num(S.bOh) };
  const direct = B.eq + B.mp + B.co + B.tr + B.ct + B.ot;
  const total = direct + B.oh;
  const years = Math.max(num(S.dur), 1) / 12;

  /* ---- eligibility and compliance gates ---- */
  if (!S.regular) gate("fail", "Most schemes require a regular (non-contract) position at the host institution. Contract and guest faculty are generally not eligible as PI.");
  else gate("pass", "Regular position at the host institution.");
  if (C.phdRequired && !S.phd) gate("fail", "This scheme expects the PI to hold a PhD.");
  if (C.neverFundedBy) {
    const re = new RegExp(C.neverFundedBy, "i");
    if (asPI.some((p) => re.test(p.ag))) gate("fail", `This scheme is for researchers who have not received an earlier grant as PI from ${C.neverFundedBy.toUpperCase().split("|").join("/")}. Your project list shows one.`);
    else gate("pass", `No earlier ${C.neverFundedBy.toUpperCase().split("|").join("/")} grant as PI, as this scheme requires.`);
  }
  if (C.noCoPI && num(S.coPI) > 0) gate("fail", "Co-PIs are not allowed under this scheme (except for PIO/OCI applicants). Remove the Co-PI(s) or move them to a collaborator role.");
  const capBase = C.capExcludesOverhead ? direct : total;
  if (C.capLakh) {
    if (capBase > C.capLakh) gate(C.capHard ? "fail" : "warn", `Budget ₹${fmt(capBase)} lakh exceeds the ₹${fmt(C.capLakh)} lakh limit for this scheme${C.capExcludesOverhead ? " (overheads excluded)" : ""}.`);
    else if (capBase > 0) gate("pass", `Budget ₹${fmt(capBase)} lakh is within the ₹${fmt(C.capLakh)} lakh limit.`);
  } else if (total > 0) gate("info", "No fixed budget cap is set for this call in the rules. Check the limit in the current call document.");
  if (C.extraReviewAboveLakh && total > C.extraReviewAboveLakh) gate("info", `Above ₹${fmt(C.extraReviewAboveLakh)} lakh: expect an additional level of technical evaluation.`);
  if (num(S.dur) > C.maxMonths) gate(C.maxHard ? "fail" : "warn", `Duration of ${num(S.dur)} months is longer than the ${C.maxMonths} months this call usually allows.`);
  if (AR.oneProjectAtATime) {
    const re = new RegExp(AR.oneProjectAtATime.match, "i");
    if (ongoingPI.some((p) => re.test(p.ag))) gate("warn", `You have an ongoing ${A.name} project as PI. In general ${A.name} allows a PI one project at a time: check how this call treats it.`);
  }
  if (AR.oneBoardOnly && S.dupSubmit) gate("fail", "A PI can submit a proposal to only one research board. Withdraw the overlapping submission or change the scope.");
  else if (S.dupSubmit) gate("warn", "An overlapping proposal is under review elsewhere. Declare it in the proposal; duplicate funding of the same work is not allowed.");
  if (AR.requireUserLab) {
    if (!S.userContact) gate("warn", `The outcome should link to a ${AR.requireUserLab}, and no discussion with one is recorded.`);
    else gate("pass", "User-lab discussion recorded" + (S.userName ? ` (${S.userName}).` : "."));
  }
  if (C.maxWords && T.has) {
    if (T.words > C.maxWords) gate("warn", `This stage has a strict length limit; your text has about ${T.words} words (limit about ${C.maxWords}).`);
    else gate("pass", `Text length (${T.words} words) fits the required format.`);
  }
  if (C.noForeignTravel && S.foreignTravel) gate("fail", "This scheme's funds cannot be used for travel abroad. Remove foreign travel from the budget.");
  if (AR.requireThrustTopic && !S.thrustMapped) gate("warn", `Proposals should answer a ${AR.requireThrustTopic}. Quote its topic code.`);
  if (AR.requireDomainExpert && num(S.match) < 3) gate("warn", "The agency asks that the PI be a domain expert in the proposal's area. Your stated expertise match is low.");
  if (AR.requireState) {
    if (!new RegExp(AR.requireState, "i").test(S.state || "")) gate("fail", `This agency's schemes are for regular faculty at institutions in ${AR.requireState}.`);
    else gate("pass", `Institution is in ${AR.requireState}.`);
  }
  if (AR.oneSchemePerCall) gate("info", `Apply to only one of ${AR.oneSchemePerCall} in a call.`);
  if (C.trlStatementRequired) {
    if (!(num(S.trlS) > 0 && num(S.trlE) > 0)) gate("fail", "The call asks for the TRL at the start and at the end of the project.");
    else if (T.has && !T.found.trl) gate("warn", "TRL start and end are set here but not mentioned in the proposal text. The call asks for both in the proposal.");
    else gate("pass", `TRL ${S.trlS} → ${S.trlE} stated.`);
  }
  if (AR.privateCostShare && S.instType === "private") gate("info", AR.privateCostShare);

  /* ---- dimension scores ---- */
  const sc = {} as Record<DimKey, number>;

  // PI track record
  const projPts = Math.min(100, doneOnTime * 30 + doneExt * 18 + ongoingPI.length * 10 + Math.min(totalLakh / 5, 20) - incomplete * 25 + (asPI.length ? 10 : 0));
  const pubPts = Math.min(100, num(S.pubs5) * 3.5 + num(S.hindex) * 1.5 + num(S.patG) * 10 + num(S.patF) * 4 + num(S.phdG) * 3 + num(S.tot) * 12);
  sc.track = C.earlyCareer ? clamp(0.25 * Math.max(projPts, 55) + 0.75 * pubPts) : clamp(0.55 * projPts + 0.45 * pubPts);
  if (incomplete) add("h", "track", "An earlier project is listed as closed without completion. Address it head-on: explain the cause and attach the final report or utilisation certificate status.");
  if (!C.earlyCareer && asPI.length === 0 && !infra) add("m", "track", "You have no completed project as PI. Lean on a Co-PI with a funded record, or start with an early-career or state scheme to build one.");
  if (doneExt > 0 && doneOnTime === 0) add("l", "track", "Your PI projects were completed with extensions. State the delivered outputs clearly so reviewers see completion, not delay.");
  if (num(S.pubs5) < 4) add("m", "track", "Fewer than four indexed papers in five years weakens the PI case. List your best 5 papers on this topic first, with journal and year.");

  // Domain expertise
  sc.expertise = clamp(num(S.match) * 14 + Math.min(num(S.topicPubs) * 6, 24) + (S.phd ? 6 : 0) + (kwOverlap(S.expertise, S.keywords + " " + S.title) ? 6 : 0));
  if (num(S.topicPubs) === 0) add("h", "expertise", "No publications on this topic are listed. Cite your own preliminary work or add a Co-PI or collaborator with papers in the area.");
  else if (num(S.match) <= 3) add("m", "expertise", "Your expertise only partly covers the topic. Name who in the team covers the gap and what they will do.");

  // Novelty and merit
  let merit = 20;
  const nov = (S.novelty || "").trim();
  if (nov.length > 40) merit += 20;
  else add("h", "merit", "Write one or two sentences on what is new compared with the best existing result. Reviewers score originality first.");
  if (/\d/.test(nov)) merit += 10;
  else if (nov.length > 40) add("m", "merit", "Put a number in the novelty statement (efficiency, cycles, accuracy, cost) so the advance can be judged.");
  merit += { none: 0, some: 15, strong: 25 }[S.prelim] || 0;
  if (S.prelim === "none" && !infra) add("m", "merit", "No preliminary results. Even one figure of proof-of-concept data greatly improves feasibility and merit scores.");
  if (T.has) {
    if (T.found.gap) merit += 8;
    else add("m", "merit", "State the research gap explicitly in a short subsection. Reviewers look for it between the literature review and the objectives.");
    if (T.found.sota) merit += 5;
    if (T.recent >= 3) merit += 7;
    else add("m", "merit", "Few recent citations (last 4 years) were found. Update the review of status with current international and national work.");
    if (T.vague > 4 && T.quant < 4) {
      merit -= 8;
      add("l", "merit", `The text uses words like "novel" or "state-of-the-art" ${T.vague} times but has few measurable targets. Replace adjectives with numbers.`);
    }
  }
  sc.merit = clamp(merit);

  // Feasibility and TRL
  const jump = num(S.trlE) - num(S.trlS);
  const rate = jump / years;
  let feas: number;
  if (infra) feas = 70;
  else if (jump <= 0) {
    feas = 40;
    add("h", "feasibility", "The completion TRL is not above the starting TRL. State what level the project reaches and how you will demonstrate it.");
  } else if (rate <= 1) feas = 88;
  else if (rate <= 1.5) feas = 74;
  else if (rate <= 2) feas = 55;
  else feas = 32;
  if (!infra && rate > 1.5) add("h", "feasibility", `The plan moves ${jump} TRL levels in ${fmt(years)} years. Panels see more than about 1.5 levels a year as optimistic: lower the end TRL or lengthen the project with clear stage gates.`);
  const [w0, w1] = C.trl;
  if (!infra && (num(S.trlS) < w0 || num(S.trlS) > w1)) {
    feas -= 15;
    add("m", "feasibility", `Starting TRL ${S.trlS} is outside the TRL ${w0}–${w1} range this call usually funds. ${num(S.trlS) < w0 ? "Show proof-of-concept first or choose a basic-research scheme." : "Consider a technology-development or industry-linked scheme instead."}`);
  }
  feas += { y: 8, p: 0, n: -18 }[S.facil] || 0;
  if (S.facil === "n") add("m", "feasibility", "Key facilities must be procured. Name the shared or partner facilities you can use in year 1 while equipment arrives.");
  if (S.risk) feas += 6;
  else if (!infra) add("m", "feasibility", "Add a short risk and mitigation table: the top three technical risks, with a fallback for each.");
  if (B.mp === 0 && !infra) {
    feas -= 8;
    add("m", "feasibility", "No manpower is budgeted. Name the JRF/SRF or project staff who will do the work.");
  }
  if (num(S.coPI) > 0 && !S.coPIroles && !C.noCoPI) {
    feas -= 6;
    add(C.coPIRolesCritical ? "h" : "m", "feasibility", "Give each Co-PI a defined work package and deliverable. A Co-PI in name only weakens the team score" + (C.coPIRolesCritical ? " and can lead to rejection at the pre-proposal stage." : "."));
  }
  if (S.interd) feas += 4;
  sc.feasibility = clamp(feas);

  // Budget
  let bud = 85;
  if (total === 0) {
    bud = 30;
    add("m", "budget", "Enter the budget so it can be checked against the call.");
  } else {
    const d = direct || 1;
    const eqS = B.eq / d, mpS = B.mp / d, trS = B.tr / d, ctS = B.ct / d;
    if (!infra && eqS > 0.6) { bud -= 20; add("h", "budget", `Equipment is ${pct(eqS)} of direct cost. For a research project panels expect a balance with manpower and consumables: justify each item or use shared facilities.`); }
    else if (!infra && eqS > 0.45) { bud -= 8; add("m", "budget", `Equipment is ${pct(eqS)} of direct cost. Add a line per item on why existing facilities cannot be used.`); }
    if (!infra && mpS < 0.15 && B.mp > 0) { bud -= 6; add("l", "budget", `Manpower is only ${pct(mpS)} of direct cost. Check that it covers the staff the work plan needs.`); }
    if (trS > 0.1) { bud -= 8; add("m", "budget", `Travel is ${pct(trS)} of direct cost, which is high. Tie each trip to a work-plan activity.`); }
    if (ctS > 0.1) { bud -= 5; add("l", "budget", "Contingency is above 10% of direct cost. Most calls allow a small fixed share: check the call norms."); }
    if (B.eq > 10 && !S.quotes) { bud -= 8; add("m", "budget", "Attach quotations (ideally three) for major equipment. Many panels will not recommend equipment without them."); }
    if (C.capLakh && capBase > C.capLakh) bud = 25;
    if (T.has && !T.found.budget) { bud -= 6; add("m", "budget", "The proposal text has no budget justification section. Justify every head: equipment, manpower, consumables, travel."); }
  }
  sc.budget = clamp(bud);

  // Impact and economic viability
  let econ = ({ none: 0, pubs: 10, tot: 30, startup: 28, partner: 42 } as Record<string, number>)[S.route] || 0;
  econ += Math.min(Math.max(num(S.costAdv), 0) / 1.5, 18);
  if (S.importSub) econ += 12;
  if (num(S.market) > 0) econ += 10;
  if ((S.users || "").trim().length > 5) econ += 10;
  econ += { none: 0, planned: 6, filed: 12 }[S.ipr] || 0;
  if (S.industry) econ += 8;
  const delivCount = (S.deliv || "").split(/\n/).filter((x) => x.trim()).length;
  const know = 45 + Math.min(num(S.phdG) * 3, 15) + (delivCount >= 3 ? 15 : 5) + (S.viksit ? 10 : 0);
  let imp: number;
  if (C.kind === "basic") imp = 0.35 * econ + 0.65 * know;
  else if (infra) imp = 0.3 * econ + 0.7 * (know + (S.users ? 10 : 0));
  else imp = 0.75 * econ + 0.25 * know;
  sc.impact = clamp(imp);
  if (C.kind === "tech" || C.kind === "applied") {
    if (S.route === "none" || S.route === "pubs") add("h", "impact", "No route to use is defined. For this call, name who takes the result forward: a user lab, an industry partner, technology transfer or a start-up.");
  }
  if (AR.requireCostComparison && num(S.costAdv) <= 0) add("h", "impact", "Give a cost comparison: expected ₹ per unit (₹/W, ₹/kWh, ₹/kg) against the current market product.");
  if (AR.industryPartnerHelps && !S.industry) add("m", "impact", "An industry partner with a support letter strengthens this proposal considerably.");
  if (AR.mentionNationalMission && !S.viksit) add("l", "impact", "Add a short paragraph linking the outcome to a national mission or Viksit Bharat 2047 goal.");
  if (!(S.deliv || "").trim()) add("h", "impact", "List concrete deliverables: prototypes, processes, software, datasets, patents and papers.");

  // Agency alignment
  let al = 25;
  const strictAlign = !!(AR.requireUserLab && !AR.requireUserLabSoft) || !!AR.requireThrustTopic;
  if (S.thrustMapped) al += 35;
  else add(strictAlign ? "h" : "m", "alignment", "Map the proposal to a thrust area or topic from the current call, and quote it on the title page.");
  if (S.userContact) al += 25;
  else if (AR.requireUserLab) add("h", "alignment", `Talk to the relevant ${AR.requireUserLab} before submitting and name the contact scientist. Proposals with no user interest rarely go forward.`);
  if (S.viksit) al += 8;
  const fk = A.focus || [];
  if (!fk.length) al += 7;
  else if (kwHit(fk, S.title + " " + S.keywords + " " + (S.ptext || "").slice(0, 4000))) al += 7;
  else add("m", "alignment", `The title and keywords do not use this agency's vocabulary (for example ${fk.slice(0, 4).join(", ")}). Make the link to the agency's mission explicit.`);
  sc.alignment = clamp(al);

  // Proposal completeness
  const req = C.requiredSections.filter((k) => SECTIONS[k]);
  const missing = req.filter((k) => !T.found[k]);
  let q: number;
  if (!T.has) {
    q = 30;
    add("m", "quality", "Upload or paste the proposal text to check its sections and writing.");
  } else {
    q = (65 * (req.length - missing.length)) / Math.max(req.length, 1) + Math.min(T.quant, 8) * 2.5 + (T.cites >= 10 ? 8 : T.cites >= 4 ? 4 : 0) + (T.words >= 1200 || C.maxWords ? 7 : 0);
    if (missing.length) add(missing.length > 3 ? "h" : "m", "quality", `Add the missing sections this call's format expects: ${missing.map((k) => SECTIONS[k][0]).join(", ")}.`);
    if (T.quant < 3) add("m", "quality", "The objectives have few measurable targets. Write each objective with a number and a unit that can be verified at review.");
    if (!C.maxWords && T.words < 1200) add("l", "quality", `The text is short (${T.words} words). A full proposal usually needs 3,000–6,000 words.`);
  }
  sc.quality = clamp(q);

  /* ---- overall ---- */
  let tot = 0, wsum = 0;
  for (const [k] of DIMS) { tot += sc[k] * (C.weights[k] || 0); wsum += C.weights[k] || 0; }
  let overall = Math.round(tot / Math.max(wsum, 1));
  const fails = gates.filter((g) => g.st === "fail").length;
  const highs = sug.filter((s) => s.p === "h").length;
  if (fails) overall = Math.min(overall, 44);
  else if (highs >= 2) overall = Math.min(overall, 74);

  const pr = { h: 0, m: 1, l: 2 };
  sug.sort((a, b) => pr[a.p] - pr[b.p] || ((C.weights as any)[b.dim] || 0) - ((C.weights as any)[a.dim] || 0));
  if (fails) sug.unshift({ p: "h", dim: "eligibility", text: "Resolve the eligibility issues marked FAIL first. A proposal that fails eligibility is usually rejected without review." });
  const order = ["fail", "warn", "info", "pass"];
  gates.sort((a, b) => order.indexOf(a.st) - order.indexOf(b.st));
  const [band, bandLevel] = bandOf(overall, fails);

  return {
    agencyName: A.name, agencyFull: A.full, schemeName: C.name, scheme: C, text: T, gates, suggestions: sug, scores: sc,
    overall, band, bandLevel, fails, missing, trlJump: jump, trlRate: rate,
    budget: { ...B, direct, total },
    track: { asPI: asPI.length, doneOnTime, doneExt, ongoing: ongoing.length, totalLakh, incomplete },
  };
}
