#!/usr/bin/env node
// server/scripts/schema-diff.mjs
//
// Compare two Postgres schemas by introspection. Emits a canonical text
// representation per connection, then runs `git diff --no-index` to surface
// any drift between them. Exit 0 if schemas match, 1 if they differ.
//
// Built for the FS #261 schema audit (May 2026). Retained as permanent
// infrastructure because FS #262 (CI gate — on every PR touching migrate.js,
// re-run this against a fresh Neon branch vs staging) will reuse it.
//
// === Why introspection rather than pg_dump ===
// pg_dump requires the matching server-version binary on PATH (Neon 17.10
// in our case). That's not always available — Windows dev boxes don't ship
// pg_dump by default, and GitHub Actions runners need the matching apt
// package per version. Introspection via pg_catalog uses only the existing
// `pg` npm dep, runs on any Node 18+, and stays portable across environments.
//
// === What's covered ===
// - Tables + columns          (information_schema.columns)
// - Indexes                   (pg_indexes)
// - Views                     (pg_views, definitions whitespace-normalized)
// - Functions                 (pg_proc, body hashed via SHA-256 for compact compare)
// - Constraints               (pg_constraint, full pg_get_constraintdef text)
// - Triggers                  (information_schema.triggers)
//
// === Intentionally excluded ===
// - Owner / role names           (Neon role names differ per branch / project)
// - GRANTs / privileges          (Neon adds per-branch defaults)
// - System catalogs              (only schema='public' is queried)
// - Statistical metadata         (row counts, sizes, last-vacuum — not schema)
// - Sequences as standalone      (SERIAL columns surface via column defaults
//                                 like nextval('foo_id_seq'::regclass), which
//                                 IS captured in the column row)
//
// === How to extend ===
// Add a new pg_catalog query in extractSchema(). Push canonical lines into
// the `lines` array using the same `KIND<two-spaces>schema.name<two-spaces>...`
// shape. Lines are sorted before diff, so insertion order doesn't matter.
// If you add a new KIND, document it in the "What's covered" block above
// so future readers can find it.
//
// === Function-body hashing ===
// pg_get_functiondef returns the full CREATE OR REPLACE FUNCTION ... AS $$...$$
// text, which can be thousands of bytes. The diff would be unreadable. We
// SHA-256 the full text and emit a 16-hex-char prefix. Different bodies →
// different hash. Same body → same hash. A drift surfaces as a hash mismatch
// on a single line; to inspect what changed, re-run extractSchema with
// `EXPLAIN_FUNCTIONS=1` (extended emission mode — see emitFunction below).
//
// === Usage ===
//   node scripts/schema-diff.mjs <conn-A> <conn-B>
//   node scripts/schema-diff.mjs <conn-A> <conn-B> /path/to/output-dir
//
// On match: exits 0 with "=== SCHEMAS MATCH ===".
// On drift: exits 1 with the unified diff streamed to stdout.

