# Primordial Tactics — handoff

State as of 2026-11-13 (after PR #11 merged and deployed). This is the context a new session (Claude Cloud Agent) needs to pick up the repo cold. The repo's living docs are `README.md`, `docs/GDD.md` (v1.2), `docs/architecture.md`, and `docs/game-design-adaptation.md` (14 gaps) — this file is the state snapshot, not a duplicate of them.

## Goal

Browser-based tactical RPG with dinosaurs (Primordial Tactics). Web/React, desktop **and** mobile browsers, eventual seamless multiplayer. Fight → Survive → Strengthen → Repeat: turn-based grid combat, taming, base management, crafting, Magitek tech, island campaign (liberate 12 sectors across 4 islands from an evil tribe). Target 13+. The GDD (`docs/GDD.md` v1.2) is the authority for mechanics and theme — **not** for technical structure.

## MVP scope — async multiplayer, not realtime

**Decided 2026-11-09 (Brandon): realtime multiplayer is NOT required for MVP.** MVP is **async multiplayer**: a turn with a long-period timer; at end of turn, notify the other/next player to proceed. Multiple concurrent games, across:

- **PvP** — human vs human, async turns.
- **PvE** — solo vs AI. Note: the solo vs-AI path already exists client-side (see below). Open question: does PvE need any async plumbing at all, or is it just the existing solo path?
- **Campaign (?)** — open question (Brandon's mark): does Campaign fit the async model, or is it solo mission progress that just needs cloud save? Don't assume; ask or propose.

Consequence: the persistent Socket.io arena server may be unnecessary for MVP. The async design is the next session's first decision (see "Outstanding — next session").

## Current state

- **Repo:** `bstockwelldev/primordial-tactics-web` (public, `main`). Scaffold is a full AI Studio app, not a skeleton: 6 screens (Base Camp, Island Campaign, Magitek Lab, Taming Expedition, Evolution Tree, Tactical Arena) + 4 modals (NPC Dialogue, AI Feedback, Roadmap, Multiplayer Lobby), Express + Socket.io arena server (`server.ts`, 8×6 grid, AP economy, 45s turns), Gemini NPC/coaching hooks.
- **Main is at `9c539ac`** (merge of PR #18, 2026-11-12). Production deploy `dpl_JBqwraou…` of that commit is READY.
- **PR #1, #2, #3 MERGED** (Vercel split wiring, handoff doc, handoff update).
- **PR #4 MERGED 2026-11-10:** async multiplayer (engine, API, Postgres store, My Games, push, timers), state-machine bot, single campaign payout.
- **PR #5 MERGED 2026-11-12:** arena attack controls above the board + range overlay, token art moved to `public/tokens`, My Games error reasons + Retry, `api/tsconfig.json` (removes the TS2688 build warning).
- **PRs #7-#11 MERGED 2026-11-12:** #7 difficulty report script + `docs/balance.md` baseline (`npm run balance`); #8 mobile gaps (fluid arena grid, resource bar on phones, 44px touch targets, token art 1MB -> ~50KB each); #9 taming (dart torpor uses defense via `dartTorporGain`, `consumeItem` replaces inventory mutation); #10 terrain (`moveApCost`: water +1 AP, mud -1 reach, flyers ignore; `ISLAND_TERRAIN` adds tiles to campaign arenas only; PvP/skirmish keep the plain arena); #11 balance (`src/game/balance.ts`: XP level curve 25*L*(L-1), XP now persisted as `pt_player_xp`, player squad +7.5%/level above 5, enemy growth 15% -> 9%/level, new game at 800 XP = level 6; also fixed a quoting bug from #10 that broke `tsc`).
- **PRs #12-#18 MERGED 2026-11-12:** #12 handoff update; #13 VAPID status; #14 PNG app icons (192/512 in the manifest, 180px `apple-touch-icon.png`); #15 handoff push verified; #16 **username** (editable "Your name" field in My Games; a rename also updates the name on waiting and in-progress games, finished games keep theirs; names are display names, not unique); #17 **open-games listing** (30 per page with `?before=<createdAt>` + `hasMore` and a Show more button, "posted 3h ago", open challenges expire after 7 days: hidden, join/preview return 410, and the daily sweep deletes them and reports `expired`; invite games never expire); #18 **game passwords** (optional, 4-64 chars, open or invite games, scrypt hash in `games.password_hash`, API exposes only `hasPassword`, 5 guesses per 15 min per game then 429, UI lock badge + inline prompt, password never in the invite link).
- **Live:** Vercel project `primordial-tactics-web` (team `brandon-stockwells-projects`) exists; `main` -> production at https://primordial-tactics-web.vercel.app, PR branches -> preview. Production deploy of `9c539ac` is READY (checked 2026-11-12; `/api/health` ok). Supabase project `primordial-tactics` (`cauddcsbsaskxjcaobxv`) is the single database (no preview DB).
- **Verified on production 2026-11-12 (by running):** `/api/health` returns `{"status":"ok"}`; token portraits load (8/8 images in the arena); arming Tranq Rifle in the arena shows the armed state and an out-of-range message. Earlier (PR #4): two-player game, timeout and resign against production.
- **Env status (names only):** Production has `POSTGRES_URL`, `CRON_SECRET` and the VAPID vars (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`). **Push verified end to end on desktop (2026-11-12):** after a production redeploy, `/api/push/key` returns a key, "Turn on notifications" subscribes, and a real notification arrived across two different browsers (this also confirms the private key and subject work). Preview scope was not re-checked. **Schema:** migrations `0001_async_multiplayer` and `0002_game_passwords` are applied to the single production Supabase project (no preview database, so apply a migration BEFORE merging code that needs it; keep them additive).
- **Connector limits:** the Vercel connector can list/read deployments and deploy, but gets 403 on env var read/write and project create. Env changes are a dashboard step.
- **Local run:** `bun install`, `bun run lint`, `bun run build`, `bun run test` verified in prior sessions; the 2026-11-12 slices were run with `npm install --legacy-peer-deps` + `npx tsx` (no bun on that machine): `tsc` clean, 63 tests pass, 6 Postgres skipped.

## Decisions (locked, do not relitigate without Brandon)

- **Stack:** web/React, browser-based, desktop + mobile, eventual seamless multiplayer. Unity 3D / C# disregarded for this version.
- **GDD is mechanics/theme authority, not technical structure.** FPS minigame = eventual roadmap idea, kept inside the tactical RPG experience for now.
- **Firebase/GCP scrapped 2026-11-09 (Brandon), deploy via Vercel.** Removal verified: nothing in `src/` imported the Firebase module; `firebase` dep + `src/lib/firebase.ts` + 3 config files deleted. Persistence is **localStorage-only by design**; cloud save is an open decision (Vercel KV / Postgres / Blob are options, none chosen).
- **Deployment split (option A, decided 2026-11-09, wired in PR #1):** Vercel hosts the static client; arena server on a small always-on host (Fly.io / Render / Railway). Rejected: B managed realtime (Ably/Pusher), C single host. Wiring: client reads the arena URL from `VITE_ARENA_URL` (`src/lib/api.ts` — unset = same-origin, so dev/single-host unchanged); server allows the Vercel origin via `ARENA_CORS_ORIGIN` (Socket.io + REST); server honors `process.env.PORT` (was hardcoded 3000).
- **Async multiplayer is the MVP** (above). Realtime is deferred, not dead.
- **Solo PvE and the taming loop are already built** (verified by full file reads 2026-11-09 — earlier docs claiming otherwise were wrong and corrected): arena solo mode with a client-side bot, campaign mission → arena → liberate; expedition → tranq darts → torpor → bait → chance roll → roster.
- **Class taxonomy:** GDD taxonomy (Blade/Skewer/Crush/Hulk/Human) is the design authority. The code's Striker/Tank/Scout/Siege/Controller are legacy aliases (`constants.ts` labels them as such; Scout = Blade alias). Alias cleanup is a code task, not a design decision.

## Env vars

| Var | Where | Purpose |
|---|---|---|
| `VITE_ARENA_URL` | Vercel dashboard (client) | Public URL of the arena server, e.g. `https://primordial-tactics-arena.fly.dev`. Unset = same-origin. Set once the arena host exists. |
| `ARENA_CORS_ORIGIN` | Arena host (server) | Comma-separated allow-list of client origins, e.g. the Vercel domain. Unset = `*` (dev default — tighten in production). |
| `GEMINI_API_KEY` | Arena host (server) | Gemini for NPC dialogue + match debrief. Unset = canned fallback replies. |
| `PORT` | Arena host (server) | Assigned by the host; server defaults to 3000. |
| `APP_URL` | (legacy, `.env.example`) | AI Studio artifact; not used by the Vercel deployment. |

`.env.example` still carries AI Studio comments and a redacted `GEMINI_API_KEY` value — refresh it when the arena host is chosen; do not copy the redacted value.

## Async multiplayer — built 2026-11-10, merged and live

Spec + as-built notes: `docs/async-multiplayer-spec.md`. Layout: `src/game/engine.ts` (pure match engine), `api/_lib/` (`app.ts` HTTP handler, `store.ts` interface + memory store, `postgresStore.ts`, `push.ts`, `runtime.ts`), `api/index.ts` (the Vercel function), `server.ts` (dev server mounting the same handler; Socket.io removed), `src/lib/asyncApi.ts` + `src/lib/push.ts` + `src/components/MyGamesModal.tsx` (client), `public/sw.js` + `public/manifest.webmanifest`.

Verified: `bun run test` (62 tests; the 6 Postgres ones need `TEST_POSTGRES_URL` pointing at an empty scratch database and are skipped otherwise), `bun run lint`, `bun run build`, and a two-browser Playwright run against Postgres 16 (create → invite link → join → moves → end turn → timeout → cron forfeit → resign → solo resume).

**Phone push:** iPhone 16 test reported "passable" by Brandon on 2026-11-12 (iOS needs Add to Home Screen, then launch from the icon). No detail was recorded, so treat iPhone push as only loosely verified: confirm the install, permission prompt and a real delivered notification, and note any gaps. Android is untested. **Not yet verified by running on production:** the password flow (create locked game, wrong/right password) and Show more paging against the real Supabase database and Vercel rewrite; the Postgres tests for slices 1-3 passed only on a local PGlite stand-in.

Local dev: `bun run dev` with no `POSTGRES_URL` uses an in-memory store (games vanish on restart); set `POSTGRES_URL` to use a real database.

## Outstanding — next session (in rough order)

1. **Async multiplayer design — done** (PR #4, spec in `docs/async-multiplayer-spec.md`).
2. **Vercel project — done.** VAPID env vars set in Production; desktop push verified, iPhone "passable" (details unrecorded), Android untested.
3. **Bot quality + double-liberate guard — done 2026-11-09**; **difficulty — mostly done 2026-11-12 (PR #11).** Per `docs/balance.md` (moderate-bot proxy, 200 seeds): `sector_primoris_2` 9% -> 80% at the starting level; other 3-enemy sectors ~52-100% at the expected level. **Still open (design calls, playtest first — bots are a proxy):** (a) the first mover wins only ~12% of mirrored bot matches, even for the easy bot — a rules-level tempo effect (closing distance costs AP, so the closer gets hit first); a quick one-time first-mover AP bonus gave erratic results because the bot assumes `maxAp`; needs design + human playtest, and matters for PvP; (b) `sector_caldera_1` and `sector_tempest_1` have only 2 enemies and are 100% at every level; (c) difficulty is steep: a player who skips ahead falls to ~0% quickly; (d) the default skirmish rival squad is much weaker than the player squad.
4. **Name: Primordial vs Primal.** Metadata/title/server strings say "Primal Tactics: Dinosaur Survival RPG"; repo + GDD say "Primordial". Brandon's call.
5. **First local run:** `bun install` (regen `bun.lock`), `bun run lint`, `bun run build`.
6. **Combat fidelity bugs (verified, in `docs/game-design-adaptation.md` gap 10):** class passives dead in server PvP only (`use_ability` drops class args); no `get_rooms` handler (lobby stale); turn timer tracked (45s) but never enforced.
7. **Taming details (gap 2) — done (PR #9).** Remaining: meat bait is not consumed when offered.
8. **Terrain (gap 6) — done for campaign arenas (PR #10).** Layout in `ISLAND_TERRAIN` is a placeholder design choice (Primoris water, Caldera mud, Magitek Core bones, Tempest open). PvP and skirmish keep the plain arena; the PvP engine has its own grid copy. Bot path planning is approximate with terrain.
9. **Mobile gaps — done (PR #8).** Remaining: arena tiles are ~34px wide at 375px (8 columns cannot reach 44px); on a phone the board starts below the fold (~740px of header/controls above it).
10. **Magitek (gap 7):** 5 augments catalogued in code (Cyber-Plasma Talons 4 cores, Kinetic Nanomesh Plating 5, Micro-Singularity Overdrive 6, Magitek Neural Uplink 4, Plasma Arc Emitter 7), equip/unequip with 50% refund — needs the GDD spec.
11. **GDD open threads:** finish the truncated Special Feature sentence ("Unscaled difficulty with permanent alterations based…" — cut off in v1.1, kept as-is in v1.2); AI features keep-or-cut; whether Primordial Tactics is the digital sibling of Primordia Survival or separate (ask, don't assume); level curve done (PR #11); tamed dinos still do not level (the squad scales with player level only).
12. **Cleanup:** package name was `react-example` (renamed in this PR); `.env.example` refresh (above); `.aistudio/artifacts/brain/` contents unexplored; `src/game/rules.test.ts` exists but there is no `test` script in `package.json` (`node --test` runs it directly).

## How to run / verify

- `bun install` → `bun run dev` (serves client + arena server same-origin on :3000) or `bun run build` + `bun run start`.
- `bun run lint` = `tsc --noEmit`. `bun run test` runs the rules and bot tests (`tsx --test`; plain `node --test` cannot resolve the imports).
- "Done" means verified by running, not trusted. For GitHub writes: this repo accepts `push_files` (the trees API works here, unlike tabletop-studio where it 403s). **Never re-push blind after a client-side timeout** — pushes can succeed server-side after timing out client-side (happened twice this session: docs push `d5fb9d8d` and split push `033a1e9f`); always verify with `list_commits` + byte sizes before retrying. **Never hand-build a push JSON with placeholder content** — an empty `content` string pushes an empty file (2026-11-09: an empty-content push wiped README + two docs; restored at `80817cb1`). Generate pushes from local files with a script and verify sizes.
- `get_file_contents` returns stale cached data and its `ref` accepts branches/tags only (not commit SHAs). `search_code` returns total 0 for this young repo even for strings known to exist — do not use search results as evidence; rely on files actually read.
- Approval gates: GitHub writes and production deploys need Brandon's explicit approval in chat. The Vercel project creation is the known exception already attempted (403, see above).

## Session prompt for Claude Cloud Agent

Paste this as the first message of the new session (after giving it the repo). It assumes the repo is the context and this file is its state:

> You are picking up Primordial Tactics, a browser-based tactical RPG with dinosaurs (React 19 + Vite + Tailwind + Express/Socket.io arena server), repo `bstockwelldev/primordial-tactics-web`. Read `docs/handoff.md` first — it is the state snapshot as of 2026-11-09: goal, locked decisions, PRs #1 (split wiring, merged) and #2 (handoff, merged), the blocked Vercel project creation (403 — manual dashboard step in the doc), and the outstanding list. Then read `README.md`, `docs/architecture.md`, `docs/game-design-adaptation.md`, and `docs/GDD.md` (v1.2).
>
> Overall goal: ship an MVP playable in a desktop or mobile browser: the existing solo PvE + taming + campaign loop, plus **async multiplayer** (not realtime — that was explicitly deferred). A turn has a long-period timer; at end of turn, notify the other/next player to proceed. Multiple concurrent games across PvP, PvE, and Campaign — with Campaign's fit still an open question (see the handoff doc) and PvE's async needs unclear (solo vs-AI already works client-side).
>
> Your first job: propose the async multiplayer design — persisted turn store (in-memory rooms die with the process), turn timer duration, notification mechanism, game list/lobby — and the deployment shape it implies (does the persistent Socket.io host survive, or do the stateless REST endpoints move to Vercel serverless functions?). Present the design with options and a recommendation, and wait for approval before building. Then, in order: (1) the Vercel project manual step if it still isn't created, (2) bot quality + double-liberate guard (the next playable slice), (3) the async turn system.
>
> Working rules: SPEC → review → lock → implement → verify; "done" means verified by running, not trusted. GitHub writes need the owner's explicit approval. Never re-push blind after a client-side timeout — verify server state first. Never hand-build a push with placeholder content. The GDD is the authority for mechanics/theme, not technical structure. Ask before deciding open questions (name Primordial vs Primal, PvE/Campaign async fit, AI features keep-or-cut); don't assume.
