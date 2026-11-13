# Local versus (pass & play) — spec

Status: **LOCKED 2026-11-13** with the section 9 defaults, as chosen by Brandon. Nothing is built. Two items stay open by design and are settled with data, not opinion: the first-mover compensation knob (Q3, slice 2, after a human playtest) and the exact template multipliers (slice 2). This is the milestone Brandon set after local co-op (`docs/local-coop-spec.md`, built and merged): two people on one device, each drafts a side from a common level-balanced pool so the field is even. **For fun only: it never touches campaign progression, XP, loot, saved rosters or the solo save.**

The GDD is the authority for mechanics and theme; it does not describe a versus mode, so this is a new mechanic (record it there only if Brandon wants).

## 1. Goal

Two people share a device and fight each other on the arena grid. Each picks three units from the same pool of identical-level templates, so the match is decided by choices and play, not by whose save is stronger. No account, server or network.

Out of scope: online versus (the async PvP engine already exists, `src/game/engine.ts`, but has its own rules copy and no pool), ranked play, a bot opponent in this mode (solo skirmish covers that), campaign rewards, tamed dinos from the player's save, spectators.

## 2. Facts the design builds on

- Co-op already gave units a `controller?: 0 | 1` and `src/game/party.ts` (`canControl`, `livingSlots`, `nextPhase`, `isHumanControlled`). `isHumanControlled = unit.isPlayer || unit.controller !== undefined` was written so an enemy-side unit with a controller counts as human. Versus uses that: side A = `isPlayer: true`, side B = `isPlayer: false` with `controller: 1`.
- `HandoffOverlay`, `PartySetupModal`, `readSoloSave`, the phase banner and inspect-only gating exist and are reusable.
- Species available: Velociraptor (160 HP / 48 atk / 16 def / speed 4), Triceratops (290/34/38/2), Pteranodon (140/42/14/5, flies), Ankylosaurus (270/44/45/2), Dilophosaurus (170/40/18/3), plus the Human commander (200/42/22/3). Classes: Blade, Skewer, Crush, Human, each with passives. Stat growth by level exists in `src/game/balance.ts` (`playerLevelScale`, 1.0 at level 5).
- The simulator (`src/game/sim.ts`, `npm run balance`) plays a match headlessly with bots on both sides, deterministic by seed; it plays a mirrored match today.
- **First-mover finding, stated carefully:** `docs/balance.md` shows the side that moves first wins only about 12% of mirrored moderate-bot matches. So the *second* mover has a large edge (about 88%), a tempo effect: closing distance costs AP, so whoever closes first gets hit first. The co-op spec's "first-mover edge ~12%" wording read the other way round; this is the correct reading. It is a bot result, not a human one, but a versus mode starts from a known bias and must fix it (section 3.5).

## 3. Design

### 3.1 Match flow

1. **Setup:** both names, then the draft (3.3). Plain arena (no island terrain), mirrored deployment: side A on the left two columns, side B on the right two, same rows.
2. **Play:** alternating phases, A then B then A, no bot phase. The round counter advances after B. The handoff overlay appears at every phase change. A side with no living units ends the match immediately.
3. **End:** the other side wins. Round limit (default 25): the side with the higher percentage of total max HP remaining wins; equal is a draw. A result screen offers Rematch (same draft), New draft, and Quit; nothing is written to the player's progress.

### 3.2 The pool

Six templates, the same for both players: the five species and the Human commander. Each is the species' base stats (scale 1.0, level 5) times a per-template tuning multiplier from a table (`VERSUS_TEMPLATES` in `src/game/balance.ts`, same idea as `COOP_SECTOR_SCALE`). No player level, no saved dino stats and no equipment are read, which is what makes it level-balanced and keeps it away from progression. Abilities are the species' innate set.

### 3.3 Draft: blind simultaneous pick

Each player picks **3 distinct templates** from the pool of 6; both may pick the same template (a mirror is fine). Picks are hidden from the other player: Player 1 picks, confirms, the device is handed over (reusing the handoff overlay), Player 2 picks, then both squads are revealed at once and the match starts. There is no alternating draft because that needs the second drafter to see the first's choices, an information edge on top of the tempo edge in 3.5.

### 3.4 Even field: how "balanced" is proven

