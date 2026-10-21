export interface TeamMember { user_id: string; role: string; status: string; joined_at: string | null }
export interface TeamInvite { id: string; email: string; role: string; expires_at: string }
export interface TeamView { members: TeamMember[]; invites: TeamInvite[]; currentRole: string; currentUserId: string }

/** /api/team returns a direct envelope; do not silently invent missing memberships. */
export function parseTeamResponse(input: unknown): TeamView {
  const value = input as TeamView | null;
  if (!value || !Array.isArray(value.members) || !Array.isArray(value.invites) || typeof value.currentRole !== 'string' || typeof value.currentUserId !== 'string'
    || value.members.some(member => !member || typeof member.user_id !== 'string' || typeof member.role !== 'string' || typeof member.status !== 'string' || !(member.joined_at === null || typeof member.joined_at === 'string'))
    || value.invites.some(invite => !invite || typeof invite.id !== 'string' || typeof invite.email !== 'string' || typeof invite.role !== 'string' || typeof invite.expires_at !== 'string')) {
    throw new Error('INVALID_TEAM_RESPONSE');
  }
  return value;
}
