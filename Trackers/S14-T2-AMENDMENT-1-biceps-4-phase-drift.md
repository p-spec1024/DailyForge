# S14-T2 Amendment 1 — Biceps emits 4-phase cross_pillar (cooldown dropped)

**Date:** 2026-05-08
**Status:** Surfaced at pre-flight (Phase 0). Awaiting architect direction.
**Spec:** `Trackers/S14-T2-spec.md` v1.0
**Triggers:** Build prompt §0.3 halt-or-greenlight (engine-shape drift)
**Author:** Claude Code (build agent)

---

## Summary

Pre-flight engine-shape verification fired the spec's halt gate. **Biceps focus emits a 4-phase `cross_pillar` shape — the `cooldown` phase is missing.** No other body focus exhibits this; biceps is the only outlier across the 12 active body slugs at both 30 and 60 minute budgets. The orchestrator's locked design rule already iterates `phases.length` rather than hard-coding `== 5`, so no provider/page/widget code change is required — but the spec's §4.1 prose ("Standard cross_pillar (non-mobility, non-special) … phases.length: 5") is incorrect for biceps.

This amendment documents the drift, proposes the spec patch, confirms the orchestrator design holds, and asks the architect for direction before resuming Phase 1.

---

## Evidence

Run output: `Trackers/_scratch/S14-T2-PREFLIGHT-engine-shapes.md` (full table, all 24 tuples).

Salient rows:

| focus | budget | shape | phase_count | phases (in order) | match spec? |
|---|---|---|---|---|---|
| **biceps** | 30 | cross_pillar | **4** | bookend_open, warmup, main, bookend_close | ✗ DRIFT |
| **biceps** | 60 | cross_pillar | **4** | bookend_open, warmup, main, bookend_close | ✗ DRIFT |
| triceps | 30 | cross_pillar | 5 | open, warmup, main, cooldown, close | ✓ |
| triceps | 60 | cross_pillar | 5 | open, warmup, main, cooldown, close | ✓ |
| chest, back, shoulders, core, glutes, quads, hamstrings, calves, full_body | 30 & 60 | cross_pillar | 5 | full | ✓ |
| mobility | 30 & 60 | cross_pillar | 5 (Shape A, main=yoga) | full | ✓ |

22 of 24 tuples (11 of 12 body focuses) emit the spec'd 5-phase shape. **Only biceps drops cooldown.** Other small isolation muscles (triceps, calves) emit 5-phase normally — biceps is an outlier, not a small-muscle pattern.

