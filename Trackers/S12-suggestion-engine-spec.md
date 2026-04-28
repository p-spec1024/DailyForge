# S12 — Suggestion Engine Spec (Personalization Algorithm)

**Author:** Claude.ai (PM/Architect)
**Date:** Apr 28, 2026
**Version:** v1
**Status:** LOCKED. Drives the Sprint 12 ticket breakdown.
**Depends on:** S11-T1 / T1.5 / T2 / T3 / T4 (Sprint 11 data layer shipped)
**Blocks:** Sprint 13 (home page UI), Sprint 14 (session composer), Sprint 15 (onboarding)
**Related FUTURE_SCOPE:** #119 (adaptive personalization), #124 (suggestion engine — this), #43 (time-of-day breathwork filtering — falls out for free), #118 (custom builders — superseded by #126), #131 (quick tools), #132 (reactive moment surface)

---

## Purpose

Given a user's chosen focus + entry point + (where applicable) time budget, return an ordered, level-appropriate, history-aware session structure the player can execute.

The engine is a **rule-based composer with uniform random sampling**. It is deterministic where it should be (level filtering, role assignment, structural shape) and stochastic where variety helps (which exercises within an eligible pool). It accepts v1 imprecisions (no primary/secondary muscle hierarchy yet, no quality-ranked sampling within pools) in exchange for shipping the simplest thing that works. Both imprecisions resolve together once Sprint 13 ships muscle hierarchy and the engine gains a real, accuracy-grounded weight formula.

This spec covers:
- Algorithm shape and recipe per entry point
- Weighted sampling formula
- History-aware logic (recency warnings, swap-prefs, earned exclusion)
- Time-budget mechanics
- Tier-aware caution / foundational badges
- Mobility / Full Body special cases
- Acceptance criteria + assertion queries
- Sprint 12 ticket breakdown

---

