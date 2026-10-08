/**
 * UI-only view models for Front B.
 * These types intentionally do not replace or redefine backend contracts in src/types.ts.
 */
export type ProductView =
  | 'landing'
  | 'auth'
  | 'dashboard'
  | 'quotes'
  | 'create_quote'
  | 'quote_detail'
  | 'clients'
  | 'services'
  | 'settings'
  | 'analytics'
  | 'billing'
  | 'conversations'
  | 'conversation'
  | 'wia'
  | 'internal_finance'
  | 'collections'
  | 'deals'
  | 'graph';

export type ProductRequestState =
  | 'loading'
  | 'empty'
  | 'success'
  | 'error'
  | 'permission_denied'
  | 'configuration_required'
  | 'backend_pending'
  | 'offline';

export interface ProductApiEnvelope<T> {
  data: T;
}

export interface InboxConversationView {
  id: string;
  status?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  source_channel?: string | null;
  last_message?: string | null;
  last_message_at?: string | null;
  last_message_by?: 'customer' | 'operator' | null;
  unread_count?: number;
  priority?: string | null;
  priority_score?: number | null;
  priority_reason?: string | string[] | null;
  risk_score?: number | null;
  mood_state?: string | null;
  related_deal_ids?: string[];
}

export interface WiaActionView {
  id: string;
  action_type: string;
  payload?: Record<string, unknown> | null;
  rationale?: string | null;
  risk_level?: string | null;
  confidence?: number | null;
  status: string;
  requires_approval?: boolean;
  created_at?: string | null;
  result?: Record<string, unknown> | null;
  run_id?: string | null;
}

export interface DealView {
  id: string;
  title: string;
  description?: string | null;
  customer_ref?: string | null;
  stage: string;
  status?: string;
  value_cents?: number | null;
  probability_percent?: number | null;
  expected_close_on?: string | null;
  updated_at?: string | null;
  risk?: {
    score: number;
    confidence?: number;
    reasons?: string[];
    recommended_action?: string;
    assessed_at?: string | null;
  } | null;
}
