import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { ToolRegistry } from './tool-registry.js';

const money = z.coerce.number().finite().nonnegative();
const sourceIds = z.array(z.string()).max(100);

const saleRowSchema = z.object({
  id: z.string(), quote_number: z.string(), client_name: z.string(),
  total: money, approved_at: z.string(),
});
const quoteRowSchema = z.object({
  id: z.string(), quote_number: z.string(), client_name: z.string(),
  total: money, status: z.string(), updated_at: z.string().nullable().optional(),
});
const customerRowSchema = z.object({
  id: z.string(), name: z.string(), phone: z.string().nullable().optional(),
  company: z.string().nullable().optional(), vehicle_or_service: z.string().nullable().optional(),
  notes: z.string().nullable().optional(), quote_count: z.coerce.number().int().nonnegative().default(0),
  total_revenue: money.default(0), last_contact_date: z.string().nullable().optional(),
});
const approvalRowSchema = z.object({
  id: z.string(), task_type: z.string(), bot_name: z.string(), proposed_content: z.string(),
  reason: z.string(), policy_applied: z.string(), expires_at: z.string().nullable().optional(), created_at: z.string(),
  orkto_conversations: z.object({ id: z.string(), user_id: z.string(), contact_name: z.string() }),
});

export type SaleRow = z.infer<typeof saleRowSchema>;
export type QuoteRow = z.infer<typeof quoteRowSchema>;
export type CustomerRow = z.infer<typeof customerRowSchema>;
export type ApprovalRow = z.infer<typeof approvalRowSchema>;

export interface T0DataSource {
  getSalesToday(tenantId: string, start: string, end: string): Promise<SaleRow[]>;
  getOpenQuotes(tenantId: string, limit: number): Promise<QuoteRow[]>;
  getCustomer(tenantId: string, lookup: { customerId?: string; phone?: string }): Promise<CustomerRow | null>;
  getPendingApprovals(tenantId: string, limit: number): Promise<ApprovalRow[]>;
}

function unwrap<T>(result: { data: unknown; error: { message: string } | null }, schema: z.ZodType<T>): T {
  if (result.error) throw new Error(result.error.message);
  return schema.parse(result.data);
}

export class SupabaseT0DataSource implements T0DataSource {
  constructor(private readonly client: SupabaseClient) {}

  async getSalesToday(tenantId: string, start: string, end: string): Promise<SaleRow[]> {
    const result = await this.client.from('quotes')
      .select('id,quote_number,client_name,total,approved_at')
      .eq('user_id', tenantId).eq('status', 'approved')
      .gte('approved_at', start).lt('approved_at', end)
      .order('approved_at', { ascending: false }).limit(100);
    return unwrap(result, z.array(saleRowSchema));
  }

  async getOpenQuotes(tenantId: string, limit: number): Promise<QuoteRow[]> {
    const result = await this.client.from('quotes')
      .select('id,quote_number,client_name,total,status,updated_at')
      .eq('user_id', tenantId).in('status', ['pending', 'sent', 'viewed'])
      .order('updated_at', { ascending: false }).limit(limit);
    return unwrap(result, z.array(quoteRowSchema));
  }

  async getCustomer(tenantId: string, lookup: { customerId?: string; phone?: string }): Promise<CustomerRow | null> {
    let query = this.client.from('clients')
      .select('id,name,phone,company,vehicle_or_service,notes,quote_count,total_revenue,last_contact_date')
      .eq('user_id', tenantId);
    query = lookup.customerId ? query.eq('id', lookup.customerId) : query.eq('phone', lookup.phone!);
    const result = await query.maybeSingle();
    return unwrap(result, customerRowSchema.nullable());
  }

  async getPendingApprovals(tenantId: string, limit: number): Promise<ApprovalRow[]> {
    const result = await this.client.from('orkto_approval_tasks')
      .select('id,task_type,bot_name,proposed_content,reason,policy_applied,expires_at,created_at,orkto_conversations!inner(id,user_id,contact_name)')
      .eq('status', 'pending').eq('orkto_conversations.user_id', tenantId)
      .order('created_at', { ascending: false }).limit(limit);
    return unwrap(result, z.array(approvalRowSchema));
  }
}

const limitInput = z.object({ limit: z.coerce.number().int().min(1).max(100).default(20) });
const datedInput = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() });
const customerInput = z.object({ customerId: z.string().uuid().optional(), phone: z.string().trim().min(6).max(40).optional() })
  .refine(value => Boolean(value.customerId) !== Boolean(value.phone), 'Informe somente customerId ou phone.');

export function createT0ToolRegistry(dataSource: T0DataSource): ToolRegistry {
  return new ToolRegistry()
    .register({
      name: 'get_sales_today', purpose: 'Consulta vendas aprovadas em um dia UTC.', requiredPermission: 'sales:read', timeoutMs: 5_000,
      inputSchema: datedInput,
      outputSchema: z.object({ date: z.string(), timezone: z.literal('UTC'), salesCount: z.number().int(), total: money, sales: z.array(saleRowSchema), sourceIds }),
      async execute(input, context) {
        const date = input.date ?? (context.now ?? new Date()).toISOString().slice(0, 10);
        const start = new Date(`${date}T00:00:00.000Z`);
        const end = new Date(start); end.setUTCDate(end.getUTCDate() + 1);
        const sales = await dataSource.getSalesToday(context.tenant.tenantId, start.toISOString(), end.toISOString());
        return { date, timezone: 'UTC' as const, salesCount: sales.length, total: sales.reduce((sum, item) => sum + item.total, 0), sales, sourceIds: sales.map(item => `quote:${item.id}`) };
      },
      sourceIds: output => output.sourceIds,
    })
    .register({
      name: 'get_open_quotes', purpose: 'Lista orçamentos comerciais ainda abertos.', requiredPermission: 'quotes:read', timeoutMs: 5_000,
      inputSchema: limitInput,
      outputSchema: z.object({ count: z.number().int(), total: money, quotes: z.array(quoteRowSchema), sourceIds }),
      async execute(input, context) {
        const quotes = await dataSource.getOpenQuotes(context.tenant.tenantId, input.limit);
        return { count: quotes.length, total: quotes.reduce((sum, item) => sum + item.total, 0), quotes, sourceIds: quotes.map(item => `quote:${item.id}`) };
      }, sourceIds: output => output.sourceIds,
    })
    .register({
      name: 'get_customer', purpose: 'Busca um cliente por identificador ou telefone exato.', requiredPermission: 'customers:read', timeoutMs: 5_000,
      inputSchema: customerInput,
      outputSchema: z.object({ customer: customerRowSchema.nullable(), sourceIds }),
      async execute(input, context) {
        const customer = await dataSource.getCustomer(context.tenant.tenantId, input);
        return { customer, sourceIds: customer ? [`customer:${customer.id}`] : [] };
      }, sourceIds: output => output.sourceIds,
    })
    .register({
      name: 'get_pending_approvals', purpose: 'Lista aprovações que aguardam decisão humana.', requiredPermission: 'approvals:read', timeoutMs: 5_000,
      inputSchema: limitInput,
      outputSchema: z.object({ count: z.number().int(), approvals: z.array(approvalRowSchema), sourceIds }),
      async execute(input, context) {
        const approvals = await dataSource.getPendingApprovals(context.tenant.tenantId, input.limit);
        return { count: approvals.length, approvals, sourceIds: approvals.map(item => `approval:${item.id}`) };
      }, sourceIds: output => output.sourceIds,
    });
}
