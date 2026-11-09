import { Ability, BattleActionLog, GridTile, UnitEntity } from '../types/game';
import { calculateDamage, calculateDistance, calculateTorporDamage, canUnitMoveTo } from './rules';

// ---------------------------------------------------------------------------
// Bot = a per-unit finite state machine.
//
//   ASSESS ──► FINISH      a kill is available from this tile
//          ──► KITE        wounded ranged unit with a foe adjacent: step back, keep shooting
//          ──► ENGAGE      an attack is available from this tile
//          ──► REPOSITION  a reachable tile allows an attack with the AP left after moving
//          ──► ADVANCE     nothing reachable: close the distance
//          ──► DONE        no AP, no foes, or nothing useful to do (terminal)
//
// Every action state performs exactly one action that costs at least 1 AP and
// returns to ASSESS, so a unit's turn always terminates. Decisions use no
// randomness and break ties by fixed iteration order; the only dice are the
// combat rolls, drawn from the injected rng. Same units + same rng = same turn.
// ---------------------------------------------------------------------------

export type BotState = 'ASSESS' | 'FINISH' | 'KITE' | 'ENGAGE' | 'REPOSITION' | 'ADVANCE' | 'DONE';

export const BOT_TRANSITIONS: Record<BotState, readonly BotState[]> = {
  ASSESS: ['FINISH', 'KITE', 'ENGAGE', 'REPOSITION', 'ADVANCE', 'DONE'],
  FINISH: ['ASSESS'],
  KITE: ['ASSESS'],
  ENGAGE: ['ASSESS'],
  REPOSITION: ['ASSESS'],
  ADVANCE: ['ASSESS'],
  DONE: [],
};

export interface BotProfile {
  id: 'static' | 'easy' | 'moderate';
  /** May the unit move at all? */
  moves: boolean;
  /** Pick the best ability/target by expected damage (else: first usable ability on the nearest foe). */
  evaluatesAttacks: boolean;
  /** Take a kill whenever one is available, and prefer already-wounded targets. */
  focusFire: boolean;
  /** Look for a tile to attack from this turn (else: just walk toward the nearest foe). */
  repositions: boolean;
  /** Prefer defensive terrain when otherwise indifferent. */
  usesCover: boolean;
  /** Wounded ranged units step out of melee before shooting. */
  kites: boolean;
  /**
   * When it cannot attack this turn, stop just outside the foes' strike reach instead of
   * walking into it with no AP left — so the unit strikes first next turn at full AP.
   */
  stagesApproach: boolean;
}

export const BOT_PROFILES: Record<BotProfile['id'], BotProfile> = {
  // The pre-2026-11-09 behaviour, kept as a test baseline: never moves, first ability only.
  static: { id: 'static', moves: false, evaluatesAttacks: false, focusFire: false, repositions: false, usesCover: false, kites: false, stagesApproach: false },
  easy: { id: 'easy', moves: true, evaluatesAttacks: false, focusFire: false, repositions: false, usesCover: false, kites: false, stagesApproach: false },
  // The PvE / campaign opponent.
  moderate: { id: 'moderate', moves: true, evaluatesAttacks: true, focusFire: true, repositions: true, usesCover: true, kites: true, stagesApproach: true },
};

export interface BotTraceEntry {
  unitId: string;
  state: BotState;
  ap: number;
}

export interface BotTurnResult {
  units: UnitEntity[];
  logs: BattleActionLog[];
  /** Every state each unit passed through, in order. For tests and debugging. */
  trace: BotTraceEntry[];
}

export interface BotTurnOptions {
  profile?: BotProfile;
  /** Which side the bot plays. Default: the enemy (isPlayer === false). */
  side?: 'enemy' | 'player';
  /** Log timestamp; injectable so results are byte-for-byte reproducible. */
  timestamp?: string;
}

const KITE_HP_RATIO = 0.35;
const KITE_MIN_RANGE = 3;
/** Rounds the moderate bot will wait, poised, for the other side to come to it. */
const STAGING_ROUNDS = 3;

