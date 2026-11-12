import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  AsyncGame,
  DEFAULT_TURN_HOURS,
  GameAction,
  GameEvent,
  TURN_HOURS_OPTIONS,
  applyAction,
  applyTimeouts,
  joinGame,
  newGame,
} from '../../src/game/engine.js';
import { hashPassword, PASSWORD_MAX, PASSWORD_MIN, verifyPassword } from './password.js';
import type { Player, Store } from './store.js';

// The whole HTTP API as one framework-agnostic function: (request) -> (status, body).
// The Vercel function and the local dev server are both thin adapters around `handle`.

export const MAX_ACTIVE_GAMES = 10;
const FINISHED_LIMIT = 20;
const OPEN_LIMIT = 30;
const SWEEP_LIMIT = 200;
/** An open challenge nobody has taken for this long is dead: hidden, unjoinable, then deleted by the sweep. */
export const OPEN_GAME_TTL_DAYS = 7;
const OPEN_GAME_TTL_MS = OPEN_GAME_TTL_DAYS * 24 * 3600_000;
/** Password guesses allowed per game in each window. Per game, not per player: anyone can register new players. */
export const MAX_JOIN_ATTEMPTS = 5;
export const JOIN_WINDOW_MINUTES = 15;
const JOIN_WINDOW_MS = JOIN_WINDOW_MINUTES * 60_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ApiRequest {
  method: string;
  /** Path below /api, e.g. "/games/123/actions". */
  path: string;
  headers: Record<string, string | undefined>;
  body?: any;
  /** Parsed query string, when the adapter has one. */
  query?: Record<string, string | undefined>;
}

export interface ApiResponse {
  status: number;
  body: unknown;
}

export interface Notifier {
  notify(events: GameEvent[], games: Map<string, AsyncGame>): Promise<void>;
}

export interface Deps {
  store: Store;
  now: () => string;
  rng: () => number;
  notifier?: Notifier;
  cronSecret?: string;
  vapidPublicKey?: string;
}

const json = (status: number, body: unknown): ApiResponse => ({ status, body });
const fail = (status: number, error: string, extra: object = {}): ApiResponse => json(status, { error, ...extra });
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

function cleanName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 40);
  return name.length ? name : null;
}

async function authenticate(req: ApiRequest, deps: Deps): Promise<Player | null> {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return null;
  return deps.store.getPlayerByTokenHash(hashToken(token));
}

/** Applies overdue timers to a game and persists the result. Returns the current game. */
async function settle(game: AsyncGame, deps: Deps): Promise<AsyncGame> {
  const timed = applyTimeouts(game, deps.now());
  if (!timed.changed) return game;
  const saved = await deps.store.updateGame(timed.game, game.version);
  if (!saved) return (await deps.store.getGame(game.id)) ?? game; // someone else settled it first
  const settled = { ...timed.game, version: game.version + 1 };
  await emit(timed.events, settled, deps);
  return settled;
}

async function emit(events: GameEvent[], game: AsyncGame, deps: Deps) {
  if (!deps.notifier || events.length === 0) return;
  try {
    await deps.notifier.notify(events, new Map([[game.id, game]]));
  } catch (err) {
    console.warn('[notify] failed:', err); // a failed push must never fail the move
  }
}

/**
 * Game records carry a snapshot of each player's name, so a rename would otherwise leave the old name
 * on every waiting and in-progress game. Finished games keep the name they were played under.
 * Best effort: a game someone else is writing right now simply keeps the old name until its next write.
 */
async function renameInUnfinishedGames(playerId: string, name: string, deps: Deps) {
  const games = await deps.store.listGamesForPlayer(playerId, 0);
  for (const g of games) {
    if (g.status === 'completed') continue;
    const next = { ...g, hostName: g.hostId === playerId ? name : g.hostName, guestName: g.guestId === playerId ? name : g.guestName };
    await deps.store.updateGame(next, g.version).catch(() => false);
  }
}

const openCutoff = (now: string) => new Date(new Date(now).getTime() - OPEN_GAME_TTL_MS).toISOString();
const isExpiredChallenge = (g: AsyncGame, now: string) =>
  g.status === 'waiting' && g.visibility === 'open' && g.createdAt < openCutoff(now);

/**
 * Gate for joining a password-protected game. Each guess is counted before it is checked
 * (see Store.reserveJoinAttempt), so a burst of parallel guesses still gets at most MAX_JOIN_ATTEMPTS.
 * Returns the refusal to send, or null when the password was right.
 */
