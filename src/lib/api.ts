// The API is same-origin: /api/* is a Vercel function in production and the dev
// server locally.
export function apiUrl(path: string): string {
  return path;
}