// The bot only uses abilities that hurt an enemy. Ally/self abilities have no
// effect in the solo arena yet, so spending AP on them would be a wasted turn.
function isOffensive(ability: Ability): boolean {
  return ability.targetType === 'enemy' && (!!ability.damageMultiplier || !!ability.torporDamage);
}

function tileDefense(grid: GridTile[], x: number, y: number): number {
  return grid.find((t) => t.x === x && t.y === y)?.defenseBonus || 0;
}

// Expected damage with no crit (rng pinned above every crit threshold).
function expectedDamage(actor: UnitEntity, target: UnitEntity, ability: Ability, grid: GridTile[]): number {
  if (!ability.damageMultiplier) return 0;
  const hasShield = target.statusEffects.some((s) => s.type === 'shield');
  return calculateDamage(
    actor.attack,
    target.defense,
    ability.damageMultiplier,
    hasShield,
    tileDefense(grid, target.x, target.y),
    actor.unitClass,
    target.unitClass,
    () => 1
  ).damage;
}

/**
 * How far away a unit can hurt something on its next turn starting from full AP:
 * best over its attacks of (ability range + tiles it can still walk after paying for it).
 * Ignores obstacles, so it is a slight over-estimate — the safe direction.
 */
export function strikeReach(unit: UnitEntity): number {
  let reach = 0;
  for (const a of unit.abilities) {
    if (!isOffensive(a) || a.apCost > unit.maxAp) continue;
    const apLeft = unit.maxAp - a.apCost;
    const walk = unit.speed >= 2 ? apLeft * 2 : apLeft; // 1 AP per 2 tiles, each move capped by speed
    reach = Math.max(reach, a.range + walk);
  }
  return reach;
}

interface AttackPlan {
  ability: Ability;
  target: UnitEntity;
  score: number;
  kills: boolean;
}

interface MovePlan {
  x: number;
  y: number;
  apCost: number;
}

/** Best attack from (x, y) with `ap` to spend, under the given profile. */
function planAttack(
  profile: BotProfile,
  actor: UnitEntity,
  x: number,
  y: number,
  ap: number,
  foes: UnitEntity[],
  grid: GridTile[]
): AttackPlan | null {
  const usable = actor.abilities.filter((a) => isOffensive(a) && a.apCost <= ap);

  if (!profile.evaluatesAttacks) {
    // Nearest foe (first in list on ties), first listed ability that reaches it.
    let nearest: UnitEntity | null = null;
    let nearestDist = Infinity;
    for (const foe of foes) {
      const d = calculateDistance(x, y, foe.x, foe.y);
      if (d < nearestDist) {
        nearest = foe;
        nearestDist = d;
      }
    }
    if (!nearest) return null;
    const ability = usable.find((a) => nearestDist <= a.range);
    if (!ability) return null;
    const dmg = expectedDamage(actor, nearest, ability, grid);
    return { ability, target: nearest, score: dmg, kills: dmg >= nearest.hp };
  }

  let best: AttackPlan | null = null;
  for (const ability of usable) {
    for (const target of foes) {
      if (calculateDistance(x, y, target.x, target.y) > ability.range) continue;
      const dmg = expectedDamage(actor, target, ability, grid);
      const kills = dmg >= target.hp;
      let score = Math.min(dmg, target.hp) / ability.apCost;
      if (profile.focusFire) {
        score *= 1 + (1 - target.hp / target.maxHp) * 0.5;
        if (kills) score += 1000;
      }
      if (!best || score > best.score) best = { ability, target, score, kills };
    }
  }
  return best;
}

interface Decision {
  state: Exclude<BotState, 'ASSESS'>;
  attack?: AttackPlan;
  move?: MovePlan;
}

const key = (x: number, y: number) => `${x},${y}`;

/**
 * Cheapest AP cost to walk between tiles under the movement rule (one move = any
 * walkable, unoccupied tile within `speed`, costing 1 AP per 2 tiles). Dijkstra from
 * `sources`; moves are symmetric, so the same routine gives "cost from here" and
 * "cost to reach any goal". `prev` holds the first hop back toward a source.
 */
