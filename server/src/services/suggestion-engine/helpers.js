// Suggestion engine — pure helpers + data loaders.
//
// Pure helpers:
//   levelRankOf, tierBadge, clampInt, roundMin, computeEstimatedTotalMin,
//   compoundFilter, resolveYogaSourceStyle,
//   durationsForLevel, fitMainCandidate, practiceWindowForBracket,
//   rangesOverlap, techniqueFitsBracket
//
// Data loaders (read-only DB queries):
//   resolveLevels, resolveFocus, loadMuscleKeywords, loadExclusions
//
// State-focus bracket helpers (durationsForLevel, techniqueFitsBracket etc.)
// live here rather than in recipes/state-focus.js because they're shared
// between generateStateFocus and getAvailableDurations.
//
// S15-T4 (FS #160): extracted from server/src/services/suggestionEngine.js.

import { pool } from '../../db/pool.js';
import {
  LEVEL_RANK,
  VALID_PILLARS,
  VALID_LEVELS,
  YOGA_SOURCE_BY_LEVEL,
  SPEC_MAIN_STRENGTH_MIN,
  SPEC_MAIN_STRENGTH_SETS,
  STRENGTH_MIN_PER_SET_FALLBACK,
} from './constants.js';

export function resolveYogaSourceStyle(yogaLevel) {
  return YOGA_SOURCE_BY_LEVEL[yogaLevel] ?? 'vinyasa';
}

// ── Helpers ──────────────────────────────────────────────────────────────

export function levelRankOf(level) {
  const r = LEVEL_RANK[level];
  if (!r) throw new Error(`Unknown level: ${level}`);
  return r;
}

export function tierBadge(itemDifficulty, userLevel) {
  // Suggestion path filters out items above user level, so itemDifficulty is
  // always <= userLevel here. Returns 'foundational' if strictly below, else null.
  return levelRankOf(itemDifficulty) < levelRankOf(userLevel) ? 'foundational' : null;
}

export function clampInt(value, min, max) {
  if (min != null && value < min) return min;
  if (max != null && value > max) return max;
  return value;
}

export function roundMin(x) {
  return Math.max(1, Math.round(x));
}

export function computeEstimatedTotalMin(phases, recipe, budget) {
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

// Compound-detection SQL fragment (T4). Single source of truth for the
// "exercise hits 3+ muscle groups" predicate. Wraps the text-vs-array storage
// detail of exercises.target_muscles — if a future migration moves it to
// TEXT[], only this helper changes. Returns a literal SQL fragment (no params).
export function compoundFilter() {
  return "ARRAY_LENGTH(STRING_TO_ARRAY(target_muscles, ','), 1) >= 3";
}

// ── Data loaders ─────────────────────────────────────────────────────────

export async function resolveLevels(userId) {
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

export async function resolveFocus(focusSlug) {
  const { rows } = await pool.query(
    `SELECT id, slug, focus_type FROM focus_areas WHERE slug = $1 AND is_active = true`,
    [focusSlug]
  );
  if (rows.length === 0) {
    throw new Error(`Unknown or inactive focus_slug: ${focusSlug}`);
  }
  return rows[0];
}

export async function loadMuscleKeywords(focusId) {
  const { rows } = await pool.query(
    `SELECT keyword FROM focus_muscle_keywords WHERE focus_id = $1`,
    [focusId]
  );
  return rows.map((r) => r.keyword);
}

export async function loadExclusions(userId, contentType) {
  const { rows } = await pool.query(
    `SELECT content_id FROM user_excluded_exercises
     WHERE user_id = $1 AND content_type = $2`,
    [userId, contentType]
  );
  return rows.map((r) => r.content_id);
}

// ── State-focus bracket helpers ──────────────────────────────────────────
// Shared between generateStateFocus (recipes/state-focus.js) and
// getAvailableDurations (recipes/available-durations.js).

export function durationsForLevel(row, level) {
  return {
    min: row[`${level}_duration_min`],
    max: row[`${level}_duration_max`],
  };
}

export function fitMainCandidate(row, level, mainTarget) {
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
export function practiceWindowForBracket(cfg) {
  return {
    min: Math.max(1, cfg.window_min - cfg.centering - cfg.reflection),
    max: cfg.window_max - cfg.centering - cfg.reflection,
  };
}

// Range overlap on closed intervals [a_min, a_max] vs [b_min, b_max].
export function rangesOverlap(aMin, aMax, bMin, bMax) {
  return Math.max(aMin, bMin) <= Math.min(aMax, bMax);
}

// Does this technique row's <level>_duration_* range fit the bracket?
// For endless: fits if <level>_duration_max IS NOT NULL.
// For numbered: both columns non-NULL AND overlap with practice window.
export function techniqueFitsBracket(row, level, cfg) {
  const { min, max } = durationsForLevel(row, level);
  if (cfg.is_endless) return max != null;
  if (min == null || max == null) return false;
  const pw = practiceWindowForBracket(cfg);
  return rangesOverlap(min, max, pw.min, pw.max);
}
