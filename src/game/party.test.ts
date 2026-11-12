import test from 'node:test';
import assert from 'node:assert/strict';
import { buildArenaGrid, buildSoloUnits } from './arenaSetup';
import { ISLAND_CAMPAIGN_SECTORS } from './constants';
import { BALANCE, playerLevelScale } from './balance';
import { BOT_PROFILES } from './bot';
import { checkWinCondition } from './rules';
import { simulateMatch } from './sim';
import {
  PartyPhase,
  assignSlots,
  canControl,
  controllerOf,
  defaultAssignments,
  firstPhase,
  isHumanControlled,
  livingSlots,
  nextPhase,
  swapAssignments,
  swapSlots,
  validateSplit,
} from './party';
import type { TamedDino, UnitEntity } from '../types/game';

const starters: TamedDino[] = [
  { instanceId: 'a', speciesId: 'velociraptor', customName: 'Ghostclaw', level: 5, xp: 0, currentHp: 160, maxHp: 160, currentTorpor: 0, maxTorpor: 120, attack: 48, defense: 16, speed: 4, equippedAbilities: [] },
  { instanceId: 'b', speciesId: 'triceratops', customName: 'Shieldhorn', level: 4, xp: 0, currentHp: 290, maxHp: 290, currentTorpor: 0, maxTorpor: 260, attack: 34, defense: 38, speed: 2, equippedAbilities: [] },
];
const sector = ISLAND_CAMPAIGN_SECTORS.find((s) => s.id === 'sector_primoris_2')! as any;

const solo = () => buildSoloUnits('Hana', starters, null);
const coop = (level?: number) => buildSoloUnits('Hana', starters, sector, level, { guestName: 'Gus' });
const humans = (units: UnitEntity[]) => units.filter((u) => u.isPlayer);
const kill = (units: UnitEntity[], slot: 0 | 1) => units.map((u) => (u.isPlayer && controllerOf(u) === slot ? { ...u, hp: 0 } : u));

test('solo matches are untouched: no controllers anywhere, and the same units as before', () => {
  for (const u of solo()) assert.equal('controller' in u, false, u.id);
  const withoutParty = buildSoloUnits('Hana', starters, sector, BALANCE.startLevel);
  const withUndefinedParty = buildSoloUnits('Hana', starters, sector, BALANCE.startLevel, undefined);
  assert.deepEqual(withoutParty, withUndefinedParty);
  assert.equal(humans(withoutParty).length, 3);
});

test('party: a guest commander joins and the default split is host commander+dino vs buddy commander+dino', () => {
  const units = coop();
  assert.equal(humans(units).length, 4);
  const byId = Object.fromEntries(units.map((u) => [u.id, u]));
  assert.deepEqual(
    ['player_hero', 'player_raptor', 'player_trike', 'player_guest'].map((id) => byId[id].controller),
    [0, 0, 1, 1]
  );
  assert.equal(byId.player_guest.name, 'Gus (Commander)');
  assert.equal(byId.player_guest.unitClass, 'Human');
  assert.equal(validateSplit(units), null);
  // everyone stands on their own tile
  assert.equal(new Set(units.map((u) => `${u.x},${u.y}`)).size, units.length);
});

test('party: the guest commander is built like the host commander, scaled by level, with its own ability objects', () => {
  const lvl = BALANCE.startLevel + 3;
  const units = coop(lvl);
  const hero = units.find((u) => u.id === 'player_hero')!;
  const guest = units.find((u) => u.id === 'player_guest')!;
  assert.equal(guest.maxHp, hero.maxHp);
  assert.equal(guest.attack, hero.attack);
  assert.equal(guest.maxHp, Math.round(200 * playerLevelScale(lvl)));
  assert.deepEqual(guest.abilities, hero.abilities);
  assert.notEqual(guest.abilities[0], hero.abilities[0], 'no shared mutable ability objects');
  assert.equal(buildSoloUnits('Hana', starters, sector, undefined, { guestName: '  ' }).find((u) => u.id === 'player_guest')!.name, 'Buddy (Commander)');
});

test('party: the enemy squad and the arena are identical to a solo mission (co-op scaling comes with the balance slice)', () => {
  const enemies = (units: UnitEntity[]) => units.filter((u) => !u.isPlayer);
  assert.deepEqual(enemies(coop()), enemies(buildSoloUnits('Hana', starters, sector)));
  const tile = buildArenaGrid('primoris').find((t) => t.x === 0 && t.y === 3)!;
  assert.ok(tile && tile.type !== 'water', 'the guest commander starts on walkable ground');
});

test('canControl: only the active slot, only living human units, never in the enemy phase', () => {
  const units = coop();
  const hero = units.find((u) => u.id === 'player_hero')!;
  const trike = units.find((u) => u.id === 'player_trike')!;
  const foe = units.find((u) => !u.isPlayer)!;
  assert.equal(canControl(hero, 0), true);
  assert.equal(canControl(hero, 1), false);
  assert.equal(canControl(trike, 1), true);
  assert.equal(canControl(trike, 0), false);
  assert.equal(canControl(hero, 'enemy'), false);
  assert.equal(canControl(foe, 0), false);
  assert.equal(canControl(foe, 'enemy'), false, 'the bots are driven by runBotTurn, not by canControl');
  assert.equal(canControl({ ...hero, hp: 0 }, 0), false);
  // a solo unit has no controller and belongs to slot 0
  const soloHero = solo().find((u) => u.id === 'player_hero')!;
  assert.equal(canControl(soloHero, 0), true);
  assert.equal(canControl(soloHero, 1), false);
});

