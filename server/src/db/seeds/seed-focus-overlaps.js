import 'dotenv/config';
import { pool } from '../pool.js';

// ---------------------------------------------------------------------------
// S12-T1 — Focus-overlap seed
//
// Seeds 12 directional rows in focus_overlaps. Six muscle-pair relationships,
// each stored as 2 directional entries (e.g. chest→triceps AND triceps→chest)
// so the engine never has to check both directions in a single query.
//
// No overlaps for core, calves, mobility, full_body — those four are
// system-level focuses that don't fatigue specific antagonists in the same
// way the 8 below do. See Trackers/S12-suggestion-engine-spec.md.
// Idempotent via ON CONFLICT DO NOTHING.
// ---------------------------------------------------------------------------

const PAIRS = [
  ['chest', 'triceps'],
  ['chest', 'shoulders'],
  ['triceps', 'chest'],
  ['triceps', 'shoulders'],
  ['shoulders', 'chest'],
  ['shoulders', 'triceps'],
  ['back', 'biceps'],
  ['biceps', 'back'],
  ['quads', 'glutes'],
  ['glutes', 'quads'],
  ['glutes', 'hamstrings'],
  ['hamstrings', 'glutes'],
];

const EXPECTED = {
  total_rows: 12,
  excluded_slugs: ['core', 'calves', 'mobility', 'full_body'],
};

async function seed() {
  console.log('Seeding S12-T1 focus_overlaps...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const slugs = [...new Set(PAIRS.flat())];
    const { rows: focuses } = await client.query(
      `SELECT id, slug FROM focus_areas WHERE slug = ANY($1)`,
      [slugs],
    );
    const idBySlug = Object.fromEntries(focuses.map((r) => [r.slug, r.id]));

    const missing = slugs.filter((s) => !idBySlug[s]);
    if (missing.length > 0) {
      throw new Error(`Missing focus_areas slugs: ${missing.join(', ')}`);
    }

    let inserted = 0;
    let skipped = 0;
    for (const [fromSlug, toSlug] of PAIRS) {
      const result = await client.query(
        `INSERT INTO focus_overlaps (focus_id, overlaps_with_id)
         VALUES ($1, $2)
         ON CONFLICT (focus_id, overlaps_with_id) DO NOTHING`,
        [idBySlug[fromSlug], idBySlug[toSlug]],
      );
      if (result.rowCount > 0) inserted++;
      else skipped++;
    }

    await client.query('COMMIT');
    console.log(`  inserted=${inserted}, skipped=${skipped}`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // ---- Assertions (post-commit, against the live table) ----
  const failures = [];

  const total = await pool.query(`SELECT COUNT(*)::int AS n FROM focus_overlaps`);
  if (total.rows[0].n !== EXPECTED.total_rows) {
    failures.push(`focus_overlaps total: expected ${EXPECTED.total_rows}, got ${total.rows[0].n}`);
  }

  const excluded = await pool.query(
    `SELECT fa.slug, COUNT(fo.id)::int AS n
       FROM focus_areas fa
       LEFT JOIN focus_overlaps fo ON fo.focus_id = fa.id
      WHERE fa.slug = ANY($1)
      GROUP BY fa.slug`,
    [EXPECTED.excluded_slugs],
  );
  for (const row of excluded.rows) {
    if (row.n !== 0) {
      failures.push(`Slug "${row.slug}" should have 0 overlap rows, got ${row.n}`);
    }
  }

  // Symmetry: every (a,b) must have a matching (b,a).
  const asymmetry = await pool.query(
    `SELECT fa1.slug AS from_slug, fa2.slug AS to_slug
       FROM focus_overlaps fo1
       JOIN focus_areas fa1 ON fa1.id = fo1.focus_id
       JOIN focus_areas fa2 ON fa2.id = fo1.overlaps_with_id
       LEFT JOIN focus_overlaps fo2
         ON fo2.focus_id = fo1.overlaps_with_id
        AND fo2.overlaps_with_id = fo1.focus_id
      WHERE fo2.id IS NULL`,
  );
  if (asymmetry.rows.length > 0) {
    failures.push(
      `Asymmetric pairs: ${asymmetry.rows.map((r) => `${r.from_slug}→${r.to_slug}`).join(', ')}`,
    );
  }

  if (failures.length > 0) {
    console.error('\n✗ Seed assertions FAILED:');
    for (const f of failures) console.error(`  - ${f}`);
    process.exitCode = 1;
    return;
  }

  console.log(`\n✓ focus_overlaps seeded: ${total.rows[0].n} rows`);
  console.log(`✓ excluded slugs (core, calves, mobility, full_body) all have 0 overlaps`);
  console.log('✓ symmetry check pass: every (a,b) has matching (b,a)');
}

seed()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
