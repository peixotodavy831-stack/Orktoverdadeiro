import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChannelDeliveryConfirmation, ChannelDeliveryPersistenceResult } from './channel-adapter.js';

const persistedStatus: Record<ChannelDeliveryConfirmation['status'], string> = {
  sent: 'PROVIDER_ACKNOWLEDGED',
  delivered: 'DELIVERED',
  read: 'DELIVERED',
  failed: 'FAILED',
};

/** Called only after an adapter verifies the provider receipt and its channel binding. */
export async function persistChannelDeliveryToSupabase(
  db: SupabaseClient,
  input: { workspaceId: string; conversationId: string; provider: string; receipt: ChannelDeliveryConfirmation },
): Promise<ChannelDeliveryPersistenceResult> {
  const { receipt } = input;
  const { data: sendRequest, error: lookupError } = await db.from('orkto_channel_send_requests')
    .select('id')
    .eq('workspace_id', input.workspaceId)
    .eq('conversation_id', input.conversationId)
    .eq('provider', input.provider)
    .eq('provider_message_id', receipt.externalMessageId)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (!sendRequest?.id) return 'NOT_FOUND';

  const fingerprint = createHash('sha256').update(JSON.stringify({
    eventId: receipt.eventId,
    externalMessageId: receipt.externalMessageId,
    channel: receipt.channel,
    status: receipt.status,
    occurredAt: receipt.occurredAt,
    failureCategory: receipt.failure?.category || null,
  })).digest('hex');
  const { data, error } = await db.rpc('orkto_record_channel_delivery_event', {
    p_workspace_id: input.workspaceId,
    p_send_request_id: sendRequest.id,
    p_provider: input.provider,
    p_provider_event_id: receipt.eventId,
    p_payload_fingerprint: fingerprint,
    p_provider_message_id: receipt.externalMessageId,
    p_status: persistedStatus[receipt.status],
    p_occurred_at: receipt.occurredAt,
    p_failure_category: receipt.failure?.category || null,
  });
  if (error) throw error;
  if (data === 'APPLIED' || data === 'DUPLICATE' || data === 'STALE_IGNORED'
    || data === 'NOT_FOUND' || data === 'PROVIDER_REFERENCE_CONFLICT' || data === 'EVENT_CONFLICT') return data;
  throw new Error('delivery_ledger_invalid_response');
}
