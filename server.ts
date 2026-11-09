import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import {
  ArenaRoomState,
  UnitEntity,
  BattleActionLog,
  GridTile,
} from './src/types/game.ts';
import {
  calculateDistance,
  canUnitMoveTo,
  calculateDamage,
  calculateTorporDamage,
  checkWinCondition,
} from './src/game/rules.ts';
import { DINOSAUR_SPECIES, SURVIVOR_NPCS } from './src/game/constants.ts';

dotenv.config();

// Split deployment (Vercel client + always-on arena host): the client is a
// different origin. ARENA_CORS_ORIGIN is a comma-separated allow-list
// (e.g. https://primordial-tactics.vercel.app). Unset = '*' (dev / single-host
// default — tighten once the client domain is known).
const corsOrigins = (process.env.ARENA_CORS_ORIGIN || '*')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins,
  },
});

app.use(express.json());

// REST endpoints need CORS too once the client is on a different origin (Vercel).
// Same allow-list as the Socket.io server above.
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowed = !!origin && (corsOrigins.includes('*') || corsOrigins.includes(origin));
  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.sendStatus(204);
      return;
    }
  }
  next();
});

// Initialize Gemini Client
const geminiApiKey = process.env.GEMINI_API_KEY || '';
const ai = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;

// Generate Tactical Arena Grid (8x6)
function generateArenaGrid(): GridTile[] {
  const grid: GridTile[] = [];
  const obstacles = [
    { x: 2, y: 1 },
    { x: 5, y: 4 },
    { x: 3, y: 3 },
    { x: 4, y: 2 },
  ];

  for (let y = 0; y < 6; y++) {
    for (let x = 0; x < 8; x++) {
      const isObstacle = obstacles.some((o) => o.x === x && o.y === y);
      const isFoliage = (x === 1 && y === 4) || (x === 6 && y === 1);
      grid.push({
        x,
        y,
        type: isObstacle ? 'rock' : isFoliage ? 'foliage' : 'grass',
        walkable: !isObstacle,
        defenseBonus: isFoliage ? 15 : 0,
      });
    }
  }
  return grid;
}

// Spawns default unit rosters for 2 players
function createDefaultUnits(p1Id: string, p1Name: string, p2Id: string, p2Name: string): UnitEntity[] {
  return [
    // Player 1 Team (Spawns on left)
    {
      id: `p1_hero`,
      isPlayer: true,
      ownerId: p1Id,
      name: `${p1Name} (Survivor)`,
      unitClass: 'Striker',
      x: 0,
      y: 2,
      hp: 190,
      maxHp: 190,
      torpor: 0,
      maxTorpor: 100,
      ap: 3,
      maxAp: 3,
      attack: 38,
      defense: 20,
      speed: 3,
      avatarIcon: 'User',
      abilities: [
        {
          id: 'tranq_shot',
          name: 'Tranq Rifle',
          apCost: 2,
          cooldown: 0,
          range: 4,
          targetType: 'enemy',
          damageMultiplier: 0.85,
          torporDamage: 45,
          description: 'Fires a narcotic dart dealing piercing damage and building 45 torpor.',
          iconName: 'Crosshair',
        },
        {
          id: 'spear_thrust',
          name: 'Flint Spear Thrust',
          apCost: 1,
          cooldown: 0,
          range: 1,
          targetType: 'enemy',
          damageMultiplier: 1.0,
          description: 'Melee spear strike for 100% damage.',
          iconName: 'Zap',
        },
      ],
      statusEffects: [],
    },
    {
      id: `p1_raptor`,
      isPlayer: true,
      ownerId: p1Id,
      name: 'Slash (Velociraptor)',
      speciesId: 'velociraptor',
      unitClass: 'Striker',
      x: 1,
      y: 1,
      hp: 160,
      maxHp: 160,
      torpor: 0,
      maxTorpor: 120,
      ap: 3,
      maxAp: 3,
      attack: 48,
      defense: 16,
      speed: 4,
      avatarIcon: 'Zap',
      abilities: DINOSAUR_SPECIES.velociraptor.innateAbilities,
      statusEffects: [],
    },
    {
      id: `p1_trike`,
      isPlayer: true,
      ownerId: p1Id,
      name: 'Bouldergore (Triceratops)',
      speciesId: 'triceratops',
      unitClass: 'Tank',
      x: 1,
      y: 4,
      hp: 290,
      maxHp: 290,
      torpor: 0,
      maxTorpor: 260,
      ap: 3,
      maxAp: 3,
      attack: 34,
      defense: 38,
      speed: 2,
      avatarIcon: 'Shield',
      abilities: DINOSAUR_SPECIES.triceratops.innateAbilities,
      statusEffects: [],
    },

    // Player 2 Team (Spawns on right)
    {
      id: `p2_hero`,
      isPlayer: false,
      ownerId: p2Id,
      name: `${p2Name} (Rival)`,
      unitClass: 'Striker',
      x: 7,
      y: 3,
      hp: 190,
      maxHp: 190,
      torpor: 0,
      maxTorpor: 100,
      ap: 3,
      maxAp: 3,
      attack: 38,
      defense: 20,
      speed: 3,
      avatarIcon: 'User',
      abilities: [
        {
          id: 'tranq_shot',
          name: 'Tranq Rifle',
          apCost: 2,
          cooldown: 0,
          range: 4,
          targetType: 'enemy',
          damageMultiplier: 0.85,
          torporDamage: 45,
          description: 'Fires a narcotic dart dealing piercing damage and building 45 torpor.',
          iconName: 'Crosshair',
        },
        {
          id: 'spear_thrust',
          name: 'Flint Spear Thrust',
          apCost: 1,
          cooldown: 0,
          range: 1,
          targetType: 'enemy',
          damageMultiplier: 1.0,
          description: 'Melee spear strike for 100% damage.',
          iconName: 'Zap',
        },
      ],
      statusEffects: [],
    },
    {
      id: `p2_ankylosaur`,
      isPlayer: false,
      ownerId: p2Id,
      name: 'Crusher (Ankylosaurus)',
      speciesId: 'ankylosaurus',
      unitClass: 'Siege',
      x: 6,
      y: 2,
      hp: 270,
      maxHp: 270,
      torpor: 0,
      maxTorpor: 240,
      ap: 3,
      maxAp: 3,
      attack: 44,
      defense: 45,
      speed: 2,
      avatarIcon: 'Hammer',
      abilities: DINOSAUR_SPECIES.ankylosaurus.innateAbilities,
      statusEffects: [],
    },
    {
      id: `p2_dilopho`,
      isPlayer: false,
      ownerId: p2Id,
      name: 'Vipercrest (Dilophosaurus)',
      speciesId: 'dilophosaurus',
      unitClass: 'Controller',
      x: 6,
      y: 4,
      hp: 170,
      maxHp: 170,
      torpor: 0,
      maxTorpor: 130,
      ap: 3,
      maxAp: 3,
      attack: 40,
      defense: 18,
      speed: 3,
      avatarIcon: 'Droplet',
      abilities: DINOSAUR_SPECIES.dilophosaurus.innateAbilities,
      statusEffects: [],
    },
  ];
}

