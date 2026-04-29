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
import {
  generateSession,
  getAvailableDurations,
  BRACKET_TABLE,
  NotImplementedError,
} from '../src/services/suggestionEngine.js';

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

// ── T3.5 state-focus contract ────────────────────────────────────────────

// BRACKET_TABLE imported from the engine — no local mirror. If the engine
// changes the table (centering, reflection, window bounds), the smoke
// automatically re-validates against the new values.
const BRACKET_IDS = Object.keys(BRACKET_TABLE);

// Per Amendment 1 v1.1 (Apr 29, 2026 midday). 39 available / 20 locked / 16 empty.
// For locked cells, the parenthetical is unlocks_at (i = intermediate, a = advanced).
const APPENDIX_A = {
  energize: {
    beginner:     { '0-10': 'available', '10-20': 'available',       '21-30': 'empty',                                '30-45': 'empty',                                'endless': 'available' },
    intermediate: { '0-10': 'available', '10-20': 'available',       '21-30': { state: 'locked_by_level', unlocks_at: 'advanced' }, '30-45': { state: 'locked_by_level', unlocks_at: 'advanced' }, 'endless': 'available' },
    advanced:     { '0-10': 'available', '10-20': 'available',       '21-30': 'available',                            '30-45': 'available',                            'endless': 'available' },
  },
  calm: {
    beginner:     { '0-10': 'available', '10-20': 'available', '21-30': { state: 'locked_by_level', unlocks_at: 'intermediate' }, '30-45': { state: 'locked_by_level', unlocks_at: 'advanced' }, 'endless': 'available' },
    intermediate: { '0-10': 'available', '10-20': 'available', '21-30': 'available',                                 '30-45': { state: 'locked_by_level', unlocks_at: 'advanced' }, 'endless': 'available' },
    advanced:     { '0-10': 'available', '10-20': 'available', '21-30': 'available',                                 '30-45': 'available',                            'endless': 'available' },
  },
  focus: {
    beginner:     { '0-10': 'available', '10-20': 'available', '21-30': { state: 'locked_by_level', unlocks_at: 'intermediate' }, '30-45': { state: 'locked_by_level', unlocks_at: 'advanced' }, 'endless': 'available' },
    intermediate: { '0-10': 'empty',     '10-20': 'available', '21-30': 'available',                                 '30-45': { state: 'locked_by_level', unlocks_at: 'advanced' }, 'endless': 'available' },
    advanced:     { '0-10': 'empty',     '10-20': 'available', '21-30': 'available',                                 '30-45': 'available',                            'endless': 'available' },
  },
  sleep: {
    beginner:     { '0-10': 'available', '10-20': 'available', '21-30': { state: 'locked_by_level', unlocks_at: 'advanced' }, '30-45': 'empty', 'endless': 'available' },
    intermediate: { '0-10': 'available', '10-20': 'available', '21-30': { state: 'locked_by_level', unlocks_at: 'advanced' }, '30-45': 'empty', 'endless': 'available' },
    advanced:     { '0-10': 'available', '10-20': 'available', '21-30': 'available',                                 '30-45': 'empty', 'endless': 'available' },
  },
  recover: {
    beginner:     { '0-10': 'available', '10-20': 'available', '21-30': { state: 'locked_by_level', unlocks_at: 'advanced' }, '30-45': { state: 'locked_by_level', unlocks_at: 'advanced' }, 'endless': 'available' },
    intermediate: { '0-10': 'available', '10-20': 'available', '21-30': { state: 'locked_by_level', unlocks_at: 'advanced' }, '30-45': { state: 'locked_by_level', unlocks_at: 'advanced' }, 'endless': 'available' },
    advanced:     { '0-10': 'empty',     '10-20': 'available', '21-30': 'available',                                 '30-45': 'available',                            'endless': 'available' },
  },
};
const STATE_FOCUSES = ['energize', 'calm', 'focus', 'sleep', 'recover'];
const ALL_LEVELS    = ['beginner', 'intermediate', 'advanced'];

function expectedCellState(focus, level, bracketId) {
  const v = APPENDIX_A[focus][level][bracketId];
  return typeof v === 'string' ? { state: v } : v;
}

