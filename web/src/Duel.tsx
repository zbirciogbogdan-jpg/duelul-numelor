import { useCallback, useEffect, useState } from "react";
import { TRAIT_NAME } from "./engine.ts";
import { call, getToken, setToken, voterKey, type DuelView } from "./api.ts";
import { Card, EL_COLOR, RegisterForm, copyText, navigate, useToast } from "./ui.tsx";
import { shareResult } from "./share.ts";

const fmt = (v: number) => v.toFixed(1).replace(".", ",");

function useCountdown(deadline: string | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  if (!deadline) return null;
  const ms = Math.max(0, new Date(deadline).getTime() - now);
  const h = Math.floor(ms / 3600e3), m = Math.floor((ms % 3600e3) / 60e3);
  return ms === 0 ? "se închide acum" : `${h} h ${m} min`;
}

export default function Duel({ code }: { code: string }) {
  const [d, setD] = useState<DuelView | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hasToken, setHasToken] = useState(!!getToken());
  const [toast, showToast] = useToast();
  const left = useCountdown(d?.deadline ?? null);

  const load = useCallback(async () => {
    try {
      const r = await call<{ duel: DuelView }>("duel", { code, voterKey: voterKey() });
      setD(r.duel); setErr(null);
    } catch (e) { setErr((e as Error).message); }
  }, [code]);

  useEffect(() => { load(); }, [load, hasToken]);
  useEffect(() => {
    if (!d || d.status === "done") return;
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [d?.status, load]);

  if (!d) return <div className="wrap"><p className="loading">{err ?? "Se încarcă duelul..."}</p></div>;

  const link = `${location.origin}/d/${d.code}`;
  async function act(action: string, data: Record<string, unknown> = {}) {
    setBusy(true); setErr(null);
    try {
      const r = await call<{ duel: DuelView }>(action, { code: d!.code, voterKey: voterKey(), ...data });
      setD(r.duel);
      return r.duel;
    } catch (e) { setErr((e as Error).message); return null; } finally { setBusy(false); }
  }
  async function share(text: string) {
    const nav = navigator as Navigator & { share?: (x: ShareData) => Promise<void> };
    if (nav.share) { try { await nav.share({ text, url: link }); return; } catch { /* anulat */ } }
    if (await copyText(link)) showToast("Linkul a fost copiat");
    else showToast("Selectează linkul și copiază-l");
  }
  async function rematch() {
    setBusy(true); setErr(null);
    try {
      const r = await call<{ duel: DuelView }>("challenge", { rematchOf: d!.code });
      navigate(`/d/${r.duel.code}`);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  const A = d.A, B = d.B;
  const colA = EL_COLOR[A.card.el], colB = B ? EL_COLOR[B.card.el] : "var(--line)";
  const wa = (t: string) => `https://wa.me/?text=${encodeURIComponent(`${t} ${link}`)}`;


  return (
    <div className="wrap">
      {/* Antet */}
      {d.status === "pending" && d.role === "A" && (
        <section className="panel">
          <h2>Duelul e gata. Trimite-l cuiva.</h2>
          <p className="muted" style={{ margin: 0 }}>{d.invitedOnly ? `Revanșa îl așteaptă pe ${B?.name ?? "adversar"}.` : "Primul care deschide linkul și acceptă devine adversarul tău."}</p>
          <div className="share-link"><code>{link}</code></div>
          <div className="row">
            <a className="btn btn-main" href={wa(`${A.name} te provoacă la Duelul Numelor. Arată-i cine ești:`)} target="_blank" rel="noopener">Trimite pe WhatsApp</a>
            <button className="btn-ghost" onClick={() => share(`${A.name} te provoacă la Duelul Numelor.`)}>Alt mod de trimitere</button>
          </div>
        </section>
      )}
      {d.status === "pending" && d.role !== "A" && (
        <section className="panel">
          <h1>{A.name} te provoacă la duel</h1>
          <p className="lead">Trei întrebări despre voi doi. Prietenii votează cine se potrivește mai bine, iar fiecare vot primit îți crește trăsăturile de pe card.</p>
        </section>
      )}
      {d.status === "open" && (
        <section className="panel">
          <h2>{d.role ? "Duelul tău e în desfășurare" : `Cine se potrivește mai bine: ${A.name} sau ${B!.name}?`}</h2>
          <p className="muted" style={{ margin: 0 }}>
            Se închide în {left}, sau când votează {d.voterLimit} oameni. Au votat până acum: {d.voters}.
          </p>
          {d.role && (
            <div className="row">
              <a className="btn btn-main" href={wa(`Votează în duelul meu cu ${d.role === "A" ? B!.name : A.name}:`)} target="_blank" rel="noopener">Cere voturi pe WhatsApp</a>
              <button className="btn-ghost" onClick={() => share("Votează în duelul meu:")}>Alt mod de trimitere</button>
              <button className="btn-quiet" disabled={busy} onClick={() => act("end")}>Încheie acum (faza de test)</button>
            </div>
          )}
        </section>
      )}
      {d.status === "done" && d.result && B && (() => {
        const r = d.result;
        const win = r.winner === "A" ? A : B, lose = r.winner === "A" ? B : A;
        const iWon = d.role ? d.role === r.winner : null;
        return (
          <section className="verdict">
            <div className="big">{win.name} l-a învins pe {lose.name}, {r.score}.</div>
            <div className="muted">{lose.name} poartă 7 zile titlul „{r.shame}”.</div>
            {iWon !== null && (
              <div className="small">{iWon ? `Ai câștigat +${r.gloryGain} Glorie și ${r.xpWin} XP.` : `Ai pierdut ${r.gloryLoss} Glorie și ai primit ${r.xpLoss} XP.`} Voturile primite ({d.role === "A" ? r.votesA : r.votesB}) s-au adăugat la trăsăturile și Aura ta.</div>
            )}
            <div className="row" style={{ marginTop: 6 }}>
              <button className="btn-main" onClick={async () => { try { const how = await shareResult(d); if (how === "downloaded") showToast("Imaginea a fost salvată"); } catch (e) { setErr((e as Error).message); } }}>Imaginea pentru Story</button>
              {d.role && <button className="btn-ghost" disabled={busy} onClick={rematch}>{iWon ? "Mai joacă o dată" : "Revanșă"}</button>}
              {!d.role && <a className="btn btn-ghost" href="/" onClick={(e) => { e.preventDefault(); navigate("/"); }}>Fă-ți și tu cardul</a>}
            </div>
          </section>
        );
      })()}

      {err && <p className="error">{err}</p>}

      {/* Cardurile */}
      <section className="arena" aria-label="Cardurile">
        <Card p={A} />
        <div className="vs" aria-hidden="true">VS</div>
        {B ? <Card p={B} /> : <div className="empty-card">Locul adversarului.<br />Poate fi oricine primește linkul.</div>}
      </section>

      {/* Acceptare */}
      {d.status === "pending" && d.role === null && (
        d.invitedOnly ? (
          <p className="muted">Această revanșă e rezervată altcuiva.</p>
        ) : !hasToken ? (
          <section className="panel">
            <h3>Fă-ți cardul ca să răspunzi</h3>
            <RegisterForm cta="Fă-mi cardul" onDone={(t) => { setToken(t); setHasToken(true); }} />
          </section>
        ) : (
          <>
            <div className="row">
              <button className="btn-main" disabled={busy} onClick={() => act("accept")}>Accept duelul</button>
            </div>
          </>
        )
      )}

      {/* Rundele */}
      <h3>{d.status === "pending" ? "Întrebările duelului" : d.status === "open" ? "Votează la fiecare întrebare" : "Cum au votat prietenii"}</h3>
      <section className="rounds" aria-label="Rundele">
        {d.categories.map((c, i) => {
          const v = d.votes[i];
          const rr = d.result?.rounds[i];
          const total = v.A + v.B;
          const pa = rr ? (rr.totA / (rr.totA + rr.totB)) * 100 : total ? (v.A / total) * 100 : 50;
          const winName = rr ? (rr.win === "A" ? A.name : B?.name) : null;
          return (
            <article className="round" key={i}>
              <div className="r-top"><span>Runda {i + 1} · {TRAIT_NAME[c.trait]}</span>{winName && <span>câștigă {winName}</span>}</div>
              <p className="r-q">{c.q}</p>
              {B && d.status !== "pending" && (
                <div className="bar" style={{ ["--ca" as string]: colA, ["--cb" as string]: colB }} role="img"
                  aria-label={rr ? `${A.name} ${fmt(rr.totA)} puncte, ${B.name} ${fmt(rr.totB)} puncte` : `${A.name} ${v.A} voturi, ${B.name} ${v.B} voturi`}>
                  <span className="a" style={{ width: `${pa}%` }}>{A.name} {rr ? fmt(rr.totA) : v.A}</span>
                  <span className="b" style={{ width: `${100 - pa}%` }}>{rr ? fmt(rr.totB) : v.B} {B.name}</span>
                </div>
              )}
              {d.status === "open" && !d.role && B && (
                <div className="vote-row">
                  {(["A", "B"] as const).map((side) => (
                    <button key={side} type="button" disabled={busy}
                      className={`btn-ghost ${d.myVotes[i] === side ? "picked" : ""}`}
                      aria-pressed={d.myVotes[i] === side}
                      onClick={() => act("vote", { round: i, pick: side })}>
                      {side === "A" ? A.name : B.name}
                    </button>
                  ))}
                </div>
              )}
              {rr && (
                <>
                  <p className="r-why">{rr.why}</p>
                  <div className="r-math">
                    <div>Voturi: {rr.vA} – {rr.vB} → {fmt(rr.voteA)} – {fmt(rr.voteB)} (din 85)</div>
                    <div>Card ({TRAIT_NAME[rr.trait]}, cu Forma zilei): {fmt(rr.cardA)} – {fmt(rr.cardB)} (din 15)</div>
                    <div>Zar: {rr.dice >= 0 ? "+" : "−"}{fmt(Math.abs(rr.dice))} pentru {A.name}</div>
                  </div>
                </>
              )}
            </article>
          );
        })}
      </section>

      {d.status === "open" && !d.role && (
        <p className="small muted">Votul e anonim. Poți vota o dată pe fiecare rundă și îți poți schimba votul cât timp duelul e deschis.</p>
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
