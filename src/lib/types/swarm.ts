// ORKTO Swarm - Tipos compartilhados do backend
import { z } from "zod";

// ===== Workspaces =====
export const workspaceSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  owner_id: z.string().uuid(),
  plan: z.enum(["free", "pro", "business"]),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

// ===== Channel Accounts =====
export const channelAccountSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  provider: z.enum(["whatsapp", "telegram", "sms", "email", "custom"]),
  external_id: z.string(),
  display_name: z.string().nullable(),
  is_primary: z.boolean(),
  config: z.record(z.unknown()).nullable(),
  status: z.enum(["active", "paused", "error", "pending"]),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

// ===== Conversations =====
export const conversationSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  channel_account_id: z.string().uuid().nullable(),
  contact_id: z.string().uuid().nullable(),
  phone: z.string(),
  name: z.string().nullable(),
  status: z.enum(["active", "archived", "blocked", "deleted"]),
  source: z.enum(["whatsapp", "manual", "import", "widget"]),
  priority_score: z.number().nullable(),
  priority_reason: z.string().nullable(),
  mood_state: z.enum(["green", "yellow", "red", "blue", "neutral"]).nullable(),
  mood_confidence: z.number().nullable(),
  risk_score: z.number().nullable(),
  last_message_at: z.string().datetime().nullable(),
  last_message_by: z.enum(["customer", "business"]).nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

// ===== Messages =====
export const messageSchema = z.object({
  id: z.string().uuid(),
  conversation_id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  channel_message_id: z.string().nullable(),
  direction: z.enum(["incoming", "outgoing", "system"]),
  type: z.enum(["text", "image", "video", "audio", "document", "location", "contact", "interactive", "system"]),
  content: z.string().nullable(),
  content_type: z.string(),
  sender: z.enum(["customer", "business", "bot", "system"]),
  sender_name: z.string().nullable(),
  sent_at: z.string().datetime(),
  delivered_at: z.string().datetime().nullable(),
  read_at: z.string().datetime().nullable(),
  raw_payload: z.record(z.unknown()).nullable(),
  processed_by_agent: z.boolean(),
  agent_run_id: z.string().uuid().nullable(),
  policy_checked: z.boolean(),
  policy_decision: z.string().nullable(),
  created_at: z.string().datetime(),
});

// ===== Agent Definitions =====
export const agentDefinitionSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  role: z.enum(["hunter", "farmer", "recovery", "collection", "risk", "report", "growth", "price_auditor"]),
  capabilities: z.array(z.string()),
  default_trust_level: z.number().int().min(1).max(4),
  is_active: z.boolean(),
  is_global: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

// ===== Agent Runs =====
export const agentRunSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  conversation_id: z.string().uuid().nullable(),
  triggering_message_id: z.string().uuid().nullable(),
  agent_id: z.string().uuid().nullable(),
  intent: z.string().nullable(),
  risk_level: z.enum(["low", "medium", "high", "critical"]).nullable(),
  plan: z.array(z.unknown()).nullable(),
  status: z.enum(["pending", "running", "completed", "failed", "human_review", "transferred"]),
  trust_level_used: z.number().int().nullable(),
  tools_called: z.array(z.string()),
  result_summary: z.string().nullable(),
  cost_usd: z.number().nullable(),
  latency_ms: z.number().nullable(),
  error: z.string().nullable(),
  created_at: z.string().datetime(),
  completed_at: z.string().datetime().nullable(),
});

