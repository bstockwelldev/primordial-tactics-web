import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { PostgresStore } from '../api/_lib/postgresStore';
import { Deps, handle } from '../api/_lib/app';

// Runs the real store, and a full game through the API, against a real Postgres.
// Set TEST_POSTGRES_URL to an EMPTY scratch database (the schema is dropped and recreated).
const url = process.env.TEST_POSTGRES_URL;
const maybe = url ? test : test.skip;

let store: PostgresStore;

test.before(async () => {
  if (!url) return;
  store = new PostgresStore(url);
  await store.sql.unsafe('drop table if exists push_subscriptions, games, players cascade');
  await store.sql.unsafe(readFileSync(new URL('../supabase/migrations/0001_async_multiplayer.sql', import.meta.url), 'utf8'));
});
test.after(async () => {
  if (store) await store.sql.end();
});

function api() {
  const clock = { t: Date.parse('2026-11-10T12:00:00.000Z') };
  const deps: Deps = { store, now: () => new Date(clock.t).toISOString(), rng: () => 0.99, cronSecret: 's' };
  const call = (method: string, path: string, token?: string, body?: any) =>
    handle({ method, path, headers: token ? { authorization: `Bearer ${token}` } : {}, body }, deps) as Promise<{ status: number; body: any }>;
  const player = async (name: string) => (await call('POST', '/players', undefined, { name })).body as { playerId: string; token: string };
  return { call, player, advance: (h: number) => (clock.t += h * 3600_000) };
}

maybe('postgres: a game round-trips through the database unchanged', async () => {
  const w = api();
  const hana = await w.player('Hana');
  const gus = await w.player('Gus');
  const id = (await w.call('POST', '/games', hana.token, { turnHours: 8 })).body.game.id;
  const joined = (await w.call('POST', `/games/${id}/join`, gus.token)).body.game;
  const read = (await w.call('GET', `/games/${id}`, hana.token)).body.game;
  assert.deepEqual(read, joined);
  assert.equal(read.turnDeadline, '2026-11-10T20:00:00.000Z');
  assert.equal(read.units.length, 6);
});

maybe('postgres: version check is atomic — of 8 simultaneous end-turns exactly one lands', async () => {
  const w = api();
  const hana = await w.player('Hana');
  const gus = await w.player('Gus');
  const id = (await w.call('POST', '/games', hana.token, {})).body.game.id;
  const v = (await w.call('POST', `/games/${id}/join`, gus.token)).body.game.version;
  const results = await Promise.all(
    Array.from({ length: 8 }, () => w.call('POST', `/games/${id}/actions`, hana.token, { version: v, action: { type: 'end_turn' } }))
  );
  assert.equal(results.filter((r) => r.status === 200).length, 1);
  assert.equal(results.filter((r) => r.status === 409).length, 7);
  assert.equal((await store.getGame(id))!.turnNumber, 2);
});

maybe('postgres: only one of two simultaneous joiners gets the seat', async () => {
  const w = api();
  const [hana, gus, tess] = [await w.player('Hana'), await w.player('Gus'), await w.player('Tess')];
  const id = (await w.call('POST', '/games', hana.token, {})).body.game.id;
  const r = await Promise.all([w.call('POST', `/games/${id}/join`, gus.token), w.call('POST', `/games/${id}/join`, tess.token)]);
  assert.deepEqual(r.map((x) => x.status).sort(), [200, 409]);
});

maybe('postgres: lists, cap count, timeout forfeit and cron sweep', async () => {
  const w = api();
  const hana = await w.player('Hana');
  const gus = await w.player('Gus');
  const open = (await w.call('POST', '/games', hana.token, { visibility: 'open' })).body.game.id;
  await w.call('POST', '/games', hana.token, { visibility: 'invite' });
  const live = (await w.call('POST', '/games', hana.token, { turnHours: 8 })).body.game.id;
  await w.call('POST', `/games/${live}/join`, gus.token);

  const openIds = (await w.call('GET', '/games/open', gus.token)).body.games.map((g: any) => g.id);
  assert.ok(openIds.includes(open) && !openIds.includes(live), 'open list: waiting + open only');
  assert.equal((await w.call('GET', '/games', hana.token)).body.games.length, 3);
  assert.equal(await store.countActiveGames(hana.playerId), 3);
  assert.equal(await store.countActiveGames(gus.playerId), 1);

  w.advance(24 * 5);
  // Earlier tests left running games in this database too, so only a lower bound is exact.
  const sweep = (await w.call('GET', '/cron/sweep', 's')).body;
  assert.ok(sweep.overdue >= 1 && sweep.settled === sweep.overdue, JSON.stringify(sweep));
  assert.deepEqual((await w.call('GET', '/cron/sweep', 's')).body, { overdue: 0, settled: 0 });
  const done = (await store.getGame(live))!;
  assert.equal(done.status, 'completed');
  assert.equal(done.endReason, 'forfeit');
  assert.equal(done.winnerId, gus.playerId);
  assert.equal(await store.countActiveGames(gus.playerId), 0);
});

maybe('postgres: push subscriptions upsert by endpoint and delete', async () => {
  const w = api();
  const hana = await w.player('Hana');
  const endpoint = `https://push.example/${randomUUID()}`;
  await store.savePushSubscription({ endpoint, playerId: hana.playerId, keys: { p256dh: 'a', auth: 'b' } });
  await store.savePushSubscription({ endpoint, playerId: hana.playerId, keys: { p256dh: 'c', auth: 'd' } });
  const subs = await store.listPushSubscriptions(hana.playerId);
  assert.deepEqual(subs.map((s) => s.keys.p256dh), ['c']);
  await store.deletePushSubscription(endpoint);
  assert.equal((await store.listPushSubscriptions(hana.playerId)).length, 0);
});

maybe('postgres: schema rejects bad rows and hides tables from the public roles', async () => {
  await assert.rejects(store.sql`insert into players (id, name, token_hash) values (${randomUUID()}, '', 'x')`);
  for (const table of ['players', 'games', 'push_subscriptions']) {
    const [row] = await store.sql`
      select relrowsecurity as rls,
             has_table_privilege('anon', c.oid, 'select') as anon_can_read,
             has_table_privilege('authenticated', c.oid, 'insert') as auth_can_write
      from pg_class c where relname = ${table} and relnamespace = 'public'::regnamespace`;
    assert.deepEqual({ ...row }, { rls: true, anon_can_read: false, auth_can_write: false }, table);
  }
});
