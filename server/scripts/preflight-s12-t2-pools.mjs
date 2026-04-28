// Quick pool-size check for all 10 in-scope body focuses across pillars at beginner level.
import 'dotenv/config';
import { pool } from '../src/db/pool.js';

const FOCUSES = ['chest','back','shoulders','biceps','triceps','core','glutes','quads','hamstrings','calves'];

async function main() {
  // Distinct practice_types in DB (so engine knows what tokens to match)
  const pts = await pool.query(`
    SELECT DISTINCT unnest(practice_types) AS pt, COUNT(*) AS n
    FROM exercises WHERE type='yoga' AND practice_types IS NOT NULL
    GROUP BY pt ORDER BY pt
  `);
  console.log('Distinct yoga practice_types:');
  console.table(pts.rows);

  console.log('\nPool sizes per in-scope body focus (beginner):');
  const out = [];
  for (const slug of FOCUSES) {
    const r = await pool.query(`
      WITH kw AS (
        SELECT array_agg(keyword) AS keywords
        FROM focus_muscle_keywords
        WHERE focus_id = (SELECT id FROM focus_areas WHERE slug=$1)
      )
      SELECT
        $1::text AS focus,
        (SELECT COUNT(*) FROM exercises e, kw
          WHERE e.type='strength' AND e.difficulty='beginner'
            AND EXISTS (SELECT 1 FROM unnest(kw.keywords) k WHERE LOWER(e.target_muscles) LIKE '%' || LOWER(k) || '%'))::int AS strength,
        (SELECT COUNT(*) FROM exercises e, kw
          WHERE e.type='yoga' AND e.difficulty='beginner'
            AND e.practice_types && ARRAY['vinyasa','sun_salutation','hatha']::text[]
            AND EXISTS (SELECT 1 FROM unnest(kw.keywords) k WHERE LOWER(e.target_muscles) LIKE '%' || LOWER(k) || '%'))::int AS yoga_warmup_active,
        (SELECT COUNT(*) FROM exercises e, kw
          WHERE e.type='yoga' AND e.difficulty='beginner'
            AND EXISTS (SELECT 1 FROM unnest(kw.keywords) k WHERE LOWER(e.target_muscles) LIKE '%' || LOWER(k) || '%'))::int AS yoga_any,
        (SELECT COUNT(*) FROM exercises e, kw
          WHERE e.type='yoga' AND e.difficulty='beginner'
            AND e.practice_types && ARRAY['restorative','yin','hatha']::text[]
            AND EXISTS (SELECT 1 FROM unnest(kw.keywords) k WHERE LOWER(e.target_muscles) LIKE '%' || LOWER(k) || '%'))::int AS yoga_cooldown_restorative
    `, [slug]);
    out.push(r.rows[0]);
  }
  console.table(out);
}

main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => pool.end());
