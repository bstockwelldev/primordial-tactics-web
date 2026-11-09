# Async multiplayer — spec

Status: **design approved 2026-11-09 (Brandon: "proceed with your recommendations"); spec awaiting review before implementation.** Nothing in this document is built yet.

## Decisions

| # | Decision | Choice |
|---|---|---|
| 1 | Hosting | All on Vercel: static client + `/api/*` serverless functions + database. Supersedes the "option A" split (Vercel client + always-on arena host). No always-on host for MVP. |
| 2 | Turn store | Postgres on Supabase. |
| 3 | Turn timer | Per game: 8h / 24h / 72h, default 24h. Expiry auto-ends the turn; two consecutive timeouts by the same player forfeit. |
| 4 | Notifications | In-app "your turn" badge (polled) + Web Push. Email deferred. |
| 5 | PvP squads | Fixed default squads (as today). Own-roster PvP waits for cloud save. |
| 6 | PvE | No server. Client-side solo path stays; an in-progress solo match is saved to localStorage and listed in "My Games" as resumable. |
| 7 | Campaign | Solo progress, not async. Cloud save is a later item that reuses the same identity and database. |
| 8 | AI features | Set aside. The Gemini endpoints are not ported in this work; a follow-up pass decides the provider. |

Still open (not decided here): the name (Primordial vs Primal).

## Identity

No accounts for MVP. On first visit the client calls `POST /api/players` and stores `{ playerId, token }` in localStorage (`pt_player_id`, `pt_player_token`). The server stores only a SHA-256 hash of the token. Every game endpoint requires `Authorization: Bearer <token>` and resolves it to a player.

Known limit: clearing browser storage or switching device loses access to your games. A recovery code or email link is a later addition.

## Data model (Postgres)

```sql
players (
  id            uuid primary key,
  name          text not null,
  token_hash    text not null unique,
  created_at    timestamptz not null default now()
)

games (
  id                 uuid primary key,
  status             text not null,        -- waiting | in_progress | completed
  visibility         text not null,        -- open | invite
  host_id            uuid not null references players,
  guest_id           uuid references players,
  active_player_id   uuid references players,
  turn_number        int  not null default 1,
  turn_hours         int  not null default 24,   -- 8 | 24 | 72
  turn_deadline      timestamptz,
  host_timeouts      int  not null default 0,    -- consecutive
  guest_timeouts     int  not null default 0,
  winner_id          uuid references players,
  end_reason         text,                 -- elimination | forfeit | draw
  state              jsonb not null,       -- { units, actionLogs }
  version            int  not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
)
-- indexes: (host_id, status), (guest_id, status), (status, visibility), (status, turn_deadline)

push_subscriptions (
  endpoint     text primary key,
  player_id    uuid not null references players,
  keys         jsonb not null,
  created_at   timestamptz not null default now()
)
```

Tables are reached only from the serverless functions with a server-side key; row-level security stays enabled with no public policies, so the browser cannot query them directly.

**Concurrency.** Every write is `update games set ..., version = version + 1 where id = $1 and version = $2`. Zero rows updated means someone else wrote first: the function reloads and returns `409` with the fresh game. This covers double-submits and a timeout racing a move.

## API

All under `/api`, JSON, bearer token except where noted.

| Method | Path | Purpose |
|---|---|---|
| POST | `/players` | Create anonymous player (no auth). Body `{ name }`. Returns `{ playerId, token }`. |
| PATCH | `/players/me` | Rename. |
| GET | `/games` | My games: your-turn, waiting, finished (latest 20). |
| GET | `/games/open` | Open challenges I can join. |
| POST | `/games` | Create. Body `{ visibility, turnHours }`. |
| POST | `/games/:id/join` | Join an open game or one reached by invite link. Starts the match and the first deadline. |
| GET | `/games/:id` | Full state. Applies any overdue timeout first. |
| POST | `/games/:id/actions` | One action: `{ type: move \| ability \| end_turn \| resign, ..., version }`. |
| POST | `/push/subscribe` | Store a Web Push subscription. |
| GET | `/cron/sweep` | Daily Vercel cron (secret-protected): applies overdue timeouts, sends pending notifications. |

