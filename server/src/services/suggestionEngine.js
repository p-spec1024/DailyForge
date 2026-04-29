// S12-T2 + S12-T3: Suggestion engine v1, body-focus and state-focus paths.
// Spec: Trackers/S12-suggestion-engine-spec.md
//   - Body-focus recipes (home / strength_tab / yoga_tab) — T2
//   - State-focus recipe (settle → main → integrate) — T3
// Out of scope (intentional throws): mobility, full_body (both T4),
//   recency warnings (T5), swap-counter writes / exclusion endpoints (T6),
//   HTTP routes (T7).
//
// Schema reality (verified by S12-T2 pre-flight, 2026-04-28):
//   - exercises.target_muscles is TEXT (comma/semicolon/period-separated), NOT array.
//     Engine matches focus_muscle_keywords via case-insensitive substring (ILIKE).
//   - exercises.practice_types is TEXT[] of yoga STYLE labels: hatha, vinyasa, yin,
//     restorative, sun_salutation. The spec's 'mobility'/'flexibility' tokens don't
//     exist in the data. Engine remaps:
//       warmup  → vinyasa | sun_salutation | hatha (active prep)
//       cooldown → restorative | yin | hatha       (held/restorative)

import { pool } from '../db/pool.js';

export class NotImplementedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotImplementedError';
  }
}

// ── Constants ────────────────────────────────────────────────────────────

const LEVEL_RANK = { beginner: 1, intermediate: 2, advanced: 3 };
const VALID_PILLARS = new Set(['strength', 'yoga', 'breathwork']);
const VALID_LEVELS  = new Set(['beginner', 'intermediate', 'advanced']);

const WARMUP_PRACTICE_STYLES   = ['vinyasa', 'sun_salutation', 'hatha'];
const COOLDOWN_PRACTICE_STYLES = ['restorative', 'yin', 'hatha'];

const VALID_ENTRY_POINTS = new Set(['home', 'strength_tab', 'yoga_tab', 'breathwork_tab']);

// Spec §Time Budget — main-phase minutes and total beginner sets per
// (recipe, budget). The spec implies a different per-set rate at each
// budget (cross_pillar/30 = 2.0 min/set, cross_pillar/60 = 2.67), so the
// engine reads from this table rather than using one constant. Strength
// contribution to estimated_total_min = SPEC_MAIN_MIN × (actual sets / spec sets)
// — if the engine picks a degraded count of strength exercises, the metadata
// scales down honestly.
const SPEC_MAIN_STRENGTH_MIN = {
  cross_pillar:         { 30: 18, 60: 40 },
  pillar_pure_strength: { 30: 30, 60: 60 },
};
const SPEC_MAIN_STRENGTH_SETS = {
  cross_pillar:         { 30: 9,  60: 15 }, // 3 ex × 3 sets, 5 ex × 3 sets
  pillar_pure_strength: { 30: 15, 60: 24 }, // 5 × 3, 8 × 3
};
// Fallback when recipe/budget pair is outside the table (defensive — present
// callers always hit the table).
const STRENGTH_MIN_PER_SET_FALLBACK = 2.0;

// Sets per strength item, by user's strength level.
const SETS_BY_LEVEL = { beginner: 3, intermediate: 4, advanced: 4 };
const DEFAULT_REPS  = 10;

// Cross-pillar phase minute budgets (spec §Time Budget).
const CROSS_PILLAR_PHASE_MIN = {
  30: { bookend_open: 3, warmup: 3, main: 18, cooldown: 3, bookend_close: 3 },
  60: { bookend_open: 5, warmup: 5, main: 40, cooldown: 5, bookend_close: 5 },
};

// Cross-pillar pick counts per phase.
const CROSS_PILLAR_PICKS = {
  30: { warmup: 1, main: 3, cooldown: 1 },
  60: { warmup: 2, main: 5, cooldown: 2 },
};

// Strength-tab pick counts.
const STRENGTH_TAB_PICKS = { 30: 5, 60: 8 };

// Yoga-tab pick counts per phase.
const YOGA_TAB_PICKS = {
  15: { warmup: 1, main: 3, cooldown: 1 },
  30: { warmup: 2, main: 5, cooldown: 2 },
  45: { warmup: 2, main: 8, cooldown: 3 },
  60: { warmup: 3, main: 10, cooldown: 4 },
};

