# S14-T2 — Pre-flight engine shape verification

**Date:** 2026-05-08
**Lesson #1:** engine-consuming pre-flight, ran BEFORE any code changes.
**Script:** `server/scripts/verify-s14-t2-shapes.mjs` (throwaway — deleted at commit).
**Test user:** id=1 (slebouf97@gmail.com — highest-session user).

The build-prompt tuple list called out 9 tuples and used `legs` as one of them. `legs` is **not** an active focus_areas slug (the engine has separate `quads`/`hamstrings`/`calves`/`glutes` slugs), so the verify script extends the matrix to all 12 active body focuses at 30 and 60 to characterize coverage fully.

---

## Results — all 12 active body focuses × {30, 60}

| focus_slug | budget | shape | phase_count | phase order | item counts | metadata.focus_slug | est. min | match spec? |
|---|---|---|---|---|---|---|---|---|
| chest | 30 | cross_pillar | 5 | open→warmup→main→cooldown→close | 1, 1, 3 (str), 1, 1 | chest | 37 | ✓ |
| chest | 60 | cross_pillar | 5 | open→warmup→main→cooldown→close | 1, 2, 5 (str), 2, 1 | chest | 67 | ✓ |
| back | 30 | cross_pillar | 5 | open→warmup→main→cooldown→close | 1, 1, 3 (str), 1, 1 | back | 37 | ✓ |
| back | 60 | cross_pillar | 5 | open→warmup→main→cooldown→close | 1, 2, 5 (str), 2, 1 | back | 67 | ✓ |
| shoulders | 30 | cross_pillar | 5 | open→warmup→main→cooldown→close | 1, 1, 3 (str), 1, 1 | shoulders | 37 | ✓ |
| shoulders | 60 | cross_pillar | 5 | open→warmup→main→cooldown→close | 1, 2, 5 (str), 2, 1 | shoulders | 67 | ✓ |
| **biceps** | **30** | cross_pillar | **4** | open→warmup→**main**→close (NO cooldown) | 1, 1, 3 (str), —, 1 | biceps | 34 | **✗ DRIFT** |
| **biceps** | **60** | cross_pillar | **4** | open→warmup→**main**→close (NO cooldown) | 1, 1, 5 (str), —, 1 | biceps | 60 | **✗ DRIFT** |
| triceps | 30 | cross_pillar | 5 | open→warmup→main→cooldown→close | 1, 1, 3 (str), 1, 1 | triceps | 37 | ✓ |
| triceps | 60 | cross_pillar | 5 | open→warmup→main→cooldown→close | 1, 2, 5 (str), 2, 1 | triceps | 67 | ✓ |
| core | 30 | cross_pillar | 5 | open→warmup→main→cooldown→close | 1, 1, 3 (str), 1, 1 | core | 37 | ✓ |
| core | 60 | cross_pillar | 5 | open→warmup→main→cooldown→close | 1, 2, 5 (str), 2, 1 | core | 67 | ✓ |
| glutes | 30 | cross_pillar | 5 | open→warmup→main→cooldown→close | 1, 1, 3 (str), 1, 1 | glutes | 37 | ✓ |
| glutes | 60 | cross_pillar | 5 | open→warmup→main→cooldown→close | 1, 2, 5 (str), 2, 1 | glutes | 67 | ✓ |
| quads | 30 | cross_pillar | 5 | open→warmup→main→cooldown→close | 1, 1, 3 (str), 1, 1 | quads | 37 | ✓ |
| quads | 60 | cross_pillar | 5 | open→warmup→main→cooldown→close | 1, 2, 5 (str), 2, 1 | quads | 67 | ✓ |
| hamstrings | 30 | cross_pillar | 5 | open→warmup→main→cooldown→close | 1, 1, 3 (str), 1, 1 | hamstrings | 37 | ✓ |
| hamstrings | 60 | cross_pillar | 5 | open→warmup→main→cooldown→close | 1, 2, 5 (str), 2, 1 | hamstrings | 67 | ✓ |
| calves | 30 | cross_pillar | 5 | open→warmup→main→cooldown→close | 1, 1, 3 (str), 1, 1 | calves | 37 | ✓ |
| calves | 60 | cross_pillar | 5 | open→warmup→main→cooldown→close | 1, 2, 5 (str), 2, 1 | calves | 67 | ✓ |
| mobility | 30 | cross_pillar | 5 | open→warmup→main→cooldown→close (main=yoga) | 1, 1, 3 (yoga), 1, 1 | mobility | 37 | ✓ Shape A |
| mobility | 60 | cross_pillar | 5 | open→warmup→main→cooldown→close (main=yoga) | 1, 2, 5 (yoga), 2, 1 | mobility | 67 | ✓ Shape A |
| full_body | 30 | cross_pillar | 5 | open→warmup→main→cooldown→close | 1, 1, 3 (str), 1, 1 | full_body | 37 | ✓ |
| full_body | 60 | cross_pillar | 5 | open→warmup→main→cooldown→close | 1, 2, 5 (str), 2, 1 | full_body | 67 | ✓ |

