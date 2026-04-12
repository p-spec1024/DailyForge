import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function audit() {
  // Find potential duplicates by normalizing names (remove hyphens, spaces, lowercase)
  const r = await pool.query(`
    SELECT
      LOWER(REPLACE(REPLACE(REPLACE(name, '-', ''), ' ', ''), '''', '')) AS norm,
      array_agg(id ORDER BY id) AS ids,
      array_agg(name ORDER BY id) AS names,
      array_agg(source ORDER BY id) AS sources,
      array_agg(target_muscles ORDER BY id) AS muscles,
      array_agg(workout_id ORDER BY id) AS workout_ids
    FROM exercises
    WHERE type = 'strength'
    GROUP BY LOWER(REPLACE(REPLACE(REPLACE(name, '-', ''), ' ', ''), '''', ''))
    HAVING COUNT(*) > 1
    ORDER BY norm
  `);

  console.log(`\n=== Found ${r.rows.length} duplicate groups ===\n`);
  for (const row of r.rows) {
    console.log(`Normalized: "${row.norm}"`);
    for (let i = 0; i < row.ids.length; i++) {
      console.log(`  ID ${row.ids[i]}: "${row.names[i]}" | source: ${row.sources[i] || 'seed'} | workout_id: ${row.workout_ids[i] || 'NULL'} | muscles: ${(row.muscles[i] || '').substring(0, 60)}`);
    }
    console.log('');
  }
}

async function checkFKRefs(exerciseId) {
  const tables = [
    { table: 'session_exercises', col: 'exercise_id' },
    { table: 'user_exercise_prefs', col: 'exercise_id' },
    { table: 'user_exercise_prefs', col: 'chosen_exercise_id' },
    { table: 'slot_alternatives', col: 'exercise_id' },
    { table: 'exercise_progress_cache', col: 'exercise_id' },
  ];
  const refs = [];
  for (const { table, col } of tables) {
    try {
      const r = await pool.query(`SELECT COUNT(*)::int AS cnt FROM ${table} WHERE ${col} = $1`, [exerciseId]);
      if (r.rows[0].cnt > 0) refs.push(`${table}.${col}: ${r.rows[0].cnt}`);
    } catch {
      // Table may not exist
    }
  }
  return refs;
}

async function dedupe() {
  await audit();

  // Get all duplicate groups
  const r = await pool.query(`
    SELECT
      LOWER(REPLACE(REPLACE(REPLACE(name, '-', ''), ' ', ''), '''', '')) AS norm,
      array_agg(id ORDER BY id) AS ids,
      array_agg(name ORDER BY id) AS names,
      array_agg(source ORDER BY id) AS sources,
      array_agg(workout_id ORDER BY id) AS workout_ids,
      array_agg(target_muscles ORDER BY id) AS muscles
    FROM exercises
    WHERE type = 'strength'
    GROUP BY LOWER(REPLACE(REPLACE(REPLACE(name, '-', ''), ' ', ''), '''', ''))
    HAVING COUNT(*) > 1
    ORDER BY norm
  `);

  let deleted = 0;
  let merged = 0;

  for (const row of r.rows) {
    // Strategy: keep the first one with a workout_id (seeded), else first library exercise
    // Prefer names with hyphens (Pull-ups > Pullups) and more complete muscle data
    let keepIdx = 0;
    for (let i = 1; i < row.ids.length; i++) {
      const currentName = row.names[keepIdx];
      const candidateName = row.names[i];
      // Prefer seeded exercises (workout_id != null) if current is library
      if (row.workout_ids[keepIdx] == null && row.workout_ids[i] != null) {
        keepIdx = i;
        continue;
      }
      // Among library exercises, prefer hyphenated names and longer muscle data
      if (row.workout_ids[keepIdx] == null && row.workout_ids[i] == null) {
        const currentMuscles = (row.muscles[keepIdx] || '').length;
        const candidateMuscles = (row.muscles[i] || '').length;
        if (candidateMuscles > currentMuscles) keepIdx = i;
        else if (candidateName.includes('-') && !currentName.includes('-')) keepIdx = i;
      }
    }

    const keepId = row.ids[keepIdx];
    const keepName = row.names[keepIdx];
    const deleteIds = row.ids.filter((_, i) => i !== keepIdx);
    const deleteNames = row.names.filter((_, i) => i !== keepIdx);

    for (let i = 0; i < deleteIds.length; i++) {
      const delId = deleteIds[i];
      const delName = deleteNames[i];
      const refs = await checkFKRefs(delId);

      if (refs.length > 0) {
        // Has FK references — reassign them to the kept exercise
        console.log(`  Reassigning FK refs for "${delName}" (${delId}) → "${keepName}" (${keepId}): ${refs.join(', ')}`);
        for (const ref of refs) {
          const [tableCol] = ref.split(':');
          const [table, col] = tableCol.trim().split('.');
          await pool.query(`UPDATE ${table} SET ${col} = $1 WHERE ${col} = $2`, [keepId, delId]);
        }
        merged++;
      }

      // Merge richer muscle data before deleting
      const delMuscles = row.muscles[row.ids.indexOf(delId)] || '';
      const keepMuscles = row.muscles[keepIdx] || '';
      if (delMuscles.length > keepMuscles.length) {
        console.log(`  Merging muscles: "${keepMuscles}" → "${delMuscles}"`);
        await pool.query('UPDATE exercises SET target_muscles = $1 WHERE id = $2', [delMuscles, keepId]);
      }

      // Merge description if kept exercise lacks one
      const descCheck = await pool.query('SELECT description FROM exercises WHERE id = $1', [delId]);
      const keepDescCheck = await pool.query('SELECT description FROM exercises WHERE id = $1', [keepId]);
      if (descCheck.rows[0]?.description && !keepDescCheck.rows[0]?.description) {
        await pool.query('UPDATE exercises SET description = $1 WHERE id = $2', [descCheck.rows[0].description, keepId]);
        console.log(`  Merged description from "${delName}" → "${keepName}"`);
      }

      console.log(`  DELETE: "${delName}" (${delId}) — keeping "${keepName}" (${keepId})`);
      await pool.query('DELETE FROM exercises WHERE id = $1', [delId]);
      deleted++;
    }
  }

  console.log(`\n=== Done: ${deleted} duplicates deleted, ${merged} FK references reassigned ===`);
}

const cmd = process.argv[2];
if (cmd === 'fix') {
  await dedupe();
} else {
  console.log('Run with "fix" argument to actually delete duplicates.');
  console.log('  node scripts/dedupe-exercises.mjs fix\n');
  await audit();
}

await pool.end();
