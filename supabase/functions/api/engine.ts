// Duelul Numelor — motorul de calcul.
// Același fișier rulează pe server (Edge Function, autoritativ) și în aplicație (afișare).
// Cardul are 6 trăsături sociale: stelele dau valoarea de pornire, voturile prietenilor o urcă (nu scade niciodată).

export type TraitKey = "amuzant" | "incredere" | "istet" | "fermecator" | "curajos" | "suflet";
export type Element = "Foc" | "Apă" | "Aer" | "Pământ";
export type Traits = Record<TraitKey, number>;

export const TRAITS: [TraitKey, string][] = [
  ["amuzant", "Amuzant"], ["incredere", "De încredere"], ["istet", "Isteț"],
  ["fermecator", "Fermecător"], ["curajos", "Curajos"], ["suflet", "Bun la suflet"],
];
export const TRAIT_NAME: Record<TraitKey, string> = Object.fromEntries(TRAITS) as Record<TraitKey, string>;
export const TRAIT_KEYS = TRAITS.map(([k]) => k);
export const emptyPoints = (): Traits => ({ amuzant: 0, incredere: 0, istet: 0, fermecator: 0, curajos: 0, suflet: 0 });

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

export interface Klass { name: string; power: string; effect: string; }
const POWER_EFFECT = "voturile primite în runda aleasă valorează cu 15% mai mult";
export const CLASSES: Record<number, Klass> = {
  1: { name: "Șeful", power: "Eu știu mai bine", effect: POWER_EFFECT },
  2: { name: "Împăciuitorul", power: "Hai să nu ne certăm", effect: POWER_EFFECT },
  3: { name: "Vedeta", power: "Lumina reflectoarelor", effect: POWER_EFFECT },
  4: { name: "Catârul", power: "Nu și gata", effect: POWER_EFFECT },
  5: { name: "Haoticul", power: "Vânt de schimbare", effect: POWER_EFFECT },
  6: { name: "Mămica", power: "Ai mâncat ceva?", effect: POWER_EFFECT },
  7: { name: "Vraciul", power: "Am visat asta azi-noapte", effect: POWER_EFFECT },
  8: { name: "Șmecherul", power: "Pe sub mână", effect: POWER_EFFECT },
  9: { name: "Bătrânul satului", power: "Am trăit destule", effect: POWER_EFFECT },
  11: { name: "Clarvăzătorul", power: "Știam de ieri", effect: POWER_EFFECT },
  22: { name: "Arhitectul destinului", power: "Totul face parte din plan", effect: POWER_EFFECT },
  33: { name: "Maestrul", power: "Pace vouă", effect: POWER_EFFECT },
};

// Ce „prezic” stelele pentru fiecare trăsătură.
const EL_BIAS: Record<Element, Partial<Traits>> = {
  "Foc": { curajos: 15, amuzant: 8 },
  "Apă": { suflet: 15, incredere: 5 },
  "Aer": { istet: 12, amuzant: 10 },
  "Pământ": { incredere: 15, istet: 5 },
};
const DESTINY_BIAS: Record<number, Partial<Traits>> = {
  1: { curajos: 10 }, 2: { suflet: 10 }, 3: { amuzant: 12 }, 4: { incredere: 12 }, 5: { curajos: 6, amuzant: 6 },
  6: { suflet: 12 }, 7: { istet: 12 }, 8: { fermecator: 10 }, 9: { suflet: 6, istet: 6 },
  11: { istet: 10, fermecator: 8 }, 22: { incredere: 10, istet: 8 }, 33: { suflet: 10, fermecator: 8 },
};

