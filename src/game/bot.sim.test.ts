import test from 'node:test';
import assert from 'node:assert/strict';
import { BOT_PROFILES as P, BOT_TRANSITIONS, BotState, runBotTurn } from './bot';
import { simulateMatch, Pilot } from './sim';
import { buildArenaGrid, buildSoloUnits } from './arenaSetup';
import { ISLAND_CAMPAIGN_SECTORS } from './constants';
import { createRng } from './rng';
import { TamedDino, UnitEntity } from '../types/game';

// Checks that the PvE / campaign bot is deterministic, structurally sound, and plays at
// the intended "moderate" level. Skill is measured on MIRRORED squads with sides swapped,
// so squad balance and move order cancel out and only decision quality is left.

const grid = buildArenaGrid();
const SEEDS = 40;

const starters: TamedDino[] = [
  { instanceId: 'a', speciesId: 'velociraptor', customName: 'Ghostclaw', level: 5, xp: 0, currentHp: 160, maxHp: 160, currentTorpor: 0, maxTorpor: 120, attack: 48, defense: 16, speed: 4, equippedAbilities: [] },
  { instanceId: 'b', speciesId: 'triceratops', customName: 'Shieldhorn', level: 4, xp: 0, currentHp: 290, maxHp: 290, currentTorpor: 0, maxTorpor: 260, attack: 34, defense: 38, speed: 2, equippedAbilities: [] },
];
const skirmish = () => buildSoloUnits('Tester', starters, null);
const playerSquad = skirmish().filter((u) => u.isPlayer);
const mirrored: UnitEntity[] = [
  ...playerSquad,
  ...playerSquad.map((u) => ({ ...u, id: `m_${u.id}`, isPlayer: false, ownerId: 'ai_bot', x: 7 - u.x, y: 5 - u.y })),
];

/** Share of mirrored matches won by `a` against `b`, each seed played from both sides. */
function winRate(a: Pilot, b: Pilot): { a: number; unresolved: number } {
  let wins = 0;
  let unresolved = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    const asPlayer = simulateMatch({ units: mirrored, grid, seed, player: a, enemy: b });
    const asEnemy = simulateMatch({ units: mirrored, grid, seed, player: b, enemy: a });
    wins += (asPlayer.winner === 'player' ? 1 : 0) + (asEnemy.winner === 'enemy' ? 1 : 0);
    unresolved += [asPlayer, asEnemy].filter((r) => r.winner === 'unfinished').length;
  }
  return { a: wins / (SEEDS * 2), unresolved };
}

// ---------------------------------------------------------------- determinism

test('same seed replays the same match exactly; different seeds diverge', () => {
  const run = (seed: number) =>
    JSON.stringify(simulateMatch({ units: skirmish(), grid, seed, player: P.moderate, enemy: P.moderate }));
  assert.equal(run(7), run(7));
  assert.equal(run(123456), run(123456));
  const outcomes = new Set([1, 2, 3, 4, 5, 6, 7, 8].map(run));
  assert.ok(outcomes.size > 1, 'dice actually depend on the seed');
});

test('a bot turn is a pure function of (units, seed): logs and trace included', () => {
  const turn = () => runBotTurn(skirmish(), grid, 1, createRng(99), { timestamp: '' });
  assert.deepEqual(turn(), turn());
});

test('bot decisions use no randomness: only attack rolls draw from the rng', () => {
  let draws = 0;
  const counting = () => (draws++, 0.5);
  const { logs } = runBotTurn(mirrored, grid, 5, counting, { timestamp: '' });
  const attacks = logs.filter((l) => l.damage !== undefined && l.damage > 0).length;
  assert.equal(draws, attacks);
});

// -------------------------------------------------------------- state machine

test('every unit walks only legal transitions and always ends in DONE', () => {
  for (let seed = 1; seed <= 10; seed++) {
    const rng = createRng(seed);
    let units = skirmish();
    for (let round = 1; round <= 12; round++) {
      for (const side of ['player', 'enemy'] as const) {
        units = units.map((u) => (u.isPlayer === (side === 'player') ? { ...u, ap: u.maxAp } : u));
        const res = runBotTurn(units, grid, round, rng, { side, timestamp: '' });
        const byUnit = new Map<string, BotState[]>();
        for (const t of res.trace) byUnit.set(t.unitId, [...(byUnit.get(t.unitId) || []), t.state]);
        for (const [id, states] of byUnit) {
          assert.equal(states[0], 'ASSESS', id);
          assert.equal(states[states.length - 1], 'DONE', id);
          assert.ok(states.length <= 2 + 2 * 3, `${id} bounded by its 3 AP: ${states.join('>')}`);
          for (let i = 1; i < states.length; i++) {
            assert.ok(BOT_TRANSITIONS[states[i - 1]].includes(states[i]), `${id}: ${states[i - 1]} -> ${states[i]}`);
          }
        }
        units = res.units;
      }
    }
  }
});

