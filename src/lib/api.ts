// Arena server base URL for the split deployment (Vercel client + always-on arena host).
// VITE_ARENA_URL is the public URL of the arena server, e.g. https://primordial-tactics-arena.fly.dev.
// Unset in dev / single-host: same-origin — the client talks to the server that served it.
const raw = import.meta.env.VITE_ARENA_URL as string | undefined;

export const ARENA_URL: string = (raw ?? '').replace(/\/$/, '');

export function apiUrl(path: string): string {
  return `${ARENA_URL}${path}`;
}