export interface Category { q: string; trait: TraitKey; }
export const CATEGORIES: Category[] = [
  { q: "Cine te face să râzi chiar și când n-ar trebui?", trait: "amuzant" },
  { q: "Cine ține petrecerea în viață până dimineață?", trait: "amuzant" },
  { q: "Cine are cele mai bune povești de la nunți?", trait: "amuzant" },
  { q: "Cine trimite cele mai bune meme-uri pe grup?", trait: "amuzant" },
  { q: "Cine imită cel mai bine un profesor?", trait: "amuzant" },
  { q: "Cine transformă o coadă la poștă într-o poveste de 20 de minute?", trait: "amuzant" },
  { q: "Pe cine suni la 3 noaptea când ai o problemă?", trait: "incredere" },
  { q: "Cui îi lași cheile de la casă când pleci în concediu?", trait: "incredere" },
  { q: "Cine păstrează un secret până la capăt?", trait: "incredere" },
  { q: "Cine vine primul când ai nevoie de ajutor la mutat?", trait: "incredere" },
  { q: "Cine îți dă banii înapoi fără să-i ceri?", trait: "incredere" },
  { q: "Cine ajunge la timp, chiar și la ora 6 dimineața?", trait: "incredere" },
  { q: "Cine ar câștiga la „Vrei să fii milionar?”", trait: "istet" },
  { q: "Cine repară orice cu un tutorial de pe YouTube?", trait: "istet" },
  { q: "Cine găsește cea mai bună ofertă la orice?", trait: "istet" },
  { q: "Cine iese basma curată din orice încurcătură?", trait: "istet" },
  { q: "Cine dă cele mai bune sfaturi?", trait: "istet" },
  { q: "Cine se descurcă singur într-o țară străină fără să știe limba?", trait: "istet" },
  { q: "Cine primește porția mai mare de la bunica?", trait: "fermecator" },
  { q: "Cine scapă fără amendă după ce vorbește cu polițistul?", trait: "fermecator" },
  { q: "Cine își face prieteni noi în 5 minute, oriunde?", trait: "fermecator" },
  { q: "Cine primește reducere la piață doar zâmbind?", trait: "fermecator" },
  { q: "Pe cine ar plăcea imediat părinții tăi?", trait: "fermecator" },
  { q: "Cine arată bine și în pozele făcute pe ascuns?", trait: "fermecator" },
  { q: "Cine sare primul cu parașuta?", trait: "curajos" },
  { q: "Cine îi spune șefului adevărul în față?", trait: "curajos" },
  { q: "Cine gustă primul mâncarea necunoscută din vacanță?", trait: "curajos" },
  { q: "Cine iese primul pe ringul de dans?", trait: "curajos" },
  { q: "Cine prinde păianjenul din cameră?", trait: "curajos" },
  { q: "Cine și-ar lăsa jobul ca să-și urmeze visul?", trait: "curajos" },
  { q: "Cine împarte și ultima sarma?", trait: "suflet" },
  { q: "Cine ține minte ziua de naștere a tuturor?", trait: "suflet" },
  { q: "Cine adoptă orice câine găsit pe stradă?", trait: "suflet" },
  { q: "Cine te ascultă fără să se uite la telefon?", trait: "suflet" },
  { q: "Cine o sună cel mai des pe bunica?", trait: "suflet" },
  { q: "Cine te vizitează când ești bolnav, cu supă?", trait: "suflet" },
];

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

export interface Moon { name: string; delta: number; line: string; }
export function moonAt(at: Date): Moon {
  const syn = 29.530588853;
  const days = at.getTime() / 864e5 - 10962.76; // lună nouă de referință: 6 ian 2000, 18:14 UTC
  const a = ((days % syn) + syn) % syn;
  if (a < 1.85 || a > 27.68) return { name: "Lună nouă", delta: -1, line: "Lună nouă: energie la minim, −1 la formă." };
  if (a < 5.54) return { name: "Crai nou", delta: 1, line: "Crai nou: ce începi azi crește, +1 la formă." };
  if (a < 9.23) return { name: "Primul pătrar", delta: 0, line: "Primul pătrar: zi echilibrată." };
  if (a < 12.92) return { name: "Lună crescătoare", delta: 1, line: "Lună crescătoare: +1 la formă." };
  if (a < 16.61) return { name: "Lună plină", delta: 1, line: "Lună plină: toată lumea e mai expresivă, +1 la formă." };
  if (a < 20.3) return { name: "Lună descrescătoare", delta: 0, line: "Lună descrescătoare: bun moment de închis socoteli." };
  if (a < 24.0) return { name: "Ultimul pătrar", delta: -1, line: "Ultimul pătrar: oboseală cosmică, −1 la formă." };
  return { name: "Lună bătrână", delta: 0, line: "Lună bătrână: ziua potrivită pentru odihnă." };
}

// Valoarea afișată: pornește de la stele și urcă spre 100 cu fiecare vot primit. Nu scade niciodată.
export const traitValue = (base: number, points: number) =>
  Math.round(base + (100 - base) * (1 - Math.exp(-Math.max(0, points) / 60)));
export type Medal = "bronz" | "argint" | "aur" | null;
export const medalFor = (points: number): Medal => (points >= 150 ? "aur" : points >= 50 ? "argint" : points >= 10 ? "bronz" : null);

// ---------- cardul ----------
export interface Card {
  name: string; birthdate: string;
  destiny: number; klass: Klass; sign: Sign; el: Element; legend: boolean;
  stars: Traits;   // ce prezic stelele (pornirea)
  traits: Traits;  // valoarea curentă = stele + prieteni
  points: Traits;  // voturi primite pe fiecare trăsătură
  aura: number;    // Aura socială = toate voturile primite
  forma: number; F: number; pday: number;
  horoscope: string; reasons: string[]; moon: Moon;
}

