import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const fallbackUrl = 'https://orktoverdadeiro-production.up.railway.app';
const configuredUrl = process.env.PUBLIC_SITE_URL || process.env.APP_URL || fallbackUrl;
const publicUrl = configuredUrl.trim().replace(/\/+$/, '');
const distDirectory = path.resolve('dist');

async function replaceUrl(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await replaceUrl(filePath);
      continue;
    }

    if (!/\.(?:html|xml|txt)$/.test(entry.name)) continue;
    const original = await readFile(filePath, 'utf8');
    const updated = original.replaceAll(fallbackUrl, publicUrl);
    if (updated !== original) await writeFile(filePath, updated, 'utf8');
  }
}

await replaceUrl(distDirectory);
console.log(`[ORKTO] URL pública aplicada aos arquivos de busca: ${publicUrl}`);
