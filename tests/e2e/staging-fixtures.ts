import type { Locator } from '@playwright/test';

// Test data must satisfy the same catalog/price verification as the product.
export function catalogBackedQuoteInput(catalog: { id: string; name: string; unitPrice: number }, clientName: string) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(catalog.id)
    || !catalog.name.trim() || catalog.name.length > 160 || !Number.isFinite(catalog.unitPrice) || catalog.unitPrice < 0) {
    throw new Error('INVALID_SYNTHETIC_CATALOG_FIXTURE');
  }
  return { clientName, clientPhone: '+5500000088892',
    items: [{ catalogItemId: catalog.id, name: catalog.name, quantity: 1, unitPrice: catalog.unitPrice, discount: 0 }] };
}

export function contactRowByCreatedName(dialog: Locator, createdName: string) {
  return dialog.getByRole('listitem').filter({ hasText: createdName });
}
