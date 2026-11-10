import { handle } from './_lib/app.js';
import { getDeps } from './_lib/runtime.js';

// Single Vercel function for the whole API. vercel.json rewrites /api/* here and
// passes the original sub-path as ?path=.
export default async function handler(req: any, res: any) {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    const sub = url.searchParams.get('path') ?? url.pathname.replace(/^\/api/, '');
    const result = await handle(
      { method: req.method || 'GET', path: `/${sub.replace(/^\/+/, '')}`, headers: req.headers || {}, body: req.body },
      getDeps()
    );
    res.status(result.status).setHeader('Cache-Control', 'no-store').json(result.body);
  } catch (err) {
    console.error('[api] unhandled:', err);
    res.status(500).json({ error: 'Server error.' });
  }
}
