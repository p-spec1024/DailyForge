# S12-T4 — Mobility + Full Body Special-Case Branches Spec

**Author:** Claude.ai (PM/Architect)
**Date:** Apr 29, 2026
**Version:** v1
**Status:** LOCKED. Drives the Claude Code execution prompt.
**Depends on:** S12-T1 (schema + seeds), S12-T2 (body-focus paths), S12-T3 (state-focus path), S12-T3.5 (state-focus refactor — branch base)
**Branch:** `s12-t4` off `s12-t3.5`
**Blocks:** S12-T7 (HTTP surface — needs all special-case throws settled before route validation can be written).

---

## Why this ticket exists

T2 shipped the body-focus path for the **10 keyworded body focuses** (chest, back, shoulders, biceps, triceps, core, glutes, quads, hamstrings, calves). For the two non-keyworded body focuses — `mobility` and `full_body` — T2 throws `NotImplementedError` with explicit T4 hand-off messages. This was a deliberate scope cut: those two focuses don't map to `focus_muscle_keywords` and need their own query paths per the master spec's §Mobility and §Full Body special-case sections.

T4 replaces those throws with the two real branches.

Critically: **this is a refactor, not a rewrite.** T2's helpers (level resolution, recency check, bookend selection, picked-set assembly, tier-badge handling, exclusion filter) all carry forward. What changes is the **content-eligibility predicate** for warmup / main / cooldown phases when the focus is `mobility` or `full_body`. Bookends, recency, levels, throws-for-out-of-scope tabs — unchanged.

---

## Decisions locked (Apr 29, 2026 spec)

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| 1 | Route-or-special-case the body recipes? | **Route at the top of each body recipe.** The home / strength_tab / yoga_tab handlers each contain a small `if (focus_slug === 'mobility')` / `else if (focus_slug === 'full_body')` block that swaps in the correct eligibility query, then falls through to the shared phase-assembly / picked-set / metadata code. | Mobility and full_body share most of the recipe with keyworded body focuses (level resolve, recency, bookends for home, exclusion filter, sets/reps for strength). A separate `mobility_special_case_path()` would duplicate ~70% of T2's code. Routing inline keeps the diff small and reuses the already-reviewed scaffolding. |
| 2 | What if the strength-main pool for `mobility` from home is empty? | **The strength-main phase is skipped (omitted from the phases array).** Time-budget reallocation is **deferred** — strength-main minutes simply disappear from the session total. Engine returns `metadata.estimated_total_min` honestly reflecting the shortfall. | The master spec line 668 says "time budget reallocates: the strength-main slot's duration goes to extending the yoga main." That's a duration-reallocation logic block we don't have today and don't need for v1. Honest under-delivery (with metadata exposing it) is acceptable v1 behavior; reallocation is a Sprint 13+ refinement. Filed as a FUTURE_SCOPE followup. |
| 3 | Strength-tab `mobility` — hide or throw? | **Throw `RangeError('mobility is not available from strength_tab — use yoga_tab or home')`.** Mirrors T2/T3 throw symmetry. The "mobility hidden from strength tab" UX is a Sprint 13+ picker concern; the engine refuses the call. | Symmetric with T2's existing throws (`state focus from body-only tabs`, `body focus from breathwork_tab`) and T3.5's `RangeError`s. Scope is locked; no silent fallthrough. The picker UI shouldn't offer this combination, but the engine asserting the contract is the second line of defense. |
| 4 | Compound-detection threshold for `full_body` | **`array_length(target_muscles, 1) >= 3`** for both strength and yoga rows. | Direct from master spec line 678 and 684. Compound = hits 3+ muscle groups. T2 surfaced that `exercises.target_muscles` is a text column, not an array (header comment on T2's helpers). T4 keeps this header comment honest by computing length via the same approach T2 uses for keyword overlap. See §Implementation Notes. |
| 5 | `full_body` warmup practice-type filter from home | **No practice-type restriction.** Eligible = yoga rows where target_muscles length ≥ 3 AND difficulty ≤ yoga_level AND id NOT IN excluded. | Master spec line 290 specifies no practice-type restriction for home full_body warmup. The yoga-tab full_body warmup at line 409 *does* add `practice_type contains 'mobility'`; that's a yoga-tab-only refinement. Decision: preserve the spec asymmetry as-written. (Yoga-tab full_body warmup wants a "moving" feel; home full_body's bookend_open already provides arrival, so warmup can be any compound yoga.) |
| 6 | Bookend rows for `mobility` and `full_body` in `focus_content_compatibility` | **Assume they exist.** The S11-T3 close-out note states "54 rows, all role-tagged" across all 17 focuses. T4's smoke pre-flight asserts that bookend_open and bookend_close rows exist for both `mobility` and `full_body`. If a row is missing, the smoke fails — this is a data-layer bug to fix in Sprint 11 territory, not a T4 fallback. | Pre-flight catches drift. No silent degradation. |
| 7 | Yoga-main "duplicate avoidance" between warmup and main | **Carry forward T2's existing rule: `id NOT IN warmup picked_set`** is enforced in the cooldown query, not the main query. Main can overlap with warmup (rare, but allowed). | T2 already implements this for the keyworded body focuses. T4 doesn't change it. |
| 8 | Tier badges for mobility/full_body | **Same as T2.** All items have `difficulty <= user_level` by filter, so suggestion-path `tier_badge` is `NULL` (or `foundational` if strictly less; suggestion path skips rendering). Composer territory is Sprint 14. | Unchanged from T2. |
| 9 | Smoke-test scope | **Full coverage of the two focuses across all valid entry points.** Mobility from home + yoga_tab (2 combos × 1 budget for home, × 4 budgets for yoga_tab = 6 cases). Full_body from home + strength_tab + yoga_tab (1 + 2 + 4 = 7 cases). Plus 4 throws (mobility from strength_tab, mobility from breathwork_tab, full_body from breathwork_tab, plus carry-forward T2/T3 throws unchanged). | Acceptance criterion #1 from master spec: "Smoke test passes for mobility from yoga tab and home; full_body from all three entry points." Adds throw coverage for the locked-out tab combinations. |
| 10 | Empty-pool fallback for keyworded body focuses (T2 behavior) | **Carry forward unchanged.** T2 has fallback handling for tiny-pool cases (e.g., biceps yoga = 1 pose); T4 doesn't touch that. | T4 only modifies the `mobility` and `full_body` branches. |
| 11 | When the mobility strength-main pool returns at least one row | **Use it.** The engine includes the strength-main phase with the picked set. The spec says "rare; likely empty" but doesn't say "always empty" — if `practice_type contains 'mobility'` returns a strength row, that's a valid pick. | Honors the data. Doesn't hard-code an empty assumption. The skip-phase branch only triggers when the query genuinely returns zero rows. |