// Capture/restore user_pillar_levels.breathwork row for the test user.
async function captureBreathworkLevelRow(userId) {
  const { rows } = await pool.query(
    `SELECT level, source FROM user_pillar_levels WHERE user_id = $1 AND pillar = 'breathwork'`,
    [userId]
  );
  return rows[0] || null;
}

async function setBreathworkLevel(userId, level) {
  await pool.query(
    `INSERT INTO user_pillar_levels (user_id, pillar, level, source)
     VALUES ($1, 'breathwork', $2, 'manual_override')
     ON CONFLICT (user_id, pillar)
     DO UPDATE SET level = EXCLUDED.level, source = EXCLUDED.source`,
    [userId, level]
  );
}

async function restoreBreathworkLevelRow(userId, savedRow) {
  if (savedRow) {
    await pool.query(
      `INSERT INTO user_pillar_levels (user_id, pillar, level, source)
       VALUES ($1, 'breathwork', $2, $3)
       ON CONFLICT (user_id, pillar)
       DO UPDATE SET level = EXCLUDED.level, source = EXCLUDED.source`,
      [userId, savedRow.level, savedRow.source]
    );
  } else {
    await pool.query(
      `DELETE FROM user_pillar_levels WHERE user_id = $1 AND pillar = 'breathwork'`,
      [userId]
    );
  }
}

