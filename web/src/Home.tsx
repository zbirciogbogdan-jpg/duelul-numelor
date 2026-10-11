import { useEffect, useState } from "react";
import { call, getToken, setToken, type DuelSummary, type DuelView, type PlayerView } from "./api.ts";
import { Card, Forma, RegisterForm, navigate } from "./ui.tsx";

export default function Home() {
  const [token, setTok] = useState(getToken());
  const [me, setMe] = useState<PlayerView | null>(null);
  const [duels, setDuels] = useState<DuelSummary[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    call<{ me: PlayerView; duels: DuelSummary[] }>("me")
      .then((r) => { setMe(r.me); setDuels(r.duels); })
      .catch((e) => { setErr(e.message); if (!getToken()) setTok(null); });
  }, [token]);

  if (!token) {
    return (
      <div className="wrap">
        <section className="panel" style={{ padding: "24px 20px", gap: 16 }}>
          <h1>Numele tău e un card. Ce putere are?</h1>
          <p className="lead">Din prenume și data nașterii calculăm numărul destinului, zodia, elementul și puterea ta. Apoi îți provoci prietenii la dueluri amuzante, iar ei votează cine câștigă.</p>
          <RegisterForm onDone={(t) => { setToken(t); setTok(t); }} />
        </section>
      </div>
    );
  }
  if (!me) return <div className="wrap"><p className="loading">{err ?? "Se încarcă cardul..."}</p></div>;

  async function challenge() {
    setBusy(true); setErr(null);
    try {
      const r = await call<{ duel: DuelView }>("challenge");
      navigate(`/d/${r.duel.code}`);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  const need = me.level * 100;
  return (
    <div className="wrap">
      <div className="home">
        <Card p={me} />
        <div className="side-stack">
          <div className="panel">
            <h2>{me.name}, ești {me.card.klass.name}</h2>
            {me.shame && <p className="shame" style={{ margin: 0 }}>Titlu rușinos activ: „{me.shame}”</p>}
            <div className="kv">
              <div><b>{me.level}</b><span>Nivel</span></div>
              <div><b>{me.glory}</b><span>Glorie</span></div>
              <div><b>{me.wins}</b><span>Victorii</span></div>
              <div><b>{me.losses}</b><span>Înfrângeri</span></div>
            </div>
            <div className="xpbar" aria-label={`XP ${me.xp} din ${need}`}><i style={{ width: `${Math.min(100, (me.xp / need) * 100)}%` }} /></div>
            <span className="small muted">{me.xp} / {need} XP până la nivelul {me.level + 1}</span>
            <div className="row">
              <button className="btn-main" onClick={challenge} disabled={busy}>{busy ? "Se pregătește duelul..." : "Provoacă un prieten"}</button>
            </div>
            {err && <p className="error">{err}</p>}
          </div>
          <Forma c={me.card} />
        </div>
      </div>

      <section className="panel">
        <h3>Duelurile tale</h3>
        {duels.length === 0 ? (
          <p className="muted small" style={{ margin: 0 }}>Niciun duel încă. Apasă „Provoacă un prieten” și trimite-i linkul pe WhatsApp.</p>
        ) : (
          <ul className="list">
            {duels.map((d) => (
              <li key={d.code}>
                <a href={`/d/${d.code}`} onClick={(e) => { e.preventDefault(); navigate(`/d/${d.code}`); }}>
                  <span>{d.opponent ? `vs ${d.opponent}` : "Așteaptă un adversar"}</span>
                  {d.status === "done"
                    ? <span className={`pill ${d.won ? "win" : "loss"}`}>{d.won ? "câștigat" : "pierdut"}</span>
                    : <span className="pill live">{d.status === "open" ? "se votează" : "în așteptare"}</span>}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