A template is balanced when it neither wins nor loses a lot more than its share. The simulator plays many random drafts (each side picks 3 distinct templates uniformly), then for each template computes the win rate of squads that contain it. Target: every template inside 45-55% (95% Wilson interval touching the band is acceptable), after the first-mover fix in 3.5 is in. Per-template multipliers are tuned until that holds. Co-op taught that a stat multiplier can have a cliff (one sector jumped from 92% to 50% in a 0.001 step), so the tuning may use hp and attack separately and the tolerance is deliberately not exact.

### 3.5 Who moves first

The sim says the second mover wins about 88% of mirrored matches. Options, with the one I recommend first:

1. **Compensate the first mover** with one tuned knob and prove it in the simulator until a mirrored match is 45-55%. Candidates: one extra AP for side A in round 1 only (the earlier trial gave erratic results because the bot assumed `maxAp`; the sim and bot must read current `ap`), or a deployment depth difference (A deploys one column forward). Pick by data.
2. **Best of two, sides swapped** as the shipped answer if no single knob gets inside the band: each player moves first once, the result is the pair. Simple and fair, but doubles the match length.
3. **Coin flip only.** Cheapest; leaves a known ~76-point swing to luck. Rejected unless the data shows the human game does not have the bias.

*As built (slice 2, 2026-11-13):* no knob works, so the shipped answer is option 2, **best of two with sides swapped** (`scorePair`, `simulatePair`). Measured over all 20 possible squads against themselves, the first mover's win rate ranges from 0% to 98% (mean distance from 50%: 24 points), and a round-1 AP bonus of -1, +1 or +2 left that at 28, 20 and 26 points: the bias runs both ways (mobile squads favour the second mover, tanky squads the first), so no single compensation can cancel it. The skirmish figure of ~12% was one squad, not a general rule. A pair is won by more game wins; at one win each the larger total HP-share margin wins; equal is a draw. Matches end around round 10, so the round limit is not the cause.

Because the bias was measured on bots, require a short human playtest before locking the knob. Who is Player 1 (and so moves first) is chosen by a visible coin flip.

### 3.6 Fairness of information

There is no hidden state during play (everything is on the board), as in co-op. The only secret is the draft, handled by blind picks and the handoff. The pick screen must not show the other player's choices on screen or in history; the other player's picks live only in component state until the reveal, and are not written to `localStorage` before the match starts.

### 3.7 UI

- **Entry:** "Versus" card beside Play with a buddy / Skirmish in the arena (name to be chosen; it must not read as PvP-online). Distinct from async PvP in My Games.
- **Draft screen:** six template cards with portrait, class, HP/attack/defense/speed, abilities; pick three; confirm. 44px touch targets, works at 375px.
- **In play:** the co-op banner and ownership chips, with each side's own colour (emerald and sky already exist), the other side's units inspect-only, End Turn reads "End <Name>'s turn", handoff overlay between phases.
- **Result:** winner, rounds, each side's squad, Rematch / New draft / Quit.

### 3.8 Persistence

A match in progress can be saved so a reload resumes it, but it is stored under its own key (`pt_versus_match`), never `pt_solo_match`, so it cannot be offered for Resume as a campaign mission, cannot be overwritten by one, and cannot pay out. Draft state is not saved: a reload during the draft restarts the draft. The saved match carries `mode: 'versus'`, both names, the units (which carry `controller`), the active slot and the round. `readSoloSave`-style validation rejects anything malformed. My Games lists it separately ("Versus (this device)").

## 4. Rules and engine changes

