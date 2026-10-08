import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const repo = path.resolve(import.meta.dirname, '../..');
const backendRoot = path.join(repo, 'backend');
const methods = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options']);

function filesUnder(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return filesUnder(file);
    return entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [file] : [];
  });
}

function classify(method, route, handler) {
  const auth = /\bauthenticate\b|\brequireTenantContext\s*\(|\breq\.user\b/.test(handler);
  const workspace = /\brequireTenantContext\s*\(|\btenantContext\b|\bworkspaceId\b|\bworkspace_id\b/.test(handler);
  const role = /\brequireWorkspaceRole\s*\(|\.role\s*!==|\.role\s*===|\brole\s*===/.test(handler);
  const publicRoute = route.startsWith('/api/public/')
    || route === '/api/quote/public/:id'
    || /^\/api\/proposal\/:slug(?:\/(?:approve|reject|viewed|pix))?$/.test(route)
    || (!auth && /\/api\/public\//i.test(route));
  const audited = /\b(?:addAuditOrThrow|recordCoreEvent|logStructured)\s*\(/.test(handler);
  const isApi = route === '/api' || route.startsWith('/api/');
  const specializedLimit = route.startsWith('/api/wia/') || route === '/api/wia' ? 'WIA 30/15m'
    : route.startsWith('/api/reports/') || route === '/api/reports' ? 'reports 30/15m'
      : route.startsWith('/api/imports/') || route === '/api/imports' ? 'imports 20/15m'
        : route.startsWith('/api/proposal/') || route.startsWith('/api/public/') ? 'public/token surfaces 60/15m'
          : '';
  const write = !['get', 'head', 'options'].includes(method.toLowerCase());
  return {
    auth: auth ? 'YES' : publicRoute ? 'NO (public by design)' : 'REVIEW',
    workspace: workspace ? 'YES' : publicRoute ? 'NO (token/public contract)' : 'REVIEW',
    role: role ? 'YES / handler policy' : write ? 'CONDITIONAL / handler' : 'NO / not evidenced',
    publicRoute: publicRoute ? 'YES' : 'NO',
    rateLimit: isApi ? `GLOBAL 200/15m${specializedLimit ? ` + ${specializedLimit}` : ''}; per-process only` : 'NO API limiter evidenced',
    sideEffect: write ? 'YES / verify handler' : /\.update\(|\.insert\(|\.upsert\(|\.delete\(/.test(handler) ? 'CONDITIONAL (GET side effect)' : 'NO (read method)',
    audit: audited ? 'HELPER PRESENT; review branch coverage' : write ? 'REVIEW REQUIRED' : 'NOT EVIDENCED',
  };
}

export function collectRouteInventory(root = backendRoot) {
  const routes = [];
  for (const file of filesUnder(root)) {
    const sourceText = readFileSync(file, 'utf8');
    const source = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const visit = (node) => {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const method = node.expression.name.text.toLowerCase();
        const first = node.arguments[0];
        if (methods.has(method) && first && (ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first))) {
          const route = first.text;
          if (route.startsWith('/')) {
            const handler = node.getText(source);
            routes.push({
              method: method.toUpperCase(), route,
              ...classify(method, route, handler),
              source: `${path.relative(repo, file).replaceAll('\\', '/')}#L${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}`,
            });
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return routes.sort((a, b) => a.route.localeCompare(b.route) || a.method.localeCompare(b.method));
}

export function renderMatrix(routes) {
  const rows = routes.map((route) => `| \`${route.method}\` | \`${route.route}\` | ${route.auth} | ${route.workspace} | ${route.role} | ${route.publicRoute} | ${route.rateLimit} | ${route.sideEffect} | ${route.audit} | [source](${route.source}) |`);
  return `# ORKTO API Authorization Matrix\n\nGenerated from server route declarations on ${new Date().toISOString().slice(0, 10)}.\n\nRoutes inventoried: **${routes.length}**. The matrix is a static inventory to focus review; it is not proof that every branch is secure. \`REVIEW\` and \`CONDITIONAL\` are intentional unresolved classifications, not passes.\n\n## Runtime baseline\n\n- API routes are behind a global 200 requests / 15-minute \`express-rate-limit\` limiter using the process-local in-memory store. This is a local abuse guard, **not a distributed limit** across serverless instances.\n- Staging refuses enabled demo/mock routes and checks the staging project boundary at startup. Mock routers must remain disabled outside explicit local tests.\n- Service-role Supabase access is server-side only; public browser configuration is separate.\n- Public proposal routes are bearer-token surfaces. Their token entropy and returned projection have dedicated regression tests; approval/rejection are side effects and must remain audited.\n- Authentication/workspace/role/audit values below are inferred from each route handler’s declared source. Handlers with branches, shared middleware, or indirect service calls require manual review. No frontend guard counts as server authorization.\n\n## Endpoint inventory\n\n| Method | Path | Auth required | Workspace required | Role required | Public? | Rate limit | Side effect | Audit required? | Source |\n|---|---|---|---|---|---|---|---|---|---|\n${rows.join('\n')}\n\n## Unresolved review conditions\n\nBefore staging E2E, resolve every \`REVIEW\`, \`CONDITIONAL\`, and \`REVIEW REQUIRED\` row against middleware and API contract tests. For public routes, independently verify token entropy, expiry/revocation, data projection, status-code behavior, and rate protection. External/shared rate limiting remains an infrastructure gate; do not mistake the in-process limiter for a production-wide quota.\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const routes = collectRouteInventory();
  if (!routes.length) throw new Error('No route declarations found.');
  const output = path.join(repo, 'docs/05_ENGINEERING/ORKTO_API_AUTHORIZATION_MATRIX.md');
  writeFileSync(output, renderMatrix(routes));
  process.stdout.write(`Generated ${routes.length} route rows: ${path.relative(repo, output)}\n`);
}
