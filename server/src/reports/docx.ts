import {
  AlignmentType, BorderStyle, Document, Footer, HeadingLevel, Packer, PageNumber, Paragraph, ShadingType, Table, TableCell, TableLayoutType, TableRow, TextRun, WidthType,
} from "docx";
import { DIMS } from "../../../shared/src";
import { LEVEL_COLOR, STATUS_COLOR, reportData, type ReportCtx } from "./data";

const ACC = "1D5C86", RULE = "D9E0E6", MUTED = "5B6B78";
const CW = 9638; // A4 width minus 2 cm margins, in twips

export async function buildDocx(ctx: ReportCtx): Promise<Buffer> {
  const d = reportData(ctx);
  const P = (text: string, run: Record<string, unknown> = {}, after = 80) => new Paragraph({ spacing: { after }, children: [new TextRun({ text, ...run })] });
  const H = (text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel]) => new Paragraph({ text, heading: level, spacing: { before: 240, after: 100 } });
  const bullet = (t: string) => new Paragraph({ text: t, bullet: { level: 0 }, spacing: { after: 40 } });
  const cell = (t: string, w: number, o: { bold?: boolean; fill?: string; color?: string } = {}) => new TableCell({
    width: { size: Math.round((CW * w) / 100), type: WidthType.DXA },
    shading: o.fill ? { type: ShadingType.CLEAR, color: "auto", fill: o.fill } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [new Paragraph({ children: [new TextRun({ text: t, bold: !!o.bold, color: o.color, size: 20 })] })],
  });
  const table = (head: string[] | null, rows: string[][], widths: number[], colorCol = -1) => new Table({
    width: { size: CW, type: WidthType.DXA }, columnWidths: widths.map((w) => Math.round((CW * w) / 100)), layout: TableLayoutType.FIXED,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: RULE }, bottom: { style: BorderStyle.SINGLE, size: 4, color: RULE },
      left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: RULE }, insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    },
    rows: [
      ...(head ? [new TableRow({ tableHeader: true, children: head.map((h, i) => cell(h, widths[i], { bold: true, fill: "E3EEF6", color: ACC })) })] : []),
      ...rows.map((r) => new TableRow({ cantSplit: true, children: r.map((v, i) => cell(v, widths[i], i === colorCol ? { bold: true, color: STATUS_COLOR[v] } : {})) })),
    ],
  });

  const kids: (Paragraph | Table)[] = [];
  kids.push(P(("PRE-SUBMISSION REVIEW" + (d.institution ? " · " + d.institution : "")).toUpperCase(), { bold: true, color: ACC, size: 18 }, 60));
  kids.push(new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: d.title })], spacing: { after: 120 } }));
  kids.push(P(`Prepared ${d.date} with ${d.appName}`, { color: MUTED, size: 18 }));
  kids.push(new Paragraph({ spacing: { before: 160, after: 160 }, children: [
    new TextRun({ text: `Readiness ${d.score}/100 · `, bold: true, size: 32 }), new TextRun({ text: d.band, bold: true, size: 32, color: LEVEL_COLOR[d.level] }),
  ] }));
  kids.push(table(null, d.meta, [28, 72]));
  kids.push(H("Eligibility and compliance", HeadingLevel.HEADING_1));
  kids.push(table(["Status", "Check"], d.gates, [14, 86], 0));
  kids.push(H("Scorecard", HeadingLevel.HEADING_1));
  kids.push(table(["Dimension", "Score /100", "Weight"], d.dims, [60, 20, 20]));
  if (d.sections) {
    kids.push(H("Proposal sections", HeadingLevel.HEADING_1));
    kids.push(P("Found: " + (d.sections.found.join(", ") || "none")));
    if (d.sections.missing.length) kids.push(P("Missing: " + d.sections.missing.join(", "), { color: "B23A32" }));
  }
  kids.push(H("Suggestions", HeadingLevel.HEADING_1));
  kids.push(table(["Priority", "Area", "Suggestion"], d.sugg, [12, 22, 66], 0));
  kids.push(H("What this call looks for", HeadingLevel.HEADING_1));
  d.tips.forEach((t) => kids.push(bullet(t)));

  const a = d.ai;
  if (a) {
    kids.push(H("Expert-panel review by Claude", HeadingLevel.HEADING_1));
    if (a.likely_outcome) kids.push(P("Likely outcome: " + a.likely_outcome, { bold: true }));
    if (a.verdict) kids.push(P(a.verdict));
    if (a.scores) kids.push(table(["Dimension", "Panel score /10"], DIMS.filter(([k]) => a.scores![k] !== undefined).map(([k, l]) => [l, String(a.scores![k])]), [70, 30]));
    const list = (title: string, arr?: string[], numbered = false) => {
      if (!arr?.length) return;
      kids.push(H(title, HeadingLevel.HEADING_2));
      arr.forEach((t, i) => kids.push(numbered ? P(`${i + 1}. ${t}`) : bullet(t)));
    };
    list("Top fixes", a.top_fixes, true); list("Strengths", a.strengths); list("Weaknesses", a.weaknesses);
    if (a.section_comments?.length) {
      kids.push(H("Section comments", HeadingLevel.HEADING_2));
      for (const s of a.section_comments) {
        kids.push(new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: s.section + ": ", bold: true }), new TextRun({ text: s.comment || "" })] }));
        if (s.rewrite) kids.push(new Paragraph({ indent: { left: 360 }, spacing: { after: 100 }, children: [new TextRun({ text: "Suggested wording: ", italics: true, color: MUTED }), new TextRun({ text: s.rewrite, italics: true })] }));
      }
    }
    list("Questions the panel may ask", a.reviewer_questions);
  }
  kids.push(new Paragraph({ spacing: { before: 300 }, children: [new TextRun({ text: "Budget caps and limits change between calls. Confirm them in the current call document before submitting.", italics: true, color: MUTED, size: 18 })] }));

  const doc = new Document({
    creator: d.appName, title: "Review: " + d.title,
    styles: { default: {
      document: { run: { font: "Calibri", size: 21, color: "14212C" } },
      title: { run: { font: "Cambria", size: 40, bold: true, color: "14212C" } },
      heading1: { run: { font: "Cambria", size: 28, bold: true, color: "14212C" } },
      heading2: { run: { font: "Cambria", size: 23, bold: true, color: ACC } },
    } },
    sections: [{
      properties: { page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [
        new TextRun({ text: d.title.slice(0, 80) + "   ·   Page ", color: MUTED, size: 16 }), new TextRun({ children: [PageNumber.CURRENT], color: MUTED, size: 16 }),
      ] })] }) },
      children: kids,
    }],
  });
  return Packer.toBuffer(doc);
}
