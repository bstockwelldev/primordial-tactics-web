import type { Deps } from './app.js';
import { MemoryStore, type Store } from './store.js';
import { PostgresStore } from './postgresStore.js';
import { PushNotifier, webPushSender } from './push.js';

// Process-wide dependencies, built once from the environment.
// POSTGRES_URL is what Vercel's Supabase integration injects (pooled connection).

/** The deployment is missing required configuration; reported to callers as 503. */
export class NotConfiguredError extends Error {}

let deps: Deps | null = null;

export function getDeps(): Deps {
  if (deps) return deps;
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  let store: Store;
  if (url) {
    store = new PostgresStore(url);
  } else if (process.env.VERCEL) {
    throw new NotConfiguredError('The game database is not connected yet (POSTGRES_URL is not set).');
  } else {
    console.warn('[api] POSTGRES_URL not set — using an in-memory store (games are lost on restart).');
    store = new MemoryStore();
  }
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  const notifier =
    VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY
      ? new PushNotifier(
          store,
          webPushSender({ subject: VAPID_SUBJECT || 'mailto:admin@example.com', publicKey: VAPID_PUBLIC_KEY, privateKey: VAPID_PRIVATE_KEY })
        )
      : undefined;
  deps = {
    store,
    notifier,
    now: () => new Date().toISOString(),
    rng: Math.random,
    cronSecret: process.env.CRON_SECRET,
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
  };
  return deps;
}
