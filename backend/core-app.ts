import * as Sentry from "@sentry/node";
import { Resend } from "resend";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { z } from "zod";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import crypto from "crypto";
import { decideWithWia } from './wiaos/wia-service.js';
import { calculateObservedFinanceMetrics, DEFAULT_FINANCE_ASSUMPTIONS, estimateAiUsageCost, isTechnicalCogsCategory, projectFinance, summarizeChannelUsageCosts, validateFinanceAssumptions } from './finance/finance-model.js';
import { createT0ToolRegistry, SupabaseT0DataSource } from './wiaos/t0-tools.js';
import { ModelProviderError } from './wiaos/model-provider.js';
import { ProviderConfigurationError } from './wiaos/model-router.js';
import { registerOperationalRoutes } from './operational-routes.js';
import { invokeCoreMutation } from './core-mutation-client.js';
import { quoteCreateInput } from './orkto-core/quote-input.js';
import { onboardingInput } from './orkto-core/profile-input.js';
import { deriveMessageMemoryCandidates, routeSwarmAgent } from './orkto-core/full-operational.js';
import { prepareResponseDraft } from './wiaos/response-pipeline.js';
import { scheduleRepurchaseCandidate } from './orkto-core/repurchase-scheduler.js';
import { buildVerifiedCommercialFact, persistAutomaticMemory } from './orkto-core/memory-engine.js';
import {
  createOwnerTenantContext,
  createWorkspaceTenantContext,
  requireTenantContext,
  resolveWebhookTenantContext,
  type TenantContext,
} from './tenancy/tenant-context.js';
import { selectActiveWorkspaceMembership, WorkspaceSelectionError } from './tenancy/workspace-selection.js';
import { createRequestScopedClient } from './tenancy/request-scoped-client.js';
import { checkPlanLimit, hasPlanFeature, loadWorkspacePlanAccess } from './billing/plan-access.js';
import { createDurableChannelSendRepository, sendThroughDurableChannelAdapter } from './channels/durable-send.js';
import { applyPixIntentProviderEvent } from './billing/pix-intent.js';
import { isQuoteEmailRecipientAuthorized } from './quote-email-policy.js';
import { assertStagingBoundary, stagingPreviewOrigin } from './staging-boundary.js';
import { logStructured } from './observability/structured-logger.js';
import { resolvePublicAppBaseUrl } from './public-app-url.js';

dotenv.config();
assertStagingBoundary(process.env);

Sentry.init({
  dsn: process.env.APP_ENV === 'staging' ? undefined : process.env.SENTRY_DSN,
  enabled: process.env.APP_ENV !== 'staging' && Boolean(process.env.SENTRY_DSN),
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
  integrations: [Sentry.expressIntegration()],
});

const resendApiKey = process.env.RESEND_API_KEY?.trim();
const resend = resendApiKey ? new Resend(resendApiKey) : null;

const app = express();

app.use((req, res, next) => {
  const supplied = req.get('x-request-id') || '';
  const requestId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(supplied)
    ? supplied
    : crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);
  next();
});

app.get("/api/health", (_req, res) => {
  res.status(200).json({ status: "ok", service: "orkto" });
});

app.get('/api/ready', async (req, res) => {
  if (!supabase) return res.status(503).json({ status: 'not_ready', category: 'configuration_required', requestId: req.requestId });
  try {
    if (process.env.APP_ENV === 'staging') {
      // Migration 17 intentionally gives anon no table grants. Probe Supabase
      // Auth with the public key; never add a service-role key for readiness.
      const response = await fetch(`${supabaseUrl}/auth/v1/health`, {
        headers: { apikey: supabaseAnonKey!, Authorization: `Bearer ${supabaseAnonKey}` },
        signal: AbortSignal.timeout(5000),
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(`Supabase Auth health HTTP ${response.status}`);
      return res.json({ status: 'ready', environment: 'staging', checks: { supabaseAuth: 'reachable' } });
    }
    const { error } = await supabase.from('orkto_workspaces').select('id', { head: true }).limit(1);
    if (error) throw error;
    return res.json({ status: 'ready', environment: process.env.APP_ENV || process.env.VERCEL_ENV || 'development' });
  } catch (error) {
    logStructured('error', 'readiness.database_unavailable', { requestId: req.requestId, errorCode: (error as { code?: string })?.code || 'unknown' });
    return res.status(503).json({ status: 'not_ready', category: 'database_unavailable', requestId: req.requestId });
  }
});

app.get("/api/hermes/health", (_req, res) => {
  const mode = process.env.HERMES_ADAPTER_MODE === 'remote' ? 'remote' : 'mock';
  const connected = mode === 'remote' && Boolean(process.env.HERMES_API_URL);
  res.status(200).json({
    status: connected || mode === 'mock' ? 'ok' : 'degraded',
    component: 'hermes-adapter',
    mode,
    connected,
    readyForProduction: connected,
    message: mode === 'mock'
      ? 'HermesAdapter em homologação; nenhuma ação externa é executada.'
      : connected
        ? 'Endpoint remoto configurado.'
        : 'Defina HERMES_API_URL para habilitar o adaptador remoto.',
  });
});
const PORT = 3000;

// Vercel encaminha o IP original pelos headers de proxy. Confiar apenas no
// primeiro proxy mantém o rate limiter correto sem aceitar uma cadeia arbitrária.
app.set('trust proxy', 1);

const configuredOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(origin => origin.trim()).filter(Boolean);
const allowedOrigins = process.env.APP_ENV === 'staging'
  ? [...configuredOrigins, process.env.APP_URL, stagingPreviewOrigin(process.env)].filter((origin): origin is string => Boolean(origin))
  : [
      'http://localhost:3000', 'http://localhost:4173', 'http://localhost:5173',
      'https://orktoverdeiro.vercel.app', 'https://orkto.co', 'https://www.orkto.co',
      'https://orkto.vercel.app', 'https://project-ao409.vercel.app',
      ...configuredOrigins,
    ];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) callback(null, true);
    else callback(new Error('Não permitido por CORS'));
  }, credentials: true,
}));

app.use('/api', helmet());

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 200,
  message: { error: 'Muitas requisições. Tente novamente em 15 minutos.' },
  standardHeaders: 'draft-7', legacyHeaders: false,
  // Na Vercel usamos req.ip, já normalizado a partir de X-Forwarded-For.
  validate: { forwardedHeader: false },
});
app.use('/api/', globalLimiter);

// Additional technical abuse ceilings for the most expensive/enumerable
// surfaces. Each limiter uses its own process-local in-memory store; these are
// defense-in-depth, not distributed quotas or plan entitlements.
const technicalLimiter = (windowMs: number, max: number, category: string) => rateLimit({
  windowMs, max, standardHeaders: 'draft-7', legacyHeaders: false,
  validate: { forwardedHeader: false },
  message: { error: 'Muitas requisições. Tente novamente mais tarde.', category: 'rate_limited', limitClass: category },
});
app.use('/api/wia', technicalLimiter(15 * 60 * 1000, 30, 'wia_cost_protection'));
app.use('/api/reports', technicalLimiter(15 * 60 * 1000, 30, 'report_resource_protection'));
app.use('/api/imports', technicalLimiter(15 * 60 * 1000, 20, 'import_resource_protection'));
app.use('/api/proposal', technicalLimiter(15 * 60 * 1000, 60, 'proposal_token_abuse_protection'));
app.use('/api/public', technicalLimiter(15 * 60 * 1000, 60, 'public_token_abuse_protection'));

// Bound unauthenticated work before allocating/parsing request bodies.
app.use(express.json({ limit: '10mb' }));

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

// Tipos auxiliares para corrigir lint estrito
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email?: string };
      tenantContext?: TenantContext;
      authenticatedSupabase?: ReturnType<typeof createClient>;
      requestId?: string;
    }
  }
}

const supabaseClient = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;
// The web runtime never receives or consumes service-role credentials. Every
// environment uses the same request-scoped publishable client and the caller's
// JWT, so legacy direct writes stay constrained by grants/RLS and fail closed.
// Privileged core mutations cross CoreMutationClient -> Edge command RPC.
const requestDb = supabaseClient ? createRequestScopedClient(supabaseClient) : null;
const supabase = requestDb?.client || null;
if (requestDb) {
  app.use((_req, _res, next) => requestDb.run(next));
}
const wiaToolRegistry = supabase ? createT0ToolRegistry(new SupabaseT0DataSource(supabase)) : null;

async function workspaceOwnerUserId(workspaceId: string): Promise<string> {
  if (!supabase) throw new Error('Banco de dados indisponível.');
  const { data, error } = await supabase.from('orkto_workspaces').select('owner_user_id').eq('id',workspaceId).maybeSingle();
  if (error) throw error;
  if (!data?.owner_user_id) throw new Error('Workspace sem proprietário ativo.');
  return data.owner_user_id;
}

async function requireWritablePlan(req, res, feature?: string) {
  const context = requireTenantContext(req);
  if (!supabase) {
    res.status(503).json({ error:'Billing exige banco e configuração de plano.', category:'configuration_required' });
    return null;
  }
  try {
    const access = await loadWorkspacePlanAccess(supabase, context.workspaceId);
    if (access.configurationRequired) {
      res.status(503).json({ error:'Versão de plano/entitlements não configurada para este workspace.', category:'configuration_required' });
      return null;
    }
    if (access.readOnly) {
      res.status(423).json({ error:'Este workspace está somente para leitura após o trial ou por status da assinatura.', category:'workspace_read_only', status:access.status, trialEndsAt:access.trialEndsAt });
      return null;
    }
    if (feature && !hasPlanFeature(access, feature)) {
      res.status(403).json({ error:'O plano atual não inclui esta capacidade.', category:'entitlement_required', feature });
      return null;
    }
    return access;
  } catch (error) {
    console.error('[Billing] plan access check failed', { code:(error as {code?:string})?.code || 'unknown' });
    res.status(503).json({ error:'Não foi possível validar o acesso do plano.', category:'configuration_required' });
    return null;
  }
}

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Não autorizado. Faça login novamente.' });
  }
  const token = authHeader.split(' ')[1];
  if (!supabaseClient) {
    return res.status(500).json({ error: 'Serviço de autenticação indisponível.' });
  }
  const { data: { user }, error } = await supabaseClient.auth.getUser(token);
  if (error || !user) {
    return res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
  }
  req.user = user;
  // The user's JWT, rather than a shared elevated credential, determines the
  // database role and row visibility for Preview reads.
  req.authenticatedSupabase = createClient(supabaseUrl!, supabaseAnonKey!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  requestDb?.useAuthenticatedClient(req.authenticatedSupabase);
  // Invitation acceptance is the only authenticated path available before a
  // user belongs to any workspace. Its high-entropy token, verified session
  // email, and compare-and-set invite claim establish the target workspace.
  if (req.method === 'POST' && req.path === '/api/team/invites/accept') {
    req.tenantContext = undefined;
    return next();
  }
  const requestedWorkspace = typeof req.headers['x-orkto-workspace'] === 'string' ? req.headers['x-orkto-workspace'].trim() : undefined;
  const membershipDb = req.authenticatedSupabase;
  if (!membershipDb) {
    if (requestedWorkspace) return res.status(503).json({ error: 'A seleção de workspace exige a camada de persistência.', category: 'configuration_error' });
    req.tenantContext = createOwnerTenantContext(user.id);
    return next();
  }

  try {
    const { data: memberships, error: membershipError } = await membershipDb.from('orkto_workspace_members')
      .select('workspace_id,user_id,role,status').eq('user_id', user.id).eq('status', 'active');
    if (membershipError) {
      const missingSchema = membershipError.code === '42P01' || membershipError.code === 'PGRST205';
      return res.status(503).json({
        error: missingSchema ? 'O schema de workspace ainda não foi aplicado.' : 'Não foi possível resolver seu workspace ativo.',
        category: missingSchema ? 'workspace_schema_not_applied' : 'workspace_resolution_unavailable',
      });
    }
    const selection = selectActiveWorkspaceMembership(user.id, memberships || [], requestedWorkspace);
    req.tenantContext = createWorkspaceTenantContext(user.id, selection.workspaceId, selection.role);
    return next();
  } catch (workspaceError) {
    if (workspaceError instanceof WorkspaceSelectionError) {
      return res.status(workspaceError.statusCode).json({ error: workspaceError.message, category: workspaceError.statusCode === 409 ? 'workspace_selection_required' : 'workspace_access_denied' });
    }
    console.error('[Auth] workspace_resolution_failed', { code: (workspaceError as { code?: string })?.code || 'unknown' });
    return res.status(503).json({ error: 'Não foi possível resolver seu workspace ativo.', category: 'workspace_resolution_unavailable' });
  }
}

const financeTransactionSchema = z.object({
  transactionType: z.enum(['revenue', 'expense']),
  category: z.enum(['infrastructure', 'ai', 'channel', 'payment_processor', 'people', 'tax', 'other']),
  basis: z.enum(['actual', 'normalized']),
  cashStatus: z.enum(['paid', 'forecast']),
  amountCents: z.number().int().positive().max(100_000_000_000),
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, 'Data inválida.'),
  workspaceId: z.string().uuid().nullable().optional(),
  provider: z.string().trim().max(80).optional(),
  model: z.string().trim().max(120).optional(),
  feature: z.string().trim().max(120).optional(),
  reference: z.string().trim().max(160).optional(),
  note: z.string().trim().max(500).default(''),
}).refine(value => value.transactionType !== 'revenue' || value.category === 'other', {
  message: 'Receita de assinatura é derivada das cobranças confirmadas; registre apenas outras receitas aqui.',
});

const financeAssumptionSchema = z.object({
  assumptions: z.unknown(),
  changeNote: z.string().trim().max(500).default(''),
});

async function isInternalFinanceAdmin(userId: string): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase.from('profiles').select('is_founder').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data?.is_founder === true;
}

async function requireFinanceAdmin(req, res): Promise<boolean> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Sessão necessária.' });
    return false;
  }
  if (!supabase) {
    res.status(503).json({ error: 'Banco de dados financeiro indisponível.' });
    return false;
  }
  try {
    if (await isInternalFinanceAdmin(userId)) return true;
    res.status(403).json({ error: 'Área exclusiva da operação ORKTO.' });
    return false;
  } catch (error) {
    console.error('[Finance] falha ao validar permissão interna:', error instanceof Error ? error.message : 'erro desconhecido');
    res.status(503).json({ error: 'Não foi possível validar a permissão financeira.' });
    return false;
  }
}

