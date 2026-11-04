import { useEffect, useState } from "react";
import { api } from "../api";
import { useApp } from "../ctx";
import { FormProvider, ProfileFields } from "../components/Fields";

export default function ProfilePage() {
  const { toast, me } = useApp();
  const [p, setP] = useState<Record<string, any> | null>(null);
  const [dirty, setDirty] = useState(false);
  const [pw, setPw] = useState({ current: "", next: "" });
  const [pwErr, setPwErr] = useState("");
  useEffect(() => { api<{ profile: any }>("/profile").then((r) => setP(r.profile)); }, []);
  if (!p) return <p className="note">Loading…</p>;
  const set = (k: string, v: unknown) => { setP({ ...p, [k]: v }); setDirty(true); };
  const save = async () => { try { await api("/profile", { method: "PUT", body: { profile: p } }); setDirty(false); toast("Profile saved"); } catch (e: any) { toast(e.message); } };
  const changePw = async (e: React.FormEvent) => {
    e.preventDefault(); setPwErr("");
    try { await api("/auth/password", { body: pw }); setPw({ current: "", next: "" }); toast("Password changed"); } catch (x: any) { setPwErr(x.message); }
  };
  return (
    <>
      <div className="page-head">
        <div><h1>My faculty profile</h1><p>These details are copied into every new proposal you start, so the review can judge your track record and expertise. Keep your funded projects list current.</p></div>
        <div className="row"><button className="primary" type="button" onClick={save} disabled={!dirty}>{dirty ? "Save profile" : "Saved"}</button></div>
      </div>
      {me?.must_reset && <p className="panel pad err">Your password was reset by the administrator. Set a new one below.</p>}
      <div className="panel pad" style={{ maxWidth: 980 }}>
        <FormProvider v={p} set={set}><ProfileFields /></FormProvider>
      </div>
      <form className="panel pad" style={{ maxWidth: 520, marginTop: 16, display: "grid", gap: 10 }} onSubmit={changePw}>
        <h2>Change password</h2>
        <label>Current password<input id="pw-cur" type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} autoComplete="current-password" /></label>
        <label>New password<span className="hint">At least 8 characters</span><input id="pw-new" type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" minLength={8} /></label>
        {pwErr && <p className="err" style={{ margin: 0 }}>{pwErr}</p>}
        <div><button type="submit" disabled={!pw.current || pw.next.length < 8}>Change password</button></div>
      </form>
    </>
  );
}
