// S14-T6 / FS #198: substitution ladder.
//
// Ranks up to N alternatives for a strength exercise slot, returning a list
// the swap endpoint can surface. T6 UI consumes index 0 only (top-1 pick);
// the ranked list is exposed for a future picker UX ticket (Decision #7).
//
// Ranking signals (S14-T6-spec §6.7):
//   1. Recency penalty   — -10 if in user's last 3 sessions, -5 if last 7 days
//   2. Swap-count penalty — -2 per prior swap from this candidate, cap -10
//   3. Difficulty fit    — +5 if == user level, +2 if < user level, 0 if >
//   4. Muscle-overlap    — +3 if candidate.target_muscles ⊃ original.target_muscles
//   5. Random tiebreaker — uniform [0, 0.5) added per candidate
//
// Sibling to suggestionEngine.js — does not extend it. Sprint 15+ can fold
// this in if the architecture-extraction refactor (FS #160) lands.

import { pool } from '../db/pool.js';

const LEVEL_RANK = { beginner: 1, intermediate: 2, advanced: 3 };

const RECENCY_LAST_3      = -10;
const RECENCY_LAST_7_DAYS = -5;
const SWAP_PENALTY_PER    = -2;
const SWAP_PENALTY_CAP    = -10;
const DIFFICULTY_FIT_EQ   = 5;
const DIFFICULTY_FIT_LT   = 2;
const MUSCLE_OVERLAP      = 3;

/**
 * Returns up to `limit` alternatives ranked by composite score, descending.
 * Empty array if no candidates pass exclusion. Single-best path (the most
 * common case) returns a 1-element array — caller indexes 0.
 *
 * @param {Object} input
 * @param {number} input.userId
 * @param {number} input.originalExerciseId  - the slot's current default
 * @param {string} input.pillarLevel         - 'beginner' | 'intermediate' | 'advanced'
 * @param {number} [input.limit=5]
 * @returns {Promise<Array<{exercise_id:number, name:string, target_muscles:string|null, difficulty:string, rank_score:number}>>}
 */
