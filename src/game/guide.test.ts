import test from 'node:test';
import assert from 'node:assert/strict';
import { GUIDE_START, advanceGuide, nextGuideStep } from './guide';

test('guide: steps arrive in order and finish', () => {
  assert.equal(nextGuideStep({ moved: false, attacked: false, ended: false }), 'move');
  assert.equal(nextGuideStep({ moved: true, attacked: false, ended: false }), 'attack');
  assert.equal(nextGuideStep({ moved: true, attacked: true, ended: false }), 'end');
  assert.equal(nextGuideStep({ moved: true, attacked: true, ended: true }), null);
});

test('guide: attacking before moving still asks for a move first', () => {
  assert.equal(nextGuideStep({ moved: false, attacked: true, ended: false }), 'move');
});

test('guide: ending a turn before attacking does not skip the end-turn step', () => {
  let s = advanceGuide(GUIDE_START, { moved: true, attacked: false, turn: 1 });
  s = advanceGuide(s, { moved: true, attacked: false, turn: 2 }); // turn ended early
  assert.equal(nextGuideStep(s), 'attack');
  s = advanceGuide(s, { moved: true, attacked: true, turn: 2 }); // attack lands on turn 2
  assert.equal(nextGuideStep(s), 'end');
  s = advanceGuide(s, { moved: true, attacked: true, turn: 3 }); // now the turn ends
  assert.equal(nextGuideStep(s), null);
});
