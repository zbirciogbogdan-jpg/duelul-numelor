// Duelul Numelor — API-ul jocului (o singură Edge Function).
// Autentificare proprie: fiecare jucător are un token secret păstrat în telefon; în baza de date stă doar hash-ul lui.
// Toate calculele de duel se fac aici, pe server.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  buildCard, drawCategories, resolveDuel, gloryDelta, applyXp, hashStr, capName, stripName, medalFor, TRAIT_KEYS,
  type Card, type Category, type Traits,
} from "./engine.ts";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const DUEL_HOURS = 24;
const VOTER_LIMIT = 15; // duelul se închide singur când au votat atâția oameni toate rundele

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
class Fail extends Error { constructor(public msg: string, public code = 400) { super(msg); } }

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function randomHex(bytes = 32) {
  const a = new Uint8Array(bytes); crypto.getRandomValues(a);
  return Array.from(a).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function randomCode() {
  const abc = "abcdefghjkmnpqrstuvwxyz23456789";
  const a = new Uint8Array(7); crypto.getRandomValues(a);
  return Array.from(a).map((b) => abc[b % abc.length]).join("");
}

type Player = {
  id: string; name: string; birthdate: string; level: number; xp: number; glory: number;
  wins: number; losses: number; shame_title: string | null; shame_until: string | null;
  points: Traits; aura: number;
};
type Duel = {
  id: string; code: string; challenger_id: string; opponent_id: string | null; categories: Category[];
  challenger_power_round: number | null; opponent_power_round: number | null; status: "pending" | "open" | "done";
  created_at: string; accepted_at: string | null; deadline: string | null; result: unknown; winner_id: string | null;
  rematch_of: string | null;
};
const PLAYER_COLS = "id,name,birthdate,level,xp,glory,wins,losses,shame_title,shame_until,points,aura";

async function playerByToken(token: unknown, required = true): Promise<Player | null> {
  if (typeof token !== "string" || token.length < 32) {
    if (required) throw new Fail("Nu ești înscris încă.", 401);
    return null;
  }
  const { data, error } = await db.from("players").select(PLAYER_COLS).eq("token_hash", await sha256(token)).maybeSingle();
  if (error) throw error;
  if (!data && required) throw new Fail("Contul nu a fost găsit pe acest telefon.", 401);
  return data as Player | null;
}
async function playersById(ids: string[]) {
  const { data, error } = await db.from("players").select(PLAYER_COLS).in("id", ids);
  if (error) throw error;
  return new Map((data as Player[]).map((p) => [p.id, p]));
}
async function duelByCode(code: unknown): Promise<Duel> {
  if (typeof code !== "string" || !/^[a-z0-9]{5,10}$/.test(code)) throw new Fail("Link de duel invalid.", 404);
  const { data, error } = await db.from("duels").select("*").eq("code", code).maybeSingle();
  if (error) throw error;
  if (!data) throw new Fail("Duelul nu există.", 404);
  return data as Duel;
}

function publicPlayer(p: Player, at: Date) {
  const card = buildCard(p.name, p.birthdate, at, p.points);
  const shamed = p.shame_until && new Date(p.shame_until) > new Date() ? p.shame_title : null;
  return {
    id: p.id, name: p.name, level: p.level, xp: p.xp, glory: p.glory, wins: p.wins, losses: p.losses,
    shame: shamed, card: cardView(card),
  };
}
function cardView(c: Card) {
  return {
    name: c.name, destiny: c.destiny, klass: c.klass, sign: { name: c.sign.name, glyph: c.sign.glyph, trait: c.sign.trait },
    el: c.el, legend: c.legend, stars: c.stars, traits: c.traits, points: c.points, aura: c.aura,
    medals: Object.fromEntries(TRAIT_KEYS.map((k) => [k, medalFor(c.points[k])])),
    forma: c.forma, horoscope: c.horoscope, reasons: c.reasons, moon: c.moon.name,
  };
}

async function voteCounts(duelId: string) {
  const { data, error } = await db.from("votes").select("round,pick,voter_hash").eq("duel_id", duelId);
  if (error) throw error;
  const counts = [0, 1, 2].map(() => ({ A: 0, B: 0 }));
  const voters = new Set<string>();
  for (const v of data as { round: number; pick: "A" | "B"; voter_hash: string }[]) {
    counts[v.round][v.pick]++;
    voters.add(v.voter_hash);
  }
  return { counts, voters: voters.size, rows: data as { round: number; pick: "A" | "B"; voter_hash: string }[] };
}

// Închide duelul și împarte recompensele. Doar o singură cerere reușește să-l marcheze „done”.
async function resolve(duel: Duel): Promise<Duel> {
  if (duel.status !== "open" || !duel.opponent_id || !duel.accepted_at) return duel;
  const ps = await playersById([duel.challenger_id, duel.opponent_id]);
  const pa = ps.get(duel.challenger_id)!, pb = ps.get(duel.opponent_id)!;
  const at = new Date(duel.accepted_at);
  const A = buildCard(pa.name, pa.birthdate, at, pa.points), B = buildCard(pb.name, pb.birthdate, at, pb.points);
  const { counts } = await voteCounts(duel.id);
  const res = resolveDuel({
    A, B, categories: duel.categories,
    powA: -1, powB: -1, // puterile sunt scoase din joc deocamdată
    votes: counts, seed: hashStr(duel.id),
  });
  // Voturile primite devin puncte pe trăsătura întrebării. Punctele și Aura doar cresc.
  const ptsA: Traits = { ...A.points }, ptsB: Traits = { ...B.points };
  let gotA = 0, gotB = 0;
  duel.categories.forEach((c, i) => {
    if (!c.trait) return;
    ptsA[c.trait] += counts[i].A; ptsB[c.trait] += counts[i].B;
    gotA += counts[i].A; gotB += counts[i].B;
  });
  const award = new Map([[pa.id, { points: ptsA, aura: pa.aura + gotA }], [pb.id, { points: ptsB, aura: pb.aura + gotB }]]);
  const winner = res.winner === "A" ? pa : pb, loser = res.winner === "A" ? pb : pa;
  const { gain, loss } = gloryDelta(winner.glory, loser.glory);
  const isRematchWin = !!duel.rematch_of;
  const wx = applyXp(winner.level, winner.xp, isRematchWin ? 80 : 60);
  const lx = applyXp(loser.level, loser.xp, 25);
  const result = { ...res, gloryGain: gain, gloryLoss: loss, xpWin: isRematchWin ? 80 : 60, xpLoss: 25, votesA: 0, votesB: 0 };
  result.votesA = counts.reduce((a, c) => a + c.A, 0); result.votesB = counts.reduce((a, c) => a + c.B, 0);

  const { data: claimed, error } = await db.from("duels")
    .update({ status: "done", result, winner_id: winner.id })
    .eq("id", duel.id).eq("status", "open").select("*").maybeSingle();
  if (error) throw error;
  if (!claimed) { // altă cerere l-a închis între timp
    const { data } = await db.from("duels").select("*").eq("id", duel.id).single();
    return data as Duel;
  }
  const until = new Date(Date.now() + 7 * 864e5).toISOString();
  await db.from("players").update({ wins: winner.wins + 1, glory: winner.glory + gain, level: wx.level, xp: wx.xp, ...award.get(winner.id) }).eq("id", winner.id);
  await db.from("players").update({
    losses: loser.losses + 1, glory: Math.max(0, loser.glory - loss), level: lx.level, xp: lx.xp,
    shame_title: res.shame, shame_until: until, ...award.get(loser.id),
  }).eq("id", loser.id);
  return claimed as Duel;
}

async function maybeResolve(duel: Duel): Promise<Duel> {
  if (duel.status !== "open") return duel;
  if (duel.deadline && new Date(duel.deadline) <= new Date()) return resolve(duel);
  const { voters } = await voteCounts(duel.id);
  if (voters >= VOTER_LIMIT) return resolve(duel);
  return duel;
}

async function duelView(duel: Duel, me: Player | null, voterKey: unknown) {
  duel = await maybeResolve(duel);
  const ids = [duel.challenger_id, ...(duel.opponent_id ? [duel.opponent_id] : [])];
  const ps = await playersById(ids);
  const at = duel.accepted_at ? new Date(duel.accepted_at) : new Date();
  const A = ps.get(duel.challenger_id)!;
  const B = duel.opponent_id ? ps.get(duel.opponent_id)! : null;
  const role = me ? (me.id === A.id ? "A" : B && me.id === B.id ? "B" : null) : null;
  const vc = await voteCounts(duel.id);
  let myVotes: (string | null)[] = [null, null, null];
  if (typeof voterKey === "string" && voterKey.length >= 16) {
    const vh = await sha256(voterKey);
    for (const v of vc.rows) if (v.voter_hash === vh) myVotes[v.round] = v.pick;
  }
  if (role) myVotes = [null, null, null];
  return {
    code: duel.code, status: duel.status, createdAt: duel.created_at, acceptedAt: duel.accepted_at, deadline: duel.deadline,
    categories: duel.categories,
    A: publicPlayer(A, at), B: B ? publicPlayer(B, at) : null,
    invitedOnly: duel.status === "pending" && !!duel.opponent_id,
    role,
    myPowerRound: role === "A" ? duel.challenger_power_round : role === "B" ? duel.opponent_power_round : null,
    votes: vc.counts, voters: vc.voters, voterLimit: VOTER_LIMIT, myVotes,
    result: duel.status === "done" ? duel.result : null,
  };
}

async function myDuels(me: Player) {
  const { data, error } = await db.from("duels").select("id,code,status,challenger_id,opponent_id,winner_id,created_at,deadline")
    .or(`challenger_id.eq.${me.id},opponent_id.eq.${me.id}`).order("created_at", { ascending: false }).limit(20);
  if (error) throw error;
  const rows = data as Pick<Duel, "id" | "code" | "status" | "challenger_id" | "opponent_id" | "winner_id" | "created_at" | "deadline">[];
  const ids = [...new Set(rows.flatMap((r) => [r.challenger_id, r.opponent_id]).filter(Boolean) as string[])];
  const ps = ids.length ? await playersById(ids) : new Map();
  return rows.map((r) => {
    const otherId = r.challenger_id === me.id ? r.opponent_id : r.challenger_id;
    return {
      code: r.code, status: r.status, createdAt: r.created_at, deadline: r.deadline,
      mine: r.challenger_id === me.id, opponent: otherId ? ps.get(otherId)?.name ?? "?" : null,
      won: r.status === "done" ? r.winner_id === me.id : null,
    };
  });
}

function validRound(r: unknown) { return r === 0 || r === 1 || r === 2; }

async function handle(body: Record<string, unknown>) {
  const action = body.action;

  if (action === "register") {
    const name = capName(String(body.name ?? ""));
    const birthdate = String(body.birthdate ?? "");
    if (!name || name.length > 16 || stripName(name).length < 2) throw new Fail("Scrie un prenume de cel puțin 2 litere.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthdate) || isNaN(Date.parse(birthdate))) throw new Fail("Data nașterii nu e validă.");
    const age = (Date.now() - Date.parse(birthdate)) / (365.25 * 864e5);
    if (age < 16) throw new Fail("Jocul e deocamdată doar pentru cei de peste 16 ani.");
    if (age > 100) throw new Fail("Data nașterii nu pare corectă.");
    if (body.age16 !== true) throw new Fail("Confirmă că ai cel puțin 16 ani.");
    const token = randomHex(32);
    const { data, error } = await db.from("players").insert({ token_hash: await sha256(token), name, birthdate }).select(PLAYER_COLS).single();
    if (error) throw error;
    return { token, me: publicPlayer(data as Player, new Date()) };
  }

  if (action === "me") {
    const me = (await playerByToken(body.token))!;
    return { me: publicPlayer(me, new Date()), duels: await myDuels(me) };
  }

  if (action === "challenge") {
    const me = (await playerByToken(body.token))!;
    let opponentId: string | null = null;
    let rematchOf: string | null = null;
    if (typeof body.rematchOf === "string") {
      const prev = await duelByCode(body.rematchOf);
      if (prev.status !== "done") throw new Fail("Revanșa se cere după ce se termină duelul.");
      if (prev.challenger_id !== me.id && prev.opponent_id !== me.id) throw new Fail("Nu ai fost în duelul acesta.");
      opponentId = prev.challenger_id === me.id ? prev.opponent_id : prev.challenger_id;
      rematchOf = prev.id;
    }
    const seed = hashStr(randomHex(8));
    const categories = drawCategories(seed);
    for (let i = 0; i < 4; i++) {
      const { data, error } = await db.from("duels").insert({
        code: randomCode(), challenger_id: me.id, opponent_id: opponentId, categories,
        rematch_of: rematchOf,
      }).select("*").single();
      if (!error) return { duel: await duelView(data as Duel, me, null) };
      if (!String(error.message).includes("duplicate")) throw error;
    }
    throw new Fail("Nu am putut crea duelul. Încearcă din nou.", 500);
  }

  if (action === "duel") {
    const me = await playerByToken(body.token, false);
    return { duel: await duelView(await duelByCode(body.code), me, body.voterKey) };
  }

  if (action === "setPower") {
    const me = (await playerByToken(body.token))!;
    const duel = await duelByCode(body.code);
    if (!validRound(body.round)) throw new Fail("Alege runda 1, 2 sau 3.");
    if (duel.challenger_id === me.id && duel.status === "pending") {
      await db.from("duels").update({ challenger_power_round: body.round }).eq("id", duel.id);
    } else throw new Fail("Puterea se alege înainte să înceapă duelul.");
    return { duel: await duelView(await duelByCode(body.code), me, null) };
  }

  if (action === "accept") {
    const me = (await playerByToken(body.token))!;
    const duel = await duelByCode(body.code);
    if (duel.status !== "pending") throw new Fail("Duelul a fost deja acceptat.");
    if (duel.challenger_id === me.id) throw new Fail("Nu te poți duela cu tine. Trimite linkul unui prieten.");
    if (duel.opponent_id && duel.opponent_id !== me.id) throw new Fail("Revanșa aceasta e pentru altcineva.");
    const now = new Date();
    const { data, error } = await db.from("duels").update({
      opponent_id: me.id, status: "open",
      accepted_at: now.toISOString(), deadline: new Date(now.getTime() + DUEL_HOURS * 3600e3).toISOString(),
    }).eq("id", duel.id).eq("status", "pending").select("*").maybeSingle();
    if (error) throw error;
    if (!data) throw new Fail("Duelul a fost deja acceptat.");
    return { duel: await duelView(data as Duel, me, null) };
  }

  if (action === "vote") {
    const duel = await duelByCode(body.code);
    if (duel.status !== "open") throw new Fail("Votul e închis pentru acest duel.");
    if (duel.deadline && new Date(duel.deadline) <= new Date()) throw new Fail("Votul s-a încheiat.");
    const me = await playerByToken(body.token, false);
    if (me && (me.id === duel.challenger_id || me.id === duel.opponent_id)) throw new Fail("Nu poți vota în propriul duel.");
    if (!validRound(body.round) || (body.pick !== "A" && body.pick !== "B")) throw new Fail("Vot invalid.");
    if (typeof body.voterKey !== "string" || body.voterKey.length < 16) throw new Fail("Vot invalid.");
    const { error } = await db.from("votes").upsert({
      duel_id: duel.id, round: body.round, voter_hash: await sha256(body.voterKey), pick: body.pick,
    }, { onConflict: "duel_id,round,voter_hash" });
    if (error) throw error;
    return { duel: await duelView(duel, me, body.voterKey) };
  }

  if (action === "end") {
    const me = (await playerByToken(body.token))!;
    const duel = await duelByCode(body.code);
    if (me.id !== duel.challenger_id && me.id !== duel.opponent_id) throw new Fail("Doar duelistii pot încheia duelul.");
    if (duel.status !== "open") throw new Fail("Duelul nu e deschis.");
    const done = await resolve(duel);
    return { duel: await duelView(done, me, null) };
  }

  throw new Fail("Acțiune necunoscută.");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Folosește POST." }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    return json(await handle(body ?? {}));
  } catch (e) {
    if (e instanceof Fail) return json({ error: e.msg }, e.code);
    console.error(e);
    return json({ error: "A apărut o eroare pe server. Încearcă din nou." }, 500);
  }
});
