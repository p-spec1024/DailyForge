// S12-T5 pre-flight: confirm focus_overlaps live data matches the 12 spec-asserted
// pairs (S12-T5 spec Appendix A). Stops the build on any disagreement.
// Run: node --env-file=.env scripts/preflight-s12-t5-overlaps.mjs

import 'dotenv/config';
import { pool } from '../src/db/pool.js';

const SPEC_PAIRS = [
  ['chest', 'triceps'],   ['triceps', 'chest'],
  ['chest', 'shoulders'], ['shoulders', 'chest'],
  ['back', 'biceps'],     ['biceps', 'back'],
  ['shoulders', 'triceps'], ['triceps', 'shoulders'],
  ['quads', 'glutes'],    ['glutes', 'quads'],
  ['glutes', 'hamstrings'], ['hamstrings', 'glutes'],
];

function pairKey([a, b]) { return `${a}->${b}`; }

async function main() {
  console.log('=== S12-T5 pre-flight: focus_overlaps ===\n');

  const { rows } = await pool.query(`
    SELECT fa1.slug AS focus, fa2.slug AS overlaps_with
      FROM focus_overlaps fo
      JOIN focus_areas fa1 ON fa1.id = fo.focus_id
      JOIN focus_areas fa2 ON fa2.id = fo.overlaps_with_id
     ORDER BY fa1.slug, fa2.slug
  `);

  const live = new Set(rows.map((r) => pairKey([r.focus, r.overlaps_with])));
  const spec = new Set(SPEC_PAIRS.map(pairKey));

  const missingFromDB = [...spec].filter((k) => !live.has(k));
  const extraInDB     = [...live].filter((k) => !spec.has(k));

  console.log(`Spec pairs: ${spec.size}`);
  console.log(`Live pairs: ${live.size}`);
  console.log(`\nLive data:`);
  console.table(rows);

  let stop = false;
  if (missingFromDB.length > 0) {
    console.error(`\nFAIL: ${missingFromDB.length} pair(s) in spec but missing from DB:`);
    for (const k of missingFromDB) console.error(`  - ${k}`);
    stop = true;
  }
  if (extraInDB.length > 0) {
    console.error(`\nFAIL: ${extraInDB.length} pair(s) in DB but not in spec:`);
    for (const k of extraInDB) console.error(`  - ${k}`);
    stop = true;
  }

  if (stop) {
    console.error('\n==> STOP: focus_overlaps drift between spec and live data.');
    process.exitCode = 2;
  } else {
    console.log('\n==> All 12 spec pairs match live data. Safe to proceed.');
    process.exitCode = 0;
  }
}

main()
  .catch((err) => { console.error('Pre-flight crashed:', err); process.exitCode = 1; })
  .finally(() => pool.end());