// State-focus phase minutes per total budget (spec §State Focus —
// settle = MIN(3, budget × 0.10) clamped ≥1; integrate symmetric; main = budget − settle − integrate).
const STATE_FOCUS_PHASE_MIN = {
  3:  { settle: 1, main_target: 1,  integrate: 1 },
  10: { settle: 1, main_target: 8,  integrate: 1 },
  20: { settle: 2, main_target: 16, integrate: 2 },
  30: { settle: 3, main_target: 24, integrate: 3 },
  60: { settle: 3, main_target: 54, integrate: 3 },
};

// Valid (entry_point → budget) combinations. T3 expands beyond T2's body-only set.
const VALID_BUDGETS_BY_ENTRY = {
  home:           new Set([30, 60]),                  // body-focus 5-phase OR state-focus 3-phase
  strength_tab:   new Set([30, 60]),
  yoga_tab:       new Set([15, 30, 45, 60]),
  breathwork_tab: new Set([3, 10, 20, 30]),           // state-focus only
};

// Tabs that only accept body focuses (state focuses are hidden from these pickers).
const BODY_ONLY_ENTRY_POINTS = new Set(['strength_tab', 'yoga_tab']);

// Retries for the state-focus main pick-and-fit loop before falling back.
const STATE_MAIN_RETRY_LIMIT = 3;

// ── Helpers ──────────────────────────────────────────────────────────────

function levelRankOf(level) {
  const r = LEVEL_RANK[level];
  if (!r) throw new Error(`Unknown level: ${level}`);
  return r;
}

function tierBadge(itemDifficulty, userLevel) {
  // Suggestion path filters out items above user level, so itemDifficulty is
  // always <= userLevel here. Returns 'foundational' if strictly below, else null.
  return levelRankOf(itemDifficulty) < levelRankOf(userLevel) ? 'foundational' : null;
}

function clampInt(value, min, max) {
  if (min != null && value < min) return min;
  if (max != null && value > max) return max;
  return value;
}

function roundMin(x) {
  return Math.max(1, Math.round(x));
}

function computeEstimatedTotalMin(phases, recipe, budget) {
  let total = 0;
  let strengthSetsActual = 0;
  for (const ph of phases) {
    for (const it of ph.items) {
      if (it.duration_minutes != null) {
        total += it.duration_minutes;
      } else if (it.sets != null) {
        strengthSetsActual += it.sets;
      }
    }
  }

  if (strengthSetsActual > 0) {
    const specMin  = SPEC_MAIN_STRENGTH_MIN[recipe]?.[budget];
    const specSets = SPEC_MAIN_STRENGTH_SETS[recipe]?.[budget];
    if (specMin && specSets) {
      // Scale the spec's main-phase budget by what actually got picked. If a
      // pillar_pure_strength recipe expected 15 sets but only got 9 (small pool),
      // contribution = 30 × (9/15) = 18.
      total += specMin * (strengthSetsActual / specSets);
    } else {
      total += strengthSetsActual * STRENGTH_MIN_PER_SET_FALLBACK;
    }
  }

  return Math.round(total);
}

// ── Data loaders ─────────────────────────────────────────────────────────

async function resolveLevels(userId) {
  const { rows } = await pool.query(
    `SELECT pillar, level FROM user_pillar_levels WHERE user_id = $1`,
    [userId]
  );
  const out = { strength: 'beginner', yoga: 'beginner', breathwork: 'beginner' };
  for (const r of rows) {
    if (VALID_PILLARS.has(r.pillar) && VALID_LEVELS.has(r.level)) {
      out[r.pillar] = r.level;
    }
  }
  return out;
}

async function resolveFocus(focusSlug) {
  const { rows } = await pool.query(
    `SELECT id, slug, focus_type FROM focus_areas WHERE slug = $1 AND is_active = true`,
    [focusSlug]
  );
  if (rows.length === 0) {
    throw new Error(`Unknown or inactive focus_slug: ${focusSlug}`);
  }
  return rows[0];
}

async function loadMuscleKeywords(focusId) {
  const { rows } = await pool.query(
    `SELECT keyword FROM focus_muscle_keywords WHERE focus_id = $1`,
    [focusId]
  );
  return rows.map((r) => r.keyword);
}

async function loadExclusions(userId, contentType) {
  const { rows } = await pool.query(
    `SELECT content_id FROM user_excluded_exercises
     WHERE user_id = $1 AND content_type = $2`,
    [userId, contentType]
  );
  return rows.map((r) => r.content_id);
}

