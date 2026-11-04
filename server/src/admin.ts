import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { requireRole, requireUser } from "./auth";
import { q } from "./db";
import { loadRules, rules } from "./rules";

/* ---- rules (read by every signed-in user) ---- */
export const rulesRouter = Router();
rulesRouter.get("/", requireUser, (_req, res) => res.json({ rules: rules() }));
rulesRouter.post("/reload", requireRole("admin"), (_req, res) => {
  try { const b = loadRules(); res.json({ ok: true, agencies: Object.keys(b).length }); }
  catch (e: any) { res.status(400).json({ error: e.message }); }
});

/* ---- users (admin) ---- */
export const usersRouter = Router();
usersRouter.use(requireRole("admin"));
usersRouter.get("/", async (_req, res) => {
  res.json({ users: await q(`SELECT u.id,u.email,u.name,u.department,u.role,u.active,u.created_at,
    (SELECT count(*) FROM proposals p WHERE p.owner_id=u.id)::int proposals FROM users u ORDER BY u.name`) });
});
usersRouter.patch("/:id", async (req, res) => {
  const p = z.object({ role: z.enum(["faculty", "rd", "admin"]).optional(), active: z.boolean().optional(), department: z.string().max(120).optional() }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "Invalid change." });
  if (Number(req.params.id) === req.user!.id && (p.data.role && p.data.role !== "admin" || p.data.active === false)) return res.status(400).json({ error: "You cannot remove your own admin access." });
  const sets: string[] = [], vals: unknown[] = [Number(req.params.id)];
  for (const [k, v] of Object.entries(p.data)) { vals.push(v); sets.push(`${k}=$${vals.length}`); }
  if (sets.length) await q(`UPDATE users SET ${sets.join(",")} WHERE id=$1`, vals);
  res.json({ ok: true });
});
usersRouter.post("/:id/reset-password", async (req, res) => {
  const temp = crypto.randomBytes(6).toString("base64url");
  await q("UPDATE users SET password_hash=$2, must_reset=true WHERE id=$1", [Number(req.params.id), await bcrypt.hash(temp, 10)]);
  res.json({ tempPassword: temp });
});

/* ---- dashboard numbers (R&D cell, admin) ---- */
export const statsRouter = Router();
statsRouter.get("/", requireRole("rd", "admin"), async (_req, res) => {
  const byStatus = await q("SELECT status, count(*)::int n FROM proposals GROUP BY status");
  const byAgency = await q(`SELECT agency, count(*)::int n, round(avg(score))::int avg_score,
      count(*) FILTER (WHERE status='sanctioned')::int sanctioned, count(*) FILTER (WHERE status='not_sanctioned')::int not_sanctioned,
      round(avg(score) FILTER (WHERE status='sanctioned'))::int avg_score_sanctioned, round(avg(score) FILTER (WHERE status='not_sanctioned'))::int avg_score_not
    FROM proposals GROUP BY agency ORDER BY n DESC`);
  const byDept = await q(`SELECT coalesce(nullif(u.department,''),'Not set') dept, count(*)::int n, count(*) FILTER (WHERE p.status='sanctioned')::int sanctioned
    FROM proposals p JOIN users u ON u.id=p.owner_id GROUP BY 1 ORDER BY n DESC`);
  const waiting = await q(`SELECT p.id,p.title,p.agency,p.score,u.name owner_name,p.updated_at FROM proposals p JOIN users u ON u.id=p.owner_id
    WHERE p.status='internal_review' ORDER BY p.updated_at`);
  res.json({ byStatus, byAgency, byDept, waiting });
});
