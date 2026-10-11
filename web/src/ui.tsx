import { useEffect, useRef, useState } from "react";
import { STATS, type Element } from "./engine.ts";
import { call, type CardView, type PlayerView } from "./api.ts";

export const EL_COLOR: Record<Element, string> = { "Foc": "var(--foc)", "Apă": "var(--apa)", "Aer": "var(--aer)", "Pământ": "var(--pamant)" };
export const EL_HEX: Record<Element, string> = { "Foc": "#ff7b3f", "Apă": "#4cb0ff", "Aer": "#c2b2ff", "Pământ": "#93c76b" };

export function navigate(path: string) {
  history.pushState(null, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo(0, 0);
}

export function Card({ p }: { p: PlayerView }) {
  const c = p.card;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      el.style.setProperty("--ry", `${(x - 0.5) * 16}deg`);
      el.style.setProperty("--rx", `${(0.5 - y) * 14}deg`);
      el.style.setProperty("--mx", `${x * 100}%`);
      el.style.setProperty("--my", `${y * 100}%`);
    };
    const leave = () => { el.style.setProperty("--rx", "0deg"); el.style.setProperty("--ry", "0deg"); };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerleave", leave); };
  }, []);
  const rarity = c.legend ? "Legendar" : "Comun";
  return (
    <div className="card-shell">
      <div ref={ref} className={`card ${c.legend ? "legend" : "common"}`} style={{ ["--el" as string]: EL_COLOR[c.el] }}>
        <div className="face">
          <div className="c-head"><span className="c-rar">{rarity}</span><span className="c-lvl">Nivel {p.level} · Glorie {p.glory}</span></div>
          <div className="c-mid">
            <div className="c-glyph" aria-hidden="true">{c.sign.glyph}</div>
            <div className="c-name">{c.name}</div>
            <div className="c-class"><b>{c.klass.name}</b> · {c.sign.name} · {c.el}</div>
          </div>
          <div className="c-stats">
            {STATS.map(([k, label]) => (
              <div className="st" key={k}><span>{label}</span><em>{c.stats[k]}</em><i style={{ ["--v" as string]: `${c.stats[k]}%` }} /></div>
            ))}
          </div>
          <div className="c-foot">Trăsătura zodiei: <b>{c.sign.trait}</b></div>
        </div>
        <div className="c-num" title="Numărul destinului">{c.destiny}</div>
      </div>
    </div>
  );
}

export function Forma({ c, title = "Forma zilei" }: { c: CardView; title?: string }) {
  return (
    <div className="panel">
      <div className="forma-top"><h3>{title}</h3><span className="score">{c.forma}/10</span></div>
      <div className="pips" aria-hidden="true">{Array.from({ length: 10 }, (_, i) => <i key={i} className={i < c.forma ? "on" : ""} />)}</div>
      <p style={{ margin: 0 }}>{c.horoscope}</p>
      <ul className="reasons">{c.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
      <p className="power small" style={{ margin: 0 }}>Puterea: <b>„{c.klass.power}”</b>, {c.klass.effect}.</p>
    </div>
  );
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

export function RegisterForm({ onDone, cta = "Arată-mi cardul" }: { onDone: (token: string) => void; cta?: string }) {
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [age, setAge] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!age) { setErr("Bifează că ai cel puțin 16 ani."); return; }
    setBusy(true);
    try {
      const r = await call<{ token: string }>("register", { name, birthdate: date, age16: true });
      onDone(r.token);
    } catch (e2) { setErr((e2 as Error).message); } finally { setBusy(false); }
  }
  return (
    <form className="form" onSubmit={submit}>
      <label className="field" htmlFor="reg-name">Prenumele tău
        <input id="reg-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={16} required autoComplete="given-name" placeholder="de exemplu, Bogdan" />
      </label>
      <label className="field" htmlFor="reg-date">Data nașterii
        <input id="reg-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required min="1925-01-01" max="2010-12-31" />
      </label>
      <label className="check" htmlFor="reg-age">
        <input id="reg-age" type="checkbox" checked={age} onChange={(e) => setAge(e.target.checked)} />
        <span>Am cel puțin 16 ani. Păstrăm doar prenumele și data nașterii, ca să-ți calculăm cardul.</span>
      </label>
      {err && <p className="error">{err}</p>}
      <div className="row"><button className="btn-main" disabled={busy}>{busy ? "Se calculează..." : cta}</button></div>
    </form>
  );
}
