import { DIMS, DIM_NAME, PROPOSAL_STATUS, SECTIONS, fmt, num } from "../../../shared/src";
import type { AiReview, Evaluation, ProposalInput } from "../../../shared/src";

export interface ReportCtx { input: ProposalInput; ev: Evaluation; ai: AiReview | null; status: string; owner: string; institution: string; appName: string; }

const PRI: Record<string, string> = { h: "High", m: "Medium", l: "Low" };

export function reportData({ input: S, ev, ai, status, institution, appName }: ReportCtx) {
  const C = ev.scheme;
  return {
    title: S.title || "Untitled proposal",
    date: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" }),
    appName, institution,
    meta: [
      ["Agency", ev.agencyFull], ["Scheme / call", C.name], ["Thrust area", S.thrust || "–"],
      ["Principal Investigator", [S.piName, S.desig, S.dept, S.inst].filter(Boolean).join(", ") || "–"],
      ["Budget", `₹${fmt(ev.budget.total)} lakh (direct ₹${fmt(ev.budget.direct)} lakh + overhead ₹${fmt(ev.budget.oh)} lakh)`],
      ["Duration", `${num(S.dur)} months`], ["TRL", `${S.trlS} → ${S.trlE} (call usually funds TRL ${C.trl[0]}–${C.trl[1]})`],
      ["Status", PROPOSAL_STATUS[status] || status],
    ] as [string, string][],
    score: ev.overall, band: ev.band, level: ev.bandLevel,
    gates: ev.gates.map((g) => [g.st.toUpperCase(), g.text]) as [string, string][],
    dims: DIMS.map(([k, l]) => [l, String(ev.scores[k]), C.weights[k] + "%"]) as [string, string, string][],
    sections: ev.text.has ? { found: C.requiredSections.filter((k) => ev.text.found[k]).map((k) => SECTIONS[k]?.[0] ?? k), missing: ev.missing.map((k) => SECTIONS[k]?.[0] ?? k) } : null,
    sugg: ev.suggestions.map((x) => [PRI[x.p], DIM_NAME[x.dim], x.text]) as [string, string, string][],
    tips: C.tips,
    ai,
  };
}

export const STATUS_COLOR: Record<string, string> = { FAIL: "B23A32", WARN: "9A6200", PASS: "1F7A4D", INFO: "1D5C86", High: "B23A32", Medium: "9A6200", Low: "1D5C86" };
export const LEVEL_COLOR: Record<string, string> = { good: "1F7A4D", warn: "9A6200", bad: "B23A32" };
