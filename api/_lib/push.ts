import { sendNotification } from 'web-push';
import type { AsyncGame, GameEvent } from '../../src/game/engine.js';
import type { Notifier } from './app.js';
import type { PushSubscriptionRecord, Store } from './store.js';

export interface PushPayload {
  title: string;
  body: string;
  gameId: string;
}

/** Sends one push message. Resolves to the push service's HTTP status. */
export type PushSender = (sub: PushSubscriptionRecord, payload: PushPayload) => Promise<number>;

export function describe(event: GameEvent, game: AsyncGame | undefined): PushPayload {
  const opponent = !game
    ? 'your opponent'
    : (event.playerId === game.hostId ? game.guestName : game.hostName) || 'your opponent';
  if (event.kind === 'your_turn') {
    return { title: 'Your turn', body: `It is your move against ${opponent}. You have ${game?.turnHours ?? 24}h.`, gameId: event.gameId };
  }
  if (event.kind === 'game_started') {
    return { title: 'Challenger found', body: `${opponent} joined your game.`, gameId: event.gameId };
  }
  const won = game?.winnerId === event.playerId;
  return {
    title: 'Match over',
    body: !game?.winnerId ? `Your match against ${opponent} ended in a draw.` : won ? `You beat ${opponent}!` : `${opponent} won the match.`,
    gameId: event.gameId,
  };
}

/**
 * Delivers game events as Web Push. One message per player per call (the most
 * important event wins), and subscriptions the push service reports gone are deleted.
 */
export class PushNotifier implements Notifier {
  constructor(private store: Store, private send: PushSender) {}

  async notify(events: GameEvent[], games: Map<string, AsyncGame>) {
    const rank = { game_over: 3, your_turn: 2, game_started: 1 } as const;
    const best = new Map<string, GameEvent>();
    for (const e of events) {
      const key = `${e.playerId}:${e.gameId}`;
      const current = best.get(key);
      if (!current || rank[e.kind] > rank[current.kind]) best.set(key, e);
    }
    await Promise.all(
      [...best.values()].map(async (event) => {
        const payload = describe(event, games.get(event.gameId));
        const subs = await this.store.listPushSubscriptions(event.playerId);
        await Promise.all(
          subs.map(async (sub) => {
            try {
              const status = await this.send(sub, payload);
              if (status === 404 || status === 410) await this.store.deletePushSubscription(sub.endpoint);
            } catch (err) {
              console.warn('[push] send failed:', (err as Error).message);
            }
          })
        );
      })
    );
  }
}

/** The real sender: VAPID-signed Web Push. */
export function webPushSender(vapid: { subject: string; publicKey: string; privateKey: string }): PushSender {
  return async (sub, payload) => {
    try {
      const res = await sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, JSON.stringify(payload), {
        TTL: 3600,
        vapidDetails: vapid,
      });
      return res.statusCode;
    } catch (err: any) {
      if (typeof err?.statusCode === 'number') return err.statusCode;
      throw err;
    }
  };
}
