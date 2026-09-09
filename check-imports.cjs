const fs = require('fs');
const path = require('path');

function walk(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(fullPath));
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) files.push(fullPath);
  }
  return files;
}

function findImports(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const issues = [];
  const importRegex = /from\s+['"]([^'"]+)['"]/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const imp = match[1];
    if (imp && (imp.startsWith('./') || imp.startsWith('../'))) {
      const dir = path.dirname(filePath);
      const resolved = path.resolve(dir, imp);
      const exts = ['', '.ts', '.tsx', '.js', '.jsx'];
      const found = exts.some(ext => fs.existsSync(resolved + ext));
      if (!found) {
        issues.push({ file: filePath, unresolved: imp });
      }
    }
  }
  return issues;
}

const allFiles = walk('./src');
let totalIssues = 0;
for (const f of allFiles) {
  const issues = findImports(f);
  if (issues.length > 0) {
    issues.forEach(i => console.log('UNRESOLVED:', i.file, '->', i.unresolved));
    totalIssues += issues.length;
  }
}
if (totalIssues === 0) {
  console.log('All local imports resolve correctly');
} else {
  console.log('Total unresolved:', totalIssues);
}
