import test from 'node:test';
import assert from 'node:assert/strict';
import { nextGuideStep } from './guide';

test('guide: steps arrive in order and finish', () => {
  assert.equal(nextGuideStep({ moved: false, attacked: false, ended: false }), 'move');
  assert.equal(nextGuideStep({ moved: true, attacked: false, ended: false }), 'attack');
  assert.equal(nextGuideStep({ moved: true, attacked: true, ended: false }), 'end');
  assert.equal(nextGuideStep({ moved: true, attacked: true, ended: true }), null);
});

test('guide: attacking before moving still asks for a move first', () => {
  assert.equal(nextGuideStep({ moved: false, attacked: true, ended: false }), 'move');
});
