// Pre-flight inspection for S12-T3 build (state-focus recipe).
// Verifies settle_eligible_for seed + state-focus main pool + duration columns.
// Run: node --env-file=.env scripts/preflight-s12-t3-2026-04-28.mjs

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
  // 1. settle_eligible_for populated as expected (5 rows)
  header('1. settle_eligible_for populated rows');
  const settle = await q(`
    SELECT name, settle_eligible_for
    FROM breathwork_techniques
    WHERE settle_eligible_for IS NOT NULL
      AND array_length(settle_eligible_for, 1) > 0
    ORDER BY name
  `);
  console.table(settle.map(r => ({ name: r.name, settle_eligible_for: JSON.stringify(r.settle_eligible_for) })));
  if (settle.length !== 5) {
    console.error(`STOP: expected 5 settle-eligible techniques, got ${settle.length}`);
    stop = true;
  }
  // Spec expects (by canonical name fragment):
  const expectedSettleHints = {
    'Diaphragmatic': ['calm', 'sleep', 'energize', 'focus', 'recover'],
    'Sama Vritti':   ['calm'],
    'Three-Part':    ['sleep', 'recover'],
    'Coherent':      ['energize'],
    'Box Breathing': ['focus'],
  };
  for (const [hint, expectedSet] of Object.entries(expectedSettleHints)) {
    const row = settle.find(r => r.name.includes(hint));
    if (!row) {
      console.error(`STOP: missing settle-eligible technique containing '${hint}'`);
      stop = true;
      continue;
    }
    const actual = new Set(row.settle_eligible_for);
    const missing = expectedSet.filter(s => !actual.has(s));
    const extra   = [...actual].filter(s => !expectedSet.includes(s));
    if (missing.length || extra.length) {
      console.error(`WARN: ${row.name} settle_eligible_for diverges — missing=${missing.join(',')} extra=${extra.join(',')}`);
      warn = true;
    }
  }

  // 2. settle pool size per state focus at beginner level
  header('2. settle pool size per state focus (beginner)');
  const settlePools = await q(`
    WITH focuses AS (SELECT slug FROM focus_areas WHERE focus_type = 'state')
    SELECT f.slug, COUNT(bt.id)::int AS settle_pool_size
    FROM focuses f
    LEFT JOIN breathwork_techniques bt
      ON f.slug = ANY(bt.settle_eligible_for)
     AND bt.difficulty = 'beginner'
    GROUP BY f.slug
    ORDER BY f.slug
  `);
  console.table(settlePools);
  for (const r of settlePools) {
    if (r.settle_pool_size < 1) {
      console.error(`STOP: settle pool empty for ${r.slug}`);
      stop = true;
    } else if (r.settle_pool_size === 1) {
      console.error(`WARN: settle pool only 1 for ${r.slug} — variety lost`);
      warn = true;
    }
  }

  // 3. focus_content_compatibility role='main' rows per state focus
  header('3. fcc main rows per state focus');
  const mainRows = await q(`
    SELECT fa.slug, COUNT(*)::int AS n_mains
    FROM focus_content_compatibility fcc
    JOIN focus_areas fa ON fa.id = fcc.focus_id
    WHERE fa.focus_type = 'state'
      AND fcc.role = 'main'
      AND fcc.content_type = 'breathwork'
    GROUP BY fa.slug
    ORDER BY fa.slug
  `);
  console.table(mainRows);
  for (const r of mainRows) {
    if (r.n_mains < 1) {
      console.error(`STOP: zero main rows for ${r.slug}`);
      stop = true;
    }
  }

  // 4. main pool standalone_compatible=true
  header('4. fcc main rows × standalone_compatible=true per state focus');
  const standaloneMains = await q(`
    SELECT fa.slug, COUNT(*)::int AS n_standalone_mains
    FROM focus_content_compatibility fcc
    JOIN focus_areas fa ON fa.id = fcc.focus_id
    JOIN breathwork_techniques bt ON bt.id = fcc.content_id
    WHERE fa.focus_type = 'state'
      AND fcc.role = 'main'
      AND fcc.content_type = 'breathwork'
      AND bt.standalone_compatible = true
    GROUP BY fa.slug
    ORDER BY fa.slug
  `);
  console.table(standaloneMains);
  // Compare to #3
  const map3 = Object.fromEntries(mainRows.map(r => [r.slug, r.n_mains]));
  for (const r of standaloneMains) {
    if (r.n_standalone_mains !== map3[r.slug]) {
      console.error(`WARN: standalone filter dropped rows for ${r.slug}: ${map3[r.slug]} → ${r.n_standalone_mains}`);
      warn = true;
    }
  }

  // 5. beginner main pool size per focus
  header('5. beginner-level main pool per state focus');
  const beginnerMains = await q(`
    SELECT fa.slug, COUNT(*)::int AS n_beginner_mains
    FROM focus_content_compatibility fcc
    JOIN focus_areas fa ON fa.id = fcc.focus_id
    JOIN breathwork_techniques bt ON bt.id = fcc.content_id
    WHERE fa.focus_type = 'state'
      AND fcc.role = 'main'
      AND fcc.content_type = 'breathwork'
      AND bt.standalone_compatible = true
      AND bt.difficulty = 'beginner'
    GROUP BY fa.slug
    ORDER BY fa.slug
  `);
  console.table(beginnerMains);
  // Note: a state focus may have 0 beginner main rows even with 'main' rows — flag it.
  const stateFocuses = ['energize', 'calm', 'focus', 'sleep', 'recover'];
  for (const slug of stateFocuses) {
    const row = beginnerMains.find(r => r.slug === slug);
    if (!row || row.n_beginner_mains === 0) {
      console.error(`WARN: zero beginner main techniques for ${slug} — engine will fall back`);
      warn = true;
    }
  }

  // 6. duration columns sample for 'calm' main techniques
  header('6. calm main techniques with duration columns');
  const calmDurations = await q(`
    SELECT bt.name, bt.difficulty,
           bt.beginner_duration_min, bt.beginner_duration_max,
           bt.intermediate_duration_min, bt.intermediate_duration_max,
           bt.advanced_duration_min, bt.advanced_duration_max
    FROM focus_content_compatibility fcc
    JOIN focus_areas fa ON fa.id = fcc.focus_id
    JOIN breathwork_techniques bt ON bt.id = fcc.content_id
    WHERE fa.slug = 'calm'
      AND fcc.role = 'main'
      AND fcc.content_type = 'breathwork'
    ORDER BY bt.difficulty, bt.name
  `);
  console.table(calmDurations);

  // Bonus: full per-focus per-difficulty pool inventory
  header('7. Bonus — main pool per (state focus × difficulty)');
  const inv = await q(`
    SELECT fa.slug AS focus, bt.difficulty, COUNT(*)::int AS n
    FROM focus_content_compatibility fcc
    JOIN focus_areas fa ON fa.id = fcc.focus_id
    JOIN breathwork_techniques bt ON bt.id = fcc.content_id
    WHERE fa.focus_type='state' AND fcc.role='main' AND fcc.content_type='breathwork'
      AND bt.standalone_compatible=true
    GROUP BY fa.slug, bt.difficulty
    ORDER BY fa.slug, bt.difficulty
  `);
  console.table(inv);

  console.log('\n');
  if (stop) {
    console.error('==> STOP CONDITION HIT.');
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
  .catch(err => { console.error('Pre-flight crashed:', err); process.exitCode = 1; })
  .finally(() => pool.end());
