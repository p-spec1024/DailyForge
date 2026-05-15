// Read-only schema introspection for Neon Postgres. No DB mutations — no prod-guard needed.
// Outputs a stable JSON (sorted keys, no volatile timestamps inside `schema`) and a Markdown summary.
// Used by S15-T1 to capture the production schema contract and verify staging parity.
//
// Usage (from server/):
//   node --env-file=.env scripts/snapshot-schema.mjs [json-out-path] [label]
//
// Defaults:
//   json-out  → <repo>/Trackers/S15-T1-prod-schema-snapshot.json
//   md-out    → <json-out>.replace('.json', '.md')
//   label     → derived from json-out filename ("prod"|"staging") or "snapshot"

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../src/db/pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const DEFAULT_JSON_OUT = path.join(REPO_ROOT, 'Trackers', 'S15-T1-prod-schema-snapshot.json');

const USER_SCHEMA_FILTER = `n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
  AND n.nspname NOT LIKE 'pg_temp%'
  AND n.nspname NOT LIKE 'pg_toast_temp%'`;

async function fetchTables() {
  const { rows } = await pool.query(`
    SELECT n.nspname AS schema, c.relname AS name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
      AND ${USER_SCHEMA_FILTER}
    ORDER BY n.nspname, c.relname
  `);
  return rows;
}

async function fetchColumns(schema, table) {
  const { rows } = await pool.query(
    `SELECT
       column_name AS name,
       ordinal_position AS position,
       data_type,
       udt_name,
       is_nullable,
       column_default,
       character_maximum_length,
       numeric_precision,
       numeric_scale
     FROM information_schema.columns
     WHERE table_schema = $1 AND table_name = $2
     ORDER BY ordinal_position`,
    [schema, table]
  );
  return rows.map((r) => ({
    name: r.name,
    position: r.position,
    type: r.data_type === 'USER-DEFINED' ? r.udt_name : r.data_type,
    udtName: r.udt_name,
    nullable: r.is_nullable === 'YES',
    default: r.column_default,
    characterMaximumLength: r.character_maximum_length,
    numericPrecision: r.numeric_precision,
    numericScale: r.numeric_scale,
  }));
}

const CONTYPE_MAP = { p: 'primary_key', u: 'unique', f: 'foreign_key', c: 'check', x: 'exclusion' };

async function fetchConstraints(schema, table) {
  const { rows } = await pool.query(
    `SELECT
       con.conname AS name,
       con.contype AS type,
       pg_get_constraintdef(con.oid) AS definition
     FROM pg_constraint con
     JOIN pg_class rel ON rel.oid = con.conrelid
     JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
     WHERE nsp.nspname = $1 AND rel.relname = $2
     ORDER BY con.conname`,
    [schema, table]
  );
  return rows.map((r) => ({
    name: r.name,
    type: CONTYPE_MAP[r.type] ?? r.type,
    definition: r.definition,
  }));
}

async function fetchIndexes(schema, table) {
  const { rows } = await pool.query(
    `SELECT indexname AS name, indexdef AS definition
     FROM pg_indexes
     WHERE schemaname = $1 AND tablename = $2
     ORDER BY indexname`,
    [schema, table]
  );
  return rows;
}

async function fetchFunctions() {
  const { rows } = await pool.query(`
    SELECT
      n.nspname AS schema,
      p.proname AS name,
      pg_get_function_identity_arguments(p.oid) AS arguments,
      pg_get_function_result(p.oid) AS return_type,
      l.lanname AS language,
      CASE p.prokind
        WHEN 'f' THEN 'function'
        WHEN 'p' THEN 'procedure'
        WHEN 'a' THEN 'aggregate'
        WHEN 'w' THEN 'window'
        ELSE p.prokind::text
      END AS kind,
      pg_get_functiondef(p.oid) AS definition
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_language l ON l.oid = p.prolang
    WHERE ${USER_SCHEMA_FILTER}
    ORDER BY n.nspname, p.proname, arguments
  `);
  return rows;
}

