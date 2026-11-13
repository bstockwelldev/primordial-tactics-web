import { GridTile, UnitEntity } from '../types/game';
import { BotProfile, runBotTurn } from './bot';
import { checkWinCondition } from './rules';
import { createRng } from './rng';
import { SLOTS, refreshApFor } from './party';
import { PairResult, buildVersusUnits, hpShare, isVersusMatch, roundLimitWinner, scorePair } from './versus';
import { VERSUS_ROUND_LIMIT } from './balance';

/** Who pilots a side in a headless match: a bot profile, or nobody ('passive' never acts). */
export type Pilot = BotProfile | 'passive';

export interface SimResult {
  winner: 'player' | 'enemy' | 'draw' | 'unfinished';
  /** Full rounds played (player half + enemy half). */
  rounds: number;
  units: UnitEntity[];
}

/**
 * Plays a whole solo-rules match with no UI: player side first (slot 0 then slot 1 for a party), then the enemy,
 * AP refreshed at the start of each side's half-turn. Fully determined by `seed`.
 */
export function simulateMatch(opts: {
  units: UnitEntity[];
  grid: GridTile[];
  seed: number;
  player: Pilot;
  enemy: Pilot;
  maxRounds?: number;
}): SimResult {
  const rng = createRng(opts.seed);
  const versus = isVersusMatch(opts.units);
  const maxRounds = opts.maxRounds ?? (versus ? VERSUS_ROUND_LIMIT : 60);
  let units = opts.units.map((u) => ({ ...u, ap: u.maxAp }));

  const half = (side: 'player' | 'enemy', pilot: Pilot, round: number) => {
    units = units.map((u) => (u.isPlayer === (side === 'player') && u.hp > 0 ? { ...u, ap: u.maxAp } : u));
    if (pilot !== 'passive') {
      // A party (units with controllers on the player side) plays slot by slot, the way two people
      // sharing a device do; a solo squad plays in one go, exactly as before.
      const slots = side === 'player' && units.some((u) => u.isPlayer && u.controller !== undefined) ? SLOTS : [undefined];
      for (const controller of slots) {
        units = runBotTurn(units, opts.grid, round, rng, { profile: pilot, side, controller, timestamp: '' }).units;
        if (checkWinCondition(units).isOver) break;
      }
    }
    return checkWinCondition(units);
  };

  // Versus: both sides are human-controlled squads. Slot 0 (side A) plays, then slot 1 (side B), each
  // refreshed at the start of its own phase. `player` pilots side A and `enemy` pilots side B. At the
  // round limit the larger share of max HP remaining wins.
  if (versus) {
    for (let round = 1; round <= maxRounds; round++) {
      for (const slot of SLOTS) {
        units = refreshApFor(units, slot);
        const pilot = slot === 0 ? opts.player : opts.enemy;
        if (pilot !== 'passive') {
          units = runBotTurn(units, opts.grid, round, rng, { profile: pilot, side: slot === 0 ? 'player' : 'enemy', controller: slot, timestamp: '' }).units;
        }
        if (checkWinCondition(units).isOver) {
          const aAlive = units.some((u) => u.isPlayer && u.hp > 0);
          const bAlive = units.some((u) => !u.isPlayer && u.hp > 0);
          return { winner: aAlive ? 'player' : bAlive ? 'enemy' : 'draw', rounds: round, units };
        }
      }
    }
    const w = roundLimitWinner(units);
    return { winner: w === 0 ? 'player' : w === 1 ? 'enemy' : 'draw', rounds: maxRounds, units };
  }

  for (let round = 1; round <= maxRounds; round++) {
    for (const side of ['player', 'enemy'] as const) {
      const check = half(side, side === 'player' ? opts.player : opts.enemy, round);
      if (check.isOver) {
        const playerAlive = units.some((u) => u.isPlayer && u.hp > 0);
        const enemyAlive = units.some((u) => !u.isPlayer && u.hp > 0);
        return { winner: playerAlive ? 'player' : enemyAlive ? 'enemy' : 'draw', rounds: round, units };
      }
    }
  }
  return { winner: 'unfinished', rounds: maxRounds, units };
}

/**
 * A versus best-of-two with sides swapped: player A's squad moves first in game 1, player B's squad
 * in game 2 (different seeds). Returns the scored pair. `a` and `b` are the two players' pilots.
 */
export function simulatePair(opts: { picksA: readonly string[]; picksB: readonly string[]; grid: GridTile[]; seed: number; a: Pilot; b: Pilot }): PairResult {
  const game = (first: 'a' | 'b') => {
    const [slot0, slot1] = first === 'a' ? [opts.picksA, opts.picksB] : [opts.picksB, opts.picksA];
    const r = simulateMatch({
      units: buildVersusUnits(slot0, slot1),
      grid: opts.grid,
      seed: opts.seed * 2 + (first === 'a' ? 0 : 1),
      player: first === 'a' ? opts.a : opts.b,
      enemy: first === 'a' ? opts.b : opts.a,
    });
    const slotWinner = r.winner === 'player' ? 0 : r.winner === 'enemy' ? 1 : null;
    const aSlot = first === 'a' ? 0 : 1;
    const shareA = hpShare(r.units, aSlot);
    const shareB = hpShare(r.units, aSlot === 0 ? 1 : 0);
    return {
      winner: slotWinner === null ? ('draw' as const) : slotWinner === aSlot ? ('a' as const) : ('b' as const),
      margin: shareA - shareB,
    };
  };
  return scorePair([game('a'), game('b')]);
}
