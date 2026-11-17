import type { IslandSector } from '../types/game';

/** Simple mode: the two Primoris Isle missions after the pre-liberated sector 1. `fullCampaign` shows all 12. */
export const SIMPLE_MISSION_IDS = ['sector_primoris_2', 'sector_primoris_3'];

/** The missions a player sees, in order. */
export function missionList(sectors: IslandSector[], full: boolean): IslandSector[] {
  return full ? sectors : sectors.filter((s) => SIMPLE_MISSION_IDS.includes(s.id));
}

/** The next mission still to win, optionally skipping the one just played. Null when all are won. */
export function nextMission(missions: IslandSector[], excludeId?: string | null): IslandSector | null {
  return missions.find((s) => !s.liberated && s.id !== excludeId) ?? null;
}