export async function rankAlternatives({
  userId,
  originalExerciseId,
  pillarLevel,
  limit = 5,
}) {
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new TypeError(`userId must be a positive integer; got ${userId}`);
  }
  if (!Number.isInteger(originalExerciseId) || originalExerciseId <= 0) {
    throw new TypeError(`originalExerciseId must be a positive integer; got ${originalExerciseId}`);
  }
  if (typeof pillarLevel !== 'string' || !LEVEL_RANK[pillarLevel]) {
    throw new TypeError(`pillarLevel must be beginner/intermediate/advanced; got ${pillarLevel}`);
  }
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new TypeError(`limit must be a positive integer; got ${limit}`);
  }

  // 1. Candidate pool — slot_alternatives joined to exercises, minus the user's
  //    strength exclusions and the original itself.
  const candidatesResult = await pool.query(
    `SELECT e.id   AS exercise_id,
            e.name AS name,
            e.target_muscles,
            e.difficulty
       FROM slot_alternatives sa
       JOIN exercises e ON e.id = sa.alternative_exercise_id
      WHERE sa.exercise_id = $1
        AND e.id != $1
        AND e.id NOT IN (
              SELECT content_id
                FROM user_excluded_exercises
               WHERE user_id = $2
                 AND content_type = 'strength'
            )`,
    [originalExerciseId, userId]
  );
  const candidates = candidatesResult.rows;
  if (candidates.length === 0) return [];

  // 2. Original exercise's muscle set — for the strict-superset bonus.
  const originalResult = await pool.query(
    `SELECT target_muscles FROM exercises WHERE id = $1`,
    [originalExerciseId]
  );
  const originalMuscles = parseMuscleSet(originalResult.rows[0]?.target_muscles);

  // 3. Recency sets — last 3 completed sessions, then last-7-days exercise IDs.
  //    Two distinct buckets so the score ladder can prefer "last 7 days" over
  //    "last 3 sessions" without double-counting. ON-MISS in last-3 falls
  //    through to last-7-days check.
  const last3Result = await pool.query(
    `SELECT DISTINCT se.exercise_id
       FROM session_exercises se
       JOIN (
              SELECT id FROM sessions
               WHERE user_id = $1 AND completed = true
               ORDER BY date DESC, id DESC
               LIMIT 3
            ) recent3 ON recent3.id = se.session_id`,
    [userId]
  );
  const last3Set = new Set(last3Result.rows.map((r) => r.exercise_id));

  const last7Result = await pool.query(
    `SELECT DISTINCT se.exercise_id
       FROM session_exercises se
       JOIN sessions s ON s.id = se.session_id
      WHERE s.user_id = $1
        AND s.completed = true
        AND s.date >= CURRENT_DATE - INTERVAL '7 days'`,
    [userId]
  );
  const last7Set = new Set(last7Result.rows.map((r) => r.exercise_id));

  // 4. Swap-count per candidate, in one round trip.
  const candidateIds = candidates.map((c) => c.exercise_id);
  const swapResult = await pool.query(
    `SELECT exercise_id, swap_count
       FROM exercise_swap_counts
      WHERE user_id = $1
        AND exercise_id = ANY($2::int[])`,
    [userId, candidateIds]
  );
  const swapCounts = new Map(swapResult.rows.map((r) => [r.exercise_id, r.swap_count]));

  // 5. Score each candidate.
  const userRank = LEVEL_RANK[pillarLevel];
  const ranked = candidates.map((c) => {
    let score = 0;

    // Recency (mutually exclusive — last 3 sessions wins over last 7 days)
    if (last3Set.has(c.exercise_id)) {
      score += RECENCY_LAST_3;
    } else if (last7Set.has(c.exercise_id)) {
      score += RECENCY_LAST_7_DAYS;
    }

    // Swap-count penalty, capped
    const swapCount = swapCounts.get(c.exercise_id) ?? 0;
    score += Math.max(swapCount * SWAP_PENALTY_PER, SWAP_PENALTY_CAP);

    // Difficulty fit
    const candidateRank = LEVEL_RANK[c.difficulty] ?? 1;
    if (candidateRank === userRank) {
      score += DIFFICULTY_FIT_EQ;
    } else if (candidateRank < userRank) {
      score += DIFFICULTY_FIT_LT;
    }

    // Muscle overlap (strict superset)
    const candidateMuscles = parseMuscleSet(c.target_muscles);
    if (isStrictSuperset(candidateMuscles, originalMuscles)) {
      score += MUSCLE_OVERLAP;
    }

    // Random tiebreaker — keeps results from being identical call-to-call
    // when two candidates score equally on every deterministic signal.
    score += Math.random() * 0.5;

    return {
      exercise_id:    c.exercise_id,
      name:           c.name,
      target_muscles: c.target_muscles,
      difficulty:     c.difficulty,
      rank_score:     Math.round(score * 100) / 100,
    };
  });

  ranked.sort((a, b) => b.rank_score - a.rank_score);
  return ranked.slice(0, limit);
}

// target_muscles is stored TEXT (comma-separated). Yoga rows occasionally
// hold a JSON-ish list literal — handle both shapes defensively.
function parseMuscleSet(raw) {
  if (!raw) return new Set();
  if (Array.isArray(raw)) {
    return new Set(raw.map((m) => String(m).trim()).filter(Boolean));
  }
  const s = String(raw).trim();
  if (s.length === 0) return new Set();
  return new Set(
    s
      .replace(/^[\[\(]|[\]\)]$/g, '') // strip leading/trailing brackets
      .split(',')
      .map((m) => m.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean)
  );
}

// Strict superset: a ⊃ b (a contains all of b AND has at least one extra).
function isStrictSuperset(a, b) {
  if (b.size === 0) return false;
  if (a.size <= b.size) return false;
  for (const x of b) {
    if (!a.has(x)) return false;
  }
  return true;
}