- **Phases without a bot:** `nextPhase` currently always inserts `'enemy'` after the last human slot. Versus has no bot units, so the `'enemy'` phase must appear only when a living unit is bot-controlled (`!isPlayer && controller === undefined`). Otherwise the match would wait for a bot that does not exist.
- **Bots must not drive side B.** `runBotTurn` selects its units by `isPlayer` (side `enemy` = `isPlayer === false`). A side-B unit with a `controller` would be taken over by the bot. The bot (and `sim.ts` half-turns) must skip human-controlled units. This is the main trap.
- **AP refresh per side:** today human-side AP refreshes after the enemy phase. In versus each side's units refresh at the start of that side's own phase; the first phase starts with full AP. (Same function, parameterised by whose phase begins.)
- **Win and result mapping:** `checkWinCondition` is by `isPlayer` side already; the arena's "winnerId === 'player_me'" assumption becomes a side/slot result, and **`recordMatchResult` is not called in versus** (no XP, loot, liberation, stats).
- **Targeting and "ally" checks:** audit every `isPlayer` use (arena: 26 places, `rules.ts`, `bot.ts`, `engine.ts`, `arenaSetup.ts`) for "other side = enemy" assumptions that break with two human sides: ability `targetType`, tile highlights, token colours, inspect labels ("Ally" / "Rival" become the player names).
- **Templates and setup:** `buildVersusUnits(namesAndPicks)` in `arenaSetup.ts` builds both squads from `VERSUS_TEMPLATES` on a mirrored layout; no dependence on `tamedDinos`, `playerLevel` or sectors.
- **Simulator:** `simulateMatch` already takes two pilots; it needs the human-controlled-unit skip above, the per-side AP refresh, and a random-draft harness plus a template win-rate table in `npm run balance`.

## 5. Acceptance criteria (each testable)

1. Versus, co-op, solo skirmish and campaign are all unchanged: existing tests pass and an old `pt_solo_match` save still loads.
2. Both players pick three distinct templates; fewer or duplicates within one squad are rejected; the same template across the two players is allowed.
3. Player 2's screen never shows Player 1's picks before the reveal, and nothing about the picks is in `localStorage` before the match starts.
4. Phases alternate A, B with the handoff overlay each time and no bot phase; a side with no living units loses immediately.
5. A bot never moves a side-B unit (regression test in `bot` and `sim`).
6. No XP, loot, liberation, stats or save of the player's profile changes after a versus match; a saved versus match is never offered by Resume for a campaign mission.
7. Round-limit and draw handling as in 3.1.
8. `npm run balance:versus` prints the move-order measurements, every template's win rate across random draft pairs inside 45-55% (met 2026-11-13, see `docs/balance-versus.md`), and the squad-combination spread. The best-of-two fallback is in force (no single knob works, see 3.5). *As built:* a separate file, `docs/balance-versus.md`, because `docs/balance.md` is regenerated whole by `npm run balance`.
9. The draft screen, banner and overlay are usable at 375px with 44px touch targets and do not hide the board.
10. A reload mid-match resumes the same side's phase (with the handoff overlay); a reload mid-draft restarts the draft.

## 6. Test plan

- **Unit:** `nextPhase` with and without bot units; bot skips human-controlled enemy-side units; `buildVersusUnits` (mirrored positions, no shared ability objects, no player-save inputs); draft validation; round-limit winner; versus save validation (key, mode, malformed cases).
- **Simulator:** deterministic mirrored matches; random-draft harness; assertions that the first-mover rate and each template's win rate stay inside their bands (a drift guard with a loose tolerance, as in co-op; `npm run balance` is the real check).
- **Browser:** the full flow at desktop and 375px with the privacy check for the draft, the handoff between phases, reload mid-match and mid-draft, and a check that profile data and `pt_solo_match` are untouched.
- **Human playtest** (required before the first-mover knob and templates are locked): two people, a handful of matches, record which templates feel dominant or useless.

## 7. Slices (one PR each, in order)

1. **Engine and sim:** `nextPhase` without a bot phase, the bot-skip fix, per-side AP refresh, `buildVersusUnits` with a first draft of `VERSUS_TEMPLATES`, random-draft harness. No UI.
2. **Balance:** first-mover fix chosen by data, template tuning to 45-55%, versus table in `docs/balance.md`. May be re-run after the playtest.
3. **Draft and play UI:** entry, draft screen with blind picks and handoff, in-play banner and chips for two human sides, result screen, no payout.
4. **Persistence:** `pt_versus_match`, resume with handoff, My Games entry.
5. **Docs:** handoff update and the GDD note if Brandon wants it.

