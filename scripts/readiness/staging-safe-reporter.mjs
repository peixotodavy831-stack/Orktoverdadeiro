import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { errorClass, sanitizeArtifacts, secretValues } from './staging-browser-security.mjs';
import { safeStep, safeEvent, safeResults } from './staging-diagnostics.mjs';

export default class StagingSafeReporter {
  onBegin(config) {
    this.outputDirs = config.projects.map(project => project.outputDir);
    this.tests = new Map(); this.buffers = new Map();
  }
  record(test) {
    const id = createHash('sha256').update(test.titlePath().join(' > ')).digest('hex').slice(0, 16);
    if (!this.tests.has(id)) this.tests.set(id, { id, status: 'running', errors: [], duration_ms: 0, timeout_ms: test.timeout, steps: [], requests: [], timeout_scope: 'NONE' });
    return this.tests.get(id);
  }
  persist() {
    const data = safeResults({ candidate_sha: process.env.ORKTO_STAGING_EXPECTED_SHA, tests: [...this.tests.values()] });
    for (const root of this.outputDirs) { mkdirSync(root, { recursive: true }); writeFileSync(join(root, 'safe-results.json'), JSON.stringify(data, null, 2)); }
    return data;
  }
  onTestBegin(test) { this.record(test); this.persist(); }
  onStepBegin(test, _result, step) {
    const record = this.record(test); const item = safeStep(step);
    if (!record.failure_step) record.last_step = { ...item, duration_ms: 0 };
    if (item.stage) record.current_phase = item.stage;
    this.persist();
  }
  onStepEnd(test, _result, step) {
    const record = this.record(test);
    const item = { ...safeStep(step), duration_ms: step.duration };
    if (item.stage || step.error) record.steps.push(item);
    if (step.error && !record.failure_step) { record.failure_step = item; record.last_step = item; }
    this.persist();
  }
  onStdOut(chunk, test) {
    if (!test) return;
    let buffer = (this.buffers.get(test.id) || '') + String(chunk);
    if (buffer.length > 65536) buffer = '';
    const lines = buffer.split(/\r?\n/); this.buffers.set(test.id, lines.pop());
    for (const line of lines) {
      if (!line.startsWith('ORKTO_SAFE_EVENT ')) continue;
      try {
        const event = safeEvent(JSON.parse(line.slice('ORKTO_SAFE_EVENT '.length)));
        if (event) {
          const record = this.record(test);
          if (event.kind === 'request') record.requests.push(event);
          else if (event.status === 'start') record.current_phase = event.stage;
          else record.steps.push({ stage: event.stage, api: 'checkpoint', category: 'test.step', line: 0, duration_ms: event.duration_ms });
          this.persist(); console.log('ORKTO_SAFE_EVENT ' + JSON.stringify(event));
        }
      } catch { /* raw test output is never forwarded */ }
    }
  }
  onTestEnd(test, result) {
    for (const root of this.outputDirs) sanitizeArtifacts(root, secretValues(process.env));
    const record = this.record(test);
    record.status = result.status; record.duration_ms = result.duration; record.errors = result.errors.map(errorClass);
    const message = result.errors.map(error => error.message || '').join('\n');
    const stack = result.errors.map(error => error.stack || '').join('\n');
    record.source_line = Number(stack.match(/staging(?:-timeout-diagnostics)?\.spec\.ts:(\d+):\d+/)?.[1] || record.last_step?.line || test.location.line);
    record.operation_timeout_ms = record.errors.includes('TIMEOUT') ? Number(message.match(/Timeout\s+(\d+)\s*ms/i)?.[1] || 0) : 0;
    record.timeout_ms = Number(message.match(/Test timeout of (\d+)ms/i)?.[1] || test.timeout);
    record.timeout_scope = result.status === 'timedOut' ? 'PLAYWRIGHT_TEST' : !record.errors.includes('TIMEOUT') ? 'NONE'
      : /apiRequestContext\./i.test(message) ? 'PLAYWRIGHT_API_REQUEST' : record.last_step?.category === 'expect' ? 'PLAYWRIGHT_EXPECT'
        : /locator|page\./i.test(message) ? 'PLAYWRIGHT_ACTION' : 'UNKNOWN';
    record.trace_retained = result.attachments.some(attachment => attachment.name === 'trace' && attachment.path && existsSync(attachment.path));
    const data = this.persist();
    if (record.status !== 'passed' && record.trace_retained) {
      // Playwright clears outputDir on the next invocation. Preserve only the
      // already-sanitized failure record/timeline outside that disposable folder.
      const archive = join(this.outputDirs[0], '..', 'staging-e2e-failures', `${Date.now()}-${record.id}`);
      mkdirSync(archive, { recursive: true });
      writeFileSync(join(archive, 'safe-results.json'), JSON.stringify(safeResults({ candidate_sha: data.candidate_sha, tests: [record] }), null, 2));
      const traces = result.attachments.filter(attachment => attachment.name === 'trace' && attachment.path && existsSync(attachment.path));
      for (const [index, attachment] of traces.entries()) copyFileSync(attachment.path, join(archive, `trace-${index}.zip`));
    }
    console.log('ORKTO_SAFE_RESULT ' + JSON.stringify(data.tests.find(item => item.id === record.id)));
  }
  onStdErr() {}
  onError(error) { console.log('ORKTO_SAFE_RESULT ' + JSON.stringify({ status: 'runner_error', errors: [errorClass(error)] })); }
  printsToStdio() { return true; }
}
