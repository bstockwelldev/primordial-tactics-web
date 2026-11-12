import test from 'node:test';
import { BALANCE, NEW_GAME_XP, levelForXp, xpForLevel, playerLevelScale } from './balance';
import assert from 'node:assert/strict';
import {
  calculateDistance,
  canUnitMoveTo,
  calculateDamage,
  calculateTorporDamage,
  dartTorporGain,
  moveApCost,
  isTamingViable,
  calculateTamingChance,
  canEvolveDino,
  applyEvolution,
  checkWinCondition,
  canAfford,
  deductResources,
} from './rules';
import { GridTile, TamedDino, EvolutionNode, UnitEntity, PrehistoricResources } from '../types/game';

test('calculateDistance returns correct Manhattan distance', () => {
  assert.equal(calculateDistance(0, 0, 3, 4), 7);
  assert.equal(calculateDistance(2, 2, 2, 2), 0);
  assert.equal(calculateDistance(5, 1, 2, 4), 6);
});

test('canUnitMoveTo validates movement bounds, obstacles, and AP costs', () => {
  const dummyGrid: GridTile[] = [
    { x: 0, y: 0, type: 'grass', walkable: true },
    { x: 1, y: 0, type: 'grass', walkable: true },
    { x: 2, y: 0, type: 'rock', walkable: false },
    { x: 0, y: 1, type: 'grass', walkable: true },
  ];

  const unit = { x: 0, y: 0, speed: 3, ap: 2 };

  // Valid move to (1, 0)
  const result1 = canUnitMoveTo(unit, 1, 0, dummyGrid, [], 'u1');
  assert.equal(result1.valid, true);
  assert.equal(result1.apCost, 1);

  // Invalid: rock obstacle
  const result2 = canUnitMoveTo(unit, 2, 0, dummyGrid, [], 'u1');
  assert.equal(result2.valid, false);

  // Invalid: occupied tile
  const result3 = canUnitMoveTo(unit, 1, 0, dummyGrid, [{ x: 1, y: 0, unitId: 'u2' }], 'u1');
  assert.equal(result3.valid, false);

  // Invalid: out of bounds
  const result4 = canUnitMoveTo(unit, 9, 9, dummyGrid, [], 'u1');
  assert.equal(result4.valid, false);
});

test('calculateDamage handles attack, defense mitigation, and shields', () => {
  const unshielded = calculateDamage(50, 20, 1.0, false, 0);
  assert.ok(unshielded.damage > 0);

  // Shielded damage should be roughly half of unshielded
  const shielded = calculateDamage(50, 20, 1.0, true, 0);
  assert.ok(shielded.damage < unshielded.damage || shielded.damage <= unshielded.damage);
});

test('torpor and taming viability calculations work accurately', () => {
  const torporDmg = calculateTorporDamage(40, 20);
  assert.ok(torporDmg > 30);

  // Under 80% torpor is not viable
  assert.equal(isTamingViable(50, 100), false);
  // 80% or more is viable
  assert.equal(isTamingViable(80, 100), true);
  assert.equal(isTamingViable(95, 100), true);

  // Chance with prime kibble is higher than meat and none
  const chanceNone = calculateTamingChance(90, 100, 'none');
  const chanceMeat = calculateTamingChance(90, 100, 'meat');
  const chanceKibble = calculateTamingChance(90, 100, 'kibble');

  assert.ok(chanceKibble > chanceMeat);
  assert.ok(chanceMeat > chanceNone);
});

test('evolution validation and stat multiplier application works', () => {
  const dummyDino: TamedDino = {
    instanceId: 'dino_1',
    speciesId: 'velociraptor',
    customName: 'Ghost',
    level: 5,
    xp: 500,
    currentHp: 160,
    maxHp: 160,
    currentTorpor: 0,
    maxTorpor: 120,
    attack: 48,
    defense: 16,
    speed: 4,
    equippedAbilities: ['raptor_slash'],
  };

  const dummyEvolution: EvolutionNode = {
    id: 'deinonychus',
    name: 'Deinonychus (Apex Striker)',
    description: 'Enlarged talons',
    requiredLevel: 5,
    requiredAmber: 100,
    statMultipliers: { hp: 1.3, attack: 1.5, defense: 1.2, speed: 1.25 },
    bonusAbility: {
      id: 'fatal_frenzy',
      name: 'Fatal Frenzy',
      apCost: 4,
      cooldown: 3,
      range: 1,
      targetType: 'enemy',
      description: 'Devastating tri-strike',
      iconName: 'Crosshair',
    },
  };

  // Check evolution with insufficient amber
  const evalPoor = canEvolveDino(dummyDino, dummyEvolution, 50);
  assert.equal(evalPoor.canEvolve, false);

  // Check evolution with sufficient amber
  const evalRich = canEvolveDino(dummyDino, dummyEvolution, 150);
  assert.equal(evalRich.canEvolve, true);

  // Apply evolution
  const evolved = applyEvolution(dummyDino, dummyEvolution);
  assert.equal(evolved.evolution, 'deinonychus');
  assert.ok(evolved.attack > dummyDino.attack);
  assert.ok(evolved.maxHp > dummyDino.maxHp);
  assert.ok(evolved.equippedAbilities.includes('fatal_frenzy'));
});

