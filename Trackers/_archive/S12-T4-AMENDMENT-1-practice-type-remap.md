# S12-T4 Spec Amendment 1 — Practice-Type Remap

**Date:** Apr 29, 2026
**Status:** LOCKED. Supersedes the practice-type filter clauses in `S12-T4-mobility-fullbody-special-cases-spec.md` v1 §Mobility and §Full Body.
**Trigger:** Claude Code's pre-flight diagnostic (per the spec's pre-flight discipline) flagged that the spec's `practice_types ILIKE '%mobility%'` and `'%flexibility%'` predicates return zero matches against live data. Two of the three movement-quality tokens the spec assumed don't exist in the database.

This amendment patches the spec — not the data — because the data won't change in Sprint 12 and the engine needs a real predicate to ship today. The amendment codifies the (spec intent → live-data style token) mapping as the canonical contract for T4.

---

## Decision: Path C (engine-side remap, codified in this amendment)

The pre-flight offered four paths:

- **A.** Engine-side remap, document in header comment.
- **B.** Block T4 on a Sprint 13 content-authoring ticket that adds movement-quality tags to the 258 yoga rows.
- **C.** Engine-side remap, codified in this amendment as the canonical contract.
- **D.** Drop practice-type filtering entirely for mobility/full_body — keyword-or-compound predicate plus level filter, nothing else.

**Choice: C.**

### Why not A

A header comment drifts. T2's existing remap is documented in a header comment, and that comment is exactly what allowed the T4 spec to drift in the opposite direction (the spec author assumed `mobility/flexibility/restorative` existed because the comment was easy to miss). Codifying the remap as a spec-level artifact makes it discoverable, reviewable, and explicitly retirable when movement-quality tagging lands.

### Why not B

The pre-flight surfaced a real content-authoring gap: the 258 yoga rows are tagged with **style** (vinyasa / hatha / yin / restorative / sun_salutation) but not with **movement quality** (mobility / flexibility / dynamic / static). That's a Sprint 13+ tagging ticket already on the radar (FUTURE_SCOPE followup #3 from the T4 spec). Blocking T4 on it would push T5/T6/T7/T7 back weeks for a tagging effort. Honest move: ship the v1 engine with style-flavored mobility/full_body yoga, document the gap loudly, and retire the remap when the tags land.

The cost of A vs B: A delivers a usable session today (style-appropriate yoga; users get a vinyasa/hatha sequence for "mobility warmup"); B blocks the engine MVP. The cost of A is the session is "appropriate but not optimal" — vinyasa-flavored mobility is not as good as a true movement-quality-tagged mobility sequence, but it is still a yoga warmup for a body part / compound work, not nonsense.

### Why not D

D loses the spec's intent. The reason mobility/full_body have practice-type filters in the first place is to give the warmup a different feel than the cooldown — warmup wants movement, cooldown wants rest. Dropping the filter collapses warmup/main/cooldown into a flat pool ranked only by level, and the user gets the same kind of yoga in all three phases. That's a worse v1 than A/C.

### What this means for the spec