// ===== Agent Actions =====
export const agentActionSchema = z.object({
  id: z.string().uuid(),
  agent_run_id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  action_type: z.enum(["suggest_reply", "send_message", "create_quote", "adjust_discount", "schedule_followup", "create_task", "log_note", "transfer_to_human", "pause_bot", "resume_bot"]),
  action_subtype: z.string().nullable(),
  target_type: z.string().nullable(),
  target_id: z.string().uuid().nullable(),
  proposed_content: z.string().nullable(),
  proposed_payload: z.record(z.unknown()).nullable(),
  status: z.enum(["pending", "approved", "rejected", "edited", "auto_executed", "cancelled"]),
  approved_by: z.string().uuid().nullable(),
  approved_at: z.string().datetime().nullable(),
  rejection_reason: z.string().nullable(),
  edited_content: z.string().nullable(),
  executed_at: z.string().datetime().nullable(),
  execution_result: z.record(z.unknown()).nullable(),
  error: z.string().nullable(),
  created_at: z.string().datetime(),
});

// ===== Approval Tasks =====
export const approvalTaskSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  agent_action_id: z.string().uuid(),
  assigned_to: z.string().uuid().nullable(),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  title: z.string(),
  description: z.string().nullable(),
  requires_response: z.boolean(),
  suggested_reply: z.string().nullable(),
  context: z.record(z.unknown()).nullable(),
  status: z.enum(["pending", "approved", "rejected", "cancelled", "escalated"]),
  resolved_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
});

// ===== Policy Engine types =====
export const policyContextSchema = z.object({
  workspace_id: z.string().uuid(),
  action_type: z.enum(["suggest_reply", "send_message", "create_quote", "adjust_discount", "schedule_followup", "create_task", "log_note", "transfer_to_human", "pause_bot", "resume_bot"]),
  bot_slug: z.string(),
  bot_trust_level: z.number().int().min(1).max(4),
  conversation_id: z.string().uuid().nullable(),
  proposed_discount_percent: z.number().nullable(),
  proposed_content: z.string().nullable(),
  is_sensitive: z.boolean(),
  current_time: z.string().datetime(),
  plan: z.enum(["free", "pro", "business"]).nullable(),
});

export const policyDecisionSchema = z.object({
  allowed: z.boolean(),
  requires_approval: z.boolean(),
  decision: z.enum(["auto", "suggestion", "blocked", "escalate"]),
  reason: z.string(),
  limits_applied: z.record(z.unknown()).nullable(),
  approved_action: z.record(z.unknown()).nullable(),
});

// ===== Webhook Event =====
export const webhookEventSchema = z.object({
  event_id: z.string(),
  provider: z.string(),
  event_type: z.string(),
  payload: z.record(z.unknown()),
  received_at: z.string().datetime(),
  workspace_id: z.string().uuid().nullable(),
  processed: z.boolean(),
  processed_at: z.string().datetime().nullable(),
  error: z.string().nullable(),
});

// ===== Inbox Item (frontend-ready) =====
export const inboxItemSchema = z.object({
  id: z.string().uuid(),
  phone: z.string(),
  name: z.string().nullable(),
  status: z.enum(["active", "archived", "blocked", "deleted"]),
  priority_score: z.number().nullable(),
  priority_reason: z.string().nullable(),
  mood_state: z.enum(["green", "yellow", "red", "blue", "neutral"]).nullable(),
  mood_confidence: z.number().nullable(),
  risk_score: z.number().nullable(),
  last_message_at: z.string().datetime().nullable(),
  last_message_by: z.enum(["customer", "business"]).nullable(),
  recent_messages: z.array(z.object({
    id: z.string().uuid(),
    direction: z.enum(["incoming", "outgoing", "system"]),
    type: z.enum(["text", "image", "video", "audio", "document", "location", "contact", "interactive", "system"]),
    content: z.string().nullable(),
    sender: z.enum(["customer", "business", "bot", "system"]),
    sender_name: z.string().nullable(),
    sent_at: z.string().datetime(),
    processed_by_agent: z.boolean(),
    agent_run_id: z.string().uuid().nullable(),
  })).nullable(),
  messages_24h: z.number().nullable(),
  responses_24h: z.number().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

// ===== API Response types =====
export const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.unknown(),
  error: z.string().nullable(),
});
