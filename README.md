# Duelul Numelor

Joc web: prenumele și data nașterii devin un card (numerologie, zodie, element, Forma zilei),
iar prietenii se provoacă la dueluri de 3 runde votate de ceilalți.

## Structura
- `web/` — aplicația React (Vite). Build: `npm install && npm run build` → `web/dist`.
- `supabase/functions/api/` — serverul (o Edge Function). Toate calculele de duel se fac aici.
- `shared/engine.ts` — motorul de calcul. Se copiază identic în `web/src/engine.ts` și `supabase/functions/api/engine.ts`.

## Vercel
Root Directory: `web` · Framework: Vite · Build: `npm run build` · Output: `dist`.

## Supabase
Proiect: `aqhgzdcfwzktmqaubrdf` (Frankfurt). Tabele: `players`, `duels`, `votes`, cu RLS activ și fără acces direct din browser;
aplicația vorbește doar cu funcția `api`.

## Faza de test
- Duelistii pot încheia duelul oricând („Încheie acum”). Se scoate înainte de lansarea publică.
- Cardul are 6 trăsături sociale: stelele dau valoarea de pornire, voturile primite în dueluri o urcă (nu scade niciodată). Aura socială = toate voturile primite.
- Puterea: în runda aleasă, voturile valorează cu 15% mai mult.
