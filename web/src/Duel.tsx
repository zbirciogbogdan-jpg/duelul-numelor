import { useCallback, useEffect, useMemo, useState } from "react";
import { TRAIT_NAME, hashStr } from "./engine.ts";
import { call, deviceId, type DuelView, type PlayerView, type RoundView } from "./api.ts";
import { Avatar, Burst, EL_COLOR, EL_HEX, LoginPanel, Onboarding, copyText, navigate, useToast } from "./ui.tsx";
import { Hexagon } from "./Hexagon.tsx";
import { shareResult } from "./share.ts";

const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1).replace(".", ","));

function useCountdown(deadline: string | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);
  if (!deadline) return null;
  const ms = Math.max(0, new Date(deadline).getTime() - now);
  const h = Math.floor(ms / 3600e3), m = Math.floor((ms % 3600e3) / 60e3);
  return ms === 0 ? "acum" : h > 0 ? `${h} h ${m} min` : `${m} min`;
}

function Bar({ d, r }: { d: DuelView; r: RoundView }) {
  if (!r.counts || !d.B) return null;
  const { A, B, n } = r.counts;
  const tot = A + B;
  const pa = tot ? (A / tot) * 100 : 50;
  return (
    <div className="vbar" role="img" aria-label={`${d.A.name} ${fmt(A)}, ${d.B.name} ${fmt(B)}`}
      style={{ ["--ca" as string]: EL_COLOR[d.A.profile.el], ["--cb" as string]: EL_COLOR[d.B.profile.el] }}>
      <div className="vbar-track"><i className="a" style={{ width: `${pa}%` }} /><i className="b" style={{ width: `${100 - pa}%` }} /></div>
      <div className="vbar-legend"><span>{d.A.name} · {fmt(A)}</span><span className="muted">{n} {n === 1 ? "vot" : "voturi"}</span><span>{fmt(B)} · {d.B.name}</span></div>
    </div>
  );
}

function VoteFlow({ d, onVote, busy }: { d: DuelView; onVote: (round: number, pick: "A" | "B") => void; busy: boolean }) {
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  const [burst, setBurst] = useState(0);
  const next = d.rounds.findIndex((r, i) => !r.mine && !skipped.has(i));
  const answered = d.rounds.filter((r) => r.mine).length;
  if (next === -1) {
    return (
      <section className="sheet done-voting">
        <Burst key={burst} count={36} spread={220} />
        <h2>Gata, ai votat.</h2>
        <p className="muted">Ai răspuns la {answered} din 6 întrebări. Rezultatul final apare când se închide duelul.</p>
        {skipped.size > 0 && <button className="link" onClick={() => setSkipped(new Set())}>Revino la întrebările sărite</button>}
      </section>
    );
  }
  const r = d.rounds[next];
  // Ordinea celor doi se schimbă de la o întrebare la alta, ca să nu câștige mereu cel din stânga.
  const flip = hashStr(`${d.code}|${next}|${deviceId()}`) % 2 === 1;
  const order: ("A" | "B")[] = flip ? ["B", "A"] : ["A", "B"];
  return (
    <section className="vote" aria-live="polite">
      {burst > 0 && <Burst key={burst} />}
      <div className="vote-top">
        <span className="eyebrow">{TRAIT_NAME[r.trait]}, întrebarea {next + 1} din 6</span>
        <span className="dots">{d.rounds.map((x, i) => <i key={i} className={x.mine ? "on" : i === next ? "cur" : skipped.has(i) ? "skip" : ""} />)}</span>
      </div>
      <h2 className="vote-q" key={r.id}>{r.q}</h2>
      <div className="vote-pick" key={`p${r.id}`}>
        {order.map((side) => {
          const p = side === "A" ? d.A : d.B!;
          return (
            <button key={side} className="pick" disabled={busy} onClick={() => { setBurst((b) => b + 1); onVote(next, side); }} style={{ ["--el" as string]: EL_COLOR[p.profile.el] }}>
              <Avatar p={p} size={72} />
              <span className="pick-name">{p.name}</span>
            </button>
          );
        })}
      </div>
      <button className="link" disabled={busy} onClick={() => setSkipped(new Set(skipped).add(next))}>Nu știu, sar peste</button>
    </section>
  );
}

