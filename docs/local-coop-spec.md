# Local co-op / pass & play on the campaign — spec

Status: **LOCKED 2026-11-12** with the section 9 defaults, as chosen by Brandon. Nothing is built yet. Not yet confirmed: that pass & play (both people at one screen) is what Brandon wants rather than online co-op (see risks); the lock assumes it is. The GDD is the authority for mechanics and theme: it describes one player leading a character and companions, so this new mechanic should be recorded there (slice 5) if Brandon agrees.

## 1. Goal

Two people on one device play a campaign mission together against the bot, each commanding part of the party. One person hands the device to the other at the right moments (pass & play). No accounts, no server, no network.

Non-goals (v1):
- Online co-op. The async engine only does two-player PvP; online co-op is a separate project (see 8).
- Human-vs-human on one device. Same mechanism, but a different mode with different balance. Listed as a stretch in 8.
- More than two humans, spectators, voice, chat.
- A separate progression profile for the buddy.

## 2. How a solo mission works today (facts the design builds on)

- `buildSoloUnits` (`src/game/arenaSetup.ts`) creates the player side: a commander plus the first two tamed dinos, all with `isPlayer: true` and `ownerId: 'player_me'`, scaled by player level. The enemy side is the sector's squad, scaled by enemy level.
- `TacticalArenaView` runs solo turns with `soloIsPlayerTurn`. "End turn" hands over to `runBotTurn`, which plays the whole enemy side, then refreshes player AP.
- Every click handler gates on `unit.isPlayer` and `isMyTurn`. `checkWinCondition` (`src/game/rules.ts`) looks only at `isPlayer`.
- An in-progress match is a `SoloSave` in `localStorage` key `pt_solo_match` (`units`, `logs`, `turn`, `isPlayerTurn`). Resume restarts dice from a fresh seed.
- A won mission liberates the sector and pays XP and loot once, into the one local save.

The side flag (`isPlayer`) must keep meaning "the human side". Co-op adds a second dimension, which human controls which unit.

## 3. Design

### 3.1 Concept

The human side has two **slots**, 0 (the host, whose save it is) and 1 (the buddy). Each human-side unit has exactly one controlling slot. A round is:

1. Slot 0 phase: slot 0 spends AP on their units, then ends their phase.
2. Slot 1 phase: same for slot 1.
3. Enemy phase: the bot plays, exactly as today.
4. Player AP refreshes for all human-side units; the round counter increases.

Why sequential phases and not free order: handoffs are then two per round at known moments, the screen can show clearly whose units are active, and an accidental tap on the other player's unit does nothing. The game has no hidden information (everything is on the board), so the handoff needs no privacy screen, only a clear "pass the device" prompt.

A slot whose units are all dead is skipped. A slot with living units that cannot act can still end their phase immediately.

### 3.2 Splitting the party

A **Party setup** step before the mission starts:
- Buddy name (text, default "Buddy", same validation as player names).
- Each human-side unit shows a slot toggle. Rule: each slot controls at least one unit. Default split: host keeps the commander and first dino; buddy gets the guest commander and second dino (see Q1).
- A "Swap" shortcut and a one-tap "Reset to default".

### 3.3 Guest commander (default, see Q1)

The buddy gets a guest commander, a second Human-class unit built like the player's commander and scaled to the host's level. The host's tamed dinos are the shared pool, split between the slots in setup. This makes a party of 4 (2 commanders, 2 dinos) instead of 3.

### 3.4 Difficulty

A party of 4 against a 2-3 unit enemy squad is much easier. Enemy strength is therefore scaled for co-op by one knob, `BALANCE.coopEnemyScale` (stats multiplier), set with the existing simulator, not guessed:
- `src/game/sim.ts` plays a mission with the bot on both sides; extend it so the human side can be two bot-controlled slots.
- `npm run balance` gets a co-op table: per sector, win rate at the expected level, same method as today (Wilson 95% intervals).
- Target: 55-85% per campaign sector at the expected level with two moderate bots. The knob is tuned until every sector is in that band, and `docs/balance.md` records the result. A human pair will usually beat a bot pair, so the band is a floor, not a promise.

### 3.5 Rewards and progression

All rewards (XP, loot, sector liberation) go to the host's save, once, exactly as in solo play. The buddy gets nothing persistent in v1. The guest commander does not level and is not stored.

### 3.6 Win and lose

- Win: all enemies defeated (unchanged `checkWinCondition`, `isPlayer` side).
- Lose: all human-side units defeated.
- One slot wiped, the other alive: the match continues; the surviving player keeps playing and phases for the empty slot are skipped.

### 3.7 UI

- **Mode entry:** on mission start, a "Play with a buddy" toggle (off by default). Skirmish gets the same toggle (cheap, same code path).
- **Active slot indicator:** a banner "<Name>'s turn" in the active slot's colour; that slot's units get a ring, the other slot's units are dimmed and show their owner's name. Unit cards show an "Owner" chip.
- **Handoff overlay:** at each phase change, a full-screen "Pass the device to <Name>" with one large Ready button (44px+ touch target, works on a phone). Not shown for the enemy phase.
- **End turn:** the button reads "End <Name>'s turn" and only ends the active slot's phase.
- **Mobile:** the board already fits phones; the banner and overlay must not push the board further below the fold (the arena is already tall on 375px screens, see the handoff).

