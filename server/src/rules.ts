import fs from "node:fs";
import path from "node:path";
import type { AgencyRule, RuleBook } from "../../shared/src";
import { DIMS, SECTIONS } from "../../shared/src";
import { paths } from "./config";

let book: RuleBook = {};

/** Check one agency file; returns a list of problems (empty = valid). */
export function validateAgency(a: AgencyRule): string[] {
  const errs: string[] = [];
  if (!a.id || !a.name || !a.schemes) errs.push("id, name and schemes are required");
  for (const [id, s] of Object.entries(a.schemes || {})) {
    const sum = DIMS.reduce((t, [k]) => t + (s.weights?.[k] || 0), 0);
    if (sum !== 100) errs.push(`${id}: weights add up to ${sum}, not 100`);
    if (!Array.isArray(s.trl) || s.trl.length !== 2) errs.push(`${id}: trl must be [from, to]`);
    for (const k of s.requiredSections || []) if (!SECTIONS[k]) errs.push(`${id}: unknown section "${k}"`);
  }
  return errs;
}

export function loadRules(): RuleBook {
  const next: RuleBook = {};
  for (const f of fs.readdirSync(paths.rules).filter((x) => x.endsWith(".json"))) {
    const a = JSON.parse(fs.readFileSync(path.join(paths.rules, f), "utf8")) as AgencyRule;
    const errs = validateAgency(a);
    if (errs.length) throw new Error(`rules/agencies/${f}: ${errs.join("; ")}`);
    next[a.id] = a;
  }
  book = Object.fromEntries(Object.entries(next).sort((x, y) => (x[1].order ?? 99) - (y[1].order ?? 99)));
  return book;
}
export const rules = () => book;
