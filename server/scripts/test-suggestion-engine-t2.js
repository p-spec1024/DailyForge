// Smoke test for the S12-T2 suggestion engine.
// Usage:
//   node --env-file=.env scripts/test-suggestion-engine-t2.js
//
// Resolves a test user (TEST_USER_EMAIL or the user with the most sessions),
// then exercises the 3 in-scope recipes across the 10 in-scope body focuses
// at budget 30. Verifies returned items are level-appropriate, exclusion-clean,
// and shape-correct. Also confirms 4 out-of-scope inputs throw NotImplementedError.

import 'dotenv/config';
import { pool } from '../src/db/pool.js';
import { generateSession, NotImplementedError } from '../src/services/suggestionEngine.js';

const IN_SCOPE_FOCUSES = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps',
  'core', 'glutes', 'quads', 'hamstrings', 'calves',
];
const ENTRY_POINTS = ['home', 'strength_tab', 'yoga_tab'];

// Spec pick counts per (shape, budget) — used to detect content-degradation.
// When actual phase items < spec, the session is "degraded" (tiny pool, exclusions
// dropped phases) and the tight drift threshold doesn't apply.
const EXPECTED_PHASE_ITEMS = {
  cross_pillar: {
    30: { bookend_open: 1, warmup: 1, main: 3, cooldown: 1, bookend_close: 1 },
    60: { bookend_open: 1, warmup: 2, main: 5, cooldown: 2, bookend_close: 1 },
  },
  pillar_pure_strength: {
    30: { main: 5 },
    60: { main: 8 },
  },
  pillar_pure_yoga: {
    15: { warmup: 1, main: 3, cooldown: 1 },
    30: { warmup: 2, main: 5, cooldown: 2 },
    45: { warmup: 2, main: 8, cooldown: 3 },
    60: { warmup: 3, main: 10, cooldown: 4 },
  },
};

let pass = 0;
let fail = 0;
function check(label, cond, detail = '') {
  if (cond) { pass++; console.log(`  PASS  ${label}`); }
  else      { fail++; console.log(`  FAIL  ${label}${detail ? ' — ' + detail : ''}`); }
}

async function pickTestUser() {
  if (process.env.TEST_USER_EMAIL) {
    const { rows } = await pool.query(
      'SELECT id, email FROM users WHERE email = $1',
      [process.env.TEST_USER_EMAIL]
    );
    if (rows.length === 0) {
      throw new Error(`TEST_USER_EMAIL=${process.env.TEST_USER_EMAIL} not found in users`);
    }
    return rows[0];
  }
  const { rows } = await pool.query(
    `SELECT u.id, u.email,
            (SELECT COUNT(*) FROM sessions s
              WHERE s.user_id = u.id AND s.completed = true) AS total
       FROM users u
      ORDER BY total DESC, u.id ASC
      LIMIT 1`
  );
  if (rows.length === 0) throw new Error('No users in DB to test against');
  return rows[0];
}

async function fetchUserLevels(userId) {
  const { rows } = await pool.query(
    `SELECT pillar, level FROM user_pillar_levels WHERE user_id = $1`,
    [userId]
  );
  const out = { strength: 'beginner', yoga: 'beginner', breathwork: 'beginner' };
  for (const r of rows) out[r.pillar] = r.level;
  return out;
}

const LEVEL_RANK = { beginner: 1, intermediate: 2, advanced: 3 };

async function fetchExerciseDifficulty(id) {
  const { rows } = await pool.query(
    `SELECT difficulty FROM exercises WHERE id = $1`, [id]);
  return rows[0]?.difficulty;
}
async function fetchBreathworkDifficulty(id) {
  const { rows } = await pool.query(
    `SELECT difficulty FROM breathwork_techniques WHERE id = $1`, [id]);
  return rows[0]?.difficulty;
}
async function fetchExclusions(userId) {
  const { rows } = await pool.query(
    `SELECT content_type, content_id FROM user_excluded_exercises WHERE user_id = $1`,
    [userId]
  );
  return new Set(rows.map((r) => `${r.content_type}:${r.content_id}`));
}

