const pendingKeys = new Map<string, string>();

const storageKey = (quoteId: string) => `orkto:quote-publication:${quoteId}`;

export function pendingQuotePublicationKey(quoteId: string): string {
  const key = storageKey(quoteId);
  let stored: string | null = null;
  try { stored = window.sessionStorage.getItem(key); } catch { /* Private browsing can disable storage. */ }
  const existing = stored || pendingKeys.get(key);
  if (existing) return existing;
  const created = crypto.randomUUID();
  pendingKeys.set(key, created);
  try { window.sessionStorage.setItem(key, created); } catch { /* Keep the in-memory key for this tab. */ }
  return created;
}

export function completeQuotePublication(quoteId: string): void {
  const key = storageKey(quoteId);
  pendingKeys.delete(key);
  try { window.sessionStorage.removeItem(key); } catch { /* No persisted key to clear. */ }
}
