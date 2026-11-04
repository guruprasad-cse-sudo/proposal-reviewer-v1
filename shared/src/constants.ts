import type { DimKey, ProposalInput, Profile } from "./types";

export const DIMS: [DimKey, string][] = [
  ["track", "PI track record"],
  ["expertise", "Domain expertise fit"],
  ["merit", "Novelty and technical merit"],
  ["feasibility", "Feasibility and TRL plan"],
  ["budget", "Budget justification"],
  ["impact", "Impact and economic viability"],
  ["alignment", "Agency / mission alignment"],
  ["quality", "Proposal completeness"],
];
export const DIM_NAME: Record<string, string> = { ...Object.fromEntries(DIMS), eligibility: "Eligibility" };

/** Proposal sections the text checker looks for. Add a key here, then use it in requiredSections. */
export const SECTIONS: Record<string, [string, RegExp]> = {
  summary: ["Summary", /\b(abstract|summary|executive summary)\b/i],
  problem: ["Problem / origin", /\b(problem statement|introduction|background|origin of the proposal|rationale|motivation)\b/i],
  sota: ["State of the art", /\b(state[- ]of[- ](the[- ])?art|literature (review|survey)|review of (the )?literature|review of status|international status|national status)\b/i],
  gap: ["Research gap", /\b(research gaps?|gaps? in|lacuna|unmet need|limitations of (the )?existing)\b/i],
  novelty: ["Novelty", /\b(novelty|originality|innovativeness)\b/i],
  objectives: ["Objectives", /\b(objectives?|specific aims|aims of)\b/i],
  methodology: ["Methodology", /\b(methodology|methods|research design|experimental (plan|design)|work ?plan|approach)\b/i],
  timeline: ["Timeline / milestones", /\b(timeline|time ?line|gantt|milestones?|work schedule|activity chart|year[- ]wise)\b/i],
  deliverables: ["Deliverables", /\b(deliverables?|expected outcomes?|outcomes)\b/i],
  trl: ["TRL", /\b(TRL|technology readiness)\b/i],
  budget: ["Budget justification", /\b(budget|cost estimate|justification (for|of) (budget|equipment|manpower))\b/i],
  risk: ["Risk and mitigation", /\b(risk|mitigation|fallback|alternative strateg)/i],
  prelim: ["Preliminary results", /\b(preliminary (results|work|data|studies)|proof[- ]of[- ]concept|pilot (study|data))\b/i],
  ipr: ["IPR / commercialisation", /\b(IPR|patent|intellectual property|technology transfer|commerciali[sz])/i],
  facilities: ["Facilities available", /\b(facilit(y|ies) available|existing facilities|available (infrastructure|equipment|facilities))\b/i],
  relevance: ["Relevance to user", /\b(relevance|end[- ]user|user lab|application to|national (importance|need)|services? (requirement|application))\b/i],
  references: ["References", /\b(references|bibliography)\b/i],
};

export const PROJECT_STATUS: Record<string, string> = {
  done: "Completed on time", ext: "Completed with extension", ongoing: "Ongoing", incomplete: "Closed / not completed",
};

export const PROPOSAL_STATUS: Record<string, string> = {
  draft: "Draft",
  internal_review: "With R&D cell",
  changes_requested: "Changes requested",
  approved: "Approved to submit",
  submitted: "Submitted to agency",
  sanctioned: "Sanctioned",
  not_sanctioned: "Not sanctioned",
  withdrawn: "Withdrawn",
};

export const PROFILE_KEYS: (keyof Profile)[] = [
  "piName", "desig", "inst", "dept", "instType", "state", "yrs", "age", "phdYear", "regular", "phd", "relax",
  "expertise", "match", "pubs5", "topicPubs", "hindex", "patF", "patG", "phdG", "tot", "projects",
];

export const BLANK_INPUT: ProposalInput = {
  agency: "anrf", scheme: "arg", thrust: "", thrustMapped: false, userContact: false, userName: "", dupSubmit: false,
  piName: "", desig: "Assistant Professor", inst: "", dept: "", instType: "private", state: "Karnataka", yrs: "", age: "", phdYear: "",
  regular: true, phd: true, relax: false, expertise: "", match: "4", pubs5: "", topicPubs: "", hindex: "", patF: "", patG: "", phdG: "", tot: "",
  projects: [], coPI: 0, facil: "p", interd: false, industry: false, coPIroles: false,
  title: "", keywords: "", ptype: "basic", dur: 36, trlS: 1, trlE: 3, novelty: "", deliv: "", prelim: "none", risk: false,
  bEq: "", bMp: "", bCo: "", bTr: "", bCt: "", bOt: "", bOh: "", foreignTravel: false, quotes: false,
  users: "", route: "none", market: "", costAdv: "", ipr: "none", importSub: false, viksit: false, ptext: "",
};