function walkCosts(
  sources: Array<{ x: number; y: number }>,
  speed: number,
  grid: GridTile[],
  blocked: Set<string>
): { cost: Map<string, number>; prev: Map<string, string> } {
  const cost = new Map<string, number>();
  const prev = new Map<string, string>();
  const open = grid.filter((t) => t.walkable && !blocked.has(key(t.x, t.y)));
  for (const s of sources) cost.set(key(s.x, s.y), 0);
  const done = new Set<string>();
  const nodes = [...sources.map((s) => ({ x: s.x, y: s.y })), ...open];
  for (;;) {
    let cur: { x: number; y: number } | null = null;
    let curCost = Infinity;
    for (const n of nodes) {
      const k = key(n.x, n.y);
      const c = cost.get(k);
      if (c !== undefined && !done.has(k) && c < curCost) {
        cur = n;
        curCost = c;
      }
    }
    if (!cur) break;
    const ck = key(cur.x, cur.y);
    done.add(ck);
    for (const t of open) {
      const d = calculateDistance(cur.x, cur.y, t.x, t.y);
      if (d === 0 || d > speed) continue;
      const next = curCost + Math.max(1, Math.ceil(d / 2));
      const tk = key(t.x, t.y);
      if (next < (cost.get(tk) ?? Infinity)) {
        cost.set(tk, next);
        prev.set(tk, ck);
      }
    }
  }
  return { cost, prev };
}