// ── Phase samplers ───────────────────────────────────────────────────────

// Bookend pick: one breathwork technique tied to the focus via fcc.
// userExcludedIds = user's hard exclusions (user_excluded_exercises rows).
async function pickBookend({ role, focusSlug, breathworkLevel, userExcludedIds }) {
  const userRank = levelRankOf(breathworkLevel);
  const { rows } = await pool.query(
    `SELECT bt.id, bt.name, bt.difficulty,
            bt.beginner_duration_min, bt.beginner_duration_max,
            bt.intermediate_duration_min, bt.intermediate_duration_max,
            bt.advanced_duration_min, bt.advanced_duration_max
       FROM focus_content_compatibility fcc
       JOIN focus_areas fa ON fa.id = fcc.focus_id
       JOIN breathwork_techniques bt ON bt.id = fcc.content_id
      WHERE fa.slug = $1
        AND fcc.role = $2
        AND fcc.content_type = 'breathwork'
        AND CASE bt.difficulty
              WHEN 'beginner' THEN 1
              WHEN 'intermediate' THEN 2
              WHEN 'advanced' THEN 3
            END <= $3
        AND NOT (bt.id = ANY($4::int[]))
      ORDER BY random()
      LIMIT 1`,
    [focusSlug, role, userRank, userExcludedIds]
  );
  return rows[0] || null;
}

// Strength pick: N strength rows matching focus muscle keywords.
//   userExcludedIds    = user's hard exclusions (user_excluded_exercises).
//   sessionExcludedIds = in-session de-dup (e.g. exclude warmup picks from cooldown).
async function pickStrength({ keywords, strengthLevel, userExcludedIds, sessionExcludedIds = [], limit }) {
  if (keywords.length === 0) return [];
  const userRank = levelRankOf(strengthLevel);
  const { rows } = await pool.query(
    `SELECT id, name, difficulty, target_muscles
       FROM exercises
      WHERE type = 'strength'
        AND CASE difficulty
              WHEN 'beginner' THEN 1
              WHEN 'intermediate' THEN 2
              WHEN 'advanced' THEN 3
            END <= $1
        AND NOT (id = ANY($2::int[]))
        AND NOT (id = ANY($3::int[]))
        AND EXISTS (
          SELECT 1 FROM unnest($4::text[]) AS kw
          WHERE LOWER(target_muscles) LIKE '%' || LOWER(kw) || '%'
        )
      ORDER BY random()
      LIMIT $5`,
    [userRank, userExcludedIds, sessionExcludedIds, keywords, limit]
  );
  return rows;
}

// Yoga pick: N yoga rows matching focus muscle keywords + practice_type filter.
//   userExcludedIds    = user's hard exclusions.
//   sessionExcludedIds = in-session de-dup.
async function pickYoga({
  keywords, yogaLevel, userExcludedIds, sessionExcludedIds = [],
  limit, practiceStyles = null,
}) {
  if (keywords.length === 0) return [];
  const userRank = levelRankOf(yogaLevel);
  const params = [userRank, userExcludedIds, sessionExcludedIds, keywords, limit];
  let practiceClause = '';
  if (practiceStyles && practiceStyles.length > 0) {
    params.push(practiceStyles);
    practiceClause = `AND practice_types && $${params.length}::text[]`;
  }
  const { rows } = await pool.query(
    `SELECT id, name, difficulty, target_muscles
       FROM exercises
      WHERE type = 'yoga'
        AND CASE difficulty
              WHEN 'beginner' THEN 1
              WHEN 'intermediate' THEN 2
              WHEN 'advanced' THEN 3
            END <= $1
        AND NOT (id = ANY($2::int[]))
        AND NOT (id = ANY($3::int[]))
        AND EXISTS (
          SELECT 1 FROM unnest($4::text[]) AS kw
          WHERE LOWER(target_muscles) LIKE '%' || LOWER(kw) || '%'
        )
        ${practiceClause}
      ORDER BY random()
      LIMIT $5`,
    params
  );
  return rows;
}

// ── Item formatters ──────────────────────────────────────────────────────

