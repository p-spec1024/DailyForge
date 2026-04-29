# S12 — Suggestion Engine Spec (Personalization Algorithm)

**Author:** Claude.ai (PM/Architect)
**Date:** Apr 28, 2026
**Version:** v2
**Status:** LOCKED. Drives the Sprint 12 ticket breakdown.
**Depends on:** S11-T1 / T1.5 / T2 / T3 / T4 (Sprint 11 data layer shipped)
**Blocks:** Sprint 13 (home page UI), Sprint 14 (session composer), Sprint 15 (onboarding)
**Related FUTURE_SCOPE:** #119 (adaptive personalization), #124 (suggestion engine — this), #43 (time-of-day breathwork filtering — falls out for free), #118 (custom builders — superseded by #126), #131 (quick tools), #132 (reactive moment surface)

**Version history:** v1 (Apr 28, 2026 morning) → v2 (Apr 28, 2026 evening). v1 lived in git history; v2 supersedes it. The v2 changes are concentrated in state-focus handling: range-bracket picker replaces fixed-budget picker; new `getAvailableDurations` contract; phase names changed to user-facing terms (`centering` / `practice` / `reflection`); open-ended mode added. Body-focus paths, schema, recency, swap-counter, mobility, and full_body are unchanged from v1.

---

## Purpose

Given a user's chosen focus + entry point + (where applicable) time budget or duration range, return an ordered, level-appropriate, history-aware session structure the player can execute.

The engine is a **rule-based composer with uniform random sampling**. It is deterministic where it should be (level filtering, role assignment, structural shape) and stochastic where variety helps (which exercises within an eligible pool). It accepts v1 imprecisions (no primary/secondary muscle hierarchy yet, no quality-ranked sampling within pools) in exchange for shipping the simplest thing that works. Both imprecisions resolve together once Sprint 13 ships muscle hierarchy and the engine gains a real, accuracy-grounded weight formula.

This spec covers:
- Algorithm shape and recipe per entry point
- State-focus picker model (range brackets + endless mode)
- `getAvailableDurations` contract for the picker
- Sampling formula
- History-aware logic (recency warnings, swap-prefs, earned exclusion)
- Time-budget mechanics for body focuses
- Tier-aware caution / foundational badges
- Mobility / Full Body special cases
- Acceptance criteria + assertion queries
- Sprint 12 ticket breakdown

---

## Decisions locked

