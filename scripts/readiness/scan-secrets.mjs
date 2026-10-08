import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const skipDirs = new Set(['.git', 'node_modules']);
const skipNames = new Set(['.env', '.env.local', '.env.production', '.env.staging']);
const allowedExtensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.sql', '.md', '.yml', '.yaml', '.html', '.css', '.svg', '.ps1', '.map', '.log', '.txt']);
const detectors = [
  ['PRIVATE_KEY', /-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/],
  ['GITHUB_TOKEN', /\b(?:gh[pousr]_[A-Za-z0-9_]{30,}|github_pat_[A-Za-z0-9_]{30,})\b/],
  ['SUPABASE_SECRET', /\bsb_secret_[A-Za-z0-9_-]{24,}\b/],
  ['OPENAI_SECRET', /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b/],
  ['GOOGLE_API_KEY', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['JWT_LITERAL', /\beyJ[A-Za-z0-9_-]{30,}\.eyJ[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]{12,}\b/],
];

async function collect(directory, relative = '') {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    const name = path.join(relative, entry.name);
    if (entry.isDirectory()) {
      if (!skipDirs.has(entry.name) && !entry.name.startsWith('.tmp')) files.push(...await collect(path.join(directory, entry.name), name));
    } else if (!(entry.name.startsWith('.env') && entry.name !== '.env.example')
      && !skipNames.has(entry.name) && allowedExtensions.has(path.extname(entry.name).toLowerCase())) files.push(name);
  }
  return files;
}

const targets = process.argv.slice(2).length ? process.argv.slice(2).map((value) => path.resolve(value)) : [root];
const findings = [];
let scanned = 0;
for (const target of targets) {
  const metadata = await stat(target);
  const files = metadata.isDirectory() ? await collect(target) : [path.basename(target)];
  for (const relative of files) {
    const fullPath = metadata.isDirectory() ? path.join(target, relative) : target;
    const contents = await readFile(fullPath, 'utf8');
    scanned += 1;
    for (const [category, pattern] of detectors) {
      for (const matchResult of contents.matchAll(new RegExp(pattern.source, `${pattern.flags}g`))) {
        const match = matchResult[0];
        let metadata;
        let findingCategory = category;
        let blocking = true;
        if (category === 'JWT_LITERAL') {
          try {
            const claims = JSON.parse(Buffer.from(match.split('.')[1], 'base64url').toString('utf8'));
            metadata = { ref: typeof claims.ref === 'string' ? claims.ref : undefined, role: typeof claims.role === 'string' ? claims.role : undefined };
            // Supabase's anon JWT is intentionally shipped to browsers. Report
            // it as public configuration, not a secret; staging artifact
            // boundaries separately reject a production ref.
            if (claims.role === 'anon' && typeof claims.ref === 'string') {
              findingCategory = 'PUBLIC_SUPABASE_ANON_CONFIG';
              blocking = false;
            }
          } catch { metadata = { parsed: false }; }
        }
        findings.push({ file: path.relative(root, fullPath), category: findingCategory, metadata, blocking });
      }
    }
  }
}
for (const finding of findings) console.error(`${finding.category}: ${finding.file}${finding.metadata ? ` ${JSON.stringify(finding.metadata)}` : ''}`);
const blockers = findings.filter(finding => finding.blocking);
const review = findings.filter(finding => !finding.blocking);
const status = blockers.length ? 'FAIL' : review.length ? 'REVIEW' : 'PASS';
console.log(JSON.stringify({ scanned, findings: findings.length, blockers: blockers.length, review: review.length, status }));
process.exitCode = blockers.length ? 1 : 0;