## Decisions locked (Apr 27–28, 2026 planning conversation)

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| 1 | Algorithm shape | Rule-based composer with uniform random sampling within the eligible pool | Smallest thing that works. Auditable. Quality-ranked weighting deferred to Sprint 14+ (after Sprint 13 ships muscle hierarchy). |
| 2 | Variety vs. consistency | Random sampling per generation, with explicit user overrides ("Repeat Last", "Save Session") | Sessions feel alive without being chaotic. Power users get consistency on demand. |
| 3 | History as input (v1) | Two paths only: recency warnings (calendar-day muscle overlap), and swap-counter exclusion. No periodization, no fatigue modeling, no anti-recency exercise filtering. | Each history-rule is a rule we have to debug. Ship deterministic-with-warnings, instrument, layer history when evidence demands it. |
| 4 | Body-focus session shape | Entry-point-determined. Home = cross-pillar (5-phase shaped). Pillar tab = pillar-pure. | Entry point IS the modality choice. No "set a mode" UI needed. |
| 5 | State-focus session shape | Phase-based: Settle → Main → Integrate. 3 phases. Settle technique picked from a small curated pool per state focus (Diaphragmatic always eligible + 1 tonally-matched alternative). | Borrowed from yoga's arrival/practice/savasana shape. More phases re-create the 5-phase shape we don't want. Curated settle pool gives variety + recognizability without authoring risk. |
| 6 | Mobility / Full Body | Service-layer special cases per S11-T3 spec. `mobility` derives from `practice_type IN ('flexibility', 'mobility')`; `full_body` derives from compound-detection (≥3 muscle groups). | Already locked in S11-T3 v1; this spec confirms and operationalizes. |
| 7 | `weight` column | Stays NULL. Engine uses uniform random sampling. Real weighted scoring lands in Sprint 14+ after primary/secondary/tertiary muscle hierarchy ships. | The query-time formula proposed earlier in planning didn't actually fix accuracy — biasing toward compounds makes the bench-press-on-triceps-day bug *worse*. Honest move: ship uniform sampling, fix accuracy properly with hierarchy-grounded weighting. |
| 8 | Primary/secondary muscle hierarchy | Sprint 13 ticket. v1 engine accepts the imprecision. | Pre-launch app, 3 users, no evidence the imprecision matters yet. Hand-tagging 736 exercises is a real cost. |
| 9 | Swap-counter exclusion threshold | 3 swaps away from an exercise → soft prompt | "Earned" exclusion. One bad day shouldn't get an exercise blocklisted. |
| 10 | Recency warning window | Last session of focus within the past 1 calendar day | Matches how users think about training ("trained biceps yesterday"); avoids 48-hour clock arithmetic edge cases. |
| 11 | Tier-aware badges (suggestions vs. composer) | Suggestions: hard-filter by level. Composer: show all, badge by relative tier. | Suggestions protect; composer educates. |
| 12 | Time picker policy | Per-pillar, per-entry-point. See §Time Budget. | Strength doesn't fit a clock; breathwork does. One policy per pillar is wrong. |
| 13 | Save Session implementation | Reuse existing `user_routines` table + routines API | Already shipped. Save = "save as routine" wired through the suggestion-session UI. Zero new server work. |
| 14 | Repeat Last implementation | New endpoint `GET /api/sessions/last?focus=<slug>` | Small. Returns the most recent completed session matching the focus, formatted as a session structure the player can replay. |
| 15 | Hard exclusion storage | New `user_excluded_exercises` table | Triggered only after the 3rd swap. Settings UI to manage exclusion list deferred to v2. |
| 16 | Sex column for strength thresholds | Already a S11-T4 followup (FUTURE_SCOPE #136) | Engine reads `user_pillar_levels.level` directly; T4 will populate sex-aware thresholds when `users.sex` lands. Engine doesn't need to care. |

---

## Inputs

The engine is invoked with:

```
generateSession({
  user_id:         INT,                  -- required
  focus_slug:      VARCHAR,              -- required ('biceps', 'calm', etc.)
  entry_point:     ENUM('home', 'strength_tab', 'yoga_tab', 'breathwork_tab'),  -- required
  time_budget_min: INT NULLABLE          -- nullable (strength tab custom path passes NULL)
})
```

It reads:

- `user_pillar_levels` — the user's three levels (engine queries strength/yoga/breathwork rows independently as needed)
- `focus_areas`, `focus_muscle_keywords`, `focus_content_compatibility` — the focus model from S11-T3
- `breathwork_techniques` — with all 9 tagging columns from S11-T2
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
      "phase": "bookend_open" | "warmup" | "main" | "cooldown" | "bookend_close" | "settle" | "integrate",
      "items": [
        {
          "content_type": "strength" | "yoga" | "breathwork",
          "content_id":   INT,
          "name":         VARCHAR,        // for the player UI
          "duration_minutes": INT NULLABLE,  // breathwork & yoga
          "sets":         INT NULLABLE,      // strength
          "reps":         INT NULLABLE,      // strength
          "tier_badge":   "foundational" | "standard" | "caution" | NULL
        }
      ]
    }
  ],
  "warnings": [
    { "type": "recency_overlap", "message": "...", "alternative_focus": "recover" }
  ],
  "metadata": {
    "estimated_total_min": INT,
    "user_levels": { "strength": "beginner", "yoga": "beginner", "breathwork": "beginner" }
  }
}
```

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

The state-focus settle phase picks from a curated pool of beginner-safe techniques tonally matched to the focus. Stored as a TEXT[] of state-focus slugs the technique is eligible to open.

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

All 5 alternatives are beginner-tier in S11-T2 tagging, so the engine never serves an above-level settle technique.

### No other changes to existing tables.

Everything else lives in queries / functions.

---

## Time budget

| Entry point | Picker | Options shown |
|---|---|---|
| Home (cross-pillar) | Yes | Standard · 30 min · Long · 60 min |
| Strength tab → suggested session | Yes | Standard · 30 min · Long · 60 min |
| Strength tab → custom workout | No | Soft warning at 2 hours elapsed |
| Yoga tab → suggested session | Yes | Quick · 15 min · Short · 30 min · Standard · 45 min · Long · 60 min |
| Yoga tab → custom workout | No | (user's own selections determine length) |
| Breathwork tab → suggested session | Yes | Quick · 3 min · Short · 10 min · Standard · 20 min · Long · 30 min |
| Breathwork tab → custom workout | No | (user picks technique + technique's own duration) |

**UI rendering of pickers (Sprint 13 work, recorded here for traceability):**
- Each option displays as `<icon> <Label> · <N> min` on one row.
- Label words ("Quick", "Short", "Standard", "Long") communicate *intent*; numbers communicate *cost*. Both visible at decision time.
- Default selected option per entry point: **Standard** (the middle option). Reasoning: median user, median session.

**Cross-pillar (home) duration math:**
- 30 min = 3 min bookend_open + 3 min warmup + 18 min main + 3 min cooldown + 3 min bookend_close
- 60 min = 5 min bookend_open + 5 min warmup + 40 min main + 5 min cooldown + 5 min bookend_close

The engine sizes phases and picks within them according to the recipes below.

---

## Recipes — body focus from home (cross-pillar)

User picks a body focus (any of: chest, back, shoulders, biceps, triceps, core, glutes, quads, hamstrings, calves, mobility, full_body).

**Inputs:** focus_slug, time_budget (30 or 60), user_id, levels.

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
           AND bt.difficulty <= $breathwork_level   -- string comparison via order map
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

**Inputs:** focus_slug (any body focus except `mobility` — mobility is hidden from strength tab), time_budget (30 or 60), user_id, strength_level.

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
     5 at budget 30   -- more exercises since no warmup/cooldown phases
     8 at budget 60
   picked_set = RANDOM_PICK_N(eligible, picked_count)
   sets_per_exercise = 3 (beginner) | 4 (intermediate) | 4 (advanced)

   Optional: prepend a brief 1-2 min strength-warmup recommendation (not from data — a hardcoded hint:
     "Spend 1-2 min warming up the target muscles before set 1."). Decision: NO for v1. The engine
     produces the strength session as-is; pre-session warmup is a UI text block, not engine output.

4. RETURN {session_shape: 'pillar_pure', phases: [{phase: 'main', items}], warnings, metadata}
```

