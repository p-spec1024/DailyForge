/**
 * @file cross-pillar.js
 * Cross-pillar recipe — 5-phase orchestrator (bookend_open / warmup / main /
 * cooldown / bookend_close). Includes the standard keyworded path plus the
 * T4 mobility and full_body variants (delegated from the standard entry).
 *
 * @note File size (~400 LOC) intentionally over the 300-LOC guideline from
 *   S15-T4 AC #5. The three internal variants (standard / mobility / full-body)
 *   are cohesive: they share scaffolding (level/exclusion fetch, bookend pick,
 *   metadata shape), share helpers, and are tested as one surface. Splitting
 *   by variant introduces layout asymmetry (this recipe as a directory, others
 *   as files) and breaks domain cohesion for a line-count win.
 *   Tracked at FUTURE_SCOPE: revisit variant-split if growth exceeds ~500 LOC.
 *   Decided S15-T4, May 2026.
 *
 * S15-T4 (FS #160): extracted from server/src/services/suggestionEngine.js.
 */

import {
  WARMUP_PRACTICE_STYLES,
  COOLDOWN_PRACTICE_STYLES,
  CROSS_PILLAR_PHASE_MIN,
  CROSS_PILLAR_PICKS,
} from '../constants.js';
import {
  resolveYogaSourceStyle,
  computeEstimatedTotalMin,
  loadMuscleKeywords,
  loadExclusions,
} from '../helpers.js';
import {
  pickBookend,
  pickStrength,
  pickStrengthCompound,
  pickYoga,
  pickYogaByStyles,
  pickYogaCompound,
} from '../pickers.js';
import { bookendItem, strengthItem, yogaItem } from '../item-formatters.js';
import { checkRecencyOverlap } from '../recency.js';

export async function generateCrossPillar({ userId, focus, levels, timeBudget }) {
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

  // T5: recency overlap check (body focuses only).
  const warnings = [];
  const recencyWarning = await checkRecencyOverlap(userId, focus.slug);
  if (recencyWarning) warnings.push(recencyWarning);

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
    warnings,
    metadata: {
      estimated_total_min: computeEstimatedTotalMin(phases, 'cross_pillar', timeBudget),
      requested_budget_min: timeBudget,
      user_levels: levels,
      focus_slug: focus.slug,
      // S14-T6 Decision A: descriptive yoga character of this cross-pillar
      // session. Warmup/cooldown pools stay multi-style (preserves cooldown
      // semantics for non-beginners); `source` is used by client swap fallback.
      source: resolveYogaSourceStyle(levels.yoga),
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

  // T5: recency overlap check. mobility has no overlap edges (Appendix A —
  // mobility is one of the 4 focuses without focus_overlaps rows), so only
  // same-focus repeat fires (back-to-back mobility days).
  const warnings = [];
  const recencyWarning = await checkRecencyOverlap(userId, focus.slug);
  if (recencyWarning) warnings.push(recencyWarning);

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
  //
  // S14-T6 Decision A: filter mobility yoga main to the level-resolved style.
  // Replaces the broad MOBILITY_MAIN_STYLES pool — session commits to one style.
  const sourceStyle = resolveYogaSourceStyle(levels.yoga);
  const warmupIds = warmupRows.map((r) => r.id);
  const mainRows = await pickYogaByStyles({
    yogaLevel: levels.yoga,
    userExcludedIds: excludedYoga,
    sessionExcludedIds: warmupIds,
    limit: picks.main,
    practiceStyles: [sourceStyle],
  });
  if (mainRows.length === 0) {
    throw new Error(
      `No eligible mobility yoga main for level=${levels.yoga}, style=${sourceStyle}, after exclusions`
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
    warnings,
    metadata: {
      // Mobility-home has no strength items, so the strength-spec table doesn't
      // contribute. Pass 'cross_pillar' anyway — computeEstimatedTotalMin's
      // strength branch is skipped when no strength items are present.
      estimated_total_min: computeEstimatedTotalMin(phases, 'cross_pillar', timeBudget),
      requested_budget_min: timeBudget,
      user_levels: levels,
      focus_slug: focus.slug,
      source: sourceStyle,
    },
  };
}

async function generateCrossPillarFullBody({ userId, focus, levels, timeBudget }) {
  const phaseMin = CROSS_PILLAR_PHASE_MIN[timeBudget];
  const picks    = CROSS_PILLAR_PICKS[timeBudget];

  // T5: recency overlap check. full_body has no overlap edges, so only
  // same-focus repeat fires (back-to-back full_body days).
  const warnings = [];
  const recencyWarning = await checkRecencyOverlap(userId, focus.slug);
  if (recencyWarning) warnings.push(recencyWarning);

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
    warnings,
    metadata: {
      estimated_total_min: computeEstimatedTotalMin(phases, 'cross_pillar', timeBudget),
      requested_budget_min: timeBudget,
      user_levels: levels,
      focus_slug: focus.slug,
      // S14-T6 Decision A: descriptive yoga character of this cross-pillar
      // session. Warmup/cooldown pools stay multi-style (preserves cooldown
      // semantics for non-beginners); `source` is used by client swap fallback.
      source: resolveYogaSourceStyle(levels.yoga),
    },
  };
}