function bookendItem(row, durationMin, breathworkLevel) {
  const minCol = `${breathworkLevel}_duration_min`;
  const maxCol = `${breathworkLevel}_duration_max`;
  const lo = row[minCol];
  const hi = row[maxCol];
  // Clamp to per-level bounds when populated; otherwise use the spec target.
  const dur = (lo != null && hi != null)
    ? clampInt(durationMin, lo, hi)
    : durationMin;
  return {
    content_type: 'breathwork',
    content_id: row.id,
    name: row.name,
    duration_minutes: dur,
    sets: null,
    reps: null,
    tier_badge: tierBadge(row.difficulty, breathworkLevel),
  };
}

function strengthItem(row, strengthLevel) {
  return {
    content_type: 'strength',
    content_id: row.id,
    name: row.name,
    duration_minutes: null,
    sets: SETS_BY_LEVEL[strengthLevel],
    reps: DEFAULT_REPS,
    tier_badge: tierBadge(row.difficulty, strengthLevel),
  };
}

function yogaItem(row, perItemMin, yogaLevel) {
  return {
    content_type: 'yoga',
    content_id: row.id,
    name: row.name,
    duration_minutes: roundMin(perItemMin),
    sets: null,
    reps: null,
    tier_badge: tierBadge(row.difficulty, yogaLevel),
  };
}

// ── Recipes ──────────────────────────────────────────────────────────────

async function generateCrossPillar({ userId, focus, levels, timeBudget }) {
  if (![30, 60].includes(timeBudget)) {
    throw new RangeError(`time_budget_min must be 30 or 60 for home entry; got ${timeBudget}`);
  }
  const phaseMin = CROSS_PILLAR_PHASE_MIN[timeBudget];
  const picks    = CROSS_PILLAR_PICKS[timeBudget];

  const keywords = await loadMuscleKeywords(focus.id);
  if (keywords.length === 0) {
    throw new Error(`No muscle keywords for in-scope body focus '${focus.slug}'`);
  }
  const [excludedStrength, excludedYoga, excludedBreathwork] = await Promise.all([
    loadExclusions(userId, 'strength'),
    loadExclusions(userId, 'yoga'),
    loadExclusions(userId, 'breathwork'),
  ]);

  const phases = [];

  // bookend_open
  const openTech = await pickBookend({
    role: 'bookend_open',
    focusSlug: focus.slug,
    breathworkLevel: levels.breathwork,
    userExcludedIds: excludedBreathwork,
  });
  if (openTech) {
    phases.push({
      phase: 'bookend_open',
      items: [bookendItem(openTech, phaseMin.bookend_open, levels.breathwork)],
    });
  } else {
    console.error(
      `[suggestionEngine] empty bookend_open pool for focus=${focus.slug}, level=${levels.breathwork}`
    );
  }

  // warmup (yoga, active styles)
  const warmupRows = await pickYoga({
    keywords,
    yogaLevel: levels.yoga,
    userExcludedIds: excludedYoga,
    limit: picks.warmup,
    practiceStyles: WARMUP_PRACTICE_STYLES,
  });
  if (warmupRows.length > 0) {
    const perItem = phaseMin.warmup / warmupRows.length;
    phases.push({
      phase: 'warmup',
      items: warmupRows.map((r) => yogaItem(r, perItem, levels.yoga)),
    });
  }

  // main (strength) — load-bearing, throw if empty
  const mainRows = await pickStrength({
    keywords,
    strengthLevel: levels.strength,
    userExcludedIds: excludedStrength,
    limit: picks.main,
  });
  if (mainRows.length === 0) {
    throw new Error(
      `No eligible strength exercises for focus=${focus.slug}, level=${levels.strength}, after exclusions`
    );
  }
  phases.push({
    phase: 'main',
    items: mainRows.map((r) => strengthItem(r, levels.strength)),
  });

  // cooldown (yoga, restorative styles), avoiding warmup duplicates
  const warmupIds = warmupRows.map((r) => r.id);
  const cooldownRows = await pickYoga({
    keywords,
    yogaLevel: levels.yoga,
    userExcludedIds: excludedYoga,
    sessionExcludedIds: warmupIds,
    limit: picks.cooldown,
    practiceStyles: COOLDOWN_PRACTICE_STYLES,
  });
  if (cooldownRows.length > 0) {
    const perItem = phaseMin.cooldown / cooldownRows.length;
    phases.push({
      phase: 'cooldown',
      items: cooldownRows.map((r) => yogaItem(r, perItem, levels.yoga)),
    });
  }

  // bookend_close
  const closeTech = await pickBookend({
    role: 'bookend_close',
    focusSlug: focus.slug,
    breathworkLevel: levels.breathwork,
    userExcludedIds: excludedBreathwork,
  });
  if (closeTech) {
    phases.push({
      phase: 'bookend_close',
      items: [bookendItem(closeTech, phaseMin.bookend_close, levels.breathwork)],
    });
  } else {
    console.error(
      `[suggestionEngine] empty bookend_close pool for focus=${focus.slug}, level=${levels.breathwork}`
    );
  }

  return {
    session_shape: 'cross_pillar',
    phases,
    warnings: [],
    metadata: {
      estimated_total_min: computeEstimatedTotalMin(phases, 'cross_pillar', timeBudget),
      requested_budget_min: timeBudget,
      user_levels: levels,
    },
  };
}

