// Suggestion engine — constants.
//
// All static tables and Sets used by the engine. Single source of truth for
// recipe queries, level ranks, valid-input sets, and bracket configuration.
// Exports BRACKET_TABLE publicly (consumed by routes/focus-areas.js + test harness).
//
// S15-T4 (FS #160): extracted from server/src/services/suggestionEngine.js.

export const LEVEL_RANK = { beginner: 1, intermediate: 2, advanced: 3 };
export const VALID_PILLARS = new Set(['strength', 'yoga', 'breathwork']);
export const VALID_LEVELS  = new Set(['beginner', 'intermediate', 'advanced']);

// Style-token sets used by recipe queries. Per S12-T4-AMENDMENT-1
// (`Trackers/S12-T4-AMENDMENT-1-practice-type-remap.md`), these are the canonical
// remap of the master spec's movement-quality intent (mobility / flexibility /
// restorative) onto the live style data. Retire when movement-quality tagging
// lands (Sprint 13+ tagging ticket — FUTURE_SCOPE entry post-Sprint-12).
export const WARMUP_PRACTICE_STYLES   = ['vinyasa', 'sun_salutation', 'hatha']; // active prep
export const MOBILITY_MAIN_STYLES     = ['hatha', 'yin', 'vinyasa'];            // broad mobility/flex; T4
export const COOLDOWN_PRACTICE_STYLES = ['restorative', 'yin', 'hatha'];        // held/restorative

// S14-T6 Decision A: level-driven yoga style picked up-front, used to filter
// the main-phase pool and emitted as `metadata.source` for the client's
// swap-style fallback chain (see S14-T6-AMENDMENT-1 §2). Warmup/cooldown
// pools are intentionally left multi-style — `metadata.source` describes the
// session's yoga character, not every phase's style verbatim.
export const YOGA_SOURCE_BY_LEVEL = {
  beginner:     'hatha',
  intermediate: 'vinyasa',
  advanced:     'vinyasa',
};

export const VALID_ENTRY_POINTS = new Set(['home', 'strength_tab', 'yoga_tab', 'breathwork_tab']);

// Spec §Time Budget — main-phase minutes and total beginner sets per
// (recipe, budget). The spec implies a different per-set rate at each
// budget (cross_pillar/30 = 2.0 min/set, cross_pillar/60 = 2.67), so the
// engine reads from this table rather than using one constant. Strength
// contribution to estimated_total_min = SPEC_MAIN_MIN × (actual sets / spec sets)
// — if the engine picks a degraded count of strength exercises, the metadata
// scales down honestly.
export const SPEC_MAIN_STRENGTH_MIN = {
  cross_pillar:         { 30: 18, 60: 40 },
  pillar_pure_strength: { 30: 30, 60: 60 },
};
export const SPEC_MAIN_STRENGTH_SETS = {
  cross_pillar:         { 30: 9,  60: 15 }, // 3 ex × 3 sets, 5 ex × 3 sets
  pillar_pure_strength: { 30: 15, 60: 24 }, // 5 × 3, 8 × 3
};
// Fallback when recipe/budget pair is outside the table (defensive — present
// callers always hit the table).
export const STRENGTH_MIN_PER_SET_FALLBACK = 2.0;

// Sets per strength item, by user's strength level.
export const SETS_BY_LEVEL = { beginner: 3, intermediate: 4, advanced: 4 };
export const DEFAULT_REPS  = 10;

// Cross-pillar phase minute budgets (spec §Time Budget).
export const CROSS_PILLAR_PHASE_MIN = {
  30: { bookend_open: 3, warmup: 3, main: 18, cooldown: 3, bookend_close: 3 },
  60: { bookend_open: 5, warmup: 5, main: 40, cooldown: 5, bookend_close: 5 },
};

// Cross-pillar pick counts per phase.
export const CROSS_PILLAR_PICKS = {
  30: { warmup: 1, main: 3, cooldown: 1 },
  60: { warmup: 2, main: 5, cooldown: 2 },
};

// Strength-tab pick counts.
export const STRENGTH_TAB_PICKS = { 30: 5, 60: 8 };

// Yoga-tab pick counts per phase.
export const YOGA_TAB_PICKS = {
  15: { warmup: 1, main: 3, cooldown: 1 },
  30: { warmup: 2, main: 5, cooldown: 2 },
  45: { warmup: 2, main: 8, cooldown: 3 },
  60: { warmup: 3, main: 10, cooldown: 4 },
};

// State-focus bracket table (T3.5 spec §The 5 Brackets). Replaces T3's fixed-
// budget table. Each bracket has fixed centering/reflection bookends and a
// practice window the engine clamps the picked technique into. Endless mode
// runs the technique at its natural max with 2-min bookends.
//
// Exported so test harnesses + downstream callers (T7 HTTP layer, Sprint 13
// picker UI) read from one source of truth — no local mirrors.
export const BRACKET_TABLE = {
  '0-10':    { window_min: 1,  window_max: 10, centering: 1, reflection: 1, is_endless: false },
  '10-20':   { window_min: 10, window_max: 20, centering: 2, reflection: 2, is_endless: false },
  '21-30':   { window_min: 21, window_max: 30, centering: 2, reflection: 2, is_endless: false },
  '30-45':   { window_min: 31, window_max: 45, centering: 3, reflection: 3, is_endless: false },
  'endless': { window_min: null, window_max: null, centering: 2, reflection: 2, is_endless: true },
};
export const VALID_BRACKETS = new Set(Object.keys(BRACKET_TABLE));

// Body-focus entry-point budget validation (T2). breathwork_tab only takes
// state focuses now (T3.5 — bracket replaces time_budget_min for state).
export const VALID_BUDGETS_BY_ENTRY = {
  home:         new Set([30, 60]),
  strength_tab: new Set([30, 60]),
  yoga_tab:     new Set([15, 30, 45, 60]),
};

// Tabs that only accept body focuses (state focuses are hidden from these pickers).
export const BODY_ONLY_ENTRY_POINTS = new Set(['strength_tab', 'yoga_tab']);
