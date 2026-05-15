// Compare two schema snapshots produced by snapshot-schema.mjs.
// Read-only, no DB access. Diffs the `.schema` payload only (ignores metadata
// like generatedAt / label / host so two runs of the same DB always compare equal).
// Exits 0 if identical, 1 if any difference, 2 on bad input.
//
// Usage: node scripts/diff-schemas.mjs <left.json> <right.json>

import fs from 'node:fs';
import path from 'node:path';

function load(p) {
  return JSON.parse(fs.readFileSync(path.resolve(p), 'utf8'));
}

function stableStringify(obj) {
  const sort = (val) => {
    if (Array.isArray(val)) return val.map(sort);
    if (val && typeof val === 'object' && val.constructor === Object) {
      return Object.keys(val)
        .sort()
        .reduce((acc, k) => {
          acc[k] = sort(val[k]);
          return acc;
        }, {});
    }
    return val;
  };
  return JSON.stringify(sort(obj), null, 2);
}

const [, , leftPath, rightPath] = process.argv;
if (!leftPath || !rightPath) {
  console.error('Usage: node scripts/diff-schemas.mjs <left.json> <right.json>');
  process.exit(2);
}

const left = load(leftPath);
const right = load(rightPath);
const sa = stableStringify(left.schema);
const sb = stableStringify(right.schema);

console.log(`Left:  ${leftPath}  (${left.label ?? 'unlabeled'})`);
console.log(`Right: ${rightPath}  (${right.label ?? 'unlabeled'})`);
console.log('');

if (sa === sb) {
  console.log('IDENTICAL — schema payloads match byte-for-byte.');
  process.exit(0);
}

console.log('DIFFER — schema payloads do not match.');
console.log('');

const topKeys = new Set([...Object.keys(left.schema), ...Object.keys(right.schema)]);
for (const k of topKeys) {
  const ea = stableStringify(left.schema[k] ?? null);
  const eb = stableStringify(right.schema[k] ?? null);
  console.log(`  ${k}: ${ea === eb ? 'match' : 'DIFFER'}`);
}

if (left.schema.tables && right.schema.tables) {
  const tableKeys = new Set([
    ...Object.keys(left.schema.tables),
    ...Object.keys(right.schema.tables),
  ]);
  const differingTables = [];
  const onlyLeft = [];
  const onlyRight = [];
  for (const t of tableKeys) {
    const a = left.schema.tables[t];
    const b = right.schema.tables[t];
    if (a == null) {
      onlyRight.push(t);
      continue;
    }
    if (b == null) {
      onlyLeft.push(t);
      continue;
    }
    if (stableStringify(a) !== stableStringify(b)) differingTables.push(t);
  }
  if (onlyLeft.length) {
    console.log('');
    console.log('Tables only on left:');
    for (const t of onlyLeft) console.log(`  - ${t}`);
  }
  if (onlyRight.length) {
    console.log('');
    console.log('Tables only on right:');
    for (const t of onlyRight) console.log(`  - ${t}`);
  }
  if (differingTables.length) {
    console.log('');
    console.log('Tables with content differences:');
    for (const t of differingTables) console.log(`  - ${t}`);
  }
}

process.exit(1);
