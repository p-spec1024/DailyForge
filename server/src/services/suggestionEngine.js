// S12-T2 + S12-T3 + S12-T3.5 + S12-T4: Suggestion engine v1.
// Spec: Trackers/S12-suggestion-engine-spec.md (v2 on `main`)
//       Trackers/S12-T3.5-state-focus-refactor-spec.md (refactor scope)
//       Trackers/S12-T3.5-AMENDMENT-1-appendix-a-correction.md (matrix truth)
//       Trackers/S12-T4-mobility-fullbody-special-cases-spec.md (T4 scope)
//       Trackers/S12-T4-AMENDMENT-1-practice-type-remap.md (T4 SQL truth)
//   - Body-focus recipes (home / strength_tab / yoga_tab) for the 10 keyworded
//     focuses — T2 [unchanged]
//   - State-focus recipe with range-bracket picker — T3 → refactored in T3.5
//     (centering → practice → reflection; bracket-driven duration allocation;
//      getAvailableDurations helper for content-aware UX)
//   - mobility + full_body branches in body-focus recipes — T4
//     (mobility: yoga-dominant; full_body: compound predicate ARRAY_LENGTH>=3)
// Out of scope (intentional throws): recency warnings (T5),
//   swap-counter writes / exclusion endpoints (T6), HTTP routes (T7).
//
// Schema reality (verified by S12-T2 pre-flight, re-verified by S12-T4 pre-flight):
//   - exercises.target_muscles is TEXT (comma/semicolon/period-separated), NOT array.
//     Keyword path matches focus_muscle_keywords via case-insensitive substring (ILIKE).
//     Compound path uses ARRAY_LENGTH(STRING_TO_ARRAY(target_muscles, ','), 1) >= 3
//     via compoundFilter() helper (single source of truth for any future TEXT[] migration).
//   - exercises.practice_types is TEXT[] of yoga STYLE labels: hatha, vinyasa, yin,
//     restorative, sun_salutation. Movement-quality tokens ('mobility', 'flexibility')
//     do NOT exist in the data. The spec's mobility/full_body queries that called
//     for them are remapped per S12-T4-AMENDMENT-1 to live style tokens. Retired
//     when FUTURE_SCOPE movement-quality tagging lands (Sprint 13+).
//   - Engine style sets (single source of truth for recipe queries):
//       WARMUP_PRACTICE_STYLES   = vinyasa | sun_salutation | hatha (active prep)
//       MOBILITY_MAIN_STYLES     = hatha | yin | vinyasa             (broad mobility/flex; T4)
//       COOLDOWN_PRACTICE_STYLES = restorative | yin | hatha          (held/restorative)

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

// Style-token sets used by recipe queries. Per S12-T4-AMENDMENT-1
// (`Trackers/S12-T4-AMENDMENT-1-practice-type-remap.md`), these are the canonical
// remap of the master spec's movement-quality intent (mobility / flexibility /
// restorative) onto the live style data. Retire when movement-quality tagging
// lands (Sprint 13+ tagging ticket — FUTURE_SCOPE entry post-Sprint-12).
const WARMUP_PRACTICE_STYLES   = ['vinyasa', 'sun_salutation', 'hatha']; // active prep
const MOBILITY_MAIN_STYLES     = ['hatha', 'yin', 'vinyasa'];            // broad mobility/flex; T4
const COOLDOWN_PRACTICE_STYLES = ['restorative', 'yin', 'hatha'];        // held/restorative

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

// State-focus bracket table (T3.5 spec §The 5 Brackets). Replaces T3's fixed-
// budget table. Each bracket has fixed centering/reflection bookends and a
// practice window the engine clamps the picked technique into. Endless mode
// runs the technique at its natural max with 2-min bookends.
//
// Exported so test harnesses + downstream callers (T7 HTTP layer, Sprint 13
// picker UI) read from one source of truth — no local mirrors.
export const BRACKET_TABLE = {
  '0-10':    { window_min: 1,  window_max: 10, centering: 1, reflection: 1, is_endless: false },
  '10-20':   { window_min: 10, window_max: 20, centering: 2, reflection: 2, is_endless: false },
  '21-30':   { window_min: 21, window_max: 30, centering: 2, reflection: 2, is_endless: false },
  '30-45':   { window_min: 31, window_max: 45, centering: 3, reflection: 3, is_endless: false },
  'endless': { window_min: null, window_max: null, centering: 2, reflection: 2, is_endless: true },
};
const VALID_BRACKETS = new Set(Object.keys(BRACKET_TABLE));

