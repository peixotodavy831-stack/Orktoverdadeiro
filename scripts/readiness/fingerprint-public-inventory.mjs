import { readFileSync } from 'node:fs';

const file = process.argv[2];
if (!file) throw new Error('Usage: node scripts/readiness/fingerprint-public-inventory.mjs <inventory.json>');
const inventory = JSON.parse(readFileSync(file, 'utf8'));
const sections = ['tables', 'columns', 'types', 'constraints', 'indexes', 'policies', 'grants',
  'columnGrants', 'schemaGrants', 'defaultPrivileges', 'sequences', 'sequenceGrants',
  'functions', 'functionGrants', 'triggers'];
const stable = (value) => Array.isArray(value) ? value.map(stable)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])) : value;
const fingerprint = (value) => {
  let hash = 0xcbf29ce484222325n;
  for (const char of JSON.stringify(stable(value))) {
    hash ^= BigInt(char.charCodeAt(0));
    hash = (hash * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return hash.toString(16).padStart(16, '0');
};
console.log(JSON.stringify(Object.fromEntries(sections.map((section) => {
  const objects = inventory[section].filter((item) => item.schema === 'public');
  return [section, { count: objects.length, fingerprint: fingerprint(objects) }];
}))));
