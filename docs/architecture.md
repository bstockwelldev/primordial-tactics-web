# Architecture

Stack locked 2026-11-09: web/React, browser-based (desktop + mobile), eventual seamless multiplayer. Unity/C# is out for this version. Firebase/GCP was removed 2026-11-09 (see below); deployment target is Vercel.

## Runtime topology

One server process, `server.ts` (Express + Socket.io, run with `tsx`):

- Dev: Vite runs in middleware mode and serves the SPA through Express.
- Prod (single host): Express serves `dist/` statically with an SPA fallback.
- Port 3000 on `0.0.0.0`. Health check at `GET /api/health`.

Client: React 19 SPA (`src/main.tsx` → `App.tsx`), Tailwind 4, `socket.io-client` connecting same-origin with websocket + polling fallback.

**Solo mode is client-side.** Opening the arena without a room starts a vs-AI skirmish entirely in `TacticalArenaView`: `initSoloMatch()` builds the player squad from tamed dinos and the enemy squad from the active campaign mission (`activeSectorMission.enemySquad`, level-scaled) or default rivals; `runAiTurn()` drives the enemy. No server involvement — and no server validation of the result.

## State model

Two halves, split by design:

- **Arena state is server-side (PvP).** `server.ts` holds rooms in memory (`Map<string, ArenaRoomState>`) and enforces the rules from `src/game/rules.ts` on every `move_unit` / `use_ability` / `end_turn` event: turn ownership, movement validity, AP costs, range, damage, torpor, status effects, win condition. Clients receive `room_state_updated` broadcasts.
- **Solo arena state is view-local.** `soloUnits` / `soloLogs` / `soloTurn` live in `TacticalArenaView` state; the same `rules.ts` functions run in the browser.
- **Progression state is client-side.** `GameContext` holds player, resources, dinos, buildings, and campaign sectors in React state, persisted to localStorage (`pt_player_name`, `pt_resources`, `pt_inventory`, `pt_dinos`, `pt_campaign_sectors`).

## Firebase — removed 2026-11-09

Firebase/GCP was scrapped in favor of deploying via Vercel. What was removed (main, 2026-11-09):

- `firebase` ^13.2.0 from `package.json` (commit `8ddd7142`)
- `src/lib/firebase.ts` — init + `saveUserProfile` / `saveMatchRecord` (commit `f34e0ea8`)
- `firebase-applet-config.json` — AI Studio-provisioned GCP project config (commit `617db5e6`)
- `firestore.rules` — default-deny, auth-gated rules (commit `60bdf81a`)
- `firebase-blueprint.json` — Firestore entity schemas (commit `a87147d4`)

Verified before removal: nothing in the app imported the Firebase module — `GameContext` never imported it, no view or modal referenced it, and `saveUserProfile` / `saveMatchRecord` had no callers anywhere in `src/`. The Firestore helpers were dead code from the start; identity is a localStorage player name.

**Consequences:** persistence is localStorage-only, by design now — there is no cloud save and no auth. Cloud save is an open decision (see the adaptation doc, gap 9): Vercel KV / Postgres / Blob are the obvious options, or none. `bun.lock` still lists the firebase package (stale — regen on the next `bun install`). `.env.example` still carries AI Studio comments; `GEMINI_API_KEY` now belongs in the Vercel project dashboard.

## Deployment

