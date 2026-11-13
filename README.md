# Primordial Tactics

A browser-based tactical RPG with dinosaurs. Turn-based grid combat, dino taming, base building, and an island campaign — React on the front, a real-time arena server on the back. Solo play against an AI rival works today; multiplayer sessions are the eventual goal.

- **Design authority:** [`docs/GDD.md`](docs/GDD.md) — game design, v1.2 cleaned. The GDD guides mechanics and theme; the repo is authoritative for technical structure.
- **What's left to adapt:** [`docs/game-design-adaptation.md`](docs/game-design-adaptation.md) — every gap between the design and this version, with the decision each one needs.
- **Technical notes:** [`docs/architecture.md`](docs/architecture.md) — runtime, state model, deployment, browser interface (desktop + mobile).

## Stack

- Client: React 19, Vite 8, Tailwind CSS 4, TypeScript
- Server: `/api/*` — one handler (`api/_lib/app.ts`) run as a Vercel function in production and by `server.ts` (Express) in dev. Async PvP: players, games, turn timers, push.
- Deploy: Vercel — static client plus one serverless function for `/api/*`. See [Deployment](#deployment).
- Data: solo progress in localStorage; async PvP games in Supabase Postgres (`POSTGRES_URL`; in-memory when unset in dev). See `docs/async-multiplayer-spec.md`.
- Package manager: Bun (`bun.lock`)

## Quickstart

Prerequisites: Bun.

```sh
bun install
cp .env.example .env   # set the values you need (see the file's comments)
bun run dev            # app + arena server on http://localhost:3000
```

Scripts: `dev` / `start` (`tsx server.ts`), `build` (`vite build`), `preview`, `lint` (`tsc --noEmit`), `test` (`tsx --test src/game/*.test.ts`).

> First local run from a clean checkout has not been verified yet — confirm install, lint, and build on first run.

## Screens

Base Camp, Island Campaign, Magitek Lab, Taming Expedition, Evolution Tree, Tactical Arena — plus Roadmap and My Games (async PvP, local co-op and versus) modals.

## Combat (as built)

- 8×6 grid, Manhattan movement, 3 AP per unit per turn; moving costs 1 AP per 2 tiles (min 1)
- Damage: attack vs `defense / (defense + 50)` mitigation, terrain defense bonuses, crits (15% base; Blade/Striker 30% at 1.75×)
- Torpor: tranq damage builds torpor; a dino is tamable at ≥80% torpor; bait (meat +25%, kibble +50%) raises tame chance
- Evolution: one branch per dino, gated on level + amber
- Win: eliminate the enemy squad (draws possible)
- Solo mode: opening the arena without a room starts a vs-AI skirmish — campaign missions load the sector's enemy squad, otherwise default rivals. Class passives fire in solo mode.

See `src/game/rules.ts` — the rules engine is the combat authority.

## Deployment

Everything deploys to Vercel: the static Vite client, one serverless function (`api/index.ts`) for `/api/*`, and a daily cron that sweeps expired turn timers. Game data lives in Supabase Postgres (`POSTGRES_URL`). There is no always-on host; the realtime Socket.io arena was removed 2026-11-10 in favour of async multiplayer. Not yet deployed — see `docs/handoff.md` for the go-live steps.

## Browser interface (desktop + mobile)

Desktop and mobile browsers are both in scope. The views already use responsive Tailwind breakpoints (single-column stacking below `lg`, scrollable nav tabs), but the arena grid has a 620px minimum width (horizontal scroll on phones), the resource bar hides below `lg`, and most buttons are below the 44px touch target. Full inventory: `docs/architecture.md` — Browser interface.

## Status

Scaffold stage (2026-11-09). The arena server, combat rules, all six screens, the solo vs-AI path, and the taming loop exist. Progression persists to localStorage only; there is no cloud save (Firebase removed). Full gap list: [`docs/game-design-adaptation.md`](docs/game-design-adaptation.md).

## Name note

Repo and GDD say **Primordial Tactics**; app metadata, the HTML title, and server strings say **Primal Tactics**. One name to be picked — see the adaptation doc.
