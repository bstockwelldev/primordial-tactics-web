// Difficulty knobs and the player level curve. Pure, shared by the browser, the headless
// simulator and the balance report (scripts/difficulty-report.ts).

export const BALANCE = {
  /** Level at which player stat scaling is 1.0 (base species/commander stats). */
  startLevel: 5,
  /** Enemy stat growth per enemy level above 1 (campaign sector squads). */
  enemyScalePerLevel: 0.09,
  /** Player squad stat growth per player level above `startLevel`. */
  playerScalePerLevel: 0.075,
  maxLevel: 15,
  /** Pass & play: enemy hp/attack/defense multiplier for skirmish, and for any sector missing from COOP_SECTOR_SCALE. */
  coopEnemyScale: 1.2,
};

/**
 * Pass & play: enemy stat multiplier per campaign sector when a buddy joins (4 units vs the usual 3).
 * Sectors differ too much for one number (the 70% point runs from about 1.1 to 1.7), so each is tuned
 * with `npm run balance` to land in the 55-85% band for two moderate bots at the expected level.
 * Re-tune after changing enemy squads or the level curve.
 */
export const COOP_SECTOR_SCALE: Record<string, number> = {
  // Win rate jumps from 92% to 50% between 1.656 and 1.657 (a one-hit-kill threshold), so no value lands in the band. Sector 1 starts liberated; 1.657 is the closest.
  sector_primoris_1: 1.657,
  sector_primoris_2: 1.32,
  sector_primoris_3: 1.25,
  sector_caldera_1: 1.66,
  sector_caldera_2: 1.23,
  sector_caldera_3: 1.125,
  // the first sector of each island fields two weak units, so it takes a large multiplier to matter
  sector_tempest_1: 2.15,
  sector_tempest_2: 1.3,
  sector_tempest_3: 1.18,
  sector_magitek_1: 1.53,
  sector_magitek_2: 1.17,
  sector_magitek_3: 1.18,
};

export function coopEnemyScaleFor(sectorId: string | null | undefined): number {
  return (sectorId && COOP_SECTOR_SCALE[sectorId]) || BALANCE.coopEnemyScale;
}

/** Cumulative XP needed to reach `level`: 25 * L * (L - 1). L5 = 500, L6 = 750, L10 = 2250. */
export function xpForLevel(level: number): number {
  return 25 * level * (level - 1);
}

/** Level for an XP total, capped at BALANCE.maxLevel. */
export function levelForXp(xp: number): number {
  let level = 1;
  while (level < BALANCE.maxLevel && xp >= xpForLevel(level + 1)) level++;
  return level;
}

/** Stat multiplier for an enemy of `level`. */
export function enemyLevelScale(level: number): number {
  return 1 + (level - 1) * BALANCE.enemyScalePerLevel;
}

/** Stat multiplier for the player squad at `playerLevel` (1.0 at the start level). */
export function playerLevelScale(playerLevel: number): number {
  return 1 + (playerLevel - BALANCE.startLevel) * BALANCE.playerScalePerLevel;
}

/**
 * Starting XP of a new game: level 6, one level above the stat baseline. The first real
 * mission (sector_primoris_2; sector 1 starts liberated) is balanced for that level.
 */
export const NEW_GAME_XP = 800;
