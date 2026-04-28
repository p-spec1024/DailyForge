import 'dotenv/config';
import { pool } from '../pool.js';

// ---------------------------------------------------------------------------
// S12-T1 — Settle-eligibility seed
//
// Populates breathwork_techniques.settle_eligible_for on exactly 5 rows.
// Names are the exact stored values verified during S12-T1 pre-flight Q7
// (Apr 28, 2026) — exact-equality match (not ILIKE) so we don't over-match
// 'Visama Vritti' when looking for 'Sama Vritti'.
//
// Idempotent: re-running just rewrites the same 5 arrays. Final assertion
// verifies exactly 5 rows have non-empty settle_eligible_for.
// ---------------------------------------------------------------------------

const SETTLE_MAP = [
  { name: 'Diaphragmatic Breathing', focuses: ['calm', 'sleep', 'energize', 'focus', 'recover'] },
  { name: 'Sama Vritti',             focuses: ['calm'] },
  { name: 'Dirga Pranayama',         focuses: ['sleep', 'recover'] },
  { name: 'Coherent Breathing',      focuses: ['energize'] },
  { name: 'Box Breathing',           focuses: ['focus'] },
];

const EXPECTED_TOTAL = 5;

async function seed() {
  console.log('Seeding S12-T1 settle_eligible_for...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let updated = 0;
    for (const { name, focuses } of SETTLE_MAP) {
      const result = await client.query(
        `UPDATE breathwork_techniques
         SET settle_eligible_for = $1
         WHERE name = $2
         RETURNING id, name, settle_eligible_for`,
        [focuses, name],
      );
      if (result.rowCount === 0) {
        throw new Error(`No technique matched (exact name): "${name}"`);
      }
      if (result.rowCount > 1) {
        throw new Error(`"${name}" matched ${result.rowCount} rows — exact-equality should hit exactly 1`);
      }
      const r = result.rows[0];
      console.log(`  [${r.id}] ${r.name} -> ${JSON.stringify(r.settle_eligible_for)}`);
      updated++;
    }

    await client.query('COMMIT');
    console.log(`  updated=${updated}`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // ---- Assertions (post-commit) ----
  const failures = [];

  const total = await pool.query(
    `SELECT COUNT(*)::int AS n FROM breathwork_techniques
      WHERE array_length(settle_eligible_for, 1) > 0`,
  );
  if (total.rows[0].n !== EXPECTED_TOTAL) {
    failures.push(`settle_eligible_for non-empty rows: expected ${EXPECTED_TOTAL}, got ${total.rows[0].n}`);
  }

  // Diaphragmatic must contain all 5 state focuses.
  const dia = await pool.query(
    `SELECT settle_eligible_for FROM breathwork_techniques WHERE name = 'Diaphragmatic Breathing'`,
  );
  if (dia.rows.length !== 1) {
    failures.push(`Diaphragmatic Breathing row count: expected 1, got ${dia.rows.length}`);
  } else {
    const arr = dia.rows[0].settle_eligible_for || [];
    const required = ['calm', 'sleep', 'energize', 'focus', 'recover'];
    const missing = required.filter((f) => !arr.includes(f));
    if (missing.length > 0) {
      failures.push(`Diaphragmatic missing focuses: ${missing.join(', ')}`);
    }
  }

  // Confirm Visama Vritti was NOT touched (would prove the ILIKE bug returned).
  const visama = await pool.query(
    `SELECT settle_eligible_for FROM breathwork_techniques WHERE name = 'Visama Vritti'`,
  );
  if (visama.rows.length === 1) {
    const arr = visama.rows[0].settle_eligible_for || [];
    if (arr.length > 0) {
      failures.push(`Visama Vritti was incorrectly tagged: ${JSON.stringify(arr)}`);
    }
  }

  if (failures.length > 0) {
    console.error('\n✗ Seed assertions FAILED:');
    for (const f of failures) console.error(`  - ${f}`);
    process.exitCode = 1;
    return;
  }

  console.log(`\n✓ settle_eligible_for seeded: exactly ${total.rows[0].n} rows non-empty`);
  console.log('✓ Diaphragmatic Breathing contains all 5 state focuses');
  console.log('✓ Visama Vritti untouched (ILIKE over-match bug not regressed)');
}

seed()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