// In-Memory Multiplayer Room Manager
const rooms = new Map<string, ArenaRoomState>();
const grid = generateArenaGrid();

// ================= Socket.io Handlers =================
io.on('connection', (socket: Socket) => {
  console.log(`[Socket] Connected: ${socket.id}`);

  // Send current room list
  socket.emit(
    'rooms_list',
    Array.from(rooms.values()).map((r) => ({
      roomId: r.roomId,
      name: r.name,
      hostName: r.hostName,
      status: r.status,
      playerCount: r.guestId ? 2 : 1,
    }))
  );

  // Create room
  socket.on('create_room', ({ roomName, playerName }: { roomName: string; playerName: string }) => {
    const roomId = `arena_${Date.now().toString(36)}`;
    const newRoom: ArenaRoomState = {
      roomId,
      name: roomName || `Colosseum of ${playerName}`,
      hostId: socket.id,
      hostName: playerName || 'Survivor 1',
      status: 'waiting',
      activeTurnPlayerId: socket.id,
      turnNumber: 1,
      turnTimeLeft: 45,
      gridWidth: 8,
      gridHeight: 6,
      units: [],
      actionLogs: [
        {
          id: `log_${Date.now()}`,
          turn: 1,
          actorName: 'Colosseum Overseer',
          actionName: 'Arena Created',
          text: `${playerName || 'Survivor 1'} established an arena room. Waiting for challenger...`,
          timestamp: new Date().toLocaleTimeString(),
        },
      ],
    };

    rooms.set(roomId, newRoom);
    socket.join(roomId);
    socket.emit('room_created', newRoom);
    io.emit('rooms_updated');
    console.log(`[Socket] Room created: ${roomId} by ${socket.id}`);
  });

  // Join Room
  socket.on('join_room', ({ roomId, playerName }: { roomId: string; playerName: string }) => {
    const room = rooms.get(roomId);
    if (!room) {
      socket.emit('error_message', 'Room not found.');
      return;
    }

    if (room.guestId && room.guestId !== socket.id) {
      socket.emit('error_message', 'Room is already full.');
      return;
    }

    room.guestId = socket.id;
    room.guestName = playerName || 'Challenger';
    room.status = 'in_progress';
    room.units = createDefaultUnits(room.hostId, room.hostName, room.guestId, room.guestName);

    room.actionLogs.push({
      id: `log_${Date.now()}`,
      turn: 1,
      actorName: 'Arena Announcer',
      actionName: 'Match Commencing',
      text: `${room.guestName} entered the sands! Prepare for tactical dinosaur combat!`,
      timestamp: new Date().toLocaleTimeString(),
    });

    socket.join(roomId);
    io.to(roomId).emit('room_state_updated', room);
    io.emit('rooms_updated');
    console.log(`[Socket] ${socket.id} joined room ${roomId}`);
  });

  // Quick Matchmaking
  socket.on('quick_match', ({ playerName }: { playerName: string }) => {
    // Look for an available waiting room
    const waitingRoom = Array.from(rooms.values()).find((r) => r.status === 'waiting' && r.hostId !== socket.id);
    if (waitingRoom) {
      waitingRoom.guestId = socket.id;
      waitingRoom.guestName = playerName || 'Challenger';
      waitingRoom.status = 'in_progress';
      waitingRoom.units = createDefaultUnits(
        waitingRoom.hostId,
        waitingRoom.hostName,
        waitingRoom.guestId,
        waitingRoom.guestName
      );

      waitingRoom.actionLogs.push({
        id: `log_${Date.now()}`,
        turn: 1,
        actorName: 'Matchmaker',
        actionName: 'Matched',
        text: `Competitive duel found: ${waitingRoom.hostName} VS ${waitingRoom.guestName}!`,
        timestamp: new Date().toLocaleTimeString(),
      });

      socket.join(waitingRoom.roomId);
      io.to(waitingRoom.roomId).emit('room_state_updated', waitingRoom);
      io.emit('rooms_updated');
    } else {
      // Create new waiting room
      const roomId = `arena_${Date.now().toString(36)}`;
      const newRoom: ArenaRoomState = {
        roomId,
        name: `Ranked Arena: ${playerName}`,
        hostId: socket.id,
        hostName: playerName || 'Survivor',
        status: 'waiting',
        activeTurnPlayerId: socket.id,
        turnNumber: 1,
        turnTimeLeft: 45,
        gridWidth: 8,
        gridHeight: 6,
        units: [],
        actionLogs: [
          {
            id: `log_${Date.now()}`,
            turn: 1,
            actorName: 'Matchmaker',
            actionName: 'Queueing',
            text: `Looking for a competitive opponent in the primeval badlands...`,
            timestamp: new Date().toLocaleTimeString(),
          },
        ],
      };
      rooms.set(roomId, newRoom);
      socket.join(roomId);
      socket.emit('room_created', newRoom);
      io.emit('rooms_updated');
    }
  });

  // Move Unit
  socket.on(
    'move_unit',
    ({ roomId, unitId, targetX, targetY }: { roomId: string; unitId: string; targetX: number; targetY: number }) => {
      const room = rooms.get(roomId);
      if (!room || room.status !== 'in_progress') return;

      const unit = room.units.find((u) => u.id === unitId);
      if (!unit || unit.hp <= 0) return;

      // Check turn ownership
      const isHostTurn = room.activeTurnPlayerId === room.hostId;
      if ((isHostTurn && unit.ownerId !== room.hostId) || (!isHostTurn && unit.ownerId !== room.guestId)) {
        socket.emit('error_message', 'Not your turn or unit.');
        return;
      }

      const occupied = room.units
        .filter((u) => u.hp > 0)
        .map((u) => ({ x: u.x, y: u.y, unitId: u.id }));

      const check = canUnitMoveTo(unit, targetX, targetY, grid, occupied, unit.id);
      if (!check.valid) {
        socket.emit('error_message', check.reason || 'Invalid move.');
        return;
      }

      // Apply movement and AP cost
      unit.x = targetX;
      unit.y = targetY;
      unit.ap -= check.apCost;

      room.actionLogs.push({
        id: `log_${Date.now()}`,
        turn: room.turnNumber,
        actorName: unit.name,
        actionName: 'Repositioned',
        text: `${unit.name} maneuvered to (${targetX}, ${targetY}) [-${check.apCost} AP]`,
        timestamp: new Date().toLocaleTimeString(),
      });

      io.to(roomId).emit('room_state_updated', room);
    }
  );

  // Execute Ability
  socket.on(
    'use_ability',
    ({
      roomId,
      actorUnitId,
      targetUnitId,
      abilityId,
    }: {
      roomId: string;
      actorUnitId: string;
      targetUnitId: string;
      abilityId: string;
    }) => {
      const room = rooms.get(roomId);
      if (!room || room.status !== 'in_progress') return;

      const actor = room.units.find((u) => u.id === actorUnitId);
      const target = room.units.find((u) => u.id === targetUnitId);
      if (!actor || !target || actor.hp <= 0 || target.hp <= 0) return;

      const ability = actor.abilities.find((a) => a.id === abilityId);
      if (!ability) return;

      if (actor.ap < ability.apCost) {
        socket.emit('error_message', 'Insufficient Action Points (AP).');
        return;
      }

      const dist = calculateDistance(actor.x, actor.y, target.x, target.y);
      if (dist > ability.range) {
        socket.emit('error_message', `Target out of range (${dist}/${ability.range})`);
        return;
      }

      // Spend AP
      actor.ap -= ability.apCost;

      // Calculate Damage
      const hasShield = target.statusEffects.some((s) => s.type === 'shield');
      const targetTile = grid.find((t) => t.x === target.x && t.y === target.y);
      const terrainBonus = targetTile?.defenseBonus || 0;

      const result = calculateDamage(
        actor.attack,
        target.defense,
        ability.damageMultiplier || 1.0,
        hasShield,
        terrainBonus
      );

      target.hp = Math.max(0, target.hp - result.damage);

      // Torpor build up
      let torporApplied = 0;
      if (ability.torporDamage) {
        torporApplied = calculateTorporDamage(ability.torporDamage, target.defense);
        target.torpor = Math.min(target.maxTorpor, target.torpor + torporApplied);
      }

      // Status effects
      if (ability.effect) {
        target.statusEffects.push({
          type: ability.effect === 'knockback' || ability.effect === 'charge' ? 'stun' : (ability.effect as any),
          duration: 2,
        });
      }

      let logMsg = `${actor.name} struck ${target.name} with [${ability.name}] for ${result.damage} damage!`;
      if (result.isCritical) logMsg += ' CRITICAL STRIKE!';
      if (torporApplied > 0) logMsg += ` (+${torporApplied} Torpor)`;
      if (target.hp === 0) logMsg += ` ${target.name} has fallen!`;

      room.actionLogs.push({
        id: `log_${Date.now()}`,
        turn: room.turnNumber,
        actorName: actor.name,
        actionName: ability.name,
        targetName: target.name,
        damage: result.damage,
        torpor: torporApplied,
        text: logMsg,
        timestamp: new Date().toLocaleTimeString(),
      });

      // Check win condition
      const winCheck = checkWinCondition(room.units);
      if (winCheck.isOver) {
        room.status = 'completed';
        room.winnerId = winCheck.winnerPlayerId;
        const winnerName = winCheck.winnerPlayerId === room.hostId ? room.hostName : room.guestName;
        room.actionLogs.push({
          id: `log_${Date.now()}`,
          turn: room.turnNumber,
          actorName: 'Victory Horn',
          actionName: 'Battle Concluded',
          text: `VICTORY! ${winnerName} has conquered the prehistoric arena!`,
          timestamp: new Date().toLocaleTimeString(),
        });
      }

      io.to(roomId).emit('room_state_updated', room);
    }
  );

  // End Turn
  socket.on('end_turn', ({ roomId }: { roomId: string }) => {
    const room = rooms.get(roomId);
    if (!room || room.status !== 'in_progress') return;

    // Switch turn
    const nextPlayerId = room.activeTurnPlayerId === room.hostId ? room.guestId! : room.hostId;
    room.activeTurnPlayerId = nextPlayerId;
    room.turnNumber += 1;
    room.turnTimeLeft = 45;

    // Refresh AP and tick status effects for the next player's units
    room.units.forEach((u) => {
      if (u.ownerId === nextPlayerId && u.hp > 0) {
        u.ap = u.maxAp;

        // Process status effects
        u.statusEffects = u.statusEffects
          .map((s) => ({ ...s, duration: s.duration - 1 }))
          .filter((s) => s.duration > 0);
      }
    });

    const activeName = nextPlayerId === room.hostId ? room.hostName : room.guestName;
    room.actionLogs.push({
      id: `log_${Date.now()}`,
      turn: room.turnNumber,
      actorName: 'System',
      actionName: 'Turn Shift',
      text: `Turn ${room.turnNumber} begins! Initiative belongs to ${activeName}.`,
      timestamp: new Date().toLocaleTimeString(),
    });

    io.to(roomId).emit('room_state_updated', room);
  });

  // Chat message
  socket.on(
    'send_chat',
    ({ roomId, senderName, message }: { roomId: string; senderName: string; message: string }) => {
      const room = rooms.get(roomId);
      if (!room) return;

      room.actionLogs.push({
        id: `chat_${Date.now()}`,
        turn: room.turnNumber,
        actorName: senderName || 'Survivor',
        actionName: 'Comms',
        text: `"${message}"`,
        timestamp: new Date().toLocaleTimeString(),
      });

      io.to(roomId).emit('room_state_updated', room);
    }
  );

  socket.on('disconnect', () => {
    console.log(`[Socket] Disconnected: ${socket.id}`);
  });
});

// ================= REST API Routes =================

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    game: 'Primal Tactics: Dinosaur Survival RPG',
    time: new Date().toISOString(),
    activeRooms: rooms.size,
  });
});

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
