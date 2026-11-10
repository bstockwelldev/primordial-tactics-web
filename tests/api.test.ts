import test from 'node:test';
import assert from 'node:assert/strict';
import { Deps, handle, MAX_ACTIVE_GAMES } from '../api/_lib/app';
import { MemoryStore } from '../api/_lib/store';
import type { GameEvent } from '../src/game/engine';

function world() {
  const store = new MemoryStore();
  const clock = { t: new Date('2026-11-10T12:00:00.000Z').getTime() };
  const sent: GameEvent[] = [];
  const deps: Deps = {
    store,
    now: () => new Date(clock.t).toISOString(),
    rng: () => 0.99,
    cronSecret: 'cron-secret',
    notifier: { notify: async (events) => void sent.push(...events) },
  };
  const call = (method: string, path: string, token?: string, body?: any) =>
    handle({ method, path, headers: token ? { authorization: `Bearer ${token}` } : {}, body }, deps) as Promise<{ status: number; body: any }>;
  const player = async (name: string) => (await call('POST', '/players', undefined, { name })).body as { playerId: string; token: string };
  const advance = (hours: number) => (clock.t += hours * 3600_000);
  return { store, deps, call, player, advance, sent };
}

test('players: create, authenticate, rename; the raw token is never stored', async () => {
  const w = world();
  const p = await w.player('  Hana  ');
  assert.equal((await w.call('GET', '/players/me', p.token)).body.name, 'Hana');
  assert.equal((await w.call('PATCH', '/players/me', p.token, { name: 'Hana II' })).body.name, 'Hana II');
  assert.equal((await w.call('GET', '/players/me', 'wrong')).status, 401);
  assert.equal((await w.call('GET', '/games')).status, 401);
  assert.equal((await w.call('POST', '/players', undefined, { name: '   ' })).status, 400);
  assert.ok(![...w.store.players.values()].some((row) => JSON.stringify(row).includes(p.token)));
});

test('full game over the API: create, list, join, play, win', async () => {
  const w = world();
  const hana = await w.player('Hana');
  const gus = await w.player('Gus');

  const created = await w.call('POST', '/games', hana.token, { visibility: 'open', turnHours: 8 });
  assert.equal(created.status, 201);
  const id = created.body.game.id;

  assert.deepEqual((await w.call('GET', '/games/open', gus.token)).body.games.map((g: any) => g.id), [id]);
  assert.equal((await w.call('GET', '/games/open', hana.token)).body.games.length, 0, 'own game not offered');
  assert.equal((await w.call('GET', `/games/${id}`, gus.token)).body.preview, true);

  const joined = await w.call('POST', `/games/${id}/join`, gus.token);
  assert.equal(joined.status, 200);
  assert.equal(joined.body.game.status, 'in_progress');
  assert.ok(w.sent.some((e) => e.kind === 'your_turn' && e.playerId === hana.playerId));

  let game = (await w.call('GET', `/games/${id}`, hana.token)).body.game;
  const act = async (token: string, action: any) => {
    const r = await w.call('POST', `/games/${id}/actions`, token, { version: game.version, action });
    if (r.body.game) game = r.body.game;
    return r;
  };

  assert.equal((await act(gus.token, { type: 'end_turn' })).status, 409, 'not guest turn');
  assert.equal((await act(hana.token, { type: 'move', unitId: 'p1_hero', x: 1, y: 2 })).status, 200);
  assert.equal((await act(hana.token, { type: 'end_turn' })).status, 200);
  assert.equal(game.activePlayerId, gus.playerId);
  assert.equal((await w.call('GET', '/games', gus.token)).body.games[0].activePlayerId, gus.playerId);

  assert.equal((await act(gus.token, { type: 'resign' })).status, 200);
  assert.equal(game.status, 'completed');
  assert.equal(game.winnerId, hana.playerId);
  assert.ok(w.sent.filter((e) => e.kind === 'game_over').length === 2);
});

test('a stale version is rejected with the fresh game, and double-submits apply once', async () => {
  const w = world();
  const hana = await w.player('Hana');
  const gus = await w.player('Gus');
  const id = (await w.call('POST', '/games', hana.token, {})).body.game.id;
  const v = (await w.call('POST', `/games/${id}/join`, gus.token)).body.game.version;

  const [a, b] = await Promise.all([
    w.call('POST', `/games/${id}/actions`, hana.token, { version: v, action: { type: 'end_turn' } }),
    w.call('POST', `/games/${id}/actions`, hana.token, { version: v, action: { type: 'end_turn' } }),
  ]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409]);
  const game = (await w.call('GET', `/games/${id}`, hana.token)).body.game;
  assert.equal(game.turnNumber, 2, 'turn ended exactly once');

  const stale = await w.call('POST', `/games/${id}/actions`, gus.token, { version: v, action: { type: 'end_turn' } });
  assert.equal(stale.status, 409);
  assert.equal(stale.body.game.version, game.version);
});

