import path from "node:path";

const list = (v?: string) => (v || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

export const config = {
  port: Number(process.env.PORT || 3000),
  production: process.env.NODE_ENV === "production",
  root: process.env.APP_ROOT || process.cwd(),
  databaseUrl: process.env.DATABASE_URL || "postgres://app:app@localhost:5432/reviewer",
  databaseSsl: process.env.DATABASE_SSL === "true",
  jwtSecret: process.env.JWT_SECRET || "dev-only-secret-change-me",
  /** Only these email domains may register, e.g. "dsatm.edu.in". Empty = any. */
  allowedDomains: list(process.env.ALLOWED_EMAIL_DOMAINS),
  /** These emails become admins when they register. */
  adminEmails: list(process.env.ADMIN_EMAILS),
  anthropicKey: process.env.ANTHROPIC_API_KEY || "",
  anthropicBaseUrl: process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com",
  claudeModel: process.env.CLAUDE_MODEL || "claude-sonnet-5-5",
  aiDailyLimit: Number(process.env.AI_DAILY_LIMIT || 15),
  appName: process.env.APP_NAME || "Proposal Reviewer",
  institution: process.env.INSTITUTION_NAME || "",
};
export const paths = {
  rules: path.join(config.root, "rules", "agencies"),
  migrations: path.join(config.root, "server", "migrations"),
  web: path.join(config.root, "web", "dist"),
  fonts: path.join(config.root, "node_modules", "dejavu-fonts-ttf", "ttf"),
};

if (config.production && config.jwtSecret === "dev-only-secret-change-me") {
  throw new Error("Set JWT_SECRET in production.");
}
