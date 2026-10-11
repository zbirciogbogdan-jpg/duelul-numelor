import { useEffect, useState } from "react";
import { call, getToken, setToken, type DuelSummary, type DuelView, type PlayerView } from "./api.ts";
import { Card, Forma, RegisterForm, navigate } from "./ui.tsx";
import { TRAITS } from "./engine.ts";
import type { CardView } from "./api.ts";

function StarsVsFriends({ c }: { c: CardView }) {
  const top = [...TRAITS].sort((a, b) => c.points[b[0]] - c.points[a[0]])[0];
  return (
    <div className="panel">
      <h3>Ce zic stelele și ce zic prietenii</h3>
      <div className="legend-row">
        <span><i style={{ background: "var(--gilt-soft)" }} />Stelele (de la început)</span>
        <span><i style={{ background: "var(--gilt)" }} />Adăugat din voturile prietenilor</span>
      </div>
      <div className="compare">
        {TRAITS.map(([k, label]) => (
          <div className="compare-row" key={k}>
            <span>{label}</span>
            <div className="track" aria-hidden="true"><b style={{ width: `${c.traits[k]}%` }} /><s style={{ width: `${c.stars[k]}%` }} /></div>
            <em>{c.stars[k]} → {c.traits[k]}</em>
          </div>
        ))}
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        {c.aura === 0
          ? "Încă n-ai primit voturi. Provoacă un prieten și cere-le celorlalți să voteze: fiecare vot îți crește trăsătura întrebării."
          : `Aura ta socială: ${c.aura} voturi primite. Prietenii te văd cel mai mult ${top[1].toLowerCase()}. Valorile doar cresc, nu scad niciodată.`}
      </p>
    </div>
  );
}

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
          <h1>Stelele zic una. Prietenii zic alta.</h1>
          <p className="lead">Stelele îți dau un punct de plecare: din prenume și data nașterii calculăm zodia, numărul destinului și cât de amuzant, isteț sau curajos „ar trebui” să fii. Apoi prietenii votează în dueluri și arată cine ești de fapt.</p>
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
          <StarsVsFriends c={me.card} />
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