**Custom workout path (no engine):** user enters `EmptyWorkout` flow as it exists today. Engine is not invoked. Only mechanical addition: soft warning at 2-hour elapsed time (FUTURE_SCOPE — Sprint 13 ticket).

---

## Recipes — body focus from yoga tab

**Inputs:** focus_slug (any body focus — yoga tab supports all 12 including mobility and full_body), time_budget (15/30/45/60), user_id, yoga_level.

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

## Recipes — state focus (any entry point that supports it)

**Entry points that support state focuses:**
- Home (cross-pillar) — but state focuses from home generate a state-only session, NOT a 5-phase session. Reasoning: a "calm" session isn't a strength workout with calming bookends; it IS the calming work. The cross-pillar shape is for body focuses only.
- Breathwork tab

**Inputs:** focus_slug (energize, calm, focus, sleep, recover), time_budget (3/10/20/30 from breathwork tab; 30/60 from home), user_id, breathwork_level.

**Algorithm:**

```
1. RECENCY OVERLAP CHECK — DOES NOT APPLY to state focuses.
   "Calm yesterday, calm today" is fine, even ideal. Skip the overlap check entirely for state focuses.

2. RESOLVE LEVEL — only need breathwork_level.

3. ASSEMBLE 3-PHASE SESSION (Settle → Main → Integrate)

   3a. SETTLE (1-3 min, picked from curated pool per state focus)
       eligible = SELECT bt.* FROM breathwork_techniques bt
         WHERE $focus_slug = ANY(bt.settle_eligible_for)
           AND bt.difficulty <= $breathwork_level   -- always 'beginner' for v1 settle pool
           AND bt.id NOT IN excluded
       picked = RANDOM_PICK(eligible)
       -- Diaphragmatic is always in the pool, so eligible is never empty
       duration = MIN(3, time_budget * 0.10)
       For 3-min total budget: settle = 0.5 min (rounded to 1)
       For 30-min total budget: settle = 3 min

   3b. MAIN (variable, fills the bulk of the budget)
       eligible = SELECT bt.* FROM focus_content_compatibility fcc
         JOIN focus_areas fa ON fa.id = fcc.focus_id
         JOIN breathwork_techniques bt ON bt.id = fcc.content_id
         WHERE fa.slug = $focus_slug
           AND fcc.role = 'main'
           AND fcc.content_type = 'breathwork'
           AND bt.difficulty <= $breathwork_level
           AND bt.standalone_compatible = true
           AND bt.id NOT IN excluded
       picked = RANDOM_PICK(eligible)
       duration = CLAMP(time_budget - settle - integrate, picked.<level>_duration_min, picked.<level>_duration_max)
       IF picked.<level>_duration_max < (time_budget - settle - integrate):
         -- technique can't fill the budget; pick a second main back-to-back OR shorten the budget
         -- Decision for v1: shorten the actual session to (settle + picked_max + integrate)
         -- and surface in metadata.actual_total_min so UI can show the real length
       IF picked.<level>_duration_min > (time_budget - settle - integrate):
         -- technique requires more time than budget allows; this picked tech was wrong, retry pick
         -- Engine retries up to 3 times; if no fit, falls back to lowest-min-duration tech in pool

   3c. INTEGRATE (1-3 min, no technique)
       This is silent observed-breathing time. No technique row. The player UI displays a timer + prompt.
       duration = MIN(3, time_budget * 0.10) — symmetric with settle.

4. RETURN {session_shape: 'state_focus', phases: [settle, main, integrate], warnings: [], metadata}
```

