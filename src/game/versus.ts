import type { UnitEntity } from '../types/game';
import { VERSUS_TEMPLATE_SCALE } from './balance';
import { buildSoloUnits } from './arenaSetup';
import { DINOSAUR_SPECIES, UNIT_PORTRAITS } from './constants';
import { Slot, controllerOf } from './party';

// Local versus (docs/local-versus-spec.md): two people on one device each pick three units from the
// same pool of identical-level templates and fight on the plain arena. Pure functions, so the arena
// screen and the simulator build and judge exactly the same match. Never reads a save, a roster or a
// player level: versus must not touch progression.

/** The pool: the five species plus the Human commander. */
export const VERSUS_TEMPLATE_IDS = ['velociraptor', 'triceratops', 'pteranodon', 'ankylosaurus', 'dilophosaurus', 'commander'] as const;
export type VersusTemplateId = (typeof VERSUS_TEMPLATE_IDS)[number];

export const SQUAD_SIZE = 3;

/** Deployment tiles for a squad's three units, side A (left); side B mirrors them across the arena. */
const DEPLOY: ReadonlyArray<{ x: number; y: number }> = [
  { x: 0, y: 2 },
  { x: 1, y: 1 },
  { x: 1, y: 4 },
];
const ARENA_W = 8;

/** Why this squad is not a legal pick, or null when it is: exactly three, all in the pool, no repeats. */
export function validatePicks(picks: readonly string[]): string | null {
  if (picks.length !== SQUAD_SIZE) return `Pick exactly ${SQUAD_SIZE} units.`;
  if (picks.some((id) => !(VERSUS_TEMPLATE_IDS as readonly string[]).includes(id))) return 'Pick units from the pool.';
  if (new Set(picks).size !== picks.length) return 'Pick three different units.';
  return null;
}

/** One template as a unit for `side`, at deployment index `idx`. Fresh ability objects, no shared state. */
function templateUnit(id: VersusTemplateId, side: Slot, idx: number, owner: string): UnitEntity {
  const tuned = VERSUS_TEMPLATE_SCALE[id] ?? { hp: 1, attack: 1, defense: 1 };
  const spot = DEPLOY[idx];
  const x = side === 0 ? spot.x : ARENA_W - 1 - spot.x;

  // The commander is built exactly like the campaign's, at level 5 (scale 1.0), from nothing the player owns.
  const base: UnitEntity =
    id === 'commander'
      ? buildSoloUnits('Commander', [], null).find((u) => u.id === 'player_hero')!
      : (() => {
          const sp = DINOSAUR_SPECIES[id];
          return {
            id: '',
            isPlayer: true,
            ownerId: '',
            name: sp.name,
            speciesId: sp.id,
            unitClass: sp.unitClass,
            imageUrl: sp.imageUrl || UNIT_PORTRAITS[id] || UNIT_PORTRAITS.velociraptor,
            x: 0,
            y: 0,
            hp: sp.baseHp,
            maxHp: sp.baseHp,
            torpor: 0,
            maxTorpor: sp.baseTorporMax,
            ap: 3,
            maxAp: 3,
            attack: sp.baseAttack,
            defense: sp.baseDefense,
            speed: sp.baseSpeed,
            avatarIcon: 'Zap',
            abilities: sp.innateAbilities,
            statusEffects: [],
          } as UnitEntity;
        })();

  const hp = Math.round(base.maxHp * tuned.hp);
  return {
    ...base,
    id: `versus_${side === 0 ? 'a' : 'b'}_${id}`,
    // Side A is the human side (isPlayer); side B is the opposing human side: enemy side with a controller.
    isPlayer: side === 0,
    controller: side,
    ownerId: owner,
    name: id === 'commander' ? 'Commander' : base.name,
    x,
    y: spot.y,
    hp,
    maxHp: hp,
    torpor: 0,
    ap: base.maxAp,
    attack: Math.round(base.attack * tuned.attack),
    defense: Math.round(base.defense * tuned.defense),
    abilities: base.abilities.map((a) => ({ ...a })),
    statusEffects: [],
  };
}

/** Both squads on the mirrored deployment. Picks are template ids; throws on an illegal squad. */
export function buildVersusUnits(picksA: readonly string[], picksB: readonly string[]): UnitEntity[] {
  for (const picks of [picksA, picksB]) {
    const problem = validatePicks(picks);
    if (problem) throw new Error(problem);
  }
  return [
    ...picksA.map((id, i) => templateUnit(id as VersusTemplateId, 0, i, 'versus_a')),
    ...picksB.map((id, i) => templateUnit(id as VersusTemplateId, 1, i, 'versus_b')),
  ];
}

/** True when this is a versus match: the enemy side is commanded by a human slot, not by bots. */
export const isVersusMatch = (units: UnitEntity[]): boolean => units.some((u) => !u.isPlayer && u.controller !== undefined);

/** Share of a side's total max HP still standing, 0..1. */
function hpShare(units: UnitEntity[], slot: Slot): number {
  const mine = units.filter((u) => controllerOf(u) === slot && (u.isPlayer || u.controller !== undefined));
  const max = mine.reduce((n, u) => n + u.maxHp, 0);
  return max === 0 ? 0 : mine.reduce((n, u) => n + Math.max(0, u.hp), 0) / max;
}

/**
 * Who wins when the round limit is reached: the side with the larger share of its max HP left.
 * Equal shares (to within rounding) are a draw.
 */
export function roundLimitWinner(units: UnitEntity[]): Slot | 'draw' {
  const a = hpShare(units, 0);
  const b = hpShare(units, 1);
  if (Math.abs(a - b) < 1e-9) return 'draw';
  return a > b ? 0 : 1;
}

/** A uniformly random legal squad, for the balance harness. */
export function randomSquad(rng: () => number): VersusTemplateId[] {
  const pool = [...VERSUS_TEMPLATE_IDS];
  const squad: VersusTemplateId[] = [];
  while (squad.length < SQUAD_SIZE) squad.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  return squad;
}
