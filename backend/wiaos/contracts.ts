import { z } from 'zod';
import type { ToolExecution } from './core-contracts.js';

export const wiaActionSchema = z.enum([
  'answer',
  'ask_clarification',
  'create_draft',
  'request_approval',
  'handoff_to_human',
  'record_optout',
]);

export const wiaDecisionSchema = z.object({
  action: wiaActionSchema,
  messageDraft: z.string().trim().min(1).max(4000),
  sourceIds: z.array(z.string().max(200)).max(30).default([]),
  confidenceSignal: z.enum(['low', 'medium', 'high']),
  requiresApproval: z.boolean(),
  reasonCode: z.string().regex(/^[a-z0-9_]{3,80}$/),
});

export type WiaDecision = z.infer<typeof wiaDecisionSchema>;
export type WiaAgentId = 'qualification_agent' | 'sales_agent' | 'objection_agent' | 'followup_agent' | 'recovery_agent' | 'collection_agent' | 'risk_agent' | 'reporting_agent' | 'customer_success_agent';

export interface WiaOperationalContext {
  openQuotes?: number;
  pendingValue?: number;
  clients?: number;
  companyName?: string;
  reportMetrics?: Record<string, unknown>;
  reportType?: string;
  reportPeriod?: { start: string; end: string };
  relevantMemories?: Array<{ id: string; memoryType: string; entityType: string; entityRef: string; content: Record<string, unknown>; confidence: number | null; provenance: Record<string, unknown> }>;
}

export interface WiaChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface ModelUsage {
  provider: string;
  modelFamily: string;
  gateway: string;
  model: string;
  requestedModel: string;
  selectedModel: string;
  actualModel: string;
  taskType: 'fast' | 'standard' | 'deep';
  fallbackUsed: boolean;
  fallbackReason?: string;
  promptTokens: number;
  cachedInputTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  status: 'succeeded';
}

export interface ModelDecisionResult {
  decision: WiaDecision;
  usage: ModelUsage;
  mode: 'live' | 'simulated';
}

export interface WiaServiceResult extends ModelDecisionResult {
  runId: string;
  agent: WiaAgentId;
  path: 't0' | 'model';
  toolExecutions: ToolExecution[];
}

export interface ModelProvider {
  readonly name: string;
  decide(input: {
    message: string;
    context: WiaOperationalContext;
    sourceIds: string[];
    history?: WiaChatTurn[];
    agent?: WiaAgentId;
  }): Promise<ModelDecisionResult>;
}
