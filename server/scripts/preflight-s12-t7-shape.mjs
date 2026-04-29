// S12-T7 pre-flight: schema + symbol shape verification for the HTTP surface
// (POST /api/sessions/suggest, GET /api/sessions/last, POST /api/sessions/save-as-routine).
// Run: node --env-file=.env scripts/preflight-s12-t7-shape.mjs
//
// (b) Schema shape — sessions, breathwork_sessions, user_routines, user_routine_exercises,
//     plus per-phase joining/reconstruction surface for /last (session_exercises +
//     sessions.phases_json discovery).
// (c) Symbol shape — auth middleware export, generateSession signature, mount-table,
//     engine throw inventory, focus_areas helper presence.
//
// Pre-flight is the gate. Halts the build on any structural divergence between
// spec assumptions and live reality so the spec/mapper can be amended before we
// write production code that hides the gap.

import 'dotenv/config';
import { pool } from '../src/db/pool.js';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

let stop = false;

function header(label) {
  console.log(`\n=== ${label} ===`);
}
function fail(msg) {
  console.error(`STOP: ${msg}`);
  stop = true;
}
function warn(msg) {
  console.log(`WARN: ${msg}`);
}

async function main() {
  console.log('=== S12-T7 pre-flight ===\n');

  // ── (b) SCHEMA SHAPE ──────────────────────────────────────────────────

  // (b1) sessions table — columns, focus_slug, completed, partial index.
  header('(b1) sessions columns');
  const sCols = await pool.query(`
    SELECT column_name, data_type, is_nullable, character_maximum_length AS max_len
      FROM information_schema.columns
     WHERE table_name = 'sessions'
     ORDER BY ordinal_position
  `);
  console.table(sCols.rows);
  const requiredSessions = ['id', 'user_id', 'type', 'completed', 'focus_slug'];
  for (const c of requiredSessions) {
    if (!sCols.rows.find((r) => r.column_name === c)) {
      fail(`sessions missing required column '${c}'`);
    }
  }
  // Whichever timestamp the /last query orders by — report what's present.
  const tsCols = sCols.rows.filter((r) => /at$|^date$|created/.test(r.column_name)).map((r) => r.column_name);
  console.log(`  sessions timestamp-shaped columns: ${tsCols.join(', ') || '(none)'}`);
  // Spec assumed created_at; reality has started_at + completed_at + date.
  if (!sCols.rows.find((r) => r.column_name === 'completed_at')) {
    warn(`sessions has no 'completed_at' column — /last UNION must use started_at or date instead.`);
  }
  const fsCol = sCols.rows.find((r) => r.column_name === 'focus_slug');
  if (fsCol && fsCol.max_len !== 40) {
    fail(`sessions.focus_slug max_len mismatch — want 40, got ${fsCol.max_len}`);
  }
  // phases_json discovery — Sprint 9 stored 5-phase as JSONB on the sessions row.
  if (sCols.rows.find((r) => r.column_name === 'phases_json')) {
    console.log('  sessions.phases_json present — 5-phase reconstruction can read JSONB directly.');
  } else {
    warn(`sessions.phases_json absent — 5-phase reconstruction would need joining tables.`);
  }

  // (b1.5) sessions partial index on (user_id, focus_slug, created_at|started_at) WHERE completed=true
  header('(b1.5) sessions index on (user_id, focus_slug, *)');
  const sIdx = await pool.query(`
    SELECT i.relname AS index_name,
           array_agg(a.attname ORDER BY array_position(ix.indkey, a.attnum)) AS columns,
           pg_get_indexdef(ix.indexrelid) AS def
      FROM pg_index ix
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_class t ON t.oid = ix.indrelid
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
     WHERE t.relname = 'sessions'
     GROUP BY i.relname, ix.indexrelid
  `);
  const sFocusIdx = sIdx.rows.find((r) => {
    const cols = Array.isArray(r.columns) ? r.columns
      : String(r.columns || '').replace(/^\{|\}$/g, '').split(',').map((s) => s.trim());
    return cols.includes('user_id') && cols.includes('focus_slug');
  });
  if (sFocusIdx) {
    console.log(`  found: ${sFocusIdx.index_name} — ${sFocusIdx.def}`);
  } else {
    warn(`sessions has no (user_id, focus_slug, *) composite index. /last queries may seq-scan.`);
  }

  // (b2) breathwork_sessions table — columns, focus_slug, partial index.
  header('(b2) breathwork_sessions columns');
  const bCols = await pool.query(`
    SELECT column_name, data_type, is_nullable, character_maximum_length AS max_len
      FROM information_schema.columns
     WHERE table_name = 'breathwork_sessions'
     ORDER BY ordinal_position
  `);
  console.table(bCols.rows);
  const requiredBw = ['id', 'user_id', 'completed', 'created_at', 'focus_slug', 'technique_id'];
  for (const c of requiredBw) {
    if (!bCols.rows.find((r) => r.column_name === c)) {
      fail(`breathwork_sessions missing required column '${c}'`);
    }
  }
  const bFsCol = bCols.rows.find((r) => r.column_name === 'focus_slug');
  if (bFsCol && bFsCol.max_len !== 40) {
    fail(`breathwork_sessions.focus_slug max_len mismatch — want 40, got ${bFsCol.max_len}`);
  }

  // (b2.5) breathwork_sessions partial index
  header('(b2.5) breathwork_sessions index on (user_id, focus_slug, created_at)');
  const bIdx = await pool.query(`
    SELECT i.relname AS index_name,
           pg_get_indexdef(ix.indexrelid) AS def
      FROM pg_index ix
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_class t ON t.oid = ix.indrelid
     WHERE t.relname = 'breathwork_sessions'
  `);
  console.table(bIdx.rows);
  const bFocusIdx = bIdx.rows.find((r) => /focus_slug/.test(r.def));
  if (!bFocusIdx) {
    warn(`breathwork_sessions has no focus_slug index. T5 spec said added — verify migrate.js ran.`);
  }

  // (b3) user_routines columns
  header('(b3) user_routines columns');
  const urCols = await pool.query(`
    SELECT column_name, data_type, is_nullable, character_maximum_length AS max_len
      FROM information_schema.columns
     WHERE table_name = 'user_routines'
     ORDER BY ordinal_position
  `);
  console.table(urCols.rows);
  for (const c of ['id', 'user_id', 'name', 'description', 'created_at']) {
    if (!urCols.rows.find((r) => r.column_name === c)) {
      fail(`user_routines missing required column '${c}'`);
    }
  }
  const nameCol = urCols.rows.find((r) => r.column_name === 'name');
  if (nameCol && nameCol.max_len !== 100) {
    fail(`user_routines.name max_len mismatch — want 100, got ${nameCol.max_len}`);
  }

  // (b4) user_routine_exercises columns + UNIQUE(routine_id, position)
  header('(b4) user_routine_exercises columns');
  const ureCols = await pool.query(`
    SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
     WHERE table_name = 'user_routine_exercises'
     ORDER BY ordinal_position
  `);
  console.table(ureCols.rows);
  for (const c of ['id', 'routine_id', 'exercise_id', 'position']) {
    if (!ureCols.rows.find((r) => r.column_name === c)) {
      fail(`user_routine_exercises missing required column '${c}'`);
    }
  }
  header('(b4.5) user_routine_exercises UNIQUE(routine_id, position)');
  const ureUnique = await pool.query(`
    SELECT i.relname AS index_name,
           array_agg(a.attname ORDER BY array_position(ix.indkey, a.attnum)) AS columns,
           ix.indisunique AS is_unique
      FROM pg_index ix
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_class t ON t.oid = ix.indrelid
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
     WHERE t.relname = 'user_routine_exercises'
       AND ix.indisunique
     GROUP BY i.relname, ix.indisunique
  `);
  console.table(ureUnique.rows);
  const positionUnique = ureUnique.rows.find((r) => {
    const cols = Array.isArray(r.columns) ? r.columns
      : String(r.columns || '').replace(/^\{|\}$/g, '').split(',').map((s) => s.trim());
    return cols.includes('routine_id') && cols.includes('position');
  });
  if (!positionUnique) {
    warn(`user_routine_exercises has no UNIQUE(routine_id, position). Save-as-routine writes positions; collision risk if existing routines.js doesn't enforce.`);
  }

  // (b4.6) user_routines does NOT have UNIQUE(user_id, name) — confirm absent (Q7 v1).
  header('(b4.6) user_routines absent UNIQUE(user_id, name) per Q7');
  const urUnique = await pool.query(`
    SELECT i.relname AS index_name,
           array_agg(a.attname ORDER BY array_position(ix.indkey, a.attnum)) AS columns,
           ix.indisunique AS is_unique
      FROM pg_index ix
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_class t ON t.oid = ix.indrelid
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
     WHERE t.relname = 'user_routines'
       AND ix.indisunique
     GROUP BY i.relname, ix.indisunique
  `);
  const userNameUnique = urUnique.rows.find((r) => {
    const cols = Array.isArray(r.columns) ? r.columns
      : String(r.columns || '').replace(/^\{|\}$/g, '').split(',').map((s) => s.trim());
    return cols.includes('user_id') && cols.includes('name');
  });
  if (userNameUnique) {
    fail(`user_routines has UNIQUE(user_id, name) — Q7 says allow duplicates v1; spec needs amendment.`);
  } else {
    console.log('  no UNIQUE(user_id, name) — duplicates allowed v1 per Q7. OK.');
  }

  // (b5) Discovery: every table matching session_* / *_session_*.
  header('(b5) session_* / *_session_* tables (discovery)');
  const sessTables = await pool.query(`
    SELECT tablename FROM pg_tables
     WHERE schemaname = 'public'
       AND (tablename LIKE 'session%' OR tablename LIKE '%_session%' OR tablename LIKE '%session_%')
     ORDER BY tablename
  `);
  console.table(sessTables.rows);

  // (b6) session_exercises columns — used by /last for strength reconstruction.
  header('(b6) session_exercises columns');
  const seCols = await pool.query(`
    SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
     WHERE table_name = 'session_exercises'
     ORDER BY ordinal_position
  `);
  console.table(seCols.rows);
  for (const c of ['session_id', 'exercise_id']) {
    if (!seCols.rows.find((r) => r.column_name === c)) {
      fail(`session_exercises missing required column '${c}'`);
    }
  }

  // (b7) focus_areas slug + focus_type — engine uses focus_type, spec said `type` (drift).
  header('(b7) focus_areas columns');
  const faCols = await pool.query(`
    SELECT column_name, data_type, character_maximum_length AS max_len
      FROM information_schema.columns
     WHERE table_name = 'focus_areas'
     ORDER BY ordinal_position
  `);
  console.table(faCols.rows);
  if (!faCols.rows.find((r) => r.column_name === 'slug')) fail(`focus_areas missing 'slug'`);
  const ftCol = faCols.rows.find((r) => r.column_name === 'focus_type');
  if (!ftCol) {
    fail(`focus_areas missing 'focus_type'. Spec said 'type' — engine actually queries focus_type.`);
  } else {
    console.log(`  focus_areas.focus_type present (engine column). Spec sketch's 'focus.type' is a misnomer; route handler must read 'focus_type'.`);
  }

  // ── (c) SYMBOL SHAPE ──────────────────────────────────────────────────

  // (c1) Auth middleware: name + import path
  header('(c1) auth middleware');
  const middlewareDir = 'src/middleware';
  const authFiles = readdirSync(middlewareDir).filter((f) => /auth/i.test(f));
  for (const f of authFiles) {
    const p = join(middlewareDir, f);
    if (!statSync(p).isFile()) continue;
    const content = readFileSync(p, 'utf8');
    const exports = [...content.matchAll(/^export\s+(?:async\s+)?function\s+(\w+)/gm)].map((m) => m[1]);
    console.log(`  ${p} — exports: ${exports.join(', ') || '(none)'}`);
    if (exports.includes('requireAuth')) {
      console.log(`  GOOD: requireAuth export found.`);
    } else if (exports.includes('authenticate')) {
      warn(`Spec assumed 'requireAuth'; live middleware exports 'authenticate'. T7 imports 'authenticate' instead.`);
    }
  }

  // (c2) generateSession export + signature
  header('(c2) generateSession export');
  const enginePath = 'src/services/suggestionEngine.js';
  const engineSrc = readFileSync(enginePath, 'utf8');
  const genSigMatch = engineSrc.match(/export\s+async\s+function\s+generateSession\s*\(\s*\{([^}]+)\}/);
  if (!genSigMatch) {
    fail(`generateSession not found as named ESM export in ${enginePath}.`);
  } else {
    const params = genSigMatch[1].split(',').map((s) => s.trim()).filter(Boolean);
    console.log(`  generateSession destructures: ${params.join(', ')}`);
    const wantedParams = ['user_id', 'focus_slug', 'entry_point', 'time_budget_min', 'bracket'];
    for (const want of wantedParams) {
      if (!params.includes(want)) fail(`generateSession missing param '${want}' (T3.5 contract).`);
    }
  }

  // (c3) Existing route mount points in src/index.js
  header('(c3) existing /api/* mount table in src/index.js');
  const idxSrc = readFileSync('src/index.js', 'utf8');
  const mounts = [...idxSrc.matchAll(/app\.use\(\s*['"](\/api\/[^'"]+)['"]/g)].map((m) => m[1]);
  for (const m of mounts) console.log(`  ${m}`);
  if (mounts.includes('/api/sessions')) {
    fail(`/api/sessions already mounted — T7 build is idempotent? Inspect.`);
  }
  if (!mounts.includes('/api/session')) {
    warn(`/api/session (singular) not mounted — surprising; T7 mounts /api/sessions (plural) so no collision.`);
  } else {
    console.log(`  /api/session (singular) is the legacy session-execution router; /api/sessions (plural) is T7's new router. Distinct paths, no collision.`);
  }

  // (c4) Engine throw inventory — spec mapper expects 6 substrings; reality drifts.
  header('(c4) engine RangeError inventory');
  const rangeMatches = [...engineSrc.matchAll(/throw new RangeError\(\s*([\s\S]*?)\)\s*;/g)];
  const messages = rangeMatches.map((m) => {
    // Strip leading/trailing whitespace, backticks, quotes — keep the literal-ish text.
    const raw = m[1].trim();
    return raw;
  });
  console.log(`  Found ${rangeMatches.length} RangeError throws:`);
  messages.forEach((msg, i) => console.log(`    [${i + 1}] ${msg.replace(/\s+/g, ' ').slice(0, 160)}`));

  const expectedSubstrings = [
    'body focus requires time_budget_min',
    'state focus requires bracket',
    'invalid bracket value',
    'state focus from',
    'body focus from breathwork_tab',
    'mobility from strength_tab',
  ];
  console.log(`\n  Spec mapper expects these substrings (from build prompt §1.9):`);
  for (const sub of expectedSubstrings) {
    const hit = messages.some((m) => m.includes(sub));
    if (hit) {
      console.log(`    OK   "${sub}" — found in at least one engine throw`);
    } else {
      warn(`    MISS "${sub}" — NOT present in engine throws. Mapper substring needs amendment.`);
    }
  }

  // (c5) getFocusBySlug helper presence
  header('(c5) getFocusBySlug helper presence');
  let foundHelper = false;
  for (const root of ['src/services', 'src/routes', 'src/utils']) {
    let entries = [];
    try { entries = readdirSync(root); } catch { continue; }
    for (const f of entries) {
      const p = join(root, f);
      if (!statSync(p).isFile()) continue;
      const c = readFileSync(p, 'utf8');
      if (/getFocusBySlug|focusBySlug/.test(c)) {
        console.log(`  helper-shaped match in ${p}`);
        foundHelper = true;
      }
    }
  }
  if (!foundHelper) {
    console.log(`  No getFocusBySlug helper found — T7 inlines a small helper in routes/sessions.js.`);
  }

  // (c6) computeEstimatedTotalMin export — spec asks if formatter can reuse it.
  header('(c6) computeEstimatedTotalMin export status');
  const cetExport = /export\s+(?:async\s+)?function\s+computeEstimatedTotalMin/.test(engineSrc);
  if (cetExport) {
    console.log('  exported — formatter can reuse.');
  } else {
    console.log('  NOT exported (private to engine). Formatter writes its own small computation.');
  }

  // ── SUMMARY ───────────────────────────────────────────────────────────
  console.log('\n=== T7 PRE-FLIGHT SUMMARY ===');
  console.log(`Schema (b) checks: ${stop ? 'FAIL' : 'PASS'}`);
  console.log('Symbol (c) findings: see logs above for divergences from spec.');

  if (stop) {
    console.error('\n==> STOP: structural divergence — surface to PM before build proceeds.');
    process.exitCode = 2;
  } else {
    console.log('\n==> Pre-flight OK structurally. Divergences (warn-level) are documented above');
    console.log('    so the build/spec amends them inline in routes/sessions.js header comment.');
    process.exitCode = 0;
  }
}

main()
  .catch((err) => { console.error('Pre-flight crashed:', err); process.exitCode = 1; })
  .finally(() => pool.end());
