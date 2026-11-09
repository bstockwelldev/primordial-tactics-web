# Architecture

Stack locked 2026-11-09: web/React, browser-based, eventual seamless multiplayer. Unity/C# is out for this version.

## Runtime topology

One server process, `server.ts` (Express + Socket.io, run with `tsx`):

- Dev: Vite runs in middleware mode and serves the SPA through Express.
- Prod: Express serves `dist/` statically with an SPA fallback.
- Port 3000 on `0.0.0.0`. Health check at `GET /api/health`.

Client: React 19 SPA (`src/main.tsx` → `App.tsx`), Tailwind 4, `socket.io-client` connecting same-origin with websocket + polling fallback.

## State model

Two halves, split by design:

- **Arena state is server-side.** `server.ts` holds rooms in memory (`Map<string, ArenaRoomState>`) and enforces the rules from `src/game/rules.ts` on every `move_unit` / `use_ability` / `end_turn` event: turn ownership, movement validity, AP costs, range, damage, torpor, status effects, win condition. Clients receive `room_state_updated` broadcasts.
- **Progression state is client-side.** `GameContext` holds player, resources, dinos, buildings, and campaign sectors in React state, persisted to localStorage (`pt_player_name`, `pt_resources`, `pt_inventory`, `pt_dinos`, `pt_campaign_sectors`).

## Firebase

- Config in `firebase-applet-config.json` (AI Studio-provisioned project; Firestore database `ai-studio-primaltacticsdin-...`).
- `src/lib/firebase.ts` initializes app/auth/Firestore and exports `saveUserProfile` / `saveMatchRecord` helpers.
- `firestore.rules` is default-deny, auth-gated, owner-only writes; match records are immutable after creation.
- **Not wired yet:** nothing in the files read calls the Firebase helpers or signs a user in — `GameContext` never imports `src/lib/firebase.ts`, and identity is a localStorage player name. Cloud save is designed, not live. (The view components were not fully read — confirm no view calls the helpers before treating them as dead code.)

## AI (Gemini)

- `GEMINI_API_KEY` env (optional). Model: `gemini-2.5-flash` via `@google/genai`.
- `POST /api/npc-dialogue` — in-character NPC replies from `SURVIVOR_NPCS` system prompts.
- `POST /api/match-feedback` — structured JSON debrief (grade, strengths, weaknesses, recommendation).
- Both fall back to canned replies when no key is set. `GET /api/roadmap` serves a static phased roadmap.

## Multiplayer readiness

Ready:

- Server-authoritative arena (see above).
- Lobby + quick match + rooms list over sockets; match records typed in `MatchRecord`.

Deferred / gaps (verified by reading `server.ts`):

- **Class passives don't fire in live arena play.** `use_ability` calls `calculateDamage` / `calculateTorporDamage` without the attacker/defender class, so Skewer pierce, Human +10%, Blade/Striker crit bonus, Hulk/Tank mitigation, and Crush/Siege torpor bonus are all dead in real matches — the rules exist, the call site drops them.
- **No `get_rooms` handler.** The client emits `get_rooms` on `rooms_updated`, but the server never handles it — the lobby list only refreshes on connect.
- **Rooms are in-memory.** A server restart wipes all rooms and matches; no reconnect or room recovery.
- **Turn timer is tracked, not enforced.** `turnTimeLeft` is set to 45 on turn change, but no server-side countdown forces a turn over.
- **CORS is wide open** (`origin: '*'`) on the Socket.io server.
- **No AI opponent.** Arena matches need two humans; campaign sectors carry `enemySquad` data but nothing loads it into a room.

## Directory map

- `server.ts` — Express + Socket.io arena server, Gemini REST endpoints, Vite/static serving
- `src/App.tsx` — screen shell (6 screens + 4 modals)
- `src/components/` — views and modals
- `src/context/GameContext.tsx` — client progression + socket state, localStorage persistence
- `src/game/` — `constants.ts` (species, buildings, recipes, sectors, augments, NPCs), `rules.ts` (combat/taming/evolution), `rules.test.ts`
- `src/types/game.ts` — shared types (units, tiles, rooms, resources, augments)
- `src/lib/firebase.ts` — Firebase init + save helpers (unwired)
- `src/assets/images/` — dino/survivor token art (~7 MB)
- `firebase-blueprint.json` — Firestore entity schemas; `firestore.rules` — access rules
- `.aistudio/` — AI Studio export artifacts (contents not reviewed)

## Known limitations (verified)

- `package.json` still says `react-example` v0.0.0 (template residue).
- No test script; `rules.test.ts` exists with no runner.
- No README until this one; no CI.
- Demo seeding is live: starter dinos/resources are hardcoded and `quickAddDemoResources()` grants resources — gate or remove before real play.
- Player level never increases (starts at 5; XP accumulates with no level-up).
