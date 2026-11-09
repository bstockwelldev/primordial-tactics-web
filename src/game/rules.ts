import {
  TamedDino,
  EvolutionNode,
  UnitEntity,
  PrehistoricResources,
  GridTile,
  UnitClass,
} from '../types/game';

/**
 * Calculates Manhattan distance on a tactical grid
 */
export function calculateDistance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}

/**
 * Checks whether a unit can move to a target coordinate within its remaining speed and AP
 */
export function canUnitMoveTo(
  unit: { x: number; y: number; speed: number; ap: number },
  targetX: number,
  targetY: number,
  grid: GridTile[],
  occupiedPositions: Array<{ x: number; y: number; unitId: string }>,
  currentUnitId: string
): { valid: boolean; apCost: number; reason?: string } {
  // Destination must be within grid
  const targetTile = grid.find((t) => t.x === targetX && t.y === targetY);
  if (!targetTile) {
    return { valid: false, apCost: 0, reason: 'Out of arena bounds' };
  }

  if (!targetTile.walkable) {
    return { valid: false, apCost: 0, reason: 'Tile is obstructed by boulder or obstacle' };
  }

  // Cannot step onto another unit
  const isOccupied = occupiedPositions.some(
    (occ) => occ.x === targetX && occ.y === targetY && occ.unitId !== currentUnitId
  );
  if (isOccupied) {
    return { valid: false, apCost: 0, reason: 'Tile is occupied by another unit' };
  }

  const distance = calculateDistance(unit.x, unit.y, targetX, targetY);
  if (distance === 0) {
    return { valid: false, apCost: 0, reason: 'Already at this location' };
  }

  if (distance > unit.speed) {
    return { valid: false, apCost: 0, reason: `Target out of speed range (Max: ${unit.speed})` };
  }

  // Standard movement costs 1 AP per 2 tiles (minimum 1 AP)
  const apRequired = Math.max(1, Math.ceil(distance / 2));
  if (unit.ap < apRequired) {
    return { valid: false, apCost: apRequired, reason: `Insufficient AP (${unit.ap}/${apRequired})` };
  }

  return { valid: true, apCost: apRequired };
}

/**
 * Calculates raw and mitigated damage based on attack, defense, ability multiplier, terrain bonuses, and class passives
 */
export function calculateDamage(
  attackerAttack: number,
  defenderDefense: number,
  multiplier = 1.0,
  hasShield = false,
  terrainDefenseBonus = 0,
  attackerClass?: UnitClass,
  defenderClass?: UnitClass
): { damage: number; isCritical: boolean } {
  let effectiveDefense = Math.max(0, defenderDefense + terrainDefenseBonus);

  // Skewer class passive: Piercing thrust ignores 30% of target defense
  if (attackerClass === 'Skewer') {
    effectiveDefense = effectiveDefense * 0.7;
  }

  // Defense mitigation curve: defense / (defense + 50)
  const mitigationRate = effectiveDefense / (effectiveDefense + 50);
  let baseDamage = attackerAttack * multiplier;

  // Human class passive: +10% tactical precision
  if (attackerClass === 'Human') {
    baseDamage *= 1.1;
  }

  const mitigatedDamage = baseDamage * (1 - mitigationRate);

  // Blade class passive: +15% critical strike chance (30% total) and 1.75x crit damage
  const isBlade = attackerClass === 'Blade' || attackerClass === 'Striker';
  const critThreshold = isBlade ? 0.30 : 0.15;
  const isCritical = Math.random() < critThreshold;
  const critMultiplier = isCritical ? (isBlade ? 1.75 : 1.5) : 1.0;

  // Hulk class passive: 20% passive damage mitigation
  const isHulk = defenderClass === 'Hulk' || defenderClass === 'Tank';
  const hulkMitigation = isHulk ? 0.8 : 1.0;

  const finalDamage = Math.max(
    5,
    Math.round(mitigatedDamage * critMultiplier * (hasShield ? 0.5 : 1.0) * hulkMitigation)
  );

  return {
    damage: finalDamage,
    isCritical,
  };
}

/**
 * Calculates torpor build-up on a target dinosaur, applying Crush class torpor amplification
 */
export function calculateTorporDamage(
  baseTorpor: number,
  targetDefense: number,
  attackerClass?: UnitClass
): number {
  const reduction = Math.min(0.5, targetDefense * 0.005);
  let finalTorpor = baseTorpor * (1 - reduction);

  // Crush class passive: +35% bonus torpor damage from heavy blunt impact
  if (attackerClass === 'Crush' || attackerClass === 'Siege') {
    finalTorpor *= 1.35;
  }

  return Math.max(5, Math.round(finalTorpor));
}

