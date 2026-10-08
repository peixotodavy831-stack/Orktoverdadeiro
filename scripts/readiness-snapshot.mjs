import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, copyFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
const output = await import('node:fs/promises').then(fs => fs.mkdtemp(path.join(os.tmpdir(), 'orkto-readiness-snapshot-')));
const files = [...new Set(git('ls-files', '-z', '--cached', '--others', '--exclude-standard').split('\0').filter(Boolean))];
const manifest = [];
for (const file of files) {
  if (/(^|\/)(\.env(?:\..*)?|\.git|\.temp|node_modules)(\/|$)|\.(pem|key|p12)$/i.test(file)) continue;
  try {
    const contents = await readFile(path.join(root, file));
    manifest.push({ file, sha256: createHash('sha256').update(contents).digest('hex'), bytes: contents.length });
    const dest = path.join(output, 'source', file);
    await mkdir(path.dirname(dest), { recursive: true });
    await copyFile(path.join(root, file), dest);
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
async function hashes(directory, prefix = '') {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(prefix, entry.name);
    if (entry.isDirectory()) result.push(...await hashes(path.join(directory, entry.name), file));
    else result.push({ file, sha256: createHash('sha256').update(await readFile(path.join(directory, entry.name))).digest('hex') });
  }
  return result.sort((a, b) => a.file.localeCompare(b.file));
}
const report = { createdAt: new Date().toISOString(), root, head: git('rev-parse', 'HEAD').trim(), branch: git('branch', '--show-current').trim(), status: git('status', '--short'), files: manifest, dist: await hashes(path.join(root, 'dist')) };
await writeFile(path.join(output, 'manifest.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ snapshot: output, head: report.head, files: manifest.length, distFiles: report.dist.length }));
