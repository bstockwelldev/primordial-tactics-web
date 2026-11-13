import test from 'node:test';
import assert from 'node:assert/strict';
import { buildArenaGrid, buildSoloUnits } from './arenaSetup';
import { DINOSAUR_SPECIES } from './constants';
import { BOT_PROFILES, runBotTurn } from './bot';
import { createRng } from './rng';
import { hasBots, isBotControlled, livingSlots, nextPhase, refreshApFor } from './party';
import { simulateMatch } from './sim';
import { SQUAD_SIZE, VERSUS_TEMPLATE_IDS, buildVersusUnits, isVersusMatch, randomSquad, roundLimitWinner, validatePicks } from './versus';
import type { UnitEntity } from '../types/game';

const A = ['velociraptor', 'triceratops', 'commander'];
const B = ['pteranodon', 'ankylosaurus', 'dilophosaurus'];
const versus = () => buildVersusUnits(A, B);
const sideOf = (units: UnitEntity[], slot: 0 | 1) => units.filter((u) => (u.controller ?? 0) === slot);
const hurt = (units: UnitEntity[], slot: 0 | 1, share: number) =>
  units.map((u) => ((u.controller ?? 0) === slot ? { ...u, hp: Math.round(u.maxHp * share) } : u));

test('picks: exactly three different units from the pool; the same unit across players is fine', () => {
  assert.equal(validatePicks(A), null);
  assert.equal(validatePicks(['velociraptor', 'triceratops']), 'Pick exactly 3 units.');
  assert.equal(validatePicks([...A, 'pteranodon']), 'Pick exactly 3 units.');
  assert.equal(validatePicks(['velociraptor', 'velociraptor', 'commander']), 'Pick three different units.');
  assert.equal(validatePicks(['velociraptor', 'trex', 'commander']), 'Pick units from the pool.');
  assert.equal(buildVersusUnits(A, A).length, 6, 'a mirror match is allowed');
  assert.throws(() => buildVersusUnits(['velociraptor'], B), /exactly 3/);
  assert.equal(VERSUS_TEMPLATE_IDS.length, 6);
  assert.equal(SQUAD_SIZE, 3);
});

test('buildVersusUnits: two human sides on a mirrored layout, species base stats, no shared state', () => {
  const units = versus();
  assert.equal(units.length, 6);
  assert.equal(new Set(units.map((u) => u.id)).size, 6);
  assert.equal(new Set(units.map((u) => `${u.x},${u.y}`)).size, 6, 'everyone on their own tile');
  for (const u of sideOf(units, 0)) assert.deepEqual([u.isPlayer, u.controller], [true, 0], u.id);
  for (const u of sideOf(units, 1)) assert.deepEqual([u.isPlayer, u.controller], [false, 1], u.id);
  // side B mirrors side A's deployment across the arena (x -> 7 - x, same rows)
  const a = sideOf(units, 0).map((u) => [u.x, u.y]);
  const b = sideOf(units, 1).map((u) => [7 - u.x, u.y]);
  assert.deepEqual(b, a);
  const grid = buildArenaGrid();
  for (const u of units) assert.notEqual(grid.find((t) => t.x === u.x && t.y === u.y)?.type, 'water', `${u.id} starts on land`);
  // species stats at the level-5 baseline with the (currently neutral) tuning
  const raptor = units.find((u) => u.id === 'versus_a_velociraptor')!;
  assert.deepEqual([raptor.maxHp, raptor.attack, raptor.defense, raptor.speed], [160, 48, 16, 4]);
  assert.equal(raptor.hp, raptor.maxHp);
  assert.equal(raptor.name, DINOSAUR_SPECIES.velociraptor.name);
  // the commander matches the campaign commander at level 5
  const cmd = units.find((u) => u.id === 'versus_a_commander')!;
  const campaign = buildSoloUnits('X', [], null).find((u) => u.id === 'player_hero')!;
  assert.deepEqual([cmd.maxHp, cmd.attack, cmd.defense, cmd.unitClass], [campaign.maxHp, campaign.attack, campaign.defense, campaign.unitClass]);
  // a template picked by both sides does not share ability objects
  const mirror = buildVersusUnits(A, A);
  assert.notEqual(
    mirror.find((u) => u.id === 'versus_a_velociraptor')!.abilities[0],
    mirror.find((u) => u.id === 'versus_b_velociraptor')!.abilities[0]
  );
  assert.notEqual(raptor.abilities[0], DINOSAUR_SPECIES.velociraptor.innateAbilities[0], 'not the species table object either');
});

test('isVersusMatch: only when the enemy side is commanded by a human slot', () => {
  assert.equal(isVersusMatch(versus()), true);
  assert.equal(isVersusMatch(buildSoloUnits('X', [], null)), false);
  assert.equal(isVersusMatch(buildSoloUnits('X', [], null, undefined, { guestName: 'G' })), false);
});

