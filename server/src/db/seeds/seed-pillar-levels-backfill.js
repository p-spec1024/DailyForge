import 'dotenv/config';
import { pool } from '../pool.js';

// ---------------------------------------------------------------------------
// S11-T4 — Pillar level backfill
//
// Calls recompute_all_user_pillar_levels(user_id) for every user, then runs
// the verification queries from Trackers/S11-T4-level-tracking-spec.md
// §Verification Queries. Hard-fails (exit 1) if any assertion fails.
//
// Idempotent: re-running produces identical level/source values; only
// computed_at advances.
// ---------------------------------------------------------------------------

async function run() {
  console.log('S11-T4 — Pillar level backfill');

  const users = await pool.query('SELECT id FROM users ORDER BY id');
  const userIds = users.rows.map((r) => r.id);
  console.log(`  Users to process: ${userIds.length}`);

  for (const uid of userIds) {
    await pool.query('SELECT * FROM recompute_all_user_pillar_levels($1)', [uid]);
  }
  console.log(`  recompute_all_user_pillar_levels: called for ${userIds.length} user(s)`);

  // Distribution
  const distRows = await pool.query(`
    SELECT pillar, level, COUNT(*)::int AS n
      FROM user_pillar_levels
     GROUP BY pillar, level
     ORDER BY pillar, level
  `);
  const dist = {};
  for (const r of distRows.rows) {
    dist[r.pillar] ??= { beginner: 0, intermediate: 0, advanced: 0 };
    dist[r.pillar][r.level] = r.n;
  }
  for (const pillar of ['strength', 'yoga', 'breathwork']) {
    dist[pillar] ??= { beginner: 0, intermediate: 0, advanced: 0 };
  }

  // Total row count
  const totalRow = await pool.query('SELECT COUNT(*)::int AS n FROM user_pillar_levels');
  const totalRows = totalRow.rows[0].n;

  console.log('\nBackfill complete:');
  console.log(`  Users processed: ${userIds.length}`);
  console.log(`  Pillar-level rows: ${totalRows}`);
  console.log('  Distribution:');
  for (const pillar of ['strength', 'yoga', 'breathwork']) {
    const d = dist[pillar];
    console.log(`    ${pillar.padEnd(11)} beginner=${d.beginner}  intermediate=${d.intermediate}  advanced=${d.advanced}`);
  }

  // ---- Assertions ----
  const failures = [];

  // Every user must have exactly 3 rows
  const wrongCount = await pool.query(`
    SELECT user_id, COUNT(*)::int AS row_count
      FROM user_pillar_levels
     GROUP BY user_id
    HAVING COUNT(*) <> 3
  `);
  if (wrongCount.rows.length > 0) {
    failures.push(
      `Users without exactly 3 pillar rows: ${wrongCount.rows.length} (e.g. user_id=${wrongCount.rows[0].user_id} has ${wrongCount.rows[0].row_count})`,
    );
  }

  // Total rows = 3 × user count
  const expectedTotal = userIds.length * 3;
  if (totalRows !== expectedTotal) {
    failures.push(`user_pillar_levels total: expected ${expectedTotal} (3 × ${userIds.length} users), got ${totalRows}`);
  }

  // Every row has valid level + source
  const invalid = await pool.query(`
    SELECT COUNT(*)::int AS n FROM user_pillar_levels
     WHERE level NOT IN ('beginner', 'intermediate', 'advanced')
        OR source NOT IN ('declared', 'inferred', 'manual_override')
  `);
  if (invalid.rows[0].n !== 0) {
    failures.push(`Rows with invalid level/source: ${invalid.rows[0].n}`);
  }

  // Every user is referenced (no missing users)
  const usersWithRows = await pool.query(`
    SELECT COUNT(DISTINCT user_id)::int AS n FROM user_pillar_levels
  `);
  if (usersWithRows.rows[0].n !== userIds.length) {
    failures.push(`Distinct users in user_pillar_levels: expected ${userIds.length}, got ${usersWithRows.rows[0].n}`);
  }

  // Idempotency check — re-run on first user, level + source must be unchanged.
  if (userIds.length > 0) {
    const before = await pool.query(
      `SELECT pillar, level, source FROM user_pillar_levels WHERE user_id = $1 ORDER BY pillar`,
      [userIds[0]],
    );
    await pool.query('SELECT * FROM recompute_all_user_pillar_levels($1)', [userIds[0]]);
    const after = await pool.query(
      `SELECT pillar, level, source FROM user_pillar_levels WHERE user_id = $1 ORDER BY pillar`,
      [userIds[0]],
    );
    if (JSON.stringify(before.rows) !== JSON.stringify(after.rows)) {
      failures.push(
        `Idempotency: re-running recompute_all on user_id=${userIds[0]} changed level/source.\n  before: ${JSON.stringify(before.rows)}\n  after:  ${JSON.stringify(after.rows)}`,
      );
    }
  }

  if (failures.length > 0) {
    console.error('\n✗ Backfill assertions FAILED:');
    for (const f of failures) console.error(`  - ${f}`);
    process.exitCode = 1;
    return;
  }

  console.log('\n✓ Every user has exactly 3 pillar-level rows');
  console.log('✓ All level/source values are valid');
  console.log('✓ Idempotency verified (re-run on first user produced identical level/source)');
}

run()
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
