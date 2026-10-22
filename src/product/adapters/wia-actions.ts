import { productApi } from '../api.js';
import type { WiaActionView } from '../types.js';

export type WiaSection = 'request' | 'approvals' | 'history';
const historyStatuses = ['awaiting_approval', 'prepared', 'executed', 'failed', 'rejected'] as const;

/** Load the approval badge first; the full history is requested only on demand. */
export async function loadWiaActions(section: WiaSection, accessToken: string | null, signal?: AbortSignal): Promise<WiaActionView[]> {
  const statuses = section === 'history' ? historyStatuses : ['awaiting_approval'];
  const results = await Promise.all(statuses.map(status => productApi<{data: WiaActionView[]}>(`/api/wia/actions?status=${status}`, accessToken, {signal})));
  return results.flatMap(result => Array.isArray(result.data) ? result.data : [])
    .sort((left,right) => Date.parse(right.created_at || '') - Date.parse(left.created_at || ''));
}
