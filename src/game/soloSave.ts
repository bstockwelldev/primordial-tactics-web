import type { BattleActionLog, UnitEntity } from '../types/game';
import type { Slot } from './party';

/** An in-progress solo match (skirmish or campaign mission), kept in localStorage. */
export interface SoloSave {
  /** Campaign sector id, or null for a plain skirmish. */
  sectorId: string | null;
  units: UnitEntity[];
  logs: BattleActionLog[];
  turn: number;
  isPlayerTurn: boolean;
  /** Pass & play: both humans' names and whose phase it is. Absent in a solo match. */
  party?: { names: [string, string]; slot: Slot };
}

export const SOLO_SAVE_KEY = 'pt_solo_match';

/**
 * Parses a stored solo save. Returns null for anything unusable: missing, malformed, or a
 * co-op save whose party data is damaged (its units would be stuck on a slot nobody plays).
 * Old saves without a party load unchanged.
 */
export function readSoloSave(raw: string | null): SoloSave | null {
  if (!raw) return null;
  let save: any;
  try {
    save = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!save || typeof save !== 'object' || !Array.isArray(save.units) || save.units.length === 0) return null;
  if (typeof save.turn !== 'number' || typeof save.isPlayerTurn !== 'boolean') return null;
  const logs = Array.isArray(save.logs) ? save.logs : [];

  const p = save.party;
  const hasController = save.units.some((u: any) => u && u.controller !== undefined);
  if (p === undefined || p === null) {
    if (hasController) return null;
    const { party: _drop, ...rest } = save;
    return { ...rest, logs } as SoloSave;
  }
  const valid =
    Array.isArray(p.names) && p.names.length === 2 && p.names.every((n: unknown) => typeof n === 'string' && n.trim() !== '') && (p.slot === 0 || p.slot === 1);
  if (!valid) return null;
  return { ...save, logs, party: { names: [p.names[0], p.names[1]], slot: p.slot } } as SoloSave;
}
