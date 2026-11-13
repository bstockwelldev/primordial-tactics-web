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

// MVP Launch Feature Roadmap Endpoint
app.get('/api/roadmap', (req, res) => {
  res.json({
    title: 'Primordial Tactics: MVP to Production Launch Roadmap',
    phases: [
      {
        phase: 'Phase 1: Tactical Core & Taming (Current Prototype)',
        status: 'Active / Live Prototype',
        milestones: [
          'Real-time WebSocket multiplayer turn-based arena with Action Point (AP) economy',
          '5 Core Dinosaur Species: Velociraptor, Triceratops, Pteranodon, Ankylosaurus, Dilophosaurus',
          'Research-based evolution tree with 10 branch specializations (Deinonychus, Sky Titan, etc.)',
          'Prehistoric gathering, crafting system (Tranq Darts, Prime Kibble, Chitin Armor)',
          'Base building camp (Survivor Longhouse, Dino Enclosures, Gene Incubator, Smithy)',
        ],
      },
      {
        phase: 'Phase 2: Tribe Alliances & Base Defense Raids',
        status: 'Q3 Launch Target',
        milestones: [
          'Asynchronous Wild Predator Horde base attacks requiring automated dino pen defenders',
          'Tribe Guilds: Shared tribe gene vaults, co-op resource caravans, and shared encampments',
          'Ranked Competitive Seasons with Amber Leaderboards and seasonal dinosaur skins',
          'Sound FX, atmospheric primeval jungle ambient tracks, and visceral battle soundscapes',
        ],
      },
      {
        phase: 'Phase 3: Deep Gene Splicing & Apex Tournaments',
        status: 'Q4 Launch Target',
        milestones: [
          'Hybrid Dino Fusion: Combine raptor agility with ankylosaur carapace in the Gene Incubator',
          'Weekly 16-player bracket PvP tournaments with live spectator mode and wager stakes',
          'Titan Boss Expeditions: 4-player co-op raids against Spinosaurus and Tyrannosaurus Rex',
          'Native Mobile App wrappers for iOS & Android with push notifications for breeding cycles',
        ],
      },
      {
        phase: 'Phase 4: Open Persistent Prehistoric World',
        status: 'Next Year Expansion',
        milestones: [
          'Seamless hex-based continental map with territory control and resource node disputes',
          'Underwater and Subterranean biomes (Mosasaurus coastal bays, Megalodon trenches)',
          'Custom tournament rules creator and user-designed arena terrain editor',
          'Expanded LLM Game Master capable of narrating dynamic live weather and emergent catastrophes',
        ],
      },
    ],
  });
});

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
