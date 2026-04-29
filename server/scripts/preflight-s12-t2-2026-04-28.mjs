// Pre-flight inspection for S12-T2 build.
// Verifies schema assumptions before the engine code is written.
// Run: node --env-file=.env scripts/preflight-s12-t2-2026-04-28.mjs

import 'dotenv/config';
import { pool } from '../src/db/pool.js';

let stop = false;
let warn = false;

function header(label) {
  console.log(`\n=== ${label} ===`);
}

async function q(sql, params = []) {
  const { rows } = await pool.query(sql, params);
  return rows;
}

async function main() {
  // 1. Confirm S11-T3 + S12-T1 schema
  header('1. Schema tables present');
  const t = await q(`
    SELECT to_regclass('focus_areas')::text                AS focus_areas,
           to_regclass('focus_muscle_keywords')::text      AS focus_muscle_keywords,
           to_regclass('focus_content_compatibility')::text AS focus_content_compatibility,
           to_regclass('user_pillar_levels')::text         AS user_pillar_levels,
           to_regclass('focus_overlaps')::text             AS focus_overlaps,
           to_regclass('user_excluded_exercises')::text    AS user_excluded_exercises
  `);
  console.log(t[0]);
  const missing = Object.entries(t[0]).filter(([, v]) => v === null);
  if (missing.length) {
    console.error('STOP: missing tables:', missing.map(([k]) => k).join(', '));
    stop = true;
  }

  // 2. sessions.focus_slug
  header('2. sessions.focus_slug column');
  const s = await q(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'sessions' AND column_name = 'focus_slug'
  `);
  console.log(s);
  if (s.length === 0) {
    console.error('STOP: sessions.focus_slug missing.');
    stop = true;
  }

  // 3. focus_areas counts
  header('3. focus_areas counts by focus_type');
  const fa = await q(`SELECT focus_type, COUNT(*)::int AS n FROM focus_areas GROUP BY focus_type ORDER BY focus_type`);
  console.log(fa);
  const fbody = fa.find(r => r.focus_type === 'body')?.n;
  const fstate = fa.find(r => r.focus_type === 'state')?.n;
  if (fbody !== 12 || fstate !== 5) {
    console.error(`STOP: expected body=12,state=5; got body=${fbody},state=${fstate}`);
    stop = true;
  }

  // 4. body focuses muscle keyword counts
  header('4. body focus muscle keyword counts (10 in-scope must be > 0)');
  const fk = await q(`
    SELECT fa.slug, COUNT(fmk.id)::int AS n_keywords
    FROM focus_areas fa
    LEFT JOIN focus_muscle_keywords fmk ON fmk.focus_id = fa.id
    WHERE fa.focus_type = 'body'
    GROUP BY fa.slug, fa.sort_order
    ORDER BY fa.sort_order
  `);
  console.table(fk);
  const inScope = ['chest','back','shoulders','biceps','triceps','core','glutes','quads','hamstrings','calves'];
  for (const slug of inScope) {
    const row = fk.find(r => r.slug === slug);
    if (!row || row.n_keywords === 0) {
      console.error(`STOP: in-scope focus '${slug}' has 0 muscle keywords.`);
      stop = true;
    }
  }

  // 5. body focus bookend rows
  header('5. body-focus bookend rows (open=12, close=12)');
  const bk = await q(`
    SELECT fcc.role, COUNT(*)::int AS n
    FROM focus_content_compatibility fcc
    JOIN focus_areas fa ON fa.id = fcc.focus_id
    WHERE fa.focus_type = 'body'
      AND fcc.role IN ('bookend_open','bookend_close')
    GROUP BY fcc.role
    ORDER BY fcc.role
  `);
  console.log(bk);
  const open_n = bk.find(r => r.role === 'bookend_open')?.n;
  const close_n = bk.find(r => r.role === 'bookend_close')?.n;
  if (open_n !== 12 || close_n !== 12) {
    console.error(`STOP: expected open=12,close=12; got open=${open_n},close=${close_n}`);
    stop = true;
  }

  // 6. exercises columns
  header('6. exercises columns + practice_types shape');
  const cols = await q(`
    SELECT column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_name = 'exercises'
      AND column_name IN ('id','name','type','target_muscles','practice_types','difficulty')
    ORDER BY column_name
  `);
  console.table(cols);
  const expected = ['id','name','type','target_muscles','practice_types','difficulty'];
  for (const c of expected) {
    if (!cols.find(r => r.column_name === c)) {
      console.error(`STOP: exercises.${c} missing.`);
      stop = true;
    }
  }
  const ptCol = cols.find(r => r.column_name === 'practice_types');
  if (ptCol) {
    console.log(`practice_types data_type=${ptCol.data_type} udt_name=${ptCol.udt_name}`);
    // ARRAY data_type with _varchar / _text udt = array; varchar/text udt = scalar
    const isArray = ptCol.data_type === 'ARRAY';
    console.log(`practice_types is array? ${isArray}`);
    if (!isArray) {
      console.error('WARN: practice_types is not an array — engine queries assume array, will need to adjust.');
      warn = true;
    }
  }

  // 7. user_pillar_levels for prashob — list all users + their levels
  header('7. user_pillar_levels — all users');
  const upl = await q(`
    SELECT u.id AS user_id, u.email, upl.pillar, upl.level, upl.source
    FROM users u
    LEFT JOIN user_pillar_levels upl ON upl.user_id = u.id
    ORDER BY u.id, upl.pillar
  `);
  console.table(upl);

  // 8. muscle keyword tokens — find dead keywords (target_muscles is text, use ILIKE substring)
  header('8. muscle keywords + n exercises matching (ILIKE substring)');
  const km = await q(`
    SELECT fmk.keyword,
           COUNT(DISTINCT e.id)::int AS n_exercises_matching
    FROM focus_muscle_keywords fmk
    LEFT JOIN exercises e
      ON LOWER(e.target_muscles) LIKE '%' || LOWER(fmk.keyword) || '%'
    GROUP BY fmk.keyword
    ORDER BY fmk.keyword
  `);
  console.table(km);
  const dead = km.filter(r => r.n_exercises_matching === 0);
  if (dead.length) {
    console.error(`WARN: dead keywords (no matching exercises via substring): ${dead.map(r => r.keyword).join(', ')}`);
    warn = true;
  }

  // 9. Bonus — biceps eligible-pool sizes for beginner (ILIKE substring)
  header('9. Sanity — biceps beginner pools');
  const sample = await q(`
    WITH kw AS (
      SELECT array_agg(keyword) AS keywords
      FROM focus_muscle_keywords
      WHERE focus_id = (SELECT id FROM focus_areas WHERE slug='biceps')
    )
    SELECT
      (SELECT COUNT(*) FROM exercises e, kw
        WHERE e.type='strength' AND e.difficulty='beginner'
          AND EXISTS (SELECT 1 FROM unnest(kw.keywords) AS k
                      WHERE LOWER(e.target_muscles) LIKE '%' || LOWER(k) || '%')
      ) AS strength_beginner_pool,
      (SELECT COUNT(*) FROM exercises e, kw
        WHERE e.type='yoga' AND e.difficulty='beginner'
          AND EXISTS (SELECT 1 FROM unnest(kw.keywords) AS k
                      WHERE LOWER(e.target_muscles) LIKE '%' || LOWER(k) || '%')
      ) AS yoga_beginner_pool,
      (SELECT COUNT(*) FROM focus_content_compatibility fcc
       JOIN breathwork_techniques bt ON bt.id = fcc.content_id
       WHERE fcc.focus_id = (SELECT id FROM focus_areas WHERE slug='biceps')
         AND fcc.role='bookend_open' AND fcc.content_type='breathwork'
         AND bt.difficulty='beginner') AS breathwork_open_pool,
      (SELECT COUNT(*) FROM focus_content_compatibility fcc
       JOIN breathwork_techniques bt ON bt.id = fcc.content_id
       WHERE fcc.focus_id = (SELECT id FROM focus_areas WHERE slug='biceps')
         AND fcc.role='bookend_close' AND fcc.content_type='breathwork'
         AND bt.difficulty='beginner') AS breathwork_close_pool
  `);
  console.table(sample);

  console.log('\n');
  if (stop) {
    console.error('==> STOP CONDITION HIT. Do not proceed.');
    process.exitCode = 2;
  } else if (warn) {
    console.warn('==> Warnings present. Proceed but flag them.');
    process.exitCode = 0;
  } else {
    console.log('==> All clear. Safe to proceed.');
    process.exitCode = 0;
  }
}

main()
  .catch(err => {
    console.error('Pre-flight crashed:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
