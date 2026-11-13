import { GridTile, UnitEntity } from '../types/game';
import { BotProfile, runBotTurn } from './bot';
import { checkWinCondition } from './rules';
import { createRng } from './rng';
import { SLOTS } from './party';

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
  const maxRounds = opts.maxRounds ?? 60;
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