Combined table — v1 decisions (1–16) plus v2 additions (17–23 from the Apr 28 evening session that converted state focuses to range-bracket model).

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| 1 | Algorithm shape | Rule-based composer with uniform random sampling within the eligible pool | Smallest thing that works. Auditable. Quality-ranked weighting deferred to Sprint 14+ (after Sprint 13 ships muscle hierarchy). |
| 2 | Variety vs. consistency | Random sampling per generation, with explicit user overrides ("Repeat Last", "Save Session") | Sessions feel alive without being chaotic. Power users get consistency on demand. |
| 3 | History as input (v1) | Two paths only: recency warnings (calendar-day muscle overlap), and swap-counter exclusion. No periodization, no fatigue modeling, no anti-recency exercise filtering. | Each history-rule is a rule we have to debug. Ship deterministic-with-warnings, instrument, layer history when evidence demands it. |
| 4 | Body-focus session shape | Entry-point-determined. Home = cross-pillar (5-phase shaped). Pillar tab = pillar-pure. | Entry point IS the modality choice. No "set a mode" UI needed. |
| 5 | State-focus session shape | Phase-based: Centering → Practice → Reflection. 3 phases. Centering technique picked from a small curated pool per state focus (Diaphragmatic always eligible + 1 tonally-matched alternative). | Borrowed from yoga's arrival/practice/savasana shape. More phases re-create the 5-phase shape we don't want. Curated centering pool gives variety + recognizability without authoring risk. |
| 6 | Mobility / Full Body | Service-layer special cases per S11-T3 spec. `mobility` derives from `practice_type IN ('flexibility', 'mobility')`; `full_body` derives from compound-detection (≥3 muscle groups). | Already locked in S11-T3 v1; this spec confirms and operationalizes. |
| 7 | `weight` column | Stays NULL. Engine uses uniform random sampling. Real weighted scoring lands in Sprint 14+ after primary/secondary/tertiary muscle hierarchy ships. | The query-time formula proposed earlier in planning didn't actually fix accuracy — biasing toward compounds makes the bench-press-on-triceps-day bug *worse*. Honest move: ship uniform sampling, fix accuracy properly with hierarchy-grounded weighting. |
| 8 | Primary/secondary muscle hierarchy | Sprint 13 ticket. v1 engine accepts the imprecision. | Pre-launch app, 3 users, no evidence the imprecision matters yet. Hand-tagging 736 exercises is a real cost. |
| 9 | Swap-counter exclusion threshold | 3 swaps away from an exercise → soft prompt | "Earned" exclusion. One bad day shouldn't get an exercise blocklisted. |
| 10 | Recency warning window | Last session of focus within the past 1 calendar day | Matches how users think about training ("trained biceps yesterday"); avoids 48-hour clock arithmetic edge cases. |
| 11 | Tier-aware badges (suggestions vs. composer) | Suggestions: hard-filter by level. Composer: show all, badge by relative tier. | Suggestions protect; composer educates. |
| 12 | Time picker policy | Body focuses use fixed-minute budgets; state focuses use range brackets. See §Time Budget. | Body content (yoga poses, strength sets) bends naturally; breath techniques have rigid physiological minimums and maximums. One picker policy per content shape. |
| 13 | Save Session implementation | Reuse existing `user_routines` table + routines API | Already shipped. Save = "save as routine" wired through the suggestion-session UI. Zero new server work. |
| 14 | Repeat Last implementation | New endpoint `GET /api/sessions/last?focus=<slug>` | Small. Returns the most recent completed session matching the focus, formatted as a session structure the player can replay. |
| 15 | Hard exclusion storage | New `user_excluded_exercises` table | Triggered only after the 3rd swap. Settings UI to manage exclusion list deferred to v2. |
| 16 | Sex column for strength thresholds | Already a S11-T4 followup (FUTURE_SCOPE #136) | Engine reads `user_pillar_levels.level` directly; T4 will populate sex-aware thresholds when `users.sex` lands. Engine doesn't need to care. |
| 17 | State-focus picker model | Range brackets, not fixed values | Apps that compose multi-technique sessions cannot honestly promise a single duration value. Brackets ("11–20 min") let the engine pick honestly within the range. |
| 18 | Bracket grid | `0–10` / `10–20` / `21–30` / `30–45` (4 brackets) plus `Endless` | Covers all current state-focus content. No 45–60 bracket — only Buteyko/Tummo/Holotropic/Rebirthing reach that range, and none map to state focuses (intentionally, per S11-T2 safety tagging). Add a bracket only when content fills it. |
| 19 | Asymmetric picker resolution | All 5 options always shown, with state per (focus, level). Active options tappable, inactive options grayed with reason (`locked_by_level` vs `empty`). | Hiding options reads as "this app is small." Showing-and-graying reads as "more is here as you grow / coming soon." Communicates progress and roadmap simultaneously. |
| 20 | Open-ended ("endless") option | 5th option alongside the 4 brackets, label: **"Until I'm done"**. Engine returns same 3-phase shape with `practice.duration_minutes: null` and `practice.mode: 'open_ended'`. User taps to end practice; reflection phase triggers on tap, not timer. | Calm and several other apps offer this; users want it for meditation-style use. Treating it as a 5th option (not a top-level toggle) keeps the picker single-step. |
| 21 | Phase names in API response | `centering` / `practice` / `reflection` (state focuses). Body-focus phase names unchanged. | The API contract is the consumer-facing truth. Engine-internal vocabulary leaking into the wire format risks UI consumers forgetting to remap and exposing technique-y labels to users. "Practice" is also more accurate than "main" — it's what the user is *doing*. |
| 22 | Engine input contract | State focuses accept `time_budget_range` (one of `0_10`, `10_20`, `21_30`, `30_45`, `endless`). Body focuses accept `time_budget_min: int`. | Picker's available options come from `getAvailableDurations`. Engine accepting only valid ranges from that contract guarantees the lying problem cannot recur. |
| 23 | Degradation logic | Body focuses keep ±10% tolerance reporting (yoga content gaps surface honestly). State focuses cannot degrade — picker only offers honestly-fillable ranges. | When the picker can't lie, there's nothing to degrade against. Simplifies the state-focus engine and smoke test. |

---

## Inputs

The engine is invoked with a discriminated input — body focuses and state focuses take different parameters.

**Body focuses:**

```
generateSession({
  user_id:         INT,                     -- required
  focus_slug:      VARCHAR,                 -- focus_type='body' here
  entry_point:     ENUM('home', 'strength_tab', 'yoga_tab'),
  time_budget_min: INT                      -- 30/60 for home & strength_tab; 15/30/45/60 for yoga_tab
})
```

**State focuses:**

```
generateSession({
  user_id:           INT,                   -- required
  focus_slug:        VARCHAR,               -- focus_type='state' here
  entry_point:       ENUM('home', 'breathwork_tab'),
  time_budget_range: ENUM('0_10', '10_20', '21_30', '30_45', 'endless')
})
```

**Invalid combinations (engine throws `RangeError`):**
- Body focus + `entry_point='breathwork_tab'` (breathwork tab surfaces state focuses only)
- State focus + `entry_point IN ('strength_tab', 'yoga_tab')` (those tabs surface body focuses only)
- State focus + `time_budget_range` whose state per `getAvailableDurations` is not `'available'` for the user's level

**Not-yet-implemented combinations (engine throws `NotImplementedError`):**
- `focus_slug='mobility'` — handled in T4 with its own special-case branch
- `focus_slug='full_body'` — handled in T4 with its own special-case branch

It reads:

- `user_pillar_levels` — the user's three levels (engine queries strength/yoga/breathwork rows independently as needed)
- `focus_areas`, `focus_muscle_keywords`, `focus_content_compatibility` — the focus model from S11-T3
- `breathwork_techniques` — with all 9 tagging columns from S11-T2 plus the `settle_eligible_for` column
- `exercises` — strength + yoga, with `target_muscles`, `practice_types`, `difficulty`
- `sessions`, `breathwork_sessions` — for recency warnings and the recompute_user_pillar_level trigger
- `user_exercise_prefs` — for swap-prefs (existing)
- `user_excluded_exercises` — new table, see §Schema

It returns:

```jsonc
{
  "session_shape": "cross_pillar" | "pillar_pure" | "state_focus",
  "phases": [
    {
      "phase": "bookend_open" | "warmup" | "main" | "cooldown" | "bookend_close" | "centering" | "practice" | "reflection",
      "items": [
        {
          "content_type": "strength" | "yoga" | "breathwork",
          "content_id":   INT,           // null for the reflection phase only
          "name":         VARCHAR,
          "duration_minutes": INT,        // null for reflection-on-endless and practice-on-endless
          "mode":         "timed" | "open_ended" | "user_triggered",  // state-focus only
          "sets":         INT NULLABLE,
          "reps":         INT NULLABLE,
          "tier_badge":   "foundational" | "standard" | "caution" | NULL
        }
      ]
    }
  ],
  "warnings": [
    { "type": "recency_overlap", "message": "...", "alternative_focus": "recover" }
  ],
  "metadata": {
    "estimated_total_min": INT,                 // null for endless state sessions
    "user_levels": { "strength": "...", "yoga": "...", "breathwork": "..." },
    "requested_range":     VARCHAR              // state-focus only; echoes back the chosen bracket
  }
}
```

**Phase names per session shape:**

| Session shape | Phases (in order) |
|---|---|
| `cross_pillar` (body focus from home) | `bookend_open` → `warmup` → `main` → `cooldown` → `bookend_close` |
| `pillar_pure` from strength tab | `main` only |
| `pillar_pure` from yoga tab | `warmup` → `main` → `cooldown` |
| `state_focus` | `centering` → `practice` → `reflection` |

---

## Schema additions

Three new tables. All migrations land in `server/src/db/migrate.js` under a single `S12-T1` block.

### Table 1: `focus_overlaps`

Hand-authored adjacency map for muscle-overlap recency warnings. 12 rows (6 muscle-pair relationships × 2 directions).

```sql
CREATE TABLE IF NOT EXISTS focus_overlaps (
  id          SERIAL PRIMARY KEY,
  focus_id    INT NOT NULL REFERENCES focus_areas(id) ON DELETE CASCADE,
  overlaps_with_id INT NOT NULL REFERENCES focus_areas(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(focus_id, overlaps_with_id),
  CHECK(focus_id <> overlaps_with_id)
);

CREATE INDEX IF NOT EXISTS idx_focus_overlaps_focus
  ON focus_overlaps(focus_id);
```

**Symmetric pairs are stored as two rows.** chest→triceps is one row; triceps→chest is a separate row. Avoids "did I already check both directions" logic in the engine. Seed handles this explicitly.

### Table 2: `user_excluded_exercises`

Hard exclusions earned via the swap-counter.

```sql
CREATE TABLE IF NOT EXISTS user_excluded_exercises (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('strength', 'yoga', 'breathwork')),
  content_id  INT NOT NULL,
  excluded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, content_type, content_id)
);

CREATE INDEX IF NOT EXISTS idx_user_excluded_user
  ON user_excluded_exercises(user_id);
```

**Soft FK** on `(content_type, content_id)` — same pattern as `focus_content_compatibility`. Acceptable; integrity verified by the engine query layer.

### Table 3: `exercise_swap_counts`

Tracks how many times a user has swapped *away from* an exercise. Drives the 3rd-swap exclusion prompt.

```sql
CREATE TABLE IF NOT EXISTS exercise_swap_counts (
  id           SERIAL PRIMARY KEY,
  user_id      INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_id  INT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  swap_count   INT NOT NULL DEFAULT 0,
  last_swapped_at TIMESTAMPTZ,
  prompt_state VARCHAR(20) NOT NULL DEFAULT 'never_prompted' CHECK (prompt_state IN ('never_prompted', 'prompted_keep', 'excluded')),
  UNIQUE(user_id, exercise_id)
);

CREATE INDEX IF NOT EXISTS idx_swap_counts_user
  ON exercise_swap_counts(user_id);
```

**Field notes:**
- `swap_count` increments on every swap *away from* this exercise (regardless of the destination).
- `prompt_state`:
  - `never_prompted` — the user has never seen the exclusion prompt for this exercise. Prompt fires when count hits 3.
  - `prompted_keep` — the user said "keep suggesting" at the prompt. Prompt fires again at count 6 (once more, then leaves them alone). Engine still surfaces this exercise normally.
  - `excluded` — the user said "yes, exclude" → row mirrored into `user_excluded_exercises`. Exercise never surfaces in suggestions again.

This table is only for **strength exercises**. Breathwork and yoga don't currently have a mid-session swap UI; if they get one, extend the table or add per-pillar tables in a later sprint.

### Column addition: `breathwork_techniques.settle_eligible_for`

The state-focus centering phase picks from a curated pool of beginner-safe techniques tonally matched to the focus. Stored as a TEXT[] of state-focus slugs the technique is eligible to open.

> **Naming note:** the database column name is `settle_eligible_for` — kept for compatibility with the seed already in production. The user-facing API renames the phase to `centering`, but the underlying column name stays. Internal pseudocode in this spec uses `settle_eligible_for` when referring to the column and `centering` when referring to the phase.

```sql
ALTER TABLE breathwork_techniques
  ADD COLUMN IF NOT EXISTS settle_eligible_for TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_breathwork_settle_eligible
  ON breathwork_techniques USING GIN (settle_eligible_for);
```

**Seed values** (5 state focuses × 2 techniques each = 10 settle-eligibility rows):

| Technique name (look up by name) | settle_eligible_for |
|---|---|
| Diaphragmatic Breathing (Yogic Breath) | `{calm, sleep, energize, focus, recover}` |
| Sama Vritti (Equal Breath / 4-4 Box) | `{calm}` |
| Three-Part Breath (Dirga Pranayama) | `{sleep, recover}` |
| Coherent Breathing (5.5 / 5.5) | `{energize}` |
| Box Breathing (4-4-4-4) | `{focus}` |

**Why these choices:**
- **Diaphragmatic always eligible** — universal fallback, foundational, zero contraindications. The engine always has at least one valid pick.
- **Sama Vritti for calm** — equal-ratio breath, parasympathetic, gentle. Pairs naturally with deep calm work.
- **Three-Part Breath for sleep + recover** — long exhale emphasis, deeply restorative, signals parasympathetic shift.
- **Coherent Breathing for energize** — slightly longer phases activate without spiking. Bridges low arousal toward energizing main work.
- **Box Breathing for focus** — even attention on each phase, mirrors the cognitive locked-in feel focus work targets.

All 5 alternatives are beginner-tier in S11-T2 tagging, so the engine never serves an above-level centering technique.

### No other changes to existing tables.

Everything else lives in queries / functions.

---

## Time Budget

The picker policy splits cleanly along the body-focus / state-focus line.

### Body-focus pickers (fixed-minute budgets)

| Entry point | Picker | Options shown |
|---|---|---|
| Home (cross-pillar) | Yes | Standard · 30 min · Long · 60 min |
| Strength tab → suggested session | Yes | Standard · 30 min · Long · 60 min |
| Strength tab → custom workout | No | Soft warning at 2 hours elapsed |
| Yoga tab → suggested session | Yes | Quick · 15 min · Short · 30 min · Standard · 45 min · Long · 60 min |
| Yoga tab → custom workout | No | (user's own selections determine length) |

These pickers operate on yoga/strength content that bends naturally (a yoga pose holds for 30s or 3min; a strength set is ~1.5 min regardless). Tolerance: ±10% of requested budget. Honest degradation reported when content gap forces a shorter session.

**Cross-pillar (home) duration math:**
- 30 min = 3 min bookend_open + 3 min warmup + 18 min main + 3 min cooldown + 3 min bookend_close
- 60 min = 5 min bookend_open + 5 min warmup + 40 min main + 5 min cooldown + 5 min bookend_close

### State-focus picker (range brackets + endless)

State-focus pickers always show 5 options in this order:

| Option | Internal slug | Engine behavior |
|---|---|---|
| 0–10 min | `0_10` | centering (1 min) + practice (technique fits 1–8 min) + reflection (1 min) |
| 10–20 min | `10_20` | centering (1–2 min) + practice (technique fits 9–18 min) + reflection (1–2 min) |
| 21–30 min | `21_30` | centering (2–3 min) + practice (technique fits 16–26 min) + reflection (2–3 min) |
| 30–45 min | `30_45` | centering (3 min) + practice (technique fits 25–39 min) + reflection (3 min) |
| Until I'm done | `endless` | centering (default 2 min) + practice (open-ended, no timer) + reflection (default 2 min, triggered on user tap) |

**Picker rendering (Sprint 13 work, recorded for traceability):**
- All 5 options always render.
- Active options (`state: 'available'`) are tappable. Inactive options (`state: 'locked_by_level'` or `state: 'empty'`) are visually muted.
- Inactive options show a hint on tap or hover: `locked_by_level` → "More options unlock at intermediate level"; `empty` → "Coming soon".
- Default selected option per (focus, level): the **largest available bracket the user has previously completed** (read from `breathwork_sessions` history). If no history, default to **0–10 min**.

**State-focus duration math:**

The engine computes phase durations such that the total session falls **strictly within the chosen bracket**:
- Total session in minutes = `centering.duration + practice.duration + reflection.duration`
- For non-endless ranges: `bracket_min ≤ total ≤ bracket_max`
- For endless: practice has no fixed duration; total is reported as `null` in metadata

Centering and reflection get short, technique-driven slots (capped at 3 min each). Practice fills the remainder, clamped by the picked technique's `<level>_duration_min` and `<level>_duration_max`. The picker only offers brackets where at least one (technique × duration) combination satisfies the bounds — guaranteed by `getAvailableDurations`.

---

## getAvailableDurations contract

The picker's available-options list comes from a single engine helper.

**Function signature:**

```js
async function getAvailableDurations(focus_slug, breathwork_level)
```

**Returns:**

```jsonc
{
  "focus_slug": "energize",
  "breathwork_level": "beginner",
  "ranges": [
    {
      "label": "0_10",
      "display": "0–10 min",
      "min_total_minutes": 1,
      "max_total_minutes": 10,
      "state": "available",
      "technique_count": 1
    },
    {
      "label": "10_20",
      "display": "10–20 min",
      "min_total_minutes": 11,
      "max_total_minutes": 20,
      "state": "locked_by_level",
      "unlock_at_level": "intermediate",
      "technique_count_at_unlock": 5
    },
    {
      "label": "21_30",
      "display": "21–30 min",
      "min_total_minutes": 21,
      "max_total_minutes": 30,
      "state": "locked_by_level",
      "unlock_at_level": "intermediate",
      "technique_count_at_unlock": 4
    },
    {
      "label": "30_45",
      "display": "30–45 min",
      "min_total_minutes": 31,
      "max_total_minutes": 45,
      "state": "empty",
      "technique_count_at_unlock": 0
    },
    {
      "label": "endless",
      "display": "Until I'm done",
      "min_total_minutes": null,
      "max_total_minutes": null,
      "state": "available",
      "technique_count": 1
    }
  ]
}
```

**State semantics (mutually exclusive):**

| State | Meaning | When |
|---|---|---|
| `available` | Engine can compose at least one honest session in this bracket at this user's level | Eligible main pool (per S11-T3 `focus_content_compatibility` filter) contains ≥1 technique whose `<level>_duration_min` to `<level>_duration_max` range intersects the bracket bounds (after subtracting 2–6 min for centering+reflection) |
| `locked_by_level` | Bracket has techniques in our catalog, but they require a higher level | At higher level (intermediate or advanced), the eligible main pool intersects the bracket; `unlock_at_level` is the minimum level required |
| `empty` | No technique anywhere in our catalog, at any level, fills this bracket for this focus | Bracket bounds don't intersect any (focus, technique, level) combination |

**`endless` always has `state: 'available'`** when the focus has at least one main-eligible technique at the user's level. Otherwise it's `locked_by_level`. `empty` doesn't apply to `endless` — it's a mode, not a duration.

**Computation (reference SQL):**

```sql
-- For a given (focus_slug, breathwork_level), find the eligible main pool's duration extent.
WITH eligible_mains AS (
  SELECT
    bt.id,
    bt.name,
    CASE $breathwork_level
      WHEN 'beginner'     THEN bt.beginner_duration_min
      WHEN 'intermediate' THEN bt.intermediate_duration_min
      WHEN 'advanced'     THEN bt.advanced_duration_min
    END AS dmin,
    CASE $breathwork_level
      WHEN 'beginner'     THEN bt.beginner_duration_max
      WHEN 'intermediate' THEN bt.intermediate_duration_max
      WHEN 'advanced'     THEN bt.advanced_duration_max
    END AS dmax
  FROM focus_content_compatibility fcc
  JOIN focus_areas fa ON fa.id = fcc.focus_id
  JOIN breathwork_techniques bt ON bt.id = fcc.content_id
  WHERE fa.slug = $focus_slug
    AND fcc.role = 'main'
    AND fcc.content_type = 'breathwork'
    AND bt.standalone_compatible = true
    AND CASE bt.difficulty
          WHEN 'beginner' THEN 1 WHEN 'intermediate' THEN 2 WHEN 'advanced' THEN 3
        END <=
        CASE $breathwork_level
          WHEN 'beginner' THEN 1 WHEN 'intermediate' THEN 2 WHEN 'advanced' THEN 3
        END
)
SELECT
  COUNT(*) FILTER (WHERE dmin IS NOT NULL AND dmax IS NOT NULL) AS available_count,
  MIN(dmin) AS pool_min_practice,
  MAX(dmax) AS pool_max_practice
FROM eligible_mains;
```

The bracket's `state` is computed by checking whether `[bracket.min_total - 6, bracket.max_total - 2]` intersects `[pool_min_practice, pool_max_practice]` — i.e. the bracket can hold the practice phase plus 2–6 min of bookends.

**`technique_count` at the available state:** count of techniques in the eligible pool whose `[dmin, dmax]` intersects the bracket's practice-phase window.

**`technique_count_at_unlock` at locked state:** the same count, computed for the `unlock_at_level` instead of the user's current level.

**Performance note:** this helper runs on every state-focus picker render. For 5 focuses × 3 levels = 15 cells, the query is small enough to be uncached in v1. Sprint 13 may add a request-level cache if the picker hits warrant it.

---

## Recipes — body focus from home (cross-pillar)

User picks a body focus (any of: chest, back, shoulders, biceps, triceps, core, glutes, quads, hamstrings, calves, mobility, full_body).

**Inputs:** focus_slug, time_budget_min (30 or 60), user_id, levels.

**Algorithm:**

```
1. CHECK RECENCY OVERLAP
   sessions_last_calendar_day = SELECT * FROM sessions
     WHERE user_id = $1
       AND date >= (CURRENT_DATE - INTERVAL '1 day')
       AND date <= CURRENT_DATE
       AND completed = true
   FOR each session: extract its focus_slug (from sessions.focus_slug if column exists,
     otherwise inferred from session_exercises.target_muscles)
   IF current focus matches yesterday's focus → emit recency_overlap warning
   IF current focus's overlap-set (focus_overlaps) intersects yesterday's focus → emit recency_overlap warning
   warnings array attached to response; engine STILL generates session
   (warning is informational; user decides whether to proceed)

2. RESOLVE LEVELS
   levels = SELECT pillar, level FROM user_pillar_levels WHERE user_id = $1
   strength_level, yoga_level, breathwork_level = resolved from above
   (all default to 'beginner' if user has no rows yet)

3. ASSEMBLE PHASES
   phases = []

   3a. BOOKEND_OPEN (breathwork)
       eligible = SELECT bt.* FROM focus_content_compatibility fcc
         JOIN focus_areas fa ON fa.id = fcc.focus_id
         JOIN breathwork_techniques bt ON bt.id = fcc.content_id
         WHERE fa.slug = $focus_slug
           AND fcc.role = 'bookend_open'
           AND fcc.content_type = 'breathwork'
           AND bt.difficulty <= $breathwork_level
           AND bt.id NOT IN (user_excluded_exercises for this user)
       picked = RANDOM_PICK(eligible)
       duration = CLAMP(time_budget * 0.10, picked.<level>_duration_min, picked.<level>_duration_max)
       (defaults to 3 min for 30-min budget, 5 min for 60-min budget)

   3b. WARMUP (yoga)
       muscle_keywords = SELECT keyword FROM focus_muscle_keywords WHERE focus_id = $focus_id
       IF focus_slug = 'mobility': skip muscle_keywords; eligible = yoga rows where practice_type IN ('flexibility', 'mobility')
       IF focus_slug = 'full_body': skip muscle_keywords; eligible = yoga rows where target_muscles array length >= 3
       ELSE:
         eligible = yoga exercises where target_muscles overlaps muscle_keywords
                    AND difficulty <= $yoga_level
                    AND id NOT IN excluded
       picked_count = 1 if budget = 30 else 2
       picked_set = RANDOM_PICK_N(eligible, picked_count)
       duration = approx 3 min total at 30, approx 5 min total at 60

   3c. MAIN (strength)
       muscle_keywords = same as warmup
       IF focus_slug = 'mobility': eligible = strength exercises where practice_type contains 'mobility' (rare; likely empty)
         → if empty, this phase is skipped for mobility focus. Mobility's "main" is yoga work.
         The engine routes mobility's main slot to a longer yoga sequence (see §Mobility special case).
       IF focus_slug = 'full_body': eligible = strength exercises where target_muscles array length >= 3
       ELSE:
         eligible = strength exercises where target_muscles overlaps muscle_keywords
                    AND difficulty <= $strength_level
                    AND id NOT IN excluded
       picked_count =
         3 at budget 30
         5 at budget 60
       picked_set = RANDOM_PICK_N(eligible, picked_count)
       sets_per_exercise = 3 (beginner) | 4 (intermediate) | 4 (advanced)
       reps_per_set = 8-12 (default; not personalized in v1)

   3d. COOLDOWN (yoga)
       muscle_keywords = same
       eligible = yoga exercises where target_muscles overlaps muscle_keywords
                  AND difficulty <= $yoga_level
                  AND practice_type contains 'flexibility' OR 'restorative'
                  AND id NOT IN warmup picked_set      -- avoid duplicates
                  AND id NOT IN excluded
       picked_count = 1 at 30, 2 at 60
       picked_set = RANDOM_PICK_N(eligible, picked_count)
       duration = approx 3 min at 30, approx 5 min at 60

   3e. BOOKEND_CLOSE (breathwork)
       eligible = SELECT bt.* FROM focus_content_compatibility fcc
         JOIN focus_areas fa ON fa.id = fcc.focus_id
         JOIN breathwork_techniques bt ON bt.id = fcc.content_id
         WHERE fa.slug = $focus_slug
           AND fcc.role = 'bookend_close'
           AND fcc.content_type = 'breathwork'
           AND bt.difficulty <= $breathwork_level
           AND bt.id NOT IN excluded
       picked = RANDOM_PICK(eligible)
       duration = same as bookend_open

4. ASSEMBLE TIER BADGES (composer-only — suggestion path skips this)
   For each item, compute tier_badge:
     IF item.difficulty < user's level for that pillar → tier_badge = 'foundational'
     IF item.difficulty = user's level → tier_badge = NULL
     IF item.difficulty > user's level → (this should never appear in suggestions; only in composer)
                                          tier_badge = 'caution'
   For suggestion path, all items have difficulty <= user level by filter, so tier_badge = NULL or 'foundational'.
   In suggestion path we skip rendering 'foundational' badge to keep UI clean — only the composer surfaces it.

5. RETURN {session_shape: 'cross_pillar', phases, warnings, metadata}
```

---

## Recipes — body focus from strength tab

**Inputs:** focus_slug (any body focus except `mobility` — mobility is hidden from strength tab), time_budget_min (30 or 60), user_id, strength_level.

**Algorithm:**

```
1. RECENCY OVERLAP CHECK — same as cross-pillar.

2. RESOLVE LEVEL — only need strength_level.

3. ASSEMBLE PHASES (single phase: main strength only, no bookends, no yoga warmup/cooldown)
   muscle_keywords = SELECT keyword FROM focus_muscle_keywords WHERE focus_id = $focus_id
   IF focus_slug = 'full_body':
     eligible = strength exercises where target_muscles array length >= 3
   ELSE:
     eligible = strength exercises where target_muscles overlaps muscle_keywords
                AND difficulty <= $strength_level
                AND id NOT IN excluded

   picked_count =
     5 at budget 30
     8 at budget 60
   picked_set = RANDOM_PICK_N(eligible, picked_count)
   sets_per_exercise = 3 (beginner) | 4 (intermediate) | 4 (advanced)

4. RETURN {session_shape: 'pillar_pure', phases: [{phase: 'main', items}], warnings, metadata}
```

**Custom workout path (no engine):** user enters `EmptyWorkout` flow as it exists today. Engine is not invoked. Only mechanical addition: soft warning at 2-hour elapsed time (FUTURE_SCOPE — Sprint 13 ticket).

---

## Recipes — body focus from yoga tab

**Inputs:** focus_slug (any body focus — yoga tab supports all 12 including mobility and full_body), time_budget_min (15/30/45/60), user_id, yoga_level.

**Algorithm:**

```
1. RECENCY OVERLAP CHECK — same as cross-pillar.

2. RESOLVE LEVEL — only need yoga_level.

3. ASSEMBLE PHASES (yoga-pure session: warmup → main → cooldown)
   muscle_keywords = SELECT keyword FROM focus_muscle_keywords WHERE focus_id = $focus_id

   IF focus_slug = 'mobility':
     warmup = yoga rows where practice_type IN ('mobility') AND difficulty <= yoga_level
     main = yoga rows where practice_type IN ('flexibility', 'mobility') AND difficulty <= yoga_level
     cooldown = yoga rows where practice_type IN ('restorative', 'flexibility') AND difficulty <= yoga_level
   ELSE IF focus_slug = 'full_body':
     warmup = yoga rows where target_muscles length >= 3 AND practice_type contains 'mobility'
     main = yoga rows where target_muscles length >= 3
     cooldown = yoga rows where practice_type contains 'restorative' OR 'flexibility'
   ELSE:
     warmup = yoga rows where target_muscles overlaps muscle_keywords AND practice_type contains 'mobility' OR 'flexibility'
     main = yoga rows where target_muscles overlaps muscle_keywords (any practice_type)
     cooldown = yoga rows where target_muscles overlaps muscle_keywords AND practice_type contains 'flexibility' OR 'restorative'

   All filtered by difficulty <= yoga_level AND id NOT IN excluded.

   Counts per phase scale with budget:
     15 min: warmup=1, main=3, cooldown=1
     30 min: warmup=2, main=5, cooldown=2
     45 min: warmup=2, main=8, cooldown=3
     60 min: warmup=3, main=10, cooldown=4

   picked_set = RANDOM_PICK_N per phase

4. RETURN {session_shape: 'pillar_pure', phases: [warmup, main, cooldown], warnings, metadata}
```

---

## Recipes — state focus

**Entry points that support state focuses:**
- Home (state focuses from home generate a state-only session, NOT a 5-phase shape)
- Breathwork tab

**Inputs:**
- `focus_slug` (one of: `energize`, `calm`, `focus`, `sleep`, `recover`)
- `time_budget_range` (one of: `0_10`, `10_20`, `21_30`, `30_45`, `endless`)
- `user_id`
- `breathwork_level` (read from `user_pillar_levels`)

**Validation (strict):**
- `time_budget_range` MUST be one of the 5 valid values.
- That range MUST have `state: 'available'` for this `(focus_slug, breathwork_level)` per `getAvailableDurations`. If not, throw `RangeError('range not available for this focus/level — check getAvailableDurations before generating')`.

The picker UI is responsible for never offering an unavailable range, but the engine validates defensively in case an API consumer skips the check.

**Algorithm:**

```
1. RECENCY OVERLAP CHECK — DOES NOT APPLY to state focuses.
   "Calm yesterday, calm today" is fine, even ideal. Skip the overlap check entirely.

2. RESOLVE LEVEL — only need breathwork_level.

3. COMPUTE PHASE DURATION TARGETS from the chosen range
   For non-endless ranges:
     bracket_min, bracket_max = bounds of the chosen range
     centering_target  = MIN(3, MAX(1, FLOOR(bracket_max * 0.10)))
     reflection_target = MIN(3, MAX(1, FLOOR(bracket_max * 0.10)))
     practice_min      = bracket_min - centering_target - reflection_target
     practice_max      = bracket_max - centering_target - reflection_target
   For endless:
     centering_target  = 2  (default, refined later by user history)
     reflection_target = 2  (default)
     practice_min      = null
     practice_max      = null

4. CENTERING PHASE — pick from curated pool.
   eligible = SELECT bt.* FROM breathwork_techniques bt
     WHERE $focus_slug = ANY(bt.settle_eligible_for)
       AND bt.difficulty <= $breathwork_level
       AND bt.id NOT IN excluded
   picked = RANDOM_PICK(eligible)
   -- Diaphragmatic is always in the pool, so eligible is never empty
   centering_item = {
     content_type: 'breathwork',
     content_id: picked.id,
     name: picked.name,
     duration_minutes: centering_target,
     mode: 'timed',
     ...
   }

5. PRACTICE PHASE — pick a technique whose duration range fits the bracket.
   For non-endless ranges:
     candidates = SELECT bt.* FROM focus_content_compatibility fcc
       JOIN focus_areas fa ON fa.id = fcc.focus_id
       JOIN breathwork_techniques bt ON bt.id = fcc.content_id
       WHERE fa.slug = $focus_slug
         AND fcc.role = 'main'
         AND fcc.content_type = 'breathwork'
         AND bt.standalone_compatible = true
         AND bt.difficulty <= $breathwork_level
         AND bt.id NOT IN excluded
         AND <bt.<level>_duration_min IS NOT NULL>
         AND <bt.<level>_duration_min> <= practice_max
         AND <bt.<level>_duration_max> >= practice_min
     picked = RANDOM_PICK(candidates)

     -- Choose duration within the intersection of [practice_min, practice_max] and [picked.dmin, picked.dmax]
     dur_lo = MAX(practice_min, picked.<level>_duration_min)
     dur_hi = MIN(practice_max, picked.<level>_duration_max)
     practice_duration = RANDOM_INT(dur_lo, dur_hi)

     practice_item = {
       content_type: 'breathwork',
       content_id: picked.id,
       name: picked.name,
       duration_minutes: practice_duration,
       mode: 'timed',
       ...
     }

   For endless:
     candidates = (same query, minus the duration-fit filters)
     picked = RANDOM_PICK(candidates)
     practice_item = {
       content_type: 'breathwork',
       content_id: picked.id,
       name: picked.name,
       duration_minutes: null,
       mode: 'open_ended',
       ...
     }

6. REFLECTION PHASE — silent observed-breathing, no technique.
   reflection_item = {
     content_type: 'breathwork',
     content_id: null,
     name: 'Reflection',
     duration_minutes: reflection_target,  -- null for endless mode
     mode: (range == 'endless') ? 'user_triggered' : 'timed',
     ...
   }

7. RETURN {
     session_shape: 'state_focus',
     phases: [
       { phase: 'centering',  items: [centering_item] },
       { phase: 'practice',   items: [practice_item] },
       { phase: 'reflection', items: [reflection_item] },
     ],
     warnings: [],
     metadata: {
       requested_range: time_budget_range,
       estimated_total_min: centering_target + practice_duration + reflection_target,
                           // null for endless
       user_levels: { ... },
     }
   }
```

**Notes that are easy to get wrong:**

1. **No DEGRADED reporting on state focuses.** The engine no longer compares actual to a target budget — there is no target budget. Smoke tests assert `bracket_min ≤ estimated_total_min ≤ bracket_max` for non-endless ranges; that's all.

2. **`metadata.estimated_total_min` is `null` for endless mode.** UI handles "ongoing" rendering for endless sessions. T7 documents this in the API contract.

3. **Centering technique can be the same as practice technique.** If the user picks calm and the engine picks Diaphragmatic Breathing for both centering and practice, that's fine — they're playing different roles. Diaphragmatic centering is a 1-min arrival; Diaphragmatic practice is 5–10 min of actual technique work. The user UI distinguishes them by phase label.

4. **`reflection.content_id` is `null` by design.** The reflection phase is a timer + prompt, not a technique. T7's player UI detects null and renders the silent-observation experience.

5. **No swap-counter writes from this recipe.** T6 owns those. Reads from `user_excluded_exercises` ARE in scope (filter applies above).

---

## Sampling — uniform random within eligible pool (v1)

The engine does not weight items in v1. After filtering the candidate pool by all the rules (level, role, focus match, exclusion, recency), every item in the pool has equal probability of being picked.

```python
def pick_n(eligible_pool, n):
    """Uniform random sample without replacement."""
    return random.sample(eligible_pool, k=min(n, len(eligible_pool)))
```

**Why uniform and not weighted in v1:**

A query-time weight formula was proposed during planning (level match + compound bonus + equipment bonus). It was withdrawn because it didn't actually fix the accuracy problem it was meant to solve. The real accuracy issue is that `target_muscles` doesn't distinguish primary from secondary muscles — a "triceps" focus query matches both Tricep Extension (correct) and Bench Press (technically tagged with triceps, but the chest does most of the work). A compound bonus *worsens* this: it would rank Bench Press *higher* on triceps day. Uniform sampling at least doesn't actively make the wrong call confidently.

**Where weighted sampling lands:**

Sprint 13 ships primary/secondary/tertiary muscle columns and re-tags all 736 strength exercises. After that, a real weight formula becomes possible:

- If focus muscle is **primary** for the exercise → weight 1.0
- If focus muscle is **secondary** → weight 0.5
- If focus muscle is **tertiary** → weight 0.2

That formula would actually solve the bench-press-on-triceps-day bug. It's a Sprint 14+ engine update, not v1 work.

**SQL implementation note:** uniform sampling in Postgres is just `ORDER BY random() LIMIT n`. Or pull the pool to the service layer and use `random.sample()`. Either is fine — pool sizes are small (≤30 typically).

---

## Recency overlap warnings

**Rule:** if the user has trained the same focus, OR a focus that overlaps via `focus_overlaps`, within the past 1 calendar day, emit a warning.

**Applies to body focuses only.** State focuses skip the recency check entirely (calm yesterday + calm today is fine, even ideal).

**Detection query:**

```sql
WITH yesterday_focuses AS (
  SELECT DISTINCT s.focus_slug
  FROM sessions s
  WHERE s.user_id = $1
    AND s.completed = true
    AND s.date >= (CURRENT_DATE - INTERVAL '1 day')
    AND s.date <= CURRENT_DATE
    AND s.focus_slug IS NOT NULL
)
SELECT 1
WHERE EXISTS (
  SELECT 1 FROM yesterday_focuses
  WHERE focus_slug = $current_focus_slug
)
OR EXISTS (
  SELECT 1 FROM yesterday_focuses yf
  JOIN focus_areas fa1 ON fa1.slug = $current_focus_slug
  JOIN focus_overlaps fo ON fo.focus_id = fa1.id
  JOIN focus_areas fa2 ON fa2.id = fo.overlaps_with_id
  WHERE fa2.slug = yf.focus_slug
);
```

**Warning emission:** if either EXISTS clause returns a row, emit:

```jsonc
{
  "type": "recency_overlap",
  "yesterday_focus": "chest",
  "current_focus": "triceps",
  "message": "You trained chest yesterday — your triceps were worked too. Consider a recovery focus today.",
  "alternative_focus_slug": "recover"
}
```

**Engine still produces the session.** UI decides how to render the warning.

**Prerequisite — `sessions.focus_slug` column:**
This column does not exist today. The S12-T1 migration adds it:

```sql
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS focus_slug VARCHAR(40);
CREATE INDEX IF NOT EXISTS idx_sessions_user_focus_date
  ON sessions(user_id, focus_slug, date)
  WHERE completed = true;
```

The engine writes `focus_slug` to a session when it's created from a suggestion. Custom workouts (`EmptyWorkout`) leave `focus_slug = NULL` and are excluded from the recency check.

**Backfill:** existing rows stay NULL. Recency check sees no historical focuses for the existing 3 users, which is fine.

---

## Swap-counter mechanics

**Trigger:** every time `AlternativePicker` resolves to a swap (existing UI flow).

**Server logic (existing endpoint extended):**

```sql
INSERT INTO exercise_swap_counts (user_id, exercise_id, swap_count, last_swapped_at)
VALUES ($1, $2, 1, NOW())
ON CONFLICT (user_id, exercise_id)
DO UPDATE SET
  swap_count = exercise_swap_counts.swap_count + 1,
  last_swapped_at = NOW();

SELECT swap_count, prompt_state FROM exercise_swap_counts
WHERE user_id = $1 AND exercise_id = $2;
```

**Prompt logic:**
- `swap_count = 3` AND `prompt_state = 'never_prompted'` → return `should_prompt: true` in the response. UI shows the prompt.
- `swap_count = 6` AND `prompt_state = 'prompted_keep'` → return `should_prompt: true` again (one final prompt).
- Otherwise → no prompt.

**Prompt UI (Sprint 13 work):**
> "You've swapped Burpees 3 times — want to stop seeing it in suggestions? You can change this later in Settings."
>
> [Yes, exclude] [No, keep suggesting]

**Server endpoints:**

```
POST /api/exercises/:id/exclude
  → INSERT into user_excluded_exercises
  → UPDATE exercise_swap_counts SET prompt_state = 'excluded'

POST /api/exercises/:id/keep-suggesting
  → UPDATE exercise_swap_counts SET prompt_state = 'prompted_keep'
```

**No Settings UI for managing exclusions in v1.**

---

## Tier-aware badges

The engine surfaces badges in two places:

**Suggestion path:** all items pre-filtered by `difficulty <= user_level`. So:
- Items at user's level → no badge.
- Items below user's level → no badge in suggestion UI either.

**Composer path (Sprint 14):** all items visible regardless of user level. So:
- Below user level → "Foundational" badge
- At user level → "Standard" badge
- Above user level → "Caution" badge

**Implementation:** the engine returns `tier_badge` per item even on the suggestion path; UI decides whether to render.

---

## Mobility — special case

`mobility` is a body focus (`focus_type='body'`) but doesn't map cleanly to the muscle-keyword model.

**Strength-tab behavior:** `mobility` is **hidden from the strength tab focus picker**.

**Yoga-tab behavior:** mobility uses a `practice_type`-based query path:
- warmup: `practice_type IN ('mobility')` filtered by yoga_level
- main: `practice_type IN ('flexibility', 'mobility')` filtered by yoga_level
- cooldown: `practice_type IN ('restorative', 'flexibility')` filtered by yoga_level

**Home (cross-pillar) behavior:** mobility uses a "yoga-dominant" cross-pillar shape:
```
bookend_open (breathwork, calming) →
warmup (yoga, mobility practice_type) →
main (yoga, flexibility/mobility — fills the strength-main slot) →
cooldown (yoga, restorative) →
bookend_close (breathwork, calming)
```

Strength is omitted entirely from a mobility session. Time budget reallocates: the strength-main slot's duration goes to extending the yoga main.

**Implementation:** the engine has a `mobility_special_case_path()` branch that produces this shape directly, bypassing the standard cross-pillar recipe.

---

## Full Body — special case

`full_body` is a body focus but matches "any compound exercise" rather than a specific muscle.

**Compound detection:** `full_body` exercises are those where `array_length(target_muscles, 1) >= 3`. Computed at query time:

```sql
WHERE array_length(target_muscles, 1) >= 3
```

**Yoga full-body:** same rule applied to yoga rows — sequences that hit 3+ muscle groups.

**Strength tab + full_body:** standard strength session, just with the `full_body` filter instead of muscle-keyword filter. 5 picks at budget 30, 8 at budget 60.

**Yoga tab + full_body:** standard yoga session with the same filter.

**Home cross-pillar + full_body:** standard cross-pillar shape, with both yoga-warmup/cooldown and strength-main using the compound filter.

---

## Acceptance criteria

| # | Test | Verification |
|---|------|--------------|
| 1 | Engine produces a non-empty session for every (focus, entry_point, level) combination Prashob's account can hit | Smoke test |
| 2 | All items returned have `difficulty <= user_level` for that pillar | SQL assertion |
| 3 | No item appears in `user_excluded_exercises` for that user | SQL assertion |
| 4 | Bookends only appear in cross-pillar sessions; centering/reflection only appear in state-focus sessions | SQL assertion grouped by session_shape |
| 5 | Centering phase technique is always in the curated pool for that state focus (`$focus_slug = ANY(bt.settle_eligible_for)`) | SQL assertion on state_focus sessions |
| 6 | `focus_overlaps` seed produces expected adjacency for known cases (chest↔triceps, back↔biceps, etc.) | Spot-check queries |
| 7 | Recency warning fires when last session is yesterday and matches focus or overlap (body focuses only) | Test fixture |
| 8 | 3rd swap of an exercise sets `prompt_state` correctly | Test |
| 9a | Body-focus sessions: total duration ≈ `time_budget_min` within 10% (or honest degraded floor if content gap) | SQL assertion on metadata.estimated_total_min vs requested budget |
| 9b | State-focus sessions (non-endless): total duration falls strictly within the requested range | SQL assertion: `bracket_min ≤ estimated_total_min ≤ bracket_max` |
| 9c | State-focus sessions (endless): `metadata.estimated_total_min IS NULL`; `practice.mode = 'open_ended'`; `practice.duration_minutes IS NULL` | Smoke assertion on endless paths |
| 9d | `getAvailableDurations` consistency: no `available` bracket should ever produce a session outside its bounds | Smoke test: for every focus × level × available bracket, generate 10 sessions, assert all 10 fall within bounds |
| 9e | Phase names in API response use user-facing terms for state focuses (`centering` / `practice` / `reflection`); body-focus phases never use those names | Smoke test |

**Spot-check queries (run by Prashob post-build):**

```sql
-- Generate a session for biceps from home, 30 min, beginner user (Prashob's account)
SELECT generate_session(user_id := <prashob_id>, focus_slug := 'biceps', entry_point := 'home', time_budget_min := 30);

-- Verify the focus_overlaps seed has the expected pairs
SELECT fa1.slug AS focus, fa2.slug AS overlaps_with
FROM focus_overlaps fo
JOIN focus_areas fa1 ON fa1.id = fo.focus_id
JOIN focus_areas fa2 ON fa2.id = fo.overlaps_with_id
ORDER BY fa1.slug, fa2.slug;

-- Confirm settle pool is correctly populated and engine picks from it
SELECT name, settle_eligible_for FROM breathwork_techniques
WHERE settle_eligible_for IS NOT NULL AND array_length(settle_eligible_for, 1) > 0
ORDER BY name;

-- Confirm getAvailableDurations matches the reference matrix in Appendix A
-- (run for each (focus, level) and visually compare to the matrix)
```

---

## Sprint 12 ticket breakdown

The engine is real algorithm work. Best to ship in slices that each pass acceptance independently.

| # | Ticket | Scope | Status |
|---|--------|-------|--------|
| **T1** | Schema + seeds: `focus_overlaps`, `user_excluded_exercises`, `exercise_swap_counts`, `sessions.focus_slug`, `breathwork_techniques.settle_eligible_for` | Migration + seeds, idempotent. No engine code. | ✅ SHIPPED |
| **T2** | Engine v1: cross-pillar (home) + body-focus from strength tab + body-focus from yoga tab | Service-layer composer in `server/src/services/suggestionEngine.js`. Body focuses only. | ✅ SHIPPED |
| **T3** | Engine v1: state-focus recipe (initial settle/main/integrate, fixed-budget) | Initial state-focus path. Superseded by T3.5's range-bracket model. | ✅ SHIPPED (contract revised by T3.5) |
| **T3.5** | State-focus contract revision: range brackets + endless mode + UI-facing phase names | Refactor `suggestionEngine.js`. Add `getAvailableDurations` exported function. Update `validateInputs` to accept `time_budget_range` for state focuses. Rewrite state-focus recipe to range-driven composition. Rename phase outputs from settle/main/integrate to centering/practice/reflection. Remove DEGRADED reporting from state focuses. Update smoke test to assert range-bounded outputs and the new phase names. | ⏳ NEXT |
| **T4** | Mobility + Full Body special-case branches | Service-layer special cases per §Mobility / §Full Body. | ⏳ |
| **T5** | Recency warning logic | Implements §Recency. Body focuses only. | ⏳ |
| **T6** | Swap-counter logic + exclusion | Extends swap handler. Adds exclusion endpoints. | ⏳ |
| **T7** | API endpoints: `POST /api/sessions/suggest`, `GET /api/sessions/last?focus=<slug>`, `GET /api/focus/:slug/durations`, "save as routine" | Surface engine over HTTP. Includes `getAvailableDurations` endpoint for the picker. | ⏳ |

**T1 is data-only, no /review needed.**
**T2-T7 each warrant /review.**

T3.5 carries forward most of T3's helpers unchanged:
- `pickSettleTechnique` → renamed to `pickCenteringTechnique`, logic unchanged (same SQL, same pool semantics)
- `loadStateMainPool` → unchanged
- `durationsForLevel` → unchanged
- `fitMainCandidate` → replaced with range-driven `fitPracticeCandidate`
- `generateStateFocus` → renamed to `generateStateFocusSession`, dispatch updated to take `time_budget_range`
- New: `getAvailableDurations` exported helper

Sprint 12 close: chained-branch pattern (s12-t1 → t2 → t3 → t3.5 → t4 → ... → t7 → merge with `sprint-12-close` tag).

---

## Appendix A — `getAvailableDurations` reference matrix

For T3.5 acceptance testing. Expected output of `getAvailableDurations` for every (focus, level) cell, derived from the data audit on Apr 28, 2026.

**Notation:** `A` = available, `L` = locked_by_level (with unlock level in superscript), `E` = empty.

### Beginner level

| Focus | 0–10 min | 10–20 min | 21–30 min | 30–45 min | Endless |
|---|---|---|---|---|---|
| **calm** | A | A | A | E | A |
| **focus** | A | L¹ | L¹ | L² | A |
| **sleep** | A | E | E | E | A |
| **recover** | A | E | E | E | A |
| **energize** | A (Morning Energizer only) | L¹ | L¹ | E | A |

¹ unlocks at intermediate. ² unlocks at advanced.

### Intermediate level

| Focus | 0–10 min | 10–20 min | 21–30 min | 30–45 min | Endless |
|---|---|---|---|---|---|
| **calm** | A | A | A | L² | A |
| **focus** | A | A | A | L² | A |
| **sleep** | A | A | E | E | A |
| **recover** | A | A | E | E | A |
| **energize** | A | A | A | E | A |

### Advanced level

| Focus | 0–10 min | 10–20 min | 21–30 min | 30–45 min | Endless |
|---|---|---|---|---|---|
| **calm** | A | A | A | E | A |
| **focus** | A | A | A | A | A |
| **sleep** | A | A | E | E | A |
| **recover** | A | A | A | E | A |
| **energize** | A | A | A | E | A |

**Total cells:** 5 focuses × 3 levels × 4 numbered brackets + 15 endless = 75.

**Important:** the matrix is best-effort from the data audit. The reference SQL in §getAvailableDurations is the source of truth. If the matrix and SQL disagree, the SQL wins and the matrix gets a follow-up correction. The smoke test must verify every cell against the SQL output.

---

## Followups for FUTURE_SCOPE (post-Sprint-12)

To be added when Sprint 12 ships:

1. **`+1 minute` extend-during-session button (breathwork)** — Prana Breath has this. Mid-session API call extends the current technique by 1 minute or 1 cycle. Small ticket, big UX win.

2. **Settings UI for excluded exercises** — let users see and remove their exclusion list. v2 unless a user asks.

3. **History-aware exercise filtering (anti-recency)** — currently the engine reads recency only for warnings, not for filtering. v2: don't suggest barbell squat 3 days running even within strength sessions. Sprint 14+.

4. **Periodization / auto-deload** — Sprint 15+. Requires intensity tracking we don't have.

5. **Cross-pillar fatigue modeling** — don't suggest hard yoga the day after heavy legs. Sprint 15+.

6. **Engine-side dedup by protocol-ratio (breathwork)** — when the engine has 4 techniques sharing 4-0-8-0 protocol, don't suggest all 4 as "alternatives." S11-T2 v3 follow-up.

7. **Tier-badge UI design** — Foundational / Standard / Caution badge styling. Sprint 14 (composer) work.

8. **Recompute-level cron (FUTURE_SCOPE #137)** — decide based on actual S12 query patterns.

9. **Strength tab 2-hour soft warning** — Sprint 13 UI work.

10. **State-focus → cross-pillar pairing** — currently a state focus produces a state-only session. Future: a "calm" focus could pair with light yoga (yin/restorative). Sprint 14+.

11. **Pillar dim from strength tab when level is "not yet enough data"** — surface "still calibrating your level" copy in v2.

12. **Composer (Sprint 14) inherits from this engine** — composer's "smart default" suggestion uses this exact engine. This spec is the foundation.

13. **Hierarchy-grounded weighted sampling (Sprint 14+, blocked on Sprint 13)** — once Sprint 13 ships `primary_muscles` / `secondary_muscles` / `tertiary_muscles` columns and re-tags all 736 strength exercises, replace v1's uniform sampling with weighted sampling.

14. **Default-bracket selection from history (state focus picker).** Picker default = "largest bracket the user has previously completed" requires reading recent breathwork sessions and mapping their durations to brackets. Sprint 13 picker UI work.

15. **Reflection-phase user prompts.** Currently reflection is a silent timer. UX could show rotating prompts ("notice how you feel now," "set an intention for the next hour"). Sprint 13+ design ticket.

16. **Endless mode session-length defaults.** First-time endless users get centering=2, reflection=2. Returning endless users could inherit their average actual practice duration. Sprint 13+ enrichment.

17. **Energize beginner content gap.** Authoring 2–3 gentle beginner-safe energize techniques unlocks the 10–20 and 21–30 brackets at beginner level. Sprint 13+ content authoring. (Originally FUTURE_SCOPE #144; reframed here as picker-thinness rather than exclusion-throw.)

18. **45–60 min bracket addition.** When content fills the 45+ range for state focuses (currently only Breath Counting reaches 45 at advanced; nothing reaches 60), add a 5th numbered bracket. Decision deferred until content motivates it.

---

*Doc owner: Prashob (CEO/PM) + Claude.ai (Architect).*
*Place this doc in `D:\projects\dailyforge\Trackers\` alongside `S11-T4-level-tracking-spec.md`.*
*This is the canonical Sprint 12 spec. v1 (Apr 28 morning) is in git history if needed.*
*Companion artifact: drives `S12-T1-prompt.md` through `S12-T7-prompt.md`, written separately when each ticket is queued.*
