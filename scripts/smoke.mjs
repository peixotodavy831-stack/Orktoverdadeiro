import { spawn } from 'node:child_process';

const port = process.env.SMOKE_PORT || '3107';
const baseUrl = process.env.SMOKE_BASE_URL || `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['dist/server.cjs'], {
  cwd: process.cwd(),
  env: { ...process.env, NODE_ENV: 'production', PORT: port },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let stderr = '';
let serverExitCode = null;
server.stderr.on('data', chunk => { stderr += String(chunk); });
server.on('exit', code => { serverExitCode = code; });

async function request(path, init) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status} ${JSON.stringify(body)}`);
  return { response, body };
}

async function expectStatus(path, expectedStatus, init) {
  const response = await fetch(`${baseUrl}${path}`, init);
  if (response.status !== expectedStatus) {
    const body = await response.text();
    throw new Error(`${path}: esperado HTTP ${expectedStatus}, recebido ${response.status} ${body}`);
  }
}

async function waitUntilReady() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (serverExitCode !== null) throw new Error(`Servidor encerrou com código ${serverExitCode}. ${stderr}`);
    try {
      const { body } = await request('/api/health');
      if (body?.status === 'ok') return;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }
  throw new Error(`Servidor não iniciou. ${stderr}`);
}

try {
  await waitUntilReady();
  const health = await request('/api/health');
  const hermes = await request('/api/hermes/health');

  await expectStatus('/api/swarm/health', 404);
  await expectStatus('/api/orkto/inbox', 404);
  await expectStatus('/api/orkto/whatsapp/webhook-sim', 404, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      workspaceId: 'smoke-test',
      contactName: 'Cliente de Teste',
      contactPhone: '+5500000000000',
      message: 'Olá, gostaria de um orçamento',
    }),
  });

  console.log(JSON.stringify({
    health: health.body,
    hermes: hermes.body,
    mockRoutes: 'disabled',
  }, null, 2));
} finally {
  server.kill('SIGTERM');
}
