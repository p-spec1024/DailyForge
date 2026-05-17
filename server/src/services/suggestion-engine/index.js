// Suggestion engine — public API entry point.
//
// Spec: Trackers/S12-suggestion-engine-spec.md (v2 on `main`)
//       Trackers/S12-T3.5-state-focus-refactor-spec.md (refactor scope)
//       Trackers/S12-T3.5-AMENDMENT-1-appendix-a-correction.md (matrix truth)
//       Trackers/S12-T4-mobility-fullbody-special-cases-spec.md (T4 scope)
//       Trackers/S12-T4-AMENDMENT-1-practice-type-remap.md (T4 SQL truth)
//   - Body-focus recipes (home / strength_tab / yoga_tab) for the 10 keyworded
//     focuses — T2
//   - State-focus recipe with range-bracket picker — T3 → refactored in T3.5
//     (centering → practice → reflection; bracket-driven duration allocation;
//      getAvailableDurations helper for content-aware UX)
//   - mobility + full_body branches in body-focus recipes — T4
//     (mobility: yoga-dominant; full_body: compound predicate ARRAY_LENGTH>=3)
//
// Schema reality (verified by S12-T2 + S12-T4 pre-flights):
//   - exercises.target_muscles is TEXT (comma/semicolon/period-separated), NOT array.
//     Keyword path matches focus_muscle_keywords via case-insensitive substring (ILIKE).
//     Compound path uses ARRAY_LENGTH(STRING_TO_ARRAY(target_muscles, ','), 1) >= 3
//     via helpers.compoundFilter() (single source of truth for any future TEXT[] migration).
//   - exercises.practice_types is TEXT[] of yoga STYLE labels: hatha, vinyasa, yin,
//     restorative, sun_salutation. Movement-quality tokens ('mobility', 'flexibility')
//     do NOT exist in the data. Remapped per S12-T4-AMENDMENT-1 to live style tokens.
//   - Engine style sets (single source of truth for recipe queries) live in constants.js:
//       WARMUP_PRACTICE_STYLES   = vinyasa | sun_salutation | hatha (active prep)
//       MOBILITY_MAIN_STYLES     = hatha | yin | vinyasa             (broad mobility/flex; T4)
//       COOLDOWN_PRACTICE_STYLES = restorative | yin | hatha          (held/restorative)
//
// Public surface (preserved across S15-T4 extraction):
//   - generateSession({ user_id, focus_slug, entry_point, time_budget_min, bracket })
//   - getAvailableDurations(focusSlug, breathworkLevel, userId = null)
//   - checkRecencyOverlap(userId, currentFocusSlug)
//   - BRACKET_TABLE
//   - NotImplementedError
//
// S15-T4 (FS #160): extracted from server/src/services/suggestionEngine.js.
// S16-T2 will migrate RangeError throw sites to typed EngineContractError
// (defined as a shell in errors.js but not used yet).

import {
  VALID_ENTRY_POINTS,
  VALID_BRACKETS,
  VALID_BUDGETS_BY_ENTRY,
  BODY_ONLY_ENTRY_POINTS,
} from './constants.js';
import { resolveFocus, resolveLevels } from './helpers.js';
import { generateStateFocus } from './recipes/state-focus.js';
import { generateCrossPillar } from './recipes/cross-pillar.js';
import { generateStrengthOnly } from './recipes/strength-only.js';
import { generateYogaOnly } from './recipes/yoga-only.js';

// Re-exports — public API surface.
export { BRACKET_TABLE } from './constants.js';
export { NotImplementedError } from './errors.js';
export { checkRecencyOverlap } from './recency.js';
export { getAvailableDurations } from './recipes/available-durations.js';

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