async function generateStrengthOnly({ userId, focus, levels, timeBudget }) {
  if (![30, 60].includes(timeBudget)) {
    throw new RangeError(`time_budget_min must be 30 or 60 for strength_tab entry; got ${timeBudget}`);
  }
  const limit = STRENGTH_TAB_PICKS[timeBudget];

  const keywords = await loadMuscleKeywords(focus.id);
  if (keywords.length === 0) {
    throw new Error(`No muscle keywords for in-scope body focus '${focus.slug}'`);
  }
  const excludedStrength = await loadExclusions(userId, 'strength');

  const rows = await pickStrength({
    keywords,
    strengthLevel: levels.strength,
    userExcludedIds: excludedStrength,
    limit,
  });
  if (rows.length === 0) {
    throw new Error(
      `No eligible strength exercises for focus=${focus.slug}, level=${levels.strength}, after exclusions`
    );
  }

  const phases = [
    { phase: 'main', items: rows.map((r) => strengthItem(r, levels.strength)) },
  ];
  return {
    session_shape: 'pillar_pure',
    phases,
    warnings: [],
    metadata: {
      estimated_total_min: computeEstimatedTotalMin(phases, 'pillar_pure_strength', timeBudget),
      requested_budget_min: timeBudget,
      user_levels: levels,
    },
  };
}

async function generateYogaOnly({ userId, focus, levels, timeBudget }) {
  if (![15, 30, 45, 60].includes(timeBudget)) {
    throw new RangeError(`time_budget_min must be 15/30/45/60 for yoga_tab entry; got ${timeBudget}`);
  }
  const picks = YOGA_TAB_PICKS[timeBudget];

  const keywords = await loadMuscleKeywords(focus.id);
  if (keywords.length === 0) {
    throw new Error(`No muscle keywords for in-scope body focus '${focus.slug}'`);
  }
  const excludedYoga = await loadExclusions(userId, 'yoga');

  // Phase minute split: 15% / 70% / 15% (spec doesn't pin this — reasonable default).
  const warmupMin   = Math.max(1, Math.round(timeBudget * 0.15));
  const mainMin     = Math.max(1, Math.round(timeBudget * 0.70));
  const cooldownMin = Math.max(1, timeBudget - warmupMin - mainMin);

  const phases = [];

  const warmupRows = await pickYoga({
    keywords,
    yogaLevel: levels.yoga,
    userExcludedIds: excludedYoga,
    limit: picks.warmup,
    practiceStyles: WARMUP_PRACTICE_STYLES,
  });
  if (warmupRows.length > 0) {
    const perItem = warmupMin / warmupRows.length;
    phases.push({
      phase: 'warmup',
      items: warmupRows.map((r) => yogaItem(r, perItem, levels.yoga)),
    });
  }

  // Main allows poses to repeat from warmup (spec: cooldown excludes warmup+main, but
  // main is unfiltered). Matters for tiny pools (e.g. biceps yoga has 1 candidate at
  // beginner level — without this, main would always be empty after a warmup pick).
  const warmupIds = warmupRows.map((r) => r.id);
  const mainRows = await pickYoga({
    keywords,
    yogaLevel: levels.yoga,
    userExcludedIds: excludedYoga,
    limit: picks.main,
  });
  if (mainRows.length === 0) {
    throw new Error(
      `No eligible yoga exercises for focus=${focus.slug}, level=${levels.yoga}, after exclusions`
    );
  }
  const perMain = mainMin / mainRows.length;
  phases.push({
    phase: 'main',
    items: mainRows.map((r) => yogaItem(r, perMain, levels.yoga)),
  });

  const mainIds = mainRows.map((r) => r.id);
  const cooldownRows = await pickYoga({
    keywords,
    yogaLevel: levels.yoga,
    userExcludedIds: excludedYoga,
    sessionExcludedIds: [...warmupIds, ...mainIds],
    limit: picks.cooldown,
    practiceStyles: COOLDOWN_PRACTICE_STYLES,
  });
  if (cooldownRows.length > 0) {
    const perItem = cooldownMin / cooldownRows.length;
    phases.push({
      phase: 'cooldown',
      items: cooldownRows.map((r) => yogaItem(r, perItem, levels.yoga)),
    });
  }

  return {
    session_shape: 'pillar_pure',
    phases,
    warnings: [],
    metadata: {
      estimated_total_min: computeEstimatedTotalMin(phases, 'pillar_pure_yoga', timeBudget),
      requested_budget_min: timeBudget,
      user_levels: levels,
    },
  };
}

