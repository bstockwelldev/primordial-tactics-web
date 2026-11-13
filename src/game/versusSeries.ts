import type { UnitEntity } from '../types/game';
import { VERSUS_ROUND_LIMIT } from './balance';
import { Slot, isHumanControlled, livingSlots } from './party';
import { PairGame, PairResult, buildVersusUnits, hpShare, roundLimitWinner, scorePair } from './versus';

// A local versus match is a best of two with sides swapped (docs/local-versus-spec.md, 3.5): the same
// two squads play twice and each player moves first once. This is the pure state of that pair, shared
// by the arena screen and its tests. "Player" 0/1 is a person; "slot" 0/1 is a side of the board
// (slot 0 = side A, moves first). Players swap slots between game 1 and game 2.

export type Player = 0 | 1;

export interface VersusSeries {
  /** Player names, indexed by player. */
  names: [string, string];
  /** Each player's squad (template ids), indexed by player. Never stored: it lives in component state. */
  picks: [string[], string[]];
  /** The player who moves first in game 1 (the coin flip). */
  first: Player;
  game: 1 | 2;
  /** Finished games, as seen from player 0 (`a`) and player 1 (`b`). */
  results: PairGame[];
}

export function startSeries(names: [string, string], picks: [string[], string[]], first: Player): VersusSeries {
  return { names, picks, first, game: 1, results: [] };
}

/** The board side a player commands in the current game. */
export function slotOf(series: VersusSeries, player: Player): Slot {
  const movesFirst = series.game === 1 ? series.first : ((1 - series.first) as Player);
  return player === movesFirst ? 0 : 1;
}

/** The player who commands a board side in the current game. */
export function playerAt(series: VersusSeries, slot: Slot): Player {
  return slotOf(series, 0) === slot ? 0 : 1;
}

/** Names indexed by board side, which is what the arena's party banner and overlay use. */
export function namesBySlot(series: VersusSeries): [string, string] {
  return [series.names[playerAt(series, 0)], series.names[playerAt(series, 1)]];
}

/** The units for the current game: side A is whoever moves first. */
export function unitsForGame(series: VersusSeries): UnitEntity[] {
  return buildVersusUnits(series.picks[playerAt(series, 0)], series.picks[playerAt(series, 1)]);
}

/** Has the game ended on the board: a side wiped out (the other wins, both = draw), else null. */
export function boardWinner(units: UnitEntity[]): Slot | 'draw' | null {
  const living = livingSlots(units.filter((u) => isHumanControlled(u)));
  if (living.length === 0) return 'draw';
  if (living.length === 1) return living[0];
  return null;
}

/** After a side's phase: has the round limit been reached (the last side of round `round` just finished)? */
export const roundLimitReached = (round: number, newRound: boolean): boolean => newRound && round >= VERSUS_ROUND_LIMIT;

/** The finished game, seen from player 0 and player 1 (margin is player 0's HP share minus player 1's). */
export function gameResult(series: VersusSeries, units: UnitEntity[], bySlot: Slot | 'draw'): PairGame {
  const slot0 = slotOf(series, 0);
  const slot1 = slotOf(series, 1);
  return {
    winner: bySlot === 'draw' ? 'draw' : bySlot === slot0 ? 'a' : 'b',
    margin: hpShare(units, slot0) - hpShare(units, slot1),
  };
}

/** The winner when the round limit ends the game: more HP share left; equal is a draw. */
export const limitWinner = (units: UnitEntity[]): Slot | 'draw' => roundLimitWinner(units);

/** Records a finished game; moves to game 2 after game 1. */
export function recordGame(series: VersusSeries, game: PairGame): VersusSeries {
  return { ...series, results: [...series.results, game] };
}

/** Game 2 of the pair: the same squads with sides swapped. */
export function nextGame(series: VersusSeries): VersusSeries {
  return { ...series, game: 2 };
}

/** The pair's result once both games are done, else null. */
export function pairResult(series: VersusSeries): PairResult | null {
  return series.results.length === 2 ? scorePair([series.results[0], series.results[1]]) : null;
}

/** Rematch: same squads and names, a fresh coin flip, game 1 again. */
export function rematch(series: VersusSeries, first: Player): VersusSeries {
  return startSeries(series.names, series.picks, first);
}

/** Who a controller index is, for log lines: "Name's" side in the current game. */
export const sideName = (series: VersusSeries, slot: Slot): string => series.names[playerAt(series, slot)];
