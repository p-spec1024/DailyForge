// S13-T2 pre-flight: verifies live focus_areas data shape against the
// GET /api/focus-areas response contract before the route is built.
//
// Run: node --env-file=.env scripts/preflight-s13-t2-shape.mjs
//
// Six checks, all must PASS:
//   1. Row count = 17 (12 body + 5 state).
//   2. Type distribution: body=12, state=5.
//   3. Required columns present (slug, display_name, focus_type, sort_order).
//   4. Zero NULLs in the four returned columns.
//   5. sort_order is unique within each focus_type group.
//   6. State focuses sorted by sort_order match locked order
//      [energize, calm, focus, sleep, recover].
//
// Spec drift notes (resolved before pre-flight was written):
//   - Original prompt referred to columns `type` and `display_order`. Live
//     schema uses `focus_type` and `sort_order`; the route aliases both in
//     SQL so the JSON response matches the spec's shape.
//   - Original prompt locked state-focus order as
//     [energize, focus, calm, sleep, recover]. DB seed order is
//     [energize, calm, focus, sleep, recover]. PM ruling: DB wins;
//     T4 design doc Decision 4 will be amended separately.
//
// On any failed check this script exits non-zero and prints `STOP:` so the
// caller halts before the route is implemented.

import 'dotenv/config';
import { pool } from '../src/db/pool.js';

let stop = false;

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

async function main() {
  console.log('=== S13-T2 pre-flight ===');

  // (1) Row count = 17.
  header('(1) focus_areas row count');
  const cnt = await pool.query(`SELECT COUNT(*)::int AS n FROM focus_areas`);
  const total = cnt.rows[0].n;
  console.log(`  total rows: ${total}`);
  if (total === 17) pass('row count = 17');
  else fail(`row count expected 17, got ${total}`);

  // (2) Type distribution: body=12, state=5, no other types.
  header('(2) focus_areas type distribution');
  const dist = await pool.query(
    `SELECT focus_type, COUNT(*)::int AS n FROM focus_areas GROUP BY focus_type ORDER BY focus_type`
  );
  console.table(dist.rows);
  const byType = Object.fromEntries(dist.rows.map((r) => [r.focus_type, r.n]));
  if (dist.rows.length !== 2) fail(`expected exactly 2 type groups, got ${dist.rows.length}`);
  if (byType.body !== 12) fail(`expected 12 body focuses, got ${byType.body}`);
  if (byType.state !== 5) fail(`expected 5 state focuses, got ${byType.state}`);
  if (byType.body === 12 && byType.state === 5 && dist.rows.length === 2) {
    pass('type distribution: body=12, state=5');
  }

  // (3) Required columns exist with correct types.
  header('(3) focus_areas required columns');
  const cols = await pool.query(`
    SELECT column_name, data_type
      FROM information_schema.columns
     WHERE table_name = 'focus_areas'
     ORDER BY ordinal_position
  `);
  console.table(cols.rows);
  const colsByName = Object.fromEntries(cols.rows.map((r) => [r.column_name, r.data_type]));
  const required = {
    slug:         ['character varying', 'text'],
    display_name: ['character varying', 'text'],
    focus_type:   ['character varying', 'text'],
    sort_order:   ['integer'],
  };
  for (const [name, validTypes] of Object.entries(required)) {
    const dt = colsByName[name];
    if (!dt) {
      fail(`required column missing: ${name}`);
    } else if (!validTypes.includes(dt)) {
      fail(`column ${name} has unexpected data_type '${dt}' (expected one of ${validTypes.join(', ')})`);
    } else {
      pass(`column ${name} (${dt})`);
    }
  }

  // (4) No NULLs in any of the four returned columns.
  header('(4) NULL check on returned columns');
  const nulls = await pool.query(`
    SELECT COUNT(*)::int AS n FROM focus_areas
     WHERE slug IS NULL OR display_name IS NULL OR focus_type IS NULL OR sort_order IS NULL
  `);
  const nullCount = nulls.rows[0].n;
  console.log(`  rows with any NULL in returned cols: ${nullCount}`);
  if (nullCount === 0) pass('no NULLs in returned columns');
  else fail(`${nullCount} row(s) have NULL in slug/display_name/focus_type/sort_order`);

  // (5) sort_order uniqueness within each focus_type.
  header('(5) sort_order uniqueness within focus_type');
  const dups = await pool.query(`
    SELECT focus_type, sort_order, COUNT(*)::int AS n
      FROM focus_areas
     GROUP BY focus_type, sort_order
    HAVING COUNT(*) > 1
  `);
  if (dups.rows.length === 0) {
    pass('sort_order is unique within each focus_type');
  } else {
    console.table(dups.rows);
    fail(`${dups.rows.length} (focus_type, sort_order) collision(s) — render order would be non-deterministic`);
  }

  // (6) State-focus order matches locked order from PM resolution
  // (T4 design doc Decision 4 to be amended to match DB).
  header('(6) state-focus locked order');
  const stateRows = await pool.query(`
    SELECT slug, sort_order
      FROM focus_areas
     WHERE focus_type = 'state'
     ORDER BY sort_order ASC
  `);
  console.table(stateRows.rows);
  const actualOrder = stateRows.rows.map((r) => r.slug);
  const expectedOrder = ['energize', 'calm', 'focus', 'sleep', 'recover'];
  const orderMatch =
    actualOrder.length === expectedOrder.length &&
    actualOrder.every((s, i) => s === expectedOrder[i]);
  if (orderMatch) {
    pass(`state-focus order matches locked sequence: [${expectedOrder.join(', ')}]`);
  } else {
    fail(
      `state-focus order drift — product-decision conflict.\n` +
      `         expected: [${expectedOrder.join(', ')}]\n` +
      `         actual:   [${actualOrder.join(', ')}]`
    );
  }

  // ── SUMMARY ─────────────────────────────────────────────────────────
  console.log('\n=== T2 PRE-FLIGHT SUMMARY ===');
  if (stop) {
    console.error('==> STOP: one or more checks failed. Surface to PM before building the route.');
    process.exitCode = 2;
  } else {
    console.log('==> All 6 checks PASSED. Route handler is safe to write.');
    process.exitCode = 0;
  }
}

main()
  .catch((err) => {
    console.error('Pre-flight crashed:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