// Body-focus entry-point budget validation (T2). breathwork_tab only takes
// state focuses now (T3.5 — bracket replaces time_budget_min for state).
const VALID_BUDGETS_BY_ENTRY = {
  home:         new Set([30, 60]),
  strength_tab: new Set([30, 60]),
  yoga_tab:     new Set([15, 30, 45, 60]),
};

// Tabs that only accept body focuses (state focuses are hidden from these pickers).
const BODY_ONLY_ENTRY_POINTS = new Set(['strength_tab', 'yoga_tab']);

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

// Compound-detection SQL fragment (T4). Single source of truth for the
// "exercise hits 3+ muscle groups" predicate. Wraps the text-vs-array storage
// detail of exercises.target_muscles — if a future migration moves it to
// TEXT[], only this helper changes. Returns a literal SQL fragment (no params).
function compoundFilter() {
  return "ARRAY_LENGTH(STRING_TO_ARRAY(target_muscles, ','), 1) >= 3";
}

// Strength-compound pick (T4). Used by full_body across home / strength_tab.
// No keyword filter — the compound predicate IS the muscle filter.
async function pickStrengthCompound({ strengthLevel, userExcludedIds, sessionExcludedIds = [], limit }) {
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
        AND ${compoundFilter()}
      ORDER BY random()
      LIMIT $4`,
    [userRank, userExcludedIds, sessionExcludedIds, limit]
  );
  return rows;
}

// Yoga-compound pick (T4). Used by full_body across home / yoga_tab. Optional
// practiceStyles filter narrows further (e.g. full_body yoga_tab warmup wants
// compound AND warmup styles; full_body home warmup wants compound only).
async function pickYogaCompound({
  yogaLevel, userExcludedIds, sessionExcludedIds = [],
  limit, practiceStyles = null,
}) {
  const userRank = levelRankOf(yogaLevel);
  const params = [userRank, userExcludedIds, sessionExcludedIds, limit];
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
        AND ${compoundFilter()}
        ${practiceClause}
      ORDER BY random()
      LIMIT $4`,
    params
  );
  return rows;
}

