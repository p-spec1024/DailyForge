import 'dotenv/config';
import { pool } from '../src/db/pool.js';

async function main() {
  console.log('--- Body focuses ---');
  let r = await pool.query(
    `SELECT slug, display_name FROM focus_areas WHERE focus_type='body' ORDER BY sort_order`,
  );
  for (const row of r.rows) console.log(`  ${row.slug.padEnd(12)} ${row.display_name}`);

  console.log('\n--- State focuses ---');
  r = await pool.query(
    `SELECT slug, display_name FROM focus_areas WHERE focus_type='state' ORDER BY sort_order`,
  );
  for (const row of r.rows) console.log(`  ${row.slug.padEnd(12)} ${row.display_name}`);

  console.log('\n--- Calm focus main breathwork ---');
  r = await pool.query(
    `SELECT bt.name
       FROM focus_content_compatibility fcc
       JOIN focus_areas fa ON fa.id = fcc.focus_id
       JOIN breathwork_techniques bt ON bt.id = fcc.content_id
      WHERE fa.slug='calm' AND fcc.role='main' AND fcc.content_type='breathwork'
      ORDER BY bt.name`,
  );
  console.log(`  count=${r.rows.length}`);
  for (const row of r.rows) console.log(`    ${row.name}`);

  console.log('\n--- Body-focus bookend coverage ---');
  r = await pool.query(
    `SELECT fa.slug,
            COUNT(*) FILTER (WHERE fcc.role='bookend_open')::int AS opens,
            COUNT(*) FILTER (WHERE fcc.role='bookend_close')::int AS closes
       FROM focus_areas fa
       LEFT JOIN focus_content_compatibility fcc ON fcc.focus_id = fa.id
      WHERE fa.focus_type='body'
      GROUP BY fa.slug, fa.sort_order
      ORDER BY fa.sort_order`,
  );
  for (const row of r.rows) {
    console.log(`  ${row.slug.padEnd(12)} opens=${row.opens} closes=${row.closes}`);
  }

  console.log('\n--- Per-focus role distribution ---');
  r = await pool.query(
    `SELECT fa.slug, fcc.role, COUNT(*)::int AS n
       FROM focus_content_compatibility fcc
       JOIN focus_areas fa ON fa.id = fcc.focus_id
      GROUP BY fa.slug, fa.sort_order, fcc.role
      ORDER BY fa.sort_order, fcc.role`,
  );
  for (const row of r.rows) console.log(`  ${row.slug.padEnd(12)} ${row.role.padEnd(15)} ${row.n}`);

  console.log('\n--- Per-focus muscle-keyword counts ---');
  r = await pool.query(
    `SELECT fa.slug, COUNT(fmk.id)::int AS n
       FROM focus_areas fa
       LEFT JOIN focus_muscle_keywords fmk ON fmk.focus_id = fa.id
      WHERE fa.focus_type='body'
      GROUP BY fa.slug, fa.sort_order
      ORDER BY fa.sort_order`,
  );
  for (const row of r.rows) console.log(`  ${row.slug.padEnd(12)} ${row.n}`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => pool.end());
