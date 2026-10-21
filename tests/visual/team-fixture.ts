import type { TeamView } from '../../src/product/adapters/team-contract.js';
export const visualTeam = {
  members: [{ user_id: 'visual-user', role: 'owner', status: 'active', joined_at: '2026-10-21T12:00:00Z' }],
  invites: [], currentRole: 'owner', currentUserId: 'visual-user',
} satisfies TeamView;