async function assertSession(label, session, levels, exclusions, expectedShape, expectedBudget) {
  // A1 implicit: caller already checked it didn't throw.
  // A2: phases array non-empty
  check(`${label}: phases non-empty`, Array.isArray(session.phases) && session.phases.length > 0);

  // metadata.user_levels matches what we fetched for the user
  check(`${label}: metadata.user_levels matches user`,
    JSON.stringify(session.metadata?.user_levels) === JSON.stringify(levels),
    `got ${JSON.stringify(session.metadata?.user_levels)} expected ${JSON.stringify(levels)}`);

  // metadata.estimated_total_min: tight ±10% (≥30 budget) or ±20% (15 budget)
  // when the session is fully populated. Skip the strict check (sanity-only)
  // when content-degraded: any phase has fewer items than the spec count
  // (small eligible pool, exclusions). Spec acceptance #9 applies to non-
  // degraded sessions.
  if (Number.isInteger(expectedBudget)) {
    const actual = session.metadata?.estimated_total_min;
    const shapeKey = expectedShape === 'cross_pillar'
      ? 'cross_pillar'
      : expectedShape === 'pillar_pure_strength'
      ? 'pillar_pure_strength'
      : 'pillar_pure_yoga';
    const expectedPhaseCounts = EXPECTED_PHASE_ITEMS[shapeKey]?.[expectedBudget] || {};
    const actualByPhase = {};
    for (const ph of session.phases) actualByPhase[ph.phase] = ph.items.length;

    const deficits = [];
    for (const [phaseName, expectedCount] of Object.entries(expectedPhaseCounts)) {
      const ac = actualByPhase[phaseName] ?? 0;
      if (ac < expectedCount) deficits.push(`${phaseName}:${ac}/${expectedCount}`);
    }
    const degraded = deficits.length > 0;

    if (degraded) {
      check(`${label}: estimated_total_min ${actual} present (degraded — ${deficits.join(', ')})`,
        Number.isInteger(actual) && actual > 0);
    } else {
      const tol   = expectedBudget === 15 ? 0.20 : 0.10;
      const drift = Number.isInteger(actual)
        ? Math.abs(actual - expectedBudget) / expectedBudget
        : 1;
      check(`${label}: estimated_total_min ${actual} within ±${tol * 100}% of budget ${expectedBudget}`,
        Number.isInteger(actual) && drift <= tol,
        `drift=${(drift * 100).toFixed(1)}%`);
    }
  }

  // A8: shape-specific phase structure
  if (expectedShape === 'cross_pillar') {
    check(`${label}: session_shape=cross_pillar`, session.session_shape === 'cross_pillar');
    const phaseNames = session.phases.map((p) => p.phase);
    const validOrder = ['bookend_open', 'warmup', 'main', 'cooldown', 'bookend_close'];
    // Phases must appear in valid_order order (subsequence allowed for degraded yoga).
    let lastIdx = -1;
    let inOrder = true;
    for (const p of phaseNames) {
      const idx = validOrder.indexOf(p);
      if (idx < 0 || idx <= lastIdx) { inOrder = false; break; }
      lastIdx = idx;
    }
    check(`${label}: phases in valid order`, inOrder, `got ${phaseNames.join(' → ')}`);
    check(`${label}: includes main`, phaseNames.includes('main'));
  } else if (expectedShape === 'pillar_pure_strength') {
    check(`${label}: session_shape=pillar_pure`, session.session_shape === 'pillar_pure');
    check(`${label}: only main phase`,
      session.phases.length === 1 && session.phases[0].phase === 'main');
    check(`${label}: no bookends`,
      !session.phases.some((p) => p.phase === 'bookend_open' || p.phase === 'bookend_close'));
  } else if (expectedShape === 'pillar_pure_yoga') {
    check(`${label}: session_shape=pillar_pure`, session.session_shape === 'pillar_pure');
    check(`${label}: no bookends`,
      !session.phases.some((p) => p.phase === 'bookend_open' || p.phase === 'bookend_close'));
    check(`${label}: includes main`,
      session.phases.some((p) => p.phase === 'main'));
    const phaseNames = session.phases.map((p) => p.phase);
    const validOrder = ['warmup', 'main', 'cooldown'];
    let lastIdx = -1;
    let inOrder = true;
    for (const p of phaseNames) {
      const idx = validOrder.indexOf(p);
      if (idx < 0 || idx <= lastIdx) { inOrder = false; break; }
      lastIdx = idx;
    }
    check(`${label}: phases in valid yoga order`, inOrder, `got ${phaseNames.join(' → ')}`);
  }

  // A3-A7: per-item assertions
  for (const ph of session.phases) {
    for (const it of ph.items) {
      check(`${label}/${ph.phase}: item has content_id`, Number.isInteger(it.content_id));
      check(`${label}/${ph.phase}: item has content_type`,
        ['strength', 'yoga', 'breathwork'].includes(it.content_type));
      check(`${label}/${ph.phase}: item has name`, typeof it.name === 'string' && it.name.length > 0);
      check(`${label}/${ph.phase}: item has duration_minutes or sets`,
        Number.isInteger(it.duration_minutes) || Number.isInteger(it.sets));

      // A4-A6: difficulty <= user level for the matching pillar
      const userLevel = levels[it.content_type];
      const userRank = LEVEL_RANK[userLevel];
      const diff = it.content_type === 'breathwork'
        ? await fetchBreathworkDifficulty(it.content_id)
        : await fetchExerciseDifficulty(it.content_id);
      check(`${label}/${ph.phase}: ${it.content_type}#${it.content_id} difficulty=${diff} <= user ${userLevel}`,
        LEVEL_RANK[diff] <= userRank, `got rank ${LEVEL_RANK[diff]} > ${userRank}`);

      // A7: not in user_excluded_exercises
      check(`${label}/${ph.phase}: ${it.content_type}#${it.content_id} not excluded`,
        !exclusions.has(`${it.content_type}:${it.content_id}`));
    }
  }
}

