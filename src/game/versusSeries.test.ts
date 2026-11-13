import test from 'node:test';
import assert from 'node:assert/strict';
import { nextPhase, refreshApFor } from './party';
import { VERSUS_ROUND_LIMIT } from './balance';
import {
  boardWinner,
  gameResult,
  limitWinner,
  namesBySlot,
  nextGame,
  pairResult,
  playerAt,
  recordGame,
  rematch,
  roundLimitReached,
  slotOf,
  startSeries,
  unitsForGame,
} from './versusSeries';

const A = ['velociraptor', 'triceratops', 'commander'];
const B = ['pteranodon', 'ankylosaurus', 'dilophosaurus'];
const series = (first: 0 | 1 = 0) => startSeries(['Ann', 'Bo'], [A, B], first);

test('sides: the player who moves first holds slot 0, and the sides swap in game 2', () => {
  const s = series(1);
  assert.equal(slotOf(s, 1), 0);
  assert.equal(slotOf(s, 0), 1);
  assert.deepEqual(namesBySlot(s), ['Bo', 'Ann']);
  const g2 = nextGame(s);
  assert.equal(slotOf(g2, 0), 0);
  assert.equal(playerAt(g2, 0), 0);
  assert.deepEqual(namesBySlot(g2), ['Ann', 'Bo']);
});

test('units: side A is the first mover and carries that player\'s squad; each player moves first once', () => {
  const s = series(0);
  const u1 = unitsForGame(s);
  assert.deepEqual(u1.filter((u) => u.controller === 0).map((u) => u.id), A.map((id) => `versus_a_${id}`));
  const u2 = unitsForGame(nextGame(s));
  assert.deepEqual(u2.filter((u) => u.controller === 0).map((u) => u.id), B.map((id) => `versus_a_${id}`));
  assert.deepEqual(u2.filter((u) => u.controller === 1).map((u) => u.id), A.map((id) => `versus_b_${id}`));
});

test('no bot phase: a round runs slot 0, slot 1, then a new round; refreshed AP only for the side that starts', () => {
  const units = unitsForGame(series());
  assert.deepEqual(nextPhase(units, 0), { phase: 1, newRound: false });
  assert.deepEqual(nextPhase(units, 1), { phase: 0, newRound: true });
  const spent = units.map((u) => ({ ...u, ap: 0 }));
  const refreshed = refreshApFor(spent, 1);
  assert.ok(refreshed.filter((u) => u.controller === 1).every((u) => u.ap === u.maxAp));
  assert.ok(refreshed.filter((u) => u.controller === 0).every((u) => u.ap === 0));
});

test('board winner: a wiped-out side loses, both wiped out is a draw, otherwise play on', () => {
  const units = unitsForGame(series());
  assert.equal(boardWinner(units), null);
  const killB = units.map((u) => (u.controller === 1 ? { ...u, hp: 0 } : u));
  assert.equal(boardWinner(killB), 0);
  const killA = units.map((u) => (u.controller === 0 ? { ...u, hp: 0 } : u));
  assert.equal(boardWinner(killA), 1);
  assert.equal(boardWinner(units.map((u) => ({ ...u, hp: 0 }))), 'draw');
});

test('round limit: reached only when the last side of round 25 has finished', () => {
  assert.equal(roundLimitReached(VERSUS_ROUND_LIMIT, true), true);
  assert.equal(roundLimitReached(VERSUS_ROUND_LIMIT, false), false);
  assert.equal(roundLimitReached(VERSUS_ROUND_LIMIT - 1, true), false);
  const units = unitsForGame(series());
  const hurtB = units.map((u) => (u.controller === 1 ? { ...u, hp: Math.round(u.maxHp / 2) } : u));
  assert.equal(limitWinner(hurtB), 0);
  assert.equal(limitWinner(units), 'draw');
});

test('a pair is scored by player across the side swap, with the HP margin as the tie-break', () => {
  // Game 1: Ann (slot 0) wins by a wide HP margin.
  let s = series(0);
  const g1 = unitsForGame(s).map((u) => (u.controller === 1 ? { ...u, hp: 0 } : u));
  s = recordGame(s, gameResult(s, g1, boardWinner(g1)!));
  assert.equal(s.results[0].winner, 'a');
  assert.equal(pairResult(s), null);
  // Game 2: sides swapped; Bo (now slot 0) wins, but only narrowly after the limit.
  s = nextGame(s);
  const g2 = unitsForGame(s).map((u) => (u.controller === 0 ? { ...u, hp: Math.round(u.maxHp * 0.9) } : { ...u, hp: Math.round(u.maxHp * 0.8) }));
  s = recordGame(s, gameResult(s, g2, limitWinner(g2)));
  assert.equal(s.results[1].winner, 'b');
  const pair = pairResult(s)!;
  assert.deepEqual([pair.aWins, pair.bWins], [1, 1]);
  assert.equal(pair.winner, 'a', 'one win each: Ann\'s wipeout margin outweighs Bo\'s narrow one');
});

test('rematch keeps names and squads and starts again at game 1', () => {
  let s = recordGame(series(0), { winner: 'a', margin: 0.4 });
  s = rematch(nextGame(s), 1);
  assert.equal(s.game, 1);
  assert.equal(s.results.length, 0);
  assert.equal(s.first, 1);
  assert.deepEqual(s.picks, [A, B]);
});