export default function Duel({ code, signedIn, me, onMe }: {
  code: string; signedIn: boolean; me: PlayerView | null | undefined; onMe: (p: PlayerView) => void;
}) {
  const [d, setD] = useState<DuelView | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, showToast] = useToast();
  const left = useCountdown(d?.deadline ?? null);

  const load = useCallback(async () => {
    try { const r = await call<{ duel: DuelView }>("duel", { code }); setD(r.duel); setErr(null); }
    catch (e) { setErr((e as Error).message); }
  }, [code]);
  useEffect(() => { load(); }, [load, signedIn, me?.id]);
  useEffect(() => {
    if (!d || d.status === "done") return;
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [d?.status, load]);

  const link = useMemo(() => `${location.origin}/d/${code}`, [code]);
  if (!d) return <div className="page"><p className="loading">{err ?? "Se încarcă duelul..."}</p></div>;

  async function act(action: string, data: Record<string, unknown> = {}) {
    setBusy(true); setErr(null);
    try { const r = await call<{ duel: DuelView }>(action, { code, ...data }); setD(r.duel); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }
  async function share(text: string) {
    const nav = navigator as Navigator & { share?: (x: ShareData) => Promise<void> };
    if (nav.share) { try { await nav.share({ text, url: link }); return; } catch { /* anulat */ } }
    showToast((await copyText(link)) ? "Linkul a fost copiat" : "Selectează linkul și copiază-l");
  }
  async function rematch() {
    setBusy(true); setErr(null);
    try { const r = await call<{ duel: DuelView }>("challenge", { rematchOf: code }); navigate(`/d/${r.duel.code}`); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  const wa = (t: string) => `https://wa.me/?text=${encodeURIComponent(`${t} ${link}`)}`;
  const A = d.A, B = d.B;
  const needsLogin = !signedIn;
  const needsCard = signedIn && me === null;

  if (d.version < 3) {
    return <div className="page"><section className="sheet"><h2>Duel din versiunea veche</h2><p className="muted">Acest duel s-a jucat cu regulile vechi și nu mai poate fi afișat.</p><a className="btn btn-ghost" href="/" onClick={(e) => { e.preventDefault(); navigate("/"); }}>Înapoi la profil</a></section></div>;
  }

  return (
    <div className="page">
      {/* Antetul duelului */}
      <section className="duel-head">
        <div className="side"><Avatar p={A} size={64} /><b>{A.name}</b><span className="muted small">{A.profile.klass}</span></div>
        <div className="vs">
          <span>VS</span>
          <em className={`pill ${d.status === "done" ? "" : "live"}`}>{d.status === "pending" ? "așteaptă" : d.status === "open" ? `se votează, încă ${left}` : "terminat"}</em>
        </div>
        <div className="side">
          {B ? <><Avatar p={B} size={64} /><b>{B.name}</b><span className="muted small">{B.profile.klass}</span></>
            : <><span className="avatar empty" style={{ width: 64, height: 64 }}>?</span><b>Oricine</b><span className="muted small">primește linkul</span></>}
        </div>
      </section>

      {err && <p className="error">{err}</p>}

      {/* În așteptare */}
      {d.status === "pending" && d.role === "A" && (
        <section className="sheet">
          <h2>Trimite duelul cuiva</h2>
          <p className="muted">{d.invitedOnly ? `Revanșa îl așteaptă pe ${B?.name}.` : "Primul care deschide linkul și acceptă devine adversarul tău."}</p>
          <div className="share-link"><code>{link}</code></div>
          <div className="row">
            <a className="btn btn-main" href={wa(`${A.name} te provoacă la Duelul Numelor:`)} target="_blank" rel="noopener">Trimite pe WhatsApp</a>
            <button className="btn btn-ghost" onClick={() => share(`${A.name} te provoacă la Duelul Numelor.`)}>Alt mod</button>
          </div>
        </section>
      )}
      {d.status === "pending" && d.role !== "A" && (
        <section className="sheet">
          <h2>{A.name} te provoacă la duel</h2>
          <p className="muted">6 întrebări despre voi doi. Prietenii votează cine se potrivește mai bine, iar voturile îți desenează hexagonul.</p>
          {d.invitedOnly && me && me.id !== B?.id ? <p className="muted">Revanșa aceasta e rezervată altcuiva.</p>
            : needsLogin ? <LoginPanel title="Intră ca să accepți" />
            : needsCard ? <Onboarding onDone={onMe} />
            : me ? <button className="btn btn-main btn-xl" disabled={busy} onClick={() => act("accept")}>Accept duelul</button> : null}
        </section>
      )}

      {/* Votul */}
      {d.status === "open" && !d.role && (
        needsLogin ? <LoginPanel title={`Votează: ${A.name} sau ${B!.name}?`} note="Votul cere cont, ca fiecare om să voteze o singură dată." />
          : needsCard ? <Onboarding onDone={onMe} />
          : d.canVote ? <VoteFlow d={d} busy={busy} onVote={(round, pick) => act("vote", { round, pick })} /> : null
      )}
      {d.status === "open" && d.role && (
        <section className="sheet">
          <h2>Cere voturi</h2>
          <p className="muted">Au votat {d.voters} {d.voters === 1 ? "om" : "oameni"}. Duelul se închide peste {left} sau la {d.voterLimit} votanți. Gloria se dă doar de la {d.rankedMin} votanți în sus.</p>
          <div className="row">
            <a className="btn btn-main" href={wa(`Votează în duelul meu cu ${d.role === "A" ? B!.name : A.name}, durează 20 de secunde:`)} target="_blank" rel="noopener">Cere voturi pe WhatsApp</a>
            <button className="btn btn-ghost" onClick={() => share("Votează în duelul nostru:")}>Alt mod</button>
          </div>
          <button className="link" disabled={busy} onClick={() => act("end")}>Încheie acum (doar în faza de test)</button>
        </section>
      )}

      {/* Rezultatul */}
      {d.status === "done" && d.result && B && (() => {
        const r = d.result;
        const win = r.winner === "A" ? A : B, lose = r.winner === "A" ? B : A;
        const iWon = d.role ? d.role === r.winner : null;
        return (
          <section className="verdict">
            <Burst count={44} spread={280} />
            <p className="eyebrow">Au decis {r.voters} {r.voters === 1 ? "votant" : "votanți"}</p>
            <h2>{win.name} câștigă {r.score}</h2>
            <p className="muted">{lose.name} poartă 7 zile titlul „{r.shame}”.{r.decidedBy === "votes" ? " La egalitate de întrebări au decis voturile totale." : r.decidedBy === "stars" ? " Egalitate perfectă: au decis stelele." : ""}</p>
            {iWon !== null && (
              <p className="small">{r.ranked
                ? (iWon ? `+${r.gloryGain} Glorie, +${r.xpWin} XP.` : `−${r.gloryLoss} Glorie, +${r.xpLoss} XP.`)
                : `Sub ${d.rankedMin} votanți, deci fără Glorie. +${iWon ? r.xpWin : r.xpLoss} XP.`} Voturile primite au intrat în hexagonul tău.</p>
            )}
            <div className="row">
              <button className="btn btn-main" onClick={async () => { try { if ((await shareResult(d)) === "downloaded") showToast("Imaginea a fost salvată"); } catch (e) { setErr((e as Error).message); } }}>Imaginea pentru Story</button>
              {d.role && <button className="btn btn-ghost" disabled={busy} onClick={rematch}>{iWon ? "Încă un duel" : "Revanșă"}</button>}
              {!d.role && <a className="btn btn-ghost" href="/" onClick={(e) => { e.preventDefault(); navigate("/"); }}>Fă-ți și tu hexagonul</a>}
            </div>
          </section>
        );
      })()}

      {/* Întrebările */}
      {(d.status !== "open" || d.role || (d.canVote && d.rounds.some((r) => r.mine))) && (
        <section>
          <h3 className="h3">{d.status === "pending" ? "Cele 6 întrebări" : d.status === "done" ? "Cum au votat prietenii" : d.role ? "Voturile de până acum" : "Ce au votat ceilalți"}</h3>
          <ol className="qs">
            {d.rounds.map((r, i) => {
              const rr = d.result?.rounds[i];
              if (d.status === "open" && !d.role && !r.counts) return null;
              return (
                <li key={r.id} className={rr ? `won-${rr.win}` : ""}>
                  <div className="q-top"><span className="eyebrow">{TRAIT_NAME[r.trait]}</span>{rr && <span className="pill win">{rr.win === "A" ? A.name : B?.name}</span>}</div>
                  <p className="q-text">{r.q}</p>
                  <Bar d={d} r={r} />
                  {rr && <p className="small muted">{rr.why}</p>}
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {d.status === "done" && B && (
        <section className="compare-hex">
          <figure><Hexagon stars={A.profile.stars} score={A.profile.score} size={180} labels={false} tint={EL_HEX[A.profile.el]} /><figcaption>{A.name}</figcaption></figure>
          <figure><Hexagon stars={B.profile.stars} score={B.profile.score} size={180} labels={false} tint={EL_HEX[B.profile.el]} /><figcaption>{B.name}</figcaption></figure>
        </section>
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