/**
 * Evaluates if a dinosaur is tranquilized and ready for taming
 */
export function isTamingViable(currentTorpor: number, maxTorpor: number): boolean {
  return currentTorpor >= maxTorpor * 0.8;
}

/**
 * Calculates taming success probability based on torpor percentage and bait used
 */
export function calculateTamingChance(
  currentTorpor: number,
  maxTorpor: number,
  bait: 'none' | 'meat' | 'kibble'
): number {
  const torporRatio = Math.min(1.0, currentTorpor / maxTorpor);
  let baseChance = torporRatio * 45; // up to 45% with max torpor alone

  if (bait === 'meat') {
    baseChance += 25; // +25%
  } else if (bait === 'kibble') {
    baseChance += 50; // +50%
  }

  return Math.min(99, Math.round(baseChance));
}

/**
 * Checks if a tamed dino qualifies for a specific research evolution branch
 */
export function canEvolveDino(
  dino: TamedDino,
  evolution: EvolutionNode,
  playerAmber: number
): { canEvolve: boolean; reason?: string } {
  if (dino.evolution) {
    return { canEvolve: false, reason: 'Dinosaur is already at maximum evolution stage' };
  }

  if (dino.level < evolution.requiredLevel) {
    return {
      canEvolve: false,
      reason: `Requires Dino Level ${evolution.requiredLevel} (Current: ${dino.level})`,
    };
  }

  if (playerAmber < evolution.requiredAmber) {
    return {
      canEvolve: false,
      reason: `Requires ${evolution.requiredAmber} Amber (Available: ${playerAmber})`,
    };
  }

  return { canEvolve: true };
}

/**
 * Applies research branch evolution to a dinosaur
 */
export function applyEvolution(dino: TamedDino, evolution: EvolutionNode): TamedDino {
  const mult = evolution.statMultipliers;
  const newMaxHp = Math.round(dino.maxHp * mult.hp);
  const newAttack = Math.round(dino.attack * mult.attack);
  const newDefense = Math.round(dino.defense * mult.defense);
  const newSpeed = Math.round(dino.speed * mult.speed);

  const updatedAbilities = [...dino.equippedAbilities];
  if (!updatedAbilities.includes(evolution.bonusAbility.id)) {
    updatedAbilities.push(evolution.bonusAbility.id);
  }

  return {
    ...dino,
    evolution: evolution.id,
    customName: `${evolution.name.split(' (')[0]} ${dino.customName}`,
    maxHp: newMaxHp,
    currentHp: newMaxHp,
    attack: newAttack,
    defense: newDefense,
    speed: newSpeed,
    equippedAbilities: updatedAbilities,
  };
}

/**
 * Validates arena win condition
 */
export function checkWinCondition(units: UnitEntity[]): { isOver: boolean; winnerPlayerId?: string } {
  const livingUnits = units.filter((u) => u.hp > 0);
  const player1Living = livingUnits.filter((u) => u.isPlayer);
  const enemyLiving = livingUnits.filter((u) => !u.isPlayer);

  if (player1Living.length === 0 && enemyLiving.length === 0) {
    return { isOver: true, winnerPlayerId: undefined }; // Draw
  }

  if (enemyLiving.length === 0) {
    return { isOver: true, winnerPlayerId: player1Living[0]?.ownerId || 'player1' };
  }

  if (player1Living.length === 0) {
    return { isOver: true, winnerPlayerId: enemyLiving[0]?.ownerId || 'enemy' };
  }

  return { isOver: false };
}

/**
 * Checks resource affordability
 */
export function canAfford(
  cost: Partial<PrehistoricResources>,
  inventory: PrehistoricResources
): boolean {
  for (const [resKey, requiredAmount] of Object.entries(cost)) {
    const key = resKey as keyof PrehistoricResources;
    if ((inventory[key] ?? 0) < (requiredAmount ?? 0)) {
      return false;
    }
  }
  return true;
}

/**
 * Deducts resources safely
 */
export function deductResources(
  cost: Partial<PrehistoricResources>,
  inventory: PrehistoricResources
): PrehistoricResources {
  const updated = { ...inventory };
  for (const [resKey, requiredAmount] of Object.entries(cost)) {
    const key = resKey as keyof PrehistoricResources;
    updated[key] = Math.max(0, (updated[key] ?? 0) - (requiredAmount ?? 0));
  }
  return updated;
}
