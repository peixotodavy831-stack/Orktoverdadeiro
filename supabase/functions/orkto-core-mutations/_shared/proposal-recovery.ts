import { detectUnansweredProposals, type RadarQuoteInput } from '../../../../backend/orkto-core/radar.ts';

/** Deterministic preparation only. The existing WIA gateway persists approval;
 * only its decision RPC may create the internal review task. No provider calls. */
export async function prepareProposalRecovery(db: any, workspaceId: string, quoteId: string, now = Date.now()) {
  const gate = await db.from('orkto_feature_configs').select('status')
    .eq('workspace_id', workspaceId).eq('feature_key', 'proposal_recovery').maybeSingle();
  if (gate.error) throw new Error('PLAYBOOK_QUERY_FAILED');
  if (gate.data?.status !== 'ACTIVE') throw new Error('PLAYBOOK_CONFIGURATION_REQUIRED');
  const result = await db.from('quotes')
    .select('id,quote_number,client_name,total,status,sent_at,viewed_at,approved_at,rejected_at,deal_id,archived_at,retention_expires_at')
    .eq('workspace_id', workspaceId).eq('id', quoteId).is('archived_at', null).maybeSingle();
  if (result.error) throw new Error('PLAYBOOK_QUERY_FAILED');
  const signal = detectUnansweredProposals(result.data ? [result.data as RadarQuoteInput] : [], now)[0];
  // Do not disclose whether a missing/ineligible ID belongs to another tenant.
  if (!signal) return { action: 'answer', requiresApproval: false, sourceIds: [] as string[],
    confidenceSignal: 'high', reasonCode: 'proposal_recovery_not_eligible',
    messageDraft: 'Não há proposta elegível para recuperação neste workspace. Nenhuma tarefa foi criada.' };
  return { action: 'send_proposal_followup', requiresApproval: true, sourceIds: [`quote:${quoteId}`],
    confidenceSignal: 'high', reasonCode: 'playbook_proposal_recovery_r1',
    // No free-form customer text is treated as an instruction or sent to a model.
    messageDraft: `Revisar a proposta ${quoteId}. Enviada em ${signal.evidence.sent_at}; sem decisão registrada há ${signal.evidence.waiting_hours} h na consulta de ${new Date(now).toISOString()}. Confira o estado atual antes de contatar o cliente. Aprovar cria somente uma tarefa interna; nenhuma mensagem será enviada.` };
}
