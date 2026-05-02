// S13-T1 pre-flight: verifies user_pillar_levels schema + endpoint absence
// before T1 writes the POST /api/users/pillar-levels handler and the
// 3-screen onboarding flow.
//
// Run from server/: node --env-file=.env scripts/preflight-s13-t1-shape.mjs
//
// Seven checks, ordered:
//   1. user_pillar_levels table exists with required columns
//      (user_id, pillar, level, source) at expected types.
//   2. Unique (or primary-key) constraint covering (user_id, pillar) exists.
//      Required for the upsert ON CONFLICT (user_id, pillar) target.
//   3. pillar column accepts only {strength, yoga, breathwork}.
//   4. level column accepts only {beginner, intermediate, advanced}.
//   5. source column accepts 'declared'.
//   6. Whether POST /api/users/pillar-levels handler already exists in
//      server/src/routes/. Informational — determines whether T1 adds it.
//   7. Whether GET /api/users/me/pillar-levels handler already exists.
//      Informational — same.
//
// Checks 1-5 halt the build on failure (STOP: prefix, exit 2). Checks 6-7
// are informational; their EXISTS / NEEDS_CREATION result is reported in
// the summary so the implementation knows which path to take.
//
// Modeled on preflight-s13-t2-shape.mjs.

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../src/db/pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROUTES_DIR = path.resolve(__dirname, '..', 'src', 'routes');

let stop = false;
let postHandler = null;
let getHandler = null;

function header(label) {
  console.log(`\n=== ${label} ===`);
}
function fail(msg) {
  console.error(`STOP: ${msg}`);
  stop = true;
}
function pass(msg) {
  console.log(`PASS: ${msg}`);
}
function info(msg) {
  console.log(`INFO: ${msg}`);
}

