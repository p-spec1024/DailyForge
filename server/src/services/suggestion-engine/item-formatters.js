// Suggestion engine — item formatters.
//
// Pure functions that convert a DB row + level into the engine's output item
// shape. Used by every recipe.
//
//   bookendItem, strengthItem, yogaItem
//
// S15-T4 (FS #160): extracted from server/src/services/suggestionEngine.js.

import { SETS_BY_LEVEL, DEFAULT_REPS } from './constants.js';
import { clampInt, tierBadge, roundMin } from './helpers.js';

export function bookendItem(row, durationMin, breathworkLevel) {
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

export function strengthItem(row, strengthLevel) {
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

export function yogaItem(row, perItemMin, yogaLevel) {
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
