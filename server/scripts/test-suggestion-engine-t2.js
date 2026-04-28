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

  // ── Phase 3: out-of-scope inputs throw NotImplementedError ───────────
  console.log('\n=== Out-of-scope NotImplementedError throws ===');
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
  await assertThrows(
    'calm/home/30',
    () => generateSession({ user_id: user.id, focus_slug: 'calm', entry_point: 'home', time_budget_min: 30 }),
    'NotImplementedError'
  );
  await assertThrows(
    'biceps/breathwork_tab/10',
    () => generateSession({ user_id: user.id, focus_slug: 'biceps', entry_point: 'breathwork_tab', time_budget_min: 10 }),
    'NotImplementedError'
  );

  // ── Phase 4: pretty-print one session ────────────────────────────────
  console.log('\n=== Sample: biceps / home / 30 ===');
  const sample = await generateSession({
    user_id: user.id, focus_slug: 'biceps', entry_point: 'home', time_budget_min: 30,
  });
  console.log(JSON.stringify(sample, null, 2));

  console.log(`\n=== ${pass} pass, ${fail} fail ===`);
  process.exitCode = fail === 0 ? 0 : 1;
}

main()
  .catch((err) => {
    console.error('Smoke test crashed:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
