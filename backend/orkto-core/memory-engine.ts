export type AutomaticMemoryType = 'raw_event' | 'fact' | 'summary' | 'preference' | 'commercial_pattern';

export interface AutomaticMemoryCandidate {
  workspaceId: string;
  entityType: 'customer' | 'conversation' | 'deal' | 'quote' | 'workspace';
  entityRef: string;
  memoryType: AutomaticMemoryType;
  content: Record<string, unknown>;
  provenance: { source: string; sourceRef: string; [key: string]: unknown };
  confidence: number;
  idempotencyKey: string;
  createdBy?: string | null;
  expiresAt?: string | null;
}

export function buildVerifiedCommercialFact(input: {
  workspaceId: string;
  customerId: string;
  factType: string;
  source: string;
  sourceRef: string;
  facts: Record<string, unknown>;
  actorUserId?: string | null;
}): AutomaticMemoryCandidate | null {
  const factType = input.factType.trim().slice(0, 80);
  const source = input.source.trim().slice(0, 80);
  const sourceRef = input.sourceRef.trim().slice(0, 200);
  if (!input.workspaceId || !input.customerId || !factType || !source || !sourceRef) return null;
  const allowedFields = Object.fromEntries(Object.entries(input.facts)
    .filter(([key, value]) => /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(key) && (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null))
    .slice(0, 20));
  const sourceKey = `${source}:${sourceRef}:${factType}`;
  return {
    workspaceId: input.workspaceId,
    entityType: 'customer',
    entityRef: input.customerId,
    memoryType: 'fact',
    content: { factType, ...allowedFields },
    provenance: { source, sourceRef, verification: 'workspace_record' },
    confidence: 0.99,
    idempotencyKey: `verified-fact:${sourceKey}`.slice(0, 240),
    createdBy: input.actorUserId || null,
  };
}

export async function persistAutomaticMemory(db: any, candidate: AutomaticMemoryCandidate): Promise<{ id: string | null; inserted: boolean }> {
  if (!candidate.workspaceId || !candidate.entityRef || !candidate.provenance?.source || !candidate.provenance?.sourceRef) {
    throw new Error('Memória automática sem workspace, entidade ou proveniência verificável.');
  }
  if (!Number.isFinite(candidate.confidence) || candidate.confidence < 0 || candidate.confidence > 1) {
    throw new Error('Confiança da memória automática inválida.');
  }
  const { data, error } = await db.from('orkto_wia_memories').upsert({
    workspace_id: candidate.workspaceId,
    entity_type: candidate.entityType,
    entity_ref: candidate.entityRef,
    memory_type: candidate.memoryType,
    content: candidate.content,
    provenance: candidate.provenance,
    confidence: candidate.confidence,
    status: 'active',
    idempotency_key: candidate.idempotencyKey,
    created_by: candidate.createdBy || null,
    expires_at: candidate.expiresAt || null,
  }, { onConflict: 'workspace_id,idempotency_key', ignoreDuplicates: true }).select('id').maybeSingle();
  if (error) throw error;
  if (data?.id) return { id: String(data.id), inserted: true };
  const { data: existing, error: readError } = await db.from('orkto_wia_memories').select('id')
    .eq('workspace_id', candidate.workspaceId).eq('idempotency_key', candidate.idempotencyKey).maybeSingle();
  if (readError) throw readError;
  return { id: existing?.id ? String(existing.id) : null, inserted: false };
}