For biceps the phase order is preserved (open → warmup → main → close); the engine simply omits the cooldown slot rather than reordering or returning empty items. Content types of the present phases are correct (breath/yoga/strength/breath). `metadata.focus_slug` round-trips correctly. `estimated_total_min` is reasonable (34/60 — slightly low because the cooldown slot's minutes are gone).

---

## Likely cause (not investigated, recorded for context)

The biceps-targeted yoga content pool appears small enough that the warmup yoga slot consumes the only viable item, leaving no candidate for the cooldown slot. The engine drops the cooldown phase rather than emit an empty or duplicate phase. This is consistent with the comment in `server/scripts/test-suggestion-engine-t2.js:30-31`:

> When actual phase items < spec, the session is "degraded" (tiny pool, exclusions dropped phases) and the tight drift threshold doesn't apply.

So the engine has documented "graceful degradation" semantics for cross_pillar where it elides phases when content is exhausted. The spec just didn't acknowledge that biceps actually triggers this in the current content seed.

**Engine-side investigation is OUT OF SCOPE for T2** (FUTURE_SCOPE territory; possibly the same family as the existing quads/45 flake referenced in spec §6.1). T2 rides it out.

---

## Impact on T2

### What works as-is

- **Orchestrator design rule (spec §4.2 closing line):** *"orchestrator iterates `session.phases` by index; never hard-codes `phases.length == 5`. Phase indicator segment count = `session.phases.length`."* Already covered. No code change needed.
- **`PhaseIndicator` (spec §5.4):** takes `phaseCount` as a parameter and renders that many segments. Will render 4 segments for biceps cleanly.
- **`CrossPillarSessionProvider._advance` (spec §5.2):** uses `_currentPhaseIndex + 1 < n` where `n = _session!.phases.length`. Advances through 4 phases as cleanly as 5.
- **`FivePhaseSessionPage` (spec §5.3):** the page name is now slightly misleading (it can show 4 phases), but the implementation reads `session.phases.length` everywhere. No code change.
- **Launcher validation (spec §5.1):** validates `session.phases.isEmpty`, NOT `phases.length == 5`. Biceps's 4-phase response passes through cleanly.

### What needs spec patching

1. **Spec §4.1** — table heading "Standard cross_pillar (non-mobility, non-special)" with `phases.length: 5` should add a "Biceps exception" subsection or annotate the table that biceps emits 4 phases (cooldown omitted). Recommended: keep the existing table for the 5-phase case, add a §4.1.1 "Biceps exception (cooldown elision)" subsection mirroring §4.2's mobility-special-case prose.
2. **Spec §6.5 device step 4** — *"Tap **Next phase**. Phase indicator: segment 0 green (completed), segment 1 active. Body shows 'Warm-up' + yoga item."* — fine. But device step 11's *"Tap **Next phase** through phases 2, 3, 4. After phase 4 completes, page shows snackbar…"* — implicit phases.length == 5. Recommended: rephrase to "advance through remaining phases until the indicator shows all segments complete or skipped; verify the snackbar fires on the last phase". Same for step 13 (mobility — already explicitly says "whatever count pre-flight discovered").
3. **Spec §7 acceptance row 9** — currently says *"Mobility special case advances cleanly to completion (whatever phase count engine emits)"*. Add a row 9b or amend row 9 to also cover biceps.
4. **Spec §9 drift log** — add a row dated 2026-05-08 capturing this amendment.

### What does NOT need patching

- The orchestrator class names, methods, signatures, persistence flow, resume dialog flow, route, provider tree registration. **All correct as spec'd.**
- The launcher's `_launchCrossPillar` — correct as spec'd (validates phases.isEmpty only, never length).
- The home `_onStart` rewire — correct as spec'd.
- StorageService key — correct as spec'd.

---

## Recommended resolution

**Option A — Roll forward as drift documented (recommended).**

- Keep this amendment as the canonical record; spec §4.1 prose left as-is with a forward-pointer to this amendment in the spec's drift log §9.
- Build proceeds to Phase 1 unchanged. The orchestrator just-works for biceps.
- Device-acceptance flow extended by one step: after step 13 (mobility), add step 13b: tap biceps → 30 min → Start → verify 4 segments render in indicator → advance through all 4 → verify snackbar fires.
- FUTURE_SCOPE entry: investigate biceps yoga content pool (or accept graceful degradation as engine policy).

**Option B — Patch the spec body.**

- Edit `S14-T2-spec.md` §4.1 to acknowledge biceps 4-phase shape; add §4.1.1 subsection.
- Edit §6.5 device steps 11/13 wording.
- Edit §7 acceptance row 9.
- Add drift-log row.
- Then proceed to Phase 1.

**Option C — Investigate the engine first.**

- Halt T2; open a separate ticket to inspect biceps yoga content pool.
- T2 resumes once engine returns 5-phase for biceps.
- High cost; the orchestrator already handles 4-phase cleanly, so this option only serves the principle of "spec table accuracy" not user-visible behavior.

**Recommendation: Option A.** The orchestrator code is correct; the only thing wrong is a sentence in the spec. Rolling forward with this amendment as the contract avoids spec churn and preserves the "spec is canonical" principle by treating this amendment as the authoritative diff. Lesson #1 wanted us to surface this *before* we wrote code — that goal is achieved regardless of whether we then patch the spec body or attach an amendment.

---

## Open question for architect

- **Approve Option A (roll forward, amendment is the canonical patch)?** If yes, build resumes Phase 1 as written, with one extra device-test step (biceps cold-start → 4-segment indicator → advance to completion).
- **Or Option B (patch spec body)?** If so, I will update §4.1 / §6.5 / §7 / §9 in `S14-T2-spec.md` before Phase 1.
- **Or Option C (investigate engine)?** If so, T2 halts.

Also — do you want the device-acceptance step 11 wording loosened to "advance through remaining phases until indicator shows all segments complete or skipped"? Currently the spec implies 5-phase phrasing.

---

## Out of scope for this amendment

- Engine investigation (biceps yoga pool size, recency-overlap interaction). FUTURE_SCOPE.
- Reverting the engine's "drop empty phase" graceful-degradation policy. Engine-side decision, not T2.
- The 45-min budget flake (FUTURE_SCOPE #181 already covers it).
- The energize/bracket bug (FUTURE_SCOPE #197 already covers it).
- Whether `PhaseStubView` needs a different stub layout when there are 4 vs 5 phases. **No** — same layout works; only the indicator segment count changes.

---

*Amendment 1 ends. Awaiting `/proceed Option A`, `/proceed Option B`, `/proceed Option C`, or other direction from architect.*