app.get('/api/internal/finance/dashboard', authenticate, async (req, res) => {
  if (!await requireFinanceAdmin(req, res)) return;
  const month = typeof req.query.month === 'string' && /^\d{4}-\d{2}$/.test(req.query.month)
    ? req.query.month
    : new Date().toISOString().slice(0, 7);
  const start = `${month}-01`;
  const nextMonthDate = new Date(`${start}T00:00:00.000Z`);
  if (!Number.isFinite(nextMonthDate.getTime()) || nextMonthDate.toISOString().slice(0, 7) !== month) {
    return res.status(400).json({ error: 'Mês inválido.' });
  }
  nextMonthDate.setUTCMonth(nextMonthDate.getUTCMonth() + 1);
  const end = nextMonthDate.toISOString().slice(0, 10);
  const yearAgo = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString();
  try {
    const [assumptionsResult, transactionsResult, profilesResult, paymentsResult, monthPaymentsResult, aiUsageResult, channelUsageResult] = await Promise.all([
      supabase!.from('orkto_finance_assumptions').select('id,version,status,assumptions,change_note,created_at').order('version', { ascending: false }).limit(50),
      supabase!.from('orkto_finance_transactions').select('*').gte('occurred_on', start).lt('occurred_on', end).order('occurred_on', { ascending: false }).limit(500),
      supabase!.from('profiles').select('id,active_plan,plan_period'),
      supabase!.from('payment_records').select('user_id,amount,confirmed_at,quote_id,status,payment_id').is('quote_id', null).eq('status', 'confirmed').gte('confirmed_at', yearAgo).order('confirmed_at', { ascending: false }).limit(5000),
      supabase!.from('payment_records').select('user_id,amount,confirmed_at,quote_id,status,payment_id').is('quote_id', null).eq('status', 'confirmed').gte('confirmed_at', `${start}T00:00:00.000Z`).lt('confirmed_at', `${end}T00:00:00.000Z`).limit(5000),
      supabase!.from('orkto_model_usage').select('workspace_id,user_id,provider,model,prompt_tokens,cached_input_tokens,completion_tokens,mode,created_at,actual_cash_cost_cents,normalized_cost_cents,cost_currency,cost_source,cost_assumption_version,task_class,feature,gateway,billing_period_start').eq('billing_period_start', start).limit(10000),
      supabase!.from('orkto_channel_usage').select('channel,period_start,revenue_cents,cost_cents,actual_cash_cost_cents,normalized_cost_cents,infrastructure_allocation_cents,cost_currency,cost_source,billing_period_start').eq('billing_period_start', start).limit(10000),
    ]);
    for (const result of [assumptionsResult, transactionsResult, profilesResult, paymentsResult, monthPaymentsResult, channelUsageResult]) {
      if (result.error) throw result.error;
    }
    let assumptions = DEFAULT_FINANCE_ASSUMPTIONS;
    const history = assumptionsResult.data || [];
    if (history[0]?.assumptions) assumptions = validateFinanceAssumptions(history[0].assumptions);
    const transactions = transactionsResult.data || [];
    const costs = transactions.filter(row => row.transaction_type === 'expense' && row.basis === 'actual');
    const normalizedCosts = transactions.filter(row => row.transaction_type === 'expense' && row.basis === 'normalized');
    const sum = (rows, predicate) => rows.filter(predicate).reduce((total, row) => total + Number(row.amount_cents || 0), 0);
    const costByCategory = Object.fromEntries(['infrastructure', 'ai', 'channel', 'payment_processor', 'people', 'tax', 'other'].map(category => [
      category,
      sum(costs, row => row.category === category),
    ]));
    const planCounts = Object.fromEntries(['free', 'starter', 'pro', 'business', 'scale', 'enterprise'].map(plan => [
      plan,
      (profilesResult.data || []).filter(profile => (profile.active_plan || 'free') === plan).length,
    ]));
    const activePlanUsers = (profilesResult.data || []).filter(profile => profile.active_plan && profile.active_plan !== 'free').length;
    const payments = paymentsResult.data || [];
    const profileByUser = new Map<string, { plan: string; period: string }>((profilesResult.data || []).map(profile => [profile.id, {
      plan: profile.active_plan || 'free', period: profile.plan_period || 'monthly',
    }]));
    const latestPaymentByUser = new Map<string, number>();
    for (const payment of payments) {
      const activePlan = payment.user_id ? profileByUser.get(payment.user_id) : null;
      if (payment.user_id && !String(payment.payment_id || '').startsWith('checkout:')
        && activePlan && activePlan.plan !== 'free' && !latestPaymentByUser.has(payment.user_id)) {
        const periodDivisor = activePlan.period === 'annual' ? 12 : 1;
        latestPaymentByUser.set(payment.user_id, Math.round(Number(payment.amount || 0) * 100 / periodDivisor));
      }
    }
    const observedMrrCents = [...latestPaymentByUser.values()].reduce((total, amount) => total + amount, 0);
    const actualMrrCoverageCount = latestPaymentByUser.size;
    const subscriptionCashInCents = (monthPaymentsResult.data || []).filter(row => !String(row.payment_id || '').startsWith('checkout:'))
      .reduce((total, row) => total + Math.round(Number(row.amount || 0) * 100), 0);
    const otherRevenueCents = sum(transactions, row => row.transaction_type === 'revenue' && row.basis === 'actual' && row.cash_status === 'paid');
    const cashOutCents = sum(transactions, row => row.transaction_type === 'expense' && row.basis === 'actual' && row.cash_status === 'paid');
    const technicalCogsCents = sum(costs, row => isTechnicalCogsCategory(row.category));
    const channelCents = sum(costs, row => row.category === 'channel');
    const normalizedTechnicalCogsCents = normalizedCosts.length > 0
      ? sum(normalizedCosts, row => isTechnicalCogsCategory(row.category))
      : null;
    const normalizedChannelCents = sum(normalizedCosts, row => row.category === 'channel');
    const cashInCents = subscriptionCashInCents + otherRevenueCents;
    const paidSubscribers = actualMrrCoverageCount;
    const cashClosingEstimateCents = assumptions.openingCashCents + cashInCents - cashOutCents;
    const observedMetrics = calculateObservedFinanceMetrics({
      mrrCents: observedMrrCents,
      actualTechnicalCogsCents: technicalCogsCents,
      actualChannelCostsCents: channelCents,
      normalizedTechnicalCogsCents,
      normalizedChannelCostsCents: normalizedChannelCents,
    });
    const cogsPercent = observedMetrics.actualTechnicalCogsPercent;
    const alerts: string[] = [];
    if (cashClosingEstimateCents < 0) alerts.push('Alerta POK Caixa: caixa final observado/estimado abaixo de zero.');
    if (paidSubscribers < activePlanUsers) alerts.push('MRR observado cobre menos assinantes do que os perfis marcados com plano pago; verifique reconciliação do Asaas.');
    if (cogsPercent !== null && cogsPercent > assumptions.cogsHardCapPercent) alerts.push(`COGS técnico está acima do hard cap de ${assumptions.cogsHardCapPercent}%.`);
    else if (cogsPercent !== null && cogsPercent > assumptions.cogsTargetPercent) alerts.push(`COGS técnico está acima da meta de ${assumptions.cogsTargetPercent}%.`);
    if (observedMetrics.normalizedTechnicalCogsPercent !== null && observedMetrics.normalizedTechnicalCogsPercent > assumptions.cogsHardCapPercent) {
      alerts.push(`COGS técnico normalizado está acima do hard cap de ${assumptions.cogsHardCapPercent}%.`);
    } else if (observedMetrics.normalizedTechnicalCogsPercent !== null && observedMetrics.normalizedTechnicalCogsPercent > assumptions.cogsTargetPercent) {
      alerts.push(`COGS técnico normalizado está acima da meta de ${assumptions.cogsTargetPercent}%.`);
    }
    if (transactions.length === 0) alerts.push('Nenhum lançamento financeiro foi registrado neste mês.');
    const aiUsageEstimate = aiUsageResult.error
      ? null
      : estimateAiUsageCost(aiUsageResult.data || [], assumptions);
    const usageRows = aiUsageResult.error ? [] : aiUsageResult.data || [];
    const channelUsageTelemetry = summarizeChannelUsageCosts(channelUsageResult.data || []);
    const trackedCostCents = (field: 'actual_cash_cost_cents' | 'normalized_cost_cents') => usageRows
      .filter(row => row[field] !== null && row[field] !== undefined && String(row.cost_currency || '').toUpperCase() === 'BRL')
      .reduce((total, row) => total + Number(row[field]), 0);
    const foreignTrackedCostEvents = usageRows.filter(row =>
      (row.actual_cash_cost_cents !== null && row.actual_cash_cost_cents !== undefined
        || row.normalized_cost_cents !== null && row.normalized_cost_cents !== undefined)
      && String(row.cost_currency || '').toUpperCase() !== 'BRL').length;
    const workspaceCosts = new Map<string, { workspaceId: string; actualTechnicalCogsCents: number; actualChannelCents: number; estimatedAiUsageCents: number }>();
    for (const row of costs) {
      if (!row.workspace_id) continue;
      const workspace = workspaceCosts.get(row.workspace_id) || { workspaceId: row.workspace_id, actualTechnicalCogsCents: 0, actualChannelCents: 0, estimatedAiUsageCents: 0 };
      if (row.category === 'channel') workspace.actualChannelCents += Number(row.amount_cents || 0);
      else if (isTechnicalCogsCategory(row.category)) workspace.actualTechnicalCogsCents += Number(row.amount_cents || 0);
      workspaceCosts.set(row.workspace_id, workspace);
    }
    for (const row of aiUsageEstimate?.byWorkspace || []) {
      const workspace = workspaceCosts.get(row.workspaceId) || { workspaceId: row.workspaceId, actualTechnicalCogsCents: 0, actualChannelCents: 0, estimatedAiUsageCents: 0 };
      workspace.estimatedAiUsageCents += row.costCents;
      workspaceCosts.set(row.workspaceId, workspace);
    }
    if (aiUsageResult.error) alerts.push('Uso de IA indisponível. Verifique a migration de telemetria WIA.');
    else if (aiUsageEstimate && aiUsageEstimate.unpricedEvents > 0) {
      alerts.push(`${aiUsageEstimate.unpricedEvents} chamada(s) Gemini/IA sem tarifa configurada; custo estimado incompleto.`);
    }
    res.json({
      month,
      assumptions: history[0] || null,
      assumptionsHistory: history,
      assumptionsFallback: history.length === 0 ? assumptions : null,
      projections: [10, 100, 1000, 10000].flatMap(customers => (['pok', 'base', 'favorable'] as const).map(scenario => ({
        ...projectFinance(assumptions, customers, scenario),
        projectionKey: `${customers}:${scenario}`,
      }))),
      actual: {
        planCounts, activePlanCustomers: activePlanUsers, paidSubscribers,
        mrrCents: observedMrrCents, arrCents: observedMrrCents * 12,
        arpaCents: paidSubscribers ? Math.round(observedMrrCents / paidSubscribers) : 0,
        cogsTargetPercent: assumptions.cogsTargetPercent, cogsHardCapPercent: assumptions.cogsHardCapPercent,
        technicalCogsCents, technicalCogsPercent: cogsPercent,
        economicMarginCents: observedMetrics.actualEconomicMarginCents,
        channelAdjustedOperatingResultCents: observedMetrics.actualChannelAdjustedResultCents,
        channelCostsCents: channelCents, costByCategory,
        normalizedTechnicalCogsCents,
        normalizedTechnicalCogsPercent: observedMetrics.normalizedTechnicalCogsPercent,
        normalizedEconomicMarginCents: observedMetrics.normalizedEconomicMarginCents,
        normalizedChannelCostsCents: normalizedChannelCents,
        normalizedChannelAdjustedOperatingResultCents: observedMetrics.normalizedChannelAdjustedResultCents,
        aiUsageEstimate: aiUsageEstimate ? {
          ...aiUsageEstimate,
          recordedActualCashCostCents: usageRows.some(row => row.actual_cash_cost_cents !== null && row.actual_cash_cost_cents !== undefined) ? trackedCostCents('actual_cash_cost_cents') : null,
          recordedNormalizedCostCents: usageRows.some(row => row.normalized_cost_cents !== null && row.normalized_cost_cents !== undefined) ? trackedCostCents('normalized_cost_cents') : null,
          foreignTrackedCostEvents,
          note:'Telemetria separada do ledger conciliado para evitar dupla contagem do COGS.',
        } : null,
        channelUsageTelemetry: {
          ...channelUsageTelemetry,
          note:'Telemetria separada do ledger; custos legados não têm classificação de caixa/normalização e não entram no POK.',
        },
        workspaceCosts: [...workspaceCosts.values()].sort((left, right) =>
          (right.actualTechnicalCogsCents + right.actualChannelCents + right.estimatedAiUsageCents)
          - (left.actualTechnicalCogsCents + left.actualChannelCents + left.estimatedAiUsageCents)),
        cashInCents, cashOutCents, netCashFlowCents: cashInCents - cashOutCents,
        cashClosingEstimateCents,
        alerts,
      },
      transactions,
    });
  } catch (error) {
    console.error('[Finance] falha ao carregar dashboard:', error instanceof Error ? error.message : 'erro desconhecido');
    res.status(503).json({ error: 'Não foi possível carregar os dados financeiros. Verifique se a migration financeira foi aplicada.' });
  }
});

app.post('/api/internal/finance/assumptions', authenticate, async (req, res) => {
  if (!await requireFinanceAdmin(req, res)) return;
  const parsed = financeAssumptionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Premissas inválidas.', details: parsed.error.issues.map(issue => issue.message) });
  try {
    const assumptions = validateFinanceAssumptions(parsed.data.assumptions);
    const { data, error } = await supabase!.from('orkto_finance_assumptions').insert({
      assumptions, status: 'draft', change_note: parsed.data.changeNote, created_by: req.user!.id,
    }).select('id,version,status,assumptions,change_note,created_at').single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    console.error('[Finance] falha ao versionar premissas:', error instanceof Error ? error.message : 'erro desconhecido');
    res.status(400).json({ error: error instanceof Error ? error.message : 'Não foi possível salvar as premissas.' });
  }
});

app.post('/api/internal/finance/transactions', authenticate, async (req, res) => {
  if (!await requireFinanceAdmin(req, res)) return;
  const parsed = financeTransactionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Lançamento inválido.', details: parsed.error.issues.map(issue => issue.message) });
  try {
    const value = parsed.data;
    const { data, error } = await supabase!.from('orkto_finance_transactions').insert({
      transaction_type: value.transactionType, category: value.category, basis: value.basis,
      cash_status: value.cashStatus, amount_cents: value.amountCents, occurred_on: value.occurredOn,
      workspace_id: value.workspaceId || null, provider: value.provider || null, model: value.model || null,
      feature: value.feature || null, reference: value.reference || null, note: value.note, created_by: req.user!.id,
    }).select('*').single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    console.error('[Finance] falha ao registrar lançamento:', error instanceof Error ? error.message : 'erro desconhecido');
    res.status(503).json({ error: 'Não foi possível registrar o lançamento.' });
  }
});

const profileSchema = z.object({
  display_name: z.string().trim().min(1).max(120),
  email: z.string().email().max(254),
  photo_url: z.string().max(2_500_000).nullable().optional(),
  onboarding_completed: z.boolean().optional(),
  company_name: z.string().trim().min(1).max(160),
  tax_id: z.string().max(30).optional(),
  company_logo: z.string().max(2_500_000).optional(),
  whatsapp_number: z.string().max(40).optional(),
  whatsapp_template: z.string().max(4000).optional(),
  payment_info: z.string().max(1000).optional(),
  quote_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  address: z.string().max(300).optional(),
  profession: z.string().max(100).optional(),
  brand_name: z.string().max(160).optional(),
  brand_tone: z.enum(['formal', 'técnico', 'comercial', 'criativo']).optional(),
});

const wiaRequestSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  sessionId: z.string().uuid().optional(),
  clientMessageId: z.string().uuid().optional(),
  contextRefs: z.object({ customerId:z.string().uuid().optional(), conversationId:z.string().uuid().optional(), dealId:z.string().uuid().optional(), quoteId:z.string().uuid().optional() }).strict().optional(),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().trim().min(1).max(1000),
  })).max(12).optional(),
}).refine(value => Boolean(value.sessionId) === Boolean(value.clientMessageId), { message: 'sessionId e clientMessageId devem ser enviados juntos.' });

function objectionTypeForMemoryQuery(message: string): string | null {
  const value = message.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  if (/\b(caro|preco|valor|desconto|orcamento alto)\b/.test(value)) return 'price';
  if (/\b(vou pensar|depois|agora nao|sem tempo|mais tarde)\b/.test(value)) return 'timing';
  if (/\b(duvida|garantia|confianca|nao conheco|como funciona)\b/.test(value)) return 'trust_or_clarity';
  return null;
}

async function loadContextualMemories(database: any, workspaceId: string, entities: Array<{ type: string; ref: string }>, limit = 12, intentText = '') {
  const unique = [...new Map(entities.filter(item => item.ref).map(item => [`${item.type}:${item.ref}`, item])).values()];
  let entityMemories: any[] = [];
  if (unique.length) {
    const refs = [...new Set(unique.map(item => item.ref))];
    const { data, error } = await database.from('orkto_wia_memories').select('id,memory_type,entity_type,entity_ref,content,provenance,confidence,expires_at,created_at')
      .eq('workspace_id',workspaceId).eq('status','active').in('entity_ref',refs).or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`).order('created_at',{ascending:false}).limit(100);
    if (error) throw error;
  const allowed = new Set(unique.map(item => `${item.type}:${item.ref}`));
  const relevant = (data || []).filter((row:any) => allowed.has(`${row.entity_type}:${row.entity_ref}`))
    .filter((row:any) => row.memory_type === 'raw_event' || row.confidence == null || Number(row.confidence) >= 0.5);
  let rawEvents = 0;
    entityMemories = relevant.slice(0,100).filter((row:any) => {
      if (row.memory_type !== 'raw_event') return true;
      rawEvents += 1;
      return rawEvents <= 2;
    }).slice(0,Math.min(20,Math.max(1,limit)));
  }
  const objectionType = objectionTypeForMemoryQuery(intentText);
  if (!objectionType || entityMemories.length >= Math.min(20,Math.max(1,limit))) return entityMemories;
  const { data: patterns, error: patternError } = await database.from('orkto_wia_memories')
    .select('id,memory_type,entity_type,entity_ref,content,provenance,confidence,expires_at,created_at')
    .eq('workspace_id',workspaceId).eq('entity_type','workspace').eq('entity_ref',workspaceId).eq('memory_type','commercial_pattern').eq('status','active')
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`).order('created_at',{ascending:false}).limit(50);
  if (patternError) throw patternError;
  const matchingPatterns = (patterns || []).filter((row:any)=>row.content?.objectionType === objectionType)
    .filter((row:any)=>row.confidence == null || Number(row.confidence) >= 0.6).slice(0,2);
  const allowedSlots = Math.max(0,Math.min(20,Math.max(1,limit))-entityMemories.length);
  return [...entityMemories,...matchingPatterns.slice(0,allowedSlots)];
}

async function persistObservedMessageMemories(database: any, input: { workspaceId:string; customerId:string; conversationId:string; messageId:string; direction:'incoming'|'outgoing'; content:string; occurredAt:string; userId?:string }) {
  const candidates = deriveMessageMemoryCandidates({ messageId:input.messageId,conversationId:input.conversationId,direction:input.direction,content:input.content,occurredAt:input.occurredAt });
  for (const candidate of candidates) {
    const saved = await persistAutomaticMemory(database,{
      workspaceId:input.workspaceId,entityType:'customer',entityRef:input.customerId,memoryType:candidate.type,content:candidate.content,
      provenance:{source:'channel_message',sourceRef:input.messageId,conversationId:input.conversationId},confidence:candidate.confidence,
      idempotencyKey:candidate.idempotencyKey,createdBy:input.userId || null,
    });
    if (saved.inserted && saved.id) await recordCoreEvent(input.workspaceId,input.userId || null,'memory.candidate_captured','customer',input.customerId,{memory_id:saved.id,memory_type:candidate.type,source_message_id:input.messageId},'channel');
  }
}

async function persistConversationSummary(database: any, input: { workspaceId:string; customerId:string; conversationId:string; userId?:string }) {
  const { data: messages, error: messagesError } = await database.from('orkto_messages').select('id,direction,sent_at')
    .eq('workspace_id',input.workspaceId).eq('conversation_id',input.conversationId).order('sent_at',{ascending:false}).limit(30);
  if (messagesError) throw messagesError;
  const rows = messages || [];
  if (!rows.length) return;
  const content = { eventType:'conversation_activity_summary',messageCount:rows.length,incomingCount:rows.filter((row:any)=>row.direction === 'incoming').length,
    outgoingCount:rows.filter((row:any)=>row.direction === 'outgoing').length,lastActivityAt:rows[0].sent_at,sourceMessageIds:rows.slice(0,10).map((row:any)=>row.id) };
  const { data, error } = await database.from('orkto_wia_memories').upsert({
    workspace_id:input.workspaceId,memory_type:'summary',entity_type:'conversation',entity_ref:input.conversationId,content,
    provenance:{source:'conversation_activity',sourceRef:input.conversationId,algorithm:'message-count-summary-v1'},confidence:0.8,status:'active',
    idempotency_key:`conversation:${input.conversationId}:summary:v1`,created_by:input.userId || null,updated_at:new Date().toISOString(),
  },{onConflict:'workspace_id,idempotency_key'}).select('id').maybeSingle();
  if (error) throw error;
  if (data?.id) await recordCoreEvent(input.workspaceId,input.userId || null,'memory.summary_refreshed','conversation',input.conversationId,{memory_id:data.id,message_count:rows.length},'channel');
}

