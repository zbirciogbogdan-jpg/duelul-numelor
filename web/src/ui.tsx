import { useRef, useState } from "react";
import type { Element } from "./engine.ts";
import { call, legacyToken, supabase, type PlayerView } from "./api.ts";

export const EL_COLOR: Record<Element, string> = { "Foc": "var(--foc)", "Apă": "var(--apa)", "Aer": "var(--aer)", "Pământ": "var(--pamant)" };
export const EL_HEX: Record<Element, string> = { "Foc": "#ff5a3d", "Apă": "#2db8ff", "Aer": "#b18cff", "Pământ": "#7ddc6a" };

export function navigate(path: string) {
  history.pushState(null, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo(0, 0);
}

export function useToast(): [string | null, (m: string) => void] {
  const [msg, setMsg] = useState<string | null>(null);
  const t = useRef<number>();
  const show = (m: string) => { setMsg(m); window.clearTimeout(t.current); t.current = window.setTimeout(() => setMsg(null), 2200); };
  return [msg, show];
}

export async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

export function Avatar({ p, size = 44 }: { p: PlayerView; size?: number }) {
  return (
    <span className={`avatar ${p.profile.legend ? "legend" : ""}`} style={{ width: size, height: size, ["--el" as string]: EL_COLOR[p.profile.el] }} aria-hidden="true">
      <span style={{ fontSize: size * 0.42 }}>{p.name.charAt(0)}</span>
      <i style={{ fontSize: size * 0.28 }}>{p.profile.sign.glyph}</i>
    </span>
  );
}

export function LoginPanel({ title = "Intră în joc", note }: { title?: string; note?: string }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const back = location.href;
  async function google() {
    setErr(null);
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: back } });
    if (error) setErr("Login-ul cu Google nu e activ încă. Folosește emailul sau încearcă mai târziu.");
  }
  async function mail(e: React.FormEvent) {
    e.preventDefault(); setErr(null); setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: back } });
    setBusy(false);
    if (error) setErr("Nu am putut trimite emailul. Verifică adresa și încearcă din nou peste un minut.");
    else setSent(true);
  }
  return (
    <section className="sheet login">
      <h2>{title}</h2>
      {note && <p className="muted">{note}</p>}
      <button className="btn btn-google" type="button" onClick={google}>
        <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
        Continuă cu Google
      </button>
      <div className="or"><span>sau cu email</span></div>
      {sent ? (
        <p className="ok">Ți-am trimis un link pe <b>{email}</b>. Deschide-l de pe acest telefon.</p>
      ) : (
        <form className="row-form" onSubmit={mail}>
          <label className="sr" htmlFor="login-email">Adresa de email</label>
          <input id="login-email" type="email" required placeholder="adresa ta de email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          <button className="btn btn-ghost" disabled={busy}>{busy ? "Se trimite..." : "Trimite link"}</button>
        </form>
      )}
      {err && <p className="error">{err}</p>}
      <p className="fine">Contul real ține jocul corect: fiecare om votează o singură dată, fără conturi false.</p>
    </section>
  );
}

export function Onboarding({ onDone }: { onDone: (me: PlayerView) => void }) {
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [age, setAge] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const legacy = legacyToken();
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null);
    if (!age) { setErr("Bifează că ai cel puțin 16 ani."); return; }
    setBusy(true);
    try {
      const r = await call<{ me: PlayerView }>("register", { name, birthdate: date, age16: true, legacyToken: legacy ?? undefined });
      onDone(r.me);
    } catch (e2) { setErr((e2 as Error).message); } finally { setBusy(false); }
  }
  return (
    <section className="sheet">
      <p className="eyebrow">Pasul 2 din 2</p>
      <h2>Ce zic stelele despre tine?</h2>
      <p className="muted">Din prenume și data nașterii calculăm zodia, numărul destinului și cum „ar trebui” să fii. Apoi prietenii vor vota cine ești de fapt.</p>
      <form className="form" onSubmit={submit}>
        <label className="field" htmlFor="ob-name">Prenumele
          <input id="ob-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={16} required={!legacy} autoComplete="given-name" placeholder="de exemplu, Bogdan" />
        </label>
        <label className="field" htmlFor="ob-date">Data nașterii
          <input id="ob-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required={!legacy} min="1925-01-01" max="2010-12-31" />
        </label>
        <label className="check" htmlFor="ob-age">
          <input id="ob-age" type="checkbox" checked={age} onChange={(e) => setAge(e.target.checked)} />
          <span>Am cel puțin 16 ani. Păstrăm doar prenumele și data nașterii.</span>
        </label>
        {legacy && <p className="fine">Ai deja un card făcut pe acest telefon. Îl legăm automat de cont, cu tot cu istoric.</p>}
        {err && <p className="error">{err}</p>}
        <button className="btn btn-main" disabled={busy}>{busy ? "Se calculează..." : legacy ? "Leagă cardul meu" : "Arată-mi hexagonul"}</button>
      </form>
    </section>
  );
}

// O explozie scurtă de „cusături” colorate, pentru momentele de confirmare (vot, rezultat).
const BURST_COLORS = ["#ff3d8b", "#ffb627", "#2de1c2", "#b18cff", "#fff4e8"];
export function Burst({ count = 22, spread = 160 }: { count?: number; spread?: number }) {
  return (
    <span className="burst" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2 + (i % 3) * 0.2;
        const d = spread * (0.55 + ((i * 37) % 45) / 100);
        return (
          <i key={i} style={{
            ["--x" as string]: `${Math.cos(a) * d}px`, ["--y" as string]: `${Math.sin(a) * d}px`,
            ["--r" as string]: `${(i * 47) % 180}deg`, background: BURST_COLORS[i % BURST_COLORS.length],
            animationDelay: `${(i % 4) * 25}ms`,
          }} />
        );
      })}
    </span>
  );
}

export function Chips({ items }: { items: (string | false | null | undefined)[] }) {
  return <div className="chips">{items.filter(Boolean).map((t) => <span key={t as string} className="chip">{t}</span>)}</div>;
}
