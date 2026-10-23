import type { RadarSignalView } from './types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Navigation draft only. No customer text, writes, inference or external send. */
export function proposalRecoveryDraft(signal: RadarSignalView): string | null {
  if (signal.kind !== 'unanswered_proposal' || signal.entity_type !== 'quote'
    || signal.suggested_view !== 'proposals' || !UUID.test(signal.entity_ref)) return null;
  return `Preparar recuperação da proposta ${signal.entity_ref.toLowerCase()}`;
}