app.post('/api/wia/decide', authenticate, async (req, res) => {
  const parsed = wiaRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Mensagem inválida.' });

  const tenantContext = requireTenantContext(req);
  const planAccess = await requireWritablePlan(req,res,'wia');
  if (!planAccess) return;
  const monthlyLimit = planAccess.entitlements.limits?.monthly_wia_runs;
  if (monthlyLimit === undefined) return res.status(503).json({ error:'Limite mensal da WIA não está configurado para este plano.', category:'configuration_required' });
  if (!supabase) return res.status(503).json({ error:'A cota da WIA exige banco configurado.', category:'configuration_required' });
  const usagePeriodStart = `${new Date().toISOString().slice(0,7)}-01`;
  const usageResult = await supabase.rpc('orkto_consume_plan_usage', {
    p_workspace_id:tenantContext.workspaceId, p_period_start:usagePeriodStart, p_feature_key:'monthly_wia_runs', p_delta:1, p_limit:monthlyLimit,
  });
  if (usageResult.error) {
    console.error('[WIA] plan_usage_record_failed', { traceId:'not-started', code:usageResult.error.code || 'unknown' });
    return res.status(503).json({ error:'Não foi possível validar/registrar o limite mensal da WIA.', category:'configuration_required' });
  }
  const usage = Array.isArray(usageResult.data) ? usageResult.data[0] : usageResult.data;
  if (!usage?.allowed) return res.status(429).json({ error:'Limite mensal da WIA atingido para este plano.', category:'plan_limit_reached', feature:'monthly_wia_runs', limit:monthlyLimit });
  const workspaceId = tenantContext.workspaceId;
  const actorUserId = tenantContext.userId;
  const traceId = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  const agent = routeSwarmAgent(parsed.data.message);
  try {
    let conversationHistory = parsed.data.history?.map(turn => ({ role: turn.role!, content: turn.content! }));
    if (parsed.data.sessionId) {
      if (!supabase) return res.status(503).json({ error: 'A conversa persistente com a WIA requer banco configurado.', category: 'configuration_error' });
      const { data: historyRows, error: historyError } = await supabase.from('orkto_wia_chat_messages').select('role,content').eq('workspace_id',workspaceId).eq('user_id',actorUserId).eq('session_id',parsed.data.sessionId).order('created_at',{ascending:false}).limit(12);
      if (historyError) throw historyError;
      conversationHistory = (historyRows || []).reverse().map((turn: any) => ({ role: turn.role, content: turn.content }));
      const { error: userMessageError } = await supabase.from('orkto_wia_chat_messages').upsert({ workspace_id:workspaceId, user_id:actorUserId, session_id:parsed.data.sessionId, role:'user', message_key:parsed.data.clientMessageId, content:parsed.data.message }, { onConflict:'workspace_id,session_id,message_key,role', ignoreDuplicates:true });
      if (userMessageError) throw userMessageError;
    }
    let quotes: Array<{ id: string; total: number | string | null }> = [];
    let companyName: string | undefined;
    let clientsCount = 0;
    const contextEntities: Array<{ type: string; ref: string }> = [];
    const contextSourceIds: string[] = [];
    const contextCustomerIds = new Set<string>();
    const contextDealIds = new Set<string>();
    const requestedRefs = parsed.data.contextRefs || {};
    if (supabase) {
      const [quotesResult, profileResult, clientsResult] = await Promise.all([
        supabase.from('quotes').select('id,total').eq('workspace_id', tenantContext.workspaceId).in('status', ['pending', 'sent', 'viewed']).limit(30),
        supabase.from('profiles').select('company_name').eq('id', await workspaceOwnerUserId(workspaceId)).maybeSingle(),
        supabase.from('clients').select('id', { count: 'exact', head: true }).eq('workspace_id', tenantContext.workspaceId),
      ]);
      if (quotesResult.error) throw quotesResult.error;
      if (profileResult.error) throw profileResult.error;
      if (clientsResult.error) throw clientsResult.error;
      quotes = quotesResult.data || [];
      clientsCount = clientsResult.count || 0;
      companyName = profileResult.data?.company_name || undefined;

      if (requestedRefs.customerId) {
        const { data, error } = await supabase.from('clients').select('id').eq('workspace_id',workspaceId).eq('id',requestedRefs.customerId).is('archived_at',null).maybeSingle();
        if (error) throw error;
        if (!data) return res.status(404).json({ error:'O cliente de contexto não existe neste workspace.', category:'tenant_validation_error' });
        contextCustomerIds.add(String(data.id));
        contextSourceIds.push(`customer:${data.id}`);
      }
      if (requestedRefs.dealId) {
        const { data, error } = await supabase.from('orkto_deals').select('id,customer_ref').eq('workspace_id',workspaceId).eq('id',requestedRefs.dealId).maybeSingle();
        if (error) throw error;
        if (!data) return res.status(404).json({ error:'O negócio de contexto não existe neste workspace.', category:'tenant_validation_error' });
        contextDealIds.add(String(data.id));
        contextSourceIds.push(`deal:${data.id}`);
        if (data.customer_ref) {
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(data.customer_ref));
          let resolvedCustomer: { id:string } | null = null;
          if (isUuid) {
            const customerResult = await supabase.from('clients').select('id').eq('workspace_id',workspaceId).eq('id',String(data.customer_ref)).is('archived_at',null).maybeSingle();
            if (customerResult.error) throw customerResult.error;
            resolvedCustomer = customerResult.data;
          } else {
            const customerResult = await supabase.from('clients').select('id').eq('workspace_id',workspaceId).eq('phone',String(data.customer_ref)).is('archived_at',null).limit(2);
            if (customerResult.error) throw customerResult.error;
            resolvedCustomer = customerResult.data?.length === 1 ? customerResult.data[0] : null;
          }
          if (resolvedCustomer?.id) { contextCustomerIds.add(String(resolvedCustomer.id)); contextSourceIds.push(`customer:${resolvedCustomer.id}`); }
        }
      }
      if (requestedRefs.conversationId) {
        const { data, error } = await supabase.from('orkto_conversations').select('id,customer_id,deal_id').eq('workspace_id',workspaceId).eq('id',requestedRefs.conversationId).maybeSingle();
        if (error) throw error;
        if (!data) return res.status(404).json({ error:'A conversa de contexto não existe neste workspace.', category:'tenant_validation_error' });
        contextSourceIds.push(`conversation:${data.id}`);
        if (data.customer_id) contextCustomerIds.add(String(data.customer_id));
        if (data.deal_id) contextDealIds.add(String(data.deal_id));
      }
      if (requestedRefs.quoteId) {
        const { data, error } = await supabase.from('quotes').select('id,customer_id,deal_id').eq('workspace_id',workspaceId).eq('id',requestedRefs.quoteId).is('archived_at',null).maybeSingle();
        if (error) throw error;
        if (!data) return res.status(404).json({ error:'A proposta de contexto não existe neste workspace.', category:'tenant_validation_error' });
        contextSourceIds.push(`quote:${data.id}`);
        if (data.customer_id) contextCustomerIds.add(String(data.customer_id));
        if (data.deal_id) contextDealIds.add(String(data.deal_id));
      }
      if (contextCustomerIds.size > 1 || contextDealIds.size > 1) return res.status(400).json({ error:'As referências de contexto apontam para registros diferentes.', category:'context_validation_error' });
      for (const id of contextCustomerIds) contextEntities.push({ type:'customer',ref:id });
      for (const id of contextDealIds) contextEntities.push({ type:'deal',ref:id });
      if (requestedRefs.conversationId) contextEntities.push({ type:'conversation',ref:requestedRefs.conversationId });
      if (requestedRefs.quoteId) contextEntities.push({ type:'quote',ref:requestedRefs.quoteId });
    }

    const relevantMemories = supabase ? await loadContextualMemories(supabase,workspaceId,contextEntities,10,parsed.data.message) : [];
    const sourceIds = [...new Set([...quotes.slice(0,20).map(quote => `quote:${quote.id}`),...contextSourceIds,...relevantMemories.map((memory:any)=>`memory:${memory.id}`)])].slice(0,30);
    const result = await decideWithWia({
      message: parsed.data.message,
      history: conversationHistory,
      context: {
        openQuotes: quotes.length,
        pendingValue: quotes.reduce((sum, quote) => sum + Number(quote.total || 0), 0),
        clients: clientsCount,
        companyName,
        relevantMemories: relevantMemories.map((memory:any)=>({ id:memory.id,memoryType:memory.memory_type,entityType:memory.entity_type,entityRef:memory.entity_ref,content:memory.content,confidence:memory.confidence,provenance:memory.provenance })),
      },
      sourceIds,
      agent,
      ...(wiaToolRegistry ? { toolRuntime: { registry: wiaToolRegistry, context: { tenant: tenantContext, traceId } } } : {}),
    });
    const verifiedFacts = quotes.map(quote => `Proposta ${quote.id}: R$ ${Number(quote.total || 0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}`);
    const responseCheck = prepareResponseDraft({ draft:result.decision.messageDraft,surface:'wia',verifiedFacts,sourceRefs:sourceIds });
    if (responseCheck.status === 'blocked') {
      result.decision = { ...result.decision, action:'ask_clarification',messageDraft:'Não tenho uma fonte verificada para afirmar esse valor ou essa condição. Posso consultar a proposta ou o catálogo correto antes de responder?',sourceIds:[],confidenceSignal:'low',requiresApproval:false,reasonCode:'response_policy_blocked' };
    } else {
      result.decision = { ...result.decision,messageDraft:responseCheck.draft };
    }

    let chatPersistence: 'persisted' | 'partial' | 'not_requested' = 'not_requested';
    if (supabase && parsed.data.sessionId) {
      const { error: assistantMessageError } = await supabase.from('orkto_wia_chat_messages').upsert({ workspace_id:workspaceId, user_id:actorUserId, session_id:parsed.data.sessionId, role:'assistant', message_key:crypto.randomUUID(), content:result.decision.messageDraft.slice(0,4000) }, { onConflict:'workspace_id,session_id,message_key,role', ignoreDuplicates:true });
      chatPersistence = assistantMessageError ? 'partial' : 'persisted';
      if (assistantMessageError) console.error('[WIA] chat_message_persistence_failed', { traceId, code: assistantMessageError.code || 'unknown' });
    }

    if (supabase) {
      const auditRows = [{
          user_id: actorUserId, workspace_id: workspaceId, event_type: 'wia.decision.proposed', actor_type: 'bot', actor_id: 'wia', trace_id: traceId,
          event_data: { run_id: result.runId, action: result.decision.action, reason_code: result.decision.reasonCode, requires_approval: result.decision.requiresApproval, mode: result.mode, path: result.path, model: result.usage },
        }, ...result.toolExecutions.map(execution => ({
          user_id: actorUserId, workspace_id: workspaceId, event_type: 'wia.tool.executed', actor_type: 'bot', actor_id: 'wia', trace_id: traceId,
          event_data: { tool: execution.toolName, status: execution.status, duration_ms: execution.durationMs, source_ids: execution.sourceIds, error: execution.error },
        }))];
      const writes: Array<PromiseLike<unknown>> = [supabase.from('orkto_audit_log').insert(auditRows)];
      if (result.path === 'model') writes.push(supabase.from('orkto_model_usage').insert({
          user_id: actorUserId, workspace_id: workspaceId, trace_id: traceId, provider: result.usage.provider, model: result.usage.model,
          prompt_tokens: result.usage.promptTokens, cached_input_tokens:result.usage.cachedInputTokens,
          completion_tokens: result.usage.completionTokens, total_tokens: result.usage.totalTokens,
          latency_ms: result.usage.latencyMs, mode: result.mode, task_class:result.usage.taskType,
          feature:'wia', gateway:result.usage.gateway, billing_period_start:`${new Date().toISOString().slice(0,7)}-01`,
        }));
      const persisted = await Promise.all(writes);
      for (const write of persisted as Array<{ error?: { code?: string } | null }>) {
        if (write?.error) throw write.error;
      }
      try {
        const { data: run } = await supabase.from('orkto_wia_runs').upsert({
          workspace_id: workspaceId, user_id: actorUserId, feature: 'wia_contact', agent, task_type: result.usage.taskType, status: 'succeeded',
          provider: result.usage.provider, model: result.usage.model, trace_id: traceId, context_refs: sourceIds,
          summary: result.decision.messageDraft, started_at: startedAt, completed_at: new Date().toISOString(),
        }, { onConflict: 'workspace_id,trace_id' }).select('id').maybeSingle();
        if (!run?.id) throw new Error('WiaRun não foi persistido.');
        const { error: eventError } = await supabase.from('orkto_wia_events').insert({ workspace_id: workspaceId, run_id: run.id, actor_user_id: actorUserId, event_type: 'wia.decision.prepared', source: 'wia', entity_type: 'wia_run', entity_ref: traceId, idempotency_key: `decision:${traceId}`, payload: { action: result.decision.action, requiresApproval: result.decision.requiresApproval, agent } });
        if (eventError) throw eventError;
        for (const execution of result.toolExecutions) {
          const { error: toolError } = await supabase.from('orkto_wia_tool_calls').insert({ workspace_id: workspaceId, run_id: run.id, tool_name: execution.toolName, status: execution.status, output_summary: { sourceIds: execution.sourceIds }, error_category: execution.error?.code || null, duration_ms: execution.durationMs });
          if (toolError) throw toolError;
        }
        if (result.decision.action !== 'answer' && result.decision.action !== 'ask_clarification') {
          const { error: actionError } = await supabase.from('orkto_wia_actions').upsert({
            workspace_id: workspaceId, run_id: run.id, action_type: result.decision.action,
            payload: { messageDraft: result.decision.messageDraft, sourceIds: result.decision.sourceIds }, rationale: result.decision.reasonCode,
            risk_level: result.decision.requiresApproval ? 'medium' : 'low', confidence: result.decision.confidenceSignal === 'high' ? 0.9 : result.decision.confidenceSignal === 'medium' ? 0.65 : 0.3,
            status: result.decision.requiresApproval ? 'awaiting_approval' : 'prepared', requires_approval: result.decision.requiresApproval,
            idempotency_key: `wia-action:${traceId}`, created_by: actorUserId,
          }, { onConflict: 'workspace_id,idempotency_key', ignoreDuplicates: true });
          if (actionError) throw actionError;
        }
      } catch (persistenceError) {
        console.error('[WiaOS] operational_trace_unavailable', { traceId, code: (persistenceError as { code?: string })?.code || 'unknown' });
        return res.status(503).json({ error: 'A WIA preparou a resposta, mas não foi possível registrar sua trilha operacional. Nenhuma ação foi executada.', traceId, category: 'persistence_error' });
      }
    }

    return res.json({ success: true, traceId, agent, chatPersistence, ...result });
  } catch (error) {
    const errorCode = error instanceof ModelProviderError || error instanceof ProviderConfigurationError ? error.code : 'provider_error';
    const provider = error instanceof ModelProviderError ? error.provider : undefined;
    logStructured('error', 'wia.decision.failed', { requestId: req.requestId, traceId, workspaceId: req.tenantContext?.workspaceId, actorUserId: req.user?.id, errorCode, provider });
    return res.status(503).json({ error: 'A WIA não conseguiu preparar uma resposta agora. Nenhuma ação foi executada.', traceId, requestId: req.requestId, category: errorCode });
  }
});

app.get('/api/wia/chat-history', authenticate, async (req,res) => {
  const parsed = z.object({ sessionId: z.string().uuid() }).safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error:'Identificador de conversa inválido.' });
  const historyDb = req.authenticatedSupabase;
  if (!historyDb) return res.status(503).json({ error:'Histórico da WIA indisponível.', category:'configuration_error' });
  const tenantContext = requireTenantContext(req);
  try {
    const { data, error } = await historyDb.from('orkto_wia_chat_messages').select('id,role,content,created_at').eq('workspace_id',tenantContext.workspaceId).eq('user_id',tenantContext.userId).eq('session_id',parsed.data.sessionId).order('created_at',{ascending:false}).limit(100);
    if (error) throw error;
    return res.json({ data:(data || []).reverse() });
  } catch (error) {
    const code = (error as { code?: string })?.code || 'unknown';
    console.error('[WIA] chat_history_unavailable', { code });
    return res.status(503).json({ error:'Não foi possível recuperar a conversa persistida.', category: code === '42P01' || code === 'PGRST205' ? 'schema_not_applied' : 'persistence_unavailable' });
  }
});

const wiaHistoryQuerySchema = z.object({
  cursor: z.string().trim().min(1).max(512).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: z.enum(['running','succeeded','failed','cancelled']).optional(),
  feature: z.string().trim().min(1).max(80).optional(),
  runId: z.string().uuid().optional(),
});

type WiaHistoryCursor = { startedAt: string; id: string };
const isUuid = (value: unknown): value is string => typeof value === 'string'
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

function decodeWiaHistoryCursor(value?: string): WiaHistoryCursor | null | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (!parsed || typeof parsed.startedAt !== 'string' || !Number.isFinite(Date.parse(parsed.startedAt)) || !isUuid(parsed.id)) return null;
    return { startedAt: parsed.startedAt, id: parsed.id };
  } catch { return null; }
}