**Why a curated settle pool (not always-the-same):** Diaphragmatic Breathing is always eligible across all 5 focuses, so the user gets recognizability — most sessions still open with it. But each state focus also has one tonally-matched alternative (Sama Vritti for calm, Box for focus, Coherent for energize, Three-Part for sleep/recover), so the engine can vary the opener when sampling lands there. Best of both: ritual + variety. The pool is small (2 per focus) so it stays consistent enough to feel ritual-like.

**Cross-pillar entry from home with state focus selected:** treat as state-focus path (above). Home's "cross-pillar" shape is conditioned on body focuses; state focuses always produce state sessions.

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

**Engine still produces the session.** UI decides how to render the warning (soft inline note per locked decision).

**Prerequisite — `sessions.focus_slug` column:**
This column does not exist today. The S12-T1 migration adds it:

```sql
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS focus_slug VARCHAR(40);
CREATE INDEX IF NOT EXISTS idx_sessions_user_focus_date
  ON sessions(user_id, focus_slug, date)
  WHERE completed = true;
```

The engine writes `focus_slug` to a session when it's created from a suggestion. Custom workouts (`EmptyWorkout`) leave `focus_slug = NULL` and are excluded from the recency check (no harm — they don't have a declared focus).

**Backfill:** existing rows stay NULL. Recency check sees no historical focuses for the existing 3 users, which is fine.

---

## Swap-counter mechanics

**Trigger:** every time `AlternativePicker` resolves to a swap (existing UI flow).

**Server logic (existing endpoint extended):**

