import type { UnitEntity } from '../types/game';

// Pass & play party logic (spec: docs/local-coop-spec.md). Two humans share the human side of a
// match; each unit belongs to one slot. A round is: slot 0's phase, slot 1's phase, then the bots'.
// Pure functions only, so the arena screen, the saves and the simulator can all share them.

export type Slot = 0 | 1;
/** Whose turn it is: a human slot, or the bots ('enemy'). */
export type PartyPhase = Slot | 'enemy';

export const SLOTS: readonly Slot[] = [0, 1];

/** The slot that commands a unit. Units with no controller (every solo match) belong to slot 0. */
export const controllerOf = (unit: UnitEntity): Slot => unit.controller ?? 0;

/** True for units the bot drives: the enemy side with nobody assigned to command them. */
export const isBotControlled = (unit: UnitEntity): boolean => !unit.isPlayer && unit.controller === undefined;

/** Whether any bot-controlled unit is still alive (when none are, there is no enemy phase). */
export const hasBots = (units: UnitEntity[]): boolean => units.some((u) => u.hp > 0 && isBotControlled(u));

/**
 * True for units a human commands. Written so it does not assume "the other side is the bot":
 * a future versus mode can give an enemy-side unit a controller and it then counts as human.
 */
export const isHumanControlled = (unit: UnitEntity): boolean => unit.isPlayer || unit.controller !== undefined;

/** May `phase`'s player act with this unit right now? Dead units and bot units never can. */
export function canControl(unit: UnitEntity, phase: PartyPhase): boolean {
  return phase !== 'enemy' && unit.hp > 0 && isHumanControlled(unit) && controllerOf(unit) === phase;
}

/** Slots that still have a living human-controlled unit, in play order. */
export function livingSlots(units: UnitEntity[]): Slot[] {
  return SLOTS.filter((slot) => units.some((u) => u.hp > 0 && isHumanControlled(u) && controllerOf(u) === slot));
}

/** The phase a match starts in: the first slot with a living unit. */
export function firstPhase(units: UnitEntity[]): PartyPhase {
  return livingSlots(units)[0] ?? 'enemy';
}

/**
 * Where play goes after `current` ends. A slot with no living units is skipped, after the last
 * living slot the bots play, and when the bots finish a new round begins with the first living slot.
 * A solo match (no controllers) therefore cycles slot 0 -> enemy -> slot 0, as it always has.
 */
export function nextPhase(units: UnitEntity[], current: PartyPhase): { phase: PartyPhase; newRound: boolean } {
  const living = livingSlots(units);
  if (current === 'enemy') {
    return living.length > 0 ? { phase: living[0], newRound: true } : { phase: 'enemy', newRound: false };
  }
  const following = living.find((slot) => slot > current);
  if (following !== undefined) return { phase: following, newRound: false };
  // Past the last human slot. The bots go next, but only if there are any: in a versus match both
  // sides are human, so the round simply starts over with the first living slot.
  if (!hasBots(units) && living.length > 0) return { phase: living[0], newRound: true };
  return { phase: 'enemy', newRound: false };
}

/** Why this slot assignment cannot start a match, or null when it can. Each player needs a unit. */
export function validateSplit(units: UnitEntity[]): string | null {
  for (const slot of SLOTS) {
    const count = units.filter((u) => isHumanControlled(u) && controllerOf(u) === slot).length;
    if (count === 0) return `Player ${slot + 1} needs at least one unit.`;
  }
  return null;
}

/** Sets the controller of the listed units (id -> slot); every other unit is left as it is. */
export function assignSlots(units: UnitEntity[], assignments: Record<string, Slot>): UnitEntity[] {
  return units.map((u) => (u.id in assignments ? { ...u, controller: assignments[u.id] } : u));
}

/** Hands every human-controlled unit to the other player (the setup screen's "Swap"). */
export function swapSlots(units: UnitEntity[]): UnitEntity[] {
  return units.map((u) => (isHumanControlled(u) ? { ...u, controller: controllerOf(u) === 0 ? 1 : 0 } : u));
}

/** The slot each human unit currently has, as a map the setup screen can edit. */
export function defaultAssignments(units: UnitEntity[]): Record<string, Slot> {
  return Object.fromEntries(units.filter(isHumanControlled).map((u) => [u.id, controllerOf(u)]));
}

/** The same map with every unit handed to the other player. */
export function swapAssignments(assignments: Record<string, Slot>): Record<string, Slot> {
  return Object.fromEntries(Object.entries(assignments).map(([id, slot]) => [id, slot === 0 ? 1 : 0] as [string, Slot]));
}

/**
 * Whether the device has to change hands before `to` plays. With only one human still alive
 * there is nobody to hand over to, so the prompt is skipped (spec acceptance criterion 5).
 */
export function handoffNeeded(units: UnitEntity[], to: Slot): boolean {
  const living = livingSlots(units);
  return living.length > 1 && living.includes(to);
}

/**
 * Gives a phase's living units their full AP (a human slot's units, or the bots'). A round-based
 * versus match refreshes each side at the start of its own phase; units of other phases are untouched.
 */
export function refreshApFor(units: UnitEntity[], phase: PartyPhase): UnitEntity[] {
  return units.map((u) => {
    if (u.hp <= 0) return u;
    const mine = phase === 'enemy' ? isBotControlled(u) : isHumanControlled(u) && controllerOf(u) === phase;
    return mine ? { ...u, ap: u.maxAp } : u;
  });
}
