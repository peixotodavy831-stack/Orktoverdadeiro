import { readFile } from 'node:fs/promises';
import { classifyWiaTask } from '../backend/wiaos/model-registry.js';
import { getModelProvider } from '../backend/wiaos/model-provider.js';

type BenchmarkCase = { id: string; taskType: 'fast' | 'standard' | 'deep'; message: string };

if (process.env.WIA_BENCHMARK_RUN !== 'true') {
  throw new Error('Defina WIA_BENCHMARK_RUN=true para autorizar chamadas pagas de benchmark.');
}

const cases = JSON.parse(await readFile(new URL('../tests/fixtures/wia-model-benchmark.json', import.meta.url), 'utf8')) as BenchmarkCase[];
const records = [];
for (const sample of cases) {
  const started = performance.now();
  const taskType = classifyWiaTask(sample.message);
  if (taskType !== sample.taskType) throw new Error(`Classe esperada divergente no caso ${sample.id}: ${taskType}`);
  const provider = getModelProvider(process.env, taskType);
  const result = await provider.decide({
    message: sample.message,
    context: { openQuotes: 2, pendingValue: 2500, clients: 4, companyName: 'Empresa exemplo' },
    sourceIds: ['quote:example-1', 'quote:example-2'],
  });
  records.push({
    caseId: sample.id,
    taskType,
    provider: result.usage.provider,
    gateway: result.usage.gateway,
    modelFamily: result.usage.modelFamily,
    requestedModel: result.usage.requestedModel,
    actualModel: result.usage.actualModel,
    success: true,
    latencyMs: Math.round(performance.now() - started),
    tokenUsage: result.usage,
    structuredOutputValid: true,
    decision: result.decision,
  });
}
process.stdout.write(`${JSON.stringify({ generatedAt: new Date().toISOString(), records }, null, 2)}\n`);
