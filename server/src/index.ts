import fs from "node:fs";
import path from "node:path";
import cookieParser from "cookie-parser";
import express from "express";
import { authRouter, loadUser } from "./auth";
import { config, paths } from "./config";
import { migrate } from "./db";
import { parseRouter, profileRouter, proposalsRouter } from "./proposals";
import { rulesRouter, statsRouter, usersRouter } from "./admin";
import { loadRules } from "./rules";

async function main() {
  loadRules();
  await migrate();

  const app = express();
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(express.json({ limit: "4mb" }));
  app.use(cookieParser());
  app.use((_req, res, next) => { res.setHeader("X-Content-Type-Options", "nosniff"); res.setHeader("Referrer-Policy", "same-origin"); next(); });
  app.use(loadUser);

  app.get("/healthz", (_req, res) => res.json({ ok: true }));
  app.use("/api/auth", authRouter);
  app.use("/api/rules", rulesRouter);
  app.use("/api/profile", profileRouter);
  app.use("/api/parse", parseRouter);
  app.use("/api/proposals", proposalsRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/stats", statsRouter);
  app.use("/api", (_req, res) => res.status(404).json({ error: "Not found." }));

  if (fs.existsSync(paths.web)) {
    app.use(express.static(paths.web, { index: false, maxAge: "1h" }));
    app.get("*", (_req, res) => res.sendFile(path.join(paths.web, "index.html")));
  }

  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    if (err?.code === "LIMIT_FILE_SIZE") return res.status(413).json({ error: "File is larger than 20 MB." });
    res.status(500).json({ error: "Something went wrong on the server. Try again." });
  });

  app.listen(config.port, () => console.log(`${config.appName} listening on :${config.port}`));
}

main().catch((e) => { console.error(e); process.exit(1); });
