// S12-T6 pre-flight: schema verification + swap-handler discovery.
// Run: node --env-file=.env scripts/preflight-s12-t6-schema.mjs
//
// (b) Schema shape — verify exercise_swap_counts and user_excluded_exercises
//     match the T1 spec (Trackers/S12-suggestion-engine-spec.md lines 158–171).
// (c) Handler shape — grep server/src/routes/ for the strength swap surface;
//     report all candidates and halt for human selection.

import 'dotenv/config';
import { pool } from '../src/db/pool.js';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

let stop = false;

function header(label) {
  console.log(`\n=== ${label} ===`);
}

async function main() {
  console.log('=== S12-T6 pre-flight ===\n');

  // ── (b) SCHEMA SHAPE ──

  // 1. exercise_swap_counts table + columns
  header('(b1) exercise_swap_counts columns');
  const escCols = await pool.query(`
    SELECT column_name, data_type, is_nullable, column_default,
           character_maximum_length AS max_len
      FROM information_schema.columns
     WHERE table_name = 'exercise_swap_counts'
     ORDER BY ordinal_position
  `);
  console.table(escCols.rows);
  if (escCols.rows.length === 0) {
    console.error('STOP: exercise_swap_counts table missing — T1 schema not applied?');
    stop = true;
  } else {
    const expected = {
      id:               { type: 'integer',                   nullable: 'NO'  },
      user_id:          { type: 'integer',                   nullable: 'NO'  },
      exercise_id:      { type: 'integer',                   nullable: 'NO'  },
      swap_count:       { type: 'integer',                   nullable: 'NO'  },
      last_swapped_at:  { type: 'timestamp with time zone',  nullable: 'YES' },
      prompt_state:     { type: 'character varying',         nullable: 'NO',  max_len: 20 },
    };
    for (const [name, want] of Object.entries(expected)) {
      const live = escCols.rows.find((r) => r.column_name === name);
      if (!live) {
        console.error(`STOP: exercise_swap_counts missing column '${name}'`);
        stop = true;
        continue;
      }
      if (live.data_type !== want.type) {
        console.error(`STOP: exercise_swap_counts.${name} type mismatch — want=${want.type} live=${live.data_type}`);
        stop = true;
      }
      if (live.is_nullable !== want.nullable) {
        console.error(`STOP: exercise_swap_counts.${name} nullable mismatch — want=${want.nullable} live=${live.is_nullable}`);
        stop = true;
      }
      if (want.max_len != null && live.max_len !== want.max_len) {
        console.error(`STOP: exercise_swap_counts.${name} max_len mismatch — want=${want.max_len} live=${live.max_len}`);
        stop = true;
      }
    }
  }

  // 1b. exercise_swap_counts CHECK constraint on prompt_state
  header('(b1.5) exercise_swap_counts CHECK on prompt_state');
  const escCheck = await pool.query(`
    SELECT con.conname, pg_get_constraintdef(con.oid) AS definition
      FROM pg_constraint con
      JOIN pg_class cls ON cls.oid = con.conrelid
     WHERE cls.relname = 'exercise_swap_counts'
       AND con.contype = 'c'
  `);
  console.table(escCheck.rows);
  const promptCheck = escCheck.rows.find((r) =>
    /prompt_state/.test(r.definition) && /never_prompted|prompted_keep|excluded/.test(r.definition)
  );
  if (!promptCheck) {
    console.error('STOP: exercise_swap_counts.prompt_state CHECK constraint missing.');
    stop = true;
  } else {
    for (const v of ['never_prompted', 'prompted_keep', 'excluded']) {
      if (!promptCheck.definition.includes(`'${v}'`)) {
        console.error(`STOP: prompt_state CHECK does not mention '${v}'. Definition: ${promptCheck.definition}`);
        stop = true;
      }
    }
  }

  // 1c. exercise_swap_counts UNIQUE(user_id, exercise_id)
  header('(b1.6) exercise_swap_counts UNIQUE(user_id, exercise_id)');
  const escUnique = await pool.query(`
    SELECT i.relname AS index_name,
           array_agg(a.attname ORDER BY array_position(ix.indkey, a.attnum)) AS columns,
           ix.indisunique AS is_unique
      FROM pg_index ix
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_class t ON t.oid = ix.indrelid
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
     WHERE t.relname = 'exercise_swap_counts'
       AND ix.indisunique
     GROUP BY i.relname, ix.indisunique
  `);
  console.table(escUnique.rows);
  // Postgres returns array_agg as a text-formatted '{user_id,exercise_id}' string
  // for some array shapes; normalize to JS array before set-membership checks.
  const userExUnique = escUnique.rows.find((r) => {
    const cols = Array.isArray(r.columns)
      ? r.columns
      : String(r.columns || '').replace(/^\{|\}$/g, '').split(',').map((s) => s.trim());
    return cols.includes('user_id') && cols.includes('exercise_id');
  });
  if (!userExUnique) {
    console.error('STOP: exercise_swap_counts UNIQUE(user_id, exercise_id) missing.');
    stop = true;
  }

  // 2. user_excluded_exercises table + columns
  header('(b2) user_excluded_exercises columns');
  const ueeCols = await pool.query(`
    SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
     WHERE table_name = 'user_excluded_exercises'
     ORDER BY ordinal_position
  `);
  console.table(ueeCols.rows);
  if (ueeCols.rows.length === 0) {
    console.error('STOP: user_excluded_exercises table missing.');
    stop = true;
  } else {
    for (const want of ['user_id', 'exercise_id']) {
      const live = ueeCols.rows.find((r) => r.column_name === want);
      if (!live) {
        // exercise_id is actually content_id in some T1 designs — verify
        if (want === 'exercise_id') {
          const altLive = ueeCols.rows.find((r) => r.column_name === 'content_id');
          if (altLive) {
            console.error(
              `WARN: user_excluded_exercises uses 'content_id' instead of 'exercise_id'. ` +
              `Engine reads (line in T2 suggestionEngine.js: SELECT content_id FROM user_excluded_exercises WHERE content_type='strength'). ` +
              `Spec line 174 in S12-T1 schema confirms (content_type, content_id) shape. T6 endpoints must INSERT with this shape.`
            );
            continue;
          }
        }
        console.error(`STOP: user_excluded_exercises missing column '${want}'`);
        stop = true;
      }
    }
  }

  // 2b. user_excluded_exercises UNIQUE
  header('(b2.5) user_excluded_exercises UNIQUE constraint');
  const ueeUnique = await pool.query(`
    SELECT i.relname AS index_name,
           array_agg(a.attname ORDER BY array_position(ix.indkey, a.attnum)) AS columns,
           ix.indisunique AS is_unique
      FROM pg_index ix
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_class t ON t.oid = ix.indrelid
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
     WHERE t.relname = 'user_excluded_exercises'
       AND ix.indisunique
     GROUP BY i.relname, ix.indisunique
  `);
  console.table(ueeUnique.rows);
  if (ueeUnique.rows.length === 0) {
    console.error('STOP: user_excluded_exercises has no UNIQUE index.');
    stop = true;
  }

  // 3. exercises has id PK
  header('(b3) exercises.id PK');
  const exPK = await pool.query(`
    SELECT a.attname AS column, t.typname AS type
      FROM pg_index ix
      JOIN pg_class c ON c.oid = ix.indrelid
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY(ix.indkey)
      JOIN pg_type t ON t.oid = a.atttypid
     WHERE c.relname = 'exercises' AND ix.indisprimary
  `);
  console.table(exPK.rows);
  if (exPK.rows.length === 0 || exPK.rows[0].column !== 'id') {
    console.error('STOP: exercises has no id PK.');
    stop = true;
  }

  // ── (c) HANDLER SHAPE ──

  header('(c) Strength swap handler discovery');
  const ROUTES_DIR = 'src/routes';
  const candidates = [];
  for (const f of readdirSync(ROUTES_DIR)) {
    if (!f.endsWith('.js')) continue;
    const path = join(ROUTES_DIR, f);
    if (!statSync(path).isFile()) continue;
    const content = readFileSync(path, 'utf8');
    const lines = content.split('\n');
    // Match: route definitions adjacent to swap/choose/exercise-pref/swap_counts.
    // Look for `router.<verb>(...)` lines whose path or surrounding context references the swap surface.
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isRouteDef = /^\s*router\.(get|post|put|patch|delete)\s*\(/i.test(line);
      if (!isRouteDef) continue;
      const ctx = lines.slice(Math.max(0, i - 1), Math.min(lines.length, i + 8)).join('\n');
      // Match if the route or context mentions swap concepts.
      if (/swap|chosen_exercise_id|exercise[-_]pref|slot.*choose/i.test(ctx)) {
        candidates.push({
          file: path,
          line: i + 1,
          signature: line.trim(),
          context: lines.slice(i, Math.min(lines.length, i + 6)).map((l) => '    ' + l).join('\n'),
        });
      }
    }
    // Also bare grep for explicit `exercise_swap_counts` references.
    for (let i = 0; i < lines.length; i++) {
      if (/exercise_swap_counts/i.test(lines[i])) {
        candidates.push({
          file: path,
          line: i + 1,
          signature: lines[i].trim(),
          context: lines.slice(Math.max(0, i - 1), Math.min(lines.length, i + 4)).map((l) => '    ' + l).join('\n'),
        });
      }
    }
  }

  console.log(`\nFound ${candidates.length} candidate handler/reference(s) for the strength swap surface:\n`);
  candidates.forEach((c, idx) => {
    console.log(`  ${idx + 1}. ${c.file}:${c.line}  ${c.signature}`);
    console.log(c.context);
    console.log('');
  });

  if (candidates.length === 0) {
    console.error('STOP: zero swap-handler candidates found. Spec assumed an existing handler to extend.');
    console.error('Surface to PM — re-spec needed.');
    stop = true;
  }

  // === Summary ===
  console.log('\n=== T6 PRE-FLIGHT: HANDLER CANDIDATES ===');
  console.log(`Schema check: ${stop ? 'FAIL' : 'PASS'}`);
  console.log(`Found ${candidates.length} candidate handler/reference(s).`);
  console.log('Spec requires exactly one handler to extend (Decision 1).');
  console.log('If exactly one of the above looks like the strength swap, build proceeds by reporting which.');
  console.log('If multiple plausible candidates or zero matches, halt and surface to PM.\n');

  if (stop) {
    console.error('==> STOP: schema or handler-discovery problem.');
    process.exitCode = 2;
  } else {
    console.log('==> Schema clean. Handler candidates listed above for human selection.');
    process.exitCode = 0;
  }
}

main()
  .catch((err) => { console.error('Pre-flight crashed:', err); process.exitCode = 1; })
  .finally(() => pool.end());