**Client → Vercel.** The client is a static Vite build: install from `bun.lock` (Vercel auto-detects Bun), build `vite build`, output `dist`. `VITE_ARENA_URL` is set in the Vercel project dashboard (the arena server's public URL; unset = same-origin). The arena host gets `GEMINI_API_KEY`; the AI endpoints fall back to canned replies without it.

**Arena server → always-on host (split decided 2026-11-09, option A).** `server.ts` is a long-lived Socket.io process holding in-memory rooms. Vercel Functions are serverless request/response — they cannot hold the persistent WebSocket connections the arena needs, so the server cannot deploy to Vercel as-is. The split is wired: the client reads the arena URL from `VITE_ARENA_URL` (`src/lib/api.ts` — unset = same-origin, so dev and single-host still work with no config), and the server allows the Vercel origin via `ARENA_CORS_ORIGIN` (comma-separated allow-list; unset = `*`) for both Socket.io and the REST endpoints (`/api/npc-dialogue`, `/api/match-feedback`, `/api/roadmap`). The server also honors `process.env.PORT` now (arena hosts assign a port). Env to set once the host exists: Vercel dashboard `VITE_ARENA_URL` = arena host URL; arena host `ARENA_CORS_ORIGIN` = Vercel domain, `GEMINI_API_KEY`, `PORT` (assigned by the host).

Options (decided — A):

- **A (chosen): split.** Vercel hosts the static client; the arena server runs on a small always-on host (Fly.io / Render / Railway). The Gemini REST endpoints stay on the arena server for now; they are stateless and can move to Vercel serverless functions later.
- **B (rejected): managed realtime.** Replace Socket.io with a managed realtime service (Ably / Pusher) that works with Vercel serverless. Bigger rewrite of the realtime layer, new ongoing dependency.
- **C (rejected): single always-on host.** Skip Vercel; run the whole `server.ts` on one host. Contradicts the Vercel decision.

**MVP note (2026-11-09): realtime multiplayer is NOT required for MVP — async multiplayer instead (long turn timer, notify the next player at end of turn). This may remove the need for a persistent Socket.io host entirely; the async turn design is an open item for the next session (see `docs/handoff.md`).**

## Browser interface (desktop + mobile)

Both desktop and mobile browsers are in scope. Verified state of the current UI (all six views + Navbar + modals, read 2026-11-09):

**Already adapts:**

- Every view uses Tailwind responsive breakpoints (`sm`/`md`/`lg`): single-column stacking below `lg` (`grid-cols-1 lg:grid-cols-3/4/12`), responsive type and padding.
- Navbar tabs are a horizontally scrollable row (`overflow-x-auto`, `scrollbar-none`) — the six screens stay reachable on a phone.
- Modals are `max-w-2xl`/`max-w-3xl` with `max-h-[85vh]` and internal scroll.
- Tile taps work through `onClick`; enemy inspection falls back to tap-to-inspect (click an enemy without an armed ability).

**Gaps (mobile):**

- **Arena grid does not shrink.** The 8×6 grid has `min-w-[620px]` inside an `overflow-x-auto` container — on a phone it scrolls horizontally instead of scaling. Unit tokens are `w-10 h-10` (`sm:w-12`).
- **Resource bar hidden below `lg`.** On mobile there is no resource readout anywhere in the header.
- **Touch targets are small.** Arena and modal buttons are mostly `px-3 py-1.5` / `text-xs` — below the 44px minimum. No `touch-action` control on the grid (double-tap zoom risk).
- **Hover-only inspection.** Tile/unit inspection is driven by `onMouseEnter`; touch users get the tap fallback but no hover equivalent.
- **Token images are ~1 MB each** (7 files, ~7 MB total), served at full size with no responsive variants or lazy loading — heavy on mobile data.
- **No safe-area handling.** No `viewport-fit=cover` / safe-area insets for notched phones; the viewport meta tag is present.

**Targets (to lock):** desktop browsers + iOS Safari / Android Chrome; arena playable in portrait (grid scales or scrolls — pick one) and landscape; touch targets ≥ 44px; resources visible on mobile (compact bar or sheet).

## AI (Gemini)

- `GEMINI_API_KEY` env (optional). Model: `gemini-2.5-flash` via `@google/genai`.
- `POST /api/npc-dialogue` — in-character NPC replies from `SURVIVOR_NPCS` system prompts.
- `POST /api/match-feedback` — structured JSON debrief (grade, strengths, weaknesses, recommendation).
- Both fall back to canned replies when no key is set. `GET /api/roadmap` serves a static phased roadmap.
- These endpoints live on the arena server today. They are stateless, so they can move to Vercel serverless functions later without touching the game logic.

## Multiplayer readiness

Ready:

- Server-authoritative arena (PvP, see above).
- Lobby + quick match + rooms list over sockets; match records typed in `MatchRecord`.
- Solo vs-AI path is built and playable (client-side).

Deferred / gaps (verified by reading `server.ts` and `TacticalArenaView.tsx`):

- **Class passives don't fire in server PvP only.** `use_ability` calls `calculateDamage` / `calculateTorporDamage` without the attacker/defender class, so Skewer pierce, Human +10%, Blade/Striker crit bonus, Hulk/Tank mitigation, and Crush/Siege torpor bonus are dead in real PvP matches. The solo path passes the classes (verified), and `rules.test.ts` covers the passives — the rules exist, the server call site drops them.
- **No `get_rooms` handler.** The client emits `get_rooms` on `rooms_updated`, but the server never handles it — the lobby list only refreshes on connect.
- **Rooms are in-memory.** A server restart wipes all rooms and matches; no reconnect or room recovery.
- **Turn timer is tracked, not enforced.** `turnTimeLeft` is set to 45 on turn change, but no server-side countdown forces a turn over.
- **CORS is wide open** (`origin: '*'`) on the Socket.io server.
- **Solo bot (rebuilt 2026-11-09).** `src/game/bot.ts` is a per-unit state machine (`ASSESS → FINISH / KITE / ENGAGE / REPOSITION / ADVANCE → DONE`, transition table enforced at runtime, every action state must spend AP so a turn always terminates). Decisions use no randomness; combat dice come from a seeded stream (`src/game/rng.ts`) shared with the player's attacks, so a solo match is reproducible from its seed (shown in the opening log line) plus the player's inputs. Profiles: `moderate` (the PvE/campaign opponent — evaluates attacks, focuses kills, plans multi-move routes by true AP cost, stages outside enemy reach before first blood, kites when wounded), plus `easy` and `static` as test baselines. `src/game/sim.ts` plays whole matches headlessly; `bot.sim.test.ts` checks determinism, state-machine legality, board invariants across all 12 sectors, and skill on mirrored squads (moderate beats easy and a stationary squad ≥ 80%, an idle one 100%). Squad/grid construction moved to `src/game/arenaSetup.ts`. Still ignores ally/self abilities and cooldowns — neither has any effect in the solo arena yet.
- **Campaign win double-award (fixed 2026-11-09).** The direct `liberateSector()` call in `handleExecuteAbility` is gone — `recordMatchResult()` is the single payout path — and `liberateSector()` is idempotent (an already-liberated sector pays nothing).

## Directory map

- `server.ts` — Express + Socket.io arena server, Gemini REST endpoints, Vite/static serving
- `src/App.tsx` — screen shell (6 screens + 4 modals)
- `src/components/` — views and modals
- `src/context/GameContext.tsx` — client progression + socket state, localStorage persistence
- `src/game/` — `constants.ts` (species, buildings, recipes, sectors, augments, NPCs), `rules.ts` (combat/taming/evolution), `rules.test.ts`
- `src/types/game.ts` — shared types (units, tiles, rooms, resources, augments)
- `src/assets/images/` — dino/survivor token art (~7 MB)
- `.aistudio/` — AI Studio export artifacts (contents not reviewed)

## Known limitations (verified)

- `package.json` still says `react-example` v0.0.0 (template residue).
- Tests: `bun run test` (`tsx --test`, ~20s) runs `rules.test.ts`, `bot.test.ts`, `bot.sim.test.ts`. Plain `node --test` cannot resolve the extensionless imports.
- No README until this one; no CI.
- `bun.lock` still lists firebase (stale — regen on next `bun install`).
- Demo seeding is live: starter dinos/resources are hardcoded and `quickAddDemoResources()` grants resources — gate or remove before real play.
- Player level never increases (starts at 5; XP accumulates with no level-up).
- Taming view mutates `inventory` directly (`inventory.tranq_dart -= 1`) without `setState` — counts go stale until the next re-render.
- Tranq torpor in the taming view is a flat random 35–55, not the `calculateTorporDamage` formula.
- `CLASS_TACTICAL_DETAILS` already labels Striker/Tank/Scout/Siege/Controller as "Legacy aliases" of the GDD's five — the taxonomy question is answered in code; only the cleanup remains.
