import { z } from 'zod';

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

export interface WiaOperationalContext {
  openQuotes: number;
  pendingValue: number;
  clients: number;
  companyName?: string;
}

export interface ModelUsage {
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
}

export interface ModelDecisionResult {
  decision: WiaDecision;
  usage: ModelUsage;
  mode: 'live' | 'simulated';
}

export interface ModelProvider {
  readonly name: string;
  decide(input: {
    message: string;
    context: WiaOperationalContext;
    sourceIds: string[];
  }): Promise<ModelDecisionResult>;
}