// ── State-focus recipe (settle → main → integrate) ───────────────────────
//
// Three-phase shape per spec §State Focus:
//   settle    — one breathwork technique from the curated `settle_eligible_for` pool
//               for this focus (Diaphragmatic always eligible, plus 1 tonal alternative).
//   main      — one breathwork technique from focus_content_compatibility (role='main',
//               standalone_compatible=true, level-appropriate). Pick-and-fit loop tries
//               up to N candidates whose [level_min, level_max] window contains the
//               main_target; falls back to the lowest-min-duration eligible technique
//               when no candidate fits.
//   integrate — silent observed-breathing timer. No technique row (content_id = null).
//
// Duration semantics: settle/integrate are clamped to ≤3 min. The main phase scales
// with budget (budget − settle − integrate). When the picked main's max < main_target,
// the engine returns a SHORTER session honestly (estimated_total_min reflects reality,
// not the requested budget). Settle pool is independent of focus_content_compatibility —
// driven entirely by `breathwork_techniques.settle_eligible_for` from S12-T1.

async function pickSettleTechnique({ focusSlug, breathworkLevel, userExcludedIds }) {
  const userRank = levelRankOf(breathworkLevel);
  const { rows } = await pool.query(
    `SELECT bt.id, bt.name, bt.difficulty,
            bt.beginner_duration_min, bt.beginner_duration_max,
            bt.intermediate_duration_min, bt.intermediate_duration_max,
            bt.advanced_duration_min, bt.advanced_duration_max
       FROM breathwork_techniques bt
      WHERE $1 = ANY(bt.settle_eligible_for)
        AND CASE bt.difficulty
              WHEN 'beginner' THEN 1
              WHEN 'intermediate' THEN 2
              WHEN 'advanced' THEN 3
            END <= $2
        AND NOT (bt.id = ANY($3::int[]))
      ORDER BY random()
      LIMIT 1`,
    [focusSlug, userRank, userExcludedIds]
  );
  return rows[0] || null;
}

// Whole-pool fetch for main; engine shuffles in JS so we can iterate pick-and-fit.
async function loadStateMainPool({ focusSlug, breathworkLevel, userExcludedIds }) {
  const userRank = levelRankOf(breathworkLevel);
  const { rows } = await pool.query(
    `SELECT bt.id, bt.name, bt.difficulty,
            bt.beginner_duration_min, bt.beginner_duration_max,
            bt.intermediate_duration_min, bt.intermediate_duration_max,
            bt.advanced_duration_min, bt.advanced_duration_max
       FROM focus_content_compatibility fcc
       JOIN focus_areas fa ON fa.id = fcc.focus_id
       JOIN breathwork_techniques bt ON bt.id = fcc.content_id
      WHERE fa.slug = $1
        AND fcc.role = 'main'
        AND fcc.content_type = 'breathwork'
        AND bt.standalone_compatible = true
        AND CASE bt.difficulty
              WHEN 'beginner' THEN 1
              WHEN 'intermediate' THEN 2
              WHEN 'advanced' THEN 3
            END <= $2
        AND NOT (bt.id = ANY($3::int[]))
      ORDER BY random()`,
    [focusSlug, userRank, userExcludedIds]
  );
  return rows;
}

function durationsForLevel(row, level) {
  return {
    min: row[`${level}_duration_min`],
    max: row[`${level}_duration_max`],
  };
}

