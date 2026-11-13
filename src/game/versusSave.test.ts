import test from 'node:test';
import assert from 'node:assert/strict';
import { readSoloSave, SOLO_SAVE_KEY } from './soloSave';
import { VERSUS_SAVE_KEY, VersusSave, isResumable, readVersusSave } from './versusSave';
import { nextGame, recordGame, startSeries, unitsForGame } from './versusSeries';

const series = () => startSeries(['Ann', 'Bo'], [['velociraptor', 'triceratops', 'commander'], ['pteranodon', 'ankylosaurus', 'dilophosaurus']], 0);
const save = (over: Partial<VersusSave> = {}): VersusSave => {
  const s = series();
  return { mode: 'versus', series: s, units: unitsForGame(s), logs: [], turn: 3, slot: 1, over: false, endedBy: 'wipeout', ...over };
};
const raw = (v: unknown) => JSON.stringify(v);

test('keys: versus has its own key, never the campaign one', () => {
  assert.equal(VERSUS_SAVE_KEY, 'pt_versus_match');
  assert.notEqual(VERSUS_SAVE_KEY, SOLO_SAVE_KEY);
});

test('a versus save round-trips', () => {
  const v = readVersusSave(raw(save()));
  assert.ok(v);
  assert.equal(v!.turn, 3);
  assert.equal(v!.slot, 1);
  assert.deepEqual(v!.series.names, ['Ann', 'Bo']);
  assert.equal(v!.units.length, 6);
});

test('a versus save is never read as a campaign save, and vice versa', () => {
  assert.equal(readSoloSave(raw(save())), null);
  assert.equal(readVersusSave(raw({ sectorId: null, units: unitsForGame(series()), logs: [], turn: 1, isPlayerTurn: true })), null);
});

test('malformed saves are rejected', () => {
  assert.equal(readVersusSave(null), null);
  assert.equal(readVersusSave('{nope'), null);
  assert.equal(readVersusSave(raw({ ...save(), mode: 'solo' })), null);
  assert.equal(readVersusSave(raw({ ...save(), turn: 0 })), null);
  assert.equal(readVersusSave(raw({ ...save(), turn: 26 })), null);
  assert.equal(readVersusSave(raw({ ...save(), slot: 2 })), null);
  assert.equal(readVersusSave(raw({ ...save(), endedBy: 'x' })), null);
  const s = save();
  assert.equal(readVersusSave(raw({ ...s, series: { ...s.series, names: ['Ann', ''] } })), null);
  assert.equal(readVersusSave(raw({ ...s, series: { ...s.series, picks: [['velociraptor', 'velociraptor', 'commander'], s.series.picks[1]] } })), null);
  assert.equal(readVersusSave(raw({ ...s, units: s.units.slice(1) })), null);
  assert.equal(readVersusSave(raw({ ...s, units: s.units.map((u, i) => (i === 0 ? { ...u, controller: 1 } : u)) })), null);
  assert.equal(readVersusSave(raw({ ...s, units: s.units.map((u, i) => (i === 0 ? { ...u, hp: u.maxHp + 1 } : u)) })), null);
});

test('results must match the game number: game 2 needs one finished game', () => {
  const s = series();
  assert.equal(readVersusSave(raw({ ...save(), series: nextGame(s) })), null);
  const g2 = recordGame(s, { winner: 'a', margin: 0.3 });
  assert.ok(readVersusSave(raw({ ...save(), series: { ...nextGame(g2), units: undefined } as any, units: unitsForGame(nextGame(g2)) })));
});

test('a live game needs both sides standing and the active side alive', () => {
  const s = save();
  const wipedB = s.units.map((u) => (u.controller === 1 ? { ...u, hp: 0 } : u));
  assert.equal(readVersusSave(raw({ ...s, units: wipedB })), null);
  assert.ok(readVersusSave(raw({ ...s, units: wipedB, over: true, series: recordGame(s.series, { winner: 'a', margin: 0.5 }) })), 'a finished game may have a wiped side');
});

test('a finished pair is not resumable; a finished game 1 is', () => {
  const s = series();
  const done1 = save({ over: true, series: recordGame(s, { winner: 'a', margin: 0.2 }) });
  assert.equal(isResumable(done1), true);
  const g2 = recordGame(nextGame(recordGame(s, { winner: 'a', margin: 0.2 })), { winner: 'b', margin: -0.1 });
  const done2 = save({ over: true, series: g2, units: unitsForGame(nextGame(s)) });
  assert.equal(isResumable(done2), false);
});