export function buildCard(rawName: string, birthdate: string, at: Date = new Date(), points: Partial<Traits> = {}): Card {
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

  const stars = emptyPoints();
  const pts = { ...emptyPoints(), ...points };
  const traits = emptyPoints();
  for (const k of TRAIT_KEYS) {
    const spread = hashStr(`${letters}|${birthdate}|${k}`) % 11;
    stars[k] = Math.min(legend ? 60 : 55, 20 + spread + (EL_BIAS[el][k] ?? 0) + (DESTINY_BIAS[destiny]?.[k] ?? 0));
    traits[k] = traitValue(stars[k], pts[k]);
  }
  const aura = TRAIT_KEYS.reduce((a, k) => a + pts[k], 0);

  const today = roDate(at);
  const moon = moonAt(at);
  const pday = reduceNum(d + m + today.d + today.m + digits(today.y), false);
  const birthday = today.d === d && today.m === m;
  const forma = clamp(DAY_BASE[pday] + moon.delta + (birthday ? 10 : 0), 1, 10);
  const reasons = [DAY_LINE[pday], moon.line];
  if (today.wd === 2) reasons.push("Marți: trei ceasuri rele ascunse în zi. Nu provoca pe nimeni la nervi.");
  if (birthday) reasons.push("La mulți ani! Revoluția solară îți dă forma maximă.");
  const F = 0.95 + ((forma - 1) * 0.1) / 9; // Forma zilei: ±5%
  return {
    name, birthdate, destiny, klass: CLASSES[destiny] ?? CLASSES[base], sign, el, legend,
    stars, traits, points: pts, aura, forma, F, pday, horoscope: SIGN_LINE[sign.name], reasons, moon,
  };
}

// ---------- duelul ----------
export function drawCategories(seed: number): Category[] {
  const rnd = rngFrom(seed);
  const pool = CATEGORIES.map((c) => ({ c, k: rnd() })).sort((a, b) => a.k - b.k).map((x) => x.c);
  const out: Category[] = [];
  for (const c of pool) {
    if (out.length === 3) break;
    if (out.some((o) => o.trait === c.trait)) continue; // trei trăsături diferite
    out.push(c);
  }
  return out;
}

export interface RoundResult {
  q: string; trait: TraitKey;
  vA: number; vB: number; voteA: number; voteB: number; cardA: number; cardB: number;
  dice: number; totA: number; totB: number; win: "A" | "B"; powA: boolean; powB: boolean; why: string;
}
export interface DuelResult {
  rounds: RoundResult[]; winner: "A" | "B"; score: string; shame: string; formaA: number; formaB: number;
}

// Scorul unei runde (din 100): 85 din voturi, 15 din trăsătura cardului (cu Forma zilei), plus un zar mic de ±2.
export function resolveDuel(opts: {
  A: Card; B: Card; categories: Category[]; powA: number; powB: number;
  votes: { A: number; B: number }[]; seed: number;
}): DuelResult {
  const { A, B, categories, powA, powB, votes, seed } = opts;
  const rnd = rngFrom(seed);
  const rounds = categories.map((cat, i) => {
    const vA = votes[i]?.A ?? 0, vB = votes[i]?.B ?? 0;
    const wA = vA * (powA === i ? 1.15 : 1), wB = vB * (powB === i ? 1.15 : 1);
    const voteA = wA + wB === 0 ? 42.5 : (85 * wA) / (wA + wB), voteB = 85 - voteA;
    const tA = A.traits[cat.trait] * A.F, tB = B.traits[cat.trait] * B.F;
    const cardA = (15 * tA) / (tA + tB), cardB = 15 - cardA;
    const dice = rnd() * 4 - 2;
    const totA = voteA + cardA + dice, totB = voteB + cardB;
    const win: "A" | "B" = totA > totB ? "A" : totB > totA ? "B" : A.aura >= B.aura ? "A" : "B";
    const r: RoundResult = {
      q: cat.q, trait: cat.trait, vA, vB, voteA, voteB, cardA, cardB, dice, totA, totB, win,
      powA: powA === i, powB: powB === i, why: "",
    };
    r.why = explain(r, A, B);
    return r;
  });
  const wonA = rounds.filter((r) => r.win === "A").length;
  const winner: "A" | "B" = wonA >= 2 ? "A" : "B";
  const score = winner === "A" ? `${wonA}-${3 - wonA}` : `${3 - wonA}-${wonA}`;
  return { rounds, winner, score, shame: SHAME_TITLES[Math.floor(rnd() * SHAME_TITLES.length)], formaA: A.forma, formaB: B.forma };
}

function explain(r: RoundResult, A: Card, B: Card): string {
  const W = r.win === "A" ? A : B, L = r.win === "A" ? B : A;
  const wv = r.win === "A" ? r.vA : r.vB, lv = r.win === "A" ? r.vB : r.vA;
  const t = TRAIT_NAME[r.trait];
  if (wv + lv === 0) return `Nimeni n-a votat, așa că au hotărât stelele: ${W.name} pare mai ${t.toLowerCase()} azi.`;
  if (lv === 0) return `Unanimitate: ${wv} din ${wv} pentru ${W.name}. ${L.name} cere renumărarea.`;
  if (wv - lv >= 2) return `${W.name} a luat ${wv} voturi, ${L.name} doar ${lv}. Prietenii au vorbit.`;
  if (wv === lv) return `Egalitate la voturi. A decis cardul: ${W.name} are mai mult la ${t}.`;
  if (wv < lv) return `${L.name} a avut mai multe voturi, dar cardul și puterea lui ${W.name} au întors runda.`;
  return `La limită, ${wv} la ${lv}. ${L.name} spune că a fost aranjat.`;
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
