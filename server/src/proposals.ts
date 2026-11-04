import { Router } from "express";
import type { Request, Response } from "express";
import multer from "multer";
import { z } from "zod";
import { BLANK_INPUT, EDITABLE, PROFILE_KEYS, allowedTransitions, evaluate } from "../../shared/src";
import type { ProposalInput, Status } from "../../shared/src";
import { isReviewer, requireUser } from "./auth";
import { one, q } from "./db";
import { rules } from "./rules";
import { extractText } from "./parse";
import { runAiReview } from "./ai";
import { buildDocx } from "./reports/docx";
import { buildPdf } from "./reports/pdf";
import { config } from "./config";

export const proposalsRouter = Router();
proposalsRouter.use(requireUser);

export const toInput = (row: any): ProposalInput => ({ ...BLANK_INPUT, ...(row.data || {}), ptext: row.ptext || "" });

/** Load a proposal the current user may see, or send 404. */
async function access(req: Request, res: Response) {
  const id = Number(req.params.id);
  const row = await one("SELECT p.*, u.name owner_name, u.email owner_email, u.department owner_dept FROM proposals p JOIN users u ON u.id=p.owner_id WHERE p.id=$1", [id]);
  const u = req.user!;
  const own = row && row.owner_id === u.id;
  const visible = row && (own || u.role === "admin" || (u.role === "rd" && row.status !== "draft"));
  if (!visible) { res.status(404).json({ error: "Proposal not found." }); return null; }
  return { row, own: !!own };
}

proposalsRouter.get("/", async (req, res) => {
  const u = req.user!;
  const scope = req.query.scope === "all" && isReviewer(u) ? "all" : "mine";
  const params: unknown[] = [];
  let where = "";
  if (scope === "mine") { params.push(u.id); where = "p.owner_id=$1"; }
  else where = u.role === "admin" ? "TRUE" : "p.status <> 'draft'";
  if (req.query.status) { params.push(String(req.query.status)); where += ` AND p.status=$${params.length}`; }
  if (req.query.agency) { params.push(String(req.query.agency)); where += ` AND p.agency=$${params.length}`; }
  const rows = await q(`SELECT p.id,p.title,p.agency,p.scheme,p.status,p.score,p.band,p.updated_at,p.created_at,p.ai_reviewed_at,
      u.name owner_name,u.department owner_dept, (SELECT count(*) FROM comments c WHERE c.proposal_id=p.id)::int comments
    FROM proposals p JOIN users u ON u.id=p.owner_id WHERE ${where} ORDER BY p.updated_at DESC LIMIT 500`, params);
  res.json({ proposals: rows, scope });
});