async function fetchTriggers() {
  const { rows } = await pool.query(`
    SELECT
      n.nspname AS schema,
      c.relname AS "table",
      t.tgname AS name,
      pg_get_triggerdef(t.oid) AS definition
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE NOT t.tgisinternal
      AND ${USER_SCHEMA_FILTER}
    ORDER BY n.nspname, c.relname, t.tgname
  `);
  return rows;
}

async function fetchEnums() {
  const { rows } = await pool.query(`
    SELECT
      n.nspname AS schema,
      t.typname AS name,
      array_agg(e.enumlabel ORDER BY e.enumsortorder) AS values
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE ${USER_SCHEMA_FILTER}
    GROUP BY n.nspname, t.typname
    ORDER BY n.nspname, t.typname
  `);
  return rows;
}

async function fetchSequences() {
  const { rows } = await pool.query(`
    SELECT
      seq_ns.nspname AS schema,
      seq.relname AS name,
      tbl_ns.nspname AS owned_table_schema,
      tbl.relname AS owned_table,
      att.attname AS owned_column
    FROM pg_class seq
    JOIN pg_namespace seq_ns ON seq_ns.oid = seq.relnamespace
    LEFT JOIN pg_depend dep ON dep.objid = seq.oid AND dep.deptype = 'a'
    LEFT JOIN pg_class tbl ON tbl.oid = dep.refobjid
    LEFT JOIN pg_namespace tbl_ns ON tbl_ns.oid = tbl.relnamespace
    LEFT JOIN pg_attribute att
      ON att.attrelid = dep.refobjid AND att.attnum = dep.refobjsubid
    WHERE seq.relkind = 'S'
      AND seq_ns.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
      AND seq_ns.nspname NOT LIKE 'pg_temp%'
      AND seq_ns.nspname NOT LIKE 'pg_toast_temp%'
    ORDER BY seq_ns.nspname, seq.relname
  `);
  return rows;
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

function tableKey(t) {
  return `${t.schema}.${t.name}`;
}

function buildMarkdown(snapshot) {
  const { schema, label, generatedAt, databaseName, databaseHostShort } = snapshot;
  const lines = [];
  const tableEntries = Object.entries(schema.tables).sort((a, b) => a[0].localeCompare(b[0]));
  const totalIndexes = tableEntries.reduce((s, [, t]) => s + t.indexes.length, 0);
  const totalConstraints = tableEntries.reduce((s, [, t]) => s + t.constraints.length, 0);

  lines.push(`# Schema snapshot — ${label}`);
  lines.push('');
  lines.push(`- **Generated:** ${generatedAt}`);
  lines.push(`- **Database:** \`${databaseName}\``);
  lines.push(`- **Host (short):** \`${databaseHostShort}\``);
  lines.push(`- **Source script:** \`server/scripts/snapshot-schema.mjs\``);
  lines.push('');
  lines.push('Schema-only introspection (no row data). Stable JSON sidecar at the matching `.json` path is the authoritative diff target.');
  lines.push('');
  lines.push('## Object counts');
  lines.push('');
  lines.push('| Object | Count |');
  lines.push('|---|---|');
  lines.push(`| Tables | ${tableEntries.length} |`);
  lines.push(`| Functions | ${schema.functions.length} |`);
  lines.push(`| Triggers | ${schema.triggers.length} |`);
  lines.push(`| Enums | ${schema.enums.length} |`);
  lines.push(`| Sequences | ${schema.sequences.length} |`);
  lines.push(`| Indexes (sum across tables) | ${totalIndexes} |`);
  lines.push(`| Constraints (sum across tables) | ${totalConstraints} |`);
  lines.push('');
  lines.push('## Tables');
  lines.push('');
  lines.push('| Schema | Table | Columns | Indexes | Constraints |');
  lines.push('|---|---|---|---|---|');
  for (const [key, t] of tableEntries) {
    const [s, n] = key.split('.');
    lines.push(`| ${s} | ${n} | ${t.columns.length} | ${t.indexes.length} | ${t.constraints.length} |`);
  }
  lines.push('');
  lines.push('## Functions');
  lines.push('');
  if (schema.functions.length === 0) {
    lines.push('_None._');
  } else {
    for (const f of schema.functions) {
      lines.push(`- \`${f.schema}.${f.name}(${f.arguments})\` → \`${f.return_type}\` [${f.kind}, ${f.language}]`);
    }
  }
  lines.push('');
  lines.push('## Triggers');
  lines.push('');
  if (schema.triggers.length === 0) {
    lines.push('_None._');
  } else {
    for (const t of schema.triggers) {
      lines.push(`- \`${t.schema}.${t.table}\` :: \`${t.name}\``);
    }
  }
  lines.push('');
  lines.push('## Enums');
  lines.push('');
  if (schema.enums.length === 0) {
    lines.push('_None._');
  } else {
    for (const e of schema.enums) {
      lines.push(`- \`${e.schema}.${e.name}\` = [${e.values.map((v) => `\`${v}\``).join(', ')}]`);
    }
  }
  lines.push('');
  lines.push('## Sequences');
  lines.push('');
  if (schema.sequences.length === 0) {
    lines.push('_None._');
  } else {
    for (const s of schema.sequences) {
      const owner = s.owned_table
        ? `${s.owned_table_schema}.${s.owned_table}.${s.owned_column}`
        : '(unowned)';
      lines.push(`- \`${s.schema}.${s.name}\` ← \`${owner}\``);
    }
  }
  lines.push('');
  return lines.join('\n');
}

