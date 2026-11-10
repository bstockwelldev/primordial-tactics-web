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

/** Persistence boundary. Two implementations: Supabase (production) and memory (dev/tests). */
export interface Store {
  createPlayer(p: Player & { tokenHash: string }): Promise<void>;
  getPlayerByTokenHash(tokenHash: string): Promise<Player | null>;
  renamePlayer(id: string, name: string): Promise<void>;

  insertGame(game: AsyncGame): Promise<void>;
  getGame(id: string): Promise<AsyncGame | null>;
  /**
   * Writes `game` only if the stored version still equals `expectedVersion`, and
   * stores version = expectedVersion + 1. Returns false when someone else wrote first.
   */
  updateGame(game: AsyncGame, expectedVersion: number): Promise<boolean>;
  /** Waiting + in-progress games, then the most recent finished ones. */
  listGamesForPlayer(playerId: string, finishedLimit: number): Promise<AsyncGame[]>;
  listOpenGames(excludePlayerId: string, limit: number): Promise<AsyncGame[]>;
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
  async insertGame(game: AsyncGame) {
    this.games.set(game.id, copy(game));
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
  async listOpenGames(excludePlayerId: string, limit: number) {
    return copy(
      [...this.games.values()]
        .filter((g) => g.status === 'waiting' && g.visibility === 'open' && g.hostId !== excludePlayerId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit)
    );
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
