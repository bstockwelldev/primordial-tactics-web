import test from 'node:test';
import assert from 'node:assert/strict';
import { trapTarget } from '../src/lib/modalFocus';

test('trapTarget: Tab on the last item wraps to the first', () => {
  assert.equal(trapTarget(4, 3, false), 0);
});

test('trapTarget: Shift+Tab on the first item wraps to the last', () => {
  assert.equal(trapTarget(4, 0, true), 3);
});

test('trapTarget: middle items move normally', () => {
  assert.equal(trapTarget(4, 1, false), null);
  assert.equal(trapTarget(4, 2, true), null);
});

test('trapTarget: focus outside the modal is pulled in', () => {
  assert.equal(trapTarget(4, -1, false), 0);
  assert.equal(trapTarget(4, -1, true), 3);
});

test('trapTarget: a single control keeps focus on itself', () => {
  assert.equal(trapTarget(1, 0, false), 0);
  assert.equal(trapTarget(1, 0, true), 0);
});

test('trapTarget: nothing focusable leaves it to the caller', () => {
  assert.equal(trapTarget(0, -1, false), null);
});
