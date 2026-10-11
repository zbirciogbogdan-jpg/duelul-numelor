// Duelul Numelor — motorul de calcul (v3).
// Același fișier rulează pe server (autoritativ) și în aplicație (afișare).
//
// Logica:
//  - Fiecare om are 6 trăsături. Stelele (zodie + numerologie) dau o prezicere între 35% și 65%.
//  - Scorul unei trăsături = cât de des te aleg prietenii când trebuie să aleagă între tine și altcineva,
//    netezit bayesian cu prezicerea stelelor: (voturi primite + K × stele) / (voturi totale + K).
//    Fără voturi, scorul e al stelelor; cu multe voturi, e al prietenilor.
//  - Aura socială = totalul voturilor primite (doar crește).
//  - Duelul are 6 întrebări, câte una pe trăsătură. Câștigă cine ia mai multe întrebări.

import { QUESTIONS, type Question } from "./questions.ts";
export { QUESTIONS, type Question };

export type TraitKey = "amuzant" | "incredere" | "istet" | "fermecator" | "curajos" | "suflet";
export type Element = "Foc" | "Apă" | "Aer" | "Pământ";
export type Traits = Record<TraitKey, number>;

export const TRAITS: [TraitKey, string][] = [
  ["amuzant", "Amuzant"], ["incredere", "De încredere"], ["istet", "Isteț"],
  ["fermecator", "Fermecător"], ["curajos", "Curajos"], ["suflet", "Bun la suflet"],
];
export const TRAIT_NAME: Record<TraitKey, string> = Object.fromEntries(TRAITS) as Record<TraitKey, string>;
export const TRAIT_KEYS = TRAITS.map(([k]) => k);
export const zeroTraits = (): Traits => ({ amuzant: 0, incredere: 0, istet: 0, fermecator: 0, curajos: 0, suflet: 0 });

export const PRIOR_WEIGHT = 10; // câte voturi „valorează” prezicerea stelelor

const LET: Record<string, number> = { a:1,b:2,c:3,d:4,e:5,f:6,g:7,h:8,i:9,j:1,k:2,l:3,m:4,n:5,o:6,p:7,q:8,r:9,s:1,t:2,u:3,v:4,w:5,x:6,y:7,z:8 };

export interface Sign { name: string; glyph: string; el: Element; m: number; d: number; trait: string; }
export const SIGNS: Sign[] = [
  { name: "Capricorn", glyph: "♑︎", el: "Pământ", m: 12, d: 22, trait: "Muncește și în concediu" },
  { name: "Vărsător", glyph: "♒︎", el: "Aer", m: 1, d: 20, trait: "Prea special pentru voi" },
  { name: "Pești", glyph: "♓︎", el: "Apă", m: 2, d: 19, trait: "Plânge la filme" },
  { name: "Berbec", glyph: "♈︎", el: "Foc", m: 3, d: 21, trait: "Intră în zid" },
  { name: "Taur", glyph: "♉︎", el: "Pământ", m: 4, d: 20, trait: "Nu se mișcă de pe canapea" },
  { name: "Gemeni", glyph: "♊︎", el: "Aer", m: 5, d: 21, trait: "Două fețe" },
  { name: "Rac", glyph: "♋︎", el: "Apă", m: 6, d: 21, trait: "Se supără și pleacă" },
  { name: "Leu", glyph: "♌︎", el: "Foc", m: 7, d: 23, trait: "Regele junglei" },
  { name: "Fecioară", glyph: "♍︎", el: "Pământ", m: 8, d: 23, trait: "Corectează pe toată lumea" },
  { name: "Balanță", glyph: "♎︎", el: "Aer", m: 9, d: 23, trait: "Nu se poate decide" },
  { name: "Scorpion", glyph: "♏︎", el: "Apă", m: 10, d: 23, trait: "Ține minte tot" },
  { name: "Săgetător", glyph: "♐︎", el: "Foc", m: 11, d: 22, trait: "Spune ce gândește" },
];

export const CLASSES: Record<number, string> = {
  1: "Șeful", 2: "Împăciuitorul", 3: "Vedeta", 4: "Catârul", 5: "Haoticul", 6: "Mămica",
  7: "Vraciul", 8: "Șmecherul", 9: "Bătrânul satului", 11: "Clarvăzătorul", 22: "Arhitectul destinului", 33: "Maestrul",
};