test('two players cannot both join the same game', async () => {
  const w = world();
  const [hana, gus, tess] = [await w.player('Hana'), await w.player('Gus'), await w.player('Tess')];
  const id = (await w.call('POST', '/games', hana.token, {})).body.game.id;
  const results = await Promise.all([w.call('POST', `/games/${id}/join`, gus.token), w.call('POST', `/games/${id}/join`, tess.token)]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
});

test('outsiders cannot read or act on a running game', async () => {
  const w = world();
  const [hana, gus, tess] = [await w.player('Hana'), await w.player('Gus'), await w.player('Tess')];
  const id = (await w.call('POST', '/games', hana.token, {})).body.game.id;
  const v = (await w.call('POST', `/games/${id}/join`, gus.token)).body.game.version;
  assert.equal((await w.call('GET', `/games/${id}`, tess.token)).status, 403);
  assert.equal((await w.call('POST', `/games/${id}/actions`, tess.token, { version: v, action: { type: 'resign' } })).status, 403);
  assert.equal((await w.call('GET', '/games/not-a-uuid', tess.token)).status, 404);
});

test('timer is enforced lazily on read: a missed turn passes, a second miss forfeits', async () => {
  const w = world();
  const hana = await w.player('Hana');
  const gus = await w.player('Gus');
  const id = (await w.call('POST', '/games', hana.token, { turnHours: 8 })).body.game.id;
  await w.call('POST', `/games/${id}/join`, gus.token);
  w.sent.length = 0;

  w.advance(9); // Hana misses her first turn
  let game = (await w.call('GET', `/games/${id}`, gus.token)).body.game;
  assert.equal(game.activePlayerId, gus.playerId);
  assert.equal(game.hostTimeouts, 1);
  assert.ok(w.sent.some((e) => e.kind === 'your_turn' && e.playerId === gus.playerId));

  // An action sent by the player whose time ran out is refused, not applied.
  const late = await w.call('POST', `/games/${id}/actions`, hana.token, { version: game.version, action: { type: 'end_turn' } });
  assert.equal(late.status, 409);

  await w.call('POST', `/games/${id}/actions`, gus.token, { version: game.version, action: { type: 'end_turn' } });
  w.advance(9); // Hana misses again
  game = (await w.call('GET', `/games/${id}`, hana.token)).body.game;
  assert.equal(game.status, 'completed');
  assert.equal(game.endReason, 'forfeit');
  assert.equal(game.winnerId, gus.playerId);
});

test('cron sweep settles games nobody opened, and needs the secret', async () => {
  const w = world();
  const hana = await w.player('Hana');
  const gus = await w.player('Gus');
  const id = (await w.call('POST', '/games', hana.token, { turnHours: 8 })).body.game.id;
  await w.call('POST', `/games/${id}/join`, gus.token);
  w.advance(24 * 3);

  assert.equal((await w.call('GET', '/cron/sweep')).status, 401);
  assert.equal((await w.call('GET', '/cron/sweep', 'wrong')).status, 401);
  const sweep = await w.call('GET', '/cron/sweep', 'cron-secret');
  assert.deepEqual(sweep.body, { overdue: 1, settled: 1 });
  assert.equal((await w.store.getGame(id))!.status, 'completed');
  assert.deepEqual((await w.call('GET', '/cron/sweep', 'cron-secret')).body, { overdue: 0, settled: 0 });
});

test('active game cap and turn-length validation', async () => {
  const w = world();
  const hana = await w.player('Hana');
  assert.equal((await w.call('POST', '/games', hana.token, { turnHours: 5 })).status, 400);
  for (let i = 0; i < MAX_ACTIVE_GAMES; i++) assert.equal((await w.call('POST', '/games', hana.token, {})).status, 201);
  assert.equal((await w.call('POST', '/games', hana.token, {})).status, 409);
});

test('push subscriptions are validated and stored per player', async () => {
  const w = world();
  const hana = await w.player('Hana');
  assert.equal((await w.call('POST', '/push/subscribe', hana.token, { endpoint: 'http://x', keys: {} })).status, 400);
  const good = { endpoint: 'https://push.example/abc', keys: { p256dh: 'k', auth: 'a' } };
  assert.equal((await w.call('POST', '/push/subscribe', hana.token, good)).status, 201);
  assert.equal((await w.store.listPushSubscriptions(hana.playerId)).length, 1);
});