---

## What changes in the engine

T2 currently looks like (paraphrased):

```js
async function generateBodyFocusFromHome({ user_id, focus_slug, time_budget_min, levels }) {
  if (focus_slug === 'mobility' || focus_slug === 'full_body') {
    throw new NotImplementedError(`focus_slug=${focus_slug} from home — implement in S12-T4`);
  }
  // ...10-keyworded-focus path...
}
```

After T4:

```js
async function generateBodyFocusFromHome({ user_id, focus_slug, time_budget_min, levels }) {
  // Resolve content-eligibility queries based on focus type.
  const eligibility = resolveBodyFocusEligibility(focus_slug, /* entry_point */ 'home', levels);
  // eligibility = { warmup_query, main_query, cooldown_query, skip_strength_main? }

  // ...rest of the recipe (recency, bookends, picked-set, tier badges, metadata) is shared...
}
```

The new helper `resolveBodyFocusEligibility(focus_slug, entry_point, levels)` returns the three eligibility queries (or query-builders) for warmup / main / cooldown. For the 10 keyworded focuses it returns the keyword-overlap queries T2 already builds. For `mobility` and `full_body` it returns the special-case queries from §Mobility and §Full Body below. This is the only structural change; the rest of the recipes are untouched.

**Bookend logic is unchanged** — bookend selection reads `focus_content_compatibility` with `role IN ('bookend_open', 'bookend_close')` for any body focus, including `mobility` and `full_body` (the seed includes their rows per S11-T3 close-out).

---

## §Mobility special case

### Strength-tab + mobility

**Action:** throw `RangeError('mobility is not available from strength_tab — use yoga_tab or home')`.

The picker UI in Sprint 13+ should not surface this combination, but the engine refuses the call as a second line of defense. Carry-forward of T2/T3.5 throw discipline.

