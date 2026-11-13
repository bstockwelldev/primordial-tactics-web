import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { handle } from './api/_lib/app.ts';
import { getDeps } from './api/_lib/runtime.ts';

// Local dev server. In production the client is static on Vercel and /api/* is the
// serverless function in api/index.ts; both run the same `handle` function. The
// realtime Socket.io arena was removed 2026-11-10 (async multiplayer is the MVP;
// see docs/async-multiplayer-spec.md — git history keeps the socket handlers).

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = http.createServer(app);

app.use(express.json({ limit: '100kb' }));

// ================= REST API Routes =================

// Async multiplayer API (players, games, push, cron) — everything not matched above.
app.use('/api', async (req, res) => {
  try {
    const result = await handle(
      {
        method: req.method,
        path: req.path,
        headers: req.headers as Record<string, string | undefined>,
        body: req.body,
        query: req.query as Record<string, string | undefined>,
      },
      getDeps()
    );
    res.status(result.status).setHeader('Cache-Control', 'no-store').json(result.body);
  } catch (err) {
    console.error('[api] unhandled:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// Vite Integration for dev vs static serving for prod
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Primordial Tactics server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