function encodeWiaHistoryCursor(cursor: WiaHistoryCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

/** Read-only, workspace-scoped history. Deliberately maps allowlisted fields instead of returning provider/event payloads. */
app.get('/api/wia/history', authenticate, async (req, res) => {
  const parsed = wiaHistoryQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'Parâmetros do histórico inválidos.', category: 'validation_failed' });
  const cursor = decodeWiaHistoryCursor(parsed.data.cursor);
  if (cursor === null) return res.status(400).json({ error: 'Cursor do histórico inválido.', category: 'validation_failed' });
  const historyDb = req.authenticatedSupabase;
  if (!historyDb) return res.status(503).json({ error: 'Histórico da WIA indisponível.', category: 'configuration_required' });

  const tenantContext = requireTenantContext(req);
  const workspaceId = tenantContext.workspaceId;
  const limit = parsed.data.limit;
  const queryRuns = () => {
    let query = historyDb!.from('orkto_wia_runs')
      .select('id,workspace_id,user_id,feature,agent,task_type,status,provider,model,trace_id,started_at,completed_at,created_at')
      .eq('workspace_id', workspaceId);
    if (parsed.data.status) query = query.eq('status', parsed.data.status);
    if (parsed.data.feature) query = query.eq('feature', parsed.data.feature);
    if (parsed.data.runId) query = query.eq('id', parsed.data.runId);
    return query;
  };

  try {
    let candidates: any[] = [];
    if (!cursor) {
      const { data, error } = await queryRuns().order('started_at', { ascending: false }).order('id', { ascending: false }).limit(limit + 1);
      if (error) throw error;
      candidates = data || [];
    } else {
      // Split the composite keyset boundary into older timestamps and same-timestamp IDs.
      // This avoids offset pagination drift when new runs arrive between requests.
      const [olderResult, tieResult] = await Promise.all([
        queryRuns().lt('started_at', cursor.startedAt).order('started_at', { ascending: false }).order('id', { ascending: false }).limit(limit + 1),
        queryRuns().eq('started_at', cursor.startedAt).lt('id', cursor.id).order('started_at', { ascending: false }).order('id', { ascending: false }).limit(limit + 1),
      ]);
      if (olderResult.error) throw olderResult.error;
      if (tieResult.error) throw tieResult.error;
      candidates = [...(olderResult.data || []), ...(tieResult.data || [])]
        .sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at) || String(b.id).localeCompare(String(a.id)))
        .slice(0, limit + 1);
    }

    const hasMore = candidates.length > limit;
    const runs = candidates.slice(0, limit);
    const runIds = runs.map(run => run.id);
    const traceIds = runs.map(run => run.trace_id).filter(Boolean);
    const [actionsResult, eventsResult, auditResult] = runIds.length ? await Promise.all([
      historyDb.from('orkto_wia_actions').select('id,run_id,action_type,status,requires_approval,approved_by,approved_at,executed_at,created_at,updated_at')
        .eq('workspace_id', workspaceId).in('run_id', runIds).order('created_at', { ascending: true }).order('id', { ascending: true }),
      historyDb.from('orkto_wia_events').select('id,run_id,actor_user_id,event_type,source,entity_type,entity_ref,occurred_at')
        .eq('workspace_id', workspaceId).in('run_id', runIds).order('occurred_at', { ascending: true }).order('id', { ascending: true }),
      traceIds.length ? historyDb.from('orkto_audit_log').select('id,trace_id,event_type,actor_type,actor_id,conversation_id,approval_task_id,created_at')
        .eq('workspace_id', workspaceId).in('trace_id', traceIds).order('created_at', { ascending: true }).order('id', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
    ]) : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }];
    for (const result of [actionsResult, eventsResult, auditResult]) if (result.error) throw result.error;

    const actionsByRun = new Map<string, any[]>();
    for (const action of actionsResult.data || []) {
      const list = actionsByRun.get(action.run_id) || [];
      list.push({
        id: action.id, type: action.action_type, status: action.status, requiresApproval: Boolean(action.requires_approval),
        approvedBy: action.approved_by || null, approvedAt: action.approved_at || null, executedAt: action.executed_at || null,
        createdAt: action.created_at, updatedAt: action.updated_at,
        approvalPath: action.status === 'awaiting_approval' ? `/api/wia/actions/${action.id}/approve` : null,
      });
      actionsByRun.set(action.run_id, list);
    }
    const eventsByRun = new Map<string, any[]>();
    for (const event of eventsResult.data || []) {
      const list = eventsByRun.get(event.run_id) || [];
      list.push({
        id: event.id, type: event.event_type, source: event.source, actorUserId: event.actor_user_id || null,
        target: event.entity_type ? { type: event.entity_type, id: isUuid(event.entity_ref) ? event.entity_ref : null } : null,
        occurredAt: event.occurred_at,
      });
      eventsByRun.set(event.run_id, list);
    }
    const auditByTrace = new Map<string, any[]>();
    for (const event of auditResult.data || []) {
      const list = auditByTrace.get(event.trace_id) || [];
      list.push({
        id: event.id, type: event.event_type, actorType: event.actor_type,
        actorId: isUuid(event.actor_id) ? event.actor_id : null,
        target: event.conversation_id ? { type: 'conversation', id: event.conversation_id } : null,
        approvalId: event.approval_task_id || null, occurredAt: event.created_at,
      });
      auditByTrace.set(event.trace_id, list);
    }
    const data = runs.map(run => ({
      id: run.id, traceId: run.trace_id, feature: run.feature, agent: run.agent || null, taskClass: run.task_type || null,
      status: run.status, provider: run.provider || null, model: run.model || null, actorUserId: run.user_id || null,
      startedAt: run.started_at, completedAt: run.completed_at || null,
      summary: run.status === 'succeeded' ? 'Execução concluída.' : run.status === 'failed' ? 'Execução falhou.' : run.status === 'cancelled' ? 'Execução cancelada.' : 'Execução em andamento.',
      actions: actionsByRun.get(run.id) || [], events: [...(eventsByRun.get(run.id) || []), ...(auditByTrace.get(run.trace_id) || [])],
    }));
    const last = runs.at(-1);
    return res.json({ data, page: { limit, nextCursor: hasMore && last ? encodeWiaHistoryCursor({ startedAt: last.started_at, id: last.id }) : null } });
  } catch (error) {
    const code = (error as { code?: string })?.code || 'unknown';
    console.error('[WIA] audit_history_unavailable', { workspaceId, code });
    return res.status(503).json({ error: 'Não foi possível recuperar o histórico operacional.', category: code === '42P01' || code === 'PGRST205' ? 'schema_not_applied' : 'persistence_unavailable' });
  }
});

app.put('/api/profile', authenticate, async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Banco de dados indisponível.' });
  if (requireTenantContext(req).role !== 'owner') {
    return res.status(403).json({ error: 'Somente o proprietário pode alterar o perfil da empresa.', category: 'permission_denied' });
  }
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Dados da empresa inválidos.' });
  }
  try {
    const profile = parsed.data;
    if (profile.onboarding_completed !== true) {
      return res.status(400).json({ error:'É necessário confirmar a conclusão da configuração.' });
    }
    const input = onboardingInput.safeParse({
      companyName:profile.company_name,
      taxId:profile.tax_id,
      whatsappNumber:profile.whatsapp_number || '',
      whatsappTemplate:profile.whatsapp_template,
      companyLogo:profile.company_logo,
      address:profile.address,
      paymentInfo:profile.payment_info,
      profession:profile.profession,
      brandName:profile.brand_name,
      brandTone:profile.brand_tone,
      quoteColor:profile.quote_color,
    });
    if (!input.success) return res.status(400).json({ error:'Dados da empresa inválidos.' });
    const result = await invokeCoreMutation(req,res,
      {id:requireTenantContext(req).workspaceId},'COMPLETE_ONBOARDING',input.data);
    if (!result) return;
    return res.json({ success:true,id:result.profile?.id });
  } catch (error) {
    console.error(`[ERRO] ${req.method} ${req.path}:`, error);
    return res.status(500).json({ error: 'Não foi possível salvar os dados da empresa.' });
  }
});

// ===== Protected quote routes =====
const ALLOWED_UPDATE_FIELDS = new Set([
  'client_name', 'client_phone', 'client_email', 'client_company', 'customer_id', 'deal_id',
  'client_vehicle_or_service', 'notes', 'items', 'subtotal',
  'discount_total', 'taxes', 'total', 'valid_value_days',
  'payment_instructions', 'status',
]);

const FIELD_MAP_CAMEL_TO_SNAKE = {
  quoteNumber: 'quote_number', clientName: 'client_name', clientPhone: 'client_phone',
  clientEmail: 'client_email', clientCompany: 'client_company', clientVehicleOrService: 'client_vehicle_or_service',
  customerId: 'customer_id', dealId: 'deal_id',
  notes: 'notes', items: 'items', subtotal: 'subtotal', discountTotal: 'discount_total',
  taxes: 'taxes', total: 'total', validValueDays: 'valid_value_days', paymentInstructions: 'payment_instructions',
  status: 'status',
};

const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

function calculateQuoteMoney(rawItems, rawTaxes = 0) {
  if (!Array.isArray(rawItems) || rawItems.length === 0 || rawItems.length > 100) {
    throw new Error('Inclua entre 1 e 100 itens válidos no orçamento.');
  }

  let subtotal = 0;
  let discountTotal = 0;
  const items = rawItems.map((rawItem, index) => {
    const name = String(rawItem?.name || '').trim();
    const description = String(rawItem?.description || '').trim();
    const quantity = Number(rawItem?.quantity);
    const unitPrice = Number(rawItem?.unitPrice);
    const discount = Number(rawItem?.discount || 0);

    if (!name || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0 || !Number.isFinite(discount) || discount < 0 || discount > 100) {
      throw new Error(`Revise os dados do item ${index + 1}.`);
    }

    const itemSubtotal = roundMoney(quantity * unitPrice);
    const itemDiscount = roundMoney(itemSubtotal * discount / 100);
    subtotal += itemSubtotal;
    discountTotal += itemDiscount;

    return {
      id: String(rawItem?.id || crypto.randomUUID()),
      ...(rawItem?.catalogItemId || rawItem?.serviceId || rawItem?.catalog_item_id ? { catalogItemId: String(rawItem.catalogItemId || rawItem.serviceId || rawItem.catalog_item_id) } : {}),
      name: name.slice(0, 160),
      description: description.slice(0, 2000),
      quantity,
      unitPrice: roundMoney(unitPrice),
      discount: roundMoney(discount),
    };
  });

  const taxes = Number(rawTaxes || 0);
  if (!Number.isFinite(taxes) || taxes < 0) throw new Error('Taxas devem ser um valor positivo.');

  return {
    items,
    subtotal: roundMoney(subtotal),
    discount_total: roundMoney(discountTotal),
    taxes: roundMoney(taxes),
    total: roundMoney(subtotal - discountTotal + taxes),
  };
}

async function normalizeQuoteCatalogItems(workspaceId, rawItems) {
  if (!Array.isArray(rawItems)) return rawItems;
  const catalogIds = [...new Set(rawItems.map(item => item?.catalogItemId || item?.serviceId || item?.catalog_item_id).filter(value => typeof value === 'string' && value.trim()).map(value => value.trim()))];
  if (!catalogIds.length) return rawItems;
  const { data, error } = await supabase.from('services').select('id,name,description,unit_price')
    .eq('workspace_id', workspaceId).in('id', catalogIds).is('archived_at', null);
  if (error) throw error;
  const catalog = new Map((data || []).map(service => [service.id, service]));
  return rawItems.map((item, index) => {
    const catalogId = item?.catalogItemId || item?.serviceId || item?.catalog_item_id;
    if (!catalogId) return item;
    const service = catalog.get(String(catalogId).trim());
    if (!service) throw new Error(`O item de catálogo ${index + 1} não pertence a este workspace ou está arquivado.`);
    return {
      ...item,
      catalogItemId: service.id,
      name: service.name,
      description: String(item.description || service.description || ''),
      // Catalog-linked lines always use the current server-side price.
      unitPrice: Number(service.unit_price),
    };
  });
}

async function validateQuoteRelations(workspaceId: string, input: Record<string, any>, prior: Record<string, any> = {}) {
  const phone = String(input.clientPhone ?? input.client_phone ?? prior.client_phone ?? '').trim();
  const phoneChanged = input.clientPhone !== undefined || input.client_phone !== undefined;
  const rawCustomerId = input.customerId ?? input.customer_id ?? (phoneChanged ? null : prior.customer_id) ?? null;
  const rawDealId = input.dealId ?? input.deal_id ?? prior.deal_id ?? null;
  let customer = null;
  if (rawCustomerId) {
    const { data, error } = await supabase.from('clients').select('id,phone').eq('workspace_id', workspaceId).eq('id', rawCustomerId).is('archived_at', null).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('O cliente informado não pertence a este workspace ou está arquivado.');
    if (phone && data.phone !== phone) throw new Error('O telefone informado não corresponde ao cliente selecionado.');
    customer = data;
  } else if (phone) {
    const { data, error } = await supabase.from('clients').select('id,phone').eq('workspace_id', workspaceId).eq('phone', phone).is('archived_at', null).limit(1).maybeSingle();
    if (error) throw error;
    customer = data || null;
  }
  let deal = null;
  if (rawDealId) {
    const { data, error } = await supabase.from('orkto_deals').select('id,customer_ref,status').eq('workspace_id', workspaceId).eq('id', rawDealId).neq('status', 'archived').maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('O negócio informado não pertence a este workspace ou está arquivado.');
    deal = data;
  }
  if (deal?.customer_ref && customer && ![customer.id, customer.phone].includes(deal.customer_ref)) {
    throw new Error('O cliente e o negócio da proposta não correspondem.');
  }
  return { customer_id: customer?.id || null, deal_id: deal?.id || null };
}

async function recordCoreEvent(workspaceId, userId, eventType, entityType, entityRef, payload = {}, source = 'user') {
  const { error } = await supabase.from('orkto_wia_events').insert({
    workspace_id: workspaceId, actor_user_id: userId || null, event_type: eventType, source,
    entity_type: entityType, entity_ref: String(entityRef), payload,
  });
  if (error) throw error;
}

async function cancelQuoteRecovery(workspaceId, quoteId, userId, reason) {
  const now = new Date().toISOString();
  const [jobs, actions] = await Promise.all([
    supabase.from('orkto_automation_jobs').update({ status:'cancelled', updated_at:now }).eq('workspace_id',workspaceId).eq('entity_type','quote').eq('entity_ref',quoteId).eq('status','scheduled').select('id'),
    supabase.from('orkto_wia_actions').update({ status:'cancelled', updated_at:now }).eq('workspace_id',workspaceId).eq('action_type','send_proposal_followup').in('status',['prepared','awaiting_approval']).contains('payload',{ quoteId }).select('id'),
  ]);
  if (jobs.error) throw jobs.error;
  if (actions.error) throw actions.error;
  const cancelledJobs = jobs.data?.length || 0;
  const cancelledActions = actions.data?.length || 0;
  if (cancelledJobs || cancelledActions) {
    await recordCoreEvent(workspaceId,userId,'proposal_recovery.cancelled','quote',quoteId,{ reason,cancelled_jobs:cancelledJobs,cancelled_actions:cancelledActions });
  }
  return { cancelledJobs,cancelledActions };
}

async function nextProposalVersion(quoteId, workspaceId) {
  const { data, error } = await supabase.from('proposals').select('version').eq('workspace_id', workspaceId)
    .eq('quote_id', quoteId).order('version', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return Number(data?.version || 0) + 1;
}

function makeQuoteNumber() {
  const now = new Date();
  const date = now.toISOString().slice(2, 10).replace(/-/g, '');
  const suffix = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `${date}-${suffix}`;
}

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]!));
}

if (supabase && supabaseClient) {
  app.get("/api/quotes/list", authenticate, async (req, res) => {
    try {
      const offset = Math.max(0, Number.parseInt(String(req.query.offset || '0'), 10) || 0);
      const limit = Math.min(500, Math.max(1, Number.parseInt(String(req.query.limit || '250'), 10) || 250));
      const tenantContext = requireTenantContext(req);
      const { data, error } = await supabase.from('quotes').select().eq('workspace_id', tenantContext.workspaceId).is('archived_at', null).or(`retention_expires_at.is.null,retention_expires_at.gt.${new Date().toISOString()}`).order('created_at', { ascending: false }).range(offset, offset + limit - 1);
      if (error) throw error;
      res.json(data);
    } catch (error) {
      console.error(`[ERRO] ${req.method} ${req.path}:`, error);
      const message = error instanceof Error ? error.message : '';
      const invalidInput = /item|taxas|cliente|neg[oó]cio|workspace|correspondem|arquivado|telefone informado/i.test(message);
      res.status(invalidInput ? 400 : 500).json({ error: invalidInput ? message : 'Erro interno do servidor. Tente novamente.' });
    }
  });

  app.post("/api/quotes", authenticate, async (req, res) => {
    try {
      const body = req.body;
      const tenantContext = requireTenantContext(req);
      const input = quoteCreateInput.safeParse({
          clientName:body.clientName ?? body.client_name,clientPhone:body.clientPhone ?? body.client_phone,
          clientEmail:body.clientEmail ?? body.client_email,clientCompany:body.clientCompany ?? body.client_company,
          clientVehicleOrService:body.clientVehicleOrService ?? body.client_vehicle_or_service,
          customerId:body.customerId || body.customer_id || undefined,dealId:body.dealId || body.deal_id || undefined,
          notes:body.notes,items:Array.isArray(body.items) ? body.items.map((item:any)=>({
            id:item?.id,catalogItemId:item?.catalogItemId || item?.serviceId || item?.catalog_item_id || undefined,
            name:item?.name,description:item?.description,quantity:item?.quantity,unitPrice:item?.unitPrice,discount:item?.discount,
          })) : body.items,
          taxes:body.taxes,validValueDays:body.validValueDays ?? body.valid_value_days,
          paymentInstructions:body.paymentInstructions ?? body.payment_instructions,
        });
        if (!input.success) return res.status(400).json({ error:'Dados da proposta inválidos.', category:'validation_failed' });
        const result = await invokeCoreMutation(req,res,{id:tenantContext.workspaceId},'CREATE_QUOTE',input.data);
        if (result) res.status(result.result==='REPLAY' ? 200 : 201).json(result.quote);
        return;
    } catch (error) {
      logStructured('error', 'quote.create_failed', { requestId: req.requestId, errorCode: safeRouteErrorCode(error) });
      const message = error instanceof Error ? error.message : '';
      const invalidInput = /item|taxas|cliente|neg[oó]cio|workspace|correspondem|arquivado|telefone informado/i.test(message);
      res.status(invalidInput ? 400 : 500).json({ error: invalidInput ? 'Dados da proposta inválidos.' : 'Erro interno do servidor. Tente novamente.' });
    }
  });

  app.get("/api/quotes/detail/:quoteId", authenticate, async (req, res) => {
    try {
      const { quoteId } = req.params;
      const tenantContext = requireTenantContext(req);
      const { data, error } = await supabase.from('quotes').select().eq('id', quoteId).eq('workspace_id', tenantContext.workspaceId).is('archived_at', null).maybeSingle();
      if (error || !data) return res.status(404).json({ error: 'Orçamento não encontrado' });
      if (data.retention_expires_at && new Date(data.retention_expires_at).getTime() <= Date.now()) return res.status(410).json({ error: 'Orçamento expirado e indisponível.' });
      const entities = [{type:'quote',ref:String(data.id)}, ...(data.customer_id ? [{type:'customer',ref:String(data.customer_id)}] : []), ...(data.deal_id ? [{type:'deal',ref:String(data.deal_id)}] : [])];
      const contextualMemories = await loadContextualMemories(supabase,tenantContext.workspaceId,entities,6);
      res.json({ ...data, contextual_memories:contextualMemories });
    } catch (error) {
      console.error(`[ERRO] ${req.method} ${req.path}:`, error);
      res.status(500).json({ error: 'Erro interno do servidor. Tente novamente.' });
    }
  });

  app.put("/api/quotes/:quoteId", authenticate, async (req, res) => {
    try {
      const { quoteId } = req.params;
      const tenantContext = requireTenantContext(req);
      const body = req.body;
        if (!body || typeof body !== 'object' || Array.isArray(body))
          return res.status(400).json({error:'Dados da proposta inválidos.',category:'validation_failed'});
        const fields = ['clientName','clientPhone','clientEmail','clientCompany','clientVehicleOrService',
          'customerId','dealId','notes','items','taxes','validValueDays','paymentInstructions'] as const;
        const columns:Record<string,string> = {clientName:'client_name',clientPhone:'client_phone',
          clientEmail:'client_email',clientCompany:'client_company',clientVehicleOrService:'client_vehicle_or_service',
          customerId:'customer_id',dealId:'deal_id',validValueDays:'valid_value_days',
          paymentInstructions:'payment_instructions'};
        const changes:Record<string,unknown> = {};
        for (const field of fields) {
          const value = body[field] !== undefined ? body[field] : body[columns[field] || field];
          if (value !== undefined) changes[field] = value;
        }
        if (!Object.keys(changes).length)
          return res.status(400).json({error:'Nenhum campo válido para atualização',category:'validation_failed'});
        const result = await invokeCoreMutation(req,res,{id:tenantContext.workspaceId},'UPDATE_QUOTE',
          {quoteId,changes,...(body.status !== undefined ? {status:body.status} : {})});
        if (result) res.json(result.quote);
        return;
    } catch (error) {
      logStructured('error', 'quote.update_failed', { requestId: req.requestId, errorCode: safeRouteErrorCode(error) });
      const message = error instanceof Error ? error.message : '';
      const invalidInput = /item|taxas|cliente|neg[oó]cio|workspace|correspondem|arquivado|telefone informado/i.test(message);
      res.status(invalidInput ? 400 : 500).json({ error: invalidInput ? 'Dados da proposta inválidos.' : 'Erro interno do servidor. Tente novamente.' });
    }
  });

  app.delete("/api/quotes/:quoteId", authenticate, async (req, res) => {
    try {
      const { quoteId } = req.params;
      const tenantContext = requireTenantContext(req);
      const result = await invokeCoreMutation(req,res,{id:tenantContext.workspaceId},'ARCHIVE_QUOTE',{quoteId});
      if (!result) return;
      res.json({ success: true });
    } catch (error) {
      logStructured('error','quote.archive_failed',{requestId:req.requestId,errorCode:safeRouteErrorCode(error)});
      res.status(500).json({ error: 'Erro interno do servidor. Tente novamente.' });
    }
  });
}

