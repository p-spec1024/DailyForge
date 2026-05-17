// Suggestion engine — state-focus recipe (T3.5 bracket-driven).
//
// Three-phase shape (centering / practice / reflection), bracket-driven
// duration allocation. Driven entirely by BRACKET_TABLE config + the
// breathwork_techniques pool.
//
//   generateStateFocus
//   pickSettleTechnique (state-only picker)
//   loadStateMainPool   (state-only pool loader)
//
// Bracket helpers (durationsForLevel, fitMainCandidate, etc.) live in
// helpers.js because they're shared with available-durations.
//
// S15-T4 (FS #160): extracted from server/src/services/suggestionEngine.js.

import { pool } from '../../../db/pool.js';
import { BRACKET_TABLE } from '../constants.js';
import {
  levelRankOf,
  tierBadge,
  resolveLevels,
  loadExclusions,
  durationsForLevel,
  techniqueFitsBracket,
} from '../helpers.js';

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

export async function generateStateFocus({ userId, focus, bracket }) {
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
    warnings: [],  // T5: state focuses are excluded from recency check (spec line 443).
    metadata: {
      estimated_total_min: cfg.centering + practiceMinutes + cfg.reflection,
      bracket,
      is_endless: cfg.is_endless,
      user_levels: levels,
      focus_slug: focus.slug,
    },
  };
}
