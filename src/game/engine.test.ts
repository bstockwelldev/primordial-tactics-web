import test from 'node:test';
import assert from 'node:assert/strict';
import { AsyncGame, applyAction, applyTimeouts, joinGame, newGame, MAX_LOG_ENTRIES } from './engine';
import { createRng } from './rng';

const T0 = '2026-11-10T12:00:00.000Z';
const at = (hours: number) => new Date(new Date(T0).getTime() + hours * 3600_000).toISOString();
const noCrit = () => 0.99;

function started(turnHours = 24): AsyncGame {
  const g = newGame({ id: 'g1', hostId: 'host', hostName: 'Hana', visibility: 'open', turnHours, now: T0 });
  const r = joinGame(g, 'guest', 'Gus', T0);
  assert.ok(r.ok);
  return r.game;
}
const ok = (r: ReturnType<typeof applyAction>) => {
  assert.ok(r.ok, r.ok ? '' : r.error);
  return r;
};

test('join starts the match: squads, host to move, deadline one turn out, host notified', () => {
  const g = newGame({ id: 'g1', hostId: 'host', hostName: 'Hana', visibility: 'open', turnHours: 8, now: T0 });
  assert.equal(g.status, 'waiting');
  const r = joinGame(g, 'guest', 'Gus', at(1));
  assert.ok(r.ok);
  assert.equal(r.game.status, 'in_progress');
  assert.equal(r.game.activePlayerId, 'host');
  assert.equal(r.game.turnDeadline, at(9));
  assert.equal(r.game.units.filter((u) => u.ownerId === 'host').length, 3);
  assert.equal(r.game.units.filter((u) => u.ownerId === 'guest').length, 3);
  assert.deepEqual(r.events.map((e) => `${e.kind}:${e.playerId}`), ['game_started:host', 'your_turn:host']);
  assert.equal(g.status, 'waiting', 'input not mutated');
});

test('cannot join your own game or a game that already started', () => {
  const g = newGame({ id: 'g1', hostId: 'host', hostName: 'Hana', visibility: 'open', turnHours: 24, now: T0 });
  assert.equal(joinGame(g, 'host', 'Hana', T0).ok, false);
  assert.equal(joinGame(started(), 'third', 'Tess', T0).ok, false);
});

test('only the active player may act, and only with their own units', () => {
  const g = started();
  const wrongTurn = applyAction(g, 'guest', { type: 'end_turn' }, noCrit, T0);
  assert.ok(!wrongTurn.ok && wrongTurn.status === 409);
  const notMine = applyAction(g, 'host', { type: 'move', unitId: 'p2_hero', x: 6, y: 3 }, noCrit, T0);
  assert.ok(!notMine.ok && notMine.status === 403);
  const stranger = applyAction(g, 'nobody', { type: 'end_turn' }, noCrit, T0);
  assert.ok(!stranger.ok && stranger.status === 403);
  const notMineAbility = applyAction(g, 'host', { type: 'ability', unitId: 'p2_hero', targetId: 'p1_hero', abilityId: 'tranq_shot' }, noCrit, T0);
  assert.ok(!notMineAbility.ok && notMineAbility.status === 403);
});

test('move validates the rules and spends AP', () => {
  const g = started();
  const r = ok(applyAction(g, 'host', { type: 'move', unitId: 'p1_hero', x: 1, y: 2 }, noCrit, T0));
  const hero = r.game.units.find((u) => u.id === 'p1_hero')!;
  assert.deepEqual([hero.x, hero.y, hero.ap], [1, 2, 2]);
  assert.equal(applyAction(g, 'host', { type: 'move', unitId: 'p1_hero', x: 7, y: 5 }, noCrit, T0).ok, false, 'too far');
  assert.equal(applyAction(g, 'host', { type: 'move', unitId: 'p1_raptor', x: 2, y: 1 }, noCrit, T0).ok, false, 'rock');
  assert.equal(applyAction(g, 'host', { type: 'move', unitId: 'p1_hero', x: 1, y: 1 }, noCrit, T0).ok, false, 'occupied');
});

