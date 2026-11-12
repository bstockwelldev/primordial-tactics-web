import type { AsyncGame, GameAction } from '../game/engine';

// Client for the async multiplayer API. Identity is an anonymous player id + secret
// token kept in localStorage: no sign-up, but clearing storage loses the games.

const ID_KEY = 'pt_player_id';
const TOKEN_KEY = 'pt_player_token';

export type GameSummary = Pick<
  AsyncGame,
  | 'id' | 'status' | 'visibility' | 'hostId' | 'hostName' | 'guestId' | 'guestName' | 'activePlayerId'
  | 'turnNumber' | 'turnHours' | 'turnDeadline' | 'winnerId' | 'endReason' | 'createdAt' | 'updatedAt'
>;

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T & { error?: string };
}

export function getIdentity(): { playerId: string; token: string } | null {
  const playerId = localStorage.getItem(ID_KEY);
  const token = localStorage.getItem(TOKEN_KEY);
  return playerId && token ? { playerId, token } : null;
}

async function request<T>(method: string, path: string, body?: unknown, auth = true): Promise<ApiResult<T>> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) {
    const id = getIdentity();
    if (id) headers.Authorization = `Bearer ${id.token}`;
  }
  try {
    const res = await fetch(`/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const data = await res.json().catch(() => ({ error: 'The server sent an unreadable reply.' }));
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: 'Cannot reach the game server. Check your connection.' } as any };
  }
}

/** Plain-language reason a request failed, for showing to the player. */
export function describeFailure(res: ApiResult<unknown>): string {
  if (res.status === 0) return 'Cannot reach the game server. Check your connection.';
  if (res.status === 503) return 'The game server is not fully set up yet (its database is not connected).';
  if (res.status >= 500) return `The game server hit an error (code ${res.status}). Try again in a moment.`;
  return res.data.error || `The game server refused the request (code ${res.status}).`;
}

export type EnsureResult = { playerId: string; error?: undefined } | { playerId?: undefined; error: string };

/** Returns this browser's player, registering one on first use, or the reason it could not. */
export async function ensurePlayer(name: string): Promise<EnsureResult> {
  const existing = getIdentity();
  if (existing) {
    const me = await request<{ playerId: string }>('GET', '/players/me');
    if (me.ok) return { playerId: existing.playerId };
    if (me.status !== 401) return { error: describeFailure(me) }; // keep the identity, try again later
  }
  const created = await request<{ playerId: string; token: string }>('POST', '/players', { name: name.trim() || 'Survivor' }, false);
  if (!created.ok) return { error: describeFailure(created) };
  localStorage.setItem(ID_KEY, created.data.playerId);
  localStorage.setItem(TOKEN_KEY, created.data.token);
  return { playerId: created.data.playerId };
}

export const renamePlayer = (name: string) => request('PATCH', '/players/me', { name });
export const listMyGames = () => request<{ games: GameSummary[] }>('GET', '/games');
export const listOpenGames = (before?: string) =>
  request<{ games: GameSummary[]; hasMore: boolean }>('GET', `/games/open${before ? `?before=${encodeURIComponent(before)}` : ''}`);
export const createGame = (visibility: 'open' | 'invite', turnHours: number) =>
  request<{ game: AsyncGame }>('POST', '/games', { visibility, turnHours });
export const joinGame = (id: string) => request<{ game: AsyncGame }>('POST', `/games/${id}/join`);
export const getGame = (id: string) => request<{ game: AsyncGame | GameSummary; preview?: boolean }>('GET', `/games/${id}`);
export const sendAction = (id: string, version: number, action: GameAction) =>
  request<{ game?: AsyncGame }>('POST', `/games/${id}/actions`, { version, action });
export const getPushKey = () => request<{ publicKey: string | null }>('GET', '/push/key', undefined, false);
export const savePushSubscription = (sub: PushSubscriptionJSON) => request('POST', '/push/subscribe', sub);

/** "3h 12m", "45m", "under a minute", or "overdue". */
export function timeLeft(deadline: string | null, now = Date.now()): string {
  if (!deadline) return '';
  const ms = new Date(deadline).getTime() - now;
  if (ms <= 0) return 'overdue';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return 'under a minute';
  const h = Math.floor(minutes / 60);
  const d = Math.floor(h / 24);
  if (d >= 1) return `${d}d ${h % 24}h`;
  return h >= 1 ? `${h}h ${minutes % 60}m` : `${minutes}m`;
}

/** "just now", "5m ago", "3h ago", "2d ago". */
export function timeAgo(iso: string, now = Date.now()): string {
  const minutes = Math.floor((now - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
}