/** The ASSESS state: guards evaluated in priority order. Pure. */
export function assess(
  profile: BotProfile,
  bot: UnitEntity,
  all: UnitEntity[],
  grid: GridTile[],
  turn = 1
): Decision {
  const foes = all.filter((u) => u.isPlayer !== bot.isPlayer && u.hp > 0);
  if (bot.hp <= 0 || bot.ap <= 0 || foes.length === 0) return { state: 'DONE' };

  const attack = planAttack(profile, bot, bot.x, bot.y, bot.ap, foes, grid);
  if (attack && attack.kills && profile.focusFire) return { state: 'FINISH', attack };
  if (!profile.moves) return attack ? { state: 'ENGAGE', attack } : { state: 'DONE' };

  const blocked = new Set(all.filter((u) => u.hp > 0 && u.id !== bot.id).map((u) => key(u.x, u.y)));
  const nearestFoeDist = (x: number, y: number) => Math.min(...foes.map((f) => calculateDistance(x, y, f.x, f.y)));
  const here = nearestFoeDist(bot.x, bot.y);

  // Every tile the unit can end on this turn (possibly via several moves), with the AP it costs.
  const from = walkCosts([{ x: bot.x, y: bot.y }], bot.speed, grid, blocked);
  const firstHop = (x: number, y: number): MovePlan => {
    let k = key(x, y);
    const start = key(bot.x, bot.y);
    while (from.prev.get(k) !== start) k = from.prev.get(k)!;
    const [hx, hy] = k.split(',').map(Number);
    return { x: hx, y: hy, apCost: from.cost.get(k)! };
  };
  const options = grid
    .filter((t) => {
      const c = from.cost.get(key(t.x, t.y));
      return c !== undefined && c > 0 && c <= bot.ap;
    })
    .map((t) => {
      const apCost = from.cost.get(key(t.x, t.y))!;
      return {
        x: t.x,
        y: t.y,
        apCost,
        dist: nearestFoeDist(t.x, t.y),
        cover: profile.usesCover ? t.defenseBonus || 0 : 0,
        followUp: planAttack(profile, bot, t.x, t.y, bot.ap - apCost, foes, grid),
      };
    });
  type Option = (typeof options)[number];
  const pick = (list: Option[], score: (o: Option) => number): MovePlan | undefined => {
    let best: Option | undefined;
    let bestScore = -Infinity;
    for (const o of list) {
      const s = score(o);
      if (s > bestScore) {
        best = o;
        bestScore = s;
      }
    }
    return best && firstHop(best.x, best.y);
  };

  // KITE: wounded, has a ranged attack, a foe is adjacent, and a safer firing tile exists.
  if (profile.kites && bot.hp / bot.maxHp < KITE_HP_RATIO && here <= 1) {
    const hasRanged = bot.abilities.some((a) => isOffensive(a) && a.range >= KITE_MIN_RANGE);
    if (hasRanged) {
      const move = pick(
        options.filter((o) => o.followUp && o.dist > here),
        (o) => o.dist * 10 + o.cover * 0.1 + o.followUp!.score * 0.01 - o.apCost
      );
      if (move) return { state: 'KITE', move };
    }
  }

  if (attack) return { state: 'ENGAGE', attack };

  if (profile.repositions) {
    const move = pick(
      options.filter((o) => o.followUp),
      (o) => o.followUp!.score + o.cover * 0.1 - o.apCost - o.dist * 0.01
    );
    if (move) return { state: 'REPOSITION', move };
  }

  // ADVANCE. Progress is measured in AP still needed to reach a tile it can attack from
  // (true walking cost, so rocks and crowds are routed around), never straight-line distance.
  const attacks = bot.abilities.filter((a) => isOffensive(a) && a.apCost <= bot.maxAp);
  const toStrike = attacks.map((a) => ({
    ability: a,
    costs: walkCosts(
      grid.filter(
        (t) =>
          t.walkable &&
          !blocked.has(key(t.x, t.y)) &&
          foes.some((f) => calculateDistance(t.x, t.y, f.x, f.y) <= a.range)
      ),
      bot.speed,
      grid,
      blocked
    ).cost,
  }));
  const apToStrike = (x: number, y: number) =>
    Math.min(Infinity, ...toStrike.map((s) => s.costs.get(key(x, y)) ?? Infinity));
  const strikesNextTurn = (x: number, y: number) =>
    toStrike.some((s) => (s.costs.get(key(x, y)) ?? Infinity) + s.ability.apCost <= bot.maxAp);

  const currentCost = apToStrike(bot.x, bot.y);
  const closer = options.filter((o) => apToStrike(o.x, o.y) < currentCost);

  if (profile.stagesApproach) {
    // Damage the foes could deal next turn to this unit if it ended its turn on (x, y).
    const threatAt = (x: number, y: number) => {
      const self = { ...bot, x, y };
      let total = 0;
      for (const f of foes) {
        let worst = 0;
        for (const a of f.abilities) {
          if (!isOffensive(a) || a.apCost > f.maxAp) continue;
          const apLeft = f.maxAp - a.apCost;
          const walk = f.speed >= 2 ? apLeft * 2 : apLeft;
          if (calculateDistance(x, y, f.x, f.y) <= a.range + walk) {
            worst = Math.max(worst, expectedDamage(f, self, a, grid));
          }
        }
        total += worst;
      }
      return total;
    };
    const poised = closer.filter((o) => strikesNextTurn(o.x, o.y));
    const stagingScore = (o: Option) => -threatAt(o.x, o.y) * 10 + o.cover * 0.1 - o.apCost;

    // Before first blood, and only for a few rounds, a unit that is already poised to strike
    // next turn holds its ground unless a poised tile is strictly safer: let the other side
    // spend its AP walking in. The round limit guarantees the bot always brings the fight.
    const firstBlood = all.some((u) => u.hp < u.maxHp);
    if (!firstBlood && turn <= STAGING_ROUNDS && strikesNextTurn(bot.x, bot.y)) {
      const hereThreat = threatAt(bot.x, bot.y);
      const safer = pick(
        poised.filter((o) => threatAt(o.x, o.y) < hereThreat),
        stagingScore
      );
      return safer ? { state: 'ADVANCE', move: safer } : { state: 'DONE' };
    }
    // Otherwise close in, ending on the poised tile that takes the least punishment.
    const staged = pick(poised, stagingScore);
    if (staged) return { state: 'ADVANCE', move: staged };
  }

  const move = pick(closer, (o) => -apToStrike(o.x, o.y) * 100 - o.apCost + o.cover * 0.1);
  if (move) return { state: 'ADVANCE', move };

  return { state: 'DONE' };
}