test('board invariants hold through whole matches (all sectors + skirmish)', () => {
  const setups = [null, ...ISLAND_CAMPAIGN_SECTORS];
  for (const sector of setups) {
    for (let seed = 1; seed <= 5; seed++) {
      const rng = createRng(seed);
      const sectorGrid = buildArenaGrid((sector as any)?.islandId);
      let units = buildSoloUnits('Tester', starters, sector as any);
      for (let round = 1; round <= 15; round++) {
        for (const side of ['player', 'enemy'] as const) {
          units = units.map((u) => (u.isPlayer === (side === 'player') ? { ...u, ap: u.maxAp } : u));
          units = runBotTurn(units, sectorGrid, round, rng, { side, timestamp: '' }).units;
          const alive = units.filter((u) => u.hp > 0);
          assert.equal(new Set(alive.map((u) => `${u.x},${u.y}`)).size, alive.length, 'no two living units share a tile');
          for (const u of units) {
            assert.ok(u.ap >= 0 && u.ap <= u.maxAp, `${u.id} ap in range`);
            assert.ok(u.hp >= 0 && u.hp <= u.maxHp, `${u.id} hp in range`);
            assert.ok(u.torpor >= 0 && u.torpor <= u.maxTorpor, `${u.id} torpor in range`);
            if (u.hp > 0) assert.ok(sectorGrid.find((t) => t.x === u.x && t.y === u.y)?.walkable, `${u.id} on walkable tile`);
          }
        }
      }
    }
  }
});

test('a unit blocked by a rock routes around it instead of freezing (regression)', () => {
  // Rock at (2,1) sits between them: straight-line distance cannot shrink in one move.
  let units = skirmish().filter((u) => u.id === 'player_raptor' || u.id === 'enemy_ankylosaur');
  units = units.map((u) => (u.id === 'enemy_ankylosaur' ? { ...u, x: 3, y: 1 } : { ...u, x: 1, y: 1 }));
  const rng = createRng(1);
  for (let round = 4; round <= 6; round++) {
    units = runBotTurn(units.map((u) => ({ ...u, ap: u.maxAp })), grid, round, rng, { timestamp: '' }).units;
  }
  assert.ok(units.find((u) => u.id === 'player_raptor')!.hp < 160, 'ankylosaur reached and hit the raptor');
});

// ---------------------------------------------------------------------- skill

test('skill: moderate always beats a player who never acts, and matches always finish', () => {
  const r = winRate(P.moderate, 'passive');
  assert.equal(r.a, 1);
  assert.equal(r.unresolved, 0);
});

test('skill: moderate cannot be farmed by a squad that just stands still (the old exploit)', () => {
  const r = winRate(P.moderate, P.static);
  assert.ok(r.a >= 0.8, `moderate won ${(r.a * 100).toFixed(0)}% vs stationary`);
  assert.equal(r.unresolved, 0);
});

test('skill: moderate clearly out-plays the easy bot', () => {
  const r = winRate(P.moderate, P.easy);
  assert.ok(r.a >= 0.8, `moderate won ${(r.a * 100).toFixed(0)}% vs easy`);
  assert.equal(r.unresolved, 0);
});

test('skill: the ladder is ordered — easy beats stationary, stationary beats nothing that moves', () => {
  assert.ok(winRate(P.easy, P.static).a >= 0.7);
  assert.equal(winRate(P.easy, 'passive').a, 1);
});

test('skill: moderate vs moderate is decided by position and dice, not a side bias in the code', () => {
  // Sides are swapped per seed, so anything other than an even split would mean asymmetric logic.
  const r = winRate(P.moderate, P.moderate);
  assert.equal(r.a, 0.5);
  assert.equal(r.unresolved, 0);
});

// ------------------------------------------------------------ PvE + campaign

test('PvE skirmish: the bot finishes every match, whoever it faces', () => {
  for (const player of ['passive', P.static, P.easy, P.moderate] as Pilot[]) {
    for (let seed = 1; seed <= 15; seed++) {
      const r = simulateMatch({ units: skirmish(), grid, seed, player, enemy: P.moderate });
      assert.notEqual(r.winner, 'unfinished');
      if (player === 'passive') assert.equal(r.winner, 'enemy');
    }
  }
});

test('campaign: in all 12 sectors the bot hunts down an idle player and every match finishes', () => {
  assert.equal(ISLAND_CAMPAIGN_SECTORS.length, 12);
  for (const sector of ISLAND_CAMPAIGN_SECTORS) {
    for (let seed = 1; seed <= 8; seed++) {
      const units = buildSoloUnits('Tester', starters, sector as any);
      const sg = buildArenaGrid(sector.islandId);
      const idle = simulateMatch({ units, grid: sg, seed, player: 'passive', enemy: P.moderate });
      assert.equal(idle.winner, 'enemy', `${sector.id} vs idle player`);
      const active = simulateMatch({ units, grid: sg, seed, player: P.moderate, enemy: P.moderate });
      assert.notEqual(active.winner, 'unfinished', `${sector.id} terminates`);
    }
  }
});

test('campaign: the opening sector is winnable by a moderate player with the starter squad', () => {
  const sector = ISLAND_CAMPAIGN_SECTORS[0];
  let wins = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    const units = buildSoloUnits('Tester', starters, sector as any);
    if (simulateMatch({ units, grid: buildArenaGrid(sector.islandId), seed, player: P.moderate, enemy: P.moderate }).winner === 'player') wins++;
  }
  assert.ok(wins / SEEDS >= 0.9, `won ${wins}/${SEEDS}`);
});

test('island terrain: water/mud/bones appear only on open grass, never rocks, foliage or spawns', () => {
  const plain = buildArenaGrid();
  for (const [island, type] of [['primoris', 'water'], ['caldera', 'mud'], ['magitek_core', 'bones']] as const) {
    const g = buildArenaGrid(island);
    assert.ok(g.some((t) => t.type === type), `${island} has ${type}`);
    for (const t of g) {
      const p = plain.find((q) => q.x === t.x && q.y === t.y)!;
      if (t.type !== p.type) assert.equal(p.type, 'grass');
      if (t.x <= 1 || t.x >= 6) assert.equal(t.type, p.type, 'spawn columns untouched');
    }
  }
  assert.deepEqual(buildArenaGrid('tempest'), plain, 'tempest is open sky');
});
