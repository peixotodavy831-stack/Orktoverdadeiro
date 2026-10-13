import { createHash } from 'node:crypto';
import { errorClass, sanitizeArtifacts, secretValues } from './staging-browser-security.mjs';

export default class StagingSafeReporter {
  onBegin(config) { this.outputDirs = config.projects.map(project => project.outputDir); }
  onTestEnd(test, result) {
    for (const root of this.outputDirs || []) sanitizeArtifacts(root, secretValues(process.env));
    // Error messages/stacks, console output, attachments and request headers are
    // deliberately not serialized. A stable ID binds status to the test source.
    console.log('ORKTO_SAFE_RESULT ' + JSON.stringify({
      id: createHash('sha256').update(test.titlePath().join(' > ')).digest('hex').slice(0, 16),
      status: result.status,
      errors: result.errors.map(errorClass),
    }));
  }
  onStdOut() {}
  onStdErr() {}
  onError(error) { console.log('ORKTO_SAFE_RESULT ' + JSON.stringify({ status: 'runner_error', errors: [errorClass(error)] })); }
  printsToStdio() { return true; }
}
