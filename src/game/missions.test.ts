import test from 'node:test';
import assert from 'node:assert/strict';
import { ISLAND_CAMPAIGN_SECTORS } from './constants';
import { missionList, nextMission } from './missions';

test('missions: simple mode lists two Primoris missions, full lists all', () => {
  assert.deepEqual(missionList(ISLAND_CAMPAIGN_SECTORS, false).map((s) => s.id), ['sector_primoris_2', 'sector_primoris_3']);
  assert.equal(missionList(ISLAND_CAMPAIGN_SECTORS, true).length, ISLAND_CAMPAIGN_SECTORS.length);
});

test('missions: next skips won and excluded sectors', () => {
  const m = missionList(ISLAND_CAMPAIGN_SECTORS, false).map((s) => ({ ...s, liberated: false }));
  assert.equal(nextMission(m)?.id, 'sector_primoris_2');
  assert.equal(nextMission(m, 'sector_primoris_2')?.id, 'sector_primoris_3');
  m[0].liberated = true;
  assert.equal(nextMission(m)?.id, 'sector_primoris_3');
  m[1].liberated = true;
  assert.equal(nextMission(m), null);
});
