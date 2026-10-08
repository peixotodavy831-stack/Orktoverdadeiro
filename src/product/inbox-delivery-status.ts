export type ConfirmedSendState = 'accepted' | 'acknowledged' | 'delivered';

export function confirmedSendState(payload: unknown): ConfirmedSendState | null {
  if (!payload || typeof payload !== 'object') return null;
  const status = (payload as { status?: unknown }).status;
  if (status === 'REQUEST_ACCEPTED') return 'accepted';
  if (status === 'PROVIDER_ACKNOWLEDGED') return 'acknowledged';
  if (status === 'DELIVERED') return 'delivered';
  return null;
}

export function confirmedSendMessage(state: ConfirmedSendState): string {
  if (state === 'accepted') return 'Solicitação aceita. A entrega ainda não foi confirmada.';
  if (state === 'acknowledged') return 'Provedor confirmou o recebimento. A entrega ainda não foi confirmada.';
  return 'Entrega confirmada pelo provedor.';
}