function deriveLabel(jsonOut) {
  const base = path.basename(jsonOut).toLowerCase();
  if (base.includes('staging')) return 'staging (Neon `staging` branch)';
  if (base.includes('prod')) return 'production (Neon `production` branch)';
  return 'snapshot';
}

async function main() {
  const jsonOut = path.resolve(process.argv[2] || DEFAULT_JSON_OUT);
  const mdOut = jsonOut.replace(/\.json$/, '.md');
  const label = process.argv[3] || deriveLabel(jsonOut);

  const { rows: [info] } = await pool.query(
    `SELECT current_database() AS db, inet_server_addr()::text AS host`
  );

  const databaseUrl = process.env.DATABASE_URL || '';
  const hostMatch = databaseUrl.match(/@([^/]+)/);
  const databaseHostShort = hostMatch ? hostMatch[1].split('.')[0] : info?.host ?? 'unknown';

  const tables = await fetchTables();
  const tableMap = {};
  for (const t of tables) {
    const [columns, constraints, indexes] = await Promise.all([
      fetchColumns(t.schema, t.name),
      fetchConstraints(t.schema, t.name),
      fetchIndexes(t.schema, t.name),
    ]);
    tableMap[tableKey(t)] = { columns, constraints, indexes };
  }

  const [functions, triggers, enums, sequences] = await Promise.all([
    fetchFunctions(),
    fetchTriggers(),
    fetchEnums(),
    fetchSequences(),
  ]);

  const snapshot = {
    snapshotVersion: '1.0',
    generatedAt: new Date().toISOString(),
    label,
    databaseName: info?.db ?? 'unknown',
    databaseHostShort,
    schema: {
      tables: tableMap,
      functions,
      triggers,
      enums,
      sequences,
    },
  };

  fs.writeFileSync(jsonOut, stableStringify(snapshot) + '\n', 'utf8');
  fs.writeFileSync(mdOut, buildMarkdown(snapshot), 'utf8');

  console.log(`Wrote ${jsonOut}`);
  console.log(`Wrote ${mdOut}`);
  console.log(
    `Tables: ${Object.keys(tableMap).length} | Functions: ${functions.length} | ` +
    `Triggers: ${triggers.length} | Enums: ${enums.length} | Sequences: ${sequences.length}`
  );

  await pool.end();
}

main().catch((err) => {
  console.error('Snapshot failed:', err);
  process.exit(1);
});
