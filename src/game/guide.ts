// First-battle step prompts. One short prompt at a time, driven by what the player has done.
// Three steps only (resist adding more): move, attack, end the turn.

export type GuideStep = 'move' | 'attack' | 'end';

export interface GuideProgress {
  moved: boolean;
  attacked: boolean;
  ended: boolean;
}

export const GUIDE_STEPS: GuideStep[] = ['move', 'attack', 'end'];

export const GUIDE_TEXT: Record<GuideStep, string> = {
  move: 'Tap one of your units, then tap a green tile to move.',
  attack: 'Pick an attack button, then tap an enemy in range.',
  end: 'Nice. Now press End Turn and the rivals will act.',
};

export interface GuideState extends GuideProgress {
  /** Turn number on which the first attack landed; "end turn" only counts from that turn on. */
  attackTurn: number | null;
}

export const GUIDE_START: GuideState = { moved: false, attacked: false, ended: false, attackTurn: null };

/**
 * Folds one observation of the board into the guide state. Each step sticks once done, and
 * "end your turn" only counts after the first attack, so ending a turn early never skips step 3.
 */
export function advanceGuide(prev: GuideState, obs: { moved: boolean; attacked: boolean; turn: number }): GuideState {
  const moved = prev.moved || obs.moved;
  const attacked = prev.attacked || obs.attacked;
  const attackTurn = prev.attackTurn ?? (obs.attacked ? obs.turn : null);
  const ended = prev.ended || (attackTurn !== null && obs.turn > attackTurn);
  return { moved, attacked, ended, attackTurn };
}

/** The first step the player has not done yet, or null when all three are done. */
export function nextGuideStep(p: GuideProgress): GuideStep | null {
  if (!p.moved) return 'move';
  if (!p.attacked) return 'attack';
  if (!p.ended) return 'end';
  return null;
}