proposalsRouter.post("/", async (req, res) => {
  const p = z.object({ agency: z.string(), scheme: z.string(), title: z.string().max(400).optional(), copyFrom: z.number().optional() }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "Choose an agency and scheme." });
  const book = rules();
  if (!book[p.data.agency]?.schemes[p.data.scheme]) return res.status(400).json({ error: "Unknown agency or scheme." });
  const prof = await one<{ data: any }>("SELECT data FROM profiles WHERE user_id=$1", [req.user!.id]);
  let data: any = { ...BLANK_INPUT, piName: req.user!.name, dept: req.user!.department, ...(prof?.data || {}) };
  let ptext = "";
  if (p.data.copyFrom) {
    const src = await one("SELECT data, ptext FROM proposals WHERE id=$1 AND owner_id=$2", [p.data.copyFrom, req.user!.id]);
    if (src) { data = { ...data, ...src.data }; ptext = src.ptext; }
  }
  data = { ...data, agency: p.data.agency, scheme: p.data.scheme, title: p.data.title ?? data.title ?? "" };
  delete data.ptext;
  const ev = evaluate({ ...data, ptext } as ProposalInput, book);
  const row = await one(`INSERT INTO proposals(owner_id,title,agency,scheme,data,ptext,score,band,evaluation) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [req.user!.id, data.title, data.agency, data.scheme, data, ptext, ev.overall, ev.band, ev]);
  await q("INSERT INTO status_history(proposal_id,to_status,by_user,note) VALUES ($1,'draft',$2,'Created')", [row.id, req.user!.id]);
  res.json({ id: row.id });
});

proposalsRouter.get("/:id", async (req, res) => {
  const a = await access(req, res); if (!a) return;
  const { row, own } = a;
  const comments = await q("SELECT c.id,c.body,c.created_at,u.name author,u.role FROM comments c JOIN users u ON u.id=c.author_id WHERE proposal_id=$1 ORDER BY c.created_at", [row.id]);
  const history = await q("SELECT h.from_status,h.to_status,h.note,h.at,u.name by_name FROM status_history h LEFT JOIN users u ON u.id=h.by_user WHERE proposal_id=$1 ORDER BY h.at", [row.id]);
  res.json({
    id: row.id, status: row.status, owner: { name: row.owner_name, email: row.owner_email, dept: row.owner_dept }, own,
    input: toInput(row), file_name: row.file_name, ai_review: row.ai_review, ai_reviewed_at: row.ai_reviewed_at, outcome_note: row.outcome_note,
    created_at: row.created_at, updated_at: row.updated_at,
    canEdit: (own || req.user!.role === "admin") && EDITABLE.includes(row.status),
    transitions: allowedTransitions(row.status, own, req.user!.role),
    comments, history,
  });
});

proposalsRouter.put("/:id", async (req, res) => {
  const a = await access(req, res); if (!a) return;
  const { row, own } = a;
  if (!((own || req.user!.role === "admin") && EDITABLE.includes(row.status))) return res.status(409).json({ error: "This proposal is locked while it is with the R&D cell or the agency." });
  const body = req.body?.input;
  if (!body || typeof body !== "object") return res.status(400).json({ error: "Nothing to save." });
  const book = rules();
  const input: ProposalInput = { ...BLANK_INPUT, ...body };
  if (!book[input.agency]?.schemes[input.scheme]) return res.status(400).json({ error: "Unknown agency or scheme." });
  const { ptext, ...data } = input;
  const ev = evaluate(input, book);
  await q(`UPDATE proposals SET title=$2,agency=$3,scheme=$4,data=$5,ptext=$6,score=$7,band=$8,evaluation=$9,file_name=COALESCE($10,file_name),updated_at=now() WHERE id=$1`,
    [row.id, input.title, input.agency, input.scheme, data, String(ptext || "").slice(0, 400000), ev.overall, ev.band, ev, req.body.file_name ?? null]);
  res.json({ ok: true, score: ev.overall, band: ev.band, updated_at: new Date().toISOString() });
});

proposalsRouter.delete("/:id", async (req, res) => {
  const a = await access(req, res); if (!a) return;
  if (!(a.own && a.row.status === "draft") && req.user!.role !== "admin") return res.status(409).json({ error: "Only drafts can be deleted. Withdraw it instead." });
  await q("DELETE FROM proposals WHERE id=$1", [a.row.id]);
  res.json({ ok: true });
});

proposalsRouter.post("/:id/status", async (req, res) => {
  const a = await access(req, res); if (!a) return;
  const p = z.object({ to: z.string(), note: z.string().max(4000).optional() }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "Missing target status." });
  const allowed = allowedTransitions(a.row.status as Status, a.own, req.user!.role).map((t) => t.to);
  if (!allowed.includes(p.data.to as Status)) return res.status(409).json({ error: "That step is not available now." });
  if (p.data.to === "changes_requested" && !p.data.note?.trim()) return res.status(400).json({ error: "Say what needs to change." });
  await q("UPDATE proposals SET status=$2, updated_at=now(), outcome_note=CASE WHEN $2 IN ('sanctioned','not_sanctioned') THEN $3 ELSE outcome_note END WHERE id=$1", [a.row.id, p.data.to, p.data.note || null]);
  await q("INSERT INTO status_history(proposal_id,from_status,to_status,by_user,note) VALUES ($1,$2,$3,$4,$5)", [a.row.id, a.row.status, p.data.to, req.user!.id, p.data.note || null]);
  if (p.data.note?.trim()) await q("INSERT INTO comments(proposal_id,author_id,body) VALUES ($1,$2,$3)", [a.row.id, req.user!.id, p.data.note.trim()]);
  res.json({ ok: true });
});

proposalsRouter.post("/:id/comments", async (req, res) => {
  const a = await access(req, res); if (!a) return;
  const body = String(req.body?.body || "").trim();
  if (!body) return res.status(400).json({ error: "Write a comment first." });
  await q("INSERT INTO comments(proposal_id,author_id,body) VALUES ($1,$2,$3)", [a.row.id, req.user!.id, body.slice(0, 8000)]);
  res.json({ ok: true });
});

proposalsRouter.post("/:id/ai-review", async (req, res) => {
  const a = await access(req, res); if (!a) return;
  if (!config.anthropicKey) return res.status(503).json({ error: "The Claude review is not set up yet. Ask the administrator to add an API key." });
  const used = await one<{ count: number }>("SELECT count FROM ai_usage WHERE user_id=$1 AND day=CURRENT_DATE", [req.user!.id]);
  if ((used?.count || 0) >= config.aiDailyLimit) return res.status(429).json({ error: `Daily limit of ${config.aiDailyLimit} Claude reviews reached. Try again tomorrow.` });
  await q("INSERT INTO ai_usage(user_id,day,count) VALUES ($1,CURRENT_DATE,1) ON CONFLICT (user_id,day) DO UPDATE SET count=ai_usage.count+1", [req.user!.id]);
  try {
    const review = await runAiReview(toInput(a.row), rules());
    await q("UPDATE proposals SET ai_review=$2, ai_reviewed_at=now() WHERE id=$1", [a.row.id, review]);
    res.json({ ai_review: review });
  } catch (e: any) {
    console.error("ai review failed", e?.message);
    res.status(502).json({ error: e?.userMessage || "The Claude review could not be completed. Try again in a minute." });
  }
});

async function report(req: Request, res: Response, kind: "docx" | "pdf") {
  const a = await access(req, res); if (!a) return;
  const input = toInput(a.row);
  const ev = evaluate(input, rules());
  const ctx = { input, ev, ai: a.row.ai_review, status: a.row.status, owner: a.row.owner_name, institution: config.institution, appName: config.appName };
  const buf = kind === "docx" ? await buildDocx(ctx) : await buildPdf(ctx);
  const base = ((input.title || "proposal").replace(/[^\w-]+/g, "_").replace(/_+/g, "_").slice(0, 60) || "proposal") + "_review";
  res.setHeader("Content-Type", kind === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${base}.${kind}"`);
  res.send(buf);
}
proposalsRouter.get("/:id/report.docx", (req, res) => report(req, res, "docx"));
proposalsRouter.get("/:id/report.pdf", (req, res) => report(req, res, "pdf"));