(item counts column lists `bookend_open, warmup, main, cooldown, bookend_close`. `(str)` = strength content_type for that phase's items; `(yoga)` = yoga content_type for the main phase, only seen on mobility per Shape A. All bookends are breathwork; warmup/cooldown are yoga.)

---

## Halt-gate summary

| gate | result |
|---|---|
| Any tuple returns `session_shape !== 'cross_pillar'`? | ✗ no — all 24 tuples emit `cross_pillar` |
| Any standard body focus returns `phase_count !== 5`? | **✓ yes — biceps/30 and biceps/60 emit 4 phases** |
| Any phase order disagrees with open→warmup→main→cooldown→close? | ✗ no — order intact wherever a phase is present (biceps simply omits `cooldown`) |
| Any `content_type` disagrees with breath/yoga/strength/yoga/breath per index for standard focuses? | ✗ no |
| Any `metadata.focus_slug` mismatch? | ✗ no — all 24 tuples round-trip the input slug |
| Mobility shape | Shape A (5-phase, main=yoga). Orchestrator handles transparently. |

**Halt fires on biceps.** Build prompt §0.3 dictates STOP and surface — do NOT proceed to Phase 1 without architect direction.

---

## Drift summary

**Drift is narrow.** 22 of 24 tuples (11 of 12 body focuses) emit the spec'd 5-phase shape. Only biceps drops `cooldown` and emits 4 phases. Other small isolation muscles (triceps, calves) emit 5 phases normally — **biceps is an outlier, not a small-muscle pattern**.

**Likely cause (not investigated; documented for context):** the biceps-targeted yoga content pool is small enough that the warmup yoga slot consumes the only viable item, leaving no candidate for the cooldown slot. The engine drops the cooldown phase rather than emit an empty or duplicate one. This is consistent with the comment in `server/scripts/test-suggestion-engine-t2.js` ("When actual phase items < spec, the session is 'degraded' (tiny pool, exclusions dropped phases)…").

**T2 design implication:** the orchestrator's locked design rule already covers this — `PhaseIndicator` segment count = `session.phases.length`, no hard-coded `== 5`. The orchestrator code is correct as spec'd. Only the spec's §4.1 prose ("phases.length: 5" for all standard body focuses) is wrong.

**Resolution path (recommended):** Amendment 1 acknowledges biceps as an additional special-case shape (alongside mobility), spec §4.1 gets a clarifying note, no code change required. Engine-side investigation of the biceps yoga pool is **out of scope** (FUTURE_SCOPE territory — possibly the same family as the quads/45 flake referenced in §6.1's exclusion).

---

## Other observations (not halt-worthy)

- `legs` is NOT a focus_areas slug. Active body slugs: `chest, back, shoulders, biceps, triceps, core, glutes, quads, hamstrings, calves, mobility, full_body`. The build-prompt tuple list listed `legs/60`, which would have thrown `Unknown or inactive focus_slug: legs`. Verify script extended to cover all 12 instead.
- `estimated_total_min` for 30-min budget runs ~34–37 (≈+15% drift); for 60-min runs ~60–67 (≈+10% drift). Within the spec's "±10%" tolerance band for 60-min, slightly over for 30-min. Not a halt gate.
- All 24 returns include `metadata.user_levels` (verified present, not dumped to keep this report short) and `metadata.source` (engine internals).
