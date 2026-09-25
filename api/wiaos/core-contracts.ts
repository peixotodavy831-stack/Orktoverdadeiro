import { z } from 'zod';
import type { TenantContext } from '../tenancy/tenant-context.js';

export const commercialEventSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  type: z.enum([
    'message.received',
    'message.sent',
    'opportunity.updated',
    'quote.created',
    'quote.sent',
    'quote.viewed',
    'quote.accepted',
    'approval.requested',
    'approval.approved',
    'approval.rejected',
    'tool.executed',
  ]),
  occurredAt: z.string().datetime({ offset: true }),
  correlationId: z.string().min(1).max(200),
  source: z.enum(['user', 'channel', 'system', 'wia']),
  data: z.record(z.string(), z.unknown()).default({}),
});

export type CommercialEvent = z.infer<typeof commercialEventSchema>;

export const commercialStateSchema = z.object({
  tenantId: z.string().uuid(),
  asOf: z.string().datetime({ offset: true }),
  openQuotes: z.number().int().nonnegative(),
  openQuoteValue: z.number().nonnegative(),
  salesToday: z.number().nonnegative(),
  pendingApprovals: z.number().int().nonnegative(),
  sourceIds: z.array(z.string().max(200)).max(100),
});

export type CommercialState = z.infer<typeof commercialStateSchema>;

export const toolPermissionSchema = z.enum([
  'sales:read',
  'quotes:read',
  'customers:read',
  'approvals:read',
]);

export type ToolPermission = z.infer<typeof toolPermissionSchema>;

export const toolErrorCodeSchema = z.enum([
  'tool_not_found',
  'permission_denied',
  'invalid_input',
  'timeout',
  'execution_failed',
  'invalid_output',
]);

export type ToolErrorCode = z.infer<typeof toolErrorCodeSchema>;

export const toolExecutionSchema = z.object({
  id: z.string().uuid(),
  traceId: z.string().min(1).max(200),
  tenantId: z.string().uuid(),
  toolName: z.string().regex(/^[a-z][a-z0-9_]{2,80}$/),
  requiredPermission: toolPermissionSchema.optional(),
  status: z.enum(['succeeded', 'failed']),
  startedAt: z.string().datetime({ offset: true }),
  completedAt: z.string().datetime({ offset: true }),
  durationMs: z.number().int().nonnegative(),
  sourceIds: z.array(z.string().max(200)).max(100).default([]),
  error: z.object({
    code: toolErrorCodeSchema,
    message: z.string().max(500),
  }).optional(),
});

export type ToolExecution = z.infer<typeof toolExecutionSchema>;

export const approvalSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  actionType: z.string().regex(/^[a-z][a-z0-9_.]{2,100}$/),
  status: z.enum(['pending', 'approved', 'rejected', 'cancelled', 'expired']),
  requestedBy: z.string().min(1).max(200),
  decidedBy: z.string().max(200).optional(),
  reason: z.string().max(1000),
  createdAt: z.string().datetime({ offset: true }),
  decidedAt: z.string().datetime({ offset: true }).optional(),
});

export type Approval = z.infer<typeof approvalSchema>;

export type ToolExecutionContext = {
  tenant: TenantContext;
  traceId: string;
  now?: Date;
};

export type ToolDefinition<TInput, TOutput> = {
  name: string;
  purpose: string;
  inputSchema: z.ZodType<TInput>;
  outputSchema: z.ZodType<TOutput>;
  requiredPermission: ToolPermission;
  timeoutMs: number;
  execute(input: TInput, context: ToolExecutionContext): Promise<TOutput>;
  sourceIds(output: TOutput): string[];
};