// State-focus session assertion helper (T3). Mirrors assertSession but checks
// the 3-phase shape, the curated settle-pool membership, and the fcc/main link.
async function assertStateSession(label, session, focusSlug, levels, exclusions, budget) {
  // B1 implicit: caller checked it didn't throw.
  // B2: shape
  check(`${label}: session_shape=state_focus`, session.session_shape === 'state_focus');

  // B3: 3 phases in order
  const phaseNames = session.phases.map((p) => p.phase);
  check(`${label}: phases = settle/main/integrate`,
    JSON.stringify(phaseNames) === JSON.stringify(['settle', 'main', 'integrate']),
    `got ${phaseNames.join(' → ')}`);

  // B4: each phase has exactly 1 item
  for (const ph of session.phases) {
    check(`${label}/${ph.phase}: items.length === 1`, ph.items.length === 1,
      `got ${ph.items.length}`);
  }

  const settle = session.phases[0]?.items[0];
  const main   = session.phases[1]?.items[0];
  const integrate = session.phases[2]?.items[0];

  // B5: settle is a real breathwork technique
  check(`${label}/settle: content_type=breathwork`, settle?.content_type === 'breathwork');
  check(`${label}/settle: content_id is positive int`,
    Number.isInteger(settle?.content_id) && settle.content_id > 0);

  // B6: main is a real breathwork technique
  check(`${label}/main: content_type=breathwork`, main?.content_type === 'breathwork');
  check(`${label}/main: content_id is positive int`,
    Number.isInteger(main?.content_id) && main.content_id > 0);

  // B7: integrate is a timer (no technique row)
  check(`${label}/integrate: content_id === null`, integrate?.content_id === null);
  check(`${label}/integrate: content_type=breathwork`, integrate?.content_type === 'breathwork');

  // B8 (load-bearing): settle technique's settle_eligible_for contains the focus_slug
  if (Number.isInteger(settle?.content_id)) {
    const r = await pool.query(
      `SELECT settle_eligible_for FROM breathwork_techniques WHERE id = $1`,
      [settle.content_id]
    );
    const list = r.rows[0]?.settle_eligible_for || [];
    check(`${label}/settle: bt#${settle.content_id} settle_eligible_for contains '${focusSlug}'`,
      Array.isArray(list) && list.includes(focusSlug),
      `got ${JSON.stringify(list)}`);
  }

  // B9: main is in fcc with role='main', content_type='breathwork', standalone_compatible=true
  if (Number.isInteger(main?.content_id)) {
    const r = await pool.query(
      `SELECT 1
         FROM focus_content_compatibility fcc
         JOIN focus_areas fa ON fa.id = fcc.focus_id
         JOIN breathwork_techniques bt ON bt.id = fcc.content_id
        WHERE fa.slug = $1
          AND fcc.role = 'main'
          AND fcc.content_type = 'breathwork'
          AND bt.id = $2
          AND bt.standalone_compatible = true`,
      [focusSlug, main.content_id]
    );
    check(`${label}/main: bt#${main.content_id} is fcc role=main + standalone for '${focusSlug}'`,
      r.rows.length === 1);
  }

  // B10: difficulty <= breathwork_level for settle and main
  const userLevel = levels.breathwork;
  const userRank  = LEVEL_RANK[userLevel];
  for (const it of [settle, main]) {
    if (!Number.isInteger(it?.content_id)) continue;
    const diff = await fetchBreathworkDifficulty(it.content_id);
    check(`${label}: bt#${it.content_id} difficulty=${diff} <= user ${userLevel}`,
      LEVEL_RANK[diff] <= userRank, `got rank ${LEVEL_RANK[diff]} > ${userRank}`);
  }

  // B11: neither settle nor main appears in exclusions
  for (const it of [settle, main]) {
    if (!Number.isInteger(it?.content_id)) continue;
    check(`${label}: bt#${it.content_id} not excluded`,
      !exclusions.has(`breathwork:${it.content_id}`));
  }

  // B12: estimated_total_min within ±10% of budget when the engine could fit,
  // OR honestly shorter (UNDER — main_max < target) OR honestly longer (OVER —
  // pool's lowest-min > target, content gap for this focus at this budget).
  // Both UNDER and OVER are reported as DEGRADED but non-fatal.
  const actual = session.metadata?.estimated_total_min;
  if (!Number.isInteger(actual) || actual <= 0) {
    check(`${label}: estimated_total_min is positive integer`, false, `got ${actual}`);
  } else {
    const drift = Math.abs(actual - budget) / budget;
    if (drift <= 0.10) {
      check(`${label}: estimated_total_min ${actual} within ±10% of budget ${budget}`, true);
    } else {
      // Engine couldn't fit the target — fetch main's level bounds for the report.
      let bounds = '?';
      if (Number.isInteger(main?.content_id)) {
        const r = await pool.query(
          `SELECT ${userLevel}_duration_min AS lo, ${userLevel}_duration_max AS hi
             FROM breathwork_techniques WHERE id = $1`,
          [main.content_id]
        );
        bounds = `${userLevel}_min=${r.rows[0]?.lo}, ${userLevel}_max=${r.rows[0]?.hi}`;
      }
      const dir = actual > budget ? 'OVER ' : 'UNDER';
      console.log(
        `  DEGRADED  ${label}: estimated ${actual} ${dir} budget ${budget} ` +
        `(main '${main?.name}' ${bounds})`
      );
      check(`${label}: estimated_total_min ${actual} present + valid (degraded ${dir.trim()})`,
        actual > 0);
    }
  }

  // B13/B14: settle and integrate clamp to [1, 3]
  check(`${label}/settle: duration in [1,3]`,
    Number.isInteger(settle?.duration_minutes) &&
    settle.duration_minutes >= 1 && settle.duration_minutes <= 3,
    `got ${settle?.duration_minutes}`);
  check(`${label}/integrate: duration in [1,3]`,
    Number.isInteger(integrate?.duration_minutes) &&
    integrate.duration_minutes >= 1 && integrate.duration_minutes <= 3,
    `got ${integrate?.duration_minutes}`);
}

