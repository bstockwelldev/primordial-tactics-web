import test from 'node:test';
import assert from 'node:assert/strict';
import { FLAG_NAMES, resolveFlags } from '../src/config/flags';

const on = (search: string, stored: string | null = null) =>
  FLAG_NAMES.filter((n) => resolveFlags(search, stored).flags[n]);

test('flags: simple mode by default', () => {
  assert.deepEqual(on(''), []);
  assert.equal(resolveFlags('', null).persist, undefined);
});

test('flags: ?ff=all turns everything on and is remembered', () => {
  const r = resolveFlags('?ff=all', null);
  assert.deepEqual(FLAG_NAMES.filter((n) => r.flags[n]), [...FLAG_NAMES]);
  assert.equal(r.persist, 'all');
});

test('flags: names and aliases, unknown ignored', () => {
  assert.deepEqual(on('?ff=online,taming'), ['creatures', 'online']);
  assert.deepEqual(on('?ff=magitek,bogus'), ['magitek']);
  assert.deepEqual(on('?ff=coop'), ['localModes']);
});

test('flags: stored value applies when the URL has none', () => {
  assert.deepEqual(on('', 'online'), ['online']);
  assert.deepEqual(on('?ff=base', 'online'), ['base']);
});

test('flags: ?ff=none clears the override', () => {
  const r = resolveFlags('?ff=none', 'all');
  assert.deepEqual(FLAG_NAMES.filter((n) => r.flags[n]), []);
  assert.equal(r.persist, null);
});

test('flags: an invite link switches online on without persisting it', () => {
  const r = resolveFlags('?game=abc123', null);
  assert.deepEqual(FLAG_NAMES.filter((n) => r.flags[n]), ['online']);
  assert.equal(r.persist, undefined);
});