/* ---- file text extraction ---- */
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
export const parseRouter = Router();
parseRouter.post("/", requireUser, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Choose a file." });
  try {
    const text = await extractText(req.file.originalname, req.file.buffer);
    const words = (text.match(/\S+/g) || []).length;
    res.json({ text, words, scanned: words < 40 && /\.pdf$/i.test(req.file.originalname) });
  } catch (e: any) {
    res.status(400).json({ error: e?.message || "Could not read that file. Save it as .docx or .pdf and try again." });
  }
});

/* ---- faculty profile ---- */
export const profileRouter = Router();
profileRouter.use(requireUser);
profileRouter.get("/", async (req, res) => {
  const r = await one<{ data: any }>("SELECT data FROM profiles WHERE user_id=$1", [req.user!.id]);
  res.json({ profile: { ...Object.fromEntries(PROFILE_KEYS.map((k) => [k, (BLANK_INPUT as any)[k]])), piName: req.user!.name, dept: req.user!.department, ...(r?.data || {}) } });
});
profileRouter.put("/", async (req, res) => {
  const src = req.body?.profile || {};
  const data = Object.fromEntries(PROFILE_KEYS.filter((k) => k in src).map((k) => [k, src[k]]));
  await q("INSERT INTO profiles(user_id,data,updated_at) VALUES ($1,$2,now()) ON CONFLICT (user_id) DO UPDATE SET data=$2, updated_at=now()", [req.user!.id, data]);
  res.json({ ok: true });
});