function fitMainCandidate(row, level, mainTarget) {
  const { min, max } = durationsForLevel(row, level);
  if (min == null || max == null) return { kind: 'skip' };
  if (max < mainTarget) {
    // Technique can't fill the budget. Take its max — session shortens honestly.
    return { kind: 'short', mainDuration: max };
  }
  if (min > mainTarget) {
    // Technique needs more time than budget allows. Retry.
    return { kind: 'retry' };
  }
  return { kind: 'fit', mainDuration: mainTarget };
}

async function generateStateFocus({ userId, focus, entryPoint, timeBudget }) {
  if (!STATE_FOCUS_PHASE_MIN[timeBudget]) {
    throw new RangeError(
      `time_budget_min ${timeBudget} not valid for state focus from '${entryPoint}'`
    );
  }
  const { settle: settleMin, main_target: mainTarget, integrate: integrateMin } =
    STATE_FOCUS_PHASE_MIN[timeBudget];

  const levels = await resolveLevels(userId);
  const breathworkLevel = levels.breathwork;
  const excludedBreathwork = await loadExclusions(userId, 'breathwork');

  // 1. Settle.
  const settleRow = await pickSettleTechnique({
    focusSlug: focus.slug,
    breathworkLevel,
    userExcludedIds: excludedBreathwork,
  });
  if (!settleRow) {
    throw new Error(
      `No eligible settle technique for focus=${focus.slug}; check seed integrity`
    );
  }
  const settleItem = {
    content_type: 'breathwork',
    content_id: settleRow.id,
    name: settleRow.name,
    duration_minutes: settleMin,
    sets: null,
    reps: null,
    tier_badge: tierBadge(settleRow.difficulty, breathworkLevel),
  };

  // 2. Main — pick-and-fit loop with bounded retries, then fallback.
  const mainPool = await loadStateMainPool({
    focusSlug: focus.slug,
    breathworkLevel,
    userExcludedIds: excludedBreathwork,
  });
  if (mainPool.length === 0) {
    throw new Error(
      `No eligible main technique for focus=${focus.slug}, level=${breathworkLevel}`
    );
  }

  let mainRow = null;
  let mainDuration = null;
  let attempts = 0;
  for (const candidate of mainPool) {
    if (attempts >= STATE_MAIN_RETRY_LIMIT) break;
    const result = fitMainCandidate(candidate, breathworkLevel, mainTarget);
    // 'skip' is a data error (NULL durations) — don't burn a retry slot on it.
    if (result.kind === 'skip') {
      console.error(
        `[suggestionEngine] state main candidate '${candidate.name}' has NULL ${breathworkLevel}_duration_min/max — skipping`
      );
      continue;
    }
    attempts++;
    if (result.kind === 'fit' || result.kind === 'short') {
      mainRow = candidate;
      mainDuration = result.mainDuration;
      break;
    }
    // 'retry' falls through to next iteration.
  }

  if (!mainRow) {
    // Fallback: pick the lowest-min-duration technique with non-NULL bounds.
    // Re-run fit semantics on the fallback so we honor the budget when possible.
    // If even the fallback's min exceeds main_target (budget structurally too short
    // for this focus's content), use its min — shortest honest duration. The
    // session will run OVER budget; metadata reflects reality, smoke flags it.
    const fallback = mainPool
      .filter((r) => r[`${breathworkLevel}_duration_min`] != null
                  && r[`${breathworkLevel}_duration_max`] != null)
      .sort((a, b) => a[`${breathworkLevel}_duration_min`] - b[`${breathworkLevel}_duration_min`])[0];
    if (!fallback) {
      throw new Error(
        `No fallback main technique with non-NULL duration for focus=${focus.slug}, level=${breathworkLevel}`
      );
    }
    mainRow = fallback;
    const fit = fitMainCandidate(fallback, breathworkLevel, mainTarget);
    if (fit.kind === 'fit' || fit.kind === 'short') {
      mainDuration = fit.mainDuration;
    } else {
      // 'retry' — tech's min > main_target. Use min (closest honest duration).
      mainDuration = durationsForLevel(fallback, breathworkLevel).min;
    }
  }

  const mainItem = {
    content_type: 'breathwork',
    content_id: mainRow.id,
    name: mainRow.name,
    duration_minutes: mainDuration,
    sets: null,
    reps: null,
    tier_badge: tierBadge(mainRow.difficulty, breathworkLevel),
  };

  // 3. Integrate — silent timer, no technique.
  const integrateItem = {
    content_type: 'breathwork',
    content_id: null,
    name: 'Silent observation',
    duration_minutes: integrateMin,
    sets: null,
    reps: null,
    tier_badge: null,
  };

  const phases = [
    { phase: 'settle',    items: [settleItem] },
    { phase: 'main',      items: [mainItem] },
    { phase: 'integrate', items: [integrateItem] },
  ];

  return {
    session_shape: 'state_focus',
    phases,
    warnings: [],
    metadata: {
      estimated_total_min: computeEstimatedTotalMin(phases, 'state_focus', timeBudget),
      requested_budget_min: timeBudget,
      user_levels: levels,
    },
  };
}

