import { createClient, type Session } from "@supabase/supabase-js";
import type { Traits, TraitKey, Element, DuelResult } from "./engine.ts";

const SUPABASE_URL = "https://aqhgzdcfwzktmqaubrdf.supabase.co";
const KEY = "sb_publishable_Awp1941uEs6RrTHeLWpdTA_2o8XHNTF";
const URL_API = `${SUPABASE_URL}/functions/v1/api`;

export const supabase = createClient(SUPABASE_URL, KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" },
});

export interface ProfileView {
  klass: string; destiny: number; sign: { name: string; glyph: string; trait: string }; el: Element; legend: boolean;
  stars: Traits; score: Traits; votes: Traits; aura: number; forma: number; horoscope: string; moon: string;
}
export interface PlayerView {
  id: string; name: string; level: number; xp: number; glory: number; wins: number; losses: number;
  shame: string | null; profile: ProfileView;
}
export interface DuelSummary {
  code: string; status: "pending" | "open" | "done"; createdAt: string; deadline: string | null;
  legacy: boolean; opponent: string | null; won: boolean | null;
}
export interface RoundView {
  id: string; q: string; trait: TraitKey; mine: "A" | "B" | null; counts: { A: number; B: number; n: number } | null;
}
export interface DuelView {
  code: string; version: number; status: "pending" | "open" | "done"; createdAt: string; acceptedAt: string | null;
  deadline: string | null; A: PlayerView; B: PlayerView | null; role: "A" | "B" | null; invitedOnly: boolean;
  voterLimit: number; rankedMin: number; rounds: RoundView[]; voters: number; canVote: boolean;
  result: (DuelResult & { ranked: boolean; voters: number; gloryGain: number; gloryLoss: number; xpWin: number; xpLoss: number }) | null;
}

const store = {
  get(k: string) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* ignorat */ } },
};
export const legacyToken = () => store.get("dn_token");
export function deviceId() {
  let k = store.get("dn_device") ?? store.get("dn_voter");
  if (!k) {
    const a = new Uint8Array(16); crypto.getRandomValues(a);
    k = Array.from(a).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  store.set("dn_device", k);
  return k;
}

let session: Session | null = null;
export const setSession = (s: Session | null) => { session = s; };

export async function call<T>(action: string, data: Record<string, unknown> = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(URL_API, {
      method: "POST",
      headers: {
        "content-type": "application/json", apikey: KEY,
        ...(session ? { authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ action, deviceId: deviceId(), ...data }),
    });
  } catch {
    throw new Error("Nu am putut ajunge la server. Verifică internetul și încearcă din nou.");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "A apărut o eroare. Încearcă din nou.");
  return body as T;
}
