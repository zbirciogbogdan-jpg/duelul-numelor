// Duelul Numelor — API-ul jocului (v3).
// Conturi reale prin Supabase Auth (Google / email). Toate calculele se fac aici, pe server.
// Protecții: vot doar cu cont și card, un vot pe întrebare, duelistii nu votează (nici de pe același telefon),
// conturile noi votează cu greutate 0,5, limită de voturi pe zi, limită de conturi noi pe rețea,
// Gloria se dă doar din duelurile cu minimum 3 votanți.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  buildProfile, drawQuestions, resolveDuel, gloryDelta, applyXp, hashStr, capName, stripName, zeroTraits, TRAIT_KEYS,
  type Profile, type Question, type Traits,
} from "./engine.ts";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const DUEL_HOURS = 24;
const VOTER_LIMIT = 15;        // duelul se închide singur la atâția votanți
const RANKED_MIN_VOTERS = 3;   // Glorie doar de la atâția votanți în sus
const DAILY_BALLOT_CAP = 300;  // voturi pe cont în 24 h
const IP_SIGNUP_CAP = 5;       // conturi noi din aceeași rețea în 24 h
const NEW_ACCOUNT_HOURS = 24;  // cont nou = vot cu greutate 0,5

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
function randomHex(bytes = 16) {
  const a = new Uint8Array(bytes); crypto.getRandomValues(a);
  return Array.from(a).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function randomCode() {
  const abc = "abcdefghjkmnpqrstuvwxyz23456789";
  const a = new Uint8Array(7); crypto.getRandomValues(a);
  return Array.from(a).map((b) => abc[b % abc.length]).join("");
}

type Player = {
  id: string; user_id: string | null; name: string; birthdate: string; level: number; xp: number; glory: number;
  wins: number; losses: number; shame_title: string | null; shame_until: string | null;
  points: Traits; seen: Traits; aura: number; device_hash: string | null; created_at: string;
};
type Duel = {
  id: string; code: string; challenger_id: string; opponent_id: string | null; categories: Question[];
  status: "pending" | "open" | "done"; created_at: string; accepted_at: string | null; deadline: string | null;
  result: unknown; winner_id: string | null; rematch_of: string | null; version: number;
};
const PLAYER_COLS = "id,user_id,name,birthdate,level,xp,glory,wins,losses,shame_title,shame_until,points,seen,aura,device_hash,created_at";

// ---------- identitate ----------
// Conturile de test (anonime) merg doar cât timp setarea allow_test_accounts e pornită.
async function testAccountsAllowed() {
  const { data } = await db.from("app_settings").select("value").eq("key", "allow_test_accounts").maybeSingle();
  return data?.value === true;
}
async function authUser(req: Request): Promise<{ id: string; test: boolean } | null> {
  const h = req.headers.get("authorization") ?? "";
  const jwt = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!jwt || jwt.startsWith("sb_")) return null;
  const { data, error } = await db.auth.getUser(jwt);
  if (error || !data.user) return null;
  if (data.user.is_anonymous) {
    if (!(await testAccountsAllowed())) throw new Fail("Conturile de test sunt oprite. Intră cu Google.", 403);
  }
  return { id: data.user.id, test: !!data.user.is_anonymous };
}
async function playerOfUser(userId: string | null): Promise<Player | null> {
  if (!userId) return null;
  const { data, error } = await db.from("players").select(PLAYER_COLS).eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data as Player | null;
}
function requireUser(userId: string | null) {
  if (!userId) throw new Fail("Intră în cont ca să continui.", 401);
  return userId;
}
async function requirePlayer(userId: string | null) {
  const p = await playerOfUser(requireUser(userId));
  if (!p) throw new Fail("Fă-ți mai întâi cardul.", 403);
  return p;
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

function profileOf(p: Player, at: Date): Profile {
  return buildProfile(p.name, p.birthdate, at, p.points, p.seen);
}
function publicPlayer(p: Player, at: Date) {
  const pr = profileOf(p, at);
  const shamed = p.shame_until && new Date(p.shame_until) > new Date() ? p.shame_title : null;
  return {
    id: p.id, name: pr.name, level: p.level, xp: p.xp, glory: p.glory, wins: p.wins, losses: p.losses, shame: shamed,
    profile: {
      klass: pr.klass, destiny: pr.destiny, sign: { name: pr.sign.name, glyph: pr.sign.glyph, trait: pr.sign.trait },
      el: pr.el, legend: pr.legend, stars: pr.stars, score: pr.score,
      votes: Object.fromEntries(TRAIT_KEYS.map((k) => [k, Math.round(pr.seen[k])])),
      aura: pr.aura, forma: pr.forma, horoscope: pr.horoscope, moon: pr.moon,
    },
  };
}

// ---------- voturi ----------
type Tally = { counts: { A: number; B: number; n: number }[]; voters: number; mine: (string | null)[]; votedRounds: Set<number> };
async function tally(duel: Duel, voterId: string | null): Promise<Tally> {
  const { data, error } = await db.from("ballots").select("round,pick,weight,voter_id").eq("duel_id", duel.id);
  if (error) throw error;
  const counts = Array.from({ length: 6 }, () => ({ A: 0, B: 0, n: 0 }));
  const voters = new Set<string>();
  const mine: (string | null)[] = Array(6).fill(null);
  for (const b of data as { round: number; pick: "A" | "B"; weight: number; voter_id: string }[]) {
    counts[b.round][b.pick] += b.weight; counts[b.round].n++;
    voters.add(b.voter_id);
    if (voterId && b.voter_id === voterId) mine[b.round] = b.pick;
  }
  const votedRounds = new Set(mine.map((m, i) => (m ? i : -1)).filter((i) => i >= 0));
  return { counts, voters: voters.size, mine, votedRounds };
}

// ---------- închiderea duelului ----------
async function resolve(duel: Duel): Promise<Duel> {
  if (duel.status !== "open" || !duel.opponent_id || !duel.accepted_at || duel.version < 3) return duel;
  const ps = await playersById([duel.challenger_id, duel.opponent_id]);
  const pa = ps.get(duel.challenger_id)!, pb = ps.get(duel.opponent_id)!;
  const at = new Date(duel.accepted_at);
  const A = profileOf(pa, at), B = profileOf(pb, at);
  const t = await tally(duel, null);
  const res = resolveDuel({ A, B, questions: duel.categories, votes: t.counts, seed: hashStr(duel.id) });

  // Statisticile pe trăsături: câte voturi ai primit și câte s-au dat în total la acea trăsătură.
  const wonA = { ...zeroTraits(), ...pa.points }, seenA = { ...zeroTraits(), ...pa.seen };
  const wonB = { ...zeroTraits(), ...pb.points }, seenB = { ...zeroTraits(), ...pb.seen };
  duel.categories.forEach((q, i) => {
    const c = t.counts[i];
    wonA[q.trait] += c.A; seenA[q.trait] += c.A + c.B;
    wonB[q.trait] += c.B; seenB[q.trait] += c.A + c.B;
  });
  const sum = (x: Traits) => Math.round(TRAIT_KEYS.reduce((a, k) => a + x[k], 0));

  const ranked = t.voters >= RANKED_MIN_VOTERS;
  const winner = res.winner === "A" ? pa : pb, loser = res.winner === "A" ? pb : pa;
  const { gain, loss } = ranked ? gloryDelta(winner.glory, loser.glory) : { gain: 0, loss: 0 };
  const xpWin = duel.rematch_of ? 80 : 60, xpLoss = 25;
  const result = { ...res, ranked, voters: t.voters, gloryGain: gain, gloryLoss: loss, xpWin, xpLoss };

  const { data: claimed, error } = await db.from("duels")
    .update({ status: "done", result, winner_id: winner.id })
    .eq("id", duel.id).eq("status", "open").select("*").maybeSingle();
  if (error) throw error;
  if (!claimed) {
    const { data } = await db.from("duels").select("*").eq("id", duel.id).single();
    return data as Duel;
  }
  const stats = new Map([
    [pa.id, { points: wonA, seen: seenA, aura: sum(wonA) }],
    [pb.id, { points: wonB, seen: seenB, aura: sum(wonB) }],
  ]);
  const wx = applyXp(winner.level, winner.xp, xpWin), lx = applyXp(loser.level, loser.xp, xpLoss);
  await db.from("players").update({
    wins: winner.wins + 1, glory: winner.glory + gain, level: wx.level, xp: wx.xp, ...stats.get(winner.id),
  }).eq("id", winner.id);
  await db.from("players").update({
    losses: loser.losses + 1, glory: Math.max(0, loser.glory - loss), level: lx.level, xp: lx.xp,
    shame_title: res.shame, shame_until: new Date(Date.now() + 7 * 864e5).toISOString(), ...stats.get(loser.id),
  }).eq("id", loser.id);
  return claimed as Duel;
}

async function maybeResolve(duel: Duel): Promise<Duel> {
  if (duel.status !== "open" || duel.version < 3) return duel;
  if (duel.deadline && new Date(duel.deadline) <= new Date()) return resolve(duel);
  const t = await tally(duel, null);
  if (t.voters >= VOTER_LIMIT) return resolve(duel);
  return duel;
}

async function duelView(duel: Duel, me: Player | null) {
  duel = await maybeResolve(duel);
  const ids = [duel.challenger_id, ...(duel.opponent_id ? [duel.opponent_id] : [])];
  const ps = await playersById(ids);
  const at = duel.accepted_at ? new Date(duel.accepted_at) : new Date();
  const A = ps.get(duel.challenger_id)!;
  const B = duel.opponent_id ? ps.get(duel.opponent_id) ?? null : null;
  const role = me ? (me.id === A.id ? "A" : B && me.id === B.id ? "B" : null) : null;
  const base = {
    code: duel.code, version: duel.version, status: duel.status, createdAt: duel.created_at, acceptedAt: duel.accepted_at,
    deadline: duel.deadline, A: publicPlayer(A, at), B: B ? publicPlayer(B, at) : null, role,
    invitedOnly: duel.status === "pending" && !!duel.opponent_id, voterLimit: VOTER_LIMIT, rankedMin: RANKED_MIN_VOTERS,
  };
  if (duel.version < 3) return { ...base, rounds: [], voters: 0, result: null, canVote: false };
  const t = await tally(duel, me?.id ?? null);
  // Ca să nu te iei după alții: votanții văd rezultatele unei întrebări abia după ce au votat la ea.
  const showAll = duel.status === "done" || role !== null;
  const rounds = duel.categories.map((q, i) => ({
    id: q.id, q: q.q, trait: q.trait, mine: t.mine[i],
    counts: showAll || t.votedRounds.has(i) ? { A: round1(t.counts[i].A), B: round1(t.counts[i].B), n: t.counts[i].n } : null,
  }));
  return {
    ...base, rounds, voters: t.voters, canVote: duel.status === "open" && !!me && role === null,
    result: duel.status === "done" ? duel.result : null,
  };
}
const round1 = (v: number) => Math.round(v * 10) / 10;

async function myDuels(me: Player) {
  const { data, error } = await db.from("duels").select("code,status,challenger_id,opponent_id,winner_id,created_at,deadline,version")
    .or(`challenger_id.eq.${me.id},opponent_id.eq.${me.id}`).order("created_at", { ascending: false }).limit(20);
  if (error) throw error;
  const rows = data as Duel[];
  const ids = [...new Set(rows.flatMap((r) => [r.challenger_id, r.opponent_id]).filter(Boolean) as string[])];
  const ps = ids.length ? await playersById(ids) : new Map<string, Player>();
  return rows.map((r) => {
    const otherId = r.challenger_id === me.id ? r.opponent_id : r.challenger_id;
    return {
      code: r.code, status: r.status, createdAt: r.created_at, deadline: r.deadline, legacy: r.version < 3,
      opponent: otherId ? ps.get(otherId)?.name ?? "?" : null, won: r.status === "done" ? r.winner_id === me.id : null,
    };
  });
}

// ---------- acțiuni ----------
async function handle(req: Request, body: Record<string, unknown>) {
  const action = body.action;
  const auth = await authUser(req);
  const userId = auth?.id ?? null, isTestUser = auth?.test ?? false;

  if (action === "me") {
    requireUser(userId);
    const me = await playerOfUser(userId);
    if (!me) return { me: null };
    return { me: publicPlayer(me, new Date()), duels: await myDuels(me) };
  }

  if (action === "register") {
    const uid = requireUser(userId);
    if (await playerOfUser(uid)) throw new Fail("Ai deja un card pe acest cont.");
    if (body.age16 !== true) throw new Fail("Confirmă că ai cel puțin 16 ani.");
    const deviceHash = typeof body.deviceId === "string" && body.deviceId.length >= 16 ? await sha256(body.deviceId) : null;

    // Card făcut înainte de conturi pe acest telefon? Îl legăm de cont, cu tot cu istoric.
    if (typeof body.legacyToken === "string" && body.legacyToken.length >= 32) {
      const { data: old } = await db.from("players").select("id,user_id").eq("token_hash", await sha256(body.legacyToken)).maybeSingle();
      if (old && !old.user_id) {
        await db.from("players").update({ user_id: uid, device_hash: deviceHash }).eq("id", old.id);
        const me = (await playerOfUser(uid))!;
        return { me: publicPlayer(me, new Date()), linked: true };
      }
    }

    const name = capName(String(body.name ?? ""));
    const birthdate = String(body.birthdate ?? "");
    if (!name || name.length > 16 || stripName(name).length < 2) throw new Fail("Scrie un prenume de cel puțin 2 litere.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthdate) || isNaN(Date.parse(birthdate))) throw new Fail("Data nașterii nu e validă.");
    const age = (Date.now() - Date.parse(birthdate)) / (365.25 * 864e5);
    if (age < 16) throw new Fail("Jocul e deocamdată doar pentru cei de peste 16 ani.");
    if (age > 100) throw new Fail("Data nașterii nu pare corectă.");

    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
    const ipHash = ip ? await sha256(`dn|${ip}`) : null;
    if (ipHash && !isTestUser) {
      const since = new Date(Date.now() - 864e5).toISOString();
      const { count } = await db.from("players").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", since);
      if ((count ?? 0) >= IP_SIGNUP_CAP) throw new Fail("Prea multe carduri noi din această rețea azi. Încearcă mâine.", 429);
    }
    const { data, error } = await db.from("players").insert({
      user_id: uid, name, birthdate, device_hash: deviceHash, ip_hash: ipHash,
    }).select(PLAYER_COLS).single();
    if (error) throw error;
    return { me: publicPlayer(data as Player, new Date()) };
  }

  if (action === "challenge") {
    const me = await requirePlayer(userId);
    let opponentId: string | null = null, rematchOf: string | null = null;
    const exclude = new Set<string>();
    if (typeof body.rematchOf === "string") {
      const prev = await duelByCode(body.rematchOf);
      if (prev.status !== "done") throw new Fail("Revanșa se cere după ce se termină duelul.");
      if (prev.challenger_id !== me.id && prev.opponent_id !== me.id) throw new Fail("Nu ai fost în duelul acesta.");
      opponentId = prev.challenger_id === me.id ? prev.opponent_id : prev.challenger_id;
      rematchOf = prev.id;
      // Aceiași doi nu primesc aceleași întrebări de două ori.
      const { data: past } = await db.from("duels").select("categories")
        .or(`and(challenger_id.eq.${me.id},opponent_id.eq.${opponentId}),and(challenger_id.eq.${opponentId},opponent_id.eq.${me.id})`)
        .eq("version", 3).limit(30);
      for (const d of (past ?? []) as { categories: Question[] }[]) for (const q of d.categories) if (q.id) exclude.add(q.id);
    }
    const questions = drawQuestions(hashStr(randomHex(8)), exclude);
    for (let i = 0; i < 4; i++) {
      const { data, error } = await db.from("duels").insert({
        code: randomCode(), challenger_id: me.id, opponent_id: opponentId, categories: questions, rematch_of: rematchOf, version: 3,
      }).select("*").single();
      if (!error) return { duel: await duelView(data as Duel, me) };
      if (!String(error.message).includes("duplicate")) throw error;
    }
    throw new Fail("Nu am putut crea duelul. Încearcă din nou.", 500);
  }

  if (action === "duel") {
    const me = await playerOfUser(userId);
    return { duel: await duelView(await duelByCode(body.code), me) };
  }

  if (action === "accept") {
    const me = await requirePlayer(userId);
    const duel = await duelByCode(body.code);
    if (duel.version < 3) throw new Fail("Duelul acesta e din versiunea veche.");
    if (duel.status !== "pending") throw new Fail("Duelul a fost deja acceptat.");
    if (duel.challenger_id === me.id) throw new Fail("Nu te poți duela cu tine. Trimite linkul unui prieten.");
    if (duel.opponent_id && duel.opponent_id !== me.id) throw new Fail("Revanșa aceasta e pentru altcineva.");
    const now = new Date();
    const { data, error } = await db.from("duels").update({
      opponent_id: me.id, status: "open", accepted_at: now.toISOString(),
      deadline: new Date(now.getTime() + DUEL_HOURS * 3600e3).toISOString(),
    }).eq("id", duel.id).eq("status", "pending").select("*").maybeSingle();
    if (error) throw error;
    if (!data) throw new Fail("Duelul a fost deja acceptat.");
    return { duel: await duelView(data as Duel, me) };
  }

  if (action === "vote") {
    const me = await requirePlayer(userId);
    const duel = await duelByCode(body.code);
    if (duel.version < 3 || duel.status !== "open") throw new Fail("Votul e închis pentru acest duel.");
    if (duel.deadline && new Date(duel.deadline) <= new Date()) throw new Fail("Votul s-a încheiat.");
    if (me.id === duel.challenger_id || me.id === duel.opponent_id) throw new Fail("Nu poți vota în propriul duel.");
    const r = body.round;
    if (typeof r !== "number" || !Number.isInteger(r) || r < 0 || r > 5) throw new Fail("Vot invalid.");
    if (body.pick !== "A" && body.pick !== "B") throw new Fail("Vot invalid.");

    // Același telefon cu unul dintre dueliști = nu poate vota.
    if (typeof body.deviceId === "string" && body.deviceId.length >= 16) {
      const dh = await sha256(body.deviceId);
      const ps = await playersById([duel.challenger_id, duel.opponent_id!]);
      if ([...ps.values()].some((p) => p.device_hash && p.device_hash === dh)) throw new Fail("De pe acest telefon nu se poate vota în duelul acesta.");
      if (!me.device_hash) await db.from("players").update({ device_hash: dh }).eq("id", me.id);
    }
    const since = new Date(Date.now() - 864e5).toISOString();
    const { count } = await db.from("ballots").select("id", { count: "exact", head: true }).eq("voter_id", me.id).gte("created_at", since);
    if ((count ?? 0) >= DAILY_BALLOT_CAP) throw new Fail("Ai atins limita de voturi pe azi. Revino mâine.", 429);

    const isNew = Date.now() - new Date(me.created_at).getTime() < NEW_ACCOUNT_HOURS * 3600e3 && me.wins + me.losses === 0;
    const { error } = await db.from("ballots").upsert({
      duel_id: duel.id, round: r, voter_id: me.id, pick: body.pick, weight: isNew ? 0.5 : 1,
    }, { onConflict: "duel_id,round,voter_id" });
    if (error) throw error;
    return { duel: await duelView(duel, me) };
  }

  if (action === "end") { // doar în faza de test
    const me = await requirePlayer(userId);
    const duel = await duelByCode(body.code);
    if (me.id !== duel.challenger_id && me.id !== duel.opponent_id) throw new Fail("Doar dueliștii pot încheia duelul.");
    if (duel.status !== "open") throw new Fail("Duelul nu e deschis.");
    return { duel: await duelView(await resolve(duel), me) };
  }

  throw new Fail("Acțiune necunoscută.");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Folosește POST." }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    return json(await handle(req, body ?? {}));
  } catch (e) {
    if (e instanceof Fail) return json({ error: e.msg }, e.code);
    console.error(e);
    return json({ error: "A apărut o eroare pe server. Încearcă din nou." }, 500);
  }
});