test('ability: range, AP, friendly fire and class passives are enforced', () => {
  let g = started();
  const far = applyAction(g, 'host', { type: 'ability', unitId: 'p1_hero', targetId: 'p2_hero', abilityId: 'tranq_shot' }, noCrit, T0);
  assert.ok(!far.ok && /range/.test(far.error));
  const friendly = applyAction(g, 'host', { type: 'ability', unitId: 'p1_hero', targetId: 'p1_raptor', abilityId: 'spear_thrust' }, noCrit, T0);
  assert.ok(!friendly.ok);

  // Put the two heroes next to each other and compare a Human attacker with a class-less one.
  const place = (game: AsyncGame, unitClass: any): AsyncGame => ({
    ...game,
    units: game.units.map((u) => (u.id === 'p1_hero' ? { ...u, x: 6, y: 3, unitClass } : u)),
  });
  const human = ok(applyAction(place(g, 'Human'), 'host', { type: 'ability', unitId: 'p1_hero', targetId: 'p2_hero', abilityId: 'spear_thrust' }, noCrit, T0));
  const plain = ok(applyAction(place(g, 'Scout'), 'host', { type: 'ability', unitId: 'p1_hero', targetId: 'p2_hero', abilityId: 'spear_thrust' }, noCrit, T0));
  const dmg = (r: typeof human) => 190 - r.game.units.find((u) => u.id === 'p2_hero')!.hp;
  assert.ok(dmg(human) > dmg(plain), 'Human +10% passive fires in PvP');

  g = human.game;
  assert.equal(g.units.find((u) => u.id === 'p1_hero')!.ap, 2);
  // 2 AP left: tranq (2) is affordable once, then nothing.
  g = ok(applyAction(g, 'host', { type: 'ability', unitId: 'p1_hero', targetId: 'p2_hero', abilityId: 'tranq_shot' }, noCrit, T0)).game;
  const broke = applyAction(g, 'host', { type: 'ability', unitId: 'p1_hero', targetId: 'p2_hero', abilityId: 'spear_thrust' }, noCrit, T0);
  assert.ok(!broke.ok && /Action Points/.test(broke.error));
  assert.ok(g.units.find((u) => u.id === 'p2_hero')!.torpor > 0, 'torpor applied');
});

test('self ability applies its effect to the caster and deals no damage', () => {
  const g = started();
  const r = ok(applyAction(g, 'host', { type: 'ability', unitId: 'p1_trike', targetId: 'p2_hero', abilityId: 'frill_fortress' }, noCrit, T0));
  const trike = r.game.units.find((u) => u.id === 'p1_trike')!;
  assert.equal(trike.hp, trike.maxHp);
  assert.ok(trike.statusEffects.some((s) => s.type === 'shield'));
  assert.equal(r.game.units.find((u) => u.id === 'p2_hero')!.hp, 190);
});

test('end turn hands over: AP refreshed, new deadline, other player notified, miss count reset', () => {
  let g = { ...started(), hostTimeouts: 1 };
  g = ok(applyAction(g, 'host', { type: 'move', unitId: 'p1_hero', x: 1, y: 2 }, noCrit, at(2))).game;
  const r = ok(applyAction(g, 'host', { type: 'end_turn' }, noCrit, at(3)));
  assert.equal(r.game.activePlayerId, 'guest');
  assert.equal(r.game.turnNumber, 2);
  assert.equal(r.game.turnDeadline, at(27));
  assert.equal(r.game.hostTimeouts, 0);
  assert.deepEqual(r.events, [{ kind: 'your_turn', playerId: 'guest', gameId: 'g1' }]);
  const back = ok(applyAction(r.game, 'guest', { type: 'end_turn' }, noCrit, at(4)));
  assert.equal(back.game.units.find((u) => u.id === 'p1_hero')!.ap, 3);
});

