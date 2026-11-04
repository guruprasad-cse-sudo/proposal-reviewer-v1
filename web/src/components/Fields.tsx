import { createContext, useContext, type ReactNode } from "react";
import { PROJECT_STATUS } from "../../../shared/src";
import type { FundedProject } from "../../../shared/src";

/** Form binding: every field reads and writes one key of a plain object. */
type Obj = Record<string, any>;
interface FormCtx { v: Obj; set: (k: string, val: unknown) => void; disabled?: boolean; }
const F = createContext<FormCtx>(null as any);
export const FormProvider = ({ v, set, disabled, children }: FormCtx & { children: ReactNode }) => <F.Provider value={{ v, set, disabled }}>{children}</F.Provider>;
const useF = () => useContext(F);

interface Base { k: string; label: string; hint?: string; full?: boolean; }

export function Text({ k, label, hint, full, placeholder }: Base & { placeholder?: string }) {
  const { v, set, disabled } = useF();
  return <label className={full ? "full" : undefined}>{label}{hint && <span className="hint">{hint}</span>}
    <input id={"f-" + k} type="text" value={v[k] ?? ""} placeholder={placeholder} disabled={disabled} onChange={(e) => set(k, e.target.value)} /></label>;
}
export function Area({ k, label, hint, rows = 3 }: Base & { rows?: number }) {
  const { v, set, disabled } = useF();
  return <label className="full">{label}{hint && <span className="hint">{hint}</span>}
    <textarea id={"f-" + k} rows={rows} value={v[k] ?? ""} disabled={disabled} onChange={(e) => set(k, e.target.value)} /></label>;
}
export function Num({ k, label, hint, step, min = 0 }: Base & { step?: number; min?: number }) {
  const { v, set, disabled } = useF();
  return <label>{label}{hint && <span className="hint">{hint}</span>}
    <input id={"f-" + k} type="number" min={min} step={step} value={v[k] ?? ""} disabled={disabled}
      onChange={(e) => set(k, e.target.value === "" ? "" : Number(e.target.value))} /></label>;
}
export function Sel({ k, label, hint, options, full, asNumber }: Base & { options: [string | number, string][]; asNumber?: boolean }) {
  const { v, set, disabled } = useF();
  return <label className={full ? "full" : undefined}>{label}{hint && <span className="hint">{hint}</span>}
    <select id={"f-" + k} value={v[k] ?? ""} disabled={disabled} onChange={(e) => set(k, asNumber ? Number(e.target.value) : e.target.value)}>
      {options.map(([val, l]) => <option key={val} value={val}>{l}</option>)}
    </select></label>;
}
export function Check({ k, label, full }: Base) {
  const { v, set, disabled } = useF();
  return <label className={"check" + (full ? " full" : "")}><input id={"f-" + k} type="checkbox" checked={!!v[k]} disabled={disabled} onChange={(e) => set(k, e.target.checked)} /> {label}</label>;
}

export function ProjectsTable() {
  const { v, set, disabled } = useF();
  const list: FundedProject[] = v.projects || [];
  const upd = (i: number, patch: Partial<FundedProject>) => set("projects", list.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  return <>
    <div className="tblwrap">
      <table className="rows">
        <thead><tr><th>Agency</th><th>Scheme</th><th>₹ lakh</th><th>Year</th><th>Role</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {list.map((p, i) => <tr key={i}>
            <td><input aria-label="Agency" value={p.ag} disabled={disabled} onChange={(e) => upd(i, { ag: e.target.value })} /></td>
            <td><input aria-label="Scheme" value={p.sc} disabled={disabled} onChange={(e) => upd(i, { sc: e.target.value })} /></td>
            <td><input aria-label="Amount in lakh" type="number" min={0} style={{ width: 80 }} value={p.amt ?? ""} disabled={disabled} onChange={(e) => upd(i, { amt: Number(e.target.value) || 0 })} /></td>
            <td><input aria-label="Year" type="number" style={{ width: 76 }} value={p.yr ?? ""} disabled={disabled} onChange={(e) => upd(i, { yr: Number(e.target.value) || "" })} /></td>
            <td><select aria-label="Role" value={p.role} disabled={disabled} onChange={(e) => upd(i, { role: e.target.value as any })}><option>PI</option><option>Co-PI</option></select></td>
            <td><select aria-label="Status" value={p.st} disabled={disabled} onChange={(e) => upd(i, { st: e.target.value as any })}>
              {Object.entries(PROJECT_STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></td>
            <td>{!disabled && <button className="x" type="button" aria-label="Remove project" onClick={() => set("projects", list.filter((_, j) => j !== i))}>✕</button>}</td>
          </tr>)}
        </tbody>
      </table>
    </div>
    {!list.length && <p className="note">No funded projects listed yet.</p>}
    {!disabled && <div className="row" style={{ marginTop: 8 }}>
      <button type="button" onClick={() => set("projects", [...list, { ag: "", sc: "", amt: 0, yr: new Date().getFullYear(), role: "PI", st: "ongoing" }])}>Add project</button>
    </div>}
  </>;
}

/** The faculty profile block, used on the profile page and inside each proposal. */
export function ProfileFields() {
  return <>
    <fieldset>
      <legend>Principal Investigator</legend>
      <div className="fields">
        <Text k="piName" label="Name" />
        <Sel k="desig" label="Designation" options={["Assistant Professor", "Associate Professor", "Professor", "Scientist / Research Officer", "Other"].map((x) => [x, x])} />
        <Text k="dept" label="Department" />
        <Text k="inst" label="Institution" />
        <Sel k="instType" label="Institution type" options={[["central", "Central / national institute"], ["stategov", "State government / university"], ["aided", "Government-aided college"], ["private", "Private / self-financing"], ["deemed", "Deemed-to-be university"]]} />
        <Text k="state" label="State" />
        <Num k="yrs" label="Years in regular service" />
        <Num k="age" label="Age" min={20} />
        <Num k="phdYear" label="PhD year" min={1970} />
        <Check k="regular" label="Holds a regular (non-contract) position" />
        <Check k="phd" label="Has a PhD" />
        <Check k="relax" label="Eligible for age relaxation (SC/ST/OBC/PwD/women)" />
      </div>
    </fieldset>
    <fieldset>
      <legend>Domain expertise and output</legend>
      <div className="fields">
        <Text k="expertise" label="Areas of expertise" hint="Comma-separated keywords" full />
        <Sel k="match" label="Match of expertise to this proposal" options={[["5", "5 · Core area of my work"], ["4", "4 · Closely related"], ["3", "3 · Adjacent, partly new"], ["2", "2 · Mostly new area"], ["1", "1 · New area for me"]]} />
        <Num k="pubs5" label="Indexed papers, last 5 years" />
        <Num k="topicPubs" label="…of which on this topic" />
        <Num k="hindex" label="h-index (Scopus/WoS)" />
        <Num k="patF" label="Patents filed" />
        <Num k="patG" label="Patents granted" />
        <Num k="phdG" label="PhDs guided (awarded)" />
        <Num k="tot" label="Technologies transferred" />
      </div>
    </fieldset>
    <fieldset>
      <legend>Funded projects, earlier and ongoing</legend>
      <ProjectsTable />
    </fieldset>
  </>;
}