### Yoga-tab + mobility

**Eligibility queries** (replace the keyword-overlap predicates):

```sql
-- WARMUP
SELECT * FROM exercises
WHERE pillar = 'yoga'
  AND practice_types ILIKE '%mobility%'
  AND difficulty_order(difficulty) <= difficulty_order(:yoga_level)
  AND id NOT IN (:excluded_ids)

-- MAIN
SELECT * FROM exercises
WHERE pillar = 'yoga'
  AND (practice_types ILIKE '%flexibility%' OR practice_types ILIKE '%mobility%')
  AND difficulty_order(difficulty) <= difficulty_order(:yoga_level)
  AND id NOT IN (:excluded_ids)

-- COOLDOWN
SELECT * FROM exercises
WHERE pillar = 'yoga'
  AND (practice_types ILIKE '%restorative%' OR practice_types ILIKE '%flexibility%')
  AND difficulty_order(difficulty) <= difficulty_order(:yoga_level)
  AND id NOT IN (:excluded_ids)
  AND id NOT IN (:warmup_picked_ids)  -- T2 dedup rule, unchanged
```

**Picked counts per phase:** carry forward T2's yoga-tab counts (15 → 1/3/1, 30 → 2/5/2, 45 → 2/8/3, 60 → 3/10/4).

**Note on practice_types ILIKE:** T2 surfaced that `exercises.practice_types` is a text column containing yoga STYLES (vinyasa / hatha / restorative / etc.), not movement-quality tokens. T2's warmup/cooldown remap (warmup → `vinyasa|sun_salutation|hatha`, cooldown → `restorative|yin|hatha`) is for the **keyworded body focuses**. For mobility specifically, the spec calls out `practice_types IN ('mobility', 'flexibility', 'restorative')` — these tokens **do** exist in the data (mobility/flexibility/restorative are practice-type tags, not just style tags). Confirm via pre-flight; if any of the three tokens has zero matches, the smoke fails.

### Home (cross-pillar) + mobility — yoga-dominant shape

The mobility home shape per master spec line 661–665:

```
bookend_open (breathwork, calming)  ← from focus_content_compatibility, role='bookend_open'
warmup       (yoga, mobility)       ← practice_types ILIKE '%mobility%'
main         (yoga, flexibility/mobility) ← FILLS THE STRENGTH-MAIN SLOT
cooldown     (yoga, restorative)    ← practice_types ILIKE '%restorative%' OR '%flexibility%'
bookend_close(breathwork, calming)  ← from focus_content_compatibility, role='bookend_close'
```

**Critical detail:** the strength-main slot is **replaced with yoga**, not skipped. This differs from the master spec's line 301–303 commentary (which says strength is "skipped" if the strength-mobility pool is empty). The §Mobility section at line 659–668 is authoritative — it explicitly says "main (yoga, flexibility/mobility — fills the strength-main slot)."

**Picked counts for home + mobility:**

| Phase | Budget 30 | Budget 60 |
|-------|-----------|-----------|
| bookend_open (breathwork) | 1 (≈3 min) | 1 (≈5 min) |
| warmup (yoga, mobility) | 1 | 2 |
| main (yoga, flex/mobility) | **3 at 30, 5 at 60** ← absorbs strength-main count | **3 at 30, 5 at 60** |
| cooldown (yoga, restorative) | 1 | 2 |
| bookend_close (breathwork) | 1 (≈3 min) | 1 (≈5 min) |

The "main absorbs strength-main count" rule means home + mobility's main has the same pick count as a keyworded body focus's strength-main would have had. Yoga main durations (≈3–5 min per pose) × pick count gives a longer yoga-dominant block.

