import React, { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, NavLink, Route, Routes, useNavigate } from "react-router-dom";
import type { RuleBook } from "../../shared/src";
import { api } from "./api";
import Login from "./pages/Login";
import Proposals from "./pages/Proposals";
import Editor from "./pages/Editor";
import ProfilePage from "./pages/Profile";
import Dashboard from "./pages/Dashboard";
import Admin from "./pages/Admin";
import "./styles.css";

import { AppCtx, useApp, type AppInfo, type Me } from "./ctx";

function Shell() {
  const [me, setMe] = useState<Me | null>(null);
  const [app, setApp] = useState<AppInfo | null>(null);
  const [rules, setRules] = useState<RuleBook>({});
  const [ready, setReady] = useState(false);
  const [msg, setMsg] = useState("");
  const toast = useCallback((t: string) => { setMsg(t); setTimeout(() => setMsg(""), 2200); }, []);
  const refresh = useCallback(async () => {
    const r = await api<{ user: Me | null; app: AppInfo }>("/auth/me");
    setMe(r.user); setApp(r.app);
    if (r.user) setRules((await api<{ rules: RuleBook }>("/rules")).rules);
    setReady(true);
  }, []);
  useEffect(() => { refresh().catch(() => setReady(true)); }, [refresh]);
  useEffect(() => { document.title = app?.name || "Proposal Reviewer"; }, [app]);
  if (!ready) return null;
  return (
    <AppCtx.Provider value={{ me, app, rules, refresh, toast }}>
      {me ? (
        <>
          <TopBar />
          <main className="wrap">
            <Routes>
              <Route path="/" element={<Proposals />} />
              <Route path="/proposals/:id" element={<Editor />} />
              <Route path="/profile" element={<ProfilePage />} />
              {me.role !== "faculty" && <Route path="/dashboard" element={<Dashboard />} />}
              {me.role === "admin" && <Route path="/admin" element={<Admin />} />}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </>
      ) : (
        <Routes><Route path="*" element={<Login />} /></Routes>
      )}
      {msg && <div className="toast" role="status">{msg}</div>}
    </AppCtx.Provider>
  );
}

function TopBar() {
  const { me, app, refresh } = useApp();
  const nav = useNavigate();
  const out = async () => { await api("/auth/logout", { method: "POST" }); await refresh(); nav("/"); };
  return (
    <header className="topbar">
      <div className="topbar-in">
        <NavLink to="/" className="brand">{app?.name || "Proposal Reviewer"}{app?.institution && <small>{app.institution}</small>}</NavLink>
        <nav className="main">
          <NavLink to="/" end>Proposals</NavLink>
          <NavLink to="/profile">My profile</NavLink>
          {me!.role !== "faculty" && <NavLink to="/dashboard">R&amp;D dashboard</NavLink>}
          {me!.role === "admin" && <NavLink to="/admin">Admin</NavLink>}
        </nav>
        <div className="who">
          <span>{me!.name} · {me!.role === "rd" ? "R&D cell" : me!.role === "admin" ? "Admin" : "Faculty"}</span>
          <button type="button" onClick={out}>Sign out</button>
        </div>
      </div>
    </header>
  );
}

createRoot(document.getElementById("root")!).render(<React.StrictMode><BrowserRouter><Shell /></BrowserRouter></React.StrictMode>);
