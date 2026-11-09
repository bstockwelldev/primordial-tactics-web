import { Ability, BattleActionLog, GridTile, UnitEntity } from '../types/game';
import { calculateDamage, calculateDistance, calculateTorporDamage, canUnitMoveTo } from './rules';

export interface BotTurnResult {
  units: UnitEntity[];
  logs: BattleActionLog[];
}

// The bot only uses abilities that hurt an enemy. Ally/self abilities have no
// effect in the solo arena yet, so spending AP on them would be a wasted turn.
function isOffensive(ability: Ability): boolean {
  return ability.targetType === 'enemy' && (!!ability.damageMultiplier || !!ability.torporDamage);
}

function tileDefense(grid: GridTile[], x: number, y: number): number {
  return grid.find((t) => t.x === x && t.y === y)?.defenseBonus || 0;
}

// Expected damage with crits averaged out (rng pinned above every crit threshold).
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

interface AttackOption {
  ability: Ability;
  target: UnitEntity;
  score: number;
}

// Best attack available from a given position with a given AP budget.
// Kills dominate; otherwise damage per AP, nudged toward already-wounded targets (focus fire).
function bestAttackFrom(
  actor: UnitEntity,
  x: number,
  y: number,
  ap: number,
  foes: UnitEntity[],
  grid: GridTile[]
): AttackOption | null {
  let best: AttackOption | null = null;
  for (const ability of actor.abilities) {
    if (!isOffensive(ability) || ability.apCost > ap) continue;
    for (const target of foes) {
      if (calculateDistance(x, y, target.x, target.y) > ability.range) continue;
      const dmg = expectedDamage(actor, target, ability, grid);
      const kills = dmg >= target.hp;
      const score =
        (kills ? 1000 : 0) + (Math.min(dmg, target.hp) / ability.apCost) * (1 + (1 - target.hp / target.maxHp) * 0.5);
      if (!best || score > best.score) best = { ability, target, score };
    }
  }
  return best;
}

/**
 * Plays one full turn for every living bot unit (isPlayer === false) and returns
 * the resulting units plus the action log. Pure: the input array is not mutated,
 * and all randomness comes from `rng`.
 */
export function runBotTurn(
  units: UnitEntity[],
  grid: GridTile[],
  turn: number,
  rng: () => number = Math.random
): BotTurnResult {
  const state = units.map((u) => ({ ...u, statusEffects: [...u.statusEffects] }));
  const logs: BattleActionLog[] = [];
  const stamp = new Date().toLocaleTimeString();
  let seq = 0;
  const log = (entry: Omit<BattleActionLog, 'id' | 'turn' | 'timestamp'>) =>
    logs.push({ ...entry, id: `log_ai_${turn}_${seq++}_${Date.now()}`, turn, timestamp: stamp });

  for (const bot of state) {
    if (bot.isPlayer || bot.hp <= 0) continue;

    // A unit gets at most a handful of actions per turn; the cap only guards against a logic loop.
    for (let step = 0; step < 6 && bot.ap > 0; step++) {
      const foes = state.filter((u) => u.isPlayer && u.hp > 0);
      if (foes.length === 0) break;

      // 1. Attack from where we stand if anything is in reach.
      const attack = bestAttackFrom(bot, bot.x, bot.y, bot.ap, foes, grid);
      if (attack) {
        const { ability, target } = attack;
        const hasShield = target.statusEffects.some((s) => s.type === 'shield');
        let damage = 0;
        let isCritical = false;
        if (ability.damageMultiplier) {
          const res = calculateDamage(
            bot.attack,
            target.defense,
            ability.damageMultiplier,
            hasShield,
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
        continue;
      }

      // 2. Otherwise reposition: prefer a tile we can attack from with the AP left
      //    after moving; failing that, close the distance to the nearest foe.
      const occupied = state.filter((u) => u.hp > 0).map((u) => ({ x: u.x, y: u.y, unitId: u.id }));
      const nearestDist = (x: number, y: number) =>
        Math.min(...foes.map((f) => calculateDistance(x, y, f.x, f.y)));
      const currentDist = nearestDist(bot.x, bot.y);

      let bestMove: { x: number; y: number; apCost: number; score: number } | null = null;
      for (const tile of grid) {
        const check = canUnitMoveTo(bot, tile.x, tile.y, grid, occupied, bot.id);
        if (!check.valid) continue;
        const followUp = bestAttackFrom(bot, tile.x, tile.y, bot.ap - check.apCost, foes, grid);
        const dist = nearestDist(tile.x, tile.y);
        if (!followUp && dist >= currentDist) continue; // never wander away or sideways
        const score =
          (followUp ? 10000 + followUp.score : 0) - dist * 10 - check.apCost + (tile.defenseBonus || 0) * 0.1;
        if (!bestMove || score > bestMove.score) bestMove = { x: tile.x, y: tile.y, apCost: check.apCost, score };
      }
      if (!bestMove) break;

      bot.x = bestMove.x;
      bot.y = bestMove.y;
      bot.ap -= bestMove.apCost;
      log({
        actorName: bot.name,
        actionName: 'Moved',
        text: `[AI] ${bot.name} advanced to (${bestMove.x}, ${bestMove.y}) [-${bestMove.apCost} AP]`,
      });
    }
  }

  return { units: state, logs };
}