**De-dup rule:** main picked-set excludes warmup picked-set; cooldown picked-set excludes both. (T2's existing rule for the warmup/cooldown chain, extended to main here because all three slots are yoga and could collide.)

### Breathwork-tab + mobility

**Action:** throw `RangeError('body focus not available from breathwork_tab')` — same throw T2 already raises for any body focus from the breathwork tab. No T4 change here; just confirm symmetry.

---

## §Full Body special case

### Compound-detection predicate

```
target_muscles_count(row) >= 3
```

`exercises.target_muscles` is a text column containing comma-separated muscle tags (per T2 header comment). The count is the comma-count + 1, or equivalently the array length after splitting on `,`. Implementation should match T2's pattern — the engine likely already has a helper to count target_muscles tokens (or it adapts ILIKE logic). If T2 didn't add the helper, T4 adds it as part of `resolveBodyFocusEligibility`.

**SQL form (PostgreSQL):**

```sql
-- For text-stored target_muscles:
ARRAY_LENGTH(STRING_TO_ARRAY(target_muscles, ','), 1) >= 3

-- If a future migration moves target_muscles to TEXT[]:
ARRAY_LENGTH(target_muscles, 1) >= 3
```

The engine wraps this in a `compoundFilter()` helper so the migration path is one line.

### Strength-tab + full_body

```sql
SELECT * FROM exercises
WHERE pillar = 'strength'
  AND ARRAY_LENGTH(STRING_TO_ARRAY(target_muscles, ','), 1) >= 3
  AND difficulty_order(difficulty) <= difficulty_order(:strength_level)
  AND id NOT IN (:excluded_ids)
```

Picked count: **5 at budget 30, 8 at budget 60** (carry forward T2's strength-tab count). Sets/reps: 3 sets beginner / 4 intermediate / 4 advanced × 8–12 reps (T2 default).

### Yoga-tab + full_body

```sql
-- WARMUP — note the practice_type restriction (yoga-tab only, per master spec line 409)
SELECT * FROM exercises
WHERE pillar = 'yoga'
  AND ARRAY_LENGTH(STRING_TO_ARRAY(target_muscles, ','), 1) >= 3
  AND practice_types ILIKE '%mobility%'
  AND difficulty_order(difficulty) <= difficulty_order(:yoga_level)
  AND id NOT IN (:excluded_ids)

-- MAIN
SELECT * FROM exercises
WHERE pillar = 'yoga'
  AND ARRAY_LENGTH(STRING_TO_ARRAY(target_muscles, ','), 1) >= 3
  AND difficulty_order(difficulty) <= difficulty_order(:yoga_level)
  AND id NOT IN (:excluded_ids)

-- COOLDOWN
SELECT * FROM exercises
WHERE pillar = 'yoga'
  AND ARRAY_LENGTH(STRING_TO_ARRAY(target_muscles, ','), 1) >= 3
  AND (practice_types ILIKE '%restorative%' OR practice_types ILIKE '%flexibility%')
  AND difficulty_order(difficulty) <= difficulty_order(:yoga_level)
  AND id NOT IN (:excluded_ids)
  AND id NOT IN (:warmup_picked_ids)
```

Picked counts: same yoga-tab cadence (15 → 1/3/1, 30 → 2/5/2, 45 → 2/8/3, 60 → 3/10/4).

### Home (cross-pillar) + full_body

Standard 5-phase cross-pillar shape (bookend_open / warmup / main / cooldown / bookend_close). Each content-phase swaps the keyword-overlap predicate for the compound-detection predicate.

```sql
-- WARMUP (yoga) — note: NO practice_type restriction here (master spec line 290)
SELECT * FROM exercises
WHERE pillar = 'yoga'
  AND ARRAY_LENGTH(STRING_TO_ARRAY(target_muscles, ','), 1) >= 3
  AND difficulty_order(difficulty) <= difficulty_order(:yoga_level)
  AND id NOT IN (:excluded_ids)

-- MAIN (strength) — fills the standard strength-main slot
SELECT * FROM exercises
WHERE pillar = 'strength'
  AND ARRAY_LENGTH(STRING_TO_ARRAY(target_muscles, ','), 1) >= 3
  AND difficulty_order(difficulty) <= difficulty_order(:strength_level)
  AND id NOT IN (:excluded_ids)

-- COOLDOWN (yoga)
SELECT * FROM exercises
WHERE pillar = 'yoga'
  AND ARRAY_LENGTH(STRING_TO_ARRAY(target_muscles, ','), 1) >= 3
  AND (practice_types ILIKE '%restorative%' OR practice_types ILIKE '%flexibility%')
  AND difficulty_order(difficulty) <= difficulty_order(:yoga_level)
  AND id NOT IN (:excluded_ids)
  AND id NOT IN (:warmup_picked_ids)
```

**Picked counts for home + full_body:** carry forward T2's home counts unchanged. Warmup 1@30 / 2@60. Main 3@30 / 5@60. Cooldown 1@30 / 2@60.

Bookends from `focus_content_compatibility` for `full_body`, same as any body focus.

### Spec note: the home full_body warmup vs yoga-tab full_body warmup asymmetry

| Path | Warmup yoga eligibility |
|------|------------------------|
| Home + full_body | compound only (no practice_type restriction) |
| Yoga-tab + full_body | compound AND `practice_types ILIKE '%mobility%'` |

This asymmetry is **deliberate per the master spec.** Home's bookend_open already covers arrival/calming so the warmup yoga can be any compound. Yoga-tab has no breathwork bookend and so wants a movement-y warmup. T4 preserves the asymmetry verbatim.

### Breathwork-tab + full_body

**Action:** throw `RangeError('body focus not available from breathwork_tab')`. Symmetric with mobility. T2 already raises this; T4 confirms.

---

## Implementation Notes

### `resolveBodyFocusEligibility(focus_slug, entry_point, levels)` — new helper

```js
/**
 * Returns the eligibility query-builders for the warmup / main / cooldown phases
 * of a body-focus session. Centralizes the special-case routing for `mobility`
 * and `full_body` so each entry-point recipe stays simple.
 *
 * @param {string} focus_slug   — one of the 12 body focuses
 * @param {string} entry_point  — 'home' | 'strength_tab' | 'yoga_tab'
 * @param {object} levels       — { strength_level, yoga_level, breathwork_level }
 * @returns {object}
 *   {
 *     warmup:    { sql, params },
 *     main:      { sql, params, skip_if_empty?: boolean },  // skip_if_empty true only for mobility-from-home strength-main path (deferred — see Decision #2)
 *     cooldown:  { sql, params }
 *   }
 *
 * Throws if the (focus_slug, entry_point) combination is not allowed:
 *   - mobility from strength_tab → RangeError
 *   - any body focus from breathwork_tab → RangeError (already handled at dispatch)
 */
```

The helper is the **only** place where `focus_slug === 'mobility'` and `focus_slug === 'full_body'` are special-cased. Once it returns the query-builders, the rest of each recipe (assemble phases, pick sets, attach bookends, compute metadata) is identical to the T2 keyworded path.

### `compoundFilter()` — new helper

```js
/**
 * Returns the SQL fragment for compound-exercise detection. Wraps the
 * text-vs-array storage detail of `exercises.target_muscles` in one place.
 * If a future migration moves target_muscles to TEXT[], only this helper changes.
 *
 * @returns {string}  SQL fragment, e.g. "ARRAY_LENGTH(STRING_TO_ARRAY(target_muscles, ','), 1) >= 3"
 */
function compoundFilter() {
  return "ARRAY_LENGTH(STRING_TO_ARRAY(target_muscles, ','), 1) >= 3";
}
```

### Practice-type ILIKE remap — does it apply to mobility/full_body?

**No.** The T2 remap (warmup → `vinyasa|sun_salutation|hatha`, cooldown → `restorative|yin|hatha`) was for the keyworded body focuses where the spec's "practice_type contains 'mobility' OR 'flexibility'" had no matching data tokens. For mobility and full_body, the spec uses the literal tokens `mobility`, `flexibility`, `restorative` — pre-flight asserts these tokens exist in `exercises.practice_types` for the relevant pillar. If they don't, fix the data, not the engine.

### Recency, exclusion, swap-counter, tier badges — unchanged

All of these are T2/T5/T6 territory. T4 inherits T2's recency check and exclusion filter unchanged. T4 does not touch swap-counter logic (that's T6).

---

## Validation rules — additions to `generateSession`

T2 already validates:
1. body focus from breathwork_tab → throw
2. state focus from body-only tabs → throw

T4 adds:
3. **`mobility` from `strength_tab` → throw `RangeError('mobility is not available from strength_tab — use yoga_tab or home')`**

That's the only new dispatch-level throw. Mobility-from-home and mobility-from-yoga-tab are valid; full_body is valid from all three body-tab entry points (home / strength_tab / yoga_tab). Full_body from breathwork_tab is rejected by the existing T2 throw.

---

## Smoke Test Plan

T4 extends `server/scripts/test-suggestion-engine-t2.js` (kept as the rolling Sprint-12 harness). The new assertions:

### Pre-flight (runs before any generation)

1. **Bookend rows exist for both special-case focuses.**
   ```sql
   SELECT focus_areas.slug, fcc.role, COUNT(*) FROM focus_content_compatibility fcc
   JOIN focus_areas ON focus_areas.id = fcc.focus_id
   WHERE focus_areas.slug IN ('mobility', 'full_body')
     AND fcc.role IN ('bookend_open', 'bookend_close')
   GROUP BY focus_areas.slug, fcc.role;
   ```
   Expected: 4 rows (mobility × 2 roles + full_body × 2 roles), each with COUNT >= 1.

2. **Practice-type tokens exist in the data.**
   ```sql
   SELECT
     SUM(CASE WHEN practice_types ILIKE '%mobility%' AND pillar='yoga' THEN 1 ELSE 0 END) AS yoga_mobility_count,
     SUM(CASE WHEN practice_types ILIKE '%flexibility%' AND pillar='yoga' THEN 1 ELSE 0 END) AS yoga_flexibility_count,
     SUM(CASE WHEN practice_types ILIKE '%restorative%' AND pillar='yoga' THEN 1 ELSE 0 END) AS yoga_restorative_count,
     SUM(CASE WHEN ARRAY_LENGTH(STRING_TO_ARRAY(target_muscles, ','), 1) >= 3 AND pillar='yoga' THEN 1 ELSE 0 END) AS yoga_compound_count,
     SUM(CASE WHEN ARRAY_LENGTH(STRING_TO_ARRAY(target_muscles, ','), 1) >= 3 AND pillar='strength' THEN 1 ELSE 0 END) AS strength_compound_count
   FROM exercises;
   ```
   Expected: each count >= 1 (assert >= 5 for yoga_compound and strength_compound to ensure the picked-count of 3–5 is satisfiable at beginner level; if pre-flight fails here, escalate as a content-tagging gap, not an engine bug).

3. **Mobility strength-main pool — informational, not blocking.** Log the count of `pillar='strength' AND practice_types ILIKE '%mobility%'`. Expected to be small (the spec says "rare; likely empty"). The engine is allowed to skip the strength-main phase when this is 0 (per Decision #2). The smoke does not fail on count = 0; it just records the value for the build log.

### Generation cases

| # | Focus | Entry Point | Budget | Expected |
|---|-------|-------------|--------|----------|
| 1 | mobility | home | 30 | 5 phases (bookend_open / warmup / main / cooldown / bookend_close); main is yoga (or skipped only if strength-mobility pool was 0 AND we deferred reallocation per Decision #2). All items difficulty ≤ user level. |
| 2 | mobility | home | 60 | Same shape, larger picked counts. |
| 3 | mobility | yoga_tab | 15 | 3 phases (warmup / main / cooldown). 1/3/1 picks. |
| 4 | mobility | yoga_tab | 30 | 3 phases. 2/5/2 picks. |
| 5 | mobility | yoga_tab | 45 | 3 phases. 2/8/3 picks. |
| 6 | mobility | yoga_tab | 60 | 3 phases. 3/10/4 picks. |
| 7 | full_body | home | 30 | 5 phases. Warmup yoga, main strength, cooldown yoga, all compound. |
| 8 | full_body | home | 60 | Same shape, larger picks. |
| 9 | full_body | strength_tab | 30 | 1 phase (main). 5 picks. |
| 10 | full_body | strength_tab | 60 | 1 phase (main). 8 picks. |
| 11 | full_body | yoga_tab | 15 | 3 phases. 1/3/1 picks. Warmup compound + practice_type='mobility'. |
| 12 | full_body | yoga_tab | 30 | 3 phases. 2/5/2 picks. |
| 13 | full_body | yoga_tab | 45 | 3 phases. 2/8/3 picks. |
| 14 | full_body | yoga_tab | 60 | 3 phases. 3/10/4 picks. |

### Throw assertions (4 new)

| # | Call | Expected throw |
|---|------|----------------|
| 1 | `generateSession({ focus_slug: 'mobility', entry_point: 'strength_tab', time_budget_min: 30 })` | `RangeError('mobility is not available from strength_tab — use yoga_tab or home')` |
| 2 | `generateSession({ focus_slug: 'mobility', entry_point: 'breathwork_tab', bracket: '0-10' })` | `RangeError(/body focus.*breathwork_tab/)` (T2 throw, carry-forward) |
| 3 | `generateSession({ focus_slug: 'full_body', entry_point: 'breathwork_tab', bracket: '0-10' })` | `RangeError(/body focus.*breathwork_tab/)` (T2 throw, carry-forward) |
| 4 | `generateSession({ focus_slug: 'full_body', entry_point: 'home' })` *with `time_budget_min` omitted* | `RangeError('body focus requires time_budget_min')` (T2 throw, carry-forward) |

Throws #2–#4 should already pass (T2 raises them); they're listed to lock the regression contract.

### Per-case sub-assertions (applied to each of the 14 generation cases)

For every generated session:

1. `session_shape === 'cross_pillar'` (home cases) OR `session_shape === 'pillar_pure'` (strength_tab and yoga_tab cases).
2. `phases.length` matches the expected phase count (5 for home, 1 for strength_tab, 3 for yoga_tab).
3. Every `phases[i].items[j].difficulty <= levels[item.pillar]_level` (string difficulty mapped via existing `difficulty_order` helper).
4. Every `phases[i].items[j].content_id NOT IN user_excluded_exercises` for the test user.
5. For home-case bookends: `phases[0].phase === 'bookend_open'` AND `phases[4].phase === 'bookend_close'` AND both bookend items have `content_type === 'breathwork'`.
6. For mobility home cases: warmup, main, cooldown items all have `content_type === 'yoga'`. (Or, if Decision #2's skip-strength-main path triggered: phases.length === 4, `phases[2].phase === 'cooldown'` directly. Track this branch with a separate assertion.)
7. For full_body strength_tab cases: every main item has `target_muscles` containing 3+ comma-separated tokens (smoke-time count assertion against the picked rows).
8. For full_body yoga_tab warmup: every warmup item's `practice_types` contains the literal substring `mobility`.
9. `metadata.estimated_total_min` is computed and present on every response.
10. `warnings` is an array (empty is fine; recency warnings are T5 territory).

### Smoke total target

T2 baseline: 1531 pass.
T3 throw assertions (carried): 6 pass.
T3.5 smoke (matrix + per-cell + W-fixes throws): 1153 pass (per SPRINT_TRACKER's 2690 total at T3.5 close).
T4 new: 14 generation cases × ~10 sub-assertions = ~140 + 4 throws + 5 pre-flight assertions = **~150 new pass**.

**Target: ~2840 pass, 0 fail.** (Final count is whatever the harness produces; treat ~2840 as the floor, not the ceiling.)

---

## Acceptance Criteria

T4 ships when **all of the following pass:**

1. **Schema:** No schema changes. T4 is pure engine code.
2. **Engine:** `generateSession` accepts `mobility` and `full_body` focuses for their valid entry-point combinations and produces sessions matching the §Mobility and §Full Body shapes. The `NotImplementedError` throws T2 raised for these focuses are gone.
3. **New helpers:** `resolveBodyFocusEligibility(focus_slug, entry_point, levels)` exists and routes the three special-case predicates. `compoundFilter()` exists and centralizes the compound-detection SQL. Both are exported (or the harness can otherwise smoke them directly).
4. **Throws:**
   - `mobility` from `strength_tab` → throws `RangeError`.
   - All T2/T3.5 carry-forward throws still throw.
5. **Pre-flight:** the smoke pre-flight stops the build if (a) bookend rows are missing for `mobility` or `full_body`, or (b) any of the practice-type tokens (`mobility`/`flexibility`/`restorative`) has zero matches for `pillar='yoga'`, or (c) the compound count is < 5 for either pillar.
6. **Generation:** all 14 cases in the smoke generation table pass with their sub-assertions.
7. **Backward compatibility:** all T2 body-focus smoke (1531 assertions) still passes unchanged. All T3.5 state-focus smoke (the matrix + per-cell + throws) still passes unchanged. The two `NotImplementedError` throws T2 raised for `mobility` and `full_body` are **replaced** by passing generation cases; their throw assertions are dropped.
8. **Total smoke:** ≥ 2840 pass, 0 fail (treat as floor).
9. **`/review` grade:** A- or better. T4 is real algorithm work and gets reviewed.

---

## Out of Scope (T4 does NOT do)

- **Time-budget reallocation** when mobility's strength-main pool is empty → FUTURE_SCOPE entry below.
- **Hiding mobility from the strength-tab picker UX** → Sprint 13+ (UI ticket).
- **Composer mode** for mobility/full_body (build-your-own with tier badges) → Sprint 14.
- **Full-body cardio/conditioning derivation** ("endurance" focus) → not in scope for T4 or Sprint 12. PRE_SPRINT_11_PLANNING noted cardio as a focus-area in Approach 5; it's not on the seeded `focus_areas` list and is post-launch territory.
- **Recency / swap-counter / exclusion endpoints** → T5 / T6.
- **HTTP layer** → T7.
- **Quality-ranked sampling** within the compound or mobility pools → Sprint 14+ (depends on Sprint 13 muscle hierarchy; master spec Decision #7).
- **Mobility/full_body in `focus_overlaps`** → master spec line 732 explicitly excludes them ("they don't fatigue specific muscles"). T4 does not change `focus_overlaps`.

---

## Files Touched

**Modified:**
- `server/src/services/suggestionEngine.js` — replace the two `NotImplementedError` throws with the special-case branches via `resolveBodyFocusEligibility`. Add `compoundFilter()` helper.
- `server/scripts/test-suggestion-engine-t2.js` — extend smoke harness with the pre-flight, the 14 generation cases, the 4 throw assertions, and per-case sub-assertions.

**Not modified:**
- DB schema, migrations, seeds.
- Body-focus engine path for the 10 keyworded focuses.
- State-focus engine path (T3.5 territory).
- Bookend selection logic (T2 territory; reused as-is).
- Recency / exclusion / swap-counter logic.
- HTTP routes (T7 territory).
- Flutter app (no UI in this ticket).

---

## Followups noted during T4 spec writing (eligible for FUTURE_SCOPE post-sprint-close)

1. **Time-budget reallocation for mobility-from-home when the strength-main pool is empty.** Currently the strength-main slot's minutes "disappear" — the session is honestly shorter than the budget, and `metadata.estimated_total_min` reflects the truth. A reallocation pass would extend the yoga-main duration to absorb the missing minutes. Requires a duration-reallocation block we don't have today. Sprint 13+ refinement.

2. **Hide `mobility` from the strength-tab focus picker.** The engine throws if called; the picker UI should not surface the option in the first place. Sprint 13 ticket.

3. **Movement-quality tagging for yoga.** T2 surfaced and T4 confirms: `exercises.practice_types` mixes yoga STYLES (vinyasa, hatha, restorative, yin) with movement-quality tokens (mobility, flexibility). The mobility/flexibility/restorative tokens *do* exist but the model is muddy. A clean fix is a separate `movement_quality` column tagged across the 258 yoga rows. Sprint 14+ when the engine starts caring about quality-ranked sampling.

4. **Compound-detection accuracy.** `array_length >= 3` is a coarse compound proxy. Some 3-muscle exercises are isolation-by-adjacency (e.g. concentration curl that secondarily engages forearms and shoulders). A `is_compound BOOL` column tagged by domain knowledge would beat the heuristic. Sprint 13+ tagging work.

5. **Endurance / cardio focus.** Approach 5 names cardio as a focus-area trainable through any pillar, but no `endurance` or `cardio` row exists in `focus_areas` today. Decide whether this is a new body focus (with its own muscle keywords or compound rule), a state focus (with breathwork main), or a third focus type. Pre-launch decision; post-Sprint-12.

6. **`target_muscles` text-to-array migration.** T2/T4 both work around the text storage with `STRING_TO_ARRAY` at query time. A migration to `TEXT[]` would (a) let us drop the `STRING_TO_ARRAY` wrapper, (b) gain GIN-indexable membership tests, (c) clean up the substring-vs-token collision risk. Sprint 13+ schema cleanup.

7. **Mobility strength-main pool authoring.** The spec calls this pool "rare; likely empty." If product wants mobility sessions to ever include a strength element (e.g. weighted carries, suitcase walks, banded mobility under load), Sprint 13+ should author 5–10 strength rows tagged with `practice_types = 'mobility'`. T4 itself doesn't depend on this; the engine handles either case.

---

*Doc owner: Prashob (CEO/PM) + Claude.ai (Architect).*
*Place this doc in `D:\projects\dailyforge\Trackers\` alongside `S12-T3.5-state-focus-refactor-spec.md`.*
*Companion artifact: this spec drives `S12-T4-prompt.md`, written separately when the ticket is queued.*