*As built (slice 3, 2026-11-13):* a "Versus" button beside "Play with a buddy" (fresh skirmish only, never from a campaign sector) opens `VersusDraft`: names, Player 1 picks, a full-screen pass screen that shows none of the picks, Player 2 picks, then both squads and a coin flip are revealed together. Picks live only in component state (checked: `localStorage` is byte-identical through the whole draft). The match is the best of two (`src/game/versusSeries.ts`, pure and tested): game 1 puts the coin-flip winner on side A, game 2 swaps sides, `VersusResult` shows the hand-over to game 2 and then the pair result with Rematch / New draft / Quit. In play, the co-op banner, handoff overlay and inspect-only gating are reused, tokens are emerald and sky (no red), End Turn reads "End <Name>'s turn", and the round limit (25) ends a game after both sides finish round 25. Versus never calls `recordMatchResult` (no XP, loot, liberation) and never writes `pt_solo_match`; persistence is slice 4, so a reload mid-versus currently returns to the skirmish. Browser-verified at desktop and 375px: pass-only game to the limit (draw), a real fight to a wipeout (round 5), game 2 with swapped sides, pair result, XP untouched.

*As built (slice 4, 2026-11-13):* `src/game/versusSave.ts` (`pt_versus_match`, `readVersusSave` validates mode, names, picks, results against the game number, the exact unit ids and controllers, health, and that a live game has both sides standing). The arena saves a started match under that key on every change (never `pt_solo_match`), removes it when the pair finishes or the player quits or starts a new draft, and does not save the draft. Resume is only from My Games, "Versus (this device)" (not on entering the arena, so a stored match never hijacks a fresh skirmish); it restores round, side and log and shows the handoff overlay, and a game 1 that had just ended resumes at its result panel with "Start game 2". Starting a new Versus asks before replacing a saved one. Browser-verified: reload mid-game then resume, reload at a finished game 1 then game 2 then pair result (save removed), Quit removes the save, `pt_solo_match` byte-identical throughout, XP unchanged.

Slices 1 and 2 first, since the pool and the first-mover fix decide whether the mode is worth building UI for. Slice 3 depends on 1.

## 8. Later (out of scope now)

- Online versus on the async engine, with the same pool and draft (needs a hidden-pick protocol on the server).
- A bot opponent that drafts (reuses the pool and the sim).
- Larger pools, map choice, team sizes other than 3, a points-based draft.
- Seasons, ladders, unlockable templates (would break "for fun only").

## 9. Decisions (locked 2026-11-13; the Recommended default column is the decision)

| # | Question | Recommended default |
|---|---|---|
| Q1 | Draft format | Blind simultaneous pick of 3 distinct templates from a shared pool of 6 |
| Q2 | Level balancing | Fixed level-5 stats times a tuned per-template multiplier; no saved stats or equipment |
| Q3 | First-mover fairness (knob chosen in slice 2 from data, then confirmed by playtest) | One tuned compensation knob proven in the sim (round-1 AP or deployment depth); best of two with sides swapped if no knob works; human playtest before locking |
| Q4 | Win rule at the round limit | 25 rounds, then higher share of total max HP remaining; equal is a draw |
| Q5 | Terrain | Plain arena, mirrored deployment |
| Q6 | Persistence | Separate `pt_versus_match` key; draft not saved |
| Q7 | Squad size and duplicates | 3 each; no duplicates within a squad, duplicates across squads allowed |
| Q8 | Name of the mode | "Versus" (placeholder) |

## 10. Risks

- **Tempo bias** (3.5): the largest. If no single knob gets a mirror match inside 45-55%, the best-of-two fallback doubles match length, which may feel slow at one device. The bias was measured on bots; a human playtest could show a different size.
- **Bot takeover trap** (section 4): forgetting the human-controlled skip makes the bot play side B, silently. Covered by criterion 5.
- **Too few templates:** six templates and 20 possible squads each can still have a solved "best pick". The sim catches dominant templates, not dominant *combinations*. *Measured (slice 2):* templates are even (47-56%) but squad combinations are not: the best squad (velociraptor, ankylosaurus, dilophosaurus) wins 84% of pairs and the worst (velociraptor, pteranodon, dilophosaurus) 11%. Composition matters far more than any single unit; this is the open balance item to playtest, and a fix (a point budget, a role rule, or a smaller pool) needs a decision.
- **Cliff-edge tuning:** stat multipliers can jump a win rate by tens of points in a tiny step (seen in co-op). The band is a target, not a guarantee, and the template table needs re-tuning if species stats, abilities or the damage formula change.
- **Privacy on a shared screen:** a screenshot, browser back, or a reload mid-draft can leak or lose picks. The design accepts a restart on reload and keeps picks out of storage.
- **Scope creep:** every item in section 8 is tempting; none is needed to learn whether blind-draft versus is fun.