```sql
-- inside the swap handler:

INSERT INTO exercise_swap_counts (user_id, exercise_id, swap_count, last_swapped_at)
VALUES ($1, $2, 1, NOW())
ON CONFLICT (user_id, exercise_id)
DO UPDATE SET
  swap_count = exercise_swap_counts.swap_count + 1,
  last_swapped_at = NOW();

-- then check if we should prompt:

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

**No Settings UI for managing exclusions in v1.** A user who excludes by mistake reaches out via support OR we add a Settings screen in Sprint 14+ if anyone asks. (FUTURE_SCOPE entry — see §Followups.)

---

## Tier-aware badges

The engine surfaces badges in two places:

**Suggestion path:** all items pre-filtered by `difficulty <= user_level`. So:
- Items at user's level → no badge.
- Items below user's level → no badge in suggestion UI either (it would clutter; the user opted into a suggestion, they trust the engine).

**Composer path (Sprint 14):** all items visible regardless of user level. So:
- Below user level → "Foundational" badge
- At user level → "Standard" badge
- Above user level → "Caution" badge

The composer is where badges earn their keep. Suggestions stay clean.

**Implementation:** the engine returns `tier_badge` per item even on the suggestion path; UI decides whether to render. Ships once, used by both surfaces.

---

## Mobility — special case

`mobility` is a body focus (`focus_type='body'`) but doesn't map cleanly to the muscle-keyword model.

**Strength-tab behavior:** `mobility` is **hidden from the strength tab focus picker**. There's no "mobility-only strength session" worth recommending.

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

**Compound detection:** `full_body` exercises are those where `array_length(target_muscles, 1) >= 3`. This is computed at query time:

```sql
WHERE array_length(target_muscles, 1) >= 3
```

**Yoga full-body:** same rule applied to yoga rows — sequences that hit 3+ muscle groups.

**Strength tab + full_body:** standard strength session, just with the `full_body` filter instead of muscle-keyword filter. 5 picks at budget 30, 8 at budget 60.

**Yoga tab + full_body:** standard yoga session with the same filter.

**Home cross-pillar + full_body:** standard cross-pillar shape, with both yoga-warmup/cooldown and strength-main using the compound filter. This produces the most "5-phase shaped" session of any focus — full-body is the spiritual home of the original 5-phase concept.

---

## Acceptance criteria

| # | Test | Verification |
|---|------|--------------|
| 1 | Engine produces a non-empty session for every (focus, entry_point, level) combination Prashob's account can hit | Smoke test: loop through all 17 focuses × all valid entry points × beginner level → assert phases array non-empty |
| 2 | All items returned have `difficulty <= user_level` for that pillar | SQL assertion in test |
| 3 | No item appears in `user_excluded_exercises` for that user | SQL assertion |
| 4 | Bookends only appear in cross-pillar sessions, never in pillar-pure | SQL assertion grouped by session_shape |
| 5 | Settle phase technique is always in the curated pool for that state focus (`$focus_slug = ANY(bt.settle_eligible_for)`) | SQL assertion on state_focus sessions: settle technique's `settle_eligible_for` array contains the session's focus_slug |
| 6 | `focus_overlaps` seed produces expected adjacency for known cases (chest↔triceps, back↔biceps, etc.) | Spot-check queries below |
| 7 | Recency warning fires when last session is yesterday and matches focus or overlap | Test fixture: insert a session at yesterday's date, run engine, assert warning |
| 8 | 3rd swap of an exercise sets `prompt_state` correctly | Test: simulate 3 swaps of an exercise_id, assert exercise_swap_counts.swap_count = 3 AND should_prompt = true |
| 9 | Total session duration ≈ time_budget (within 10%) | SQL assertion on metadata.estimated_total_min vs requested budget |

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

-- Expected pairs (12 rows total — each pair stored as 2 directional rows):
-- chest ↔ triceps, chest ↔ shoulders
-- back ↔ biceps
-- shoulders ↔ chest, shoulders ↔ triceps
-- biceps ↔ back
-- triceps ↔ chest, triceps ↔ shoulders
-- quads ↔ glutes
-- glutes ↔ quads, glutes ↔ hamstrings
-- hamstrings ↔ glutes
-- core: no overlaps (it's its own thing)
-- calves: no overlaps
-- mobility, full_body: no overlaps (excluded — they don't fatigue specific muscles)

-- Confirm settle pool is correctly populated and engine picks from it
-- (run engine for all 5 state focuses at all levels; for each settle phase, verify the picked
--  technique's settle_eligible_for array contains the session focus_slug)
SELECT name, settle_eligible_for FROM breathwork_techniques
WHERE settle_eligible_for IS NOT NULL AND array_length(settle_eligible_for, 1) > 0
ORDER BY name;
-- Expected: 5 rows (Diaphragmatic, Sama Vritti, Three-Part, Coherent, Box) per the seed table.

-- Confirm swap-count increment works
-- (manual test: log a session, swap an exercise, swap again, swap third time, check should_prompt)
```

---

## Sprint 12 ticket breakdown

The engine is real algorithm work. Best to ship in slices that each pass acceptance independently.

