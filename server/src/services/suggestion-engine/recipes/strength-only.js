// Suggestion engine — strength-only recipe (strength_tab entry point).
//
// Standard keyworded path + T4 full_body variant.
//   generateStrengthOnly, generateStrengthOnlyFullBody
//
// mobility from strength_tab is locked out at dispatch (EngineContractError
// code INVALID_FOCUS_ENTRY_COMBO); the keyworded path also asserts this
// defensively.
//
// S15-T4 (FS #160): extracted from server/src/services/suggestionEngine.js.

import { STRENGTH_TAB_PICKS } from '../constants.js';
import {
  computeEstimatedTotalMin,
  loadMuscleKeywords,
  loadExclusions,
} from '../helpers.js';
import { pickStrength, pickStrengthCompound } from '../pickers.js';
import { strengthItem } from '../item-formatters.js';
import { checkRecencyOverlap } from '../recency.js';
import { EngineContractError } from '../errors.js';

export async function generateStrengthOnly({ userId, focus, levels, timeBudget }) {
  if (![30, 60].includes(timeBudget)) {
    throw new EngineContractError({
      code: 'INVALID_TIME_BUDGET',
      message: 'invalid_time_budget',
      details: { given: timeBudget, entry_point: 'strength_tab', valid: [30, 60] },
    });
  }
  // T4 S3 defensive: dispatch already throws EngineContractError for mobility/
  // strength_tab, but mirror the throw here in case a future refactor reorders
  // dispatch — without this guard, mobility would fall through to the keyworded
  // path below and emit a misleading "No muscle keywords" error.
  if (focus.slug === 'mobility') {
    throw new EngineContractError({
      code: 'INVALID_FOCUS_ENTRY_COMBO',
      message: 'invalid_focus_entry_combo',
      details: {
        focus_slug: focus.slug,
        entry_point: 'strength_tab',
        reason: 'mobility_not_in_strength_tab',
      },
    });
  }
  // T4: full_body uses compound predicate.
  if (focus.slug === 'full_body') {
    return generateStrengthOnlyFullBody({ userId, focus, levels, timeBudget });
  }

  const limit = STRENGTH_TAB_PICKS[timeBudget];

  // T5: recency overlap check (body focuses only).
  const warnings = [];
  const recencyWarning = await checkRecencyOverlap(userId, focus.slug);
  if (recencyWarning) warnings.push(recencyWarning);

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
    warnings,
    metadata: {
      estimated_total_min: computeEstimatedTotalMin(phases, 'pillar_pure_strength', timeBudget),
      requested_budget_min: timeBudget,
      user_levels: levels,
      focus_slug: focus.slug,
    },
  };
}

async function generateStrengthOnlyFullBody({ userId, focus, levels, timeBudget }) {
  const limit = STRENGTH_TAB_PICKS[timeBudget];

  // T5: recency overlap check (body focus).
  const warnings = [];
  const recencyWarning = await checkRecencyOverlap(userId, focus.slug);
  if (recencyWarning) warnings.push(recencyWarning);

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
    warnings,
    metadata: {
      estimated_total_min: computeEstimatedTotalMin(phases, 'pillar_pure_strength', timeBudget),
      requested_budget_min: timeBudget,
      user_levels: levels,
      focus_slug: focus.slug,
    },
  };
}