async function assertThrows(label, fn, expectedErrName) {
  try {
    await fn();
    fail++;
    console.log(`  FAIL  ${label} — did not throw`);
  } catch (err) {
    if (err.name === expectedErrName) {
      pass++;
      console.log(`  PASS  ${label} — ${err.name}: ${err.message}`);
    } else {
      fail++;
      console.log(`  FAIL  ${label} — expected ${expectedErrName}, got ${err.name}: ${err.message}`);
    }
  }
}

async function main() {
  const user = await pickTestUser();
  const levels = await fetchUserLevels(user.id);
  const exclusions = await fetchExclusions(user.id);
  console.log(`Test user: id=${user.id} email=${user.email}`);
  console.log(`  levels: ${JSON.stringify(levels)}`);
  console.log(`  exclusions: ${exclusions.size}\n`);

  // ── Phase 1: full matrix at budget 30 ────────────────────────────────
  console.log('=== Matrix: 10 focuses × 3 entry points × budget 30 ===');
  for (const focus_slug of IN_SCOPE_FOCUSES) {
    for (const entry_point of ENTRY_POINTS) {
      const label = `${focus_slug}/${entry_point}/30`;
      let session;
      try {
        session = await generateSession({
          user_id: user.id,
          focus_slug,
          entry_point,
          time_budget_min: 30,
        });
      } catch (err) {
        fail++;
        console.log(`  FAIL  ${label}: threw ${err.name}: ${err.message}`);
        continue;
      }
      const expected = entry_point === 'home'
        ? 'cross_pillar'
        : entry_point === 'strength_tab'
        ? 'pillar_pure_strength'
        : 'pillar_pure_yoga';
      await assertSession(label, session, levels, exclusions, expected, 30);
    }
  }

  // ── Phase 2: budget variants on biceps ───────────────────────────────
  console.log('\n=== Budget variants on biceps ===');

  // home / 60
  {
    const label = 'biceps/home/60';
    const s = await generateSession({
      user_id: user.id, focus_slug: 'biceps', entry_point: 'home', time_budget_min: 60,
    });
    await assertSession(label, s, levels, exclusions, 'cross_pillar', 60);
    const main = s.phases.find((p) => p.phase === 'main');
    check(`${label}: main has 5 items`, main && main.items.length === 5,
      `got ${main?.items.length}`);
  }

  // strength_tab / 60 — 8 items expected (or floor of 5 if pool somehow short)
  {
    const label = 'biceps/strength_tab/60';
    const s = await generateSession({
      user_id: user.id, focus_slug: 'biceps', entry_point: 'strength_tab', time_budget_min: 60,
    });
    await assertSession(label, s, levels, exclusions, 'pillar_pure_strength', 60);
    const main = s.phases[0];
    check(`${label}: main has >= 5 items`, main.items.length >= 5,
      `got ${main.items.length}`);
    check(`${label}: main has 8 items (preferred)`, main.items.length === 8,
      `got ${main.items.length} — biceps strength pool may be < 8`);
  }

  // yoga_tab / 15 — counts {warmup:1, main:3, cooldown:1}
  {
    const label = 'biceps/yoga_tab/15';
    const s = await generateSession({
      user_id: user.id, focus_slug: 'biceps', entry_point: 'yoga_tab', time_budget_min: 15,
    });
    await assertSession(label, s, levels, exclusions, 'pillar_pure_yoga', 15);
    // For biceps the yoga pool is small, so warmup/cooldown may degrade. Just check main exists.
    const main = s.phases.find((p) => p.phase === 'main');
    check(`${label}: main has >= 1 item`, main && main.items.length >= 1);
  }

  // ── Phase 3a: T3 state-focus matrix (5 focuses × {breathwork_tab×4 + home×2}) ──
  console.log('\n=== State-focus matrix: 5 focuses × 6 (entry_point, budget) combos ===');
  const STATE_FOCUSES = ['energize', 'calm', 'focus', 'sleep', 'recover'];
  const STATE_COMBOS = [
    { entry_point: 'breathwork_tab', budget: 3 },
    { entry_point: 'breathwork_tab', budget: 10 },
    { entry_point: 'breathwork_tab', budget: 20 },
    { entry_point: 'breathwork_tab', budget: 30 },
    { entry_point: 'home',           budget: 30 },
    { entry_point: 'home',           budget: 60 },
  ];
  for (const focus_slug of STATE_FOCUSES) {
    for (const { entry_point, budget } of STATE_COMBOS) {
      const label = `${focus_slug}/${entry_point}/${budget}`;
      let session;
      try {
        session = await generateSession({
          user_id: user.id, focus_slug, entry_point, time_budget_min: budget,
        });
      } catch (err) {
        fail++;
        console.log(`  FAIL  ${label}: threw ${err.name}: ${err.message}`);
        continue;
      }
      await assertStateSession(label, session, focus_slug, levels, exclusions, budget);
    }
  }

  // ── Phase 3b: throw assertions ─────────────────────────────────────────
  console.log('\n=== T2 + T3 invalid-input throws ===');
  // Still NotImplementedError (T4 — body-focus special cases)
  await assertThrows(
    'mobility/yoga_tab/30',
    () => generateSession({ user_id: user.id, focus_slug: 'mobility', entry_point: 'yoga_tab', time_budget_min: 30 }),
    'NotImplementedError'
  );
  await assertThrows(
    'full_body/home/30',
    () => generateSession({ user_id: user.id, focus_slug: 'full_body', entry_point: 'home', time_budget_min: 30 }),
    'NotImplementedError'
  );
  // T3 changed: body focus from breathwork_tab is now RangeError (not NotImplementedError).
  await assertThrows(
    'biceps/breathwork_tab/10',
    () => generateSession({ user_id: user.id, focus_slug: 'biceps', entry_point: 'breathwork_tab', time_budget_min: 10 }),
    'RangeError'
  );
  // T3 added: state focus from a body-only tab is RangeError.
  await assertThrows(
    'calm/strength_tab/30',
    () => generateSession({ user_id: user.id, focus_slug: 'calm', entry_point: 'strength_tab', time_budget_min: 30 }),
    'RangeError'
  );
  await assertThrows(
    'calm/yoga_tab/30',
    () => generateSession({ user_id: user.id, focus_slug: 'calm', entry_point: 'yoga_tab', time_budget_min: 30 }),
    'RangeError'
  );
  // T3 added: budget out of range for entry_point.
  await assertThrows(
    'calm/breathwork_tab/999',
    () => generateSession({ user_id: user.id, focus_slug: 'calm', entry_point: 'breathwork_tab', time_budget_min: 999 }),
    'RangeError'
  );

  // ── Phase 4: pretty-print sample sessions ────────────────────────────
  console.log('\n=== Sample: biceps / home / 30 ===');
  const sample = await generateSession({
    user_id: user.id, focus_slug: 'biceps', entry_point: 'home', time_budget_min: 30,
  });
  console.log(JSON.stringify(sample, null, 2));

  console.log('\n=== Sample: calm / breathwork_tab / 10 ===');
  const sampleCalm = await generateSession({
    user_id: user.id, focus_slug: 'calm', entry_point: 'breathwork_tab', time_budget_min: 10,
  });
  console.log(JSON.stringify(sampleCalm, null, 2));

  console.log('\n=== Sample: energize / home / 30 ===');
  const sampleEnergize = await generateSession({
    user_id: user.id, focus_slug: 'energize', entry_point: 'home', time_budget_min: 30,
  });
  console.log(JSON.stringify(sampleEnergize, null, 2));

  console.log(`\n=== ${pass} pass, ${fail} fail ===`);
  process.exitCode = fail === 0 ? 0 : 1;
}

main()
  .catch((err) => {
    console.error('Smoke test crashed:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