| # | Ticket | Scope | Acceptance |
|---|--------|-------|------------|
| **T1** | Schema + seeds: `focus_overlaps`, `user_excluded_exercises`, `exercise_swap_counts`, `sessions.focus_slug` column, `breathwork_techniques.settle_eligible_for` column + seed | Migration, seed for `focus_overlaps` (12 rows), seed for `settle_eligible_for` (5 techniques per §Schema seed table), idempotent. No engine code yet. | Tables exist, focus_overlaps has 12 rows, settle_eligible_for populated on exactly 5 techniques (Diaphragmatic / Sama Vritti / Three-Part / Coherent / Box), sessions.focus_slug column nullable on existing rows |
| **T2** | Engine v1: cross-pillar (home) recipe + body-focus from strength tab + body-focus from yoga tab | Service-layer composer in `server/src/services/suggestionEngine.js`. No state-focus path yet. No swap-counter logic. No exclusion. Reads `user_pillar_levels`, `focus_areas`, `focus_muscle_keywords`, `focus_content_compatibility`, `breathwork_techniques`, `exercises`. | Smoke test passes for 12 body focuses × 3 entry points × budget 30. Prashob runs against his account, eyeballs sessions. |
| **T3** | Engine v1: state-focus recipe (Settle/Main/Integrate) | Adds state-focus path to the engine. | Smoke test passes for 5 state focuses × 4 budgets. Settle technique always passes the `$focus_slug = ANY(bt.settle_eligible_for)` check. |
| **T4** | Mobility + Full Body special-case branches | Adds the two service-layer special cases per §Special Cases. | Smoke test passes for mobility from yoga tab and home; full_body from all three entry points. |
| **T5** | Recency warning logic | Implements §Recency Overlap. Detection query, warning emission. Wires `sessions.focus_slug` write on session start. | Test fixture (insert yesterday's chest session, query for triceps today) → warning emitted. |
| **T6** | Swap-counter logic + exclusion | Extends the existing swap handler to increment `exercise_swap_counts`. Adds `/api/exercises/:id/exclude` and `/keep-suggesting`. Wires the prompt response. | Manual test: 3 swaps of an exercise → response includes `should_prompt: true`. Tap exclude → exercise no longer in subsequent engine output. |
| **T7** | API endpoints: `POST /api/sessions/suggest`, `GET /api/sessions/last?focus=<slug>`, "save as routine" wired through suggestion UI | Surface the engine over HTTP. Repeat-Last endpoint. | Postman / curl tests for all 3 endpoints. |

**T1 is data-only, no /review needed (per Apr 27 process learning).**
**T2-T7 each warrant /review** — these are real logic with non-trivial edge cases.

Sprint 12 close: chained-branch pattern (s12-t1 base → t2 → ... → t7 → merge with `sprint-12-close` tag), matching Sprints 10 and 11.

---

## Followups for FUTURE_SCOPE (post-Sprint-12)

To be added when Sprint 12 ships:

1. **`+1 minute` extend-during-session button (breathwork)** — Prana Breath has this; users would love it. Mid-session API call extends the current technique by 1 minute or 1 cycle, whichever the technique uses. Small ticket, big UX win.

2. **Settings UI for excluded exercises** — let users see and remove their exclusion list. Defer to v2 unless a user asks.

3. **History-aware exercise filtering (anti-recency)** — currently the engine reads recency only for warnings, not for filtering. v2: don't suggest barbell squat 3 days running even within strength sessions. Requires per-exercise last-used tracking. Sprint 14+.

4. **Periodization / auto-deload** — auto-suggest a deload week every N hard weeks. Sprint 15+. Requires intensity tracking we don't have.

5. **Cross-pillar fatigue modeling** — don't suggest hard yoga the day after heavy legs. Sprint 15+. Requires session-load metric.

6. **Engine-side dedup by protocol-ratio (breathwork)** — when the engine has 4 techniques sharing 4-0-8-0 protocol, don't suggest all 4 as "alternatives." Carries forward from S11-T2 v3 follow-up #5.

7. **Tier-badge UI design** — Foundational / Standard / Caution badge styling. Sprint 14 (composer) work. Locked structure here; visual design TBD.

8. **Recompute-level cron (FUTURE_SCOPE #137 already exists)** — if the engine calls `recompute_all_user_pillar_levels` on every home page load, it gets expensive. Decide based on actual S12 query patterns once the engine is wired up.

9. **Strength tab 2-hour soft warning** — "Long session — make sure you're recovering well." Not engine work; Sprint 13 UI work but logged here for traceability.

10. **State-focus → cross-pillar pairing** — currently a state focus produces a state-only session. Future: a "calm" focus could pair with light yoga (yin/restorative) or light strength (mobility). Requires curating yoga + strength rows for state focuses in `focus_content_compatibility`. Sprint 14+.

11. **Pillar dim from strength tab when level is "not yet enough data"** — currently if a user has zero strength sessions, the engine still defaults their level to beginner and produces a session. We may want to surface "still calibrating your level" copy in v2.

12. **Composer (Sprint 14) inherits from this engine** — the composer's "smart default" suggestion uses this exact engine. Composer just lets the user edit the result. This spec is the foundation.

13. **Hierarchy-grounded weighted sampling (Sprint 14+, blocked on Sprint 13)** — once Sprint 13 ships `primary_muscles` / `secondary_muscles` / `tertiary_muscles` columns and re-tags all 736 strength exercises, replace v1's uniform sampling with weighted sampling: weight 1.0 if focus muscle is primary, 0.5 if secondary, 0.2 if tertiary. This is the *real* fix for the bench-press-on-triceps-day class of bug. The v1 query-time weight formula proposed during planning was withdrawn because it did not address this and could make accuracy worse. The `focus_content_compatibility.weight` column can be retired or repurposed at that point.

---

*Doc owner: Prashob (CEO/PM) + Claude.ai (Architect).*
*Place this doc in `D:\projects\dailyforge\Trackers\` alongside `S11-T4-level-tracking-spec.md`.*
*Companion artifact: this spec drives `S12-T1-prompt.md` through `S12-T7-prompt.md`, written separately when each ticket is queued.*
