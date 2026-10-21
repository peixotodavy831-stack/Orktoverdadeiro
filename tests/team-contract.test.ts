import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseTeamResponse } from '../src/product/adapters/team-contract.js';
import { visualTeam } from './visual/team-fixture.js';

test('team visual fixture matches the direct API envelope consumed by the screen', () => {
  assert.equal(parseTeamResponse(visualTeam), visualTeam);
  assert.throws(() => parseTeamResponse({ data: visualTeam }), /INVALID_TEAM_RESPONSE/);
});
test('team response rejects malformed members and accepts an explicitly empty team', () => {
  assert.deepEqual(parseTeamResponse({ ...visualTeam, members: [] }).members, []);
  for (const input of [null, {}, { ...visualTeam, members: [null] }, { ...visualTeam, currentRole: null }, { ...visualTeam, invites: [{ id: 'x' }] }]) assert.throws(() => parseTeamResponse(input));
});