async function main() {
  console.log('=== S13-T1 pre-flight ===');

  // ── (1) Required columns ────────────────────────────────────────────
  header('(1) user_pillar_levels columns');
  const colsRes = await pool.query(`
    SELECT column_name, data_type, udt_name, is_nullable
      FROM information_schema.columns
     WHERE table_name = 'user_pillar_levels'
     ORDER BY ordinal_position
  `);
  if (colsRes.rows.length === 0) {
    fail("user_pillar_levels table does not exist (S11-T4 dependency missing)");
  } else {
    console.table(colsRes.rows);
    const colByName = Object.fromEntries(colsRes.rows.map((r) => [r.column_name, r]));
    const required = {
      user_id: ['integer', 'bigint'],
      pillar:  ['text', 'character varying', 'USER-DEFINED'],
      level:   ['text', 'character varying', 'USER-DEFINED'],
      source:  ['text', 'character varying', 'USER-DEFINED'],
    };
    for (const [name, validTypes] of Object.entries(required)) {
      const col = colByName[name];
      if (!col) {
        fail(`required column missing: ${name}`);
      } else if (!validTypes.includes(col.data_type)) {
        fail(`column ${name} has data_type '${col.data_type}' (expected one of: ${validTypes.join(', ')})`);
      } else {
        const detail = col.data_type === 'USER-DEFINED' ? `${col.data_type} -> ${col.udt_name}` : col.data_type;
        pass(`column ${name} (${detail})`);
      }
    }
  }

  // ── (2) Unique constraint on (user_id, pillar) ──────────────────────
  header('(2) unique-or-PK constraint covering (user_id, pillar)');
  const conRes = await pool.query(`
    SELECT conname, contype, pg_get_constraintdef(oid) AS def
      FROM pg_constraint
     WHERE conrelid = 'user_pillar_levels'::regclass
       AND contype IN ('u', 'p')
  `);
  console.table(conRes.rows);
  const matchingCon = conRes.rows.find((r) => {
    const def = r.def.toLowerCase();
    if (!(def.startsWith('unique') || def.startsWith('primary key'))) return false;
    const cols = (def.match(/\(([^)]+)\)/) || [, ''])[1]
      .split(',')
      .map((s) => s.trim().replace(/^"|"$/g, ''));
    return cols.includes('user_id') && cols.includes('pillar');
  });
  if (matchingCon) {
    pass(`(user_id, pillar) covered by '${matchingCon.conname}': ${matchingCon.def}`);
  } else {
    fail("no UNIQUE or PRIMARY KEY constraint covers (user_id, pillar) — upsert ON CONFLICT will fail");
  }

  // ── (3) pillar domain ───────────────────────────────────────────────
  header('(3) pillar accepts only {strength, yoga, breathwork}');
  await checkColumnDomain('pillar', ['strength', 'yoga', 'breathwork'], { strict: true });

  // ── (4) level domain ────────────────────────────────────────────────
  header('(4) level accepts only {beginner, intermediate, advanced}');
  await checkColumnDomain('level', ['beginner', 'intermediate', 'advanced'], { strict: true });

  // ── (5) source accepts 'declared' ───────────────────────────────────
  header("(5) source accepts 'declared'");
  await checkColumnDomain('source', ['declared'], { strict: false });

  // ── (6) POST /api/users/pillar-levels ───────────────────────────────
  header('(6) POST /api/users/pillar-levels handler');
  postHandler = grepRouteHandler({ method: 'post', routePath: '/pillar-levels' });
  if (postHandler.found) {
    info(`endpoint EXISTS at ${postHandler.file}:${postHandler.line}`);
  } else {
    info('endpoint NEEDS_CREATION — T1 will add it to server/src/routes/users.js');
  }

  // ── (7) GET /api/users/me/pillar-levels ─────────────────────────────
  header('(7) GET /api/users/me/pillar-levels handler');
  getHandler = grepRouteHandler({ method: 'get', routePath: '/me/pillar-levels' });
  if (getHandler.found) {
    info(`endpoint EXISTS at ${getHandler.file}:${getHandler.line}`);
  } else {
    info('endpoint NEEDS_CREATION — T1 will add it to server/src/routes/users.js');
  }

  // ── Summary ─────────────────────────────────────────────────────────
  console.log('\n=== T1 PRE-FLIGHT SUMMARY ===');
  console.log(`  Check 6 (POST handler): ${postHandler.found ? 'EXISTS' : 'NEEDS_CREATION'}`);
  console.log(`  Check 7 (GET handler):  ${getHandler.found ? 'EXISTS' : 'NEEDS_CREATION'}`);
  if (stop) {
    console.error('\n==> STOP: one or more shape checks failed. Surface to PM before building.');
    process.exitCode = 2;
  } else {
    console.log('\n==> All shape checks PASSED. T1 may proceed with the build path indicated above.');
    process.exitCode = 0;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────

async function checkColumnDomain(columnName, expectedValues, { strict }) {
  const colTypeRes = await pool.query(
    `SELECT data_type, udt_name
       FROM information_schema.columns
      WHERE table_name = 'user_pillar_levels' AND column_name = $1`,
    [columnName]
  );
  if (colTypeRes.rows.length === 0) {
    fail(`column ${columnName} not found`);
    return;
  }
  const { data_type, udt_name } = colTypeRes.rows[0];

  let allowed = null;
  let domainSource = null;

  if (data_type === 'USER-DEFINED') {
    const enumRes = await pool.query(
      `SELECT e.enumlabel
         FROM pg_enum e
         JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = $1
        ORDER BY e.enumsortorder`,
      [udt_name]
    );
    allowed = enumRes.rows.map((r) => r.enumlabel);
    domainSource = `enum ${udt_name}`;
    info(`${domainSource} labels: [${allowed.join(', ')}]`);
  } else {
    const checkRes = await pool.query(`
      SELECT conname, pg_get_constraintdef(oid) AS def
        FROM pg_constraint
       WHERE conrelid = 'user_pillar_levels'::regclass
         AND contype = 'c'
    `);
    const matching = checkRes.rows.filter((r) =>
      new RegExp(`\\b${columnName}\\b`).test(r.def)
    );
    if (matching.length === 0) {
      // No CHECK — column is free-text. For 'declared' on source this is fine; for strict pillar/level we treat it as a fail.
      if (strict) {
        fail(`no CHECK constraint on column ${columnName} — domain unconstrained, T1 cannot trust column values`);
      } else {
        info(`no CHECK constraint on ${columnName} — column is unconstrained ${data_type}, [${expectedValues.join(', ')}] accepted by default`);
        pass(`[${expectedValues.join(', ')}] accepted (unconstrained ${data_type})`);
      }
      // Still validate existing rows.
      await validateExistingRows(columnName, expectedValues, { strict });
      return;
    }
    info(`CHECK constraints referencing ${columnName}:`);
    for (const c of matching) console.log(`    ${c.conname}: ${c.def}`);
    const literals = matching.flatMap((c) =>
      [...c.def.matchAll(/'([^']+)'/g)].map((m) => m[1])
    );
    allowed = [...new Set(literals)];
    domainSource = `CHECK constraint`;
    info(`extracted ${domainSource} literals: [${allowed.join(', ')}]`);
  }

  // Verify expected ⊆ allowed.
  const missing = expectedValues.filter((v) => !allowed.includes(v));
  if (missing.length > 0) {
    fail(`column ${columnName} (${domainSource}) does not accept: [${missing.join(', ')}]`);
  } else {
    pass(`column ${columnName} accepts all of: [${expectedValues.join(', ')}]`);
  }

  // Strict mode: also assert no unexpected extra values in allowed (catches drift like a 4th level).
  if (strict) {
    const extra = allowed.filter((v) => !expectedValues.includes(v));
    if (extra.length > 0) {
      fail(`column ${columnName} (${domainSource}) accepts extra values not in spec: [${extra.join(', ')}] — taxonomy drift`);
    }
  } else {
    const extra = allowed.filter((v) => !expectedValues.includes(v));
    if (extra.length > 0) {
      info(`column ${columnName} also accepts other values: [${extra.join(', ')}] (informational)`);
    }
  }

  await validateExistingRows(columnName, expectedValues, { strict });
}

async function validateExistingRows(columnName, expectedValues, { strict }) {
  const allowedRes = await pool.query(
    `SELECT DISTINCT ${columnName} AS v FROM user_pillar_levels`
  );
  const existing = allowedRes.rows.map((r) => r.v).filter((v) => v !== null);
  if (existing.length === 0) {
    info(`(no existing rows to validate ${columnName})`);
    return;
  }
  if (strict) {
    const unexpected = existing.filter((v) => !expectedValues.includes(v));
    if (unexpected.length > 0) {
      fail(`existing rows have unexpected ${columnName} values: [${unexpected.join(', ')}]`);
    } else {
      pass(`existing rows have only expected ${columnName} values: [${existing.join(', ')}]`);
    }
  } else {
    info(`existing distinct ${columnName} values: [${existing.join(', ')}]`);
  }
}

function grepRouteHandler({ method, routePath }) {
  const files = fs.readdirSync(ROUTES_DIR).filter((f) => f.endsWith('.js'));
  const escapedPath = routePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`router\\.${method}\\s*\\(\\s*['"\`]${escapedPath}['"\`]`);
  for (const file of files) {
    const fullPath = path.join(ROUTES_DIR, file);
    const lines = fs.readFileSync(fullPath, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (re.test(lines[i])) {
        return {
          found: true,
          file: path.relative(path.resolve(__dirname, '..'), fullPath).replace(/\\/g, '/'),
          line: i + 1,
        };
      }
    }
  }
  return { found: false };
}

main()
  .catch((err) => {
    console.error('Pre-flight crashed:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
