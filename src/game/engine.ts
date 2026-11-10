// Async PvP match engine. Pure: no I/O, no clock, no Math.random — the caller passes
// `now` and `rng`. Runs on the server (Vercel function / dev server) and in tests.
//
// Runtime imports in this file use explicit `.js` extensions so it also loads as a
// plain ES module on the server.
import type { Ability, BattleActionLog, GridTile, UnitEntity } from '../types/game';
import {
  calculateDamage,
  calculateDistance,
  calculateTorporDamage,
  canUnitMoveTo,
  checkWinCondition,
} from './rules.js';
import { DINOSAUR_SPECIES } from './constants.js';

export const TURN_HOURS_OPTIONS = [8, 24, 72] as const;
export const DEFAULT_TURN_HOURS = 24;
/** Consecutive missed turns by one player that forfeit the game. */
export const TIMEOUTS_TO_FORFEIT = 2;
export const MAX_LOG_ENTRIES = 200;

export type GameStatus = 'waiting' | 'in_progress' | 'completed';
export type EndReason = 'elimination' | 'forfeit' | 'resign' | 'draw';

export interface AsyncGame {
  id: string;
  status: GameStatus;
  visibility: 'open' | 'invite';
  hostId: string;
  hostName: string;
  guestId: string | null;
  guestName: string | null;
  activePlayerId: string | null;
  turnNumber: number;
  turnHours: number;
  /** ISO timestamp; null until the game starts and after it ends. */
  turnDeadline: string | null;
  hostTimeouts: number;
  guestTimeouts: number;
  winnerId: string | null;
  endReason: EndReason | null;
  units: UnitEntity[];
  actionLogs: BattleActionLog[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

export type GameAction =
  | { type: 'move'; unitId: string; x: number; y: number }
  | { type: 'ability'; unitId: string; targetId: string; abilityId: string }
  | { type: 'end_turn' }
  | { type: 'resign' };

export interface GameEvent {
  kind: 'your_turn' | 'game_started' | 'game_over';
  playerId: string;
  gameId: string;
}

export type EngineResult =
  | { ok: true; game: AsyncGame; events: GameEvent[] }
  | { ok: false; status: 400 | 403 | 409; error: string };

/** The fixed 8x6 PvP arena (same layout as the solo arena). */
export function buildPvpGrid(): GridTile[] {
  const rocks = [
    [2, 1],
    [5, 4],
    [3, 3],
    [4, 2],
  ];
  const grid: GridTile[] = [];
  for (let y = 0; y < 6; y++) {
    for (let x = 0; x < 8; x++) {
      const isRock = rocks.some(([rx, ry]) => rx === x && ry === y);
      const isFoliage = (x === 1 && y === 4) || (x === 6 && y === 1);
      grid.push({
        x,
        y,
        type: isRock ? 'rock' : isFoliage ? 'foliage' : 'grass',
        walkable: !isRock,
        defenseBonus: isFoliage ? 15 : 0,
      });
    }
  }
  return grid;
}

const GRID = buildPvpGrid();

const HERO_ABILITIES: Ability[] = [
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
];

function unit(partial: Omit<UnitEntity, 'torpor' | 'ap' | 'maxAp' | 'statusEffects' | 'maxHp'>, maxTorpor: number): UnitEntity {
  return { ...partial, maxHp: partial.hp, torpor: 0, maxTorpor, ap: 3, maxAp: 3, statusEffects: [] } as UnitEntity;
}

/**
 * Fixed default squads (MVP decision: own-roster PvP waits for cloud save).
 * Host units carry isPlayer=true and spawn on the left; guest units on the right.
 */
export function createDefaultSquads(hostId: string, hostName: string, guestId: string, guestName: string): UnitEntity[] {
  const S = DINOSAUR_SPECIES;
  return [
    unit({ id: 'p1_hero', isPlayer: true, ownerId: hostId, name: `${hostName} (Survivor)`, unitClass: 'Human', x: 0, y: 2, hp: 190, attack: 38, defense: 20, speed: 3, avatarIcon: 'User', abilities: HERO_ABILITIES } as any, 100),
    unit({ id: 'p1_raptor', isPlayer: true, ownerId: hostId, name: 'Slash (Velociraptor)', speciesId: 'velociraptor', unitClass: S.velociraptor.unitClass, x: 1, y: 1, hp: 160, attack: 48, defense: 16, speed: 4, avatarIcon: 'Zap', abilities: S.velociraptor.innateAbilities } as any, 120),
    unit({ id: 'p1_trike', isPlayer: true, ownerId: hostId, name: 'Bouldergore (Triceratops)', speciesId: 'triceratops', unitClass: S.triceratops.unitClass, x: 1, y: 4, hp: 290, attack: 34, defense: 38, speed: 2, avatarIcon: 'Shield', abilities: S.triceratops.innateAbilities } as any, 260),
    unit({ id: 'p2_hero', isPlayer: false, ownerId: guestId, name: `${guestName} (Rival)`, unitClass: 'Human', x: 7, y: 3, hp: 190, attack: 38, defense: 20, speed: 3, avatarIcon: 'User', abilities: HERO_ABILITIES } as any, 100),
    unit({ id: 'p2_ankylosaur', isPlayer: false, ownerId: guestId, name: 'Crusher (Ankylosaurus)', speciesId: 'ankylosaurus', unitClass: S.ankylosaurus.unitClass, x: 6, y: 2, hp: 270, attack: 44, defense: 45, speed: 2, avatarIcon: 'Hammer', abilities: S.ankylosaurus.innateAbilities } as any, 240),
    unit({ id: 'p2_dilopho', isPlayer: false, ownerId: guestId, name: 'Vipercrest (Dilophosaurus)', speciesId: 'dilophosaurus', unitClass: S.dilophosaurus.unitClass, x: 6, y: 4, hp: 170, attack: 40, defense: 18, speed: 3, avatarIcon: 'Droplet', abilities: S.dilophosaurus.innateAbilities } as any, 130),
  ];
}

const addHours = (iso: string, hours: number) => new Date(new Date(iso).getTime() + hours * 3600_000).toISOString();
const clone = (g: AsyncGame): AsyncGame => ({
  ...g,
  units: g.units.map((u) => ({ ...u, statusEffects: u.statusEffects.map((s) => ({ ...s })) })),
  actionLogs: [...g.actionLogs],
});
const opponentOf = (g: AsyncGame, playerId: string) => (playerId === g.hostId ? g.guestId! : g.hostId);
const nameOf = (g: AsyncGame, playerId: string | null) =>
  playerId === g.hostId ? g.hostName : playerId === g.guestId ? g.guestName || 'Challenger' : 'Nobody';

function pushLog(g: AsyncGame, now: string, entry: Omit<BattleActionLog, 'id' | 'turn' | 'timestamp'>) {
  g.actionLogs.push({ ...entry, id: `log_${g.version}_${g.actionLogs.length}_${now}`, turn: g.turnNumber, timestamp: now });
  if (g.actionLogs.length > MAX_LOG_ENTRIES) g.actionLogs = g.actionLogs.slice(-MAX_LOG_ENTRIES);
}

export function newGame(opts: {
  id: string;
  hostId: string;
  hostName: string;
  visibility: 'open' | 'invite';
  turnHours: number;
  now: string;
}): AsyncGame {
  const g: AsyncGame = {
    id: opts.id,
    status: 'waiting',
    visibility: opts.visibility,
    hostId: opts.hostId,
    hostName: opts.hostName,
    guestId: null,
    guestName: null,
    activePlayerId: null,
    turnNumber: 1,
    turnHours: opts.turnHours,
    turnDeadline: null,
    hostTimeouts: 0,
    guestTimeouts: 0,
    winnerId: null,
    endReason: null,
    units: [],
    actionLogs: [],
    version: 0,
    createdAt: opts.now,
    updatedAt: opts.now,
  };
  pushLog(g, opts.now, {
    actorName: 'Arena Overseer',
    actionName: 'Arena Created',
    text: `${opts.hostName} opened an arena (${opts.turnHours}h turns). Waiting for a challenger...`,
  });
  return g;
}

export function joinGame(game: AsyncGame, guestId: string, guestName: string, now: string): EngineResult {
  if (game.status !== 'waiting') return { ok: false, status: 409, error: 'This game has already started.' };
  if (game.hostId === guestId) return { ok: false, status: 400, error: 'You cannot join your own game.' };
  const g = clone(game);
  g.guestId = guestId;
  g.guestName = guestName;
  g.status = 'in_progress';
  g.activePlayerId = g.hostId;
  g.turnDeadline = addHours(now, g.turnHours);
  g.units = createDefaultSquads(g.hostId, g.hostName, guestId, guestName);
  g.updatedAt = now;
  pushLog(g, now, {
    actorName: 'Arena Announcer',
    actionName: 'Match Commencing',
    text: `${guestName} entered the sands! ${g.hostName} has the first turn.`,
  });
  return {
    ok: true,
    game: g,
    events: [
      { kind: 'game_started', playerId: g.hostId, gameId: g.id },
      { kind: 'your_turn', playerId: g.hostId, gameId: g.id },
    ],
  };
}

function finish(g: AsyncGame, winnerId: string | null, reason: EndReason, now: string, events: GameEvent[]) {
  g.status = 'completed';
  g.winnerId = winnerId;
  g.endReason = reason;
  g.activePlayerId = null;
  g.turnDeadline = null;
  pushLog(g, now, {
    actorName: 'Victory Horn',
    actionName: 'Battle Concluded',
    text: winnerId ? `VICTORY! ${nameOf(g, winnerId)} has conquered the arena (${reason}).` : 'The battle ends in a draw.',
  });
  events.push({ kind: 'game_over', playerId: g.hostId, gameId: g.id });
  if (g.guestId) events.push({ kind: 'game_over', playerId: g.guestId, gameId: g.id });
}

/** Hands the turn to the other player. `deadlineFrom` is when the new turn's clock starts. */
function passTurn(g: AsyncGame, deadlineFrom: string, now: string, events: GameEvent[]) {
  const next = opponentOf(g, g.activePlayerId!);
  g.activePlayerId = next;
  g.turnNumber += 1;
  g.turnDeadline = addHours(deadlineFrom, g.turnHours);
  for (const u of g.units) {
    if (u.ownerId === next && u.hp > 0) {
      u.ap = u.maxAp;
      u.statusEffects = u.statusEffects.map((s) => ({ ...s, duration: s.duration - 1 })).filter((s) => s.duration > 0);
    }
  }
  pushLog(g, now, {
    actorName: 'System',
    actionName: 'Turn Shift',
    text: `Turn ${g.turnNumber} begins! Initiative belongs to ${nameOf(g, next)}.`,
  });
  events.push({ kind: 'your_turn', playerId: next, gameId: g.id });
}

/**
 * Applies every overdue turn timer as of `now`. A missed turn ends that player's turn;
 * TIMEOUTS_TO_FORFEIT consecutive misses forfeit. Each skipped turn's clock starts when
 * the previous deadline passed, so a long-abandoned game resolves in one call.
 */
export function applyTimeouts(game: AsyncGame, now: string): { game: AsyncGame; changed: boolean; events: GameEvent[] } {
  if (game.status !== 'in_progress' || !game.turnDeadline || now <= game.turnDeadline) {
    return { game, changed: false, events: [] };
  }
  const g = clone(game);
  const events: GameEvent[] = [];
  while (g.status === 'in_progress' && g.turnDeadline && new Date(now) > new Date(g.turnDeadline)) {
    const late = g.activePlayerId!;
    const isHost = late === g.hostId;
    const misses = (isHost ? g.hostTimeouts : g.guestTimeouts) + 1;
    if (isHost) g.hostTimeouts = misses;
    else g.guestTimeouts = misses;
    pushLog(g, now, {
      actorName: 'Hourglass',
      actionName: 'Turn Timed Out',
      text: `${nameOf(g, late)} ran out of time (${misses}/${TIMEOUTS_TO_FORFEIT}).`,
    });
    if (misses >= TIMEOUTS_TO_FORFEIT) {
      finish(g, opponentOf(g, late), 'forfeit', now, events);
    } else {
      passTurn(g, g.turnDeadline, now, events);
    }
  }
  g.updatedAt = now;
  return { game: g, changed: true, events };
}

/** Validates and applies one player action. Call applyTimeouts first. */
export function applyAction(
  game: AsyncGame,
  playerId: string,
  action: GameAction,
  rng: () => number,
  now: string
): EngineResult {
  if (playerId !== game.hostId && playerId !== game.guestId) {
    return { ok: false, status: 403, error: 'You are not a player in this game.' };
  }
  if (game.status !== 'in_progress') return { ok: false, status: 409, error: 'This game is not in progress.' };

  const g = clone(game);
  const events: GameEvent[] = [];
  g.updatedAt = now;

  if (action.type === 'resign') {
    pushLog(g, now, { actorName: nameOf(g, playerId), actionName: 'Resigned', text: `${nameOf(g, playerId)} resigned.` });
    finish(g, opponentOf(g, playerId), 'resign', now, events);
    return { ok: true, game: g, events };
  }

  if (g.activePlayerId !== playerId) return { ok: false, status: 409, error: 'It is not your turn.' };

  if (action.type === 'end_turn') {
    if (playerId === g.hostId) g.hostTimeouts = 0;
    else g.guestTimeouts = 0;
    passTurn(g, now, now, events);
    return { ok: true, game: g, events };
  }

  if (action.type === 'move') {
    const mover = g.units.find((u) => u.id === action.unitId);
    if (!mover || mover.hp <= 0) return { ok: false, status: 400, error: 'Unit not found.' };
    if (mover.ownerId !== playerId) return { ok: false, status: 403, error: 'That is not your unit.' };
    if (!Number.isInteger(action.x) || !Number.isInteger(action.y)) return { ok: false, status: 400, error: 'Invalid tile.' };
    const occupied = g.units.filter((u) => u.hp > 0).map((u) => ({ x: u.x, y: u.y, unitId: u.id }));
    const check = canUnitMoveTo(mover, action.x, action.y, GRID, occupied, mover.id);
    if (!check.valid) return { ok: false, status: 400, error: check.reason || 'Invalid move.' };
    mover.x = action.x;
    mover.y = action.y;
    mover.ap -= check.apCost;
    pushLog(g, now, {
      actorName: mover.name,
      actionName: 'Repositioned',
      text: `${mover.name} maneuvered to (${action.x}, ${action.y}) [-${check.apCost} AP]`,
    });
    return { ok: true, game: g, events };
  }

  if (action.type === 'ability') {
    const actor = g.units.find((u) => u.id === action.unitId);
    if (!actor || actor.hp <= 0) return { ok: false, status: 400, error: 'Unit not found.' };
    if (actor.ownerId !== playerId) return { ok: false, status: 403, error: 'That is not your unit.' };
    const ability = actor.abilities.find((a) => a.id === action.abilityId);
    if (!ability) return { ok: false, status: 400, error: 'Ability not found.' };
    if (actor.ap < ability.apCost) return { ok: false, status: 400, error: 'Insufficient Action Points (AP).' };

    const friendly = ability.targetType === 'self' || ability.targetType === 'ally';
    const target = ability.targetType === 'self' ? actor : g.units.find((u) => u.id === action.targetId);
    if (!target || target.hp <= 0) return { ok: false, status: 400, error: 'Target not found.' };
    if (friendly && target.ownerId !== playerId) return { ok: false, status: 400, error: 'This ability targets your own units.' };
    if (!friendly && target.ownerId === playerId) return { ok: false, status: 400, error: 'This ability targets enemy units.' };
    const dist = calculateDistance(actor.x, actor.y, target.x, target.y);
    if (dist > ability.range) return { ok: false, status: 400, error: `Target out of range (${dist}/${ability.range}).` };

    actor.ap -= ability.apCost;
    let damage = 0;
    let isCritical = false;
    let torpor = 0;
    if (!friendly) {
      const res = calculateDamage(
        actor.attack,
        target.defense,
        ability.damageMultiplier || 1.0,
        target.statusEffects.some((s) => s.type === 'shield'),
        GRID.find((t) => t.x === target.x && t.y === target.y)?.defenseBonus || 0,
        actor.unitClass,
        target.unitClass,
        rng
      );
      damage = res.damage;
      isCritical = res.isCritical;
      target.hp = Math.max(0, target.hp - damage);
      if (ability.torporDamage) {
        torpor = calculateTorporDamage(ability.torporDamage, target.defense, actor.unitClass);
        target.torpor = Math.min(target.maxTorpor, target.torpor + torpor);
      }
    }
    if (ability.effect) {
      const type = ability.effect === 'knockback' || ability.effect === 'charge' ? 'stun' : (ability.effect as any);
      target.statusEffects.push({ type, duration: 2 });
    }

    let text = friendly
      ? `${actor.name} used [${ability.name}]${target.id === actor.id ? '' : ` on ${target.name}`}.`
      : `${actor.name} struck ${target.name} with [${ability.name}] for ${damage} damage!`;
    if (isCritical) text += ' CRITICAL STRIKE!';
    if (torpor > 0) text += ` (+${torpor} Torpor)`;
    if (target.hp === 0) text += ` ${target.name} has fallen!`;
    pushLog(g, now, {
      actorName: actor.name,
      actionName: ability.name,
      targetName: target.name,
      damage: friendly ? undefined : damage,
      torpor: torpor || undefined,
      text,
    });

    const win = checkWinCondition(g.units);
    if (win.isOver) finish(g, win.winnerPlayerId ?? null, win.winnerPlayerId ? 'elimination' : 'draw', now, events);
    return { ok: true, game: g, events };
  }

  return { ok: false, status: 400, error: 'Unknown action.' };
}
