import type { BattleActionLog, UnitEntity } from '../types/game';
import { VERSUS_ROUND_LIMIT } from './balance';
import type { Slot } from './party';
import { validatePicks } from './versus';
import { VersusSeries, unitsForGame } from './versusSeries';

// A local versus match in progress (docs/local-versus-spec.md, 3.8). It has its own key and shape so a
// campaign Resume can never pick it up and it can never be mistaken for, or overwrite, `pt_solo_match`.
// The draft itself is never saved: a save exists only once the match has started.

export const VERSUS_SAVE_KEY = 'pt_versus_match';

export interface VersusSave {
  mode: 'versus';
  series: VersusSeries;
  units: UnitEntity[];
  logs: BattleActionLog[];
  /** The round. */
  turn: number;
  /** Whose phase it is (ignored when `over`). */
  slot: Slot;
  /** The current game has ended and the result panel is showing. */
  over: boolean;
  endedBy: 'wipeout' | 'limit';
}

const isSlot = (v: unknown): v is Slot => v === 0 || v === 1;
const isName = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '' && v.length <= 40;

/** Parses a stored versus save; null for anything missing, malformed or inconsistent. */
export function readVersusSave(raw: string | null): VersusSave | null {
  if (!raw) return null;
  let save: any;
  try {
    save = JSON.parse(raw);
  } catch {
    return null;
  }
  try {
    if (!save || save.mode !== 'versus') return null;
    const s = save.series;
    if (!s || !Array.isArray(s.names) || s.names.length !== 2 || !s.names.every(isName)) return null;
    if (!Array.isArray(s.picks) || s.picks.length !== 2 || s.picks.some((p: unknown) => !Array.isArray(p) || validatePicks(p as string[]) !== null)) return null;
    if (!isSlot(s.first) || (s.game !== 1 && s.game !== 2)) return null;
    if (typeof save.over !== 'boolean' || (save.endedBy !== 'wipeout' && save.endedBy !== 'limit')) return null;
    if (!Array.isArray(s.results) || s.results.length !== s.game - 1 + (save.over ? 1 : 0)) return null;
    if (s.results.some((g: any) => !g || !['a', 'b', 'draw'].includes(g.winner) || typeof g.margin !== 'number' || !Number.isFinite(g.margin))) return null;
    if (!Number.isInteger(save.turn) || save.turn < 1 || save.turn > VERSUS_ROUND_LIMIT) return null;
    if (!isSlot(save.slot)) return null;
    if (!Array.isArray(save.units) || save.logs !== undefined && !Array.isArray(save.logs)) return null;

    const series: VersusSeries = { names: [s.names[0], s.names[1]], picks: [[...s.picks[0]], [...s.picks[1]]], first: s.first, game: s.game, results: s.results.map((g: any) => ({ winner: g.winner, margin: g.margin })) };
    // The units must be exactly this game's squads: same ids, controllers, sensible health.
    const expected = unitsForGame(series);
    if (save.units.length !== expected.length) return null;
    for (const e of expected) {
      const u = save.units.find((x: any) => x && x.id === e.id);
      if (!u || u.controller !== e.controller || typeof u.hp !== 'number' || !Number.isFinite(u.hp) || u.hp < 0 || u.hp > e.maxHp || u.maxHp !== e.maxHp) return null;
    }
    const alive = (slot: Slot) => save.units.some((u: any) => u.hp > 0 && u.controller === slot);
    if (!save.over && (!alive(0) || !alive(1) || !alive(save.slot))) return null; // a live game has both sides standing

    return { mode: 'versus', series, units: save.units, logs: save.logs ?? [], turn: save.turn, slot: save.slot, over: save.over, endedBy: save.endedBy };
  } catch {
    return null;
  }
}

/** A finished pair has nothing to resume: the result panel's job is done once both games are in. */
export const isResumable = (save: VersusSave): boolean => !(save.over && save.series.results.length === 2);