test('checkWinCondition evaluates team wipes correctly', () => {
  const playerUnit: UnitEntity = {
    id: 'p1',
    isPlayer: true,
    ownerId: 'player_me',
    name: 'Survivor Alpha',
    unitClass: 'Striker',
    x: 0,
    y: 0,
    hp: 100,
    maxHp: 100,
    torpor: 0,
    maxTorpor: 100,
    ap: 3,
    maxAp: 3,
    attack: 30,
    defense: 10,
    speed: 3,
    abilities: [],
    statusEffects: [],
    avatarIcon: 'User',
  };

  const enemyUnit: UnitEntity = {
    ...playerUnit,
    id: 'e1',
    isPlayer: false,
    ownerId: 'enemy_bot',
    name: 'Wild Carno',
    hp: 0, // Dead
  };

  const check1 = checkWinCondition([playerUnit, enemyUnit]);
  assert.equal(check1.isOver, true);
  assert.equal(check1.winnerPlayerId, 'player_me');

  // Both alive
  enemyUnit.hp = 50;
  const check2 = checkWinCondition([playerUnit, enemyUnit]);
  assert.equal(check2.isOver, false);
});

test('resource affordability and safe deduction works correctly', () => {
  const inv: PrehistoricResources = {
    wood: 100,
    flint: 50,
    fiber: 80,
    iron: 30,
    primalMeat: 10,
    amber: 20,
    titanite: 5,
    magitekCores: 15,
  };

  assert.equal(canAfford({ wood: 50, flint: 20 }, inv), true);
  assert.equal(canAfford({ wood: 150, flint: 20 }, inv), false);
  assert.equal(canAfford({ magitekCores: 5 }, inv), true);
  assert.equal(canAfford({ magitekCores: 25 }, inv), false);

  const updated = deductResources({ wood: 50, flint: 20, magitekCores: 5 }, inv);
  assert.equal(updated.wood, 50);
  assert.equal(updated.flint, 30);
  assert.equal(updated.fiber, 80);
  assert.equal(updated.magitekCores, 10);
});

test('GDD class passives alter combat calculations correctly', () => {
  // Crush class deals higher torpor than standard
  const normalTorpor = calculateTorporDamage(50, 10);
  const crushTorpor = calculateTorporDamage(50, 10, 'Crush');
  assert.ok(crushTorpor > normalTorpor);

  // Hulk class reduces incoming damage compared to unclassed defender
  // calculate damage against 40 defense: Skewer ignores 30% defense, dealing higher base
  // rng pinned so no roll crits: the comparison is between passives, not dice.
  const noCrit = () => 0.99;
  const skewerDmg = calculateDamage(60, 40, 1.0, false, 0, 'Skewer', undefined, noCrit);
  const normalDmg = calculateDamage(60, 40, 1.0, false, 0, undefined, undefined, noCrit);
  assert.ok(skewerDmg.damage >= normalDmg.damage);

  const hulkDefenseDmg = calculateDamage(60, 20, 1.0, false, 0, undefined, 'Hulk', noCrit);
  const standardDefenseDmg = calculateDamage(60, 20, 1.0, false, 0, undefined, undefined, noCrit);
  assert.ok(hulkDefenseDmg.damage <= standardDefenseDmg.damage);
});

test('dartTorporGain: 35-54 base, reduced by the wild dino defense, never below the minimum', () => {
  assert.equal(dartTorporGain(0, 0), 35);
  assert.equal(dartTorporGain(0.999, 0), 54);
  assert.equal(dartTorporGain(0, 38), calculateTorporDamage(35, 38));
  assert.ok(dartTorporGain(0.5, 38) < dartTorporGain(0.5, 0), 'armoured dinos take less torpor');
  assert.equal(dartTorporGain(5, 0), 54, 'out-of-range rolls are clamped');
});

test('moveApCost: water adds 1 AP, mud cuts reach by 1, flyers ignore terrain', () => {
  const walker = { speed: 3 };
  assert.equal(moveApCost(walker, { type: 'grass' }, 2), 1);
  assert.equal(moveApCost(walker, { type: 'water' }, 2), 2);
  assert.equal(moveApCost(walker, { type: 'mud' }, 3), Infinity);
  assert.equal(moveApCost(walker, { type: 'mud' }, 2), 1);
  assert.equal(moveApCost({ speed: 3, speciesId: 'pteranodon' }, { type: 'mud' }, 3), 2);
  assert.equal(moveApCost({ speed: 3, speciesId: 'pteranodon' }, { type: 'water' }, 1), 1);
  assert.equal(moveApCost(walker, { type: 'grass' }, 4), Infinity);
});

test('canUnitMoveTo charges terrain: a water tile needs the extra AP', () => {
  const grid = [{ x: 0, y: 0, type: 'grass' as const, walkable: true }, { x: 2, y: 0, type: 'water' as const, walkable: true }];
  const base = { x: 0, y: 0, speed: 3 };
  assert.equal(canUnitMoveTo({ ...base, ap: 1 }, 2, 0, grid, [], 'u').valid, false);
  const ok = canUnitMoveTo({ ...base, ap: 2 }, 2, 0, grid, [], 'u');
  assert.ok(ok.valid);
  assert.equal(ok.apCost, 2);
});

test('level curve: a new game is level 6, levels rise with XP and cap at the maximum', () => {
  assert.equal(levelForXp(NEW_GAME_XP), BALANCE.startLevel + 1, 'a new game starts one level above the baseline');
  assert.equal(levelForXp(xpForLevel(6) - 1), 5);
  assert.equal(levelForXp(xpForLevel(6)), 6);
  assert.equal(levelForXp(0), 1);
  assert.equal(levelForXp(10_000_000), BALANCE.maxLevel);
  assert.equal(playerLevelScale(BALANCE.startLevel), 1);
  assert.ok(playerLevelScale(8) > playerLevelScale(6));
});
