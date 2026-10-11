// Duelul Numelor — motorul de calcul.
// Același fișier rulează pe server (Edge Function, autoritativ) și în aplicație (afișare).
// Fără dependențe externe.

export type StatKey = "farmec" | "noroc" | "haos" | "drama" | "smech" | "aura";
export type Element = "Foc" | "Apă" | "Aer" | "Pământ";
export type Stats = Record<StatKey, number>;

export const STATS: [StatKey, string][] = [
  ["farmec", "Farmec"], ["noroc", "Noroc"], ["haos", "Haos"],
  ["drama", "Dramă"], ["smech", "Șmecherie"], ["aura", "Aură"],
];
export const STAT_NAME: Record<StatKey, string> = Object.fromEntries(STATS) as Record<StatKey, string>;

const LET: Record<string, number> = { a:1,b:2,c:3,d:4,e:5,f:6,g:7,h:8,i:9,j:1,k:2,l:3,m:4,n:5,o:6,p:7,q:8,r:9,s:1,t:2,u:3,v:4,w:5,x:6,y:7,z:8 };
const VOW = new Set(["a", "e", "i", "o", "u", "y"]);

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
export const BEATS: Record<Element, Element> = { "Apă": "Foc", "Foc": "Aer", "Aer": "Pământ", "Pământ": "Apă" };
const BEAT_VERB: Record<Element, string> = { "Apă": "stinge", "Foc": "arde", "Aer": "spulberă", "Pământ": "absoarbe" };

export interface Klass { name: string; power: string; effect: string; }
export const CLASSES: Record<number, Klass> = {
  1: { name: "Șeful", power: "Eu știu mai bine", effect: "anulează un vot advers" },
  2: { name: "Împăciuitorul", power: "Hai să nu ne certăm", effect: "poate cere remiză o dată" },
  3: { name: "Vedeta", power: "Lumina reflectoarelor", effect: "voturile publicului contează mai mult" },
  4: { name: "Catârul", power: "Nu și gata", effect: "imun la deochi și haos" },
  5: { name: "Haoticul", power: "Vânt de schimbare", effect: "schimbă categoria unei runde" },
  6: { name: "Mămica", power: "Ai mâncat ceva?", effect: "primește dublu din cadouri" },
  7: { name: "Vraciul", power: "Am visat asta azi-noapte", effect: "vede voturile înainte de final" },
  8: { name: "Șmecherul", power: "Pe sub mână", effect: "fură un cadou de la adversar" },
  9: { name: "Bătrânul satului", power: "Am trăit destule", effect: "câștigă egalitățile" },
  11: { name: "Clarvăzătorul", power: "Știam de ieri", effect: "vede voturile și anulează unul" },
  22: { name: "Arhitectul destinului", power: "Totul face parte din plan", effect: "își alege categoria unei runde" },
  33: { name: "Maestrul", power: "Pace vouă", effect: "anulează puterea adversarului" },
};

