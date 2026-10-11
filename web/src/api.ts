import type { Klass, Traits, TraitKey, Element, Category, DuelResult, Medal } from "./engine.ts";

const URL_API = "https://aqhgzdcfwzktmqaubrdf.supabase.co/functions/v1/api";
const KEY = "sb_publishable_Awp1941uEs6RrTHeLWpdTA_2o8XHNTF";

export interface CardView {
  name: string; destiny: number; klass: Klass; sign: { name: string; glyph: string; trait: string };
  el: Element; legend: boolean; stars: Traits; traits: Traits; points: Traits; aura: number;
  medals: Record<TraitKey, Medal>; forma: number; horoscope: string; reasons: string[]; moon: string;
}
export interface PlayerView {
  id: string; name: string; level: number; xp: number; glory: number; wins: number; losses: number;
  shame: string | null; card: CardView;
}
export interface DuelSummary {
  code: string; status: "pending" | "open" | "done"; createdAt: string; deadline: string | null;
  mine: boolean; opponent: string | null; won: boolean | null;
}
export interface DuelView {
  code: string; status: "pending" | "open" | "done"; createdAt: string; acceptedAt: string | null; deadline: string | null;
  categories: Category[]; A: PlayerView; B: PlayerView | null; invitedOnly: boolean; role: "A" | "B" | null;
  myPowerRound: number | null; votes: { A: number; B: number }[]; voters: number; voterLimit: number;
  myVotes: ("A" | "B" | null)[];
  result: (DuelResult & { gloryGain: number; gloryLoss: number; xpWin: number; xpLoss: number; votesA: number; votesB: number }) | null;
}

const store = {
  get(k: string) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* ignorat */ } },
  del(k: string) { try { localStorage.removeItem(k); } catch { /* ignorat */ } },
};
export const getToken = () => store.get("dn_token");
export const setToken = (t: string) => store.set("dn_token", t);
export const clearToken = () => store.del("dn_token");
export function voterKey() {
  let k = store.get("dn_voter");
  if (!k) {
    const a = new Uint8Array(16); crypto.getRandomValues(a);
    k = Array.from(a).map((b) => b.toString(16).padStart(2, "0")).join("");
    store.set("dn_voter", k);
  }
  return k;
}

export async function call<T>(action: string, data: Record<string, unknown> = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(URL_API, {
      method: "POST",
      headers: { "content-type": "application/json", apikey: KEY },
      body: JSON.stringify({ action, token: getToken(), ...data }),
    });
  } catch {
    throw new Error("Nu am putut ajunge la server. Verifică internetul și încearcă din nou.");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && action === "me") clearToken();
    throw new Error(body.error || "A apărut o eroare. Încearcă din nou.");
  }
  return body as T;
}
