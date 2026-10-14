import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
import { readFileSync, writeFileSync } from 'node:fs';
import { errorClass } from './staging-browser-security.mjs';

export const STAGES = ['AUTH_A', 'AUTH_B', 'A_WORKSPACE_INBOX', 'A_CLIENT_CONTACT', 'A_NAVIGATION', 'A_RESPONSIVE_LOGOUT',
  'B_WORKSPACE_ISOLATION', 'B_CLIENTS', 'AUTH_A_REFRESH', 'GATEWAY_ADVERSARIAL', 'FINAL_NETWORK_ASSERTIONS',
  'LOGOUT_REVOCATION', 'WIA_APPROVAL_REJECTION', 'WIA_TRUSTED_PROVENANCE', 'INBOX_DRAFT_DECISIONS',
  'PUBLIC_PROPOSAL_LIFECYCLE'];
export function safeRoute(input, base = process.env.ORKTO_STAGING_PREVIEW_URL || 'https://orkto-staging-fgfh3m49v-peixoto-s-projects1.vercel.app') {
  try {
    const url = new URL(input, base);
    const host = url.hostname === 'ghrjongiodziasupakrk.supabase.co' ? 'STAGING_SUPABASE'
      : url.origin === base.replace(/\/$/, '') ? 'STAGING_PREVIEW'
        : ['localhost', '127.0.0.1'].includes(url.hostname) ? 'LOCAL_TEST' : 'OTHER';
    const path = url.pathname.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id');
    const approved = /^(?:\/|\/api\/(?:health|ready|clients|contacts|catalog|deals|quotes|conversations|memories|purchases)(?:\/:id)?(?:\/read)?|\/api\/quotes\/detail\/:id|\/api\/(?:priority\/inbox|wia\/(?:actions|runs|history)|operational\/workspace|imports\/preview)|\/auth\/v1\/(?:token|user|logout|settings)|\/rest\/v1\/(?:clients|services|quotes|proposals|orkto_(?:contacts|deals|conversations|messages|wia_actions))|\/rest\/v1\/rpc\/orkto_(?:is_workspace_member|is_workspace_admin|legacy_owner_matches)|\/assets\/[A-Za-z0-9_.-]+\.js)$/;
    return { host, route: approved.test(path) ? path.startsWith('/assets/') ? '/assets/:bundle.js' : path : '/[unclassified]' };
  } catch { return { host: 'OTHER', route: '/[unclassified]' }; }
}

export function safeStep(step) {
  const stage = STAGES.includes(step.title) ? step.title : undefined;
  const api = stage ? 'checkpoint' : String(step.title).match(/\b(goto|click|fill|waitForResponse|waitFor|toBeVisible|toBe|toEqual|toHaveCount|reload|setViewportSize|json|get|post|patch|put|delete|request|navigation)\b/i)?.[1].toLowerCase() || 'operation';
  const line = Number(step.location?.line);
  return { ...(stage ? { stage } : {}), api, line: Number.isInteger(line) && line > 0 && line < 10000 ? line : 0,
    category: ['test.step', 'pw:api', 'expect', 'fixture', 'hook'].includes(step.category) ? step.category : 'other' };
}

export function safeEvent(value) {
  if (value.kind === 'phase' && STAGES.includes(value.stage) && ['start', 'complete', 'failed'].includes(value.status)) {
    return { kind: 'phase', stage: value.stage, status: value.status, duration_ms: Math.max(0, Math.min(900000, Math.round(Number(value.duration_ms) || 0))) };
  }
  if (value.kind === 'request' && ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(value.method)
    && ['STAGING_SUPABASE', 'STAGING_PREVIEW', 'LOCAL_TEST', 'OTHER'].includes(value.host)
    && /^\/(?:\[unclassified\]|[A-Za-z0-9_/:.-]*)$/.test(value.route)) {
    const validatedRoute = safeRoute(value.route).route;
    return { kind: 'request', method: value.method, host: value.host, route: validatedRoute,
      duration_ms: Math.max(0, Math.min(900000, Math.round(Number(value.duration_ms) || 0))),
      status: Number.isInteger(value.status) && value.status >= 100 && value.status <= 599 ? value.status : 0,
      ...(['ERR_ABORTED', 'ERR_FAILED', 'ERR_CONNECTION_RESET', 'ERR_CERT_AUTHORITY_INVALID', 'ERR_TIMED_OUT', 'ECONNRESET', 'ETIMEDOUT'].includes(value.transport_code) ? { transport_code: value.transport_code } : {}),
      failure: ['TIMEOUT', 'TLS_CERTIFICATE_ERROR', 'NETWORK_ERROR', 'HTTP_ERROR', 'NONE'].includes(value.failure) ? value.failure : 'NETWORK_ERROR' };
  }
  return undefined;
}

