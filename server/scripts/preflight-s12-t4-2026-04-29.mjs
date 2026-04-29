// S12-T4 pre-flight: assert mobility/full_body data layer is ready.
// Run: node --env-file=.env scripts/preflight-s12-t4-2026-04-29.mjs
//
// Per Amendment 1 (S12-T4-AMENDMENT-1-practice-type-remap.md):
//   1. bookend rows exist for both special-case focuses (mobility, full_body)
//   2. REMAPPED yoga style-token presence (vinyasa / sun_salutation / hatha / yin / restorative)
//   3. compound counts >= 5 (each pillar)
//   4. post-remap mobility/full_body pool sizes at beginner-level >= 1 per phase
//   5. strength practice_types — informational only (confirmed structurally empty)

import 'dotenv/config';
import { pool } from '../src/db/pool.js';

let stop = false;

function header(label) {
  console.log(`\n=== ${label} ===`);
}

async function main() {
  // 1. Bookend rows for mobility + full_body
  header('1. Bookend rows for special-case focuses');
  const bookends = await pool.query(`
    SELECT fa.slug, fcc.role, COUNT(*)::int AS row_count
      FROM focus_content_compatibility fcc
      JOIN focus_areas fa ON fa.id = fcc.focus_id
     WHERE fa.slug IN ('mobility', 'full_body')
       AND fcc.role IN ('bookend_open', 'bookend_close')
     GROUP BY fa.slug, fcc.role
     ORDER BY fa.slug, fcc.role
  `);
  console.table(bookends.rows);
  if (bookends.rows.length !== 4) {
    console.error(`STOP: expected 4 bookend rows (mobility/full_body × open/close), got ${bookends.rows.length}`);
    stop = true;
  }
  for (const r of bookends.rows) {
    if (r.row_count < 1) {
      console.error(`STOP: bookend ${r.slug}/${r.role} has count ${r.row_count}`);
      stop = true;
    }
  }

  // 2. Remapped yoga style-token presence (Amendment 1 §Updated Pre-Flight Assertions)
  header('2. Yoga style-token counts (post-remap)');
  const tokens = await pool.query(`
    SELECT
      SUM(CASE WHEN type='yoga' AND 'vinyasa'        = ANY(practice_types) THEN 1 ELSE 0 END)::int AS yoga_vinyasa_count,
      SUM(CASE WHEN type='yoga' AND 'sun_salutation' = ANY(practice_types) THEN 1 ELSE 0 END)::int AS yoga_sun_salutation_count,
      SUM(CASE WHEN type='yoga' AND 'hatha'          = ANY(practice_types) THEN 1 ELSE 0 END)::int AS yoga_hatha_count,
      SUM(CASE WHEN type='yoga' AND 'yin'            = ANY(practice_types) THEN 1 ELSE 0 END)::int AS yoga_yin_count,
      SUM(CASE WHEN type='yoga' AND 'restorative'    = ANY(practice_types) THEN 1 ELSE 0 END)::int AS yoga_restorative_count
    FROM exercises
  `);
  const t = tokens.rows[0];
  console.table([t]);
  for (const k of ['yoga_vinyasa_count', 'yoga_sun_salutation_count', 'yoga_hatha_count',
                   'yoga_yin_count', 'yoga_restorative_count']) {
    if (t[k] < 1) {
      console.error(`STOP: ${k}=${t[k]} (need >= 1)`);
      stop = true;
    }
  }

  // 3. Compound counts
  header('3. Compound (target_muscles array length >= 3) counts');
  const compounds = await pool.query(`
    SELECT
      SUM(CASE WHEN type='yoga'     AND ARRAY_LENGTH(STRING_TO_ARRAY(target_muscles, ','), 1) >= 3 THEN 1 ELSE 0 END)::int AS yoga_compound_count,
      SUM(CASE WHEN type='strength' AND ARRAY_LENGTH(STRING_TO_ARRAY(target_muscles, ','), 1) >= 3 THEN 1 ELSE 0 END)::int AS strength_compound_count
    FROM exercises
  `);
  const c = compounds.rows[0];
  console.table([c]);
  for (const k of ['yoga_compound_count', 'strength_compound_count']) {
    if (c[k] < 5) {
      console.error(`STOP: ${k}=${c[k]} (need >= 5)`);
      stop = true;
    }
  }

  // 4. Post-remap pool sizes at beginner level (each must be >= 1)
  header('4. Post-remap mobility/full_body beginner pools');
  const pools = await pool.query(`
    SELECT 'mobility_warmup_beginner' AS pool, COUNT(*)::int AS n
    FROM exercises
    WHERE type='yoga'
      AND practice_types && ARRAY['vinyasa','sun_salutation','hatha']::text[]
      AND difficulty = 'beginner'
    UNION ALL
    SELECT 'mobility_main_beginner', COUNT(*)::int
    FROM exercises
    WHERE type='yoga'
      AND practice_types && ARRAY['hatha','yin','vinyasa']::text[]
      AND difficulty = 'beginner'
    UNION ALL
    SELECT 'mobility_cooldown_beginner', COUNT(*)::int
    FROM exercises
    WHERE type='yoga'
      AND practice_types && ARRAY['restorative','yin','hatha']::text[]
      AND difficulty = 'beginner'
    UNION ALL
    SELECT 'full_body_yogatab_warmup_beginner', COUNT(*)::int
    FROM exercises
    WHERE type='yoga'
      AND ARRAY_LENGTH(STRING_TO_ARRAY(target_muscles, ','), 1) >= 3
      AND practice_types && ARRAY['vinyasa','sun_salutation','hatha']::text[]
      AND difficulty = 'beginner'
  `);
  console.table(pools.rows);
  for (const r of pools.rows) {
    if (r.n < 1) {
      console.error(`STOP: pool '${r.pool}'=${r.n} (need >= 1)`);
      stop = true;
    }
  }

  // 5. Strength practice_types — informational, confirmed structurally empty
  header('5. Strength practice_types (informational; confirmed empty)');
  const strPT = await pool.query(`
    SELECT COUNT(*)::int AS strength_with_practice_types
    FROM exercises
    WHERE type='strength' AND practice_types IS NOT NULL AND array_length(practice_types, 1) > 0
  `);
  console.table(strPT.rows);

  console.log('\n');
  if (stop) {
    console.error('==> STOP CONDITION HIT.');
    process.exitCode = 2;
  } else {
    console.log('==> All clear. Safe to proceed.');
    process.exitCode = 0;
  }
}

main()
  .catch((err) => { console.error('Pre-flight crashed:', err); process.exitCode = 1; })
  .finally(() => pool.end());
