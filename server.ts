import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { SURVIVOR_NPCS } from './src/game/constants.ts';
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

// Initialize Gemini Client
const geminiApiKey = process.env.GEMINI_API_KEY || '';
const ai = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;

// ================= REST API Routes =================

// NPC Dialogue powered by Gemini API
app.post('/api/npc-dialogue', async (req, res) => {
  try {
    const { npcId, userMessage, context } = req.body;
    const npc = SURVIVOR_NPCS.find((n) => n.id === npcId) || SURVIVOR_NPCS[0];

    if (!ai) {
      // Fallback response if API key not injected
      return res.json({
        reply: `${npc.greeting} (Tactical wisdom: Ensure your front-line Triceratops holds choke points while your agile Velociraptors flank the enemy's flanks!)`,
        npcName: npc.name,
        role: npc.role,
      });
    }

    const prompt = `
You are roleplaying as ${npc.name}, ${npc.title} (${npc.role}) in a gritty prehistoric dinosaur survival tactical RPG named "Primal Tactics".
Your persona: ${npc.systemPrompt}
Current context:
- Survivor level: ${context?.playerLevel || 1}
- Tamed creatures: ${context?.tamedCount || 1}
- Active Biome: ${context?.currentBiome || 'Primeval Canopy Jungle'}
- Survivor asked: "${userMessage}"

Keep your response under 3 sentences, in-character, evocative, tactical, and atmospheric.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    res.json({
      reply: response.text || npc.greeting,
      npcName: npc.name,
      role: npc.role,
    });
  } catch (error: any) {
    console.error('NPC dialogue error:', error);
    res.json({
      reply: 'The roar of a predator drowns out our words... Keep your tranq rifle loaded, survivor.',
    });
  }
});

// Tactical Battle Debrief & Strategic Coaching powered by Gemini API
app.post('/api/match-feedback', async (req, res) => {
  try {
    const { winnerName, loserName, turns, actionLogs, playerWon } = req.body;

    if (!ai) {
      return res.json({
        grade: playerWon ? 'A+' : 'B',
        summary: playerWon
          ? 'Decisive victory! Flawless unit positioning and effective use of action points.'
          : 'Valiant effort. Focus on maintaining defensive formation and stacking torpor to tame high-threat units.',
        strengths: [
          'Effective exploitation of line-of-sight and obstacle covers.',
          'Great synergy between Striker burst damage and Tank crowd control.',
        ],
        weaknesses: [
          'Beware of leaving ranged units within leap range of raptors.',
          'Conserve Action Points for reaction shields when facing high-crit enemies.',
        ],
        tacticalRecommendation:
          'Evolve your Velociraptor into a Deinonychus to gain Fatal Frenzy for rapid burst damage in opening rounds.',
      });
    }

    const prompt = `
You are the Tactical Combat AI Analyst for "Primal Tactics", a competitive turn-based dinosaur survival RPG.
Analyze this match result and provide a structured debrief for the player:
- Match Winner: ${winnerName}
- Loser: ${loserName}
- Did Player Win: ${playerWon ? 'YES' : 'NO'}
- Total Turns: ${turns}
- Combat Highlights:
${(actionLogs || [])
  .slice(-10)
  .map((l: any) => `- [Turn ${l.turn}] ${l.actorName}: ${l.text}`)
  .join('\n')}

Format your response strictly as valid JSON with the following structure:
{
  "grade": "S | A | B | C",
  "summary": "1-2 sentence overview of match dynamics",
  "strengths": ["string", "string"],
  "weaknesses": ["string", "string"],
  "tacticalRecommendation": "Specific recommendation regarding dinosaur evolution, ability combos, or positioning"
}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json(parsed);
  } catch (error: any) {
    console.error('Match feedback error:', error);
    res.json({
      grade: 'A',
      summary: 'Combat recorded in the prehistoric archives. Excellent tactical maneuvers.',
      strengths: ['Aggressive offensive momentum', 'Solid status effect management'],
      weaknesses: ['Vulnerable backline positioning'],
      tacticalRecommendation: 'Invest in the Amber Gene Incubator to unlock secondary evolution abilities.',
    });
  }
});

// MVP Launch Feature Roadmap Endpoint
app.get('/api/roadmap', (req, res) => {
  res.json({
    title: 'Primal Tactics: MVP to Production Launch Roadmap',
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
          'Gemini-powered dynamic NPC dialogue & tactical match coaching debriefing',
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
      { method: req.method, path: req.path, headers: req.headers as Record<string, string | undefined>, body: req.body },
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
    console.log(`[Server] Primal Tactics server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
