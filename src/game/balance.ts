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
};

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