// Retain a genuine Playwright timeline, but never snapshots, sources, response
// resources, headers, cookies, request bodies, text input or raw error messages.
export function sanitizeTrace(file) {
  const input = readFileSync(file);
  if (input.length > 64 * 1024 * 1024) throw new Error('TRACE_TOO_LARGE');
  const entries = unzipSync(input, { filter: entry => /^[\w-]+\.(trace|network)$/.test(entry.name) && entry.originalSize < 32 * 1024 * 1024 });
  const output = {};
  const traceIds = new Map();
  for (const [name, bytes] of Object.entries(entries)) {
    const records = [];
    for (const line of strFromU8(bytes).split('\n').filter(Boolean)) {
      const event = JSON.parse(line);
      const numeric = {};
      for (const key of ['time', 'startTime', 'endTime', 'wallTime', 'version']) if (Number.isFinite(event[key])) numeric[key] = event[key];
      const ids = {};
      for (const key of ['callId', 'parentId', 'pageId', 'frameId', 'contextId']) {
        if (typeof event[key] === 'string') {
          if (!traceIds.has(event[key])) traceIds.set(event[key], `id@${traceIds.size + 1}`);
          ids[key] = traceIds.get(event[key]);
        }
      }
      if (event.type === 'context-options') {
        records.push({ type: event.type, ...numeric, browserName: 'chromium', platform: 'redacted', options: {}, sdkLanguage: 'javascript', title: 'Sanitized staging trace' });
      } else if (event.type === 'before') {
        const method = ['goto', 'click', 'fill', 'get', 'post', 'fetch', 'patch', 'put', 'delete', 'reload', 'evaluate', 'json', 'waitForSelector', 'waitForResponse', 'waitForTimeout', 'waitFor', 'isVisible', 'count', 'getAttribute', 'textContent', 'setViewportSize'].includes(event.method) ? event.method : 'operation';
        const safe = { type: 'before', ...numeric, ...ids, method, class: ['Page', 'Locator', 'APIRequestContext', 'Frame', 'BrowserContext'].includes(event.class) ? event.class : 'Other',
          apiName: `Operation.${method}`, params: {}, stack: [] };
        if (event.params?.url) safe.params.url = 'https://staging.invalid' + safeRoute(event.params.url).route;
        for (const frame of event.stack || []) if (Number.isInteger(frame.line) && frame.line < 10000) safe.stack.push({ file: 'staging.spec.ts', line: frame.line, column: Number(frame.column) || 0 });
        records.push(safe);
      } else if (event.type === 'after') {
        records.push({ type: 'after', ...numeric, ...ids, ...(event.error ? { error: { name: 'Error', message: errorClass(event.error) } } : {}) });
      } else if (event.type === 'resource-snapshot') {
        const snapshot = event.snapshot || {};
        const route = safeRoute(snapshot.request?.url || '');
        records.push({ type: 'resource-snapshot', snapshot: { pageref: 'staging', startedDateTime: '2000-01-01T00:00:00.000Z',
          time: Number(snapshot.time) || 0, request: { method: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(snapshot.request?.method) ? snapshot.request.method : 'GET',
            url: 'https://staging.invalid' + route.route, httpVersion: 'HTTP/1.1', headers: [], cookies: [], queryString: [], headersSize: -1, bodySize: -1 },
          response: { status: Number(snapshot.response?.status) || 0, statusText: '', httpVersion: 'HTTP/1.1', headers: [], cookies: [], content: { size: 0, mimeType: 'application/octet-stream' }, redirectURL: '', headersSize: -1, bodySize: -1 },
          cache: {}, timings: { send: 0, wait: 0, receive: 0 } } });
      }
    }
    output[name] = strToU8(records.map(event => JSON.stringify(event)).join('\n'));
  }
  if (!Object.keys(output).length) throw new Error('TRACE_STRUCTURE_INVALID');
  writeFileSync(file, zipSync(output));
}

export function safeResults(data) {
  const statuses = ['running', 'passed', 'failed', 'timedOut', 'skipped', 'interrupted', 'runner_error'];
  const codes = ['TLS_CERTIFICATE_ERROR', 'LOCATOR_AMBIGUOUS', 'TIMEOUT', 'ASSERTION_FAILED', 'TEST_ERROR'];
  const cleanStep = step => ({ ...safeStep({ title: step?.stage || step?.api || '', category: step?.category, location: { line: step?.line } }),
    duration_ms: Math.max(0, Math.min(900000, Math.round(Number(step?.duration_ms) || 0))) });
  return { candidate_sha: /^[a-f0-9]{40}$/i.test(data.candidate_sha || '') ? data.candidate_sha : '',
    tests: (data.tests || []).filter(item => /^[a-f0-9]{16}$/.test(item.id || '') && statuses.includes(item.status)).map(item => ({
      id: item.id, status: item.status, errors: (item.errors || []).filter(code => codes.includes(code)),
      duration_ms: Math.max(0, Math.min(900000, Math.round(Number(item.duration_ms) || 0))),
      timeout_ms: Math.max(0, Math.min(900000, Math.round(Number(item.timeout_ms) || 0))),
      operation_timeout_ms: Math.max(0, Math.min(900000, Math.round(Number(item.operation_timeout_ms) || 0))),
      source_line: Number.isInteger(item.source_line) && item.source_line > 0 && item.source_line < 10000 ? item.source_line : 0,
      timeout_scope: ['PLAYWRIGHT_TEST', 'PLAYWRIGHT_ACTION', 'PLAYWRIGHT_EXPECT', 'PLAYWRIGHT_API_REQUEST', 'UNKNOWN', 'NONE'].includes(item.timeout_scope) ? item.timeout_scope : 'UNKNOWN',
      ...(STAGES.includes(item.current_phase) ? { current_phase: item.current_phase } : {}),
      ...(item.last_step ? { last_step: cleanStep(item.last_step) } : {}),
      steps: (item.steps || []).map(cleanStep), requests: (item.requests || []).map(safeEvent).filter(event => event?.kind === 'request'),
      trace_retained: item.trace_retained === true,
    })) };
}
