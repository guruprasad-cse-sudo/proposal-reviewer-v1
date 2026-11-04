import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { BLANK_INPUT, DIMS, SECTIONS, evaluate, allowedTransitions } from "../src";
import type { ProposalInput, RuleBook } from "../src";

const dir = join(__dirname, "../../rules/agencies");
const book: RuleBook = Object.fromEntries(
  readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => { const a = JSON.parse(readFileSync(join(dir, f), "utf8")); return [a.id, a]; }),
);
const NOW = new Date("2026-11-04");

const base = (o: Partial<ProposalInput> = {}): ProposalInput => ({
  ...BLANK_INPUT,
  piName: "Dr Test", pubs5: 10, topicPubs: 4, hindex: 12, match: "4", novelty: "Holds 4.3 V for 500 cycles, against 200 cycles in reported cathodes.",
  deliv: "Prototype\nPatent\nPapers", title: "Sodium-ion cathodes", keywords: "battery, solar storage", trlS: 2, trlE: 4, dur: 36,
  bEq: 30, bMp: 40, bCo: 20, bTr: 3, bCt: 3, bOt: 0, bOh: 10, quotes: true, prelim: "some",
  projects: [{ ag: "VGST", sc: "GRE", amt: 20, yr: 2019, role: "PI", st: "done" }],
  ...o,
});

describe("rule files", () => {
  for (const a of Object.values(book)) {
    for (const [id, s] of Object.entries(a.schemes)) {
      it(`${a.id}/${id} is well formed`, () => {
        const sum = DIMS.reduce((t, [k]) => t + (s.weights[k] || 0), 0);
        expect(sum).toBe(100);
        expect(s.trl[0]).toBeLessThanOrEqual(s.trl[1]);
        for (const k of s.requiredSections) expect(SECTIONS[k], `unknown section ${k}`).toBeTruthy();
        expect(s.tips.length).toBeGreaterThan(0);
      });
    }
  }
});

describe("evaluate", () => {
  it("scores a reasonable ARG proposal without eligibility failures", () => {
    const ev = evaluate(base({ agency: "anrf", scheme: "arg" }), book, NOW);
    expect(ev.fails).toBe(0);
    expect(ev.overall).toBeGreaterThan(40);
    expect(ev.overall).toBeLessThanOrEqual(100);
  });
  it("fails PM-ECRG when the PI already held a SERB grant", () => {
    const ev = evaluate(base({ agency: "anrf", scheme: "ecrg", projects: [{ ag: "SERB", sc: "CRG", amt: 30, yr: 2020, role: "PI", st: "done" }] }), book, NOW);
    expect(ev.gates.some((g) => g.st === "fail" && /not received an earlier grant/.test(g.text))).toBe(true);
    expect(ev.overall).toBeLessThanOrEqual(44);
  });
  it("fails PM-ECRG with a Co-PI and over the ₹60 lakh cap", () => {
    const ev = evaluate(base({ agency: "anrf", scheme: "ecrg", coPI: 1, bEq: 80 }), book, NOW);
    expect(ev.gates.filter((g) => g.st === "fail").length).toBeGreaterThanOrEqual(2);
  });
  it("requires Karnataka for VGST", () => {
    expect(evaluate(base({ agency: "vgst", scheme: "gre", state: "Tamil Nadu" }), book, NOW).fails).toBe(1);
    expect(evaluate(base({ agency: "vgst", scheme: "gre", state: "Karnataka" }), book, NOW).fails).toBe(0);
  });
  it("rejects foreign travel for ISRO RESPOND", () => {
    const ev = evaluate(base({ agency: "isro", scheme: "respond", foreignTravel: true }), book, NOW);
    expect(ev.gates.some((g) => g.st === "fail" && /travel abroad/.test(g.text))).toBe(true);
  });
  it("fails a DRDO board proposal submitted to two boards", () => {
    const ev = evaluate(base({ agency: "nrb", scheme: "short", dupSubmit: true }), book, NOW);
    expect(ev.fails).toBe(1);
  });
  it("flags an optimistic TRL jump", () => {
    const ev = evaluate(base({ agency: "mnre", scheme: "rertd", trlS: 2, trlE: 8, dur: 24 }), book, NOW);
    expect(ev.suggestions.some((s) => s.dim === "feasibility" && /TRL levels/.test(s.text))).toBe(true);
    expect(ev.scores.feasibility).toBeLessThan(50);
  });
  it("detects sections in proposal text", () => {
    const text = "Summary\nObjectives: reach 90% efficiency.\nMethodology\nTimeline\nDeliverables\nReferences " + "word ".repeat(100);
    const ev = evaluate(base({ ptext: text }), book, NOW);
    expect(ev.text.found.objectives).toBe(true);
    expect(ev.missing).toContain("gap");
  });
});

describe("workflow", () => {
  it("lets the owner send a draft to the R&D cell, and only reviewers approve", () => {
    expect(allowedTransitions("draft", true, "faculty").map((t) => t.to)).toContain("internal_review");
    expect(allowedTransitions("internal_review", true, "faculty").map((t) => t.to)).not.toContain("approved");
    expect(allowedTransitions("internal_review", false, "rd").map((t) => t.to)).toContain("approved");
  });
});