export interface Category { q: string; stat: StatKey; }
export const CATEGORIES: Category[] = [
  { q: "Cine ar fi dat afară primul de la o nuntă?", stat: "haos" },
  { q: "Cine mănâncă tot din frigider și neagă?", stat: "smech" },
  { q: "Cine plânge la filme și zice că e alergia?", stat: "drama" },
  { q: "Cine câștigă la loz și pierde biletul?", stat: "noroc" },
  { q: "Cine ar convinge un polițist să-l lase fără amendă?", stat: "farmec" },
  { q: "Cine supraviețuiește o săptămână fără telefon?", stat: "aura" },
  { q: "Cine ajunge ultimul la propria petrecere?", stat: "haos" },
  { q: "Cine prinde cel mai bun loc în autobuz fără să ceară?", stat: "noroc" },
  { q: "Cine face scandal la reducerile de Black Friday?", stat: "drama" },
  { q: "Cine vinde castraveți grădinarului?", stat: "smech" },
  { q: "Cine e primul invitat la cumetrie?", stat: "farmec" },
  { q: "Cine nu se deoache nici dacă îl privește tot satul?", stat: "aura" },
  { q: "Cine trimite mesaje vocale de 4 minute?", stat: "drama" },
  { q: "Cine găsește parcare în centru vineri seara?", stat: "noroc" },
  { q: "Cine dă vina pe Mercur retrograd pentru orice?", stat: "haos" },
  { q: "Cine primește porția mai mare de la bunica?", stat: "farmec" },
  { q: "Cine iese basma curată din orice ceartă de familie?", stat: "smech" },
  { q: "Cine doarme liniștit în noaptea de Sf. Andrei?", stat: "aura" },
  { q: "Cine se ceartă cu GPS-ul și pierde?", stat: "haos" },
  { q: "Cine ar câștiga un concurs de manele fără să știe versurile?", stat: "farmec" },
  { q: "Cine ar plânge primul la o nuntă străină?", stat: "drama" },
  { q: "Cine găsește 50 de lei în geaca de anul trecut?", stat: "noroc" },
  { q: "Cine negociază la piață până primește și pătrunjel gratis?", stat: "smech" },
  { q: "Cine trece neatins pe lângă o pisică neagră?", stat: "aura" },
  { q: "Cine pleacă la mare cu geaca de iarnă?", stat: "haos" },
  { q: "Cine primește like de la fosta în 3 minute?", stat: "farmec" },
  { q: "Cine face o poveste de 20 de minute dintr-o coadă la poștă?", stat: "drama" },
  { q: "Cine nimerește singurul taxi liber pe ploaie?", stat: "noroc" },
  { q: "Cine fură ultima sarma și dă vina pe câine?", stat: "smech" },
  { q: "Cine rămâne calm când se ia curentul la meci?", stat: "aura" },
];

