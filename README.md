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

## Regulile (v3)
- 6 trăsături: Amuzant, De încredere, Isteț, Fermecător, Curajos, Bun la suflet. Stelele dau o prezicere 35–65%.
- Scor trăsătură = (voturi primite + 10 × stele) / (voturi totale + 10). Fără voturi = stelele; cu multe voturi = prietenii.
- Aura socială = total voturi primite (doar crește).
- Duel = 6 întrebări (câte una pe trăsătură) din 120; aceiași doi nu primesc aceleași întrebări. Câștigă cine ia mai multe întrebări.

## Anti-trișat
- Vot doar cu cont (Supabase Auth: Google sau link pe email) și card făcut.
- Un vot pe cont pe întrebare; dueliștii nu votează, nici de pe telefonul lor.
- Cont nou (sub 24 h, fără dueluri) = vot cu greutate 0,5. Max 300 de voturi pe zi; max 5 conturi noi pe zi din aceeași rețea.
- Glorie doar din duelurile cu minimum 3 votanți.

## Faza de test
- Dueliștii pot încheia duelul oricând („Încheie acum”). Se scoate înainte de lansarea publică.