// ── Public entry point ──────────────────────────────────────────────────

/**
 * Generate a level-appropriate session structure for a user + focus + entry point.
 *
 * @param {Object} input
 * @param {number} input.user_id
 * @param {string} input.focus_slug          - e.g. 'biceps' or 'calm'
 * @param {string} input.entry_point         - 'home' | 'strength_tab' | 'yoga_tab' | 'breathwork_tab'
 * @param {number} input.time_budget_min     - per-entry-point set; see VALID_BUDGETS_BY_ENTRY
 * @returns {Promise<{session_shape, phases, warnings, metadata}>}
 */
export async function generateSession({ user_id, focus_slug, entry_point, time_budget_min }) {
  if (!Number.isInteger(user_id) || user_id <= 0) {
    throw new TypeError(`user_id must be a positive integer; got ${user_id}`);
  }
  if (typeof focus_slug !== 'string' || focus_slug.length === 0) {
    throw new TypeError(`focus_slug must be a non-empty string`);
  }
  if (!VALID_ENTRY_POINTS.has(entry_point)) {
    throw new TypeError(`entry_point must be one of ${[...VALID_ENTRY_POINTS].join(', ')}; got ${entry_point}`);
  }
  if (!Number.isInteger(time_budget_min) || time_budget_min <= 0) {
    throw new TypeError(
      `time_budget_min must be a positive integer; got ${typeof time_budget_min} ${time_budget_min}`
    );
  }
  if (!VALID_BUDGETS_BY_ENTRY[entry_point].has(time_budget_min)) {
    throw new RangeError(
      `time_budget_min ${time_budget_min} not valid for entry_point '${entry_point}'; ` +
      `valid: ${[...VALID_BUDGETS_BY_ENTRY[entry_point]].join(', ')}`
    );
  }

  const focus = await resolveFocus(focus_slug);

  // T4 holds these — body focuses with their own special-case shapes.
  if (focus.slug === 'mobility') {
    throw new NotImplementedError('mobility special-case lands in S12-T4');
  }
  if (focus.slug === 'full_body') {
    throw new NotImplementedError('full_body special-case lands in S12-T4');
  }

  // State focuses route to the state recipe regardless of entry point.
  // Strength/yoga tabs hide state focuses in their pickers; defend anyway.
  if (focus.focus_type === 'state') {
    if (BODY_ONLY_ENTRY_POINTS.has(entry_point)) {
      throw new RangeError(
        `state focus '${focus.slug}' is not valid from '${entry_point}'; ` +
        `state focuses are surfaced from 'home' and 'breathwork_tab' only`
      );
    }
    return generateStateFocus({ userId: user_id, focus, entryPoint: entry_point, timeBudget: time_budget_min });
  }

  // Body focus from breathwork_tab is invalid — breathwork_tab is state-only.
  if (entry_point === 'breathwork_tab') {
    throw new RangeError(
      `body focus '${focus.slug}' is not valid from 'breathwork_tab'; ` +
      `breathwork_tab supports state focuses only`
    );
  }

  const levels = await resolveLevels(user_id);

  switch (entry_point) {
    case 'home':
      return generateCrossPillar({ userId: user_id, focus, levels, timeBudget: time_budget_min });
    case 'strength_tab':
      return generateStrengthOnly({ userId: user_id, focus, levels, timeBudget: time_budget_min });
    case 'yoga_tab':
      return generateYogaOnly({ userId: user_id, focus, levels, timeBudget: time_budget_min });
    default:
      // Unreachable — VALID_ENTRY_POINTS gate above.
      throw new Error(`Unhandled entry_point: ${entry_point}`);
  }
}
