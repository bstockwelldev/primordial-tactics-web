import postgres from 'postgres';
import type { AsyncGame } from '../../src/game/engine.js';
import type { OpenGamesQuery, Player, PushSubscriptionRecord, Store } from './store.js';

// Supabase Postgres over a direct (pooled) connection. Schema: supabase/migrations.

type Sql = ReturnType<typeof postgres>;

interface GameRow {
  id: string;
  status: AsyncGame['status'];
  visibility: AsyncGame['visibility'];
  host_id: string;
  guest_id: string | null;
  active_player_id: string | null;
  turn_number: number;
  turn_hours: number;
  turn_deadline: Date | null;
  host_timeouts: number;
  guest_timeouts: number;
  winner_id: string | null;
  end_reason: AsyncGame['endReason'];
  state: { units: AsyncGame['units']; actionLogs: AsyncGame['actionLogs']; hostName: string; guestName: string | null };
  version: number;
  created_at: Date;
  updated_at: Date;
}

const iso = (v: Date | string | null) => (v ? new Date(v).toISOString() : null);

function fromRow(r: GameRow): AsyncGame {
  return {
    id: r.id,
    status: r.status,
    visibility: r.visibility,
    hostId: r.host_id,
    hostName: r.state.hostName,
    guestId: r.guest_id,
    guestName: r.state.guestName,
    activePlayerId: r.active_player_id,
    turnNumber: r.turn_number,
    turnHours: r.turn_hours,
    turnDeadline: iso(r.turn_deadline),
    hostTimeouts: r.host_timeouts,
    guestTimeouts: r.guest_timeouts,
    winnerId: r.winner_id,
    endReason: r.end_reason,
    units: r.state.units,
    actionLogs: r.state.actionLogs,
    version: r.version,
    createdAt: iso(r.created_at)!,
    updatedAt: iso(r.updated_at)!,
  };
}

const stateOf = (g: AsyncGame) => ({ units: g.units, actionLogs: g.actionLogs, hostName: g.hostName, guestName: g.guestName });

export class PostgresStore implements Store {
  readonly sql: Sql;

  constructor(connectionString: string) {
    this.sql = postgres(connectionString, {
      max: 1, // one connection per serverless instance
      idle_timeout: 20,
      prepare: false, // required behind Supabase's transaction pooler
      onnotice: () => {},
    });
  }

  async createPlayer(p: Player & { tokenHash: string }) {
    await this.sql`insert into players (id, name, token_hash) values (${p.id}, ${p.name}, ${p.tokenHash})`;
  }
  async getPlayerByTokenHash(tokenHash: string) {
    const rows = await this.sql<Player[]>`select id, name from players where token_hash = ${tokenHash}`;
    return rows[0] ?? null;
  }
  async renamePlayer(id: string, name: string) {
    await this.sql`update players set name = ${name} where id = ${id}`;
  }

  async insertGame(g: AsyncGame) {
    await this.sql`
      insert into games (id, status, visibility, host_id, guest_id, active_player_id, turn_number, turn_hours,
        turn_deadline, host_timeouts, guest_timeouts, winner_id, end_reason, state, version, created_at, updated_at)
      values (${g.id}, ${g.status}, ${g.visibility}, ${g.hostId}, ${g.guestId}, ${g.activePlayerId}, ${g.turnNumber},
        ${g.turnHours}, ${g.turnDeadline}, ${g.hostTimeouts}, ${g.guestTimeouts}, ${g.winnerId}, ${g.endReason},
        ${this.sql.json(stateOf(g) as any)}, ${g.version}, ${g.createdAt}, ${g.updatedAt})`;
  }
  async getGame(id: string) {
    const rows = await this.sql<GameRow[]>`select * from games where id = ${id}`;
    return rows[0] ? fromRow(rows[0]) : null;
  }
  async updateGame(g: AsyncGame, expectedVersion: number) {
    // The version predicate makes this an atomic compare-and-swap.
    const rows = await this.sql`
      update games set
        status = ${g.status}, visibility = ${g.visibility}, guest_id = ${g.guestId},
        active_player_id = ${g.activePlayerId}, turn_number = ${g.turnNumber}, turn_hours = ${g.turnHours},
        turn_deadline = ${g.turnDeadline}, host_timeouts = ${g.hostTimeouts}, guest_timeouts = ${g.guestTimeouts},
        winner_id = ${g.winnerId}, end_reason = ${g.endReason}, state = ${this.sql.json(stateOf(g) as any)},
        version = ${expectedVersion + 1}, updated_at = ${g.updatedAt}
      where id = ${g.id} and version = ${expectedVersion}
      returning id`;
    return rows.length === 1;
  }
  async listGamesForPlayer(playerId: string, finishedLimit: number) {
    const active = await this.sql<GameRow[]>`
      select * from games where (host_id = ${playerId} or guest_id = ${playerId}) and status <> 'completed'
      order by updated_at desc`;
    const finished = await this.sql<GameRow[]>`
      select * from games where (host_id = ${playerId} or guest_id = ${playerId}) and status = 'completed'
      order by updated_at desc limit ${finishedLimit}`;
    return [...active, ...finished].map(fromRow);
  }
  async listOpenGames(excludePlayerId: string, limit: number, opts: OpenGamesQuery = {}) {
    const rows = await this.sql<GameRow[]>`
      select * from games
      where status = 'waiting' and visibility = 'open' and host_id <> ${excludePlayerId}
        and (${opts.before ?? null}::timestamptz is null or created_at < ${opts.before ?? null}::timestamptz)
        and (${opts.createdAfter ?? null}::timestamptz is null or created_at > ${opts.createdAfter ?? null}::timestamptz)
      order by created_at desc limit ${limit}`;
    return rows.map(fromRow);
  }
  async deleteExpiredOpenGames(createdBefore: string, limit: number) {
    const rows = await this.sql<Array<{ id: string }>>`
      delete from games
      where id in (
        select id from games
        where status = 'waiting' and visibility = 'open' and created_at < ${createdBefore}::timestamptz
        limit ${limit})
      returning id`;
    return rows.length;
  }
  async countActiveGames(playerId: string) {
    const rows = await this.sql<Array<{ n: number }>>`
      select count(*)::int as n from games
      where (host_id = ${playerId} or guest_id = ${playerId}) and status <> 'completed'`;
    return rows[0].n;
  }
  async listOverdueGames(now: string, limit: number) {
    const rows = await this.sql<GameRow[]>`
      select * from games where status = 'in_progress' and turn_deadline < ${now}
      order by turn_deadline asc limit ${limit}`;
    return rows.map(fromRow);
  }

  async savePushSubscription(s: PushSubscriptionRecord) {
    await this.sql`
      insert into push_subscriptions (endpoint, player_id, keys)
      values (${s.endpoint}, ${s.playerId}, ${this.sql.json(s.keys)})
      on conflict (endpoint) do update set player_id = excluded.player_id, keys = excluded.keys`;
  }
  async listPushSubscriptions(playerId: string) {
    const rows = await this.sql<Array<{ endpoint: string; player_id: string; keys: PushSubscriptionRecord['keys'] }>>`
      select endpoint, player_id, keys from push_subscriptions where player_id = ${playerId}`;
    return rows.map((r) => ({ endpoint: r.endpoint, playerId: r.player_id, keys: r.keys }));
  }
  async deletePushSubscription(endpoint: string) {
    await this.sql`delete from push_subscriptions where endpoint = ${endpoint}`;
  }
}
