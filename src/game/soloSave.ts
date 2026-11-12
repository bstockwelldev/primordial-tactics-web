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
