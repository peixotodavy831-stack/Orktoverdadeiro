import { cpSync, existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const temporaryRoot = mkdtempSync(join(projectRoot, '.tmp-orkto-tests-'));
const outputRoot = join(temporaryRoot, 'compiled');
const testSourceRoot = join(projectRoot, 'tests');
const testSources = readdirSync(testSourceRoot)
  .filter((name) => name.endsWith('.test.ts'))
  .map((name) => join('tests', name));

if (testSources.length === 0) {
  rmSync(temporaryRoot, { recursive: true, force: true });
  console.error('Nenhum arquivo tests/*.test.ts encontrado.');
  process.exit(1);
}

const tscPath = fileURLToPath(import.meta.resolve('typescript/bin/tsc'));
const compile = spawnSync(process.execPath, [
  tscPath,
  '--target', 'ES2022',
  '--module', 'ESNext',
  '--moduleResolution', 'Bundler',
  '--esModuleInterop',
  '--skipLibCheck',
  '--jsx', 'react-jsx',
  '--outDir', outputRoot,
  ...testSources,
], { cwd: projectRoot, stdio: 'inherit' });

if (compile.error || compile.status !== 0) {
  rmSync(temporaryRoot, { recursive: true, force: true });
  if (compile.error) console.error(compile.error);
  process.exit(compile.status || 1);
}

writeFileSync(join(outputRoot, 'package.json'), JSON.stringify({ type: 'module' }));
const sourceFixtures = join(testSourceRoot, 'fixtures');
if (existsSync(sourceFixtures)) {
  cpSync(sourceFixtures, join(outputRoot, 'tests', 'fixtures'), { recursive: true });
}

const compiledTests = readdirSync(join(outputRoot, 'tests'))
  .filter((name) => name.endsWith('.test.js'))
  .map((name) => join(outputRoot, 'tests', name));
// A few integration suites replace process-global fetch to emulate provider and
// PostgREST boundaries. Serial file execution keeps those adapters isolated.
// core-app loads .env at import time. Empty values are deliberate: dotenv does
// not overwrite them, so local credentials cannot turn an offline test into a
// live Supabase client or change the no-persistence webhook contract.
const isolatedTestEnv = {
  ...process.env,
  VITE_SUPABASE_URL: '',
  VITE_SUPABASE_ANON_KEY: '',
  SUPABASE_SERVICE_ROLE_KEY: '',
};
const testRun = spawnSync(process.execPath, ['--test', '--test-concurrency=1', ...compiledTests], {
  cwd: projectRoot,
  env: isolatedTestEnv,
  stdio: 'inherit',
});

rmSync(temporaryRoot, { recursive: true, force: true });
if (testRun.error) {
  console.error(testRun.error);
  process.exitCode = 1;
} else if (testRun.status === null || testRun.signal) {
  console.error(`O runner de testes terminou sem código de saída (${testRun.signal || 'desconhecido'}).`);
  process.exitCode = 1;
} else {
  process.exitCode = testRun.status;
}

if (process.exitCode === 0) {
  const toolTestRoot = join(projectRoot, 'scripts', 'tests');
  const toolTests = readdirSync(toolTestRoot)
    .filter((name) => name.endsWith('.test.mjs'))
    .map((name) => join(toolTestRoot, name));
  if (toolTests.length) {
    const toolRun = spawnSync(process.execPath, ['--test', '--test-concurrency=1', ...toolTests], {
      cwd: projectRoot,
      stdio: 'inherit',
    });
    if (toolRun.error) {
      console.error(`Readiness tool tests could not start (${toolRun.error.code || 'runner error'}).`);
      process.exitCode = 1;
    } else if (toolRun.status !== 0) {
      process.exitCode = toolRun.status || 1;
    }
  }
}