const EL_BIAS: Record<Element, Partial<Traits>> = {
  "Foc": { curajos: 12, amuzant: 6 },
  "Apă": { suflet: 12, incredere: 4 },
  "Aer": { istet: 10, amuzant: 8 },
  "Pământ": { incredere: 12, istet: 4 },
};
const DESTINY_BIAS: Record<number, Partial<Traits>> = {
  1: { curajos: 8 }, 2: { suflet: 8 }, 3: { amuzant: 9 }, 4: { incredere: 9 }, 5: { curajos: 5, amuzant: 5 },
  6: { suflet: 9 }, 7: { istet: 9 }, 8: { fermecator: 8 }, 9: { suflet: 5, istet: 5 },
  11: { istet: 8, fermecator: 6 }, 22: { incredere: 8, istet: 6 }, 33: { suflet: 8, fermecator: 6 },
};

export const SHAME_TITLES = [
  "Plânge la filme", "Ultimul la petrecere", "Regele scuzelor", "Mâncătorul de sarmale",
  "Deocheatul săptămânii", "Campion la mesaje vocale", "Pierzătorul de bilete", "Doarme la nunți",
];

const SIGN_LINE: Record<string, string> = {
  "Berbec": "Azi intri în zid cu entuziasm. Zidul cedează primul.",
  "Taur": "Canapeaua te cheamă, dar și victoria. Alege cu grijă.",
  "Gemeni": "Ai două păreri despre orice. Folosește-o pe cea bună.",
  "Rac": "O vorbă spusă aiurea te poate supăra. Nu lua decizii la nervi.",
  "Leu": "Lumea se uită la tine. Pare că îți place.",
  "Fecioară": "Vei corecta pe cineva azi. Încearcă să o faci cu zâmbetul.",
  "Balanță": "O alegere grea te așteaptă. Dă cu banul și pretinde că ai gândit.",
  "Scorpion": "Ții minte cine ți-a mâncat ultima felie. Răzbunarea e servită rece.",
  "Săgetător": "Spui ce gândești. Unii vor aplauda, alții vor tăcea brusc.",
  "Capricorn": "Muncești chiar și când te odihnești. Măcar câștigă ceva din asta.",
  "Vărsător": "Ești prea special pentru ziua de azi. Ziua de azi se va adapta.",
  "Pești": "Emoțiile sunt la suprafață. Ține șervețelele aproape.",
};
const DAY_BASE: Record<number, number> = { 1: 7, 2: 5, 3: 8, 4: 5, 5: 6, 6: 6, 7: 7, 8: 4, 9: 6 };

// ---------- utilitare ----------
export const stripName = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");
const digits = (n: number) => String(n).split("").reduce((a, c) => a + Number(c), 0);
export const reduceNum = (n: number, keepMaster = true) => {
  while (n > 9 && !(keepMaster && (n === 11 || n === 22 || n === 33))) n = digits(n);
  return n;
};
export const hashStr = (s: string) => {
  let h = 2166136261;
  for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
};
export const rngFrom = (seed: number) => () => {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const capName = (s: string) => {
  const t = s.trim().replace(/\s+/g, " ");
  return t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : t;
};

export interface RoDate { y: number; m: number; d: number; wd: number; }
export function roDate(at: Date): RoDate {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Bucharest", year: "numeric", month: "numeric", day: "numeric", weekday: "short",
  }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const wdMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { y: Number(get("year")), m: Number(get("month")), d: Number(get("day")), wd: wdMap[get("weekday")] ?? 0 };
}

export function signOf(m: number, d: number): Sign {
  let s = SIGNS[0];
  for (const z of SIGNS) if (m > z.m || (m === z.m && d >= z.d)) s = z;
  if ((m === 12 && d >= 22) || (m === 1 && d < 20)) s = SIGNS[0];
  return s;
}

