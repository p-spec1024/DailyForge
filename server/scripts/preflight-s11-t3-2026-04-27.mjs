import 'dotenv/config';
import { pool } from '../src/db/pool.js';

const NAMES_TO_VERIFY = [
  // energize
  'Bhastrika', 'Kapalabhati', 'Surya Bhedana', 'Wim Hof Method',
  'Cyclic Hyperventilation', 'Morning Energizer', 'Pre-Workout Activation',
  // calm
  'Nadi Shodhana', 'Anulom Vilom', 'Bhramari', 'Sitali', 'Sitkari',
  '4-7-8 Breathing', 'Box Breathing', 'Coherent Breathing', 'Extended Exhale',
  '5-5-5-5 Square Breathing', 'A52 Breath Method', 'Anti-Anxiety Breath',
  'Grounding Breath', 'Diaphragmatic Breathing', 'Post-Workout Calm',
  // focus
  'Ujjayi', 'Breath Counting', 'Focus Breath',
  // sleep
  'Sleep Preparation Breath', 'Deep Sleep Induction',
];

async function main() {
  const result = await pool.query(
    `SELECT name, category, standalone_compatible, pre_workout_compatible, post_workout_compatible
     FROM breathwork_techniques WHERE name = ANY($1::text[]) ORDER BY name`,
    [NAMES_TO_VERIFY],
  );
  const found = new Set(result.rows.map((r) => r.name));
  const missing = NAMES_TO_VERIFY.filter((n) => !found.has(n));
  console.log('Found:', result.rows.length, '/', NAMES_TO_VERIFY.length);
  if (missing.length) console.log('MISSING:', missing);
  for (const r of result.rows) {
    console.log(
      `  ${r.name.padEnd(28)} cat=${r.category.padEnd(12)} standalone=${r.standalone_compatible} pre=${r.pre_workout_compatible} post=${r.post_workout_compatible}`,
    );
  }

  // Bookend names
  const bookends = await pool.query(
    `SELECT name, difficulty, standalone_compatible, pre_workout_compatible, post_workout_compatible
     FROM breathwork_techniques WHERE name IN ('Morning Energizer','Post-Workout Calm')`,
  );
  console.log('\nBookend rows:');
  for (const r of bookends.rows) console.log(' ', r);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
