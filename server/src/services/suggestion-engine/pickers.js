// Suggestion engine — generic content pickers.
//
// Pickers used across the body-focus recipes:
//   pickBookend, pickStrength, pickStrengthCompound,
//   pickYogaCompound, pickYogaByStyles, pickYoga
//
// State-focus-only pickers (pickSettleTechnique, loadStateMainPool) live in
// recipes/state-focus.js — they're not used by any other recipe.
//
// S15-T4 (FS #160): extracted from server/src/services/suggestionEngine.js.

import { pool } from '../../db/pool.js';
import { levelRankOf, compoundFilter } from './helpers.js';

// Bookend pick: one breathwork technique tied to the focus via fcc.
// userExcludedIds = user's hard exclusions (user_excluded_exercises rows).
export async function pickBookend({ role, focusSlug, breathworkLevel, userExcludedIds }) {
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
export async function pickStrength({ keywords, strengthLevel, userExcludedIds, sessionExcludedIds = [], limit }) {
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

// Strength-compound pick (T4). Used by full_body across home / strength_tab.
// No keyword filter — the compound predicate IS the muscle filter.
export async function pickStrengthCompound({ strengthLevel, userExcludedIds, sessionExcludedIds = [], limit }) {
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
export async function pickYogaCompound({
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
export async function pickYogaByStyles({
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
export async function pickYoga({
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
