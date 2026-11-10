import type { BattleActionLog, UnitEntity } from '../types/game';

/** An in-progress solo match (skirmish or campaign mission), kept in localStorage. */
export interface SoloSave {
  /** Campaign sector id, or null for a plain skirmish. */
  sectorId: string | null;
  units: UnitEntity[];
  logs: BattleActionLog[];
  turn: number;
  isPlayerTurn: boolean;
}

export const SOLO_SAVE_KEY = 'pt_solo_match';