Caps: 10 active games per player; action log trimmed to the last 200 entries.

## Turn flow

- The action handler is the existing socket handler logic (`move_unit`, `use_ability`, `end_turn` in `server.ts`) moved into a pure module, `src/game/engine.ts`: `applyAction(game, playerId, action, rng) → { game, error? }`. It uses `rules.ts`, passes unit classes through (fixing the dead class passives in PvP), and takes its RNG as a parameter (dice stay on the server; tests are deterministic).
- Ownership is checked against the authenticated player, not a socket id.
- `end_turn` flips the active player, refreshes AP, ticks status effects, sets `turn_deadline = now + turn_hours`, resets the mover's consecutive-timeout count, and triggers the notification.
- The returning player sees the current board plus the log entries since their last turn. Animated replay is out of scope.
- Log timestamps become ISO strings (today they are server-locale `toLocaleTimeString()`).

## Timer

- Enforced lazily: any read or write of a game first checks `now > turn_deadline` and, if so, applies a timeout (auto end-turn, increment that player's consecutive count; at 2, forfeit). Correctness never depends on a scheduler.
- The daily cron exists only so abandoned games still resolve and the waiting player still gets notified. Daily is the Vercel Hobby limit; with a 24h default the worst case is a timeout being *noticed* up to a day late when neither player opens the game.

## Notifications

- **In-app:** the client polls `GET /games` every 30s while visible (and on focus). Navbar shows a count of games where it is your turn.
- **Web Push:** service worker + VAPID keys (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` env). Permission is requested from a button on the games screen, never on load. Sent on: your turn, game started (to host), game over. Dead subscriptions (404/410) are deleted.
- iPhone caveat: Web Push only works after the player adds the app to their Home Screen, so the app ships a web manifest and the games screen explains this on iOS.

## Client

- New **My Games** screen replaces `MultiplayerLobbyModal`: Your turn / Waiting / Finished, plus "New game" (open or invite link, timer choice) and "Open challenges".
- Invite link: `/?game=<id>`; opening it offers Join.
- `TacticalArenaView` gains a third source of match state (async game) beside solo; the socket-room branch is removed from the UI. Actions POST and re-render from the response; while it is the opponent's turn the view polls `GET /games/:id` every 15s.
- Solo matches (skirmish and campaign) persist to localStorage on each state change and appear in My Games as local entries.

## Deployment

- `vercel.json`: functions under `api/`, SPA rewrite narrowed so it no longer swallows `/api/*`, one cron entry.
- Env (Vercel): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`.
- `server.ts` remains the local dev server and mounts the same handler functions, so dev and production run one code path. The Socket.io handlers are deleted from `server.ts` (git history keeps them for the deferred realtime work); `socket.io` / `socket.io-client` are dropped. `VITE_ARENA_URL` / `ARENA_CORS_ORIGIN` become unused and are removed.
- The Gemini endpoints stay in `server.ts` (local dev only) until the AI follow-up. On Vercel the client's existing failure paths apply: no debrief modal, NPC fallback line.

## Build order

1. `engine.ts` extracted from the socket handlers, with tests (no behavior change beyond class passives + injectable RNG).
2. Schema migration + store module; players and games endpoints; timeout logic with tests against a fake clock.
3. My Games screen + arena wiring; in-app polling.
4. Web Push + manifest + cron.
5. Solo match persistence into My Games.
6. Remove socket layer; docs.

Each step is verified by running: unit tests, then two browser sessions playing a full game against a real database, including a forced timeout and a forfeit.

## Out of scope

Realtime play, spectating, chat beyond the action log, ranked/matchmaking rating, own-roster PvP, cloud save, accounts, email, animated turn replay.