// Yoga-by-styles pick (T4). Used by mobility across home / yoga_tab. No muscle
// filter (mobility doesn't have keywords or a compound predicate); just style
// filter + level + dedup. The spec's master-line-668 "yoga fills strength-main
// slot for mobility-home" is realized here — mobility-home calls this three
// times with three different style sets.
async function pickYogaByStyles({
  yogaLevel, userExcludedIds, sessionExcludedIds = [],
  limit, practiceStyles,
}) {
  if (!practiceStyles || practiceStyles.length === 0) {
    throw new Error('pickYogaByStyles requires non-empty practiceStyles');
  }
  const userRank = levelRankOf(yogaLevel);
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
        AND practice_types && $4::text[]
      ORDER BY random()
      LIMIT $5`,
    [userRank, userExcludedIds, sessionExcludedIds, practiceStyles, limit]
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
  // T4 special-case branches: see below the keyworded path.
  if (focus.slug === 'mobility') {
    return generateCrossPillarMobility({ userId, focus, levels, timeBudget });
  }
  if (focus.slug === 'full_body') {
    return generateCrossPillarFullBody({ userId, focus, levels, timeBudget });
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
  // T4 S3 defensive: dispatch already throws RangeError for mobility/strength_tab,
  // but mirror the throw here in case a future refactor reorders dispatch — without
  // this guard, mobility would fall through to the keyworded path below and emit a
  // misleading "No muscle keywords" error.
  if (focus.slug === 'mobility') {
    throw new RangeError(
      'mobility is not available from strength_tab — use yoga_tab or home'
    );
  }
  // T4: full_body uses compound predicate.
  if (focus.slug === 'full_body') {
    return generateStrengthOnlyFullBody({ userId, focus, levels, timeBudget });
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
  // T4 special-case branches.
  if (focus.slug === 'mobility') {
    return generateYogaOnlyMobility({ userId, focus, levels, timeBudget });
  }
  if (focus.slug === 'full_body') {
    return generateYogaOnlyFullBody({ userId, focus, levels, timeBudget });
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

// ── T4: mobility + full_body sub-recipes ─────────────────────────────────
//
// Per S12-T4 spec + Amendment 1: mobility/full_body don't have muscle keywords,
// so the recipes can't share the keyworded path. Each entry-point handler
// detects mobility/full_body up-front and delegates to the corresponding
// sub-recipe. The sub-recipes share scaffolding (level resolution, exclusion
// fetch, bookend pick/build, metadata) — only the warmup/main/cooldown picker
// calls differ.
//
// Key shapes:
//   mobility-home:    bookend / yoga-warmup / yoga-main / yoga-cooldown / bookend
//                     (yoga REPLACES strength-main per Amendment §Mobility
//                     strength-main pool — strength practice_types is empty;
//                     structural always-skip; phases.length === 5 always)
//   mobility-yoga:    yoga-warmup / yoga-main / yoga-cooldown
//                     (3 phases, style-token-driven per Amendment Remap Table)
//   full_body-home:   bookend / yoga-warmup-compound / strength-main-compound /
//                     yoga-cooldown-compound / bookend
//   full_body-stren:  strength-main-compound (1 phase)
//   full_body-yoga:   yoga-warmup-compound+styles / yoga-main-compound /
//                     yoga-cooldown-compound+styles
//
// Picked counts: carry forward from T2 / spec §Mobility / §Full Body.

async function generateCrossPillarMobility({ userId, focus, levels, timeBudget }) {
  const phaseMin = CROSS_PILLAR_PHASE_MIN[timeBudget];
  const picks    = CROSS_PILLAR_PICKS[timeBudget];

  // mobility-home is yoga-only by Amendment §Mobility strength-main pool
  // (strength practice_types is structurally empty, so no strength-mobility
  // exists). If FUTURE_SCOPE #1 lands (authored mobility-tagged strength
  // content), also load excludedStrength here and feed the strength-main
  // path back into the recipe.
  const [excludedYoga, excludedBreathwork] = await Promise.all([
    loadExclusions(userId, 'yoga'),
    loadExclusions(userId, 'breathwork'),
  ]);

  const phases = [];

  // bookend_open. T4 W1(a): mobility-home is "always 5 phases" per Amendment v1.1.
  // Pre-flight asserts bookend rows exist; runtime empty here means user excluded
  // the single eligible row → throw rather than silently degrade to 4 phases.
  const openTech = await pickBookend({
    role: 'bookend_open',
    focusSlug: focus.slug,
    breathworkLevel: levels.breathwork,
    userExcludedIds: excludedBreathwork,
  });
  if (!openTech) {
    console.error(
      `[suggestionEngine] empty bookend_open pool for focus=${focus.slug}, level=${levels.breathwork}`
    );
    throw new Error(
      `No eligible bookend_open for focus=${focus.slug}, level=${levels.breathwork} — ` +
      `user exclusions left this pool empty`
    );
  }
  phases.push({
    phase: 'bookend_open',
    items: [bookendItem(openTech, phaseMin.bookend_open, levels.breathwork)],
  });

  // warmup (yoga, warmup styles, no muscle filter)
  const warmupRows = await pickYogaByStyles({
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

  // main (yoga REPLACES strength-main; mobility-home is structural always-skip-strength).
  // Picked count absorbs strength-main's count per spec §Mobility home shape.
  const warmupIds = warmupRows.map((r) => r.id);
  const mainRows = await pickYogaByStyles({
    yogaLevel: levels.yoga,
    userExcludedIds: excludedYoga,
    sessionExcludedIds: warmupIds,
    limit: picks.main,
    practiceStyles: MOBILITY_MAIN_STYLES,
  });
  if (mainRows.length === 0) {
    throw new Error(
      `No eligible mobility yoga main for level=${levels.yoga}, after exclusions`
    );
  }
  // Yoga-main runs in the strength-main minute slot; per-item duration sized accordingly.
  const mainPerItem = phaseMin.main / mainRows.length;
  phases.push({
    phase: 'main',
    items: mainRows.map((r) => yogaItem(r, mainPerItem, levels.yoga)),
  });

  // cooldown (yoga, cooldown styles, dedup warmup AND main)
  const mainIds = mainRows.map((r) => r.id);
  const cooldownRows = await pickYogaByStyles({
    yogaLevel: levels.yoga,
    userExcludedIds: excludedYoga,
    sessionExcludedIds: [...warmupIds, ...mainIds],
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

  // bookend_close. T4 W1(a): same "always 5 phases" invariant as bookend_open.
  const closeTech = await pickBookend({
    role: 'bookend_close',
    focusSlug: focus.slug,
    breathworkLevel: levels.breathwork,
    userExcludedIds: excludedBreathwork,
  });
  if (!closeTech) {
    console.error(
      `[suggestionEngine] empty bookend_close pool for focus=${focus.slug}, level=${levels.breathwork}`
    );
    throw new Error(
      `No eligible bookend_close for focus=${focus.slug}, level=${levels.breathwork} — ` +
      `user exclusions left this pool empty`
    );
  }
  phases.push({
    phase: 'bookend_close',
    items: [bookendItem(closeTech, phaseMin.bookend_close, levels.breathwork)],
  });

  return {
    session_shape: 'cross_pillar',
    phases,
    warnings: [],
    metadata: {
      // Mobility-home has no strength items, so the strength-spec table doesn't
      // contribute. Pass 'cross_pillar' anyway — computeEstimatedTotalMin's
      // strength branch is skipped when no strength items are present.
      estimated_total_min: computeEstimatedTotalMin(phases, 'cross_pillar', timeBudget),
      requested_budget_min: timeBudget,
      user_levels: levels,
    },
  };
}

async function generateCrossPillarFullBody({ userId, focus, levels, timeBudget }) {
  const phaseMin = CROSS_PILLAR_PHASE_MIN[timeBudget];
  const picks    = CROSS_PILLAR_PICKS[timeBudget];

  const [excludedStrength, excludedYoga, excludedBreathwork] = await Promise.all([
    loadExclusions(userId, 'strength'),
    loadExclusions(userId, 'yoga'),
    loadExclusions(userId, 'breathwork'),
  ]);

  const phases = [];

  // bookend_open. T4 W1(a): full_body-home is "always 5 phases" — throw on empty
  // bookend pool (caller-side exclusions exhausted the single eligible row).
  const openTech = await pickBookend({
    role: 'bookend_open',
    focusSlug: focus.slug,
    breathworkLevel: levels.breathwork,
    userExcludedIds: excludedBreathwork,
  });
  if (!openTech) {
    console.error(
      `[suggestionEngine] empty bookend_open pool for focus=${focus.slug}, level=${levels.breathwork}`
    );
    throw new Error(
      `No eligible bookend_open for focus=${focus.slug}, level=${levels.breathwork} — ` +
      `user exclusions left this pool empty`
    );
  }
  phases.push({
    phase: 'bookend_open',
    items: [bookendItem(openTech, phaseMin.bookend_open, levels.breathwork)],
  });

  // warmup (yoga, compound, NO style filter — spec line 290)
  const warmupRows = await pickYogaCompound({
    yogaLevel: levels.yoga,
    userExcludedIds: excludedYoga,
    limit: picks.warmup,
  });
  if (warmupRows.length > 0) {
    const perItem = phaseMin.warmup / warmupRows.length;
    phases.push({
      phase: 'warmup',
      items: warmupRows.map((r) => yogaItem(r, perItem, levels.yoga)),
    });
  }

  // main (strength, compound)
  const mainRows = await pickStrengthCompound({
    strengthLevel: levels.strength,
    userExcludedIds: excludedStrength,
    limit: picks.main,
  });
  if (mainRows.length === 0) {
    throw new Error(
      `No eligible compound strength for full_body, level=${levels.strength}, after exclusions`
    );
  }
  phases.push({
    phase: 'main',
    items: mainRows.map((r) => strengthItem(r, levels.strength)),
  });

  // cooldown (yoga, compound + cooldown styles, dedup warmup)
  const warmupIds = warmupRows.map((r) => r.id);
  const cooldownRows = await pickYogaCompound({
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

  // bookend_close. T4 W1(a): same invariant as bookend_open.
  const closeTech = await pickBookend({
    role: 'bookend_close',
    focusSlug: focus.slug,
    breathworkLevel: levels.breathwork,
    userExcludedIds: excludedBreathwork,
  });
  if (!closeTech) {
    console.error(
      `[suggestionEngine] empty bookend_close pool for focus=${focus.slug}, level=${levels.breathwork}`
    );
    throw new Error(
      `No eligible bookend_close for focus=${focus.slug}, level=${levels.breathwork} — ` +
      `user exclusions left this pool empty`
    );
  }
  phases.push({
    phase: 'bookend_close',
    items: [bookendItem(closeTech, phaseMin.bookend_close, levels.breathwork)],
  });

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

async function generateStrengthOnlyFullBody({ userId, focus, levels, timeBudget }) {
  const limit = STRENGTH_TAB_PICKS[timeBudget];
  const excludedStrength = await loadExclusions(userId, 'strength');

  const rows = await pickStrengthCompound({
    strengthLevel: levels.strength,
    userExcludedIds: excludedStrength,
    limit,
  });
  if (rows.length === 0) {
    throw new Error(
      `No eligible compound strength for full_body, level=${levels.strength}, after exclusions`
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

async function generateYogaOnlyMobility({ userId, focus, levels, timeBudget }) {
  const picks = YOGA_TAB_PICKS[timeBudget];
  const excludedYoga = await loadExclusions(userId, 'yoga');

  // T2's yoga-tab phase-time split: 15/70/15 % of budget per phase.
  const warmupMin   = Math.max(1, Math.round(timeBudget * 0.15));
  const mainMin     = Math.max(1, Math.round(timeBudget * 0.70));
  const cooldownMin = Math.max(1, timeBudget - warmupMin - mainMin);

  const phases = [];

  const warmupRows = await pickYogaByStyles({
    yogaLevel: levels.yoga,
    userExcludedIds: excludedYoga,
    limit: picks.warmup,
    practiceStyles: WARMUP_PRACTICE_STYLES,
  });
  if (warmupRows.length > 0) {
    phases.push({
      phase: 'warmup',
      items: warmupRows.map((r) => yogaItem(r, warmupMin / warmupRows.length, levels.yoga)),
    });
  }

  // Main: per amendment, mobility yoga-tab main is style-driven (no muscle filter).
  // De-dup with warmup is NOT enforced (T2 convention: cooldown excludes warmup,
  // main can repeat warmup poses for tiny pools).
  const warmupIds = warmupRows.map((r) => r.id);
  const mainRows = await pickYogaByStyles({
    yogaLevel: levels.yoga,
    userExcludedIds: excludedYoga,
    limit: picks.main,
    practiceStyles: MOBILITY_MAIN_STYLES,
  });
  if (mainRows.length === 0) {
    throw new Error(
      `No eligible mobility yoga main for level=${levels.yoga}, after exclusions`
    );
  }
  phases.push({
    phase: 'main',
    items: mainRows.map((r) => yogaItem(r, mainMin / mainRows.length, levels.yoga)),
  });

  const mainIds = mainRows.map((r) => r.id);
  const cooldownRows = await pickYogaByStyles({
    yogaLevel: levels.yoga,
    userExcludedIds: excludedYoga,
    sessionExcludedIds: [...warmupIds, ...mainIds],
    limit: picks.cooldown,
    practiceStyles: COOLDOWN_PRACTICE_STYLES,
  });
  if (cooldownRows.length > 0) {
    phases.push({
      phase: 'cooldown',
      items: cooldownRows.map((r) => yogaItem(r, cooldownMin / cooldownRows.length, levels.yoga)),
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

async function generateYogaOnlyFullBody({ userId, focus, levels, timeBudget }) {
  const picks = YOGA_TAB_PICKS[timeBudget];
  const excludedYoga = await loadExclusions(userId, 'yoga');

  const warmupMin   = Math.max(1, Math.round(timeBudget * 0.15));
  const mainMin     = Math.max(1, Math.round(timeBudget * 0.70));
  const cooldownMin = Math.max(1, timeBudget - warmupMin - mainMin);

  const phases = [];

  // Warmup: compound + warmup styles (asymmetric vs home full_body — see spec
  // §Full Body home/yoga-tab asymmetry table; preserved per Decision #5).
  const warmupRows = await pickYogaCompound({
    yogaLevel: levels.yoga,
    userExcludedIds: excludedYoga,
    limit: picks.warmup,
    practiceStyles: WARMUP_PRACTICE_STYLES,
  });
  if (warmupRows.length > 0) {
    phases.push({
      phase: 'warmup',
      items: warmupRows.map((r) => yogaItem(r, warmupMin / warmupRows.length, levels.yoga)),
    });
  }

  // Main: compound only.
  const mainRows = await pickYogaCompound({
    yogaLevel: levels.yoga,
    userExcludedIds: excludedYoga,
    limit: picks.main,
  });
  if (mainRows.length === 0) {
    throw new Error(
      `No eligible compound yoga for full_body main, level=${levels.yoga}, after exclusions`
    );
  }
  phases.push({
    phase: 'main',
    items: mainRows.map((r) => yogaItem(r, mainMin / mainRows.length, levels.yoga)),
  });

  // Cooldown: compound + cooldown styles, dedup warmup (T2 convention).
  const warmupIds = warmupRows.map((r) => r.id);
  const cooldownRows = await pickYogaCompound({
    yogaLevel: levels.yoga,
    userExcludedIds: excludedYoga,
    sessionExcludedIds: warmupIds,
    limit: picks.cooldown,
    practiceStyles: COOLDOWN_PRACTICE_STYLES,
  });
  if (cooldownRows.length > 0) {
    phases.push({
      phase: 'cooldown',
      items: cooldownRows.map((r) => yogaItem(r, cooldownMin / cooldownRows.length, levels.yoga)),
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
// Three-phase shape per spec §State Focus (T3.5 names: centering / practice / reflection):
//   centering   — one breathwork technique from the curated `settle_eligible_for` pool.
//                 (Internal helper still named pickSettleTechnique — DB column also keeps
//                 its name. Rename is engine-output-only per spec §Phase-Name Mapping.)
//   practice    — one breathwork technique from focus_content_compatibility (role='main',
//                 standalone_compatible=true, level-appropriate). Pre-filtered by bracket
//                 overlap (numbered brackets) or non-NULL max (endless). Pre-filter
//                 guarantees a fit, so no retry loop / fallback needed.
//   reflection  — silent observed-breathing timer. No technique row (content_id = null).
//
// Duration semantics: centering and reflection minutes come from BRACKET_TABLE per
// bracket. Practice is clamped to the picked technique's [<level>_duration_min,
// <level>_duration_max] for numbered brackets (target = window_max - centering -
// reflection). Endless = picked technique's <level>_duration_max, no clamp.
//
// Settle pool is independent of focus_content_compatibility — driven entirely by
// `breathwork_techniques.settle_eligible_for` from S12-T1.

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

// Practice-window helper for a numbered bracket: subtract centering+reflection
// from each end, floor at 1 (durations are positive integers).
function practiceWindowForBracket(cfg) {
  return {
    min: Math.max(1, cfg.window_min - cfg.centering - cfg.reflection),
    max: cfg.window_max - cfg.centering - cfg.reflection,
  };
}

// Range overlap on closed intervals [a_min, a_max] vs [b_min, b_max].
function rangesOverlap(aMin, aMax, bMin, bMax) {
  return Math.max(aMin, bMin) <= Math.min(aMax, bMax);
}

// Does this technique row's <level>_duration_* range fit the bracket?
// For endless: fits if <level>_duration_max IS NOT NULL.
// For numbered: both columns non-NULL AND overlap with practice window.
function techniqueFitsBracket(row, level, cfg) {
  const { min, max } = durationsForLevel(row, level);
  if (cfg.is_endless) return max != null;
  if (min == null || max == null) return false;
  const pw = practiceWindowForBracket(cfg);
  return rangesOverlap(min, max, pw.min, pw.max);
}

async function generateStateFocus({ userId, focus, bracket }) {
  const cfg = BRACKET_TABLE[bracket];
  if (!cfg) {
    // Unreachable — generateSession validates bracket before dispatch.
    throw new Error(`Unknown bracket: ${bracket}`);
  }

  // Independent reads — parallelize per T2 convention (generateCrossPillar).
  const [levels, excludedBreathwork] = await Promise.all([
    resolveLevels(userId),
    loadExclusions(userId, 'breathwork'),
  ]);
  const breathworkLevel = levels.breathwork;

  // 1. CENTERING — pickSettleTechnique unchanged from T3.
  const centeringRow = await pickSettleTechnique({
    focusSlug: focus.slug,
    breathworkLevel,
    userExcludedIds: excludedBreathwork,
  });
  if (!centeringRow) {
    throw new Error(
      `No eligible centering technique for focus=${focus.slug}; check seed integrity`
    );
  }
  const centeringItem = {
    content_type: 'breathwork',
    content_id: centeringRow.id,
    name: centeringRow.name,
    duration_minutes: cfg.centering,
    sets: null,
    reps: null,
    tier_badge: tierBadge(centeringRow.difficulty, breathworkLevel),
  };

  // 2. PRACTICE — pre-filter mainPool by bracket fit, then uniformly pick.
  //    Pre-filter eliminates the T3 retry loop and fallback. If filtered pool
  //    is empty, the caller violated the contract: getAvailableDurations would
  //    have flagged this bracket as locked_by_level or empty.
  const mainPool = await loadStateMainPool({
    focusSlug: focus.slug,
    breathworkLevel,
    userExcludedIds: excludedBreathwork,
  });
  const eligible = mainPool.filter((r) => techniqueFitsBracket(r, breathworkLevel, cfg));
  if (eligible.length === 0) {
    throw new Error(
      `engine called with bracket '${bracket}' that getAvailableDurations would mark ` +
      `locked_by_level or empty for focus=${focus.slug}, level=${breathworkLevel} — ` +
      `caller must pre-check via getAvailableDurations`
    );
  }
  const practiceRow = eligible[Math.floor(Math.random() * eligible.length)];

  let practiceMinutes;
  if (cfg.is_endless) {
    practiceMinutes = durationsForLevel(practiceRow, breathworkLevel).max;
  } else {
    const target = cfg.window_max - cfg.centering - cfg.reflection;
    const { min, max } = durationsForLevel(practiceRow, breathworkLevel);
    practiceMinutes = Math.min(max, Math.max(min, target));
  }

  const practiceItem = {
    content_type: 'breathwork',
    content_id: practiceRow.id,
    name: practiceRow.name,
    duration_minutes: practiceMinutes,
    sets: null,
    reps: null,
    tier_badge: tierBadge(practiceRow.difficulty, breathworkLevel),
  };

  // 3. REFLECTION — silent timer, no technique.
  const reflectionItem = {
    content_type: 'breathwork',
    content_id: null,
    name: 'Silent observation',
    duration_minutes: cfg.reflection,
    sets: null,
    reps: null,
    tier_badge: null,
  };

  const phases = [
    { phase: 'centering',  items: [centeringItem] },
    { phase: 'practice',   items: [practiceItem] },
    { phase: 'reflection', items: [reflectionItem] },
  ];

  return {
    session_shape: 'state_focus',
    phases,
    warnings: [],
    metadata: {
      estimated_total_min: cfg.centering + practiceMinutes + cfg.reflection,
      bracket,
      is_endless: cfg.is_endless,
      user_levels: levels,
    },
  };
}

/**
 * Returns bracket availability for a (focus, level) pair (T3.5 spec §getAvailableDurations).
 * Single DB query (full main-eligible pool for the focus across all levels), JS bucketing.
 *
 * @param {string} focusSlug
 * @param {string} breathworkLevel - 'beginner' | 'intermediate' | 'advanced'
 * @param {number|null} [userId=null] - if provided, the user's `user_excluded_exercises` rows
 *   for content_type='breathwork' are filtered out of the pool BEFORE bucketing. This keeps
 *   the helper's `available` answer consistent with what `generateStateFocus` will actually
 *   serve to that user. Pass null (or omit) for the user-agnostic contract — useful for
 *   admin tooling, content-coverage reports, and the smoke test's matrix-truth pass.
 * @returns {Promise<{focus_slug, breathwork_level, brackets: Array<{id, state, sample_count, unlocks_at?}>}>}
 */
export async function getAvailableDurations(focusSlug, breathworkLevel, userId = null) {
  if (typeof focusSlug !== 'string' || focusSlug.length === 0) {
    throw new TypeError('focusSlug must be a non-empty string');
  }
  if (!VALID_LEVELS.has(breathworkLevel)) {
    throw new TypeError(
      `breathworkLevel must be one of ${[...VALID_LEVELS].join(', ')}; got ${breathworkLevel}`
    );
  }
  if (userId != null && (!Number.isInteger(userId) || userId <= 0)) {
    throw new TypeError(`userId must be a positive integer or null; got ${userId}`);
  }

  // Per-user breathwork exclusions (empty array when userId is null — SQL ANY
  // with empty array matches nothing, so the pool is unfiltered).
  const userExcludedIds = userId != null
    ? await loadExclusions(userId, 'breathwork')
    : [];

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
        AND NOT (bt.id = ANY($2::int[]))`,
    [focusSlug, userExcludedIds]
  );

  const userRank = levelRankOf(breathworkLevel);
  const HIGHER_LEVELS = ['beginner', 'intermediate', 'advanced'].filter(
    (l) => LEVEL_RANK[l] > userRank
  );

  const brackets = Object.entries(BRACKET_TABLE).map(([id, cfg]) => {
    let availableCount = 0;
    let unlocksAt = null;

    for (const row of rows) {
      // Engine safety gate: skip technique whose difficulty exceeds user level.
      if (LEVEL_RANK[row.difficulty] > userRank) continue;

      if (techniqueFitsBracket(row, breathworkLevel, cfg)) {
        availableCount++;
        continue;
      }

      // Not fit at user's level. Walk higher levels — the same technique's
      // higher-level columns may fit.
      for (const tryLevel of HIGHER_LEVELS) {
        if (techniqueFitsBracket(row, tryLevel, cfg)) {
          if (!unlocksAt || LEVEL_RANK[tryLevel] < LEVEL_RANK[unlocksAt]) {
            unlocksAt = tryLevel;
          }
          break;
        }
      }
    }

    if (availableCount > 0) {
      return { id, state: 'available', sample_count: availableCount };
    }
    if (unlocksAt) {
      return { id, state: 'locked_by_level', sample_count: 0, unlocks_at: unlocksAt };
    }
    return { id, state: 'empty', sample_count: 0 };
  });

  return {
    focus_slug: focusSlug,
    breathwork_level: breathworkLevel,
    brackets,
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
 * @param {number} [input.time_budget_min]   - body focuses only; see VALID_BUDGETS_BY_ENTRY
 * @param {string} [input.bracket]           - state focuses only; one of '0-10','10-20','21-30','30-45','endless'
 * @returns {Promise<{session_shape, phases, warnings, metadata}>}
 */
export async function generateSession({ user_id, focus_slug, entry_point, time_budget_min, bracket }) {
  // Stage 1: identity validation — applies to all paths.
  if (!Number.isInteger(user_id) || user_id <= 0) {
    throw new TypeError(`user_id must be a positive integer; got ${user_id}`);
  }
  if (typeof focus_slug !== 'string' || focus_slug.length === 0) {
    throw new TypeError(`focus_slug must be a non-empty string`);
  }
  if (!VALID_ENTRY_POINTS.has(entry_point)) {
    throw new TypeError(`entry_point must be one of ${[...VALID_ENTRY_POINTS].join(', ')}; got ${entry_point}`);
  }

  // Stage 2: bracket value-check (independent of focus type — fail fast on garbage).
  if (bracket != null && !VALID_BRACKETS.has(bracket)) {
    throw new RangeError(`invalid bracket value: ${bracket}`);
  }

  const focus = await resolveFocus(focus_slug);

  // T4: mobility from strength_tab is locked out at dispatch (Sprint 13+ picker
  // UX hides this; engine asserts the contract as second line of defense).
  if (focus.slug === 'mobility' && entry_point === 'strength_tab') {
    throw new RangeError(
      'mobility is not available from strength_tab — use yoga_tab or home'
    );
  }

  // ── State-focus path (T3.5: bracket-driven) ───────────────────────────
  if (focus.focus_type === 'state') {
    // Body-only tabs hide state focuses in their pickers; defend anyway.
    if (BODY_ONLY_ENTRY_POINTS.has(entry_point)) {
      throw new RangeError(
        `state focus '${focus.slug}' is not valid from '${entry_point}'; ` +
        `state focuses are surfaced from 'home' and 'breathwork_tab' only`
      );
    }
    if (bracket == null) {
      throw new RangeError('state focus requires bracket parameter');
    }
    // time_budget_min is silently ignored for state focuses (per spec decision #3).
    return generateStateFocus({ userId: user_id, focus, bracket });
  }

  // ── Body-focus path (T2: time_budget_min-driven) ──────────────────────
  // Body focus from breathwork_tab is invalid — breathwork_tab is state-only.
  if (entry_point === 'breathwork_tab') {
    throw new RangeError(
      `body focus '${focus.slug}' is not valid from 'breathwork_tab'; ` +
      `breathwork_tab supports state focuses only`
    );
  }

  if (!Number.isInteger(time_budget_min) || time_budget_min <= 0) {
    throw new TypeError(
      `time_budget_min must be a positive integer for body focuses; got ${typeof time_budget_min} ${time_budget_min}`
    );
  }
  if (!VALID_BUDGETS_BY_ENTRY[entry_point].has(time_budget_min)) {
    throw new RangeError(
      `time_budget_min ${time_budget_min} not valid for entry_point '${entry_point}'; ` +
      `valid: ${[...VALID_BUDGETS_BY_ENTRY[entry_point]].join(', ')}`
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