### 3.8 Persistence

`SoloSave` gains an optional `party` field:

```
party?: {
  names: [string, string];
  activeSlot: 0 | 1;
  phase: 'party' | 'enemy';
}
```

and units gain an optional `controller?: 0 | 1`. Absent means a solo save, so every existing save loads unchanged (back-compat is an acceptance criterion). Resuming a co-op save restores the active slot and shows the handoff overlay for it. Closing the app mid enemy phase works as today (the bot finishes).

## 4. Rules and engine changes (small)

- `UnitEntity.controller?: 0 | 1` (`src/types/game.ts`). `isPlayer` is unchanged.
- A pure helper `canControl(unit, activeSlot)` replaces the `unit.isPlayer` gate in the arena click, move and ability paths when a party is active; solo behaviour is identical (no party, slot 0 implied).
- `buildSoloUnits` accepts an optional party config and returns the guest commander and controller tags. `checkWinCondition`, the bot and the simulator keep using `isPlayer` and need no change for the bot's play.
- No server or API change. The async engine is untouched.

## 5. Acceptance criteria (each testable)

1. With no buddy toggle, a mission plays and saves exactly as before (existing tests pass unchanged; an old `pt_solo_match` save loads and resumes).
2. With the toggle, setup lets the host assign units to slots, rejects an empty slot, and starts the mission with the guest commander.
3. Only the active slot's units can move or use abilities; clicking the other slot's unit selects it for inspection only.
4. Ending a slot's phase moves to the other slot, then the enemy, then back; AP refreshes for all human-side units after the enemy phase; the round counter advances once per round.
5. A slot with no living units is skipped without a handoff prompt.
6. Win, lose and "one slot wiped, other continues" behave as in 3.6, including payout once to the host save.
7. A co-op match saved mid-phase resumes on the same slot after a reload.
8. `npm run balance` prints a co-op table and every campaign sector is inside the 55-85% band at the expected level.
9. The handoff overlay and banner are usable at 375px wide with 44px touch targets and do not hide the board.

## 6. Test plan

- Unit tests: `canControl`, phase advancement (including skipped slots), party split validation, win/lose, save round trip, back-compat load of an old save.
- Simulator: co-op match with two bot slots, deterministic seeds; assertions on the balance band.
- Browser (verified by running, as in earlier slices): start a co-op mission, play both phases on desktop and a 375px viewport, reload mid-phase, finish a mission and check the host save payout.
- Nothing here needs Postgres or Vercel.

## 7. Slices (one PR each, in order)

1. **Engine and rules:** `controller`, `canControl`, phase advancement and win handling, guest commander in `buildSoloUnits`, tests. No UI.
2. **Setup UI:** buddy toggle, party setup screen, active-slot banner and unit ownership chips, gating wired into the arena.
3. **Handoff and persistence:** handoff overlay, `SoloSave.party`, resume, mid-phase reload.
4. **Balance:** simulator support for two bot slots, `coopEnemyScale`, co-op table in `docs/balance.md`.
5. **Handoff doc:** update `docs/handoff.md` and the GDD note if Brandon wants the mechanic recorded there.

Slices 1 and 4 can be developed in parallel; 2 and 3 depend on 1.

## 8. Later (out of scope now)

- **Online co-op:** reuses the `controller` slot idea but needs the async engine to support a bot opponent and two human players. That is a larger server design (invite links, passwords and push already exist for PvP).
- **Human vs human on one device:** the enemy side becomes slot 2; needs its own balance (fixed default squads, as today's PvP).
- **Buddy profile:** a second local save so the buddy keeps XP and dinos.

## 9. Decisions (locked 2026-11-12; the Default column is the decision)

| # | Question | Default |
|---|---|---|
| Q1 | Party shape: add a guest commander (party of 4) or split the existing 3 units between the two players? | Guest commander plus the host's two dinos split. Splitting 3 units leaves one player with a single dino and no rifle. |
| Q2 | Turn order: sequential phases (slot 0, slot 1, enemy) or both humans act in any order in one shared phase? | Sequential phases. |
| Q3 | Rewards: all to the host, or XP shared? | All to the host save. |
| Q4 | Should the buddy bring their own dinos from their own roster? | No in v1; shared pool only. |
| Q5 | Include one-device human-vs-human in this work? | No, stretch only. |
| Q6 | Is the buddy toggle allowed on every campaign sector and skirmish, or campaign only? | Both. |

## 10. Risks

- **Difficulty:** an unbalanced party of 4 trivialises the campaign. Mitigation: simulator-gated tuning (criterion 8) before the mode ships.
- **Arena size:** `TacticalArenaView.tsx` is about 1,400 lines and already gates on `isPlayer` in many places. The `canControl` helper and tests in slice 1 keep that change auditable.
- **Co-presence:** pass & play needs both people at one screen. If the buddy is usually remote, online co-op (section 8) is the real feature and this mode is a stopgap. Worth confirming before building (Q-assumption in the review notes).
