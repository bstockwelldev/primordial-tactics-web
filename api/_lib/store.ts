import type { AsyncGame } from '../../src/game/engine.js';

export interface Player {
  id: string;
  name: string;
}

export interface PushSubscriptionRecord {
  endpoint: string;
  playerId: string;
  keys: { p256dh: string; auth: string };
}

export interface OpenGamesQuery {
  before?: string;
  createdAfter?: string;
}

/** Persistence boundary. Two implementations: Supabase (production) and memory (dev/tests). */
export interface Store {
  createPlayer(p: Player & { tokenHash: string }): Promise<void>;
  getPlayerByTokenHash(tokenHash: string): Promise<Player | null>;
  renamePlayer(id: string, name: string): Promise<void>;

  insertGame(game: AsyncGame, passwordHash?: string | null): Promise<void>;
  /** The stored password hash, or null when the game has none. Never returned inside an AsyncGame. */
  getPasswordHash(gameId: string): Promise<string | null>;
  /**
   * Counts one password guess against the game in an atomic step, BEFORE the password is checked, so
   * concurrent guesses cannot exceed the limit. The count restarts once `windowMs` has passed.
   */
  reserveJoinAttempt(gameId: string, now: string, windowMs: number): Promise<{ attempts: number; windowStart: string }>;
  resetJoinAttempts(gameId: string): Promise<void>;
  getGame(id: string): Promise<AsyncGame | null>;
  /**
   * Writes `game` only if the stored version still equals `expectedVersion`, and
   * stores version = expectedVersion + 1. Returns false when someone else wrote first.
   */
  updateGame(game: AsyncGame, expectedVersion: number): Promise<boolean>;
  /** Waiting + in-progress games, then the most recent finished ones. */
  listGamesForPlayer(playerId: string, finishedLimit: number): Promise<AsyncGame[]>;
  /**
   * Open challenges, newest first. `before` pages by createdAt (exclusive); `createdAfter` hides
   * challenges older than the expiry window (exclusive).
   */
  listOpenGames(excludePlayerId: string, limit: number, opts?: OpenGamesQuery): Promise<AsyncGame[]>;
  /** Deletes unplayed open challenges created before `createdBefore`; returns how many went. */
  deleteExpiredOpenGames(createdBefore: string, limit: number): Promise<number>;
  countActiveGames(playerId: string): Promise<number>;
  listOverdueGames(now: string, limit: number): Promise<AsyncGame[]>;

  savePushSubscription(sub: PushSubscriptionRecord): Promise<void>;
  listPushSubscriptions(playerId: string): Promise<PushSubscriptionRecord[]>;
  deletePushSubscription(endpoint: string): Promise<void>;
}

const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v));

export class MemoryStore implements Store {
  players = new Map<string, Player & { tokenHash: string }>();
  games = new Map<string, AsyncGame>();
  passwords = new Map<string, string>();
  attempts = new Map<string, { attempts: number; windowStart: string }>();
  subs = new Map<string, PushSubscriptionRecord>();

  async createPlayer(p: Player & { tokenHash: string }) {
    this.players.set(p.id, { ...p });
  }
  async getPlayerByTokenHash(tokenHash: string) {
    for (const p of this.players.values()) if (p.tokenHash === tokenHash) return { id: p.id, name: p.name };
    return null;
  }
  async renamePlayer(id: string, name: string) {
    const p = this.players.get(id);
    if (p) p.name = name;
  }
  async insertGame(game: AsyncGame, passwordHash?: string | null) {
    this.games.set(game.id, copy(game));
    if (passwordHash) this.passwords.set(game.id, passwordHash);
  }
  async getPasswordHash(gameId: string) {
    return this.passwords.get(gameId) ?? null;
  }
  async reserveJoinAttempt(gameId: string, now: string, windowMs: number) {
    const cur = this.attempts.get(gameId);
    const fresh = !cur || new Date(cur.windowStart).getTime() <= new Date(now).getTime() - windowMs;
    const next = fresh ? { attempts: 1, windowStart: now } : { attempts: cur.attempts + 1, windowStart: cur.windowStart };
    this.attempts.set(gameId, next);
    return { ...next };
  }
  async resetJoinAttempts(gameId: string) {
    this.attempts.delete(gameId);
  }
  async getGame(id: string) {
    const g = this.games.get(id);
    return g ? copy(g) : null;
  }
  async updateGame(game: AsyncGame, expectedVersion: number) {
    const current = this.games.get(game.id);
    if (!current || current.version !== expectedVersion) return false;
    this.games.set(game.id, copy({ ...game, version: expectedVersion + 1 }));
    return true;
  }
  async listGamesForPlayer(playerId: string, finishedLimit: number) {
    const mine = [...this.games.values()].filter((g) => g.hostId === playerId || g.guestId === playerId);
    const byRecent = (a: AsyncGame, b: AsyncGame) => b.updatedAt.localeCompare(a.updatedAt);
    return copy([
      ...mine.filter((g) => g.status !== 'completed').sort(byRecent),
      ...mine.filter((g) => g.status === 'completed').sort(byRecent).slice(0, finishedLimit),
    ]);
  }
  async listOpenGames(excludePlayerId: string, limit: number, opts: OpenGamesQuery = {}) {
    return copy(
      [...this.games.values()]
        .filter((g) => g.status === 'waiting' && g.visibility === 'open' && g.hostId !== excludePlayerId)
        .filter((g) => !opts.before || g.createdAt < opts.before)
        .filter((g) => !opts.createdAfter || g.createdAt > opts.createdAfter)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit)
    );
  }
  async deleteExpiredOpenGames(createdBefore: string, limit: number) {
    const expired = [...this.games.values()]
      .filter((g) => g.status === 'waiting' && g.visibility === 'open' && g.createdAt < createdBefore)
      .slice(0, limit);
    for (const g of expired) this.games.delete(g.id);
    return expired.length;
  }
  async countActiveGames(playerId: string) {
    return [...this.games.values()].filter(
      (g) => g.status !== 'completed' && (g.hostId === playerId || g.guestId === playerId)
    ).length;
  }
  async listOverdueGames(now: string, limit: number) {
    return copy(
      [...this.games.values()]
        .filter((g) => g.status === 'in_progress' && g.turnDeadline && new Date(g.turnDeadline) < new Date(now))
        .slice(0, limit)
    );
  }
  async savePushSubscription(sub: PushSubscriptionRecord) {
    this.subs.set(sub.endpoint, copy(sub));
  }
  async listPushSubscriptions(playerId: string) {
    return [...this.subs.values()].filter((s) => s.playerId === playerId);
  }
  async deletePushSubscription(endpoint: string) {
    this.subs.delete(endpoint);
  }
}