export const SHAME_TITLES = [
  "Plânge la filme", "Fricosul de serviciu", "Mâncătorul de sarmale", "Regele scuzelor",
  "Deocheatul săptămânii", "Campion la mesaje vocale", "Ultimul la petrecere", "Pierzătorul de bilete",
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
const DAY_LINE: Record<number, string> = {
  1: "Ziua personală 1: început. Provoacă pe cineva primul.",
  2: "Ziua personală 2: împăcare. Nu e zi de orgolii.",
  3: "Ziua personală 3: scenă. Publicul e de partea ta.",
  4: "Ziua personală 4: muncă. Rezultatele vin încet, dar vin.",
  5: "Ziua personală 5: haos. Orice se poate întâmpla și probabil se va întâmpla.",
  6: "Ziua personală 6: familie. Cineva îți va spune să mănânci ceva.",
  7: "Ziua personală 7: intuiție. Ai visat ceva important. Sau doar sarmale.",
  8: "Ziua personală 8: bani. Nu împrumuta nimic nimănui.",
  9: "Ziua personală 9: încheiere. Închide o socoteală veche.",
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

// Data calendaristică din România (jocul trăiește pe ora României).
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

export interface Moon { name: string; delta: number; line: string; full: boolean; }
export function moonAt(at: Date): Moon {
  const syn = 29.530588853;
  const days = at.getTime() / 864e5 - 10962.76; // lună nouă de referință: 6 ian 2000, 18:14 UTC
  const a = ((days % syn) + syn) % syn;
  if (a < 1.85 || a > 27.68) return { name: "Lună nouă", delta: -1, line: "Lună nouă: energie la minim, −1 la formă.", full: false };
  if (a < 5.54) return { name: "Crai nou", delta: 1, line: "Crai nou: ce începi azi crește, +1 la formă.", full: false };
  if (a < 9.23) return { name: "Primul pătrar", delta: 0, line: "Primul pătrar: zi echilibrată.", full: false };
  if (a < 12.92) return { name: "Lună crescătoare", delta: 1, line: "Lună crescătoare: +1 la formă.", full: false };
  if (a < 16.61) return { name: "Lună plină", delta: 0, line: "Lună plină: Haosul se dublează în toate duelurile.", full: true };
  if (a < 20.3) return { name: "Lună descrescătoare", delta: 0, line: "Lună descrescătoare: bun moment de închis socoteli.", full: false };
  if (a < 24.0) return { name: "Ultimul pătrar", delta: -1, line: "Ultimul pătrar: oboseală cosmică, −1 la formă.", full: false };
  return { name: "Lună bătrână", delta: 0, line: "Lună bătrână: ziua potrivită pentru odihnă.", full: false };
}

// ---------- cardul ----------
export interface Card {
  name: string; birthdate: string;
  destiny: number; klass: Klass; sign: Sign; el: Element; legend: boolean;
  stats: Stats; forma: number; F: number; pday: number;
  horoscope: string; reasons: string[]; moon: Moon;
}

export function buildCard(rawName: string, birthdate: string, at: Date = new Date()): Card {
  const name = capName(rawName) || "Anonim";
  const letters = stripName(name) || "anonim";
  const [, m, d] = birthdate.split("-").map(Number);
  let sum = 0, vow = 0, con = 0;
  for (const ch of letters) { const v = LET[ch] ?? 0; sum += v; if (VOW.has(ch)) vow += v; else con += v; }
  const destiny = reduceNum(sum);
  const base = destiny > 9 ? reduceNum(destiny, false) : destiny;
  const sign = signOf(m, d);
  const el = sign.el;
  const legend = destiny === 11 || destiny === 22 || destiny === 33 || (m === 2 && d === 29);
  const elHaos: Record<Element, number> = { "Foc": 34, "Aer": 30, "Apă": 25, "Pământ": 21 };
  const stats: Stats = {
    farmec: 20 + (sum * 7) % 26,
    noroc: 20 + (d * 11 + m * 3) % 26,
    haos: elHaos[el] + (sum % 10),
    drama: 20 + (vow * 5 + 3) % 26,
    smech: 20 + (con * 3 + 1) % 26,
    aura: 20 + (m * 7 + destiny * 5) % 26 + (legend ? 5 : 0),
  };
  const today = roDate(at);
  const moon = moonAt(at);
  const pday = reduceNum(d + m + today.d + today.m + digits(today.y), false);
  const birthday = today.d === d && today.m === m;
  const forma = clamp(DAY_BASE[pday] + moon.delta + (birthday ? 10 : 0), 1, 10);
  const reasons = [DAY_LINE[pday], moon.line];
  if (today.wd === 2) reasons.push("Marți: trei ceasuri rele ascunse în zi. Ai grijă la Noroc.");
  if (birthday) reasons.push("La mulți ani! Revoluția solară îți dă forma maximă.");
  const F = 0.8 + ((forma - 1) * 0.4) / 9;
  return {
    name, birthdate, destiny, klass: CLASSES[destiny] ?? CLASSES[base], sign, el, legend,
    stats, forma, F, pday, horoscope: SIGN_LINE[sign.name], reasons, moon,
  };
}

// ---------- duelul ----------
export function drawCategories(seed: number): Category[] {
  const rnd = rngFrom(seed);
  const pool = CATEGORIES.map((c) => ({ c, k: rnd() })).sort((a, b) => a.k - b.k).map((x) => x.c);
  const out: Category[] = [];
  for (const c of pool) {
    if (out.length === 3) break;
    if (out.some((o) => o.stat === c.stat)) continue; // trei statistici diferite
    out.push(c);
  }
  return out;
}

export interface RoundResult {
  q: string; stat: StatKey;
  cardA: number; cardB: number; vA: number; vB: number; voteA: number; voteB: number;
  dice: number; totA: number; totB: number; win: "A" | "B"; powA: boolean; powB: boolean; why: string;
}
export interface DuelResult {
  rounds: RoundResult[]; winner: "A" | "B"; score: string; shame: string; formaA: number; formaB: number;
}

export function resolveDuel(opts: {
  A: Card; B: Card; categories: Category[]; powA: number; powB: number;
  votes: { A: number; B: number }[]; seed: number; at: Date;
}): DuelResult {
  const { A, B, categories, powA, powB, votes, seed } = opts;
  const rnd = rngFrom(seed);
  const moon = moonAt(opts.at);
  const tuesday = roDate(opts.at).wd === 2;
  const rounds = categories.map((cat, i) => {
    const side = (P: Card, O: Card, power: boolean) => {
      let S = P.stats[cat.stat];
      if (cat.stat === "haos" && moon.full) S *= 2;
      const E = BEATS[P.el] === O.el ? 1.1 : BEATS[O.el] === P.el ? 0.9 : 1;
      return S * P.F * E * (1 + (power ? 0.15 : 0));
    };
    const pA = side(A, B, powA === i), pB = side(B, A, powB === i);
    const share = clamp(pA / (pA + pB), 0.38, 0.62);
    const cardA = 50 * share, cardB = 50 - cardA;
    const vA = votes[i]?.A ?? 0, vB = votes[i]?.B ?? 0;
    let voteA = vA + vB === 0 ? 25 : (vA * 50) / (vA + vB);
    if (A.destiny === 3 && powA === i) voteA = clamp(voteA * 1.3, 0, 50);
    if (B.destiny === 3 && powB === i) voteA = 50 - clamp((50 - voteA) * 1.3, 0, 50);
    const voteB = 50 - voteA;
    let dice = clamp(rnd() * 10 - 5 + (A.stats.noroc - B.stats.noroc) / 20, -5, 5);
    if (tuesday && rnd() < 0.25) dice = clamp(dice * 1.5, -5, 5);
    const totA = cardA + voteA + dice, totB = cardB + voteB;
    const win: "A" | "B" = totA > totB ? "A" : totB > totA ? "B" : A.stats.drama >= B.stats.drama ? "A" : "B";
    const r: RoundResult = { q: cat.q, stat: cat.stat, cardA, cardB, vA, vB, voteA, voteB, dice, totA, totB, win, powA: powA === i, powB: powB === i, why: "" };
    r.why = explain(r, A, B, moon.full);
    return r;
  });
  const wA = rounds.filter((r) => r.win === "A").length;
  const winner: "A" | "B" = wA >= 2 ? "A" : "B";
  const score = winner === "A" ? `${wA}-${3 - wA}` : `${3 - wA}-${wA}`;
  return { rounds, winner, score, shame: SHAME_TITLES[Math.floor(rnd() * SHAME_TITLES.length)], formaA: A.forma, formaB: B.forma };
}

function explain(r: RoundResult, A: Card, B: Card, fullMoon: boolean): string {
  const W = r.win === "A" ? A : B, L = r.win === "A" ? B : A;
  const wv = r.win === "A" ? r.vA : r.vB, lv = r.win === "A" ? r.vB : r.vA;
  const wc = r.win === "A" ? r.cardA : r.cardB;
  const dw = r.win === "A" ? r.dice : -r.dice;
  if (BEATS[W.el] === L.el && wc > 27) return `${W.name} a câștigat pentru că ${W.el} ${BEAT_VERB[W.el]} ${L.el}. Așa e scris în stele.`;
  if (r.stat === "haos" && fullMoon) return `Lună plină, haos dublu. ${W.name} s-a simțit ca acasă, ${L.name} mai puțin.`;
  if (wv - lv >= 3) return `${L.name} a pierdut la vot ${lv} la ${wv}. Prietenii au vorbit. Și au vorbit urât.`;
  if (lv > wv) return `Publicul a ținut cu ${L.name}, dar cardul lui ${W.name} a fost mai tare. Nu e vina publicului. E puțin vina publicului.`;
  if (dw > 1.5) return `Zarul norocului a ținut cu ${W.name}. ${L.name} spune că a fost aranjat.`;
  if (L.forma <= 4) return `${L.name} a pierdut pentru că azi are forma ${L.forma}/10. Nu e vina lui. E puțin vina lui.`;
  if (wv + lv === 0) return `Nimeni n-a votat, așa că au hotărât stelele: ${W.name} ia runda.`;
  return `${W.name} a luat runda la ${STAT_NAME[r.stat]}. ${L.name} cere reluarea imaginilor.`;
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
