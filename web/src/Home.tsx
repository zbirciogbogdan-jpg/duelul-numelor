import { useState } from "react";
import { TRAITS, buildProfile, type TraitKey } from "./engine.ts";
import { call, type DuelSummary, type DuelView, type PlayerView } from "./api.ts";
import { Hexagon } from "./Hexagon.tsx";
import { LoginPanel, navigate } from "./ui.tsx";

// Pagina de start pentru cine nu e logat: un hexagon demonstrativ + login.
export function Landing() {
  const demo = buildProfile("Andreea", "1997-08-14", new Date(), { amuzant: 9, incredere: 14, istet: 6, fermecator: 11, curajos: 3, suflet: 12 },
    { amuzant: 14, incredere: 17, istet: 12, fermecator: 15, curajos: 10, suflet: 15 });
  return (
    <div className="page">
      <section className="hero">
        <p className="eyebrow">Joc pentru prieteni</p>
        <h1>Stelele zic una.<br />Prietenii zic alta.</h1>
        <p className="lead">Din nume și data nașterii afli cum „ar trebui” să fii. Apoi prietenii votează în dueluri de 6 întrebări și îți desenează hexagonul real.</p>
      </section>
      <figure className="demo">
        <Hexagon stars={demo.stars} score={demo.score} size={300} />
        <figcaption><span className="key star" /> Ce zic stelele <span className="key friends" /> Ce zic prietenii <em>(exemplu)</em></figcaption>
      </figure>
      <LoginPanel title="Fă-ți hexagonul" />
    </div>
  );
}

function topGap(p: PlayerView): { k: TraitKey; d: number } | null {
  let best: { k: TraitKey; d: number } | null = null;
  for (const [k] of TRAITS) {
    if (p.profile.votes[k] < 3) continue;
    const d = p.profile.score[k] - p.profile.stars[k];
    if (!best || Math.abs(d) > Math.abs(best.d)) best = { k, d };
  }
  return best;
}

export function Profile({ me, duels, onSignOut }: { me: PlayerView; duels: DuelSummary[]; onSignOut: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const p = me.profile;
  const gap = topGap(me);
  const need = me.level * 100;
  async function challenge() {
    setBusy(true); setErr(null);
    try { const r = await call<{ duel: DuelView }>("challenge"); navigate(`/d/${r.duel.code}`); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <div className="page">
      <section className="id">
        <p className="eyebrow">{p.legend ? "Card legendar · " : ""}{p.klass} · {p.sign.name} · {p.el}</p>
        <h1>{me.name}</h1>
        {me.shame && <p className="shame">Titlu de 7 zile: „{me.shame}”</p>}
      </section>

      <figure className="hex-wrap">
        <Hexagon stars={p.stars} score={p.score} size={340} />
        <figcaption><span className="key star" /> Stelele <span className="key friends" /> Prietenii</figcaption>
      </figure>

      <p className="insight">
        {p.aura === 0
          ? "Hexagonul tău e deocamdată doar al stelelor. Fiecare vot primit într-un duel îl schimbă."
          : gap
            ? `Prietenii te văd ${gap.d >= 0 ? "mai" : "mai puțin"} ${TRAITS.find(([k]) => k === gap.k)![1].toLowerCase()} decât zic stelele: ${p.stars[gap.k]}% → ${p.score[gap.k]}%.`
            : `Ai primit ${p.aura} voturi. Încă puține ca să contrazică stelele.`}
      </p>

      <button className="btn btn-main btn-xl" onClick={challenge} disabled={busy}>{busy ? "Se pregătește duelul..." : "Provoacă un prieten"}</button>
      {err && <p className="error">{err}</p>}

      <section className="stats" aria-label="Statistici">
        <div><b>{p.aura}</b><span>Aura socială</span></div>
        <div><b>{me.glory}</b><span>Glorie</span></div>
        <div><b>{me.wins}–{me.losses}</b><span>Victorii–înfrângeri</span></div>
        <div><b>{me.level}</b><span>Nivel · {me.xp}/{need} XP</span></div>
      </section>

      <section className="traits" aria-label="Trăsături">
        {TRAITS.map(([k, label]) => (
          <div className="trait" key={k}>
            <span className="t-name">{label}</span>
            <span className="t-bar"><i className="s" style={{ left: `${p.stars[k]}%` }} /><b style={{ width: `${p.score[k]}%` }} /></span>
            <span className="t-val">{p.score[k]}%</span>
            <span className="t-n">{p.votes[k] ? `${p.votes[k]} voturi` : "doar stelele"}</span>
          </div>
        ))}
      </section>

      <section className="day">
        <div><span className="eyebrow">Forma zilei</span><b>{p.forma}/10</b></div>
        <p>{p.horoscope}</p>
        <span className="muted small">{p.moon}</span>
      </section>

      <section>
        <h3 className="h3">Duelurile tale</h3>
        {duels.length === 0 ? (
          <p className="muted">Niciun duel încă. Provoacă pe cineva și trimite-i linkul pe WhatsApp.</p>
        ) : (
          <ul className="list">
            {duels.map((d) => (
              <li key={d.code}>
                <a href={`/d/${d.code}`} onClick={(e) => { e.preventDefault(); navigate(`/d/${d.code}`); }}>
                  <span>{d.opponent ? `vs ${d.opponent}` : "Așteaptă adversar"}{d.legacy && <em className="muted"> · versiunea veche</em>}</span>
                  {d.status === "done"
                    ? <span className={`pill ${d.won ? "win" : "loss"}`}>{d.won ? "câștigat" : "pierdut"}</span>
                    : <span className="pill live">{d.status === "open" ? "se votează" : "în așteptare"}</span>}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
      <button className="link" onClick={onSignOut}>Ieși din cont</button>
    </div>
  );
}