async function checkJoinPassword(gameId: string, password: unknown, deps: Deps): Promise<ApiResponse | null> {
  if (typeof password !== 'string' || password === '') {
    return fail(403, 'This game needs a password.', { passwordRequired: true });
  }
  const now = deps.now();
  const { attempts, windowStart } = await deps.store.reserveJoinAttempt(gameId, now, JOIN_WINDOW_MS);
  if (attempts > MAX_JOIN_ATTEMPTS) {
    const retryAfterSeconds = Math.max(1, Math.ceil((new Date(windowStart).getTime() + JOIN_WINDOW_MS - new Date(now).getTime()) / 1000));
    return fail(429, `Too many wrong passwords for this game. Try again in ${Math.ceil(retryAfterSeconds / 60)} minute(s).`, { retryAfterSeconds });
  }
  if (!(await verifyPassword(password, await deps.store.getPasswordHash(gameId)))) {
    return fail(403, 'Wrong password.', { attemptsLeft: MAX_JOIN_ATTEMPTS - attempts });
  }
  await deps.store.resetJoinAttempts(gameId);
  return null;
}

const isParticipant = (g: AsyncGame, playerId: string) => g.hostId === playerId || g.guestId === playerId;

/** What a non-participant may see of a waiting game (invite preview / open list). */
const summary = (g: AsyncGame) => ({
  id: g.id,
  status: g.status,
  visibility: g.visibility,
  hasPassword: g.hasPassword,
  hostId: g.hostId,
  hostName: g.hostName,
  guestId: g.guestId,
  guestName: g.guestName,
  activePlayerId: g.activePlayerId,
  turnNumber: g.turnNumber,
  turnHours: g.turnHours,
  turnDeadline: g.turnDeadline,
  winnerId: g.winnerId,
  endReason: g.endReason,
  createdAt: g.createdAt,
  updatedAt: g.updatedAt,
});