export interface Moon { name: string; delta: number; }
export function moonAt(at: Date): Moon {
  const syn = 29.530588853;
  const a = (((at.getTime() / 864e5 - 10962.76) % syn) + syn) % syn; // referință: lună nouă, 6 ian 2000
  if (a < 1.85 || a > 27.68) return { name: "Lună nouă", delta: -1 };
  if (a < 5.54) return { name: "Crai nou", delta: 1 };
  if (a < 9.23) return { name: "Primul pătrar", delta: 0 };
  if (a < 12.92) return { name: "Lună crescătoare", delta: 1 };
  if (a < 16.61) return { name: "Lună plină", delta: 1 };
  if (a < 20.3) return { name: "Lună descrescătoare", delta: 0 };
  if (a < 24.0) return { name: "Ultimul pătrar", delta: -1 };
  return { name: "Lună bătrână", delta: 0 };
}

// ---------- profilul ----------
export interface Profile {
  name: string; birthdate: string; destiny: number; klass: string; sign: Sign; el: Element; legend: boolean;
  stars: Traits;   // prezicerea stelelor, 35–70
  score: Traits;   // scorul curent, 0–100
  won: Traits;     // voturi primite (ponderate)
  seen: Traits;    // voturi totale exprimate în întrebările acelei trăsături, la duelurile tale
  aura: number;    // total voturi primite
  forma: number; F: number; horoscope: string; moon: string;
}

export function traitScore(stars: number, won: number, seen: number) {
  return Math.max(0, Math.min(100, Math.round((100 * (won + PRIOR_WEIGHT * (stars / 100))) / (Math.max(seen, won) + PRIOR_WEIGHT))));
}

export function buildProfile(rawName: string, birthdate: string, at: Date = new Date(), won: Partial<Traits> = {}, seen: Partial<Traits> = {}): Profile {
  const name = capName(rawName) || "Anonim";
  const letters = stripName(name) || "anonim";
  const [, m, d] = birthdate.split("-").map(Number);
  let sum = 0;
  for (const ch of letters) sum += LET[ch] ?? 0;
  const destiny = reduceNum(sum);
  const base = destiny > 9 ? reduceNum(destiny, false) : destiny;
  const sign = signOf(m, d);
  const el = sign.el;
  const legend = destiny === 11 || destiny === 22 || destiny === 33 || (m === 2 && d === 29);
  const w = { ...zeroTraits(), ...won }, s = { ...zeroTraits(), ...seen };
  const stars = zeroTraits(), score = zeroTraits();
  for (const k of TRAIT_KEYS) {
    const spread = hashStr(`${letters}|${birthdate}|${k}`) % 11;
    stars[k] = Math.min(legend ? 70 : 65, 35 + spread + (EL_BIAS[el][k] ?? 0) + (DESTINY_BIAS[destiny]?.[k] ?? 0));
    score[k] = traitScore(stars[k], w[k], s[k]);
  }
  const aura = Math.round(TRAIT_KEYS.reduce((a, k) => a + w[k], 0));
  const today = roDate(at);
  const moon = moonAt(at);
  const pday = reduceNum(d + m + today.d + today.m + digits(today.y), false);
  const birthday = today.d === d && today.m === m;
  const forma = clamp(DAY_BASE[pday] + moon.delta + (birthday ? 10 : 0), 1, 10);
  return {
    name, birthdate, destiny, klass: CLASSES[destiny] ?? CLASSES[base], sign, el, legend,
    stars, score, won: w, seen: s, aura, forma, F: 0.95 + ((forma - 1) * 0.1) / 9,
    horoscope: SIGN_LINE[sign.name], moon: moon.name,
  };
}

// ---------- duelul ----------
// O întrebare pe trăsătură, în ordine amestecată, evitând întrebările deja jucate de aceiași doi.
export function drawQuestions(seed: number, exclude: Set<string> = new Set()): Question[] {
  const rnd = rngFrom(seed);
  const picks = TRAIT_KEYS.map((t) => {
    const all = QUESTIONS.filter((q) => q.trait === t);
    const fresh = all.filter((q) => !exclude.has(q.id));
    const pool = fresh.length ? fresh : all;
    return pool[Math.floor(rnd() * pool.length)];
  });
  for (let i = picks.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [picks[i], picks[j]] = [picks[j], picks[i]]; }
  return picks;
}

