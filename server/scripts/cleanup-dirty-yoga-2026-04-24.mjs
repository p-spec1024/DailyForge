// One-off cleanup migration applied 2026-04-24 — DO NOT RE-RUN.
// Hardcoded exercise IDs are valid only against the snapshot they were
// authored against. Kept in repo as an audit trail of the dirty-yoga
// cleanup that followed S10-T5b code review (see SPRINT_TRACKER.md).
//
// Operations (single transaction):
//   1. Re-point session_exercises 1133 → 961 (Standing forward bend dupe)
//   2. Delete 11 dirty yoga rows that had a clean canonical or were
//      Sanskrit-source errors:
//        Group 1 (canonical exists, no FK refs)        : 1109 1110 1112 1118 1124 1128
//          Bridge / Cat / Corpse / Pigeon / Upward-Facing Dog / Wild Thing
//        Group 2 (Warrior One/Two/Three = I/II/III)    : 1125 1126 1127
//        Group 3 (Standing forward bend after re-point): 1133
//        Group 4 (Diamond pose Sanskrit mismatch)      : 1136
//
// Net effect: yoga pose count 269 → 258. See companion script
// populate-yoga-muscles-2026-04-24.mjs for the 14 follow-up UPDATEs.
import 'dotenv/config';
import { pool } from '../src/db/pool.js';

const DELETE_IDS = [
  1109, 1110, 1112, 1118, 1124, 1128, // Group 1
  1125, 1126, 1127,                    // Group 2 (Warriors)
  1133,                                // Group 3 (after re-point)
  1136,                                // Group 4 (Diamond pose)
];
const REPOINT = { from: 1133, to: 961 };

const client = await pool.connect();
try {
  await client.query('BEGIN');

  const idsExceptRepoint = DELETE_IDS.filter((id) => id !== REPOINT.from);
  const { rows: fks } = await client.query(
    `SELECT exercise_id, COUNT(*)::int AS refs FROM session_exercises
      WHERE exercise_id = ANY($1::int[]) GROUP BY exercise_id`,
    [idsExceptRepoint]
  );
  if (fks.length > 0) throw new Error(`ABORT: unexpected FK refs on ${JSON.stringify(fks)}`);
  console.log('FK pre-check OK');

  const repointResult = await client.query(
    `UPDATE session_exercises SET exercise_id = $1 WHERE exercise_id = $2`,
    [REPOINT.to, REPOINT.from]
  );
  console.log(`Re-pointed ${repointResult.rowCount} session_exercises rows: ${REPOINT.from} → ${REPOINT.to}`);

  const { rows: after } = await client.query(
    `SELECT COUNT(*)::int AS refs FROM session_exercises WHERE exercise_id = $1`,
    [REPOINT.from]
  );
  if (after[0].refs !== 0) {
    throw new Error(`ABORT: id=${REPOINT.from} still has ${after[0].refs} FK refs after re-point`);
  }

  const beforeCount = (await client.query(`SELECT COUNT(*)::int AS n FROM exercises WHERE type='yoga'`)).rows[0].n;
  const delResult = await client.query(
    `DELETE FROM exercises WHERE id = ANY($1::int[]) RETURNING id, name`,
    [DELETE_IDS]
  );
  console.log(`Deleted ${delResult.rowCount} rows:`);
  for (const r of delResult.rows) console.log(`  ${r.id}  ${r.name}`);
  if (delResult.rowCount !== DELETE_IDS.length) {
    throw new Error(`ABORT: expected ${DELETE_IDS.length} deletes, got ${delResult.rowCount}`);
  }
  const afterCount = (await client.query(`SELECT COUNT(*)::int AS n FROM exercises WHERE type='yoga'`)).rows[0].n;
  console.log(`Yoga pose count: ${beforeCount} → ${afterCount}`);

  await client.query('COMMIT');
  console.log('COMMIT OK');
} catch (err) {
  await client.query('ROLLBACK');
  console.error('ROLLBACK:', err.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