/**
 * Plays one full turn for every living unit on the bot's side and returns the
 * resulting units, the action log, and the state trace. Pure: the input is not
 * mutated; all randomness comes from `rng`.
 */
export function runBotTurn(
  units: UnitEntity[],
  grid: GridTile[],
  turn: number,
  rng: () => number = Math.random,
  options: BotTurnOptions = {}
): BotTurnResult {
  const profile = options.profile ?? BOT_PROFILES.moderate;
  const botIsPlayer = options.side === 'player';
  const timestamp = options.timestamp ?? new Date().toLocaleTimeString();

  const state = units.map((u) => ({ ...u, statusEffects: [...u.statusEffects] }));
  const logs: BattleActionLog[] = [];
  const trace: BotTraceEntry[] = [];
  const log = (entry: Omit<BattleActionLog, 'id' | 'turn' | 'timestamp'>) =>
    logs.push({ ...entry, id: `log_ai_${botIsPlayer ? 'p' : 'e'}_${turn}_${logs.length}`, turn, timestamp });

  for (const bot of state) {
    if (bot.isPlayer !== botIsPlayer || bot.hp <= 0) continue;

    let current: BotState = 'ASSESS';
    const enter = (next: BotState) => {
      if (!BOT_TRANSITIONS[current].includes(next)) {
        throw new Error(`Illegal bot transition ${current} -> ${next} (${bot.id})`);
      }
      current = next;
      trace.push({ unitId: bot.id, state: next, ap: bot.ap });
    };
    trace.push({ unitId: bot.id, state: 'ASSESS', ap: bot.ap });

    while ((current as BotState) !== 'DONE') {
      const apBefore = bot.ap;
      const decision = assess(profile, bot, state, grid, turn);
      enter(decision.state);
      if (decision.state === 'DONE') break;

      if (decision.attack) {
        const { ability } = decision.attack;
        const target = state.find((u) => u.id === decision.attack!.target.id)!;
        let damage = 0;
        let isCritical = false;
        if (ability.damageMultiplier) {
          const res = calculateDamage(
            bot.attack,
            target.defense,
            ability.damageMultiplier,
            target.statusEffects.some((s) => s.type === 'shield'),
            tileDefense(grid, target.x, target.y),
            bot.unitClass,
            target.unitClass,
            rng
          );
          damage = res.damage;
          isCritical = res.isCritical;
        }
        let torpor = 0;
        if (ability.torporDamage) {
          torpor = calculateTorporDamage(ability.torporDamage, target.defense, bot.unitClass);
          target.torpor = Math.min(target.maxTorpor, target.torpor + torpor);
        }
        target.hp = Math.max(0, target.hp - damage);
        bot.ap -= ability.apCost;

        let text = `[AI] ${bot.name} struck ${target.name} with ${ability.name} for ${damage} damage!`;
        if (isCritical) text += ' CRITICAL HIT!';
        if (torpor > 0) text += ` (+${torpor} Torpor)`;
        if (target.hp === 0) text += ` ${target.name} has fallen!`;
        log({ actorName: bot.name, actionName: ability.name, targetName: target.name, damage, torpor, text });
      } else if (decision.move) {
        const { x, y, apCost } = decision.move;
        bot.x = x;
        bot.y = y;
        bot.ap -= apCost;
        const verb = decision.state === 'KITE' ? 'fell back' : 'advanced';
        log({
          actorName: bot.name,
          actionName: 'Moved',
          text: `[AI] ${bot.name} ${verb} to (${x}, ${y}) [-${apCost} AP]`,
        });
      }

      // Termination invariant: an action state must spend AP.
      if (bot.ap >= apBefore) throw new Error(`Bot action ${decision.state} spent no AP (${bot.id})`);
      enter('ASSESS');
    }
  }

  return { units: state, logs, trace };
}
