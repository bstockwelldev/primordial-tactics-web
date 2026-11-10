import test from 'node:test';
import assert from 'node:assert/strict';
import { PushNotifier, PushPayload } from '../api/_lib/push';
import { MemoryStore } from '../api/_lib/store';
import { Deps, handle } from '../api/_lib/app';

test('push: the next player is told it is their turn; dead subscriptions are removed', async () => {
  const store = new MemoryStore();
  const sent: Array<{ endpoint: string; payload: PushPayload }> = [];
  const notifier = new PushNotifier(store, async (sub, payload) => {
    sent.push({ endpoint: sub.endpoint, payload });
    return sub.endpoint.includes('gone') ? 410 : 201;
  });
  const deps: Deps = { store, now: () => '2026-11-10T12:00:00.000Z', rng: () => 0.99, notifier };
  const call = (method: string, path: string, token?: string, body?: any) =>
    handle({ method, path, headers: token ? { authorization: `Bearer ${token}` } : {}, body }, deps) as Promise<{ status: number; body: any }>;

  const hana = (await call('POST', '/players', undefined, { name: 'Hana' })).body;
  const gus = (await call('POST', '/players', undefined, { name: 'Gus' })).body;
  await call('POST', '/push/subscribe', hana.token, { endpoint: 'https://push.example/hana', keys: { p256dh: 'k', auth: 'a' } });
  await call('POST', '/push/subscribe', gus.token, { endpoint: 'https://push.example/gus', keys: { p256dh: 'k', auth: 'a' } });
  await call('POST', '/push/subscribe', gus.token, { endpoint: 'https://push.example/gone', keys: { p256dh: 'k', auth: 'a' } });

  const id = (await call('POST', '/games', hana.token, { turnHours: 8 })).body.game.id;
  const game = (await call('POST', `/games/${id}/join`, gus.token)).body.game;
  // Joining fires game_started + your_turn for the host: one message, the more important one.
  assert.deepEqual(sent.map((s) => [s.endpoint, s.payload.title]), [['https://push.example/hana', 'Your turn']]);
  assert.match(sent[0].payload.body, /Gus/);
  assert.equal(sent[0].payload.gameId, id);

  sent.length = 0;
  await call('POST', `/games/${id}/actions`, hana.token, { version: game.version, action: { type: 'end_turn' } });
  assert.deepEqual(sent.map((s) => s.endpoint).sort(), ['https://push.example/gone', 'https://push.example/gus']);
  assert.deepEqual((await store.listPushSubscriptions(gus.playerId)).map((s) => s.endpoint), ['https://push.example/gus']);
});

test('push: a failing push service never fails the move', async () => {
  const store = new MemoryStore();
  const notifier = new PushNotifier(store, async () => {
    throw new Error('push service down');
  });
  const deps: Deps = { store, now: () => '2026-11-10T12:00:00.000Z', rng: () => 0.99, notifier };
  const call = (method: string, path: string, token?: string, body?: any) =>
    handle({ method, path, headers: token ? { authorization: `Bearer ${token}` } : {}, body }, deps) as Promise<{ status: number; body: any }>;
  const hana = (await call('POST', '/players', undefined, { name: 'Hana' })).body;
  const gus = (await call('POST', '/players', undefined, { name: 'Gus' })).body;
  await call('POST', '/push/subscribe', hana.token, { endpoint: 'https://push.example/hana', keys: { p256dh: 'k', auth: 'a' } });
  const id = (await call('POST', '/games', hana.token, {})).body.game.id;
  assert.equal((await call('POST', `/games/${id}/join`, gus.token)).status, 200);
});
