import { spawn } from 'node:child_process';
import { safeEvent, safeResults } from './staging-diagnostics.mjs';

export async function runSafePlaywright(executable, args, { cwd, env, timeout = 900000, onRecord = record => console.log(JSON.stringify(record)) }) {
  return await new Promise(resolve => {
    const started = performance.now();
    const child = spawn(executable, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let buffer = '', timedOut = false, errorCode;
    const records = [];
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, timeout);
    child.stdout.on('data', chunk => {
      buffer += chunk.toString();
      if (buffer.length > 262144) buffer = '';
      const lines = buffer.split(/\r?\n/); buffer = lines.pop();
      for (const line of lines) {
        try {
          if (line.startsWith('ORKTO_SAFE_EVENT ')) {
            const event = safeEvent(JSON.parse(line.slice('ORKTO_SAFE_EVENT '.length)));
            if (event) onRecord(event);
          } else if (line.startsWith('ORKTO_SAFE_RESULT ')) {
            const raw = JSON.parse(line.slice('ORKTO_SAFE_RESULT '.length));
            const record = safeResults({ tests: [raw] }).tests[0];
            if (record) { records.push(record); onRecord(record); }
            else if (raw.status === 'runner_error') onRecord({ status: 'runner_error', errors: ['TEST_ERROR'] });
          }
        } catch { /* never emit raw stdout, malformed records or arbitrary errors */ }
      }
    });
    child.stderr.on('data', () => {}); // consume; provider/header diagnostics stay private
    child.on('error', error => { errorCode = ['ENOENT', 'EACCES'].includes(error.code) ? error.code : 'PROCESS_ERROR'; });
    child.on('close', (status, signal) => {
      clearTimeout(timer);
      resolve({ status, signal, records, timedOut, errorCode, duration_ms: Math.round(performance.now() - started), timeout_scope: timedOut ? 'RUNNER_PROCESS' : 'NONE' });
    });
  });
}
