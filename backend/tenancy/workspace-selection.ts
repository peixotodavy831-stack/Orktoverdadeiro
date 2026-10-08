import type { TenantRole } from './tenant-context.js';

export type ActiveWorkspaceMembership = Readonly<{
  workspace_id: string;
  user_id: string;
  role: string;
  status: string;
}>;

export class WorkspaceSelectionError extends Error {
  constructor(readonly statusCode: 403 | 409, message: string) {
    super(message);
    this.name = 'WorkspaceSelectionError';
  }
}

export function selectActiveWorkspaceMembership(
  userId: string,
  memberships: readonly ActiveWorkspaceMembership[],
  requestedWorkspaceId?: string,
): { workspaceId: string; role: TenantRole } {
  const active = memberships.filter(item => item.user_id === userId && item.status === 'active');
  if (requestedWorkspaceId) {
    const selected = active.find(item => item.workspace_id === requestedWorkspaceId);
    if (!selected) throw new WorkspaceSelectionError(403, 'Você não tem acesso a este workspace.');
    return { workspaceId: selected.workspace_id, role: normalizeRole(selected.role) };
  }

  // Prefer the user's personal workspace when one exists. This keeps legacy
  // sessions deterministic; a member with exactly one shared workspace can use it.
  const personal = active.find(item => item.workspace_id === userId && item.role === 'owner');
  if (personal) return { workspaceId: personal.workspace_id, role: 'owner' };
  if (active.length === 1) return { workspaceId: active[0].workspace_id, role: normalizeRole(active[0].role) };
  if (active.length > 1) throw new WorkspaceSelectionError(409, 'Selecione um workspace para continuar.');
  throw new WorkspaceSelectionError(403, 'Sua conta ainda não possui um workspace ativo.');
}

function normalizeRole(role: string): TenantRole {
  if (role === 'owner' || role === 'admin' || role === 'manager' || role === 'member') return role;
  throw new WorkspaceSelectionError(403, 'Seu papel de workspace não é válido.');
}