import { Client } from 'pg';
import { createHash } from 'crypto';
import { writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { tmpdir } from 'os';
import { join } from 'path';

const [connA, connB, outDirArg] = process.argv.slice(2);
if (!connA || !connB) {
  console.error('usage: node scripts/schema-diff.mjs <conn-A> <conn-B> [out-dir]');
  process.exit(2);
}
const outDir = outDirArg || tmpdir();
const EXPLAIN_FUNCTIONS = process.env.EXPLAIN_FUNCTIONS === '1';

const SQL = {
  columns: `
    SELECT table_schema, table_name, column_name, data_type, is_nullable,
           COALESCE(column_default, '-') AS column_default
      FROM information_schema.columns
     WHERE table_schema = 'public'
     ORDER BY table_schema, table_name, ordinal_position
  `,
  indexes: `
    SELECT schemaname, tablename, indexname, indexdef
      FROM pg_indexes
     WHERE schemaname = 'public'
     ORDER BY schemaname, tablename, indexname
  `,
  views: `
    SELECT schemaname, viewname, definition
      FROM pg_views
     WHERE schemaname = 'public'
     ORDER BY schemaname, viewname
  `,
  functions: `
    SELECT n.nspname AS schema, p.proname AS name,
           pg_get_function_arguments(p.oid) AS args,
           pg_get_function_result(p.oid) AS returns,
           pg_get_functiondef(p.oid) AS def
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
     ORDER BY n.nspname, p.proname, p.oid
  `,
  constraints: `
    SELECT n.nspname AS schema, c.relname AS table_name,
           con.conname, pg_get_constraintdef(con.oid) AS def
      FROM pg_constraint con
      JOIN pg_class c       ON c.oid = con.conrelid
      JOIN pg_namespace n   ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
     ORDER BY n.nspname, c.relname, con.conname
  `,
  triggers: `
    SELECT trigger_schema, event_object_table, trigger_name,
           action_timing, event_manipulation, action_statement
      FROM information_schema.triggers
     WHERE trigger_schema = 'public'
     ORDER BY trigger_schema, event_object_table, trigger_name,
              event_manipulation
  `,
};

function sha16(text) {
  return createHash('sha256').update(text).digest('hex').slice(0, 16);
}

async function extractSchema(conn, label) {
  const client = new Client({ connectionString: conn });
  await client.connect();
  const lines = [];

  const cols = await client.query(SQL.columns);
  for (const r of cols.rows) {
    lines.push(`TABLE       ${r.table_schema}.${r.table_name}  col=${r.column_name}  type=${r.data_type}  nullable=${r.is_nullable}  default=${r.column_default}`);
  }

  const idx = await client.query(SQL.indexes);
  for (const r of idx.rows) {
    lines.push(`INDEX       ${r.schemaname}.${r.tablename}  ${r.indexname}  ${r.indexdef}`);
  }

  const vws = await client.query(SQL.views);
  for (const r of vws.rows) {
    const normalized = r.definition.replace(/\s+/g, ' ').trim();
    lines.push(`VIEW        ${r.schemaname}.${r.viewname}  ${normalized}`);
  }

  const fns = await client.query(SQL.functions);
  for (const r of fns.rows) {
    if (EXPLAIN_FUNCTIONS) {
      // Full body emission, normalized whitespace. Use when a hash diff
      // surfaces and you need to see what changed.
      const normalized = r.def.replace(/\s+/g, ' ').trim();
      lines.push(`FUNCTION    ${r.schema}.${r.name}(${r.args})  returns=${r.returns}  def=${normalized}`);
    } else {
      lines.push(`FUNCTION    ${r.schema}.${r.name}(${r.args})  returns=${r.returns}  body_sha256=${sha16(r.def)}`);
    }
  }

  const cons = await client.query(SQL.constraints);
  for (const r of cons.rows) {
    lines.push(`CONSTRAINT  ${r.schema}.${r.table_name}  ${r.conname}  ${r.def}`);
  }

  const trgs = await client.query(SQL.triggers);
  for (const r of trgs.rows) {
    lines.push(`TRIGGER     ${r.trigger_schema}.${r.event_object_table}  ${r.trigger_name}  ${r.action_timing} ${r.event_manipulation}  ${r.action_statement}`);
  }

  await client.end();
  lines.sort();
  if (label) console.log(`${label}: ${lines.length} schema lines extracted`);
  return lines.join('\n') + '\n';
}

const [schemaA, schemaB] = await Promise.all([
  extractSchema(connA, 'A'),
  extractSchema(connB, 'B'),
]);

const pathA = join(outDir, 'schema-A.txt');
const pathB = join(outDir, 'schema-B.txt');
writeFileSync(pathA, schemaA);
writeFileSync(pathB, schemaB);
console.log(`Wrote ${pathA} and ${pathB}`);
console.log('');

let exitCode = 0;
try {
  // git diff --no-index returns 0 if equal, 1 if differ. stdio: inherit
  // streams the unified diff straight to our stdout for visibility.
  execSync(`git diff --no-index --no-color "${pathA}" "${pathB}"`, { stdio: 'inherit' });
  console.log('\n=== SCHEMAS MATCH ===');
} catch {
  console.log('\n=== SCHEMAS DIFFER (see unified diff above) ===');
  exitCode = 1;
}
process.exit(exitCode);
