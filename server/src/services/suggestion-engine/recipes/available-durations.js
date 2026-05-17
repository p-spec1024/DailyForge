// Suggestion engine — bracket-availability lookup (T3.5).
//
// Returns bracket availability for a (focus, level) pair. Single DB query,
// JS bucketing. Optional userId filters per-user breathwork exclusions out
// of the pool BEFORE bucketing — keeps the answer consistent with what
// generateStateFocus will actually serve to that user.
//
//   getAvailableDurations(focusSlug, breathworkLevel, userId = null)
//
// S15-T4 (FS #160): extracted from server/src/services/suggestionEngine.js.

import { pool } from '../../../db/pool.js';
import {
  LEVEL_RANK,
  VALID_LEVELS,
  BRACKET_TABLE,
} from '../constants.js';
import {
  levelRankOf,
  loadExclusions,
  techniqueFitsBracket,
} from '../helpers.js';

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
