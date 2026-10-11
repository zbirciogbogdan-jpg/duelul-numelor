import { useState } from "react";
import { call, type DuelSummary, type DuelView } from "./api.ts";
import { navigate } from "./ui.tsx";

export function DuelList({ duels, limit }: { duels: DuelSummary[]; limit?: number }) {
  const shown = limit ? duels.slice(0, limit) : duels;
  if (duels.length === 0) return <p className="muted">Niciun duel încă. Provoacă pe cineva și trimite-i linkul pe WhatsApp.</p>;
  return (
    <ul className="list">
      {shown.map((d) => (
        <li key={d.code}>
          <a href={`/d/${d.code}`} onClick={(e) => { e.preventDefault(); navigate(`/d/${d.code}`); }}>
            <span>{d.opponent ? `cu ${d.opponent}` : "Așteaptă adversar"}{d.legacy && <em className="muted"> (versiunea veche)</em>}</span>
            {d.status === "done"
              ? <span className={`pill ${d.won ? "win" : "loss"}`}>{d.won ? "câștigat" : "pierdut"}</span>
              : <span className="pill live">{d.status === "open" ? "se votează" : "în așteptare"}</span>}
          </a>
        </li>
      ))}
    </ul>
  );
}

export function DuelsPage({ duels }: { duels: DuelSummary[] }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const live = duels.filter((d) => d.status !== "done" && !d.legacy);
  const done = duels.filter((d) => d.status === "done" && !d.legacy);
  async function challenge() {
    setBusy(true); setErr(null);
    try { const r = await call<{ duel: DuelView }>("challenge"); navigate(`/d/${r.duel.code}`); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <div className="page">
      <section className="id"><h1>Dueluri</h1></section>
      <button className="btn btn-main btn-xl" onClick={challenge} disabled={busy}>{busy ? "Se pregătește duelul..." : "Provoacă un prieten"}</button>
      {err && <p className="error">{err}</p>}
      <section>
        <h3 className="h3">În desfășurare</h3>
        {live.length ? <DuelList duels={live} /> : <p className="muted">Niciun duel deschis acum.</p>}
      </section>
      <section>
        <h3 className="h3">Terminate</h3>
        {done.length ? <DuelList duels={done} /> : <p className="muted">Încă niciun duel terminat.</p>}
      </section>
    </div>
  );
}

export function RulesPage() {
  return (
    <div className="page rules">
      <section className="id"><h1>Cum se joacă</h1></section>
      <ol className="steps">
        <li><b>Fă-ți cardul.</b> Din prenume și data nașterii calculăm zodia, numărul destinului și cât de amuzant, de încredere, isteț, fermecător, curajos și bun la suflet „ar trebui” să fii. Asta e linia punctată din rozetă.</li>
        <li><b>Provoacă un prieten.</b> Primești un link pe care i-l trimiți. Când acceptă, duelul vostru are 6 întrebări, câte una pe fiecare trăsătură, gen „Pe cine suni la 3 noaptea?”.</li>
        <li><b>Prietenii votează.</b> Trimiteți linkul pe grup. Fiecare votant alege, la fiecare întrebare, cine dintre voi doi se potrivește mai bine. Durează 20 de secunde.</li>
        <li><b>Rozeta ta se schimbă.</b> Fiecare vot primit trage forma colorată spre ce cred prietenii despre tine. Cu cât primești mai multe voturi, cu atât contează mai puțin stelele.</li>
      </ol>
      <section className="sheet">
        <h2>Cine câștigă</h2>
        <p>Câștigă cine ia mai multe întrebări din 6. La egalitate decid voturile totale, apoi stelele. Duelul se închide după 24 de ore sau când votează 15 oameni.</p>
        <p className="muted">Cine pierde poartă 7 zile un titlu amuzant, gen „Regele scuzelor”, și primește oricum voturile câștigate la trăsături.</p>
      </section>
      <section className="sheet">
        <h2>Joc corect</h2>
        <p>Votezi doar cu un cont real, o singură dată pe întrebare. Dueliștii nu pot vota în propriul duel. Conturile noi votează cu jumătate de vot în prima zi. Gloria se câștigă doar din duelurile cu cel puțin 3 votanți.</p>
      </section>
      <section className="sheet">
        <h2>Ce înseamnă cifrele</h2>
        <p><b>Procentul unei trăsături</b>: cât de des te aleg prietenii când trebuie să aleagă între tine și altcineva, amestecat la început cu ce zic stelele.</p>
        <p><b>Aura socială</b>: câte voturi ai primit în total. Doar crește.</p>
        <p><b>Gloria</b>: cât de bun ești în dueluri. Crește când câștigi, mai mult dacă bați pe cineva mai puternic.</p>
      </section>
    </div>
  );
}
