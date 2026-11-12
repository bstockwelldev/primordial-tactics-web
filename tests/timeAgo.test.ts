import test from 'node:test';
import assert from 'node:assert/strict';
import { timeAgo } from '../src/lib/asyncApi';

test('timeAgo: just now, minutes, hours, days', () => {
  const now = Date.parse('2026-11-12T12:00:00.000Z');
  const ago = (ms: number) => timeAgo(new Date(now - ms).toISOString(), now);
  assert.equal(ago(20_000), 'just now');
  assert.equal(ago(5 * 60_000), '5m ago');
  assert.equal(ago(3 * 3600_000 + 59_000), '3h ago');
  assert.equal(ago(49 * 3600_000), '2d ago');
});
