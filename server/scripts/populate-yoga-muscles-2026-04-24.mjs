// One-off migration applied 2026-04-24 — DO NOT RE-RUN.
// Populates target_muscles for the 13 dirty yoga poses kept after the
// cleanup-dirty-yoga-2026-04-24.mjs deletes, plus 1 sweep-normalize
// update on Mountain Pose (postural muscles → spinal extensors).
// All in a single transaction with per-row before/after dump.
// Token lists were reviewed against B.K.S. Iyengar Light on Yoga + Yoga
// Journal pose library; see SPRINT_TRACKER.md S10-T5b followup notes.
import 'dotenv/config';
import { pool } from '../src/db/pool.js';

const UPDATES = [
  // 13 dirty-pose populates (Group 3 keepers + Group 4 keepers)
  { id: 1108, name: 'Boat',                         tm: 'core, hip flexors, psoas, quads, spinal extensors, rectus abdominis' },
  { id: 1114, name: 'Crescent Lunge',               tm: 'quads, glutes, hamstrings, hip flexors, psoas, core, chest, shoulders' },
  { id: 1117, name: 'Low Lunge',                    tm: 'quads, glutes, hip flexors, psoas, hamstrings, chest, shoulders' },
  { id: 1119, name: 'Plank',                        tm: 'core, shoulders, deltoids, triceps, serratus anterior, rectus abdominis' },
  { id: 1120, name: 'Reverse Warrior',              tm: 'quads, hamstrings, glutes, obliques, intercostals, lats' },
  { id: 1123, name: 'Triangle',                     tm: 'hamstrings, quads, glutes, obliques, hips, shoulders, spinal extensors' },
  { id: 1129, name: 'Headstand Pose',               tm: 'core, shoulders, deltoids, triceps, neck, spinal extensors' },
  { id: 1130, name: 'Upward Salute Pose',           tm: 'shoulders, deltoids, lats, chest, spinal extensors' },
  { id: 1131, name: 'Prayer pose',                  tm: 'shoulders, spinal extensors' },
  { id: 1132, name: 'Raised arms pose',             tm: 'chest, shoulders, lats, spinal extensors, abdominals' },
  { id: 1134, name: 'Equestrian pose',              tm: 'quads, glutes, hip flexors, psoas, hamstrings, chest' },
  { id: 1135, name: 'Knees, chest and chin pose',   tm: 'triceps, chest, shoulders, deltoids, serratus anterior, core' },
  { id: 1138, name: 'Extended Puppy',               tm: 'shoulders, lats, chest, deltoids, spinal extensors' },
  // Sweep normalization: postural muscles → spinal extensors
  { id: 959,  name: 'Mountain Pose',                tm: 'feet, plantar fascia, spinal extensors' },
];

const client = await pool.connect();
try {
  await client.query('BEGIN');

  // Snapshot before for audit log.
  const ids = UPDATES.map((u) => u.id);
  const { rows: before } = await client.query(
    `SELECT id, name, target_muscles FROM exercises WHERE id = ANY($1::int[]) ORDER BY id`,
    [ids]
  );
  const beforeMap = new Map(before.map((r) => [r.id, r]));

  // Verify every targeted id exists + name matches what we expect (defensive).
  for (const u of UPDATES) {
    const row = beforeMap.get(u.id);
    if (!row) throw new Error(`ABORT: id=${u.id} not found`);
    if (row.name !== u.name) {
      throw new Error(`ABORT: id=${u.id} name mismatch: db="${row.name}" expected="${u.name}"`);
    }
  }
  console.log(`Pre-check OK: all ${UPDATES.length} target ids exist and name-match`);

  // Apply updates.
  let updated = 0;
  for (const u of UPDATES) {
    const r = await client.query(
      `UPDATE exercises SET target_muscles = $1 WHERE id = $2`,
      [u.tm, u.id]
    );
    updated += r.rowCount;
  }
  if (updated !== UPDATES.length) {
    throw new Error(`ABORT: expected ${UPDATES.length} updates, got ${updated}`);
  }

  // After-snapshot
  const { rows: after } = await client.query(
    `SELECT id, name, target_muscles FROM exercises WHERE id = ANY($1::int[]) ORDER BY id`,
    [ids]
  );

  console.log('\nPer-row diff:');
  for (const a of after) {
    const b = beforeMap.get(a.id);
    console.log(`  id=${a.id}  ${a.name}`);
    console.log(`    before: ${b.target_muscles || '(empty)'}`);
    console.log(`    after : ${a.target_muscles}`);
  }

  await client.query('COMMIT');
  console.log(`\nCOMMIT OK — ${updated} rows updated`);
} catch (err) {
  await client.query('ROLLBACK');
  console.error('ROLLBACK:', err.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
