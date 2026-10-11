import { StrictMode, useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Session } from "@supabase/supabase-js";
import "./styles.css";
import { call, setSession, supabase, type DuelSummary, type PlayerView } from "./api.ts";
import { Landing, Profile } from "./Home.tsx";
import Duel from "./Duel.tsx";
import { DuelsPage, RulesPage } from "./Pages.tsx";
import { Avatar, Onboarding, navigate } from "./ui.tsx";

function App() {
  const [path, setPath] = useState(location.pathname);
  const [session, setSess] = useState<Session | null | undefined>(undefined);
  const [me, setMe] = useState<PlayerView | null | undefined>(undefined);
  const [duels, setDuels] = useState<DuelSummary[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const on = () => setPath(location.pathname);
    window.addEventListener("popstate", on);
    return () => window.removeEventListener("popstate", on);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setSess(data.session); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { setSession(s); setSess(s); });
    return () => sub.subscription.unsubscribe();
  }, []);

  const loadMe = useCallback(async () => {
    try {
      const r = await call<{ me: PlayerView | null; duels?: DuelSummary[] }>("me");
      setMe(r.me); setDuels(r.duels ?? []); setErr(null);
    } catch (e) { setErr((e as Error).message); setMe(null); }
  }, []);
  useEffect(() => {
    const on = () => loadMe();
    window.addEventListener("dn:reload", on);
    return () => window.removeEventListener("dn:reload", on);
  }, [loadMe]);
  useEffect(() => {
    if (session === undefined) return;
    if (session) loadMe(); else { setMe(undefined); setDuels([]); }
  }, [session?.user.id, loadMe]); // eslint-disable-line react-hooks/exhaustive-deps

  const m = path.match(/^\/d\/([a-z0-9]{5,10})\/?$/);
  const go = (p: string) => (e: React.MouseEvent) => { e.preventDefault(); navigate(p); if (session) loadMe(); };
  const loading = session === undefined || (session && me === undefined);
  let body: JSX.Element;
  if (m) {
    body = <Duel key={m[1]} code={m[1]} signedIn={!!session} me={session ? me : null}
      onMe={(p) => { setMe(p); loadMe(); }} />;
  } else if (path === "/reguli") {
    body = <RulesPage />;
  } else if (loading) {
    body = <div className="page"><p className="loading">{err ?? "Se încarcă..."}</p></div>;
  } else if (!session) {
    body = <Landing />;
  } else if (me === null) {
    body = <div className="page"><Onboarding onDone={(p) => { setMe(p); loadMe(); }} /></div>;
  } else if (path === "/dueluri") {
    body = <DuelsPage duels={duels} />;
  } else {
    body = <Profile me={me!} duels={duels} onSignOut={async () => { await supabase.auth.signOut(); navigate("/"); }} />;
  }
  const live = duels.filter((d) => d.status !== "done" && !d.legacy).length;
  const tab = path === "/dueluri" ? "duels" : path === "/reguli" ? "rules" : m ? "duel" : "home";

  return (
    <>
      <header className="top">
        <div className="top-row">
          <a className="brand" href="/" onClick={go("/")}>Duelul Numelor</a>
          {me && <a href="/" className="me-chip" onClick={go("/")} aria-label="Profilul meu"><Avatar p={me} size={34} /></a>}
        </div>
        <nav className="nav" aria-label="Meniu">
          <a href="/" className={tab === "home" ? "on" : ""} onClick={go("/")}>{me ? "Profilul meu" : "Acasă"}</a>
          {me && <a href="/dueluri" className={tab === "duels" ? "on" : ""} onClick={go("/dueluri")}>Dueluri{live > 0 && <span className="badge">{live}</span>}</a>}
          <a href="/reguli" className={tab === "rules" ? "on" : ""} onClick={go("/reguli")}>Cum se joacă</a>
        </nav>
      </header>
      <main>{body}</main>
    </>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