app.get("/api/quote/next-number", authenticate, async (req, res) => {
  res.json({ quoteNumber: makeQuoteNumber() });
});

app.get("/api/quote/public/:id", (_req, res) => {
  res.status(410).json({ error: 'Link antigo desativado. Solicite um novo link seguro da proposta.' });
});

async function getActiveProposal(slug) {
  if (!supabase) return null;
  if (!isProposalSlug(String(slug || ''))) return null;
  const { data } = await supabase.from('proposals')
    .select('id, quote_id, user_id, workspace_id, is_active, expires_at')
    .eq('slug', slug).maybeSingle();
  if (!data || !data.is_active || new Date(data.expires_at).getTime() <= Date.now()) return null;
  return data;
}

// Eight-character links remain accepted for proposals already issued. New
// links use 192 bits of entropy and a strict lowercase-hex representation.
function isProposalSlug(value: string): boolean {
  return /^[A-Za-z0-9]{8}$/.test(value) || /^[a-f0-9]{48}$/.test(value);
}

function safeRouteErrorCode(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error
    ? String((error as { code?: unknown }).code || '')
    : '';
  return /^[a-z0-9_-]{1,64}$/i.test(code) ? code : 'internal_error';
}

async function validateQuoteStatusTransition(id, workspaceId, newStatus, allowedFrom) {
  if (!supabase) return "Supabase not configured";
  const { data } = await supabase.from('quotes').select('status').eq('id', id).eq('workspace_id', workspaceId).is('archived_at', null).single();
  if (!data) return "Orçamento não encontrado";
  if (!allowedFrom.includes(data.status)) return `Orçamento já está como "${data.status}". Não é possível alterar para "${newStatus}".`;
  return null;
}

app.post("/api/proposal/:slug/approve", async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase not configured" });
  try {
    const proposal = await getActiveProposal(req.params.slug);
    if (!proposal) return res.status(410).json({ error: 'Proposta inválida ou expirada.' });
    const id = proposal.quote_id;
    const { clientName } = req.body || {};
    const validationError = await validateQuoteStatusTransition(id, proposal.workspace_id, 'approved', ['sent', 'viewed', 'pending', 'draft']);
    if (validationError) return res.status(400).json({ error: validationError });

    // Buscar dados do quote + perfil para envio de email
    const { data: quote } = await supabase.from('quotes')
      .select('id, quote_number, client_name, client_email, total, workspace_id, profiles!inner(company_name, email)')
      .eq('id', id).eq('workspace_id', proposal.workspace_id).is('archived_at', null).single();
    if (!quote) return res.status(404).json({ error: 'Orçamento não encontrado.' });

    const approvedAt = new Date().toISOString();
    const { data: transitioned, error } = await supabase.from('quotes').update({ status: 'approved', approved_at: approvedAt, updated_at: approvedAt }).eq('id', id).eq('workspace_id', proposal.workspace_id).in('status', ['sent', 'viewed', 'pending', 'draft']).select('id');
    if (error) throw error;
    if (!transitioned?.length) return res.status(409).json({ error: 'A proposta já foi atualizada.' });
    const { error: proposalUpdateError } = await supabase.from('proposals').update({ approved_at: approvedAt }).eq('id', proposal.id).eq('workspace_id', proposal.workspace_id);
    if (proposalUpdateError) throw proposalUpdateError;
    await cancelQuoteRecovery(proposal.workspace_id,id,null,'proposal_accepted');
    await recordCoreEvent(proposal.workspace_id, null, 'proposal.approved', 'proposal', proposal.id, { quote_id: id, approved_at: approvedAt }, 'system');

    // Email de confirmação ao CLIENTE
    const quoteProfile = Array.isArray(quote?.profiles) ? quote.profiles[0] : quote?.profiles;
    if (resend && quote?.client_email) {
      const companyName = quoteProfile?.company_name || 'o profissional';
      resend?.emails.send({
        from: process.env.RESEND_FROM || 'ORKTO <onboarding@resend.dev>',
        to: [quote.client_email],
        subject: `Proposta #${quote.quote_number} aprovada com sucesso!`,
        html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#111;color:#fff;border-radius:16px">
          <h2 style="color:#25D366;margin:0 0 12px">Proposta Aprovada!</h2>
          <p style="color:#aaa;font-size:14px;margin:0 0 8px">Sua proposta <strong style="color:#fff">#${escapeHtml(quote.quote_number)}</strong> foi aprovada com sucesso.</p>
          <p style="color:#aaa;font-size:14px;margin:0 0 16px">Profissional: <strong style="color:#fff">${escapeHtml(companyName)}</strong></p>
          <div style="background:#1a1a1a;border-radius:12px;padding:16px;margin:0 0 16px">
            <p style="color:#888;font-size:12px;margin:0 0 4px">Valor total</p>
            <p style="color:#FF9F1C;font-size:24px;font-weight:bold;margin:0">R$ ${Number(quote.total).toFixed(2).replace('.', ',')}</p>
          </div>
          <p style="color:#666;font-size:12px;margin:0">O profissional entrará em contato para prosseguir com o pagamento.</p>
          <p style="color:#555;font-size:11px;margin-top:20px">ORKTO — Sistema operacional de vendas</p>
        </div>`,
      }).catch(() => logStructured('error', 'proposal_approval.customer_email_failed', { requestId: req.requestId, proposalId: proposal.id }));
    }

    // Notificar o DONO da proposta
    if (resend && quoteProfile?.email) {
      resend?.emails.send({
        from: process.env.RESEND_FROM || 'ORKTO <onboarding@resend.dev>',
        to: [quoteProfile.email],
        subject: `Orçamento aprovado por ${escapeHtml(clientName || quote?.client_name || 'cliente')}!`,
        html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#111;color:#fff;border-radius:16px">
          <h2 style="color:#FF9F1C;margin:0 0 8px">Orçamento Aprovado!</h2>
          <p style="color:#aaa;font-size:14px;margin:0 0 16px"><strong style="color:#fff">${escapeHtml(clientName || quote?.client_name || 'Cliente')}</strong> acabou de aprovar o orçamento <strong style="color:#fff">#${escapeHtml(quote?.quote_number)}</strong>.</p>
          <p style="color:#555;font-size:11px;margin-top:20px">ORKTO — Sistema operacional de vendas</p>
        </div>`,
      }).catch(() => logStructured('error', 'proposal_approval.owner_email_failed', { requestId: req.requestId, proposalId: proposal.id }));
    }

    res.json({ success: true });
  } catch (error) {
    logStructured('error', 'public_proposal.approval_failed', { requestId: req.requestId, errorCode: safeRouteErrorCode(error) });
    res.status(500).json({ error: 'Erro interno do servidor. Tente novamente.' });
  }
});

app.post("/api/proposal/:slug/reject", async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase not configured" });
  try {
    const proposal = await getActiveProposal(req.params.slug);
    if (!proposal) return res.status(410).json({ error: 'Proposta inválida ou expirada.' });
    const id = proposal.quote_id;
    const validationError = await validateQuoteStatusTransition(id, proposal.workspace_id, 'rejected', ['sent', 'viewed', 'pending', 'draft']);
    if (validationError) return res.status(400).json({ error: validationError });
    const rejectedAt = new Date().toISOString();
    const { data: transitioned, error } = await supabase.from('quotes').update({ status: 'rejected', rejected_at: rejectedAt, updated_at: rejectedAt }).eq('id', id).eq('workspace_id', proposal.workspace_id).in('status', ['sent', 'viewed', 'pending', 'draft']).select('id');
    if (error) throw error;
    if (!transitioned?.length) return res.status(409).json({ error: 'A proposta já foi atualizada.' });
    const { error: proposalUpdateError } = await supabase.from('proposals').update({ is_active: false }).eq('id', proposal.id).eq('workspace_id', proposal.workspace_id);
    if (proposalUpdateError) throw proposalUpdateError;
    await cancelQuoteRecovery(proposal.workspace_id,id,null,'proposal_rejected');
    await recordCoreEvent(proposal.workspace_id, null, 'proposal.rejected', 'proposal', proposal.id, { quote_id: id, rejected_at: rejectedAt }, 'system');
    res.json({ success: true });
  } catch (error) {
    logStructured('error', 'public_proposal.rejection_failed', { requestId: req.requestId, errorCode: safeRouteErrorCode(error) });
    res.status(500).json({ error: 'Erro interno do servidor. Tente novamente.' });
  }
});

app.post("/api/auth/demo-login", async (req, res) => {
  const appEnvironment = (process.env.APP_ENV || '').trim().toLowerCase();
  const vercelEnvironment = (process.env.VERCEL_ENV || '').trim().toLowerCase();
  if (process.env.ORKTO_ENABLE_DEMO_LOGIN !== 'true' || process.env.NODE_ENV === 'production'
    || vercelEnvironment === 'production' || vercelEnvironment === 'preview' || Boolean(process.env.VERCEL)
    || appEnvironment === 'production' || appEnvironment === 'staging'
    || process.env.ASAAS_ENVIRONMENT === 'production') {
    return res.status(403).json({ error: 'Modo demo indisponível em produção. Crie uma conta.' });
  }
  const demoEmail = process.env.ORKTO_DEMO_EMAIL?.trim();
  const demoPassword = process.env.ORKTO_DEMO_PASSWORD;
  if (!demoEmail || !demoPassword) return res.status(503).json({ error: 'Conta demo não configurada neste ambiente.', category: 'configuration_required' });
  if (!supabaseClient || !supabase) return res.status(500).json({ error: "Supabase not configured" });
  try {
    const { data: sessionData, error: sessionError } = await supabaseClient.auth.signInWithPassword({ email: demoEmail, password: demoPassword });
    if (sessionError) throw sessionError;
    res.json({ session: sessionData.session });
  } catch (error: any) {
    console.error(`[ERRO] ${req.method} ${req.path}:`, error?.message || error);
    res.status(500).json({ error: 'Erro interno do servidor. Tente novamente.' });
  }
});

const waitlistSchema = z.object({
  email: z.string().email("Email inválido"),
  name: z.string().optional(), phone: z.string().optional(),
  source: z.string().default("landing_page"), referralCode: z.string().optional(),
});

app.post("/api/waitlist", async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase não configurado" });
  const parsed = waitlistSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  try {
    const { email, name, phone, source, referralCode } = parsed.data;
    const { data: existing } = await supabase.from("waitlist").select("id, status").eq("email", email).single();
    if (existing) return res.json({ success: true, message: "Email já registrado na lista", alreadyRegistered: true });
    let referredBy = null;
    if (referralCode) {
      const { data: referrer } = await supabase.from("waitlist").select("id").eq("referral_code", referralCode).single();
      referredBy = referrer?.id || null;
    }
    const { data, error } = await supabase.from("waitlist").insert([{ email, name: name || null, phone: phone || null, source, referred_by: referredBy }]).select("id, referral_code").single();
    if (error) throw error;
    res.json({ success: true, referralCode: data.referral_code });
  } catch (error) {
    console.error(`[ERRO] ${req.method} ${req.path}:`, error);
    res.status(500).json({ error: 'Erro interno do servidor. Tente novamente.' });
  }
});

app.get("/api/waitlist/count", async (_req, res) => {
  if (!supabase) return res.json({ count: 0 });
  try {
    const { count } = await supabase.from("waitlist").select("*", { count: "exact", head: true });
    res.json({ count: count || 0 });
  } catch { res.json({ count: 0 }); }
});

// ===== Asaas =====
const ASAAS_API_URL = process.env.ASAAS_ENVIRONMENT === 'production' ? 'https://api.asaas.com/v3' : 'https://api-sandbox.asaas.com/v3';

class AsaasApiError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code = 'asaas_error') {
    super(message);
    this.name = 'AsaasApiError';
    this.status = status;
    this.code = code;
  }
}

function getAsaasApiKey() {
  const key = process.env.ASAAS_API_KEY?.trim();
  if (!key) throw new AsaasApiError('Asaas API key not configured', 503, 'missing_api_key');

  const environment = process.env.ASAAS_ENVIRONMENT === 'production' ? 'production' : 'sandbox';
  const looksLikeProduction = key.includes('_prod_');
  const looksLikeSandbox = /_(hmlg|sandbox|homolog)/i.test(key);
  if ((environment === 'production' && looksLikeSandbox) || (environment === 'sandbox' && looksLikeProduction)) {
    throw new AsaasApiError('Asaas key does not match configured environment', 503, 'invalid_environment');
  }
  return key;
}

function sendAsaasError(res, error: unknown) {
  if (error instanceof AsaasApiError) {
    const configurationError = error.status === 401 || error.code === 'invalid_environment' || error.code === 'invalid_access_token' || error.code === 'missing_api_key';
    return res.status(configurationError ? 503 : error.status >= 400 && error.status < 500 ? 400 : 502).json({
      error: configurationError
        ? 'Pagamento temporariamente indisponível. A credencial segura do Asaas precisa ser atualizada.'
        : error.message,
      code: configurationError ? 'PAYMENT_PROVIDER_CONFIGURATION' : 'PAYMENT_PROVIDER_ERROR',
    });
  }
  return res.status(502).json({ error: 'Não foi possível conectar ao pagamento. Tente novamente.', code: 'PAYMENT_PROVIDER_UNAVAILABLE' });
}

function isMatchingWebhookToken(received: unknown, expected: string) {
  if (typeof received !== 'string' || received.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}

function stableWebhookJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableWebhookJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${stableWebhookJson(record[key])}`).join(',')}}`;
}

