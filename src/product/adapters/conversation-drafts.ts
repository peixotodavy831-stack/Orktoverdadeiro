/** Ephemeral Inbox state. Never serialize this object or its auth scope. */
export interface ConversationDrafts { scope: string | null; values: Record<string, string> }
export function updateConversationDraft(previous: ConversationDrafts, scope: string | null, conversationId: string, text: string): ConversationDrafts {
  // An old async send completion must never clear drafts belonging to a newer session.
  if (!scope || previous.scope !== scope) return previous;
  const values = {...previous.values};
  if (text) values[conversationId] = text;
  else delete values[conversationId];
  return {scope, values};
}
