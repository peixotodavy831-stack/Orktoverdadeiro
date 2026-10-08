export type AccountingSaleExport = {
  workspaceId: string;
  saleRef: string;
  customer: { name: string };
  items: Array<{ product: string; quantity: number; unitPriceCents: number }>;
  amountCents: number;
  saleDate: string | null;
  paymentMethod: string | null;
  paymentStatus: 'paid' | 'awaiting_payment' | 'unknown';
};

export type AccountingAdapterResult = {
  externalRef: string | null;
};

export interface AccountingAdapter {
  readonly providerId: string;
  exportSale(sale: AccountingSaleExport, options: { idempotencyKey: string }): Promise<AccountingAdapterResult>;
}

export type AccountingDelivery =
  | { status: 'configuration_required'; providerId: null; errorCategory: 'accounting_provider_not_configured' }
  | { status: 'configuration_required'; providerId: string; errorCategory: 'accounting_adapter_unavailable' }
  | { status: 'sent'; providerId: string; externalRef: string | null }
  | { status: 'failed'; providerId: string; errorCategory: 'accounting_provider_error' };

/** Registry for real, server-side accounting integrations. It never fabricates a success result. */
export class AccountingAdapterRegistry {
  private readonly adapters = new Map<string, AccountingAdapter>();

  register(adapter: AccountingAdapter): this {
    const providerId = adapter.providerId.trim().toLowerCase();
    if (!/^[a-z][a-z0-9_-]{1,60}$/.test(providerId)) throw new Error('Identificador de provedor contábil inválido.');
    if (this.adapters.has(providerId)) throw new Error(`Adapter contábil duplicado: ${providerId}`);
    this.adapters.set(providerId, adapter);
    return this;
  }

  resolve(providerId: string | null | undefined): AccountingAdapter | null {
    if (!providerId) return null;
    return this.adapters.get(providerId.trim().toLowerCase()) || null;
  }

  async exportSale(providerId: string | null | undefined, sale: AccountingSaleExport, idempotencyKey: string): Promise<AccountingDelivery> {
    if (!providerId) return { status: 'configuration_required', providerId: null, errorCategory: 'accounting_provider_not_configured' };
    const adapter = this.resolve(providerId);
    if (!adapter) return { status: 'configuration_required', providerId: providerId.trim().toLowerCase(), errorCategory: 'accounting_adapter_unavailable' };
    try {
      const result = await adapter.exportSale(sale, { idempotencyKey });
      return { status: 'sent', providerId: adapter.providerId, externalRef: result.externalRef };
    } catch {
      return { status: 'failed', providerId: adapter.providerId, errorCategory: 'accounting_provider_error' };
    }
  }
}

// Providers are deliberately unregistered until a specific integration is selected and configured.
export const accountingAdapterRegistry = new AccountingAdapterRegistry();
