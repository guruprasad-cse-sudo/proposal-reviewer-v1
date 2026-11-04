import path from "node:path";
import PDFDocument from "pdfkit";
import { DIMS } from "../../../shared/src";
import { paths } from "../config";
import { LEVEL_COLOR, STATUS_COLOR, reportData, type ReportCtx } from "./data";

const INK = "#14212C", MUTED = "#5B6B78", ACC = "#1D5C86", RULE = "#D9E0E6", HEAD_BG = "#E3EEF6";

export function buildPdf(ctx: ReportCtx): Promise<Buffer> {
  const d = reportData(ctx);
  const doc = new PDFDocument({ size: "A4", margins: { top: 54, bottom: 60, left: 50, right: 50 }, bufferPages: true, info: { Title: "Review: " + d.title, Creator: d.appName } });
  doc.registerFont("R", path.join(paths.fonts, "DejaVuSans.ttf"));
  doc.registerFont("B", path.join(paths.fonts, "DejaVuSans-Bold.ttf"));
  doc.registerFont("I", path.join(paths.fonts, "DejaVuSans-Oblique.ttf"));
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise<Buffer>((ok) => doc.on("end", () => ok(Buffer.concat(chunks))));

  const L = doc.page.margins.left, W = doc.page.width - L - doc.page.margins.right;
  const bottom = () => doc.page.height - doc.page.margins.bottom;
  const ensure = (h: number) => { if (doc.y + h > bottom()) doc.addPage(); };
  const text = (t: string, o: { size?: number; font?: string; color?: string; gap?: number } = {}) => {
    doc.font(o.font || "R").fontSize(o.size || 9.5).fillColor(o.color || INK);
    ensure(doc.heightOfString(t, { width: W }));
    doc.text(t, L, doc.y, { width: W, lineGap: 1.5 });
    doc.y += o.gap ?? 4;
  };
  const head = (t: string) => {
    doc.y += 10; ensure(70);
    doc.font("B").fontSize(13).fillColor(INK).text(t, L, doc.y, { width: W });
    doc.moveTo(L, doc.y + 2).lineTo(L + 34, doc.y + 2).lineWidth(1.2).strokeColor(ACC).stroke();
    doc.y += 9;
  };
  const table = (headRow: string[] | null, rows: string[][], widths: number[], colorCol = -1) => {
    const ws = widths.map((w) => (W * w) / 100), pad = 5;
    const rowH = (r: string[], font: string) => Math.max(...r.map((c, i) => { doc.font(font).fontSize(8.5); return doc.heightOfString(c, { width: ws[i] - 2 * pad }); })) + 2 * pad;
    const draw = (r: string[], font: string, fill?: string, colorFor?: (c: string, i: number) => string | undefined) => {
      const h = rowH(r, font);
      if (doc.y + h > bottom()) { doc.addPage(); if (headRow && r !== headRow) draw(headRow, "B", HEAD_BG, () => ACC); }
      const y = doc.y; let x = L;
      if (fill) doc.rect(L, y, W, h).fill(fill);
      r.forEach((c, i) => {
        const col = colorFor?.(c, i);
        doc.font(col && i === colorCol ? "B" : font).fontSize(8.5).fillColor(col || INK).text(c, x + pad, y + pad, { width: ws[i] - 2 * pad, lineGap: 1 });
        x += ws[i];
      });
      doc.moveTo(L, y + h).lineTo(L + W, y + h).lineWidth(0.5).strokeColor(RULE).stroke();
      doc.y = y + h;
    };
    if (headRow) { ensure(rowH(headRow, "B") + 24); draw(headRow, "B", HEAD_BG, () => ACC); }
    else doc.moveTo(L, doc.y).lineTo(L + W, doc.y).lineWidth(0.5).strokeColor(RULE).stroke();
    rows.forEach((r) => draw(r, "R", undefined, (c, i) => (i === colorCol ? "#" + (STATUS_COLOR[c] || "14212C") : undefined)));
    doc.y += 8;
  };

  text(("PRE-SUBMISSION REVIEW" + (d.institution ? " · " + d.institution : "")).toUpperCase(), { size: 8, font: "B", color: ACC, gap: 6 });
  text(d.title, { size: 18, font: "B", gap: 4 });
  text(`Prepared ${d.date} with ${d.appName}`, { size: 8.5, color: MUTED, gap: 10 });
  doc.font("B").fontSize(15).fillColor(INK).text(`Readiness ${d.score}/100  `, L, doc.y, { continued: true }).fillColor("#" + LEVEL_COLOR[d.level]).text(d.band);
  doc.y += 8;
  table(null, d.meta, [28, 72]);
  head("Eligibility and compliance"); table(["Status", "Check"], d.gates, [14, 86], 0);
  head("Scorecard"); table(["Dimension", "Score /100", "Weight"], d.dims, [60, 20, 20]);
  if (d.sections) {
    head("Proposal sections");
    text("Found: " + (d.sections.found.join(", ") || "none"));
    if (d.sections.missing.length) text("Missing: " + d.sections.missing.join(", "), { color: "#B23A32" });
  }
  head("Suggestions"); table(["Priority", "Area", "Suggestion"], d.sugg, [12, 22, 66], 0);
  head("What this call looks for"); d.tips.forEach((t) => text("•  " + t));
  const a = d.ai;
  if (a) {
    head("Expert-panel review by Claude");
    if (a.likely_outcome) text("Likely outcome: " + a.likely_outcome, { font: "B" });
    if (a.verdict) text(a.verdict);
    if (a.scores) { doc.y += 4; table(["Dimension", "Panel score /10"], DIMS.filter(([k]) => a.scores![k] !== undefined).map(([k, l]) => [l, String(a.scores![k])]), [70, 30]); }
    const list = (title: string, arr?: string[], numbered = false) => {
      if (!arr?.length) return;
      doc.y += 4; text(title, { size: 11, font: "B", color: ACC, gap: 5 });
      arr.forEach((t, i) => text((numbered ? `${i + 1}. ` : "•  ") + t));
    };
    list("Top fixes", a.top_fixes, true); list("Strengths", a.strengths); list("Weaknesses", a.weaknesses);
    if (a.section_comments?.length) {
      doc.y += 4; text("Section comments", { size: 11, font: "B", color: ACC, gap: 5 });
      for (const s of a.section_comments) { text(`${s.section}: ${s.comment || ""}`); if (s.rewrite) text("Suggested wording: " + s.rewrite, { font: "I", color: MUTED, size: 9 }); }
    }
    list("Questions the panel may ask", a.reviewer_questions);
  }
  doc.y += 10;
  text("Budget caps and limits change between calls. Confirm them in the current call document before submitting.", { size: 8, font: "I", color: MUTED });

  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc.page.margins.bottom = 0; // writing in the footer area must not start a new page
    const y = doc.page.height - 36;
    doc.font("R").fontSize(7.5).fillColor(MUTED);
    doc.text(d.title.slice(0, 90), L, y, { width: W * 0.75, lineBreak: false, height: 10 });
    doc.text(`Page ${i + 1} of ${range.count}`, L, y, { width: W, align: "right", lineBreak: false, height: 10 });
  }
  doc.end();
  return done;
}
