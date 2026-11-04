/** Types shared by the web app and the server. */

export type DimKey = "track" | "expertise" | "merit" | "feasibility" | "budget" | "impact" | "alignment" | "quality";
export type Weights = Record<DimKey, number>;
export type ProjectKind = "basic" | "applied" | "tech" | "infra" | "mixed";

/** One scheme or call inside an agency file (rules/agencies/*.json). */
export interface SchemeRule {
  name: string;
  /** Budget cap in ₹ lakh. null = no fixed cap coded. */
  capLakh: number | null;
  /** true: exceeding the cap is a FAIL; false/absent: a WARN. */
  capHard?: boolean;
  /** Cap applies to direct cost only (overheads excluded). */
  capExcludesOverhead?: boolean;
  maxMonths: number;
  maxHard?: boolean;
  /** TRL window the call usually funds [from, to]. */
  trl: [number, number];
  kind: ProjectKind;
  phdRequired?: boolean;
  /** Early-career scheme: track record leans on publications, not past grants. */
  earlyCareer?: boolean;
  noCoPI?: boolean;
  /** Regex (case-insensitive) of agencies the PI must NOT have held a PI grant from. */
  neverFundedBy?: string;
  noForeignTravel?: boolean;
  /** Maximum words of proposal text (e.g. 2-page short proposal). */
  maxWords?: number;
  /** Proposal must state TRL at start and end. */
  trlStatementRequired?: boolean;
  /** Info note when budget exceeds this many lakh. */
  extraReviewAboveLakh?: number;
  /** Name-only Co-PIs are a high-priority problem. */
  coPIRolesCritical?: boolean;
  weights: Weights;
  requiredSections: string[];
  tips: string[];
}

/** Agency-wide rules. All optional; add new ones in scoring.ts. */
export interface AgencyRules {
  /** PI may hold only one project of this agency at a time. match = regex on agency names. */
  oneProjectAtATime?: { match: string };
  /** One proposal to one board only (DRDO research boards). */
  oneBoardOnly?: boolean;
  /** The outcome must link to a named user lab; value is the description. */
  requireUserLab?: string;
  /** Missing user lab is a WARN rather than a high-priority issue. */
  requireUserLabSoft?: boolean;
  requireThrustTopic?: string;
  requireDomainExpert?: boolean;
  /** Institution must be in this state. */
  requireState?: string;
  oneSchemePerCall?: string;
  privateCostShare?: string;
  requireCostComparison?: boolean;
  industryPartnerHelps?: boolean;
  mentionNationalMission?: boolean;
}

export interface AgencyRule {
  id: string;
  name: string;
  full: string;
  portal: string;
  order: number;
  rules: AgencyRules;
  /** Vocabulary that signals fit with the agency's mission. Empty = broad agency. */
  focus: string[];
  schemes: Record<string, SchemeRule>;
}
export type RuleBook = Record<string, AgencyRule>;

export type ProjectStatus = "done" | "ext" | "ongoing" | "incomplete";
export interface FundedProject { ag: string; sc: string; amt: number; yr: number | ""; role: "PI" | "Co-PI"; st: ProjectStatus; }

/** Faculty profile fields (also copied into each proposal). */
export interface Profile {
  piName: string; desig: string; inst: string; dept: string; instType: string; state: string;
  yrs: number | ""; age: number | ""; phdYear: number | ""; regular: boolean; phd: boolean; relax: boolean;
  expertise: string; match: string; pubs5: number | ""; topicPubs: number | ""; hindex: number | "";
  patF: number | ""; patG: number | ""; phdG: number | ""; tot: number | "";
  projects: FundedProject[];
}

/** Everything the scorer reads. */
export interface ProposalInput extends Profile {
  agency: string; scheme: string; thrust: string; thrustMapped: boolean; userContact: boolean; userName: string; dupSubmit: boolean;
  coPI: number | ""; facil: "y" | "p" | "n"; interd: boolean; industry: boolean; coPIroles: boolean;
  title: string; keywords: string; ptype: string; dur: number | ""; trlS: number; trlE: number;
  novelty: string; deliv: string; prelim: "none" | "some" | "strong"; risk: boolean;
  bEq: number | ""; bMp: number | ""; bCo: number | ""; bTr: number | ""; bCt: number | ""; bOt: number | ""; bOh: number | "";
  foreignTravel: boolean; quotes: boolean;
  users: string; route: "none" | "pubs" | "tot" | "startup" | "partner"; market: number | ""; costAdv: number | "";
  ipr: "none" | "planned" | "filed"; importSub: boolean; viksit: boolean;
  ptext: string;
}

export type GateStatus = "pass" | "warn" | "fail" | "info";
export interface Gate { st: GateStatus; text: string; }
export type Priority = "h" | "m" | "l";
export interface Suggestion { p: Priority; dim: DimKey | "eligibility"; text: string; }

export interface TextStats {
  words: number; found: Record<string, boolean>; recent: number; cites: number; quant: number; vague: number; has: boolean;
}

export interface Evaluation {
  agencyName: string; agencyFull: string; schemeName: string;
  scheme: SchemeRule;
  text: TextStats;
  gates: Gate[];
  suggestions: Suggestion[];
  scores: Record<DimKey, number>;
  overall: number;
  band: string;
  bandLevel: "good" | "warn" | "bad";
  fails: number;
  missing: string[];
  trlJump: number; trlRate: number;
  budget: { eq: number; mp: number; co: number; tr: number; ct: number; ot: number; oh: number; direct: number; total: number };
  track: { asPI: number; doneOnTime: number; doneExt: number; ongoing: number; totalLakh: number; incomplete: number };
}

export interface AiReview {
  verdict?: string;
  likely_outcome?: string;
  scores?: Partial<Record<DimKey, number>>;
  strengths?: string[];
  weaknesses?: string[];
  top_fixes?: string[];
  section_comments?: { section: string; comment: string; rewrite?: string }[];
  reviewer_questions?: string[];
}
