export type TenantRole = 'owner' | 'admin' | 'manager' | 'member' | 'operator' | 'channel';

export type TenantContext = Readonly<{
  userId: string;
  workspaceId: string;
  tenantId: string;
  role: TenantRole;
}>;

type TenantScopedQuery<TQuery> = {
  eq(column: string, value: string): TQuery;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class TenantContextError extends Error {
  constructor(message = 'Contexto de tenant inválido ou ausente.') {
    super(message);
    this.name = 'TenantContextError';
  }
}

export function createOwnerTenantContext(userId: string): TenantContext {
  const normalizedUserId = userId.trim();
  if (!UUID_PATTERN.test(normalizedUserId)) throw new TenantContextError();

  return createWorkspaceTenantContext(normalizedUserId, normalizedUserId, 'owner');
}

export function createWorkspaceTenantContext(userId: string, workspaceId: string, role: TenantRole): TenantContext {
  const normalizedUserId = userId.trim();
  const normalizedWorkspaceId = workspaceId.trim();
  if (!UUID_PATTERN.test(normalizedUserId) || !UUID_PATTERN.test(normalizedWorkspaceId)) throw new TenantContextError();
  if (!['owner','admin','manager','member'].includes(role)) throw new TenantContextError('Papel de workspace inválido.');
  return Object.freeze({ userId: normalizedUserId, workspaceId: normalizedWorkspaceId, tenantId: normalizedWorkspaceId, role });
}

export function requireTenantContext(request: { tenantContext?: TenantContext }): TenantContext {
  if (!request.tenantContext?.userId || !request.tenantContext.tenantId) {
    throw new TenantContextError();
  }
  return request.tenantContext;
}

export function scopeQueryToTenant<TQuery extends TenantScopedQuery<TQuery>>(
  query: TQuery,
  context: TenantContext,
  column = 'user_id',
): TQuery {
  if (!context.tenantId) throw new TenantContextError();
  return query.eq(column, context.tenantId);
}

export function resolveWebhookTenantContext(env: NodeJS.ProcessEnv): TenantContext | null {
  const tenantId = env.WHATSAPP_TENANT_ID?.trim();
  if (!tenantId || !UUID_PATTERN.test(tenantId)) return null;
  return Object.freeze({ userId: tenantId, workspaceId: tenantId, tenantId, role: 'channel' });
}
