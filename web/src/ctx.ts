import { createContext, useContext } from "react";
import type { RuleBook } from "../../shared/src";

export interface Me { id: number; email: string; name: string; department: string; role: "faculty" | "rd" | "admin"; must_reset: boolean; }
export interface AppInfo { name: string; institution: string; domains: string[]; ai: boolean; }
export interface Ctx { me: Me | null; app: AppInfo | null; rules: RuleBook; refresh: () => Promise<void>; toast: (t: string) => void; }
export const AppCtx = createContext<Ctx>(null as any);
export const useApp = () => useContext(AppCtx);
