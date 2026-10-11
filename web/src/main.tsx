import { StrictMode, useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Session } from "@supabase/supabase-js";
import "./styles.css";
import { call, setSession, supabase, type DuelSummary, type PlayerView } from "./api.ts";
import { Landing, Profile } from "./Home.tsx";
import Duel from "./Duel.tsx";
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
    if (session === undefined) return;
    if (session) loadMe(); else { setMe(undefined); setDuels([]); }
  }, [session?.user.id, loadMe]); // eslint-disable-line react-hooks/exhaustive-deps

  const m = path.match(/^\/d\/([a-z0-9]{5,10})\/?$/);
  let body: JSX.Element;
  if (m) {
    body = <Duel key={m[1]} code={m[1]} signedIn={!!session} me={session ? me : null}
      onMe={(p) => { setMe(p); loadMe(); }} />;
  } else if (session === undefined || (session && me === undefined)) {
    body = <div className="page"><p className="loading">{err ?? "Se încarcă..."}</p></div>;
  } else if (!session) {
    body = <Landing />;
  } else if (me === null) {
    body = <div className="page"><Onboarding onDone={(p) => { setMe(p); loadMe(); }} /></div>;
  } else {
    body = <Profile me={me!} duels={duels} onSignOut={async () => { await supabase.auth.signOut(); navigate("/"); }} />;
  }

  return (
    <>
      <header className="top">
        <a className="brand" href="/" onClick={(e) => { e.preventDefault(); navigate("/"); if (session) loadMe(); }}>Duelul Numelor</a>
        {me && <a href="/" className="me-chip" onClick={(e) => { e.preventDefault(); navigate("/"); loadMe(); }} aria-label="Profilul meu"><Avatar p={me} size={34} /></a>}
      </header>
      <main>{body}</main>
    </>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