test('phases: slot 0, slot 1, enemy, then a new round', () => {
  const units = coop();
  assert.equal(firstPhase(units), 0);
  const walk: Array<[PartyPhase, PartyPhase, boolean]> = [
    [0, 1, false],
    [1, 'enemy', false],
    ['enemy', 0, true],
  ];
  for (const [from, to, newRound] of walk) assert.deepEqual(nextPhase(units, from), { phase: to, newRound }, `${from} -> ${to}`);
});

test('phases: a solo match cycles slot 0 -> enemy -> slot 0 as it always has', () => {
  const units = solo();
  assert.deepEqual(nextPhase(units, 0), { phase: 'enemy', newRound: false });
  assert.deepEqual(nextPhase(units, 'enemy'), { phase: 0, newRound: true });
});

test('phases: a slot with no living units is skipped', () => {
  const noBuddy = kill(coop(), 1);
  assert.deepEqual(livingSlots(noBuddy), [0]);
  assert.deepEqual(nextPhase(noBuddy, 0), { phase: 'enemy', newRound: false });
  assert.deepEqual(nextPhase(noBuddy, 'enemy'), { phase: 0, newRound: true });

  const noHost = kill(coop(), 0);
  assert.deepEqual(livingSlots(noHost), [1]);
  assert.equal(firstPhase(noHost), 1);
  assert.deepEqual(nextPhase(noHost, 'enemy'), { phase: 1, newRound: true });

  const wiped = kill(kill(coop(), 0), 1);
  assert.deepEqual(livingSlots(wiped), []);
  assert.equal(firstPhase(wiped), 'enemy');
  assert.deepEqual(nextPhase(wiped, 'enemy'), { phase: 'enemy', newRound: false });
});

test('a human-controlled enemy-side unit counts as human (room for a later versus mode)', () => {
  const foe = { ...coop().find((u) => !u.isPlayer)!, controller: 1 as const };
  assert.equal(isHumanControlled(foe), true);
  assert.equal(canControl(foe, 1), true);
  assert.deepEqual(livingSlots([foe]), [1]);
  assert.equal(isHumanControlled(coop().find((u) => !u.isPlayer)!), false);
});

test('split helpers: validate, assign and swap', () => {
  const units = coop();
  const allMine = assignSlots(units, { player_trike: 0, player_guest: 0 });
  assert.equal(validateSplit(allMine), 'Player 2 needs at least one unit.');
  const allBuddy = assignSlots(units, { player_hero: 1, player_raptor: 1 });
  assert.equal(validateSplit(allBuddy), 'Player 1 needs at least one unit.');
  assert.equal(validateSplit(assignSlots(units, { player_raptor: 1, player_trike: 0 })), null, 'any split with both players covered is fine');
  assert.equal(assignSlots(units, { nobody: 1 }).length, units.length, 'unknown ids are ignored');

  const swapped = swapSlots(units);
  assert.deepEqual(swapped.filter((u) => u.isPlayer).map((u) => u.controller), [1, 1, 0, 0]);
  assert.ok(swapped.filter((u) => !u.isPlayer).every((u) => u.controller === undefined), 'bots are not handed to a player');
  assert.deepEqual(swapSlots(swapped), units);
  assert.deepEqual(units.find((u) => u.id === 'player_hero')!.controller, 0, 'inputs are not mutated');
});

test('win/lose is by side: the match goes on while any human unit lives, and the host owns the win', () => {
  const units = coop();
  assert.equal(checkWinCondition(kill(units, 1)).isOver, false, 'buddy wiped, host still playing');
  assert.equal(checkWinCondition(kill(units, 0)).isOver, false, 'host wiped, buddy still playing');
  const wiped = checkWinCondition(kill(kill(units, 0), 1));
  assert.deepEqual(wiped, { isOver: true, winnerPlayerId: 'ai_bot' });
  // the arena treats winnerId === 'player_me' as a human win; it must hold even if only the guest survives
  const guestOnly = units.map((u) => (u.isPlayer && u.id !== 'player_guest' ? { ...u, hp: 0 } : u.isPlayer ? u : { ...u, hp: 0 }));
  assert.deepEqual(checkWinCondition(guestOnly), { isOver: true, winnerPlayerId: 'player_me' });
});

test('the headless simulator plays a four-unit party to a finish', () => {
  const grid = buildArenaGrid('primoris');
  const units = buildSoloUnits('Hana', starters, sector, 6, { guestName: 'Gus' });
  const a = simulateMatch({ units, grid, seed: 7, player: BOT_PROFILES.moderate, enemy: BOT_PROFILES.moderate });
  const b = simulateMatch({ units, grid, seed: 7, player: BOT_PROFILES.moderate, enemy: BOT_PROFILES.moderate });
  assert.notEqual(a.winner, 'unfinished');
  assert.deepEqual(a, b, 'deterministic for a seed');
});

test('setup helpers: default assignments mirror the engine split, and swapping them matches swapSlots', () => {
  const units = coop();
  const defaults = defaultAssignments(units);
  assert.deepEqual(defaults, { player_hero: 0, player_raptor: 0, player_trike: 1, player_guest: 1 });
  assert.ok(!Object.keys(defaults).some((id) => id.startsWith('enemy')), 'bots are not assignable');
  const swapped = swapAssignments(defaults);
  assert.deepEqual(swapped, { player_hero: 1, player_raptor: 1, player_trike: 0, player_guest: 0 });
  assert.deepEqual(assignSlots(units, swapped), swapSlots(units));
  assert.deepEqual(swapAssignments(swapped), defaults);
  assert.deepEqual(defaultAssignments(solo()), { player_hero: 0, player_raptor: 0, player_trike: 0 });
});
