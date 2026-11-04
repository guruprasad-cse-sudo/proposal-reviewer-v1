import { PROJECT_STATUS } from "./constants";
import type { AiReview, Evaluation, ProposalInput, RuleBook } from "./types";

/** Prompt for the Claude expert-panel review. Built on the server. */
export function buildReviewPrompt(S: ProposalInput, ev: Evaluation, book: RuleBook, maxTextChars = 90000): string {
  const A = book[S.agency];
  const C = ev.scheme;
  const profile = {
    name: S.piName, designation: S.desig, institution: S.inst, department: S.dept, institution_type: S.instType, state: S.state,
    years_regular_service: S.yrs, age: S.age, phd: S.phd, phd_year: S.phdYear, expertise: S.expertise, self_rated_match_1to5: S.match,
    indexed_papers_5y: S.pubs5, papers_on_topic: S.topicPubs, h_index: S.hindex, patents_filed: S.patF, patents_granted: S.patG,
    phds_guided: S.phdG, tech_transfers: S.tot,
    funded_projects: (S.projects || []).map((p) => ({ agency: p.ag, scheme: p.sc, lakh: p.amt, year: p.yr, role: p.role, status: PROJECT_STATUS[p.st] })),
    co_pis: S.coPI, co_pi_work_packages_defined: S.coPIroles, interdisciplinary: S.interd, industry_partner: S.industry,
    facilities: { y: "available", p: "partly", n: "to be procured" }[S.facil],
  };
  const project = {
    title: S.title, keywords: S.keywords, type: S.ptype, duration_months: S.dur, trl_start: S.trlS, trl_end: S.trlE, novelty: S.novelty,
    deliverables: S.deliv, preliminary_results: S.prelim, risks_stated: S.risk, budget_lakh: ev.budget, foreign_travel: S.foreignTravel,
    users: S.users, route_to_use: S.route, market_cr_per_year: S.market, cost_advantage_pct: S.costAdv, ipr: S.ipr,
    import_substitution: S.importSub, national_mission_link: S.viksit, thrust_area: S.thrust, thrust_listed_in_call: S.thrustMapped,
    user_lab_contact: S.userContact, user_lab: S.userName,
  };
  const text = (S.ptext || "").slice(0, maxTextChars);
  return `You are a senior member of an Indian research funding review panel for ${A?.full ?? ev.agencyFull}, scheme "${C.name}". Review this proposal before submission as the panel would, and help the faculty member improve it.

Call guidance to apply:
${C.tips.map((t) => "- " + t).join("\n")}
Typical TRL range funded: ${C.trl[0]}-${C.trl[1]}. Usual maximum duration: ${C.maxMonths} months.${C.capLakh ? ` Budget cap: Rs ${C.capLakh} lakh.` : ""}
Weighting used by this tool (percent): ${JSON.stringify(C.weights)}.

Faculty profile (JSON): ${JSON.stringify(profile)}
Project details (JSON): ${JSON.stringify(project)}
Automated checks already found: ${JSON.stringify({ gates: ev.gates.map((g) => g.st + ": " + g.text), scores: ev.scores, suggestions: ev.suggestions.slice(0, 10).map((s) => s.text) })}

Proposal text:
"""
${text || "(no proposal text provided; review from the details above)"}
"""

Judge: PI capability and track record for this specific work, domain expertise fit, novelty against current literature, technical soundness of the methodology, feasibility of the TRL progression in the time and budget, budget justification, product feasibility and economic viability where the call expects it, alignment with the agency's mission and with Viksit Bharat 2047, and clarity of writing. Be specific and quote short phrases from the text where useful. Do not invent facts about the proposal.

Reply with ONLY a JSON object, no prose before or after, in this shape:
{"verdict":"2-3 sentence overall assessment","likely_outcome":"Recommend|Recommend with revisions|Borderline|Not recommended","scores":{"track":0-10,"expertise":0-10,"merit":0-10,"feasibility":0-10,"budget":0-10,"impact":0-10,"alignment":0-10,"quality":0-10},"strengths":["..."],"weaknesses":["..."],"top_fixes":["the 5 changes that would most raise the score, most important first"],"section_comments":[{"section":"name","comment":"what is wrong or missing","rewrite":"suggested replacement wording, or empty"}],"reviewer_questions":["questions the panel is likely to ask at presentation"]}`;
}

export function parseReviewJson(t: string): AiReview | null {
  const tryParse = (s: string) => { try { const o = JSON.parse(s); return o && typeof o === "object" ? (o as AiReview) : null; } catch { return null; } };
  const direct = tryParse(t);
  if (direct) return direct;
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  return a >= 0 && b > a ? tryParse(t.slice(a, b + 1)) : null;
}