export async function handle(req: ApiRequest, deps: Deps): Promise<ApiResponse> {
  const method = req.method.toUpperCase();
  const parts = req.path.split('?')[0].split('/').filter(Boolean);
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const route = `${method} /${parts.join('/')}`;

  // ---- no auth
  if (route === 'GET /health') return json(200, { status: 'ok', time: deps.now() });
  if (route === 'GET /push/key') return json(200, { publicKey: deps.vapidPublicKey || null });

  if (route === 'POST /players') {
    const name = cleanName(body.name);
    if (!name) return fail(400, 'A player name is required.');
    const id = randomUUID();
    const token = randomBytes(32).toString('base64url');
    await deps.store.createPlayer({ id, name, tokenHash: hashToken(token) });
    return json(201, { playerId: id, name, token });
  }

  if (route === 'GET /cron/sweep') {
    if (!deps.cronSecret || req.headers.authorization !== `Bearer ${deps.cronSecret}`) return fail(401, 'Unauthorized.');
    const overdue = await deps.store.listOverdueGames(deps.now(), SWEEP_LIMIT);
    let settled = 0;
    for (const g of overdue) if ((await settle(g, deps)).version !== g.version) settled++;
    const expired = await deps.store.deleteExpiredOpenGames(openCutoff(deps.now()), SWEEP_LIMIT);
    return json(200, { overdue: overdue.length, settled, expired });
  }

  // ---- authenticated
  const me = await authenticate(req, deps);
  if (!me) return fail(401, 'Missing or invalid player token.');

  if (route === 'GET /players/me') return json(200, { playerId: me.id, name: me.name });
  if (route === 'PATCH /players/me') {
    const name = cleanName(body.name);
    if (!name) return fail(400, 'A player name is required.');
    await deps.store.renamePlayer(me.id, name);
    await renameInUnfinishedGames(me.id, name, deps);
    return json(200, { playerId: me.id, name });
  }

  if (route === 'POST /push/subscribe') {
    const { endpoint, keys } = body;
    if (typeof endpoint !== 'string' || !/^https:\/\//.test(endpoint) || !keys?.p256dh || !keys?.auth) {
      return fail(400, 'Invalid push subscription.');
    }
    await deps.store.savePushSubscription({
      endpoint,
      playerId: me.id,
      keys: { p256dh: String(keys.p256dh), auth: String(keys.auth) },
    });
    return json(201, { ok: true });
  }

  if (route === 'GET /games') {
    const games = await deps.store.listGamesForPlayer(me.id, FINISHED_LIMIT);
    const settled = await Promise.all(games.map((g) => settle(g, deps)));
    return json(200, { games: settled.map(summary) });
  }

  if (route === 'GET /games/open') {
    const before = typeof req.query?.before === 'string' && !Number.isNaN(Date.parse(req.query.before)) ? req.query.before : undefined;
    // One extra row tells us whether another page exists.
    const rows = await deps.store.listOpenGames(me.id, OPEN_LIMIT + 1, { before, createdAfter: openCutoff(deps.now()) });
    return json(200, { games: rows.slice(0, OPEN_LIMIT).map(summary), hasMore: rows.length > OPEN_LIMIT });
  }

  if (route === 'POST /games') {
    const visibility = body.visibility === 'invite' ? 'invite' : 'open';
    const turnHours = body.turnHours === undefined ? DEFAULT_TURN_HOURS : Number(body.turnHours);
    if (!(TURN_HOURS_OPTIONS as readonly number[]).includes(turnHours)) {
      return fail(400, `turnHours must be one of ${TURN_HOURS_OPTIONS.join(', ')}.`);
    }
    if ((await deps.store.countActiveGames(me.id)) >= MAX_ACTIVE_GAMES) {
      return fail(409, `You already have ${MAX_ACTIVE_GAMES} active games.`);
    }
    let passwordHash: string | null = null;
    if (body.password !== undefined && body.password !== null && body.password !== '') {
      if (typeof body.password !== 'string' || body.password.length < PASSWORD_MIN || body.password.length > PASSWORD_MAX) {
        return fail(400, `A password must be ${PASSWORD_MIN} to ${PASSWORD_MAX} characters.`);
      }
      passwordHash = await hashPassword(body.password);
    }
    const game = newGame({
      id: randomUUID(),
      hostId: me.id,
      hostName: me.name,
      visibility,
      turnHours,
      now: deps.now(),
      hasPassword: passwordHash !== null,
    });
    await deps.store.insertGame(game, passwordHash);
    return json(201, { game });
  }

  if (parts[0] === 'games' && parts[1] && UUID.test(parts[1])) {
    const loaded = await deps.store.getGame(parts[1]);
    if (!loaded) return fail(404, 'Game not found.');

    if (method === 'GET' && parts.length === 2) {
      const game = await settle(loaded, deps);
      if (isParticipant(game, me.id)) return json(200, { game });
      // Anyone holding the link may preview a game that is still waiting for a challenger.
      if (isExpiredChallenge(game, deps.now())) return fail(410, 'This challenge has expired.');
      if (game.status === 'waiting') return json(200, { game: summary(game), preview: true });
      return fail(403, 'You are not a player in this game.');
    }

    if (route === `POST /games/${parts[1]}/join`) {
      if ((await deps.store.countActiveGames(me.id)) >= MAX_ACTIVE_GAMES) {
        return fail(409, `You already have ${MAX_ACTIVE_GAMES} active games.`);
      }
      if (isExpiredChallenge(loaded, deps.now())) return fail(410, 'This challenge has expired.');
      if (loaded.hasPassword && loaded.status === 'waiting' && loaded.hostId !== me.id) {
        const denied = await checkJoinPassword(loaded.id, body.password, deps);
        if (denied) return denied;
      }
      const result = joinGame(loaded, me.id, me.name, deps.now());
      if (!result.ok) return fail(result.status, result.error);
      if (!(await deps.store.updateGame(result.game, loaded.version))) return fail(409, 'Someone else just joined this game.');
      const game = { ...result.game, version: loaded.version + 1 };
      await emit(result.events, game, deps);
      return json(200, { game });
    }

    if (route === `POST /games/${parts[1]}/actions`) {
      if (!isParticipant(loaded, me.id)) return fail(403, 'You are not a player in this game.');
      const game = await settle(loaded, deps);
      // The client says which version it acted on; a stale board gets the fresh one back.
      if (typeof body.version !== 'number' || body.version !== game.version) {
        return fail(409, 'The game changed since you last saw it.', { game });
      }
      const action = body.action as GameAction;
      if (!action || typeof action.type !== 'string') return fail(400, 'An action is required.');
      const result = applyAction(game, me.id, action, deps.rng, deps.now());
      if (!result.ok) return fail(result.status, result.error, { game });
      if (!(await deps.store.updateGame(result.game, game.version))) {
        return fail(409, 'The game changed since you last saw it.', { game: await deps.store.getGame(game.id) });
      }
      const saved = { ...result.game, version: game.version + 1 };
      await emit(result.events, saved, deps);
      return json(200, { game: saved });
    }
  }

  return fail(404, 'Not found.');
}
