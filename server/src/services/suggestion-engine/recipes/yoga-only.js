/**
 * @file yoga-only.js
 * Yoga-only recipe — 3-phase shape (warmup / main / cooldown) for yoga_tab
 * entry point. Includes the standard keyworded path plus the T4 mobility and
 * full_body variants.
 *
 * @note File size (~320 LOC) intentionally over the 300-LOC guideline from
 *   S15-T4 AC #5. Same cohesion argument as cross-pillar.js: standard /
 *   mobility / full-body variants share scaffolding, helpers, and tests.
 *   Splitting by variant introduces layout asymmetry and breaks domain
 *   cohesion for a line-count win.
 *   Tracked at FUTURE_SCOPE: revisit variant-split if growth exceeds ~500 LOC.
 *   Decided S15-T4, May 2026.
 *
 * S15-T4 (FS #160): extracted from server/src/services/suggestionEngine.js.
 */

import {
  WARMUP_PRACTICE_STYLES,
  COOLDOWN_PRACTICE_STYLES,
  YOGA_TAB_PICKS,
} from '../constants.js';
import {
  resolveYogaSourceStyle,
  computeEstimatedTotalMin,
  loadMuscleKeywords,
  loadExclusions,
} from '../helpers.js';
import {
  pickYoga,
  pickYogaByStyles,
  pickYogaCompound,
} from '../pickers.js';
import { yogaItem } from '../item-formatters.js';
import { checkRecencyOverlap } from '../recency.js';
import { EngineContractError } from '../errors.js';

export async function generateYogaOnly({ userId, focus, levels, timeBudget }) {
  if (![15, 30, 45, 60].includes(timeBudget)) {
    throw new EngineContractError({
      code: 'INVALID_TIME_BUDGET',
      message: 'invalid_time_budget',
      details: { given: timeBudget, entry_point: 'yoga_tab', valid: [15, 30, 45, 60] },
    });
  }
  // T4 special-case branches.
  if (focus.slug === 'mobility') {
    return generateYogaOnlyMobility({ userId, focus, levels, timeBudget });
  }
  if (focus.slug === 'full_body') {
    return generateYogaOnlyFullBody({ userId, focus, levels, timeBudget });
  }

  const picks = YOGA_TAB_PICKS[timeBudget];

  // T5: recency overlap check (body focuses only).
  const warnings = [];
  const recencyWarning = await checkRecencyOverlap(userId, focus.slug);
  if (recencyWarning) warnings.push(recencyWarning);

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
  // main is unfiltered for dedup purposes). Matters for tiny pools (e.g. biceps yoga
  // has 1 candidate at beginner level — without this, main would always be empty
  // after a warmup pick).
  //
  // S14-T6 Decision A: filter main to the level-resolved yoga source style so the
  // session commits to a single coherent yoga character. Source emitted in metadata.
  const sourceStyle = resolveYogaSourceStyle(levels.yoga);
  const warmupIds = warmupRows.map((r) => r.id);
  const mainRows = await pickYoga({
    keywords,
    yogaLevel: levels.yoga,
    userExcludedIds: excludedYoga,
    limit: picks.main,
    practiceStyles: [sourceStyle],
  });
  if (mainRows.length === 0) {
    throw new Error(
      `No eligible yoga exercises for focus=${focus.slug}, level=${levels.yoga}, ` +
      `style=${sourceStyle}, after exclusions`
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
    warnings,
    metadata: {
      estimated_total_min: computeEstimatedTotalMin(phases, 'pillar_pure_yoga', timeBudget),
      requested_budget_min: timeBudget,
      user_levels: levels,
      focus_slug: focus.slug,
      source: sourceStyle,
    },
  };
}

async function generateYogaOnlyMobility({ userId, focus, levels, timeBudget }) {
  const picks = YOGA_TAB_PICKS[timeBudget];

  // T5: recency overlap check. mobility has no overlap edges; only same-focus
  // repeat fires.
  const warnings = [];
  const recencyWarning = await checkRecencyOverlap(userId, focus.slug);
  if (recencyWarning) warnings.push(recencyWarning);

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
  //
  // S14-T6 Decision A: narrow from MOBILITY_MAIN_STYLES to the single level-
  // resolved style — session commits to one yoga character end-to-end.
  const sourceStyle = resolveYogaSourceStyle(levels.yoga);
  const warmupIds = warmupRows.map((r) => r.id);
  const mainRows = await pickYogaByStyles({
    yogaLevel: levels.yoga,
    userExcludedIds: excludedYoga,
    limit: picks.main,
    practiceStyles: [sourceStyle],
  });
  if (mainRows.length === 0) {
    throw new Error(
      `No eligible mobility yoga main for level=${levels.yoga}, style=${sourceStyle}, after exclusions`
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
    warnings,
    metadata: {
      estimated_total_min: computeEstimatedTotalMin(phases, 'pillar_pure_yoga', timeBudget),
      requested_budget_min: timeBudget,
      user_levels: levels,
      focus_slug: focus.slug,
      source: sourceStyle,
    },
  };
}

async function generateYogaOnlyFullBody({ userId, focus, levels, timeBudget }) {
  const picks = YOGA_TAB_PICKS[timeBudget];

  // T5: recency overlap check (body focus). full_body has no overlap edges.
  const warnings = [];
  const recencyWarning = await checkRecencyOverlap(userId, focus.slug);
  if (recencyWarning) warnings.push(recencyWarning);

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
  //
  // S14-T6 Decision A: add level-resolved style filter on top of the compound
  // predicate. Session commits to one yoga character. If the compound∩style
  // pool is empty (e.g. beginner + hatha with thin compound coverage), the
  // pre-existing pool-empty throw triggers naturally — caller must seed more
  // compound rows in that style.
  const sourceStyle = resolveYogaSourceStyle(levels.yoga);
  const mainRows = await pickYogaCompound({
    yogaLevel: levels.yoga,
    userExcludedIds: excludedYoga,
    limit: picks.main,
    practiceStyles: [sourceStyle],
  });
  if (mainRows.length === 0) {
    throw new Error(
      `No eligible compound yoga for full_body main, level=${levels.yoga}, style=${sourceStyle}, after exclusions`
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
    warnings,
    metadata: {
      estimated_total_min: computeEstimatedTotalMin(phases, 'pillar_pure_yoga', timeBudget),
      requested_budget_min: timeBudget,
      user_levels: levels,
      focus_slug: focus.slug,
      source: sourceStyle,
    },
  };
}