test('phases: a versus match alternates A, B and never has an enemy phase', () => {
  const units = versus();
  assert.equal(hasBots(units), false);
  assert.ok(!units.some(isBotControlled));
  assert.deepEqual(nextPhase(units, 0), { phase: 1, newRound: false });
  assert.deepEqual(nextPhase(units, 1), { phase: 0, newRound: true });
  assert.deepEqual(livingSlots(units), [0, 1]);
});

test('phases: co-op and solo still go through the enemy phase', () => {
  const solo = buildSoloUnits('X', [], null);
  assert.deepEqual(nextPhase(solo, 0), { phase: 'enemy', newRound: false });
  const coop = buildSoloUnits('X', [], null, undefined, { guestName: 'G' });
  assert.deepEqual(nextPhase(coop, 1), { phase: 'enemy', newRound: false });
  assert.deepEqual(nextPhase(coop, 'enemy'), { phase: 0, newRound: true });
});

test('the enemy bot never takes over side B, but a slot-driven bot does play it', () => {
  const grid = buildArenaGrid();
  const units = versus().map((u) => ({ ...u, ap: u.maxAp }));
  const asEnemy = runBotTurn(units, grid, 1, createRng(5), { profile: BOT_PROFILES.moderate, timestamp: '' });
  assert.deepEqual(asEnemy.units, units, 'default enemy bot leaves human-controlled units alone');
  assert.equal(asEnemy.logs.length, 0);
  const asSlot1 = runBotTurn(units, grid, 1, createRng(5), { profile: BOT_PROFILES.moderate, controller: 1, timestamp: '' }).units;
  assert.ok(
    sideOf(asSlot1, 1).some((u) => u.ap < u.maxAp || u.x !== units.find((o) => o.id === u.id)!.x),
    'slot 1 acted'
  );
  // slot 1 may well hit slot 0's units (that is the point), but slot 0 itself does not move or spend AP
  assert.deepEqual(sideOf(asSlot1, 0).map((u) => [u.id, u.x, u.y, u.ap]), sideOf(units, 0).map((u) => [u.id, u.x, u.y, u.ap]), 'slot 0 did not act');
});

test('refreshApFor: a phase refreshes only its own living units', () => {
  const spent = versus().map((u) => ({ ...u, ap: 0 }));
  const dead = spent.map((u) => (u.id === 'versus_a_commander' ? { ...u, hp: 0 } : u));
  const afterA = refreshApFor(dead, 0);
  assert.deepEqual(
    sideOf(afterA, 0).map((u) => [u.id, u.ap]),
    [
      ['versus_a_velociraptor', 3],
      ['versus_a_triceratops', 3],
      ['versus_a_commander', 0],
    ]
  );
  assert.ok(sideOf(afterA, 1).every((u) => u.ap === 0));
  const afterB = refreshApFor(spent, 1);
  assert.ok(sideOf(afterB, 1).every((u) => u.ap === u.maxAp) && sideOf(afterB, 0).every((u) => u.ap === 0));
  const solo = buildSoloUnits('X', [], null).map((u) => ({ ...u, ap: 0 }));
  assert.ok(refreshApFor(solo, 'enemy').filter((u) => !u.isPlayer).every((u) => u.ap === u.maxAp));
  assert.ok(refreshApFor(solo, 'enemy').filter((u) => u.isPlayer).every((u) => u.ap === 0));
});

test('round limit: the larger share of max HP wins, equal is a draw', () => {
  assert.equal(roundLimitWinner(versus()), 'draw');
  assert.equal(roundLimitWinner(hurt(versus(), 1, 0.4)), 0);
  assert.equal(roundLimitWinner(hurt(versus(), 0, 0.4)), 1);
  assert.equal(roundLimitWinner(hurt(hurt(versus(), 0, 0.5), 1, 0.4)), 0, 'share of max HP, not raw HP');
});

test('simulator: a versus match is deterministic, finishes, and both sides fight', () => {
  const grid = buildArenaGrid();
  const units = versus();
  const run = () => simulateMatch({ units, grid, seed: 21, player: BOT_PROFILES.moderate, enemy: BOT_PROFILES.moderate });
  const r = run();
  assert.notEqual(r.winner, 'unfinished');
  assert.deepEqual(r, run());
  assert.ok(r.rounds <= 25);
  assert.ok(sideOf(r.units, 0).some((u) => u.hp < u.maxHp) && sideOf(r.units, 1).some((u) => u.hp < u.maxHp), 'both sides took damage');
});

test('simulator: a passive side loses to an active one', () => {
  const r = simulateMatch({ units: versus(), grid: buildArenaGrid(), seed: 3, player: BOT_PROFILES.moderate, enemy: 'passive' });
  assert.equal(r.winner, 'player');
});

test('randomSquad: always a legal squad, deterministic per rng', () => {
  const rng = createRng(9);
  for (let i = 0; i < 200; i++) assert.equal(validatePicks(randomSquad(rng)), null);
  assert.deepEqual(randomSquad(createRng(4)), randomSquad(createRng(4)));
});
