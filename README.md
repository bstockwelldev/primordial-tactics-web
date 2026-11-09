# Primordial Tactics

A browser-based tactical RPG with dinosaurs. Turn-based grid combat, dino taming, base building, and an island campaign — React on the front, a real-time arena server on the back, Firebase for data. Multiplayer sessions are the eventual goal; the arena already plays PvP over WebSockets.

- **Design authority:** [`docs/GDD.md`](docs/GDD.md) — game design, v1.2 cleaned. The GDD guides mechanics and theme; the repo is authoritative for technical structure.
- **What's left to adapt:** [`docs/game-design-adaptation.md`](docs/game-design-adaptation.md) — every gap between the design and this version, with the decision each one needs.
- **Technical notes:** [`docs/architecture.md`](docs/architecture.md) — runtime, state model, multiplayer readiness.

## Stack

- Client: React 19, Vite 8, Tailwind CSS 4, TypeScript
- Server: Express + Socket.io on Bun (`server.ts`), port 3000
- Data: Firebase (Firestore + Auth), Gemini API for NPC dialogue and match coaching
- Package manager: Bun (`bun.lock`)

## Quickstart

Prerequisites: Bun, a Firebase project (config in `firebase-applet-config.json`), and `GEMINI_API_KEY` for the AI features — optional; the server falls back to canned replies without it.

```sh
bun install
cp .env.example .env   # set GEMINI_API_KEY and APP_URL
bun run dev            # app + arena server on http://localhost:3000
```

Scripts: `dev` / `start` (`tsx server.ts`), `build` (`vite build`), `preview`, `lint` (`tsc --noEmit`). There is no test script yet — `src/game/rules.test.ts` exists but no runner is wired up.

> First local run from a clean checkout has not been verified yet — confirm install, lint, and build on first run.

## Screens

Base Camp, Island Campaign, Magitek Lab, Taming Expedition, Evolution Tree, Tactical Arena — plus NPC Dialogue, AI Feedback, Roadmap, and Multiplayer Lobby modals.

## Combat (as built)

- 8×6 grid, Manhattan movement, 3 AP per unit per turn; moving costs 1 AP per 2 tiles (min 1)
- Damage: attack vs `defense / (defense + 50)` mitigation, terrain defense bonuses, crits (15% base; Blade/Striker 30% at 1.75×)
- Torpor: tranq damage builds torpor; a dino is tamable at ≥80% torpor; bait (meat +25%, kibble +50%) raises tame chance
- Evolution: one branch per dino, gated on level + amber
- Win: eliminate the enemy squad (draws possible)

See `src/game/rules.ts` — the rules engine is the combat authority.

## Status

Scaffold stage — one commit beyond init (2026-11-09). The arena server, combat rules, and all six screens exist. Progression persists to localStorage only (Firestore sync is designed but not wired); the campaign-to-arena flow and an AI opponent are not built yet. Full gap list: [`docs/game-design-adaptation.md`](docs/game-design-adaptation.md).

## Name note

Repo and GDD say **Primordial Tactics**; app metadata, the HTML title, and server strings say **Primal Tactics**. One name to be picked — see the adaptation doc.
