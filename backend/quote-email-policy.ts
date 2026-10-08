export function isQuoteEmailRecipientAuthorized(requested: string, clientEmail: string | null | undefined): boolean {
  const registered = clientEmail?.trim().toLowerCase();
  return Boolean(registered) && requested.trim().toLowerCase() === registered;
}