test('eliminating the last enemy unit ends the game', () => {
  const g = started();
  const rigged: AsyncGame = {
    ...g,
    units: g.units.map((u) =>
      u.ownerId === 'guest' ? { ...u, hp: u.id === 'p2_hero' ? 1 : 0, x: u.id === 'p2_hero' ? 1 : u.x, y: u.id === 'p2_hero' ? 2 : u.y } : u
    ),
  };
  const r = ok(applyAction(rigged, 'host', { type: 'ability', unitId: 'p1_hero', targetId: 'p2_hero', abilityId: 'spear_thrust' }, noCrit, T0));
  assert.equal(r.game.status, 'completed');
  assert.equal(r.game.winnerId, 'host');
  assert.equal(r.game.endReason, 'elimination');
  assert.equal(r.game.turnDeadline, null);
  assert.deepEqual(r.events.map((e) => e.kind), ['game_over', 'game_over']);
  assert.equal(applyAction(r.game, 'host', { type: 'end_turn' }, noCrit, T0).ok, false, 'no moves after the end');
});

test('resign works on either turn and awards the opponent', () => {
  const r = ok(applyAction(started(), 'guest', { type: 'resign' }, noCrit, T0));
  assert.equal(r.game.winnerId, 'host');
  assert.equal(r.game.endReason, 'resign');
});

test('timer: nothing happens before the deadline', () => {
  const g = started();
  const r = applyTimeouts(g, at(23.9));
  assert.equal(r.changed, false);
  assert.equal(r.game, g);
});

test('timer: one missed turn passes the turn; the next clock starts at the old deadline', () => {
  const r = applyTimeouts(started(), at(25));
  assert.equal(r.changed, true);
  assert.equal(r.game.status, 'in_progress');
  assert.equal(r.game.activePlayerId, 'guest');
  assert.equal(r.game.hostTimeouts, 1);
  assert.equal(r.game.turnDeadline, at(48));
  assert.deepEqual(r.events, [{ kind: 'your_turn', playerId: 'guest', gameId: 'g1' }]);
});

test('timer: two consecutive misses by the same player forfeit', () => {
  let g = applyTimeouts(started(), at(25)).game; // host miss 1
  g = ok(applyAction(g, 'guest', { type: 'end_turn' }, noCrit, at(26))).game; // guest plays
  const r = applyTimeouts(g, at(51)); // host miss 2 (deadline was 26h + 24h)
  assert.equal(r.game.status, 'completed');
  assert.equal(r.game.winnerId, 'guest');
  assert.equal(r.game.endReason, 'forfeit');
});

test('timer: playing a turn clears the miss count, so misses must be consecutive', () => {
  let g = applyTimeouts(started(), at(25)).game; // host miss 1
  g = ok(applyAction(g, 'guest', { type: 'end_turn' }, noCrit, at(26))).game;
  g = ok(applyAction(g, 'host', { type: 'end_turn' }, noCrit, at(27))).game; // host plays: reset
  g = ok(applyAction(g, 'guest', { type: 'end_turn' }, noCrit, at(28))).game;
  const r = applyTimeouts(g, at(53)); // host misses again: only 1/2
  assert.equal(r.game.status, 'in_progress');
  assert.equal(r.game.hostTimeouts, 1);
});

test('timer: a long-abandoned game resolves in a single call', () => {
  const r = applyTimeouts(started(8), at(24 * 30));
  assert.equal(r.game.status, 'completed');
  assert.equal(r.game.endReason, 'forfeit');
  assert.equal(r.game.winnerId, 'guest', 'host missed first, so host forfeits first');
});

test('same seed, same actions, same game', () => {
  const play = (seed: number) => {
    const rng = createRng(seed);
    let g = started();
    g = { ...g, units: g.units.map((u) => (u.id === 'p1_hero' ? { ...u, x: 6, y: 3 } : u)) };
    for (let i = 0; i < 3; i++) g = ok(applyAction(g, 'host', { type: 'ability', unitId: 'p1_hero', targetId: 'p2_hero', abilityId: 'spear_thrust' }, rng, T0)).game;
    return JSON.stringify(g);
  };
  assert.equal(play(5), play(5));
});

test('action log is capped', () => {
  let g = started();
  for (let i = 0; i < MAX_LOG_ENTRIES + 20; i++) {
    g = ok(applyAction(g, g.activePlayerId!, { type: 'end_turn' }, noCrit, T0)).game;
  }
  assert.equal(g.actionLogs.length, MAX_LOG_ENTRIES);
});