async function requestAsaas(method, path, body = null, apiKey) {
  const key = apiKey || getAsaasApiKey();
  let response;
  try {
    response = await fetch(`${ASAAS_API_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', 'access_token': key, 'User-Agent': 'orkto/1.0' },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new AsaasApiError('Falha de conexão com o Asaas.', 502, 'network_error');
  }

  const text = await response.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); }
    catch { throw new AsaasApiError('Resposta inválida do Asaas.', response.status || 502, 'invalid_response'); }
  }

  if (!response.ok) {
    const providerError = data?.errors?.[0];
    const code = String(providerError?.code || `http_${response.status}`);
    const description = String(providerError?.description || 'O Asaas recusou a solicitação.');
    console.error(`[ASAAS] ${method} ${path} status=${response.status} code=${code}`);
    throw new AsaasApiError(description, response.status, code);
  }
  return data;
}

function billingReference(userId: string, plan: string) {
  return `orkto-plan:${userId}:${plan}`;
}

function parseBillingReference(value: unknown) {
  if (typeof value !== 'string') return { userId: '', plan: '' };
  const match = /^orkto-plan:([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}):(pro|business)$/i.exec(value);
  if (match) return { userId: match[1].toLowerCase(), plan: match[2] };
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? { userId: value.toLowerCase(), plan: '' }
    : { userId: '', plan: '' };
}

app.post("/api/asaas/checkout", authenticate, (_req, res) => {
  // Public prices and automated recurring charges remain disabled until commercial approval.
  return res.status(503).json({ error:'Checkout ORKTO está desativado até aprovação comercial e configuração de billing.', category:'configuration_required' });
});

app.post("/api/asaas/webhook", async (req, res) => {
  let webhookClaim: { eventId: string; fingerprint: string; claimToken: string } | null = null;
  try {
    if (!supabase) return res.status(503).json({ error: 'Banco indisponível.' });
    const asaasSecret = process.env.ASAAS_WEBHOOK_SECRET;
    if (!asaasSecret) {
      return res.status(503).json({ error: 'Webhook não configurado com segredo de validação.' });
    }
    if (!isMatchingWebhookToken(req.headers['asaas-access-token'], asaasSecret)) {
      return res.status(401).json({ error: 'Token de webhook inválido.' });
    }
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) return res.status(400).json({ error: 'Webhook inválido.', category: 'validation_failed', requestId: req.requestId });
    const { event, payment, checkout, subscription } = body;
    const eventId = typeof body.id === 'string' ? body.id.trim() : '';
    if (typeof event !== 'string' || !event.trim() || event.length > 120 || ![payment, checkout, subscription].some(value => value && typeof value === 'object' && !Array.isArray(value))) {
      return res.status(400).json({ error: 'Webhook inválido.', category: 'validation_failed', requestId: req.requestId });
    }
    if (!eventId || eventId.length > 240) return res.status(400).json({ error: 'Webhook sem identificador de evento válido.', category: 'validation_failed', requestId: req.requestId });
    const fingerprint = crypto.createHash('sha256').update(stableWebhookJson(body)).digest('hex');
    const occurredAtCandidate = typeof body.dateCreated === 'string' ? new Date(body.dateCreated) : null;
    const occurredAt = occurredAtCandidate && Number.isFinite(occurredAtCandidate.getTime()) ? occurredAtCandidate.toISOString() : null;
    const { data: claimRows, error: claimError } = await supabase.rpc('orkto_claim_payment_webhook_event', {
      p_provider: 'asaas', p_provider_event_id: eventId, p_event_type: event.trim(),
      p_request_fingerprint: fingerprint, p_occurred_at: occurredAt,
    });
    if (claimError) throw claimError;
    const claim = Array.isArray(claimRows) ? claimRows[0] : claimRows;
    const decision = claim?.decision;
    if (decision === 'DUPLICATE') return res.json({ received: true, duplicate: true, requestId: req.requestId });
    if (decision === 'PAYLOAD_CONFLICT') return res.status(409).json({ error: 'Identificador de webhook reutilizado com conteúdo diferente.', category: 'idempotency_conflict', requestId: req.requestId });
    if (decision === 'IN_PROGRESS') return res.status(503).setHeader('retry-after', '30').json({ error: 'Webhook já está sendo processado.', category: 'processing_in_progress', requestId: req.requestId });
    if (decision === 'RETRY_LIMIT') return res.status(503).json({ error: 'Limite de tentativas de webhook atingido; reconciliação necessária.', category: 'reconciliation_required', requestId: req.requestId });
    if (!['CLAIMED', 'RETRY'].includes(decision) || typeof claim?.claim_token !== 'string') {
      return res.status(503).json({ error: 'Não foi possível reservar o processamento do webhook.', category: 'persistence_unavailable', requestId: req.requestId });
    }
    webhookClaim = { eventId, fingerprint, claimToken: claim.claim_token };

    const confirmedAt = new Date().toISOString();
    let matchedIntentQuoteId: string | null = null;
    let matchedIntentWorkspaceId: string | null = null;
    let skipPaymentMutation = false;
    let webhookCompletionStatus: 'processed' | 'ignored_stale' = 'processed';
    if ((event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_OVERDUE' || event === 'PAYMENT_DELETED')
      && payment && !payment.subscription && typeof payment.id === 'string' && payment.id.trim()) {
      const providerEventStatus = event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED'
        ? 'succeeded'
        : event === 'PAYMENT_DELETED' ? 'failed' : 'observed';
      const parsedValue = Number(payment.value);
      const amountCents = Number.isFinite(parsedValue) && parsedValue > 0 ? Math.round(parsedValue * 100) : 0;
      if (providerEventStatus === 'succeeded' && (!Number.isSafeInteger(amountCents) || amountCents <= 0)) {
        throw new Error('payment_amount_invalid');
      }
      if (amountCents > 0) {
        const eventCurrency = typeof payment.currency === 'string' ? payment.currency.trim().toUpperCase() : 'BRL';
        const intentEvent = await applyPixIntentProviderEvent(supabase, {
          provider: 'asaas', providerReference: payment.id.trim(), eventId, requestFingerprint: fingerprint,
          claimToken: webhookClaim.claimToken,
          occurredAt: occurredAt || confirmedAt, targetStatus: providerEventStatus, providerStatus: event.trim(),
          amountCents, currency: eventCurrency,
        });
        if (intentEvent.decision === 'AMOUNT_OR_CURRENCY_MISMATCH' || intentEvent.decision === 'EVENT_NOT_CLAIMED') {
          throw new Error(intentEvent.decision === 'EVENT_NOT_CLAIMED' ? 'webhook_claim_not_bound' : 'payment_amount_or_currency_mismatch');
        }
        if (providerEventStatus === 'succeeded' && intentEvent.decision === 'NOT_FOUND') {
          throw new Error('payment_intent_not_found');
        }
        if (intentEvent.decision !== 'NOT_FOUND') {
          matchedIntentQuoteId = intentEvent.quoteId;
          matchedIntentWorkspaceId = intentEvent.workspaceId;
          if (intentEvent.decision === 'STALE' || intentEvent.decision === 'TERMINAL_CONFLICT') {
            skipPaymentMutation = true;
            webhookCompletionStatus = 'ignored_stale';
          } else if (intentEvent.decision === 'NOT_READY') {
            throw new Error('payment_intent_not_ready');
          }
        }
      }
    }
    if (event === 'CHECKOUT_PAID' && checkout) {
      const { userId, plan } = parseBillingReference(checkout.externalReference);
      if (userId && ['pro', 'business'].includes(plan)) {
        const { data: profile, error: profileError } = await supabase.from('profiles').update({ active_plan: plan }).eq('id', userId).select('id').maybeSingle();
        if (profileError) throw profileError;
        if (!profile) throw new Error('Perfil da assinatura não encontrado.');
        const amount = Array.isArray(checkout.items)
          ? checkout.items.reduce((sum, item) => sum + Number(item?.value || 0) * Number(item?.quantity || 1), 0)
          : Number(checkout.value || 0);
        const { data: workspace, error: workspaceError } = await supabase.from('orkto_workspaces').select('id').eq('owner_user_id',userId).maybeSingle();
        if (workspaceError) throw workspaceError;
        if (!workspace?.id) throw new Error('Workspace de cobrança não encontrado.');
        const { error: recordError } = await supabase.from('payment_records').upsert({
          payment_id: `checkout:${checkout.id}`, user_id: userId, workspace_id:workspace.id, quote_id: null,
          amount, status: 'confirmed', confirmed_at: confirmedAt,
        }, { onConflict: 'payment_id' });
        if (recordError) throw recordError;
      }
    }
    if (!skipPaymentMutation && (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') && payment) {
      const ref = matchedIntentQuoteId;
      if (ref && !payment.subscription) {
        let quoteQuery = supabase.from('quotes').select('id,user_id,workspace_id,total,customer_id,client_phone,client_vehicle_or_service,quote_number').eq('id', ref);
        if (matchedIntentWorkspaceId) quoteQuery = quoteQuery.eq('workspace_id', matchedIntentWorkspaceId) as typeof quoteQuery;
        const { data: quote, error: quoteLookupError } = await quoteQuery.maybeSingle();
        if (quoteLookupError) throw quoteLookupError;
        if (!quote) throw new Error('Orçamento do pagamento não encontrado.');
        const receivedValue = Number(payment.value);
        const receivedCents = Number.isFinite(receivedValue) && receivedValue > 0 ? Math.round(receivedValue * 100) : 0;
        const expectedCents = Number.isFinite(Number(quote.total)) ? Math.round(Number(quote.total) * 100) : 0;
        const receivedCurrency = typeof payment.currency === 'string' ? payment.currency.trim().toUpperCase() : 'BRL';
        if (!Number.isSafeInteger(receivedCents) || receivedCents <= 0 || receivedCents !== expectedCents || receivedCurrency !== 'BRL') {
          throw new Error('payment_amount_or_currency_mismatch');
        }
        const { error: quoteError } = await supabase.from('quotes').update({ status: 'approved', approved_at: confirmedAt, updated_at: confirmedAt }).eq('id', quote.id).eq('workspace_id',quote.workspace_id);
        if (quoteError) throw quoteError;
        const { error: recordError } = await supabase.from('payment_records').upsert({
          payment_id: payment.id, user_id: quote.user_id, workspace_id:quote.workspace_id, quote_id: quote.id,
          amount: receivedValue, status: 'confirmed', confirmed_at: confirmedAt,
        }, { onConflict: 'payment_id' });
        if (recordError) throw recordError;
        let customer: any = null;
        if (quote.customer_id) {
          const {data,error}=await supabase.from('clients').select('id,phone').eq('workspace_id',quote.workspace_id).eq('id',quote.customer_id).is('archived_at',null).maybeSingle();
          if(error) throw error; customer=data;
        } else if (quote.client_phone) {
          const {data,error}=await supabase.from('clients').select('id,phone').eq('workspace_id',quote.workspace_id).eq('phone',quote.client_phone).is('archived_at',null).limit(2);
          if(error) throw error; customer=data?.length===1 ? data[0] : null;
        }
        if (customer) {
          const occurredAtCandidate = payment.paymentDate || payment.confirmedDate || confirmedAt;
          const purchasedAt = Number.isFinite(new Date(occurredAtCandidate).getTime()) ? new Date(occurredAtCandidate).toISOString() : confirmedAt;
          const {data:purchase,error:purchaseError}=await supabase.from('orkto_purchases').upsert({
            workspace_id:quote.workspace_id,customer_ref:customer.id,product_ref:null,product_name:String(quote.client_vehicle_or_service || quote.quote_number || 'Proposta aceita').slice(0,180),
            quantity:1,amount_cents:Math.round(Number(payment.value || quote.total || 0)*100),purchased_at:purchasedAt,source:'asaas_confirmed_quote',idempotency_key:`payment:${payment.id}`,
          },{onConflict:'workspace_id,idempotency_key',ignoreDuplicates:true}).select('id').maybeSingle();
          if(purchaseError) throw purchaseError;
          if(purchase?.id){
            await recordCoreEvent(quote.workspace_id,null,'purchase.confirmed','purchase',purchase.id,{quote_id:quote.id,payment_id:String(payment.id),source:'asaas_confirmed_quote'},'channel');
            const purchaseFact = buildVerifiedCommercialFact({
              workspaceId:String(quote.workspace_id),customerId:String(customer.id),factType:'confirmed_purchase',source:'asaas_confirmed_payment',sourceRef:String(purchase.id),
              facts:{ productName:String(quote.client_vehicle_or_service || quote.quote_number || 'Proposta aceita').slice(0,180),amountCents:Math.round(Number(payment.value || quote.total || 0)*100),purchasedAt,quoteId:String(quote.id),paymentId:String(payment.id) },
            });
            if (purchaseFact) {
              try {
                const saved = await persistAutomaticMemory(supabase,purchaseFact);
                if (saved.inserted && saved.id) await recordCoreEvent(quote.workspace_id,null,'memory.commercial_fact_captured','customer',String(customer.id),{memory_id:saved.id,fact_type:'confirmed_purchase',source_ref:String(purchase.id)},'channel');
              } catch (memoryError) { console.error('[WiaOS] purchase_fact_capture_failed',{workspaceId:quote.workspace_id,code:(memoryError as {code?:string})?.code || 'persistence_error'}); }
            }
            try { await scheduleRepurchaseCandidate(supabase,{workspaceId:quote.workspace_id,customerId:String(customer.id),actorUserId:null}); }
            catch (candidateError) { console.error('[Repurchase] payment_candidate_schedule_failed',{code:(candidateError as {code?:string})?.code || 'persistence_error'}); }
          }
        }
      }
      const parsedReference = parseBillingReference(payment.externalReference);
      const userId = parsedReference.userId;
      if (userId && parsedReference.plan && payment.subscription) {
        const plan = parsedReference.plan;
        const { error: profileError } = await supabase.from('profiles').update({ active_plan: plan }).eq('id', userId);
        if (profileError) throw profileError;
        const { data: workspace, error: workspaceError } = await supabase.from('orkto_workspaces').select('id').eq('owner_user_id',userId).maybeSingle();
        if (workspaceError) throw workspaceError;
        if (!workspace?.id) throw new Error('Workspace de cobrança não encontrado.');
        const { error: recordError } = await supabase.from('payment_records').upsert({
          payment_id: payment.id, user_id: userId, workspace_id:workspace.id, quote_id: null,
          amount: Number(payment.value || 0), status: 'confirmed', confirmed_at: confirmedAt,
        }, { onConflict: 'payment_id' });
        if (recordError) throw recordError;
      }
    }
    if ((event === 'PAYMENT_OVERDUE' || event === 'PAYMENT_DELETED') && payment?.id) {
      const status = event === 'PAYMENT_OVERDUE' ? 'overdue' : 'deleted';
      // A late provider event must never downgrade an already confirmed payment.
      const { error: recordError } = await supabase.from('payment_records').update({ status }).eq('payment_id', payment.id).neq('status', 'confirmed');
      if (recordError) throw recordError;
    }
    if (event === 'SUBSCRIPTION_CANCELED' && subscription) {
      const { userId } = parseBillingReference(subscription.externalReference);
      if (userId) {
        const { error: profileError } = await supabase.from('profiles').update({ active_plan: 'free' }).eq('id', userId);
        if (profileError) throw profileError;
      }
    }

    // Preserve the legacy ledger for existing operational queries; the new
    // claim ledger is authoritative for idempotency and has a fencing token.
    const { error: legacyEventError } = await supabase.from('asaas_webhook_events').insert({ event_id: eventId, event_type: event.trim() });
    if (legacyEventError && legacyEventError.code !== '23505') throw legacyEventError;
    const { data: finalized, error: finalizeError } = await supabase.rpc('orkto_finish_payment_webhook_event', {
      p_provider: 'asaas', p_provider_event_id: eventId, p_request_fingerprint: fingerprint,
      p_claim_token: webhookClaim.claimToken, p_target_status: webhookCompletionStatus, p_error_category: null,
    });
    if (finalizeError) throw finalizeError;
    if (finalized !== true) throw new Error('webhook_claim_lost');
    webhookClaim = null;
    return res.json({ received: true, processingState: webhookCompletionStatus, requestId: req.requestId });
  } catch (error) {
    if (webhookClaim && supabase) {
      try {
        await supabase.rpc('orkto_finish_payment_webhook_event', {
          p_provider: 'asaas', p_provider_event_id: webhookClaim.eventId, p_request_fingerprint: webhookClaim.fingerprint,
          p_claim_token: webhookClaim.claimToken, p_target_status: 'failed', p_error_category: (error as { code?: string })?.code || 'processing_error',
        });
      } catch { /* Preserve the original safe response; provider retry/reconciliation remains possible. */ }
    }
    logStructured('error', 'billing.asaas_webhook_failed', {
      requestId: req.requestId, eventId: webhookClaim?.eventId || null,
      errorCode: (error as { code?: string })?.code || (error instanceof Error ? error.message : 'unknown_error'),
    });
    const errorCode = (error as { code?: string })?.code || (error instanceof Error ? error.message : 'unknown_error');
    if (errorCode === 'payment_intent_not_found') {
      return res.status(503).json({ error: 'Pagamento sem intenção durável associada; reconciliação necessária.', category: 'payment_intent_required', requestId: req.requestId });
    }
    res.status(500).json({ error: 'Erro interno do servidor. Tente novamente.', category: 'persistence_unavailable', requestId: req.requestId });
  }
});

// ===== PIX para orçamentos =====
app.post("/api/proposal/:slug/pix", (_req, res) => {
  // Public payment creation cannot be enabled until a durable quote-scoped
  // payment intent and provider reconciliation make retries idempotent.
  return res.status(503).json({ error: 'PIX temporariamente indisponível. A criação segura de cobrança ainda não está configurada.', category: 'payment_idempotency_required' });
});

// ===== Propostas (links compartilháveis) =====
function generateSlug(): string {
  return crypto.randomBytes(24).toString('hex');
}

app.post('/api/quotes/:quoteId/extend', authenticate, async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Banco indisponível' });
  if (!z.string().datetime({ offset: true }).safeParse(req.body.expectedExpiry).success) return res.status(400).json({ error: 'Atualize o orçamento antes de prorrogar.' });
  if (!await requireWritablePlan(req,res,'proposals')) return;
  const tenantContext = requireTenantContext(req);
  const { data, error } = await supabase.rpc('extend_quote_retention', { p_quote_id: req.params.quoteId, p_user_id: await workspaceOwnerUserId(tenantContext.workspaceId), p_expected_expiry: req.body.expectedExpiry });
  if (error) return res.status(400).json({ error: error.message });
  res.json({ expiresAt: data });
});

app.post("/api/proposal/generate", authenticate, async (req, res) => {
  try {
    const tenantContext = requireTenantContext(req);
    if (!await requireWritablePlan(req,res,'proposals')) return;
    const workspaceId = tenantContext.workspaceId;
    const userId = await workspaceOwnerUserId(workspaceId);
    const baseUrl = resolvePublicAppBaseUrl();
    const { quoteId } = req.body;
    if (!quoteId) return res.status(400).json({ error: "quoteId required" });
    if (!supabase) return res.status(500).json({ error: "Supabase not configured" });

    const { data: quote, error: qErr } = await supabase.from('quotes').select('id, user_id, workspace_id, archived_at').eq('id', quoteId).eq('workspace_id', workspaceId).is('archived_at', null).maybeSingle();
    if (qErr || !quote) return res.status(404).json({ error: "Orçamento não encontrado" });

    const { error: deactivateError } = await supabase.from('proposals').update({ is_active: false }).eq('quote_id', quoteId).eq('workspace_id', workspaceId).eq('is_active', true);
    if (deactivateError) throw deactivateError;
    const version = await nextProposalVersion(quoteId, workspaceId);

    let slug = generateSlug();
    let attempts = 0;
    while (attempts < 10) {
      const { data: existing } = await supabase.from('proposals').select('id').eq('slug', slug).maybeSingle();
      if (!existing) break;
      slug = generateSlug();
      attempts++;
    }

    const { data: proposal, error: pErr } = await supabase.from('proposals').insert([{
      slug, quote_id: quoteId, user_id: userId, workspace_id: workspaceId, version, created_by: tenantContext.userId,
      expires_at: new Date(Date.now() + 14 * 86400000).toISOString(),
      is_active: true,
    }]).select().single();

    if (pErr) throw pErr;

    const sentAt = new Date().toISOString();
    const { error: quoteUpdateError } = await supabase.from('quotes').update({ status: 'sent', sent_at: sentAt, updated_at: sentAt }).eq('id', quoteId).eq('workspace_id', workspaceId).is('archived_at', null);
    if (quoteUpdateError) throw quoteUpdateError;
    await recordCoreEvent(workspaceId, tenantContext.userId, 'proposal.generated', 'proposal', proposal.id, { quote_id: quoteId, version });

    const link = new URL(`/p/${encodeURIComponent(slug)}`, baseUrl).toString();

    res.json({ success: true, slug, link, expiresAt: proposal.expires_at, proposalId: proposal.id, version });
  } catch (error) {
    console.error(`[ERRO] ${req.method} ${req.path}:`, error);
    res.status(500).json({ error: 'Erro ao gerar proposta. Tente novamente.' });
  }
});

const sendQuoteEmailSchema = z.object({
  quoteId: z.string().uuid(),
  to: z.string().email().max(320),
  subject: z.string().trim().min(1).max(180),
  message: z.string().trim().min(1).max(5000),
});

app.post("/api/quotes/:quoteId/email", authenticate, async (req, res) => {
  if (!resend) {
    return res.status(503).json({ error: 'Envio de e-mail ainda não configurado.' });
  }
  if (!supabase) return res.status(500).json({ error: 'Supabase não configurado.' });

  const parsed = sendQuoteEmailSchema.safeParse({ ...req.body, quoteId: req.params.quoteId });
  if (!parsed.success) return res.status(400).json({ error: 'Revise o destinatário, assunto e mensagem.' });

  try {
    const { quoteId, to, subject, message } = parsed.data;
    const tenantContext = requireTenantContext(req);
    const workspaceId = tenantContext.workspaceId;
    const ownerId = await workspaceOwnerUserId(workspaceId);
    const baseUrl = resolvePublicAppBaseUrl();
    const { data: quote, error: quoteError } = await supabase.from('quotes')
      .select('id, retention_expires_at, quote_number, client_name, client_email, client_vehicle_or_service, items, subtotal, discount_total, total, profiles!inner(company_name, company_logo, email, quote_color)')
      .eq('id', quoteId)
      .eq('workspace_id', workspaceId)
      .is('archived_at', null)
      .maybeSingle();
    if (quoteError || !quote) return res.status(404).json({ error: 'Orçamento não encontrado.' });
    if (!isQuoteEmailRecipientAuthorized(to, quote.client_email)) {
      return res.status(403).json({ error: 'O destinatário precisa ser o e-mail do cliente registrado nesta proposta.', category: 'recipient_not_authorized' });
    }

    const { error: deactivateError } = await supabase.from('proposals').update({ is_active: false }).eq('quote_id', quoteId).eq('workspace_id', workspaceId).eq('is_active', true);
    if (deactivateError) throw deactivateError;
    const slug = generateSlug();
    const expiresAt = quote.retention_expires_at || new Date(Date.now() + 14 * 86400000).toISOString();
    const version = await nextProposalVersion(quoteId, workspaceId);
    const { error: proposalError } = await supabase.from('proposals').insert([{
      slug,
      quote_id: quoteId,
      user_id: ownerId,
      workspace_id: workspaceId,
      version,
      created_by: tenantContext.userId,
      expires_at: expiresAt,
      is_active: true,
    }]);
    if (proposalError) throw proposalError;

    const { error: quoteUpdateError } = await supabase.from('quotes').update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', quoteId).eq('workspace_id', workspaceId).is('archived_at', null);
    if (quoteUpdateError) throw quoteUpdateError;
    await recordCoreEvent(workspaceId, tenantContext.userId, 'proposal.email_prepared', 'proposal', quoteId, { version, delivery: 'email' });

    const proposalLink = new URL(`/p/${encodeURIComponent(slug)}`, baseUrl).toString();
    const profile = Array.isArray(quote.profiles) ? quote.profiles[0] : quote.profiles;
    const color = /^#[0-9A-Fa-f]{6}$/.test(profile?.quote_color || '') ? profile.quote_color : '#FF9F1C';
    const items = Array.isArray(quote.items) ? quote.items : [];
    const itemRows = items.map(item => {
      const quantity = Number(item?.quantity || 0);
      const unitPrice = Number(item?.unitPrice || 0);
      const discount = Number(item?.discount || 0);
      const itemTotal = quantity * unitPrice * (1 - discount / 100);
      return `<tr><td style="padding:10px 6px;border-bottom:1px solid #eee"><strong>${escapeHtml(item?.name)}</strong></td><td style="padding:10px 6px;border-bottom:1px solid #eee;text-align:center">${quantity}</td><td style="padding:10px 6px;border-bottom:1px solid #eee;text-align:right">${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(itemTotal)}</td></tr>`;
    }).join('');

    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM || 'ORKTO <onboarding@resend.dev>',
      to: [to],
      replyTo: profile?.email || undefined,
      subject,
      html: `<div style="font-family:Arial,sans-serif;background:#f5f5f5;padding:28px 12px;color:#18181b"><div style="max-width:600px;margin:auto;background:#fff;border:1px solid #e4e4e7;border-radius:16px;overflow:hidden"><div style="height:6px;background:${color}"></div><div style="padding:28px"><h1 style="font-size:20px;margin:0 0 6px">${escapeHtml(profile?.company_name || 'ORKTO')}</h1><p style="color:#71717a;margin:0 0 24px">Proposta #${escapeHtml(quote.quote_number)}</p><div style="white-space:pre-line;line-height:1.6;background:#fafafa;border-left:3px solid ${color};padding:16px;margin-bottom:24px">${escapeHtml(message)}</div><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr><th style="text-align:left;padding:8px 6px">Item</th><th style="text-align:center;padding:8px 6px">Qtd.</th><th style="text-align:right;padding:8px 6px">Total</th></tr></thead><tbody>${itemRows}</tbody></table><p style="font-size:20px;font-weight:bold;text-align:right;margin:22px 0">Total: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(quote.total))}</p><p style="text-align:center;margin:28px 0"><a href="${proposalLink}" style="display:inline-block;background:#10b981;color:white;text-decoration:none;padding:14px 22px;border-radius:10px;font-weight:bold">Visualizar e aprovar proposta</a></p><p style="font-size:11px;color:#a1a1aa;text-align:center">Enviado com segurança pela ORKTO.</p></div></div></div>`,
    });
    if (error) throw new Error(error.message);
    res.json({ success: true, id: data?.id, proposalLink, expiresAt });
  } catch (error) {
    console.error(`[ERRO] ${req.method} ${req.path}:`, error);
    res.status(502).json({ error: 'Não foi possível enviar o e-mail agora.' });
  }
});