async function assertThrowsMatching(label, fn, expectedErrName, messageFragment) {
  try {
    await fn();
    fail++;
    console.log(`  FAIL  ${label} — did not throw`);
  } catch (err) {
    let ok = err.name === expectedErrName;
    if (ok && messageFragment != null) {
      ok = String(err.message || '').includes(messageFragment);
    }
    if (ok) {
      pass++;
      console.log(`  PASS  ${label} — ${err.name}: ${err.message}`);
    } else {
      fail++;
      console.log(
        `  FAIL  ${label} — expected ${expectedErrName}` +
        (messageFragment ? ` w/ "${messageFragment}"` : '') +
        `, got ${err.name}: ${err.message}`
      );
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

  // ── Phase 3a: T3.5 state-focus bracket-availability matrix (75 cells) ──
  console.log('\n=== State-focus bracket matrix: 5 focuses × 3 levels × 5 brackets ===');
  for (const focus_slug of STATE_FOCUSES) {
    for (const level of ALL_LEVELS) {
      const result = await getAvailableDurations(focus_slug, level);
      check(`getAvailableDurations(${focus_slug},${level}): focus_slug echoed`,
        result.focus_slug === focus_slug);
      check(`getAvailableDurations(${focus_slug},${level}): level echoed`,
        result.breathwork_level === level);
      check(`getAvailableDurations(${focus_slug},${level}): brackets is array of 5`,
        Array.isArray(result.brackets) && result.brackets.length === 5);
      const byId = Object.fromEntries(result.brackets.map((b) => [b.id, b]));
      for (const bracketId of BRACKET_IDS) {
        const expected = expectedCellState(focus_slug, level, bracketId);
        const live = byId[bracketId];
        const label = `${focus_slug}/${level}/${bracketId}`;
        check(`${label}: state == ${expected.state}`,
          live?.state === expected.state,
          `got ${live?.state}`);
        if (expected.state === 'locked_by_level') {
          check(`${label}: unlocks_at == ${expected.unlocks_at}`,
            live?.unlocks_at === expected.unlocks_at,
            `got ${live?.unlocks_at}`);
        }
        if (expected.state === 'empty') {
          check(`${label}: sample_count == 0`, live?.sample_count === 0,
            `got ${live?.sample_count}`);
        }
        if (expected.state === 'available') {
          check(`${label}: sample_count > 0`, Number.isInteger(live?.sample_count) && live.sample_count > 0,
            `got ${live?.sample_count}`);
        }
      }
    }
  }

  // ── Phase 3b: per-available-cell generation pass + W4 throws + W1 spot-check ──
  // All three sub-phases mutate user_pillar_levels.breathwork. Captured once,
  // restored once. SIGINT/SIGTERM handlers attempt the restore on signal so a
  // Ctrl-C mid-smoke doesn't leave the test user in 'manual_override / advanced'.
  console.log('\n=== Generation pass for every "available" cell ===');
  const savedBreathwork = await captureBreathworkLevelRow(user.id);

  // W2: signal handlers. prependOnceListener so we run before pool.js's shutdown
  // handler closes the pool out from under our restore query.
  let cleanupRan = false;
  const onSignal = async (signal) => {
    if (cleanupRan) return;
    cleanupRan = true;
    console.error(`\n[smoke] caught ${signal} mid state-focus level mutation`);
    try {
      await restoreBreathworkLevelRow(user.id, savedBreathwork);
      console.error('[smoke] user_pillar_levels.breathwork restored');
      process.exit(1);
    } catch (err) {
      const expected = savedBreathwork
        ? `level=${savedBreathwork.level}, source=${savedBreathwork.source}`
        : 'no row (delete only)';
      console.error('[smoke] FAILED to restore user_pillar_levels.breathwork:', err.message);
      console.error(`[smoke] manual recovery — user_id=${user.id}, expected ${expected}`);
      process.exit(2);
    }
  };
  process.prependOnceListener('SIGINT',  () => onSignal('SIGINT'));
  process.prependOnceListener('SIGTERM', () => onSignal('SIGTERM'));

  try {
    for (const level of ALL_LEVELS) {
      await setBreathworkLevel(user.id, level);
      for (const focus_slug of STATE_FOCUSES) {
        for (const bracketId of BRACKET_IDS) {
          const expected = expectedCellState(focus_slug, level, bracketId);
          if (expected.state !== 'available') continue;

          const label = `${focus_slug}/${level}/${bracketId}`;
          let session;
          try {
            session = await generateSession({
              user_id: user.id,
              focus_slug,
              entry_point: 'breathwork_tab',
              bracket: bracketId,
            });
          } catch (err) {
            fail++;
            console.log(`  FAIL  ${label}: threw ${err.name}: ${err.message}`);
            continue;
          }

          // Shape assertions
          check(`${label}: session_shape == state_focus`,
            session.session_shape === 'state_focus');
          check(`${label}: phases.length == 3`, session.phases.length === 3);
          check(`${label}: phases[0].phase == centering`,
            session.phases[0]?.phase === 'centering');
          check(`${label}: phases[1].phase == practice`,
            session.phases[1]?.phase === 'practice');
          check(`${label}: phases[2].phase == reflection`,
            session.phases[2]?.phase === 'reflection');

          const centering  = session.phases[0]?.items[0];
          const practice   = session.phases[1]?.items[0];
          const reflection = session.phases[2]?.items[0];

          check(`${label}/centering: content_id positive int`,
            Number.isInteger(centering?.content_id) && centering.content_id > 0);
          check(`${label}/practice: content_id positive int`,
            Number.isInteger(practice?.content_id) && practice.content_id > 0);
          check(`${label}/reflection: content_id == null`,
            reflection?.content_id === null);

          // Centering tech is in the curated settle pool for this focus
          if (Number.isInteger(centering?.content_id)) {
            const r = await pool.query(
              `SELECT settle_eligible_for FROM breathwork_techniques WHERE id = $1`,
              [centering.content_id]
            );
            const list = r.rows[0]?.settle_eligible_for || [];
            check(`${label}/centering: settle_eligible_for contains ${focus_slug}`,
              Array.isArray(list) && list.includes(focus_slug),
              `got ${JSON.stringify(list)}`);
          }

          // Practice tech is in fcc with role=main + standalone_compatible
          if (Number.isInteger(practice?.content_id)) {
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
              [focus_slug, practice.content_id]
            );
            check(`${label}/practice: fcc role=main + standalone for ${focus_slug}`,
              r.rows.length === 1);
          }

          // Difficulty <= user level for centering and practice
          for (const it of [centering, practice]) {
            if (!Number.isInteger(it?.content_id)) continue;
            const diff = await fetchBreathworkDifficulty(it.content_id);
            check(`${label}: bt#${it.content_id} difficulty=${diff} <= ${level}`,
              LEVEL_RANK[diff] <= LEVEL_RANK[level]);
          }

          // Metadata shape
          const cfg = BRACKET_TABLE[bracketId];
          check(`${label}: metadata.bracket == ${bracketId}`,
            session.metadata?.bracket === bracketId);
          check(`${label}: metadata.is_endless == ${cfg.is_endless}`,
            session.metadata?.is_endless === cfg.is_endless);
          check(`${label}: metadata.user_levels.breathwork == ${level}`,
            session.metadata?.user_levels?.breathwork === level);

          // Duration assertions
          const total = session.metadata?.estimated_total_min;
          if (cfg.is_endless) {
            const expectedTotal = cfg.centering + practice.duration_minutes + cfg.reflection;
            check(`${label}: endless total == centering(${cfg.centering}) + practice + reflection(${cfg.reflection})`,
              total === expectedTotal,
              `got ${total} expected ${expectedTotal}`);
          } else {
            check(`${label}: total ${total} ∈ [${cfg.window_min}, ${cfg.window_max}]`,
              Number.isInteger(total) && total >= cfg.window_min && total <= cfg.window_max,
              `got ${total}`);
          }

          // Centering / reflection durations match BRACKET_TABLE
          check(`${label}/centering: duration == ${cfg.centering}`,
            centering?.duration_minutes === cfg.centering,
            `got ${centering?.duration_minutes}`);
          check(`${label}/reflection: duration == ${cfg.reflection}`,
            reflection?.duration_minutes === cfg.reflection,
            `got ${reflection?.duration_minutes}`);
        }
      }
    }

    // ── W4: locked + empty bracket throws ─────────────────────────────
    // Verify the engine's load-bearing safety throw fires when generateSession
    // is called for a (focus, level, bracket) cell that getAvailableDurations
    // would mark locked_by_level or empty. Spec wording: "caller must pre-check
    // via getAvailableDurations".
    console.log('\n=== W4: locked + empty bracket throws ===');
    await setBreathworkLevel(user.id, 'beginner');
    const w4MsgFragment = 'caller must pre-check via getAvailableDurations';
    // Empty cells (Appendix A v1.1)
    await assertThrowsMatching(
      'W4 empty: energize/beginner/21-30',
      () => generateSession({
        user_id: user.id, focus_slug: 'energize', entry_point: 'breathwork_tab', bracket: '21-30',
      }),
      'Error', w4MsgFragment,
    );
    await assertThrowsMatching(
      'W4 empty: energize/beginner/30-45',
      () => generateSession({
        user_id: user.id, focus_slug: 'energize', entry_point: 'breathwork_tab', bracket: '30-45',
      }),
      'Error', w4MsgFragment,
    );
    // Locked cells (Appendix A v1.1)
    await assertThrowsMatching(
      'W4 locked: calm/beginner/30-45',
      () => generateSession({
        user_id: user.id, focus_slug: 'calm', entry_point: 'breathwork_tab', bracket: '30-45',
      }),
      'Error', w4MsgFragment,
    );
    await assertThrowsMatching(
      'W4 locked: focus/beginner/21-30',
      () => generateSession({
        user_id: user.id, focus_slug: 'focus', entry_point: 'breathwork_tab', bracket: '21-30',
      }),
      'Error', w4MsgFragment,
    );

    // ── W1: getAvailableDurations(userId) honors user_excluded_exercises ──
    console.log('\n=== W1: getAvailableDurations userId-aware ===');
    // Baseline (no userId): user-agnostic count.
    const baseline = await getAvailableDurations('calm', 'beginner');
    const baseline010 = baseline.brackets.find((b) => b.id === '0-10');
    check('W1 baseline: calm/beginner/0-10 sample_count > 0',
      Number.isInteger(baseline010?.sample_count) && baseline010.sample_count > 0,
      `got ${baseline010?.sample_count}`);

    // With userId, no exclusions yet → same count as baseline.
    const withUserNoExcl = await getAvailableDurations('calm', 'beginner', user.id);
    const withUser010 = withUserNoExcl.brackets.find((b) => b.id === '0-10');
    check('W1 userId, no exclusions: calm/beginner/0-10 == baseline',
      withUser010?.sample_count === baseline010?.sample_count,
      `userId=${withUser010?.sample_count} baseline=${baseline010?.sample_count}`);

    // Pick a calm-pool technique that fits 0-10 at beginner (practice window
    // = [1, 8]); insert an exclusion; re-check.
    const { rows: candidates } = await pool.query(
      `SELECT bt.id, bt.name
         FROM focus_content_compatibility fcc
         JOIN focus_areas fa ON fa.id = fcc.focus_id
         JOIN breathwork_techniques bt ON bt.id = fcc.content_id
        WHERE fa.slug = 'calm'
          AND fcc.role = 'main'
          AND fcc.content_type = 'breathwork'
          AND bt.standalone_compatible = true
          AND bt.beginner_duration_min IS NOT NULL
          AND bt.beginner_duration_max IS NOT NULL
          AND GREATEST(bt.beginner_duration_min, 1) <= LEAST(bt.beginner_duration_max, 8)
        ORDER BY bt.id
        LIMIT 1`
    );
    if (candidates.length === 0) {
      fail++;
      console.log('  FAIL  W1: could not find a calm/beginner/0-10 candidate to exclude');
    } else {
      const techToExclude = candidates[0];
      await pool.query(
        `INSERT INTO user_excluded_exercises (user_id, content_type, content_id)
         VALUES ($1, 'breathwork', $2)
         ON CONFLICT DO NOTHING`,
        [user.id, techToExclude.id]
      );
      try {
        const filtered = await getAvailableDurations('calm', 'beginner', user.id);
        const filtered010 = filtered.brackets.find((b) => b.id === '0-10');
        check(
          `W1 with exclusion bt#${techToExclude.id} (${techToExclude.name}): sample_count drops by 1`,
          filtered010?.sample_count === withUser010.sample_count - 1,
          `before=${withUser010.sample_count} after=${filtered010?.sample_count}`
        );
      } finally {
        await pool.query(
          `DELETE FROM user_excluded_exercises
            WHERE user_id = $1 AND content_type = 'breathwork' AND content_id = $2`,
          [user.id, techToExclude.id]
        );
      }
    }
  } finally {
    await restoreBreathworkLevelRow(user.id, savedBreathwork);
  }

  // ── Phase 3c: throw assertions ───────────────────────────────────────
  console.log('\n=== T2 + T3 + T3.5 invalid-input throws ===');
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
  // Body focus from breathwork_tab → RangeError (T3 contract, unchanged).
  await assertThrows(
    'biceps/breathwork_tab/10',
    () => generateSession({ user_id: user.id, focus_slug: 'biceps', entry_point: 'breathwork_tab', time_budget_min: 10 }),
    'RangeError'
  );
  // State focus from body-only tabs → RangeError (T3 contract, unchanged).
  await assertThrows(
    'calm/strength_tab (no bracket)',
    () => generateSession({ user_id: user.id, focus_slug: 'calm', entry_point: 'strength_tab', bracket: '0-10' }),
    'RangeError'
  );
  await assertThrows(
    'calm/yoga_tab (no bracket)',
    () => generateSession({ user_id: user.id, focus_slug: 'calm', entry_point: 'yoga_tab', bracket: '0-10' }),
    'RangeError'
  );
  // T3.5 NEW: state focus without bracket → RangeError.
  await assertThrows(
    'calm/breathwork_tab — no bracket',
    () => generateSession({ user_id: user.id, focus_slug: 'calm', entry_point: 'breathwork_tab' }),
    'RangeError'
  );
  // T3.5 NEW: invalid bracket value → RangeError.
  await assertThrows(
    'calm/breathwork_tab — invalid bracket "5-15"',
    () => generateSession({ user_id: user.id, focus_slug: 'calm', entry_point: 'breathwork_tab', bracket: '5-15' }),
    'RangeError'
  );

  // ── Phase 4: pretty-print sample sessions ────────────────────────────
  console.log('\n=== Sample: biceps / home / 30 ===');
  const sample = await generateSession({
    user_id: user.id, focus_slug: 'biceps', entry_point: 'home', time_budget_min: 30,
  });
  console.log(JSON.stringify(sample, null, 2));

  console.log('\n=== Sample: calm / breathwork_tab / 0-10 ===');
  const sampleCalm = await generateSession({
    user_id: user.id, focus_slug: 'calm', entry_point: 'breathwork_tab', bracket: '0-10',
  });
  console.log(JSON.stringify(sampleCalm, null, 2));

  console.log('\n=== Sample: energize / home / endless ===');
  const sampleEnergize = await generateSession({
    user_id: user.id, focus_slug: 'energize', entry_point: 'home', bracket: 'endless',
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