1. The spec's §Mobility and §Full Body sections retain their structure (warmup / main / cooldown phase shapes, picked counts, throws, dispatch routing).
2. The literal SQL fragments using `practice_types ILIKE '%mobility%'`, `'%flexibility%'`, `'%restorative%'` are replaced by the remap below.
3. The engine implements the remapped queries verbatim against this amendment.
4. T4's smoke pre-flight is updated to assert the **remapped** token counts, not the original spec tokens.
5. A new FUTURE_SCOPE followup (already implied by T4 spec followup #3, made explicit here) retires this remap when movement-quality tagging lands.

---

## Live data — yoga `practice_types` distribution (Apr 29, 2026)

| Token | Row count |
|-------|-----------|
| `hatha` | 257 |
| `vinyasa` | 217 |
| `yin` | 40 |
| `restorative` | 13 |
| `sun_salutation` | 4 |
| `mobility` | **0** |
| `flexibility` | **0** |

Strength `practice_types`: column is empty for `pillar='strength'`. No tokens at all.

Compound counts (unchanged from T4 spec pre-flight):
- yoga rows with `array_length(target_muscles, 1) >= 3`: 230
- strength rows with `array_length(target_muscles, 1) >= 3`: 431

---

## The Remap Table

T4 implements the right column verbatim. The left column shows what the T4 spec said; the middle column shows the spec's intent.

| Spec said (literal SQL) | Spec intent | T4 implementation |
|------------------------|-------------|-------------------|
| `practice_types ILIKE '%mobility%'` | "yoga that has movement; warm the body up" | `practice_types ILIKE ANY (ARRAY['%vinyasa%', '%sun_salutation%', '%hatha%'])` (matches T2's `WARMUP_STYLES` constant) |
| `practice_types ILIKE '%flexibility%' OR practice_types ILIKE '%mobility%'` | "yoga that opens / lengthens; the main work for mobility focus" | `practice_types ILIKE ANY (ARRAY['%hatha%', '%yin%', '%vinyasa%'])` (broad coverage — hatha for general flexibility, yin for deep stretches, vinyasa for active flexibility flows) |
| `practice_types ILIKE '%restorative%' OR practice_types ILIKE '%flexibility%'` | "yoga that calms / closes; the cooldown" | `practice_types ILIKE ANY (ARRAY['%restorative%', '%yin%', '%hatha%'])` (matches T2's `COOLDOWN_STYLES` constant) |

### Why these specific style tokens

- **Warmup mapping (`vinyasa | sun_salutation | hatha`):** matches T2's existing `WARMUP_STYLES` constant exactly. T2 used this for keyworded body-focus warmups and the smoke proved it produces movement-feeling yoga. Reusing it for mobility/full_body warmup is the obvious move; it also means the engine has one warmup style-set, not two.
- **Main mapping (`hatha | yin | vinyasa`):** broader than warmup because mobility's "main" phase is the longest yoga block and benefits from variety. Yin gets included here (not in warmup) because yin's long-hold stretches are the spiritual home of "open the hips / open the shoulders" mobility work. Hatha is the catch-all for general flexibility postures. Vinyasa supports active flexibility flows.
- **Cooldown mapping (`restorative | yin | hatha`):** matches T2's `COOLDOWN_STYLES` constant exactly. Same reasoning as warmup — reusing T2's constants keeps the engine simple.

### Engine implementation note

T2 already exports two style-set constants (`MOBILITY_WARMUP_STYLES` or similar, and `COOLDOWN_PRACTICE_STYLES` or similar — exact names from T2's source). T4 reuses those constants for the warmup and cooldown remaps. T4 adds **one** new constant for the main phase: `MOBILITY_MAIN_STYLES = ['hatha', 'yin', 'vinyasa']`. All three constants live in the same place at the top of `suggestionEngine.js`, with header comments pointing back to this amendment.

If T2's actual constant names differ from what I've sketched, use T2's names verbatim — the point is that the engine has one canonical style-set per intent (warmup / main / cooldown), authored once and referenced everywhere.

---

## Updated Eligibility Queries

These supersede the SQL fragments in the T4 spec §Mobility and §Full Body sections.

### Mobility from yoga_tab

```sql
-- WARMUP (mobility, yoga_tab)
SELECT * FROM exercises
WHERE pillar = 'yoga'
  AND practice_types ILIKE ANY (ARRAY['%vinyasa%', '%sun_salutation%', '%hatha%'])
  AND difficulty_order(difficulty) <= difficulty_order(:yoga_level)
  AND id NOT IN (:excluded_ids)

-- MAIN (mobility, yoga_tab)
SELECT * FROM exercises
WHERE pillar = 'yoga'
  AND practice_types ILIKE ANY (ARRAY['%hatha%', '%yin%', '%vinyasa%'])
  AND difficulty_order(difficulty) <= difficulty_order(:yoga_level)
  AND id NOT IN (:excluded_ids)

-- COOLDOWN (mobility, yoga_tab)
SELECT * FROM exercises
WHERE pillar = 'yoga'
  AND practice_types ILIKE ANY (ARRAY['%restorative%', '%yin%', '%hatha%'])
  AND difficulty_order(difficulty) <= difficulty_order(:yoga_level)
  AND id NOT IN (:excluded_ids)
  AND id NOT IN (:warmup_picked_ids)
```

### Mobility from home

```sql
-- WARMUP (mobility, home) — same as yoga_tab warmup
SELECT * FROM exercises
WHERE pillar = 'yoga'
  AND practice_types ILIKE ANY (ARRAY['%vinyasa%', '%sun_salutation%', '%hatha%'])
  AND difficulty_order(difficulty) <= difficulty_order(:yoga_level)
  AND id NOT IN (:excluded_ids)

-- MAIN (mobility, home) — fills strength-main slot with yoga
SELECT * FROM exercises
WHERE pillar = 'yoga'
  AND practice_types ILIKE ANY (ARRAY['%hatha%', '%yin%', '%vinyasa%'])
  AND difficulty_order(difficulty) <= difficulty_order(:yoga_level)
  AND id NOT IN (:excluded_ids)
  AND id NOT IN (:warmup_picked_ids)

-- COOLDOWN (mobility, home) — same as yoga_tab cooldown, plus excludes both warmup and main picked
SELECT * FROM exercises
WHERE pillar = 'yoga'
  AND practice_types ILIKE ANY (ARRAY['%restorative%', '%yin%', '%hatha%'])
  AND difficulty_order(difficulty) <= difficulty_order(:yoga_level)
  AND id NOT IN (:excluded_ids)
  AND id NOT IN (:warmup_picked_ids)
  AND id NOT IN (:main_picked_ids)
```

**Note on mobility-home main de-dup:** the original T4 spec mentioned extending the dedup chain to all three yoga phases for mobility-home. The amendment makes this explicit — main excludes warmup, cooldown excludes both. This is the only path where main and cooldown both query yoga; on the keyworded body-focus path, main is strength so the chain is naturally broken.

### Mobility strength-main pool — confirmed always empty

The pre-flight confirmed `pillar='strength' AND practice_types ILIKE ANY (mobility-style-tokens)` is structurally always 0 because **strength rows have no `practice_types` data at all** (the column is empty for the entire strength pillar). This is a stronger statement than the T4 spec's "rare; likely empty."

**Implication for Decision #2 in the T4 spec:** the strength-main skip path is **not** a runtime branch; it's a structural always-skip for mobility-home. The T4 implementation can hardcode the skip without querying first.

**Engine simplification:** for mobility-home, the engine constructs the phases array as `[bookend_open, warmup, main (yoga), cooldown, bookend_close]` directly — no strength-main attempt, no count-zero check, no fallback branch. Strength-main is just not in the recipe for mobility-home, by data fact.

This also means the spec's §Mobility section at master-spec line 661–665 is correctly authoritative (main is yoga, fills the strength-main slot) and the master-spec line 301–303 commentary (skip if pool empty) is moot. The structural always-skip resolves the inconsistency the T4 spec flagged at "Judgment-call escalation triggers" item #2.

### Full_body from yoga_tab

```sql
-- WARMUP (full_body, yoga_tab) — compound + warmup styles
SELECT * FROM exercises
WHERE pillar = 'yoga'
  AND ARRAY_LENGTH(STRING_TO_ARRAY(target_muscles, ','), 1) >= 3
  AND practice_types ILIKE ANY (ARRAY['%vinyasa%', '%sun_salutation%', '%hatha%'])
  AND difficulty_order(difficulty) <= difficulty_order(:yoga_level)
  AND id NOT IN (:excluded_ids)

-- MAIN (full_body, yoga_tab) — compound, no style filter
SELECT * FROM exercises
WHERE pillar = 'yoga'
  AND ARRAY_LENGTH(STRING_TO_ARRAY(target_muscles, ','), 1) >= 3
  AND difficulty_order(difficulty) <= difficulty_order(:yoga_level)
  AND id NOT IN (:excluded_ids)

-- COOLDOWN (full_body, yoga_tab) — compound + cooldown styles
SELECT * FROM exercises
WHERE pillar = 'yoga'
  AND ARRAY_LENGTH(STRING_TO_ARRAY(target_muscles, ','), 1) >= 3
  AND practice_types ILIKE ANY (ARRAY['%restorative%', '%yin%', '%hatha%'])
  AND difficulty_order(difficulty) <= difficulty_order(:yoga_level)
  AND id NOT IN (:excluded_ids)
  AND id NOT IN (:warmup_picked_ids)
```

**Risk note for full_body yoga_tab warmup:** compound (target_muscles ≥ 3) AND warmup-style intersection may produce a small pool. Pre-flight will assert this is ≥ 1 at beginner level; if it's smaller than the picked count (1 at budget 15, 2 at budget 30/45, 3 at budget 60), the engine's existing T2 fallback handling (graceful degradation; pick what's available) applies. This is the same fallback that handles biceps yoga = 1 pose today. Not a T4 problem.

### Full_body from home and strength_tab — no change

The home and strength_tab paths for full_body don't use practice-type filtering on the warmup/main where the master spec didn't already require it. Specifically:

- **Full_body home warmup:** compound only (no practice-type filter, per master spec line 290) — unchanged from the T4 spec.
- **Full_body home main:** compound on strength — unchanged.
- **Full_body home cooldown:** compound + cooldown-styles (remapped per the table above).
- **Full_body strength_tab:** compound on strength — unchanged.

So the remap affects:
1. Mobility yoga_tab warmup / main / cooldown
2. Mobility home warmup / main / cooldown
3. Full_body yoga_tab warmup and cooldown
4. Full_body home cooldown

That's it. Four-line-item amendment.

---

## Updated Pre-Flight Assertions

The T4 spec's pre-flight asserted three movement-quality tokens (`mobility`, `flexibility`, `restorative`) had ≥ 1 yoga match each. That's wrong for `mobility` and `flexibility`. Replacement assertions:

```sql
-- 1. Bookend rows (unchanged from T4 spec — still required)
SELECT focus_areas.slug, fcc.role, COUNT(*) AS row_count
FROM focus_content_compatibility fcc
JOIN focus_areas ON focus_areas.id = fcc.focus_id
WHERE focus_areas.slug IN ('mobility', 'full_body')
  AND fcc.role IN ('bookend_open', 'bookend_close')
GROUP BY focus_areas.slug, fcc.role;
-- Expect 4 rows, each row_count >= 1.

-- 2. REMAPPED yoga style-token presence
SELECT
  SUM(CASE WHEN practice_types ILIKE '%vinyasa%'        AND pillar='yoga' THEN 1 ELSE 0 END) AS yoga_vinyasa_count,
  SUM(CASE WHEN practice_types ILIKE '%sun_salutation%' AND pillar='yoga' THEN 1 ELSE 0 END) AS yoga_sun_salutation_count,
  SUM(CASE WHEN practice_types ILIKE '%hatha%'          AND pillar='yoga' THEN 1 ELSE 0 END) AS yoga_hatha_count,
  SUM(CASE WHEN practice_types ILIKE '%yin%'            AND pillar='yoga' THEN 1 ELSE 0 END) AS yoga_yin_count,
  SUM(CASE WHEN practice_types ILIKE '%restorative%'    AND pillar='yoga' THEN 1 ELSE 0 END) AS yoga_restorative_count
FROM exercises;
-- Expect (per Apr 29 snapshot): vinyasa=217, sun_salutation=4, hatha=257, yin=40, restorative=13. Each >= 1.

-- 3. Compound counts (unchanged from T4 spec)
SELECT
  SUM(CASE WHEN ARRAY_LENGTH(STRING_TO_ARRAY(target_muscles, ','), 1) >= 3 AND pillar='yoga'     THEN 1 ELSE 0 END) AS yoga_compound_count,
  SUM(CASE WHEN ARRAY_LENGTH(STRING_TO_ARRAY(target_muscles, ','), 1) >= 3 AND pillar='strength' THEN 1 ELSE 0 END) AS strength_compound_count
FROM exercises;
-- Expect each >= 5.

-- 4. NEW: mobility-home / yoga_tab post-remap pool sizes (informational + pickable-at-beginner)
SELECT 'mobility_warmup_beginner' AS pool, COUNT(*)
FROM exercises
WHERE pillar='yoga'
  AND practice_types ILIKE ANY (ARRAY['%vinyasa%', '%sun_salutation%', '%hatha%'])
  AND difficulty = 'beginner'
UNION ALL
SELECT 'mobility_main_beginner', COUNT(*)
FROM exercises
WHERE pillar='yoga'
  AND practice_types ILIKE ANY (ARRAY['%hatha%', '%yin%', '%vinyasa%'])
  AND difficulty = 'beginner'
UNION ALL
SELECT 'mobility_cooldown_beginner', COUNT(*)
FROM exercises
WHERE pillar='yoga'
  AND practice_types ILIKE ANY (ARRAY['%restorative%', '%yin%', '%hatha%'])
  AND difficulty = 'beginner'
UNION ALL
SELECT 'full_body_yogatab_warmup_beginner', COUNT(*)
FROM exercises
WHERE pillar='yoga'
  AND ARRAY_LENGTH(STRING_TO_ARRAY(target_muscles, ','), 1) >= 3
  AND practice_types ILIKE ANY (ARRAY['%vinyasa%', '%sun_salutation%', '%hatha%'])
  AND difficulty = 'beginner';
-- Expect each >= 1. (Stronger expectation: each >= the picked-count for the largest applicable budget; warn if pool < pick count.)

-- 5. Strength-mobility-pool — informational, confirmed structurally always 0
-- (No assertion. Log only. Decision #2 handles via structural always-skip per amendment.)
```

If pre-flight (1), (2), (3), or (4) fails, stop the build. The mobility/full_body engine paths can't ship if the remapped pools are empty at beginner level — that's a content gap big enough that even the remap can't paper over it.

---

## Smoke Test Updates

The smoke test plan in the T4 spec is otherwise unchanged. The 14 generation cases, 4 throw assertions, and per-case sub-assertions all still apply. Two sub-assertion adjustments:

**Sub-assertion #6 (mobility home cases) — strengthened:**
- **Was:** "warmup, main (if present), cooldown items all have `content_type === 'yoga'`. Track separately whether the main phase was skipped."
- **Now:** "warmup, main, cooldown items all have `content_type === 'yoga'` (mobility-home is a structural always-skip-strength path; `phases.length === 5` always for mobility-home; the 'main phase skipped' branch from T4 spec Decision #2 is dead code per this amendment)."
- The "phases.length === 4" branch is removed. Mobility-home always has 5 phases.

**Sub-assertion #8 (full_body yoga_tab warmup) — adjusted:**
- **Was:** "every warmup item's `practice_types` contains the literal substring `mobility`."
- **Now:** "every warmup item's `practice_types` contains at least one of the warmup-style tokens (`vinyasa`, `sun_salutation`, `hatha`)."

All other sub-assertions stand.

**Smoke total target:** unchanged at ≥ 2840 pass / 0 fail.

---

## FUTURE_SCOPE entries to add post-sprint-close

In addition to the seven followups in the T4 spec, this amendment generates two more:

8. **Movement-quality tagging for yoga (Sprint 13+).** Add a `movement_quality` column to `exercises` (or a parallel tag taxonomy) that captures `mobility / flexibility / dynamic / static / etc.` independent of style. Tag the 258 yoga rows. Once landed, retire the practice-type style remap in `suggestionEngine.js` and replace with the original spec predicates. **This amendment exists because of this gap; the amendment's retirement is the closing of the loop.**

9. **Strength `practice_types` is empty for the entire pillar.** Confirmed in the T4 pre-flight. Either drop the column for strength rows (and adjust any read sites), or author the data (mobility / olympic / hypertrophy / etc.). Decide based on whether the engine ever wants strength-side practice-type filtering. Currently nothing reads it for strength.

---

## Status of the spec after this amendment

The T4 spec v1 stands in full. This amendment supersedes only the literal SQL fragments and pre-flight assertions called out above. All decisions, throws, dispatch logic, picked counts, smoke structure, and FUTURE_SCOPE followups carry forward unchanged.

When T4 ships, the engine implements:
- Spec v1 §Mobility / §Full Body section structure
- Amendment 1 SQL fragments (this doc)
- Amendment 1 pre-flight assertions (this doc)
- Sub-assertion #6 and #8 adjustments (this doc)

Reading order for anyone picking up T4 fresh: spec v1 first (for shape and intent), then this amendment (for what the engine actually executes).

---

*Doc owner: Prashob (CEO/PM) + Claude.ai (Architect).*
*Place this doc in `D:\projects\dailyforge\Trackers\` alongside `S12-T4-mobility-fullbody-special-cases-spec.md`.*
*This amendment closes when FUTURE_SCOPE entry #8 (movement-quality tagging) ships and the engine remap is retired.*