app.get("/api/proposal/:slug", async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const { slug } = req.params;
    if (!isProposalSlug(slug)) return res.status(404).json({ error: 'Proposta não encontrada.' });
    if (!supabase) return res.status(500).json({ error: "Supabase not configured" });

    const { data: proposal, error: pErr } = await supabase.from('proposals')
      .select('id, slug, quote_id, workspace_id, version, is_active, expires_at, viewed_at, approved_at, created_at')
      .eq('slug', slug).maybeSingle();

    if (pErr || !proposal) return res.status(404).json({ error: "Proposta não encontrada" });
    if (!proposal.is_active || new Date(proposal.expires_at) < new Date()) {
      return res.status(410).json({ error: "Proposta expirada", expired: true });
    }

    // Buscar dados do orçamento + perfil do profissional
    const { data: quote, error: qErr } = await supabase.from('quotes')
      .select('id, quote_number, client_name, client_phone, client_email, client_vehicle_or_service, notes, items, subtotal, discount_total, taxes, total, valid_value_days, payment_instructions, status, profiles!inner(company_name, company_logo, address, whatsapp_number, quote_color, brand_name)')
      .eq('id', proposal.quote_id).eq('workspace_id',proposal.workspace_id).is('archived_at', null).single();

    if (qErr || !quote) return res.status(404).json({ error: "Orçamento não encontrado" });

    // This is a bearer-token public route. Return only fields rendered by the
    // page; never expose tenant IDs, internal proposal/quote IDs, or customer
    // contact details through the share link.
    res.json({
      proposal: { expires_at: proposal.expires_at },
      quote: {
        quote_number: quote.quote_number,
        client_vehicle_or_service: quote.client_vehicle_or_service,
        notes: quote.notes,
        items: quote.items,
        subtotal: quote.subtotal,
        discount_total: quote.discount_total,
        taxes: quote.taxes,
        total: quote.total,
        valid_value_days: quote.valid_value_days,
        payment_instructions: quote.payment_instructions,
        status: quote.status,
        profiles: quote.profiles,
      },
    });
  } catch (error) {
    logStructured('error', 'public_proposal.read_failed', { requestId: req.requestId, errorCode: safeRouteErrorCode(error) });
    res.status(500).json({ error: 'Erro ao buscar proposta.' });
  }
});

app.post("/api/proposal/:slug/viewed", async (req, res) => {
  try {
    const { slug } = req.params;
    if (!isProposalSlug(slug)) return res.status(404).json({ error: 'Proposta não encontrada.' });
    if (!supabase) return res.status(500).json({ error: "Supabase not configured" });

    const { data: proposal } = await supabase.from('proposals').select('id, quote_id, workspace_id, viewed_at, is_active, expires_at').eq('slug', slug).maybeSingle();
    if (!proposal) return res.status(404).json({ error: "Proposta não encontrada" });
    if (!proposal.is_active || new Date(proposal.expires_at).getTime() <= Date.now()) return res.status(410).json({ error: 'Proposta expirada' });

    if (!proposal.viewed_at) {
      const viewedAt = new Date().toISOString();
      const { error: proposalError } = await supabase.from('proposals').update({ viewed_at: viewedAt }).eq('id', proposal.id).eq('workspace_id', proposal.workspace_id);
      if (proposalError) throw proposalError;
      const { error: quoteError } = await supabase.from('quotes').update({ status: 'viewed', viewed_at: viewedAt, updated_at: viewedAt })
        .eq('id', proposal.quote_id).eq('workspace_id',proposal.workspace_id).eq('status', 'sent').is('archived_at', null);
      if (quoteError) throw quoteError;
      await recordCoreEvent(proposal.workspace_id, null, 'proposal.viewed', 'proposal', proposal.id, { quote_id: proposal.quote_id, viewed_at: viewedAt }, 'system');
    }

    res.json({ success: true });
  } catch (error) {
    logStructured('error', 'public_proposal.view_tracking_failed', { requestId: req.requestId, errorCode: safeRouteErrorCode(error) });
    res.status(500).json({ error: 'Erro interno.' });
  }
});

app.post("/api/proposal/:slug/refresh", authenticate, async (req, res) => {
  try {
    const tenantContext = requireTenantContext(req);
    const workspaceId = tenantContext.workspaceId;
    const { slug } = req.params;
    if (!supabase) return res.status(500).json({ error: "Supabase not configured" });
    const ownerId = await workspaceOwnerUserId(workspaceId);
    const baseUrl = resolvePublicAppBaseUrl();

    const { data: proposal } = await supabase.from('proposals')
      .select('id, user_id, quote_id, version').eq('slug', slug).eq('workspace_id', workspaceId).maybeSingle();
    if (!proposal) return res.status(404).json({ error: "Proposta não encontrada" });

    // Invalidar antiga
    const { error: deactivateError } = await supabase.from('proposals').update({ is_active: false }).eq('id', proposal.id).eq('workspace_id', workspaceId).eq('is_active', true);
    if (deactivateError) throw deactivateError;

    // Gerar novo slug
    let newSlug = generateSlug();
    let attempts = 0;
    while (attempts < 10) {
      const { data: existing } = await supabase.from('proposals').select('id').eq('slug', newSlug).maybeSingle();
      if (!existing) break;
      newSlug = generateSlug();
      attempts++;
    }

    const { data: newProposal, error: pErr } = await supabase.from('proposals').insert([{
      slug: newSlug, quote_id: proposal.quote_id, user_id: ownerId, workspace_id: workspaceId, version: await nextProposalVersion(proposal.quote_id, workspaceId), created_by: tenantContext.userId,
      expires_at: new Date(Date.now() + 14 * 86400000).toISOString(),
      is_active: true,
    }]).select().single();

    if (pErr) throw pErr;
    await recordCoreEvent(workspaceId, tenantContext.userId, 'proposal.version_refreshed', 'proposal', newProposal.id, { previous_proposal_id: proposal.id, quote_id: proposal.quote_id, version: newProposal.version });

    res.json({ success: true, slug: newSlug, link: new URL(`/p/${encodeURIComponent(newSlug)}`, baseUrl).toString(), expiresAt: newProposal.expires_at });
  } catch (error) {
    console.error(`[ERRO] ${req.method} ${req.path}:`, error);
    res.status(500).json({ error: 'Erro ao regenerar proposta.' });
  }
});

// ============================================================
// ORKTO Swarm - Onda 0/1: Conversations, Inbox, Approval Tasks
// ============================================================

// GET /api/conversations
app.get("/api/conversations", authenticate, async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Inbox indisponível: configure a persistência Supabase antes de usar este módulo.', category: 'configuration_error' });
  try {
    const workspaceId = requireTenantContext(req).workspaceId;
    const { data: conversations, error: conversationsError } = await supabase
      .from('orkto_conversations').select('*').eq('workspace_id', workspaceId).order('updated_at', { ascending: false });
    if (conversationsError) throw conversationsError;

    const enriched = await Promise.all((conversations || []).map(async (conv) => {
      const { data: messages, error: messagesError } = await supabase
        .from('orkto_messages').select('*').eq('workspace_id',workspaceId).eq('conversation_id', conv.id).order('sent_at', { ascending: true });
      if (messagesError) throw messagesError;

      const lastMessage = messages?.[messages.length - 1];
      const unreadCount = (messages || []).filter(m => m.direction === 'incoming' && !m.read_at).length;

      return {
        id: conv.id,
        customer_id: conv.customer_id || null,
        deal_id: conv.deal_id || null,
        contact_name: conv.contact_name,
        contact_phone: conv.contact_phone,
        status: conv.status,
        source_channel: conv.source_channel,
        mood_state: conv.mood_state,
        last_message: lastMessage?.content?.slice(0, 100) || '',
        last_message_at: lastMessage?.sent_at || conv.created_at,
        unread_count: unreadCount,
        message_count: messages?.length || 0,
        created_at: conv.created_at,
        updated_at: conv.updated_at,
      };
    }));

    res.json(enriched);
  } catch (error) {
    console.error(`[ERRO] ${req.method} ${req.path}:`, error);
    res.status(500).json({ error: 'Erro ao carregar conversas.' });
  }
});

// GET /api/conversations/:id
app.get("/api/conversations/:conversationId", authenticate, async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Inbox indisponível: configure a persistência Supabase antes de usar este módulo.', category: 'configuration_error' });
  try {
    const workspaceId = requireTenantContext(req).workspaceId;
    const { conversationId } = req.params;

    const { data: conversation, error: conversationError } = await supabase
      .from('orkto_conversations').select('*').eq('id', conversationId).eq('workspace_id', workspaceId).maybeSingle();
    if (conversationError) throw conversationError;

    if (!conversation) {
      return res.status(404).json({ error: 'Conversa não encontrada' });
    }

    const { data: messages, error: messagesError } = await supabase
      .from('orkto_messages').select('*').eq('workspace_id',workspaceId).eq('conversation_id', conversationId).order('sent_at', { ascending: true });
    if (messagesError) throw messagesError;

    const { data: approvalTasks, error: approvalError } = await supabase
      .from('orkto_approval_tasks').select('*').eq('workspace_id',workspaceId).eq('conversation_id', conversationId).order('created_at', { ascending: true });
    if (approvalError) throw approvalError;

    const memoryEntities = [{ type:'conversation',ref:String(conversation.id) }, ...(conversation.customer_id ? [{type:'customer',ref:String(conversation.customer_id)}] : []), ...(conversation.deal_id ? [{type:'deal',ref:String(conversation.deal_id)}] : [])];
    const contextualMemories = await loadContextualMemories(supabase,workspaceId,memoryEntities,8);

    res.json({ ...conversation, messages: messages || [], approval_tasks: approvalTasks || [], contextual_memories:contextualMemories });
  } catch (error) {
    console.error(`[ERRO] ${req.method} ${req.path}:`, error);
    res.status(500).json({ error: 'Erro ao carregar conversa.' });
  }
});

app.get('/api/conversations/:conversationId/messages', authenticate, async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Mensagens indisponíveis sem persistência configurada.', category: 'configuration_error' });
  try {
    const workspaceId = requireTenantContext(req).workspaceId;
    const { data: conversation, error: conversationError } = await supabase.from('orkto_conversations').select('id')
      .eq('id', req.params.conversationId).eq('workspace_id', workspaceId).maybeSingle();
    if (conversationError) throw conversationError;
    if (!conversation) return res.status(404).json({ error: 'Conversa não encontrada.' });
    const { data, error } = await supabase.from('orkto_messages').select('*').eq('workspace_id', workspaceId)
      .eq('conversation_id', conversation.id).order('sent_at', { ascending: true }).limit(1000);
    if (error) throw error;
    res.json({ data: data || [] });
  } catch (error) {
    console.error(`[ERRO] ${req.method} ${req.path}:`, error);
    res.status(500).json({ error: 'Não foi possível carregar as mensagens.' });
  }
});

app.post('/api/conversations/:conversationId/read', authenticate, async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Inbox indisponível sem persistência configurada.', category: 'configuration_error' });
  try {
    const tenant = requireTenantContext(req);
    const result = await invokeCoreMutation(req,res,{id:tenant.workspaceId},'MARK_CONVERSATION_READ',{
        conversationId:req.params.conversationId,
      });
      if (result) res.json({ success:true,messagesMarkedRead:result.messages_marked_read || 0,
        idempotentReplay:result.result === 'REPLAY' });
      return;
  } catch (error) {
    console.error(`[ERRO] ${req.method} ${req.path}:`, error);
    res.status(500).json({ error: 'Não foi possível marcar a conversa como lida.' });
  }
});

app.patch('/api/conversations/:conversationId', authenticate, async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Inbox indisponível sem persistência configurada.', category: 'configuration_error' });
  const parsed = z.object({ status: z.enum(['open','active','paused','closed','archived']) }).strict().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Estado da conversa inválido.' });
  try {
    const tenant = requireTenantContext(req);
    const result = await invokeCoreMutation(req,res,{id:tenant.workspaceId},'SET_CONVERSATION_STATUS',{
        conversationId:req.params.conversationId,status:parsed.data.status,
      });
      if (result) res.json({ data:result.conversation,idempotentReplay:result.result === 'REPLAY' });
      return;
  } catch (error) {
    console.error(`[ERRO] ${req.method} ${req.path}:`, error);
    res.status(500).json({ error: 'Não foi possível atualizar o estado da conversa.' });
  }
});

// GET /api/approval-tasks
app.get("/api/approval-tasks", authenticate, async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Aprovações indisponíveis sem persistência configurada.', category: 'configuration_error' });
  try {
    const workspaceId = requireTenantContext(req).workspaceId;
    const { data, error } = await supabase.from('orkto_approval_tasks')
      .select('*, orkto_conversations!orkto_approval_conversation_workspace_fkey!inner(id, workspace_id)').eq('workspace_id',workspaceId).eq('status', 'pending')
      .eq('orkto_conversations.workspace_id', workspaceId).order('created_at', { ascending: true });
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error(`[ERRO] ${req.method} ${req.path}:`, error);
    res.status(500).json({ error: 'Erro ao carregar tarefas de aprovação.' });
  }
});

