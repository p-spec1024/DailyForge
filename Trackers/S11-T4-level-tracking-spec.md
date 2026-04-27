# S11-T4 — User Level Tracking Spec

**Author:** Claude.ai (PM/Architect)
**Date:** Apr 27, 2026
**Version:** v1
**Status:** LOCKED. Drives the S11-T4 Claude Code prompt.
**Depends on:** S11-T1 / T1.5 / T2 / T3 (breathwork tagging + focus-area model shipped)
**Blocks:** Sprint 12 (suggestion engine — needs per-pillar level signal)
**Promotes:** FUTURE_SCOPE #34

---

## Purpose

Give the Sprint 12 suggestion engine a way to read a user's level — independently for strength, yoga, and breathwork — so it can:

1. **Filter content** by `difficulty` (don't surface Wim Hof to a breathwork beginner)
2. **Pick within range** using the per-difficulty duration columns shipped in T2
3. **Gate progressions** with auditable, history-grounded reasoning

This ticket is **schema + seed + inference function only**. No cron job, no API endpoint, no UI. Those land in Sprint 12+.

---

## Decisions locked (Apr 27, 2026 planning conversation)

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| 1 | Schema location | New `user_pillar_levels` table | Native `source` field tracks declared/inferred/manual. Per-pillar `updated_at` independent. Audit trail without separate log. |
| 2 | Level value count | 3 (`beginner` / `intermediate` / `advanced`) | Matches existing `breathwork_techniques.difficulty` and `exercises.difficulty`. Engine joins one-to-one. Progress-within-level is a Sprint 12 UI concern, not a data concern. |
| 3 | T4 scope | Schema + inference function (Scope A+) | Function exists for engine to call on demand; cron deferred to S12+ if needed. |
| 4 | Inference thresholds | Research-grounded per §Thresholds | Literature-backed (academic, industry, competitor benchmarks). Risk-asymmetric (under-promote rather than over-promote). |

---

## Schema

One new table, two new functions. No changes to existing tables.

### Table: `user_pillar_levels`

```sql
CREATE TABLE IF NOT EXISTS user_pillar_levels (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pillar      VARCHAR(20) NOT NULL CHECK (pillar IN ('strength', 'yoga', 'breathwork')),
  level       VARCHAR(15) NOT NULL DEFAULT 'beginner' CHECK (level IN ('beginner', 'intermediate', 'advanced')),
  source      VARCHAR(20) NOT NULL DEFAULT 'inferred' CHECK (source IN ('declared', 'inferred', 'manual_override')),
  computed_at TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, pillar)
);

CREATE INDEX IF NOT EXISTS idx_upl_user
  ON user_pillar_levels(user_id);
```

**Field notes:**
- `pillar` — three values, matches the focus-area model from T3 (no cardio per Approach 5).
- `level` — three values, matches `difficulty` in `breathwork_techniques` and `exercises`. Engine queries are one-to-one joins.
- `source` — `'declared'` (user said so in onboarding), `'inferred'` (function computed from history), `'manual_override'` (user changed it in settings). Governs whether the inference function is allowed to overwrite this row — see §Inference Behavior.
- `computed_at` — last time inference ran on this row. NULL for declared / manual_override rows that have never been re-inferred.
- `UNIQUE(user_id, pillar)` — exactly one row per user per pillar.

### Function: `recompute_user_pillar_level(user_id, pillar)`

PL/pgSQL function. Reads the user's history for one pillar, applies the threshold rules, and updates `user_pillar_levels` accordingly.

**Signature:**
```sql
CREATE OR REPLACE FUNCTION recompute_user_pillar_level(
  p_user_id INT,
  p_pillar VARCHAR(20)
)
RETURNS user_pillar_levels
LANGUAGE plpgsql
```

**Behavior:**
1. If a row exists with `source = 'declared'` or `source = 'manual_override'`, return it unchanged. **Never overwrite user-stated levels.**
2. Otherwise compute the level per the threshold rules in §Thresholds.
3. UPSERT the row with `source = 'inferred'`, `computed_at = NOW()`, `level = <computed>`.
4. Return the row.

### Function: `recompute_all_user_pillar_levels(user_id)`

Convenience wrapper that calls `recompute_user_pillar_level` for all three pillars. Returns a setof rows.

```sql
CREATE OR REPLACE FUNCTION recompute_all_user_pillar_levels(p_user_id INT)
RETURNS SETOF user_pillar_levels
LANGUAGE plpgsql
```

---

## Thresholds

Research-grounded thresholds. Three rules apply to all three pillars:

1. **Default = `beginner`.** Every user starts here.
2. **Time-on-task floor.** Promotion to intermediate or advanced requires both a count threshold AND a wall-clock duration threshold. This blocks the "30 sessions in 30 days" loophole that academic studies repeatedly flag as a misclassification driver.
3. **Risk-asymmetric.** Promotions require multiple signals where reasonable; demotions never happen automatically. The function only ever promotes.

### Strength

**Inputs:**
- Session count: `COUNT(*) FROM sessions WHERE user_id = $1 AND type IN ('strength', '5phase') AND completed = true`
- First session date: `MIN(date) FROM sessions WHERE user_id = $1 AND type IN ('strength', '5phase') AND completed = true`
- Latest bodyweight: `weight_kg FROM body_measurements WHERE user_id = $1 ORDER BY measured_at DESC LIMIT 1`
- Best 1RM per main lift: pulled from `exercise_progress_cache` where `exercise_id` matches a Bench / Squat / Deadlift exercise. (Match by `exercises.name ILIKE` — see §Implementation Notes for exact patterns.)

**Promote to `intermediate` if EITHER:**

- **Path A (volume floor):** session_count ≥ 12 AND weeks_since_first_session ≥ 8
- **Path B (performance gate):** any of:
  - Bench 1RM ≥ 1.0× bodyweight (male) / ≥ 0.65× bodyweight (female)
  - Squat 1RM ≥ 1.25× bodyweight (male) / ≥ 1.0× bodyweight (female)
  - Deadlift 1RM ≥ 1.5× bodyweight (male) / ≥ 1.25× bodyweight (female)

**Promote to `advanced` if BOTH:**

- session_count ≥ 50 AND weeks_since_first_session ≥ 78 (≈18 months)
- AND any of:
  - Bench 1RM ≥ 1.5× bodyweight (male) / ≥ 1.0× bodyweight (female)
  - Squat 1RM ≥ 1.75× bodyweight (male) / ≥ 1.5× bodyweight (female)
  - Deadlift 1RM ≥ 2.0× bodyweight (male) / ≥ 1.75× bodyweight (female)

**Sex handling for v1:** `users` table has no `sex` column today (verify in pre-flight). Until that column exists, the function uses **male thresholds for everyone**. This is a deliberate v1 simplification — it under-promotes some female users (slower path to intermediate) but never over-promotes anyone, preserving the risk-asymmetric principle. See §FUTURE_SCOPE Followups.

**Bodyweight handling:** if the user has no `body_measurements` rows, Path B (performance gate) cannot fire. Falls back to Path A (volume floor) only. This is acceptable — a user who doesn't log bodyweight just gets a slightly slower promotion path.

**Why these numbers:** consolidated from ExRx.net standards, StrengthLevel.com aggregated data (153M+ logged lifts), Legion Athletics, Jeff Nippard's research synthesis, Santos-Junior 2021 academic classification, and Hevy's published Strength Level feature. Every credible source uses bodyweight-relative ratios; pure session-count classification is rejected by the literature.

### Yoga

**Inputs:**
- Session count: `COUNT(*) FROM sessions WHERE user_id = $1 AND type = 'yoga' AND completed = true`
- First session date: `MIN(date) FROM sessions WHERE user_id = $1 AND type = 'yoga' AND completed = true`

**Promote to `intermediate` if:**
- session_count ≥ 25 AND weeks_since_first_session ≥ 12

**Promote to `advanced` if:**
- session_count ≥ 100 AND weeks_since_first_session ≥ 78 (≈18 months)

**Why no skill gate:** the contemporary yoga literature actively rejects pose-based level classification ("can do crow pose ≠ intermediate"). The signals that genuinely distinguish levels are breath-movement coordination and class-type self-selection, neither of which is detectable from app data today. Frequency-over-time is the cleanest signal available. FUTURE_SCOPE #33 (pose prerequisites) would later enable a skill gate; revisit when that ships.

### Breathwork

**Inputs:**
- Session count: `COUNT(*) FROM breathwork_sessions WHERE user_id = $1 AND completed = true`
- First session date: `MIN(created_at::date) FROM breathwork_sessions WHERE user_id = $1 AND completed = true`
- Distinct intermediate-tier completions: `COUNT(DISTINCT bs.technique_id) FROM breathwork_sessions bs JOIN breathwork_techniques bt ON bt.id = bs.technique_id WHERE bs.user_id = $1 AND bs.completed = true AND bt.difficulty = 'intermediate'`
- Total intermediate-tier sessions (count, not distinct): same query without DISTINCT
- Distinct advanced-tier completions: same pattern with `bt.difficulty = 'advanced'`
- Total advanced-tier sessions: count without DISTINCT
- Weeks since first intermediate-tier completion: `MIN(created_at::date) FROM ... WHERE bt.difficulty = 'intermediate'`

**Promote to `intermediate` if EITHER:**

- **Path A (technique exposure):** total intermediate-tier sessions ≥ 8 across at least 2 distinct intermediate techniques
- **Path B (volume floor):** session_count ≥ 30 AND weeks_since_first_session ≥ 12

**Promote to `advanced` if ALL:**

- total advanced-tier sessions ≥ 5 across at least 2 distinct advanced techniques
- AND weeks_since_first_intermediate_completion ≥ 12

**Why technique-based:** breathwork is the only pillar where the content's own difficulty tag is the cleanest signal of practitioner level. A user who has successfully completed Wim Hof 5 times is functionally advanced regardless of total session count. The literature is unanimous that advanced breathwork (Wim Hof, Bhastrika at duration, Kumbhaka, Tummo, Holotropic) requires real preparation — a session-count-only gate would let beginners hit "advanced" via 40 box-breathing sessions, which the literature explicitly warns against.

**`completed = true` matters:** the function only counts sessions where the user actually finished. Half-bailed sessions don't accrue toward level promotion.

---

## Inference behavior

The `recompute_user_pillar_level` function:

1. **Reads the existing row** (if any) for `(user_id, pillar)`.
2. **If `source IN ('declared', 'manual_override')`:** returns the existing row unchanged. The user has stated their level explicitly; the inference function defers to that.
3. **Otherwise:** computes the level by applying the rules above in **promotion-only fashion**:
   - Compute the appropriate level given current history.
   - If the computed level is the same as the existing level → UPDATE only `computed_at` to NOW().
   - If the computed level is **higher** than the existing level (beginner→intermediate, intermediate→advanced, beginner→advanced) → UPDATE `level`, `source = 'inferred'`, `computed_at = NOW()`, `updated_at = NOW()`.
   - If the computed level is **lower** than the existing level → return existing row unchanged. **The function never demotes.** A user temporarily inactive isn't suddenly a beginner again.
4. **If no row exists:** INSERT with computed level (defaulting to `beginner` if the user has zero history), `source = 'inferred'`, both timestamps NOW().

The `recompute_all_user_pillar_levels` wrapper just iterates over the three pillar values and calls the single-pillar function for each.

---

## Backfill

Once the migration ships and the functions are in place, **the seed script runs `recompute_all_user_pillar_levels` for every existing user.**

This produces one inferred row per user per pillar based on their full historical data. Users with no history get three `beginner` rows (the default). Users with substantial history get appropriately promoted rows.

The seed prints a summary at the end:

```
Backfill complete:
  Users processed: <N>
  Pillar-level rows inserted: <3N>
  Distribution:
    strength    beginner=<a>  intermediate=<b>  advanced=<c>
    yoga        beginner=<a>  intermediate=<b>  advanced=<c>
    breathwork  beginner=<a>  intermediate=<b>  advanced=<c>
```

For Prashob's dogfood account specifically, the spec expects rows to be present after backfill. Spot-check post-deploy to confirm levels look right against actual training history.

---

## Implementation notes

### Identifying the main strength lifts

The performance gate looks at Bench / Squat / Deadlift 1RMs. Identify these via name pattern matching against the `exercises` table:

```sql
-- Bench: matches "Bench Press (Barbell)", "Barbell Bench Press", etc.
WHERE name ILIKE '%bench press%' AND name NOT ILIKE '%dumbbell%' AND name NOT ILIKE '%incline%' AND name NOT ILIKE '%decline%'
-- Squat: matches "Squat (Barbell)", "Barbell Back Squat", etc.
WHERE name ILIKE '%squat%' AND name ILIKE '%barbell%' AND name NOT ILIKE '%front%' AND name NOT ILIKE '%goblet%'
-- Deadlift: matches "Deadlift (Barbell)", "Conventional Deadlift", etc.
WHERE name ILIKE '%deadlift%' AND name NOT ILIKE '%romanian%' AND name NOT ILIKE '%stiff%' AND name NOT ILIKE '%sumo%'
```

**Pre-flight:** verify these patterns match exactly the exercises Prashob has logged. If not, adjust the patterns. The 1RMs are read from `exercise_progress_cache.estimated_1rm` (already computed and cached per APP_AUDIT).

If multiple matching exercises exist, take the MAX 1RM across them.

### Handling 5-phase sessions in strength count

Per FUTURE_SCOPE #113, sessions where `type = '5phase'` currently count as strength in analytics. T4 follows the same convention — `type IN ('strength', '5phase')` in the strength count query. This is consistent with how the home page weekly chart treats these sessions.

### Breathwork session counting

Use `breathwork_sessions` table (per APP_AUDIT). Field is `created_at` for session date, `completed` boolean for completion gate.

`breathwork_logs` is the supplementary log table used by the timer; `breathwork_sessions` is the primary history table the function reads from.

---

## Pre-flight checks (Claude Code runs these before authoring migration)

1. **Confirm `users` table has no `sex` column.** If it does exist (i.e. APP_AUDIT is stale), use it. If not, document in spec that sex-specific thresholds default to male.

2. **Confirm `body_measurements.weight_kg` is the column name** (per APP_AUDIT — DECIMAL(5,2)).

3. **Confirm `exercise_progress_cache.estimated_1rm` is populated** for at least one user with strength history. If empty across all users, the performance gate is non-functional and the function falls back to volume-floor only — flag this in the build report.

4. **Verify the strength-lift name patterns** match Prashob's actual logged exercises:
   ```sql
   SELECT id, name FROM exercises WHERE name ILIKE '%bench press%' AND name NOT ILIKE '%dumbbell%' AND name NOT ILIKE '%incline%' AND name NOT ILIKE '%decline%';
   SELECT id, name FROM exercises WHERE name ILIKE '%squat%' AND name ILIKE '%barbell%' AND name NOT ILIKE '%front%' AND name NOT ILIKE '%goblet%';
   SELECT id, name FROM exercises WHERE name ILIKE '%deadlift%' AND name NOT ILIKE '%romanian%' AND name NOT ILIKE '%stiff%' AND name NOT ILIKE '%sumo%';
   ```
   Report results so the patterns can be adjusted before going to function code.

5. **Confirm `breathwork_sessions` table exists** with `completed BOOLEAN` and `technique_id INT` columns (per APP_AUDIT).

---

## Verification queries

The seed script runs these post-backfill and asserts:

```sql
-- Every user has exactly 3 pillar-level rows
SELECT user_id, COUNT(*) AS row_count
FROM user_pillar_levels
GROUP BY user_id
HAVING COUNT(*) <> 3;
-- Expected: 0 rows returned.

-- All rows have valid level and source
SELECT COUNT(*) FROM user_pillar_levels
WHERE level NOT IN ('beginner', 'intermediate', 'advanced')
   OR source NOT IN ('declared', 'inferred', 'manual_override');
-- Expected: 0

-- Distribution sanity check — print but don't assert
SELECT pillar, level, COUNT(*) AS n
FROM user_pillar_levels
GROUP BY pillar, level
ORDER BY pillar, level;

-- Idempotency check — running recompute on a user shouldn't churn the row
-- (i.e. running it twice in succession should leave updated_at unchanged on the second run if level didn't change)
-- Verified by the seed script via test execution on user_id = 1 (or first user).
```

Hard-fail with non-zero exit if any of the assertion queries return unexpected counts.

---

## Out of scope for T4

Explicitly **not** in this ticket:

- Cron job that runs `recompute_all_user_pillar_levels` nightly (S12+ if needed)
- `/api/users/levels` endpoint (S12 — engine integration)
- Flutter UI to display or override level (later sprint)
- Onboarding flow that lets the user declare their initial level (FUTURE_SCOPE #35)
- Pose-prerequisites skill gate for yoga (FUTURE_SCOPE #33)
- Movement-pattern tagging that could enable per-pattern level (FUTURE_SCOPE #41)
- Progress-within-level tracking ("you've done 12 of 20 intermediate yoga sessions to next level") — Sprint 12 UI scope
- `users.sex` column for sex-specific strength thresholds (FUTURE_SCOPE — fold into onboarding)
- Bodyweight coefficient for bodyweight-only exercises (FUTURE_SCOPE #104)
- Demotion logic for inactive users (deliberate omission — promotion-only is the right default)
- Level-change notifications ("congrats, you're now intermediate at strength!")

---

## Acceptance criteria

No device test (no UI surface). Verification is:

1. ✅ `migrate.js` runs cleanly on fresh + existing DB. Idempotent via `IF NOT EXISTS`.
2. ✅ Functions `recompute_user_pillar_level` and `recompute_all_user_pillar_levels` exist and execute without error.
3. ✅ Seed/backfill script runs cleanly, prints distribution summary, all assertions pass.
4. ✅ Idempotency check: running `recompute_all_user_pillar_levels(<user_id>)` twice in succession on the same user produces identical `level` and `source` values; only `computed_at` differs.
5. ✅ User-stated levels (`source IN ('declared', 'manual_override')`) are not overwritten by inference. Test by manually inserting a `declared` row and verifying recompute leaves it unchanged.
6. ✅ Promotion-only behavior: manually setting a user's level to `advanced` and then calling recompute should leave it at `advanced` even if the user's history wouldn't qualify.
7. ✅ Spot-check Prashob's account post-backfill — levels align with actual training history.

8. ✅ No `/review` needed (data + function ticket; spec sanity-checked upstream + assertion queries baked in — same convention as T2 and T3 per Apr 27 process learning).

---

## FUTURE_SCOPE followups

To be added when T4 ships:

1. **Add `users.sex` column** so female-specific strength thresholds can fire. Currently all users get male thresholds. Fold into onboarding work (FUTURE_SCOPE #35).
2. **Cron job for nightly level recomputation** if the engine ends up calling recompute on every home-page load and we want to amortize. Decide based on S12 query patterns.
3. **Yoga pose-prerequisites skill gate** (FUTURE_SCOPE #33 already exists) — once shipped, yoga level promotion can include skill-content path (e.g. "user has held shoulder stand 5+ times").
4. **Bodyweight exercise coefficient** for performance gate (FUTURE_SCOPE #104 already exists) — currently bodyweight-only lifters can never hit the strength performance gate. Adding coefficients lets push-ups and pull-ups contribute.
5. **Level-change events** — when inference promotes a user, emit an event the home page can surface as a "win" (similar to FUTURE_SCOPE #103 streak wins). Drives engagement.
6. **5-phase session classification refinement** — currently `5phase` counts toward strength. Per FUTURE_SCOPE #113, this is up for revision once the 5-phase orchestrator ships.

---

*Doc owner: Prashob (CEO/PM) + Claude.ai (Architect).*
*Place this doc in `D:\projects\dailyforge\Trackers\` alongside `S11-T3-focus-area-spec.md`.*
*Research sources for thresholds: ExRx.net Adult Strength Standards, StrengthLevel.com (153M+ logged lifts), Legion Athletics, Jeff Nippard published synthesis, Santos-Junior 2021 (Classification and Determination Model of Resistance Training Status), Mantra Yoga Pranayama School progression model, contemporary yoga teaching literature on level paradigm critique (YogaUOnline), Hevy app published Strength Level feature.*
