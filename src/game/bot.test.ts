import test from 'node:test';
import assert from 'node:assert/strict';
import { runBotTurn } from './bot';
import { checkWinCondition } from './rules';
import { GridTile, UnitEntity, Ability } from '../types/game';

const grid: GridTile[] = [];
for (let y = 0; y < 6; y++) {
  for (let x = 0; x < 8; x++) {
    const rock = [[2, 1], [5, 4], [3, 3], [4, 2]].some(([rx, ry]) => rx === x && ry === y);
    grid.push({ x, y, type: rock ? 'rock' : 'grass', walkable: !rock, defenseBonus: 0 });
  }
}

const melee: Ability = {
  id: 'bite', name: 'Bite', apCost: 2, cooldown: 0, range: 1, targetType: 'enemy',
  damageMultiplier: 1.0, description: '', iconName: 'Zap',
};
const jab: Ability = { ...melee, id: 'jab', name: 'Jab', apCost: 1, damageMultiplier: 0.3 };
const buff: Ability = { ...melee, id: 'howl', name: 'Howl', targetType: 'ally', damageMultiplier: undefined, range: 3 };

function unit(id: string, isPlayer: boolean, x: number, y: number, over: Partial<UnitEntity> = {}): UnitEntity {
  return {
    id, isPlayer, ownerId: isPlayer ? 'player_me' : 'ai_bot', name: id, unitClass: 'Human',
    x, y, hp: 100, maxHp: 100, torpor: 0, maxTorpor: 100, ap: 3, maxAp: 3,
    attack: 40, defense: 20, speed: 3, avatarIcon: 'User', abilities: [melee], statusEffects: [],
    ...over,
  };
}

const noCrit = () => 0.99;
const dist = (a: UnitEntity, b: UnitEntity) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

test('out-of-range bot unit advances toward the player instead of standing still', () => {
  const units = [unit('p', true, 0, 2), unit('e', false, 7, 2)];
  const { units: after, logs } = runBotTurn(units, grid, 2, noCrit);
  const e = after.find((u) => u.id === 'e')!;
  assert.ok(dist(e, after[0]) < 7, 'bot closed distance');
  assert.ok(logs.some((l) => l.actionName === 'Moved'));
  assert.ok(e.ap >= 0);
});

test('bot moves into range and attacks in the same turn when AP allows', () => {
  const units = [unit('p', true, 0, 0), unit('e', false, 3, 0)];
  const { units: after } = runBotTurn(units, grid, 2, noCrit);
  assert.ok(after[0].hp < 100, 'player took damage');
  assert.equal(dist(after[1], after[0]), 1);
});

test('bot reaches and damages a distant player within a few turns', () => {
  let units = [unit('p', true, 0, 5), unit('e', false, 7, 0)];
  for (let t = 0; t < 4; t++) {
    units = runBotTurn(units, grid, t, noCrit).units.map((u) => ({ ...u, ap: u.maxAp }));
  }
  assert.ok(units[0].hp < 100);
});

test('bot never ends on a rock, off-grid, or on another unit', () => {
  let units = [
    unit('p1', true, 0, 2), unit('p2', true, 1, 4),
    unit('e1', false, 7, 3), unit('e2', false, 6, 2), unit('e3', false, 6, 4),
  ];
  for (let t = 0; t < 6; t++) {
    units = runBotTurn(units, grid, t, noCrit).units.map((u) => ({ ...u, ap: u.maxAp }));
    const alive = units.filter((u) => u.hp > 0);
    for (const u of alive) {
      const tile = grid.find((g) => g.x === u.x && g.y === u.y);
      assert.ok(tile && tile.walkable, `${u.id} on a walkable tile`);
    }
    assert.equal(new Set(alive.map((u) => `${u.x},${u.y}`)).size, alive.length, 'no stacked units');
  }
});

test('bot focuses the target it can kill', () => {
  const units = [
    unit('healthy', true, 3, 0),
    unit('weak', true, 4, 1, { hp: 10 }),
    unit('e', false, 4, 0, { ap: 2 }),
  ];
  const { units: after } = runBotTurn(units, grid, 1, noCrit);
  assert.equal(after.find((u) => u.id === 'weak')!.hp, 0);
  assert.equal(after.find((u) => u.id === 'healthy')!.hp, 100);
});

test('bot picks among its abilities and never spends AP on non-offensive ones', () => {
  const units = [unit('p', true, 0, 0, { hp: 500, maxHp: 500 }), unit('e', false, 1, 0, { abilities: [buff, jab, melee] })];
  const { units: after, logs } = runBotTurn(units, grid, 1, noCrit);
  assert.ok(!logs.some((l) => l.actionName === 'Howl'));
  assert.deepEqual(logs.map((l) => l.actionName).sort(), ['Bite', 'Jab']); // 2 AP + 1 AP = all 3 AP used
  assert.equal(after[1].ap, 0);
});

test('runBotTurn is pure and deterministic under a fixed rng', () => {
  const units = [unit('p', true, 0, 0), unit('e', false, 1, 0)];
  const snapshot = JSON.stringify(units);
  const a = runBotTurn(units, grid, 1, noCrit);
  const b = runBotTurn(units, grid, 1, noCrit);
  assert.equal(JSON.stringify(units), snapshot, 'input not mutated');
  assert.equal(JSON.stringify(a.units), JSON.stringify(b.units));
});

test('bot wiping the player squad is a bot win', () => {
  const units = [unit('p', true, 0, 0, { hp: 5 }), unit('e', false, 1, 0)];
  const { units: after } = runBotTurn(units, grid, 1, noCrit);
  const check = checkWinCondition(after);
  assert.ok(check.isOver);
  assert.equal(check.winnerPlayerId, 'ai_bot');
});