// POST /api/whatsapp/webhook - Signed inbound adapter endpoint; no simulated data is accepted.
app.post("/api/whatsapp/webhook", async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Webhook indisponível sem persistência configurada.', category: 'configuration_error' });
    const webhookSecret = process.env.WHATSAPP_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return res.status(503).json({ error: 'Webhook real desabilitado. Configure WHATSAPP_WEBHOOK_SECRET.' });
    }
    const suppliedSecret = req.header('x-orkto-webhook-secret');
    if (!suppliedSecret || suppliedSecret.length !== webhookSecret.length ||
        !crypto.timingSafeEqual(Buffer.from(suppliedSecret), Buffer.from(webhookSecret))) {
      return res.status(401).json({ error: 'Assinatura do webhook inválida.' });
    }

    const tenantContext = resolveWebhookTenantContext(process.env);
    if (!tenantContext) {
      return res.status(503).json({ error: 'Webhook sem tenant configurado. Defina WHATSAPP_TENANT_ID.' });
    }

    const body = req.body;
    const workspaceId = tenantContext.workspaceId;
    const userId = await workspaceOwnerUserId(workspaceId);
    const senderNumber = body.sender_number || body.from || '';
    const content = body.content || body.text || body.message || '';
    const externalEventId = String(body.message_id || body.id || '').trim().slice(0, 240) || null;

    if (!senderNumber) {
      return res.status(400).json({ error: "Número de remetente inválido" });
    }

    const { data: customerMatches, error: customerMatchError } = await supabase.from('clients').select('id,phone')
      .eq('workspace_id', workspaceId).eq('phone', senderNumber).is('archived_at', null).limit(2);
    if (customerMatchError) throw customerMatchError;
    const matchedCustomer = customerMatches?.length === 1 ? customerMatches[0] : null;
    const dealMatches = matchedCustomer
      ? await supabase.from('orkto_deals').select('id,customer_ref').eq('workspace_id', workspaceId).eq('status', 'open').in('customer_ref', [matchedCustomer.id, senderNumber]).limit(2)
      : { data: [], error: null };
    if (dealMatches.error) throw dealMatches.error;
    const matchedDeal = dealMatches.data?.length === 1 ? dealMatches.data[0] : null;

    if (externalEventId) {
      const { data: duplicate } = await supabase.from('orkto_messages').select('id,conversation_id').eq('workspace_id',workspaceId).eq('external_event_id', externalEventId).maybeSingle();
      if (duplicate) return res.json({ received: true, duplicate: true, message_id: duplicate.id, conversation_id: duplicate.conversation_id, suggestion_status: 'already_processed' });
    }

    // Find or create conversation
    let { data: conversation, error: conversationError } = await supabase.from('orkto_conversations').select('*')
      .eq('contact_phone', senderNumber).eq('workspace_id', workspaceId).maybeSingle();
    if (conversationError) throw conversationError;
    if (!conversation) {
      const created = await supabase.from('orkto_conversations').insert({
        user_id: userId, workspace_id: workspaceId, contact_name: body.contact_name || senderNumber.slice(1) || 'Contato', contact_phone: senderNumber,
        customer_id: matchedCustomer?.id || null, deal_id: matchedDeal?.id || null,
        status: 'active', source_channel: 'whatsapp', mood_state: 'neutral',
      }).select('*').single();
      if (created.error) throw created.error;
      conversation = created.data;
    }

    // Create incoming message
    const messageId = crypto.randomUUID();
    const message: any = {
      id: messageId,
      workspace_id: workspaceId,
      conversation_id: conversation.id,
      sender_role: 'contact',
      content: content,
      message_type: 'text',
      sent_at: new Date().toISOString(),
      direction: 'incoming',
      external_event_id: externalEventId,
    };

    const { error: messageError } = await supabase.from('orkto_messages').insert(message).select().single();
    if (messageError) throw messageError;
    const { error: conversationUpdateError } = await supabase.from('orkto_conversations').update({
      customer_id: conversation.customer_id || matchedCustomer?.id || null,
      deal_id: conversation.deal_id || matchedDeal?.id || null,
      last_message_at: message.sent_at, updated_at: message.sent_at,
    }).eq('id', conversation.id).eq('workspace_id', workspaceId);
    if (conversationUpdateError) throw conversationUpdateError;
    await recordCoreEvent(workspaceId, userId, 'message.received', 'conversation', conversation.id, { message_id: messageId, channel: 'whatsapp' }, 'channel');
    const verifiedCustomerId = conversation.customer_id || matchedCustomer?.id || null;
    if (verifiedCustomerId) {
      try {
        await persistObservedMessageMemories(supabase,{workspaceId,customerId:String(verifiedCustomerId),conversationId:String(conversation.id),messageId,direction:'incoming',content:String(content),occurredAt:message.sent_at,userId});
        await persistConversationSummary(supabase,{workspaceId,customerId:String(verifiedCustomerId),conversationId:String(conversation.id),userId});
      } catch (memoryError) {
        console.error('[WiaOS] contextual_memory_capture_failed',{workspaceId,code:(memoryError as {code?:string})?.code || 'persistence_error'});
      }
    }

    // A new customer message stops stale recovery drafts/jobs for that customer.
    try {
        const normalizedContent = String(content).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
        const explicitOptOut = /^(stop|parar|cancelar|sair|remover|descadastrar)(\b|$)/.test(normalizedContent)
          || normalizedContent.includes('nao me contacte')
          || normalizedContent.includes('nao quero receber');
        if (explicitOptOut) {
          const { data: priorOptOut } = await supabase.from('orkto_customer_signals').select('id').eq('workspace_id', workspaceId).eq('customer_ref', senderNumber).eq('signal_type', 'explicit_opt_out').limit(1);
          if (!priorOptOut?.length) {
            await supabase.from('orkto_customer_signals').insert({ workspace_id: workspaceId, customer_ref: senderNumber, conversation_id: conversation.id, signal_type: 'explicit_opt_out', value: 1, provenance: { source: 'inbound_message', message_id: messageId } });
          }
        }
        const { data: relatedQuotes } = await supabase.from('quotes').select('id').eq('workspace_id', workspaceId).eq('client_phone', senderNumber).in('status', ['draft','pending','sent','viewed']).limit(50);
        for (const quote of relatedQuotes || []) {
          await supabase.from('orkto_automation_jobs').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('workspace_id', workspaceId).eq('entity_type', 'quote').eq('entity_ref', quote.id).eq('status', 'scheduled');
          const { data: cancelledActions } = await supabase.from('orkto_wia_actions').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('workspace_id', workspaceId).eq('action_type', 'send_proposal_followup').in('status',['prepared','awaiting_approval']).contains('payload', { quoteId: quote.id }).select('id');
          if ((cancelledActions?.length || 0) > 0) await recordCoreEvent(workspaceId,userId,'proposal_recovery.cancelled','quote',quote.id,{ reason:explicitOptOut ? 'customer_opt_out' : 'customer_replied',message_id:messageId },'channel');
        }
        const customerRefs = [...new Set([senderNumber,matchedCustomer?.id].filter((value): value is string => typeof value === 'string' && value.length > 0))];
        if (customerRefs.length) {
          const { data: cancelledJobs } = await supabase.from('orkto_automation_jobs').update({ status:'cancelled',updated_at:new Date().toISOString() }).eq('workspace_id',workspaceId).eq('entity_type','repurchase').in('entity_ref',customerRefs).eq('status','scheduled').select('id,entity_ref');
          for (const customerRef of customerRefs) {
            const { data: cancelledActions } = await supabase.from('orkto_wia_actions').update({ status:'cancelled',updated_at:new Date().toISOString() }).eq('workspace_id',workspaceId).eq('action_type','prepare_repurchase_followup').in('status',['prepared','awaiting_approval']).contains('payload',{ customerPhone:customerRef }).select('id');
            const cancelledForCustomer = (cancelledJobs || []).filter(job => job.entity_ref === customerRef).length;
            if (cancelledForCustomer || (cancelledActions?.length || 0) > 0) await recordCoreEvent(workspaceId,userId,'repurchase_reactivation.cancelled','customer',customerRef,{ reason:explicitOptOut ? 'customer_opt_out' : 'customer_replied',message_id:messageId,cancelled_jobs:cancelledForCustomer,cancelled_actions:cancelledActions?.length || 0 },'channel');
          }
        }
    } catch (automationError) {
      console.error('[Automation] inbound_stop_processing_unavailable', { code: (automationError as { code?: string })?.code || 'unknown' });
    }

    const traceId = crypto.randomUUID();
    try {
      const memoryEntities = [
        ...(verifiedCustomerId ? [{ type:'customer',ref:String(verifiedCustomerId) }] : []),
        { type:'conversation',ref:String(conversation.id) },
        ...(conversation.deal_id || matchedDeal?.id ? [{ type:'deal',ref:String(conversation.deal_id || matchedDeal?.id) }] : []),
      ];
      const relevantMemories = await loadContextualMemories(supabase,workspaceId,memoryEntities,8,String(content));
      const sourceIds = [`message:${messageId}`,...relevantMemories.map((memory:any)=>`memory:${memory.id}`)].slice(0,20);
      const result = await decideWithWia({
        message: String(content).slice(0, 4000),
        context: { openQuotes: 0, pendingValue: 0, clients: verifiedCustomerId ? 1 : 0, relevantMemories:relevantMemories.map((memory:any)=>({ id:memory.id,memoryType:memory.memory_type,entityType:memory.entity_type,entityRef:memory.entity_ref,content:memory.content,confidence:memory.confidence,provenance:memory.provenance })) },
        sourceIds,
        ...(wiaToolRegistry ? { toolRuntime: { registry: wiaToolRegistry, context: { tenant: tenantContext, traceId } } } : {}),
      });
      const safeResponse = prepareResponseDraft({ draft:result.decision.messageDraft,surface:'inbox',sourceRefs:sourceIds });
      if (safeResponse.status === 'blocked') {
        result.decision = { ...result.decision,action:'ask_clarification',messageDraft:'Ainda não tenho uma fonte verificada para afirmar esse valor ou condição. Posso conferir a proposta ou o catálogo antes de responder?',sourceIds:[],confidenceSignal:'low',requiresApproval:false,reasonCode:'response_policy_blocked' };
      } else {
        result.decision = { ...result.decision,messageDraft:safeResponse.draft };
      }
      const task = {
        workspace_id:workspaceId, conversation_id: conversation.id, task_type: 'response_suggestion', bot_name: 'WIA',
        proposed_content: result.decision.messageDraft, proposed_action: { action: result.decision.action, source_ids: result.decision.sourceIds },
        reason: result.decision.reasonCode, policy_applied: 'human_approval_required', status: 'pending', trace_id: traceId,
      };
      const { data: savedTask, error: taskError } = await supabase.from('orkto_approval_tasks').insert(task).select('id').single();
      if (taskError) throw taskError;
      const { error: auditError } = await supabase.from('orkto_audit_log').insert({ user_id: userId, workspace_id:workspaceId, conversation_id: conversation.id, approval_task_id: savedTask.id, event_type: 'wia.response_prepared', actor_type: 'bot', actor_id: 'wia', trace_id: traceId, event_data: { requires_approval: true, provider: result.usage.provider, model: result.usage.model } });
      if (auditError) throw auditError;
      res.json({ received: true, message_id: messageId, conversation_id: conversation.id, approval_task_id: savedTask.id, suggestion_status: 'awaiting_approval', suggested_response: result.decision.messageDraft, trace_id: traceId });
    } catch (wiaError) {
      console.error('[WIA] inbound_suggestion_failed', { traceId, category: wiaError instanceof ModelProviderError || wiaError instanceof ProviderConfigurationError ? wiaError.code : 'provider_error' });
      // The inbound message is durable; returning success prevents provider retries from duplicating it.
      res.json({ received: true, message_id: messageId, conversation_id: conversation.id, suggestion_status: 'unavailable', trace_id: traceId });
    }
  } catch (error) {
    console.error(`[ERRO] ${req.method} ${req.path}:`, error);
    res.status(500).json({ error: 'Erro ao processar webhook.' });
  }
});

// POST /api/approval-tasks/:id/approve
app.post("/api/approval-tasks/:taskId/approve", authenticate, async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Aprovações indisponíveis sem persistência configurada.', category: 'configuration_error' });
  try {
    const tenantContext = requireTenantContext(req);
    const workspaceId = tenantContext.workspaceId;
    const { taskId } = req.params;
    const reason = z.string().trim().max(1000).optional().parse(req.body?.reason);
    const { data: task, error: taskError } = await supabase.from('orkto_approval_tasks')
      .select('*, orkto_conversations!orkto_approval_conversation_workspace_fkey!inner(*)').eq('id', taskId).eq('status', 'pending')
      .eq('workspace_id',workspaceId).eq('orkto_conversations.workspace_id', workspaceId).maybeSingle();
    if (taskError) throw taskError;
    if (!task || task.orkto_conversations?.workspace_id !== workspaceId) return res.status(404).json({ error: 'Tarefa ou conversa não encontrada.' });
    const { data: updated, error: updateError } = await supabase.from('orkto_approval_tasks').update({
      status: 'approved', decided_at: new Date().toISOString(), decided_by: tenantContext.userId, decision_reason: reason || '',
    }).eq('workspace_id',workspaceId).eq('id', taskId).eq('status', 'pending').select('*').maybeSingle();
    if (updateError) throw updateError;
    if (!updated) return res.status(409).json({ error: 'A tarefa foi decidida em outra operação. Atualize e tente novamente.' });
    const { error: auditError } = await supabase.from('orkto_audit_log').insert({ user_id: tenantContext.userId, workspace_id:workspaceId, conversation_id: task.conversation_id, approval_task_id: taskId, event_type: 'wia.draft.approved', actor_type: 'human', actor_id: tenantContext.userId, trace_id: task.trace_id, event_data: { delivery_status: 'channel_not_configured' } });
    if (auditError) throw auditError;
    await recordCoreEvent(workspaceId, tenantContext.userId, 'approval.approved', 'approval_task', taskId, { conversation_id: task.conversation_id, delivery_status: 'CONFIGURATION_REQUIRED' });
    res.json({ success: true, task: updated, deliveryStatus: 'CONFIGURATION_REQUIRED', category: 'channel_not_configured', message: 'Rascunho aprovado; nenhum envio foi feito porque o canal de saída ainda não está conectado.' });
  } catch (error) {
    console.error(`[ERRO] ${req.method} ${req.path}:`, error);
    res.status(500).json({ error: 'Erro ao aprovar tarefa.' });
  }
});

// POST /api/approval-tasks/:id/reject
app.post("/api/approval-tasks/:taskId/reject", authenticate, async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Aprovações indisponíveis sem persistência configurada.', category: 'configuration_error' });
  try {
    const tenantContext = requireTenantContext(req);
    const workspaceId = tenantContext.workspaceId;
    const { taskId } = req.params;
    const reason = z.string().trim().max(1000).optional().parse(req.body?.reason);
    const { data: task, error: taskError } = await supabase.from('orkto_approval_tasks')
      .select('*, orkto_conversations!orkto_approval_conversation_workspace_fkey!inner(*)').eq('id', taskId).eq('status', 'pending')
      .eq('workspace_id',workspaceId).eq('orkto_conversations.workspace_id', workspaceId).maybeSingle();
    if (taskError) throw taskError;
    if (!task || task.orkto_conversations?.workspace_id !== workspaceId) return res.status(404).json({ error: 'Tarefa ou conversa não encontrada.' });
    const { data: updated, error: updateError } = await supabase.from('orkto_approval_tasks').update({
      status: 'rejected', decided_at: new Date().toISOString(), decided_by: tenantContext.userId, decision_reason: reason || 'Rejeitado pelo operador',
    }).eq('workspace_id',workspaceId).eq('id', taskId).eq('status', 'pending').select('*').maybeSingle();
    if (updateError) throw updateError;
    if (!updated) return res.status(409).json({ error: 'A tarefa foi decidida em outra operação. Atualize e tente novamente.' });
    const { error: auditError } = await supabase.from('orkto_audit_log').insert({ user_id: tenantContext.userId, workspace_id:workspaceId, conversation_id: task.conversation_id, approval_task_id: taskId, event_type: 'wia.draft.rejected', actor_type: 'human', actor_id: tenantContext.userId, trace_id: task.trace_id, event_data: { reason: reason || null } });
    if (auditError) throw auditError;
    await recordCoreEvent(workspaceId, tenantContext.userId, 'approval.rejected', 'approval_task', taskId, { conversation_id: task.conversation_id, reason: reason || null });
    res.json({ success: true, task: updated });
  } catch (error) {
    console.error(`[ERRO] ${req.method} ${req.path}:`, error);
    res.status(500).json({ error: 'Erro ao rejeitar tarefa.' });
  }
});

// POST /api/conversations/:id/send
app.post("/api/conversations/:conversationId/send", authenticate, async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Envio indisponível sem persistência configurada.', category: 'configuration_error' });
  try {
    const { conversationId } = req.params;
    const parsed = z.object({ content: z.string().trim().min(1).max(4000), idempotencyKey: z.string().trim().min(8).max(200).optional() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Conteúdo da mensagem inválido.' });
    const tenantContext = requireTenantContext(req);
    const workspaceId = tenantContext.workspaceId;
    const { data: conversation, error } = await supabase.from('orkto_conversations').select('id,source_channel').eq('id',conversationId).eq('workspace_id',workspaceId).maybeSingle();
    if (error) throw error;
    if (!conversation) return res.status(404).json({ error: 'Conversa não encontrada.' });
    if (process.env.ORKTO_EXTERNAL_MESSAGING_ENABLED !== 'true') {
      const audit = await invokeCoreMutation(req, res, { id: workspaceId }, 'AUDIT_MESSAGE_CONFIGURATION_REQUIRED', { conversationId });
      if (!audit) return;
      return res.status(503).json({ error:'Canal de saída não configurado. A mensagem não foi enviada.',
        status:'CONFIGURATION_REQUIRED',category:'channel_not_configured' });
    }
    const result = await sendThroughDurableChannelAdapter({
      repository: createDurableChannelSendRepository(supabase),
      adapter: null,
      request: { workspaceId, conversationId, channel: conversation.source_channel, content: parsed.data.content, idempotencyKey: parsed.data.idempotencyKey },
      audit: async event => {
        const { error: auditError } = await supabase!.from('orkto_audit_log').insert({
          user_id: tenantContext.userId,
          workspace_id: workspaceId,
          conversation_id: conversationId,
          event_type: event.eventType,
          actor_type: 'human',
          actor_id: tenantContext.userId,
          event_data: { channel: event.channel, status: event.status },
        });
        if (auditError) throw auditError;
      },
    });
    if (result.status === 'CONFIGURATION_REQUIRED') return res.status(503).json({ error: 'O rascunho não foi enviado. Conecte um canal de saída oficial para habilitar o envio.', status: result.status, category: 'channel_not_configured' });
    if (result.status === 'REQUEST_ACCEPTED' || result.status === 'PROVIDER_ACKNOWLEDGED' || result.status === 'DELIVERED') {
      return res.status(202).json({ status: result.status, requestId: result.requestId, externalMessageId: result.externalMessageId,
        acceptedAt: result.acceptedAt, delivered: result.status === 'DELIVERED', replay: result.replay });
    }
    if (result.status === 'IDEMPOTENCY_CONFLICT') return res.status(409).json({ error: 'A chave de idempotência já foi usada para outra mensagem.', category: 'idempotency_conflict', requestId: result.requestId });
    if (result.status === 'IN_PROGRESS') return res.status(409).json({ error: 'O envio com esta chave ainda está em processamento.', category: 'processing_in_progress', requestId: result.requestId });
    if (result.status === 'RECONCILIATION_REQUIRED') return res.status(503).json({ error: 'O resultado do envio é incerto; reconcilie antes de tentar novamente.', category: 'external_delivery_unknown', requestId: result.requestId });
    if (result.status === 'PERSISTENCE_UNAVAILABLE') return res.status(503).json({ error: 'Não foi possível registrar o envio com segurança.', category: 'persistence_unavailable', requestId: result.requestId });
    if ('category' in result) {
      return res.status(result.category === 'validation_failed' ? 400 : 502).json({ error: 'O provedor não confirmou a mensagem.', status: result.status, category: result.category || 'provider_error', requestId: result.requestId });
    }
    return res.status(502).json({ error: 'O provedor não confirmou a mensagem.', status: result.status, requestId: result.requestId });
  } catch (error) {
    console.error(`[ERRO] ${req.method} ${req.path}:`, error);
    res.status(500).json({ error: 'Erro ao enviar mensagem.' });
  }
});

// ============================================================
// END ORKTO Swarm API Routes
// ============================================================

registerOperationalRoutes(app, authenticate, supabase);

Sentry.setupExpressErrorHandler(app);

export default app;
