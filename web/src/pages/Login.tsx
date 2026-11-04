import { useState } from "react";
import { api } from "../api";
import { useApp } from "../ctx";

export default function Login() {
  const { app, refresh } = useApp();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [f, setF] = useState({ email: "", password: "", name: "", department: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(""); setBusy(true);
    try { await api(mode === "in" ? "/auth/login" : "/auth/register", { body: f }); await refresh(); }
    catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  };
  const domains = app?.domains?.length ? app.domains.map((d) => "@" + d).join(", ") : "";
  return (
    <div className="panel auth">
      <h1>{app?.name || "Proposal Reviewer"}</h1>
      <p className="note" style={{ marginTop: 0 }}>Pre-submission review for ANRF, AR&amp;DB, NRB, DRDO, ISRO, VGST and MNRE proposals{app?.institution ? ` at ${app.institution}` : ""}.</p>
      <form onSubmit={submit}>
        {mode === "up" && <>
          <label>Full name<input id="name" value={f.name} onChange={set("name")} required autoComplete="name" /></label>
          <label>Department<input id="department" value={f.department} onChange={set("department")} placeholder="e.g. Mechanical Engineering" /></label>
        </>}
        <label>Institutional email{domains && <span className="hint">Use your {domains} address</span>}
          <input id="email" type="email" value={f.email} onChange={set("email")} required autoComplete="email" /></label>
        <label>Password{mode === "up" && <span className="hint">At least 8 characters</span>}
          <input id="password" type="password" value={f.password} onChange={set("password")} required minLength={mode === "up" ? 8 : undefined} autoComplete={mode === "in" ? "current-password" : "new-password"} /></label>
        {err && <div className="err" role="alert">{err}</div>}
        <button className="primary" type="submit" disabled={busy}>{mode === "in" ? "Sign in" : "Create account"}</button>
      </form>
      <p className="note" style={{ marginTop: 16 }}>
        {mode === "in" ? <>New here? <button className="link" type="button" onClick={() => { setMode("up"); setErr(""); }}>Create an account</button></>
          : <>Already registered? <button className="link" type="button" onClick={() => { setMode("in"); setErr(""); }}>Sign in</button></>}
      </p>
      {mode === "in" && <p className="note">Forgot your password? Ask the administrator to reset it.</p>}
    </div>
  );
}
