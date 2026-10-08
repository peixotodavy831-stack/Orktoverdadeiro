import { getProductErrorState, productApi } from '../api';
import type { InboxConversationView, ProductRequestState } from '../types';

export interface InboxDataSource {
  listConversations(accessToken: string | null): Promise<InboxConversationView[]>;
}

export class InboxDataSourceError extends Error {
  constructor(message: string, readonly state: ProductRequestState) {
    super(message);
    this.name = 'InboxDataSourceError';
  }
}

/** Frontend adapter for the existing priority inbox contract. */
export const inboxDataSource: InboxDataSource = {
  async listConversations(accessToken) {
    try {
      const payload = await productApi<{ data?: InboxConversationView[] } | InboxConversationView[]>(
        '/api/priority/inbox',
        accessToken,
      );
      const data = Array.isArray(payload) ? payload : payload.data;
      if (!Array.isArray(data)) throw new Error('A fila da Inbox retornou um formato inválido.');
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível carregar as conversas.';
      throw new InboxDataSourceError(message, getProductErrorState(error));
    }
  },
};
