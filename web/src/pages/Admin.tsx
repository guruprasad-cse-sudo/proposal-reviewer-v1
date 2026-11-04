import { useEffect, useState } from "react";
import { api } from "../api";
import { useApp } from "../ctx";

interface U { id: number; email: string; name: string; department: string; role: string; active: boolean; proposals: number; }

export default function Admin() {
  const { me, rules, toast, refresh } = useApp();
  const [users, setUsers] = useState<U[]>([]);
  const [temp, setTemp] = useState<{ email: string; pw: string } | null>(null);
  const load = () => api<{ users: U[] }>("/users").then((r) => setUsers(r.users));
  useEffect(() => { load(); }, []);
  const patch = async (u: U, body: Partial<U>) => { try { await api(`/users/${u.id}`, { method: "PATCH", body }); await load(); toast("Updated"); } catch (e: any) { toast(e.message); } };
  const reset = async (u: U) => { if (!window.confirm(`Reset the password for ${u.email}?`)) return; const r = await api<{ tempPassword: string }>(`/users/${u.id}/reset-password`, { method: "POST" }); setTemp({ email: u.email, pw: r.tempPassword }); };
  const reload = async () => { try { const r = await api<{ agencies: number }>("/rules/reload", { method: "POST" }); await refresh(); toast(`Rules reloaded: ${r.agencies} agencies`); } catch (e: any) { toast(e.message); } };
  return (
    <>
      <div className="page-head"><div><h1>Admin</h1><p>Give R&amp;D cell members the R&amp;D role so they can review and approve proposals. Reset passwords here when someone is locked out.</p></div></div>
      <div className="panel">
        <div className="tblwrap"><table className="list">
          <thead><tr><th>Name</th><th>Email</th><th>Department</th><th>Role</th><th className="num">Proposals</th><th>Access</th><th></th></tr></thead>
          <tbody>{users.map((u) => <tr key={u.id}>
            <td>{u.name}</td><td>{u.email}</td><td>{u.department}</td>
            <td><select aria-label={`Role for ${u.name}`} value={u.role} disabled={u.id === me!.id} onChange={(e) => patch(u, { role: e.target.value })} style={{ width: "auto" }}>
              <option value="faculty">Faculty</option><option value="rd">R&amp;D cell</option><option value="admin">Admin</option></select></td>
            <td className="num">{u.proposals}</td>
            <td>{u.id !== me!.id ? <button type="button" onClick={() => patch(u, { active: !u.active })}>{u.active ? "Disable" : "Enable"}</button> : "You"}</td>
            <td><button type="button" onClick={() => reset(u)}>Reset password</button></td>
          </tr>)}</tbody>
        </table></div>
      </div>
      {temp && <div className="panel pad" style={{ marginTop: 12 }} role="status">
        Temporary password for <b>{temp.email}</b>: <code style={{ fontFamily: "var(--f-mono)", fontSize: "1rem" }}>{temp.pw}</code>
        <p className="note">Share it with them directly. They should change it under My profile after signing in. <button className="link" type="button" onClick={() => setTemp(null)}>Hide</button></p>
      </div>}

      <div className="panel pad" style={{ marginTop: 16 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2>Agency rules</h2>
          <button type="button" onClick={reload}>Reload rule files</button>
        </div>
        <p className="note">Rules live in <code>rules/agencies/*.json</code> in the code repository. Edit a file and redeploy to change caps, TRL ranges, weights, required sections or tips. See <code>docs/ADDING_A_SCHEME.md</code>.</p>
        <div className="tblwrap"><table className="list">
          <thead><tr><th>Agency</th><th>Scheme</th><th className="num">Cap (₹ lakh)</th><th className="num">Max months</th><th>TRL</th><th>Kind</th></tr></thead>
          <tbody>{Object.values(rules).flatMap((a) => Object.entries(a.schemes).map(([k, s]) => <tr key={a.id + k}>
            <td>{a.name}</td><td>{s.name}</td><td className="num">{s.capLakh ?? "–"}</td><td className="num">{s.maxMonths}</td><td>{s.trl[0]}–{s.trl[1]}</td><td>{s.kind}</td></tr>))}</tbody>
        </table></div>
      </div>
    </>
  );
}
