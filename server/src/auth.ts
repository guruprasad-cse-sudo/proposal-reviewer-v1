import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { z } from "zod";
import { config } from "./config";
import { one, q } from "./db";
import type { Role } from "../../shared/src";

export interface User { id: number; email: string; name: string; department: string; role: Role; must_reset: boolean; }
declare global { namespace Express { interface Request { user?: User } } }

const COOKIE = "pr_session";
const cookieOpts = { httpOnly: true, sameSite: "lax" as const, secure: config.production, maxAge: 1000 * 60 * 60 * 24 * 14 };

function setSession(res: Response, u: { id: number }) {
  res.cookie(COOKIE, jwt.sign({ uid: u.id }, config.jwtSecret, { expiresIn: "14d" }), cookieOpts);
}

export async function loadUser(req: Request, _res: Response, next: NextFunction) {
  const t = req.cookies?.[COOKIE];
  if (t) {
    try {
      const { uid } = jwt.verify(t, config.jwtSecret) as { uid: number };
      req.user = await one<User>("SELECT id,email,name,department,role,must_reset FROM users WHERE id=$1 AND active", [uid]);
    } catch { /* invalid or expired token: treat as signed out */ }
  }
  next();
}
export function requireUser(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: "Please sign in." });
  next();
}
export const requireRole = (...roles: Role[]) => (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) return res.status(401).json({ error: "Please sign in." });
  if (!roles.includes(req.user.role)) return res.status(403).json({ error: "You do not have access to this." });
  next();
};
export const isReviewer = (u?: User) => !!u && (u.role === "rd" || u.role === "admin");

const Register = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().min(2).max(120),
  department: z.string().trim().max(120).default(""),
  password: z.string().min(8, "Use at least 8 characters.").max(200),
});
const Login = z.object({ email: z.string().trim().toLowerCase(), password: z.string() });

export const authRouter = Router();

authRouter.post("/register", async (req, res) => {
  const p = Register.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.issues[0]?.message || "Check the form." });
  const { email, name, department, password } = p.data;
  const domain = email.split("@")[1];
  if (config.allowedDomains.length && !config.allowedDomains.includes(domain)) {
    return res.status(400).json({ error: `Use your institutional email (${config.allowedDomains.map((d) => "@" + d).join(", ")}).` });
  }
  if (await one("SELECT 1 FROM users WHERE email=$1", [email])) return res.status(409).json({ error: "An account with this email already exists. Sign in instead." });
  const count = Number((await one<{ n: string }>("SELECT count(*) n FROM users"))?.n || 0);
  const role: Role = config.adminEmails.includes(email) || (count === 0 && !config.adminEmails.length) ? "admin" : "faculty";
  const hash = await bcrypt.hash(password, 10);
  const u = await one<User>("INSERT INTO users(email,name,department,password_hash,role) VALUES ($1,$2,$3,$4,$5) RETURNING id,email,name,department,role,must_reset", [email, name, department, hash, role]);
  setSession(res, u!);
  res.json({ user: u });
});

authRouter.post("/login", async (req, res) => {
  const p = Login.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "Enter your email and password." });
  const row = await one<User & { password_hash: string; active: boolean }>("SELECT * FROM users WHERE email=$1", [p.data.email]);
  if (!row || !row.active || !(await bcrypt.compare(p.data.password, row.password_hash))) {
    return res.status(401).json({ error: "Email or password is incorrect." });
  }
  setSession(res, row);
  const { password_hash, active, ...user } = row;
  res.json({ user });
});

authRouter.post("/logout", (_req, res) => { res.clearCookie(COOKIE, { ...cookieOpts, maxAge: undefined }); res.json({ ok: true }); });

authRouter.get("/me", (req, res) => {
  res.json({ user: req.user || null, app: { name: config.appName, institution: config.institution, domains: config.allowedDomains, ai: !!config.anthropicKey } });
});

authRouter.post("/password", requireUser, async (req, res) => {
  const p = z.object({ current: z.string(), next: z.string().min(8, "Use at least 8 characters.") }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.issues[0]?.message });
  const row = await one<{ password_hash: string }>("SELECT password_hash FROM users WHERE id=$1", [req.user!.id]);
  if (!row || !(await bcrypt.compare(p.data.current, row.password_hash))) return res.status(400).json({ error: "Current password is incorrect." });
  await q("UPDATE users SET password_hash=$1, must_reset=false WHERE id=$2", [await bcrypt.hash(p.data.next, 10), req.user!.id]);
  res.json({ ok: true });
});