export interface RoundResult {
  id: string; q: string; trait: TraitKey; vA: number; vB: number; win: "A" | "B"; by: "votes" | "stars"; why: string;
}
export interface DuelResult {
  rounds: RoundResult[]; winner: "A" | "B"; score: string; decidedBy: "rounds" | "votes" | "stars";
  votesA: number; votesB: number; shame: string;
}

// Voturile sunt ponderate (cont nou = 0,5). O rundă se câștigă la voturi; la egalitate decide
// scorul trăsăturii, cu Forma zilei (±5%).
export function resolveDuel(opts: { A: Profile; B: Profile; questions: Question[]; votes: { A: number; B: number }[]; seed: number }): DuelResult {
  const { A, B, questions, votes, seed } = opts;
  const rnd = rngFrom(seed);
  const rounds: RoundResult[] = questions.map((qq, i) => {
    const vA = votes[i]?.A ?? 0, vB = votes[i]?.B ?? 0;
    let win: "A" | "B", by: "votes" | "stars";
    if (Math.abs(vA - vB) > 1e-9) { win = vA > vB ? "A" : "B"; by = "votes"; }
    else {
      const sA = A.score[qq.trait] * A.F, sB = B.score[qq.trait] * B.F;
      win = sA === sB ? (rnd() < 0.5 ? "A" : "B") : sA > sB ? "A" : "B"; by = "stars";
    }
    const r: RoundResult = { id: qq.id, q: qq.q, trait: qq.trait, vA, vB, win, by, why: "" };
    r.why = explain(r, A, B);
    return r;
  });
  const rA = rounds.filter((r) => r.win === "A").length, rB = rounds.length - rA;
  const votesA = votes.reduce((a, v) => a + v.A, 0), votesB = votes.reduce((a, v) => a + v.B, 0);
  let winner: "A" | "B", decidedBy: DuelResult["decidedBy"];
  if (rA !== rB) { winner = rA > rB ? "A" : "B"; decidedBy = "rounds"; }
  else if (Math.abs(votesA - votesB) > 1e-9) { winner = votesA > votesB ? "A" : "B"; decidedBy = "votes"; }
  else { winner = A.aura + A.forma >= B.aura + B.forma ? "A" : "B"; decidedBy = "stars"; }
  const score = winner === "A" ? `${rA}-${rB}` : `${rB}-${rA}`;
  return { rounds, winner, score, decidedBy, votesA, votesB, shame: SHAME_TITLES[Math.floor(rnd() * SHAME_TITLES.length)] };
}

const fmtV = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1).replace(".", ","));
function explain(r: RoundResult, A: Profile, B: Profile): string {
  const W = r.win === "A" ? A : B, L = r.win === "A" ? B : A;
  const wv = r.win === "A" ? r.vA : r.vB, lv = r.win === "A" ? r.vB : r.vA;
  const t = TRAIT_NAME[r.trait].toLowerCase();
  if (r.by === "stars") return wv + lv === 0
    ? `Nimeni n-a votat aici, așa că au decis stelele: ${W.name} pare mai ${t}.`
    : `Egalitate la voturi. Au decis stelele: ${W.name} pare mai ${t}.`;
  if (lv === 0) return wv >= 2 ? `Unanimitate pentru ${W.name}. ${L.name} cere renumărarea.` : `Un singur vot, pentru ${W.name}. A fost de ajuns.`;
  if (wv - lv >= 2) return `${W.name} a luat ${fmtV(wv)} voturi, ${L.name} ${fmtV(lv)}. Prietenii au fost clari.`;
  return `La limită, ${fmtV(wv)} la ${fmtV(lv)}. ${L.name} spune că a fost aranjat.`;
}

// ---------- progres ----------
export function gloryDelta(winnerGlory: number, loserGlory: number) {
  const exp = 1 / (1 + Math.pow(10, (loserGlory - winnerGlory) / 400));
  const gain = clamp(Math.round(32 * (1 - exp) + 6), 10, 30);
  const loss = clamp(Math.round(gain * 0.85), 10, 25);
  return { gain, loss };
}
export function applyXp(level: number, xp: number, add: number) {
  xp += add;
  while (level < 50 && xp >= level * 100) { xp -= level * 100; level++; }
  return { level, xp };
}
