import crypto from 'node:crypto';
import type { Request, Response } from 'express';

const STAGING_REF = 'ghrjongiodziasupakrk';
const PRODUCTION_REF = 'qneqljlphgkptebsaonb';
const STAGING_PROJECT_ID = 'prj_KZm12jmZIKL3Tqnk2I9DBa9MabKc';
const PRODUCTION_PROJECT_ID = 'prj_XiwDjfbGC8sq8L8zb59lcZA4HUny';
const IDEMPOTENCY_KEY = /^[A-Za-z0-9][A-Za-z0-9:_-]{7,127}$/;

export type CoreMutationCommand =
  | 'COMPLETE_ONBOARDING' | 'CREATE_CLIENT' | 'UPDATE_CLIENT' | 'ARCHIVE_CLIENT'
  | 'CREATE_CATALOG_ITEM' | 'UPDATE_CATALOG_ITEM' | 'ARCHIVE_CATALOG_ITEM'
  | 'CREATE_DEAL' | 'UPDATE_DEAL' | 'CLOSE_DEAL' | 'ARCHIVE_DEAL' | 'APPROVE_WIA_ACTION' | 'REJECT_WIA_ACTION'
  | 'CREATE_QUOTE' | 'UPDATE_QUOTE' | 'ARCHIVE_QUOTE'
  | 'SET_CONVERSATION_PRIORITY' | 'MARK_CONVERSATION_READ' | 'SET_CONVERSATION_STATUS';

export type CoreMutationResult = {
  result: string;
  profile?: { id: string };
  client?: unknown;
  client_id?: string;
  service?: unknown;
  service_id?: string;
  deal?: unknown;
  memory_status?: string;
  action?: unknown;
  external_delivery?: string;
  quote?: unknown;
  quote_id?: string;
  conversation?: { id: string; status: string; updated_at?: string };
  messages_marked_read?: number;
};

type Environment = Record<string, string | undefined>;

/** Resolve the same Edge command endpoint for every environment, or fail closed. */
export function resolveCoreMutationEndpoint(env: Environment): string | null {
  const appEnv = env.APP_ENV?.trim().toLowerCase();
  const configured = env.VITE_SUPABASE_URL?.trim();
  if (!configured) return null;
  let url: URL;
  try { url = new URL(configured); } catch { return null; }
  if (url.username || url.password || url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) return null;
  const origin = url.origin;
  if (appEnv === 'staging') {
    if (origin !== `https://${STAGING_REF}.supabase.co`) return null;
    if (env.VERCEL === '1' && env.VERCEL_PROJECT_ID !== STAGING_PROJECT_ID) return null;
  } else if (appEnv === 'production') {
    if (origin !== `https://${PRODUCTION_REF}.supabase.co`) return null;
    if (env.VERCEL === '1' && env.VERCEL_PROJECT_ID !== PRODUCTION_PROJECT_ID) return null;
  } else if (appEnv === 'development') {
    const local = url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    const testHarness = env.NODE_ENV === 'test' && origin === 'http://orkto-test-supabase.invalid';
    const declaredRef = env.ORKTO_DEVELOPMENT_SUPABASE_REF?.trim();
    const remote = declaredRef && /^[a-z0-9]{8,32}$/.test(declaredRef)
      && ![STAGING_REF, PRODUCTION_REF].includes(declaredRef)
      && origin === `https://${declaredRef}.supabase.co`;
    if (!local && !remote && !testHarness) return null;
  } else return null;
  return `${origin}/functions/v1/orkto-core-mutations`;
}

export class CoreMutationClient {
  constructor(private readonly env: Environment, private readonly send: typeof fetch = fetch) {}

  async invoke(req: Request, res: Response, workspaceId: string, command: CoreMutationCommand, payload: unknown): Promise<CoreMutationResult | null> {
    const endpoint = resolveCoreMutationEndpoint(this.env);
    const publishableKey = this.env.VITE_SUPABASE_ANON_KEY?.trim();
    if (!endpoint || !publishableKey) {
      res.status(503).json({ error: 'Mutation Gateway indisponível.', category: 'CONFIGURATION_REQUIRED' });
      return null;
    }
    const idempotencyKey = req.get('x-idempotency-key') || crypto.randomUUID();
    if (!IDEMPOTENCY_KEY.test(idempotencyKey)) {
      res.status(400).json({ error: 'Chave de operação inválida.', category: 'VALIDATION_FAILED' });
      return null;
    }
    try {
      const gateway = await this.send(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', apikey: publishableKey,
          authorization: req.get('authorization') || '', 'x-orkto-workspace': workspaceId,
          'x-idempotency-key': idempotencyKey, 'x-request-id': req.requestId || crypto.randomUUID() },
        body: JSON.stringify({ command, payload }), signal: AbortSignal.timeout(10_000),
      });
      const result = await gateway.json() as { code?: string; data?: CoreMutationResult };
      if (!gateway.ok) {
        const allowed = new Set(['AUTH_REQUIRED', 'PERMISSION_DENIED', 'VALIDATION_FAILED', 'WORKSPACE_ACCESS_DENIED',
          'NOT_FOUND', 'CONFLICT', 'IDEMPOTENCY_CONFLICT', 'RATE_LIMITED', 'CONFIGURATION_REQUIRED']);
        const code = allowed.has(result.code || '') ? result.code : 'INTERNAL_ERROR';
        res.status(gateway.status >= 400 && gateway.status < 500 ? gateway.status : 503)
          .json({ error: 'Não foi possível concluir a operação.', category: code, requestId: req.requestId });
        return null;
      }
      if (!result.data?.result) throw new Error('Invalid gateway response.');
      return result.data;
    } catch {
      res.status(503).json({ error: 'Não foi possível confirmar a operação. Atualize os dados antes de repetir.',
        category: 'mutation_gateway_unavailable', requestId: req.requestId });
      return null;
    }
  }
}

export function invokeCoreMutation(req: Request, res: Response, context: { id: string }, command: CoreMutationCommand, payload: unknown) {
  return new CoreMutationClient(process.env).invoke(req, res, context.id, command, payload);
}
