# Sprint 14 Plan — Amendment 1 (Hybrid Reroute)

**Date:** May 7, 2026
**Triggered by:** S14-T1 device test surfaced that home `_onStart` produces `cross_pillar` sessions, which T1's launcher explicitly does not support.
**Decision style:** Hybrid (γ) — keep T1's build (reroute call site only), promote cross_pillar to T2.

---

## What this document is

A patch description, not a replacement plan. The sprint plan file (`Trackers/SPRINT_14_PLAN.md`) gets edited in place per the patches below. This doc lives alongside as the rationale archive (drift-log discipline, per Project Instructions principle #11).

---

## What changed and why

### Trigger

Engine verification (`server/scripts/verify-s14-t1-shapes.mjs`, throwaway) confirmed:

| entry_point | focus | actual session_shape |
|---|---|---|
| `home` | biceps (body) | `cross_pillar` |
| `home` | full_body | `cross_pillar` |
| `strength_tab` | biceps | `pillar_pure` strength |
| `strength_tab` | full_body | `pillar_pure` strength |
| `yoga_tab` | biceps | `pillar_pure` yoga |

Architect-side error: original Sprint 14 plan assumed home Start could ship `pillar_pure` strength via T1. It cannot. Home Start **always** produces `cross_pillar` sessions (5-phase). T1's launcher correctly throws `UnimplementedError` on `cross_pillar` per spec — but that means home Start can't actually launch anything from T1.

### Two real choices

1. **Bottom-up (original plan):** T1 strength → T2 yoga → T3 cross_pillar. Home Start broken until T3.
2. **Top-down:** Rebuild T1 as cross_pillar from scratch. Throws away ~32 minutes of working build.

### What we picked: hybrid

Keep T1's build (it works correctly — just from the wrong call site). Reroute the call site from home `_onStart` to a new "Today's strength workout" card on `StrengthPage` (the bottom-nav Strength tab). Restore home `_onStart` to a placeholder snackbar that points users to the Strength tab until T2 ships.

Then **promote cross_pillar one slot earlier**: cross_pillar becomes T2 (was T3); yoga slides to T3 (was T2). Home Start works after T2 ships, not T3.

### Why hybrid wins

- Captures the value of T1's existing build (server endpoint, launcher abstraction, model field, hint UI, smoke harness all reused as-is).
- Home Start works one ticket sooner than original bottom-up.
- T2 (cross_pillar) inherits T1's launcher pattern proven, error-mapping pattern proven, pre-seed seam proven. Same advantage T3-as-cross_pillar would have had in the original plan.
- The Strength tab's "Today's strength workout" card isn't throwaway — it's a real feature even after T2 ships home Start (Hevy-style "today's workout" affordance).

### Cost of hybrid

- T1's commit history will show "session launcher + strength end-to-end via Strength tab" instead of "via home Start." Honest framing matches reality.
- Sprint 14 plan needs in-place edit (this doc + the patches below).
- ~2-3 hours of additional T1 work to ship the reroute (new SuggestProvider method, new card on StrengthPage, restore home placeholder).

---

## In-place edits to `Trackers/SPRINT_14_PLAN.md`

The file gets these surgical edits. Apply them in order.

### Edit 1 — Add an "Amendment 1" callout at the top

Insert after the existing front-matter / header (immediately before whatever the first H2 section is):

```markdown
> **Amendment 1 — May 7, 2026.** T1 device test surfaced that home `_onStart`
> produces `cross_pillar` sessions, not `pillar_pure` strength. Hybrid reroute
> chosen: T1 ships strength via Strength tab; cross_pillar promoted to T2; yoga
> slides to T3. Rationale: `Trackers/SPRINT_14_PLAN_AMENDMENT_1.md`.
```

### Edit 2 — T1 row update

Find the T1 row (currently scopes "launcher + strength startFromList" with home Start as the call site). Replace the call-site description so it reads:

```
**T1 — Session Launcher + strength pillar_pure end-to-end (Strength tab)**

Launcher abstraction, server `POST /api/sessions/start-from-list`, strength
branch implemented (cross_pillar/state_focus throw with sprint hand-off).
Call site: **Strength tab "Today's strength workout" card** — not home Start
(home Start awaits T2's cross_pillar). Engine `metadata.focus_slug` added.
ExerciseSessionCard "target: N" hint. SuggestProvider gains explicit
entry-point parameter (`_entryPointStrengthTab = 'strength_tab'`).

Original spec: `Trackers/S14-T1-spec.md` (committed).
Reroute amendment: `Trackers/S14-T1-AMENDMENT-1-strength-tab-reroute.md` (committed at fix-forward).
```

### Edit 3 — T2 row replacement (was yoga adapter, now cross_pillar)

Replace the original T2 row with:

```
**T2 — Cross_pillar 5-phase orchestrator + home Start**

Promoted from original T3. Builds the 5-phase orchestrator (bookend_open[breath]
→ warmup[yoga] → main[strength] → cooldown[yoga] → bookend_close[breath]).
Adds `cross_pillar` branch to `SessionLauncher` switch. Wires home `_onStart`
to launcher. Phase persistence, phase transitions, skip/shorten phase UX.

Inherits launcher pattern proven by T1.

Pre-flight depth: HIGH. The 5-phase orchestrator has known unknowns (phase
transitions, persistence schema, what-if-user-quits-mid-phase, embedded yoga
inside strength session etc.). Pre-flight runs deeper than T1's.
```

### Edit 4 — T3 row replacement (was cross_pillar, now yoga adapter)

Replace the original T3 row with:

```
**T3 — Yoga adapter + Yoga tab Start**

Demoted from original T2. Adds yoga branch to `SessionLauncher` (currently
throws). Adds "Today's yoga session" card on YogaPage (the bottom-nav Yoga
tab). Mirrors T1's Strength tab pattern.

Inherits both T1's launcher pattern and T2's any cross-cuts that surfaced.
```

### Edit 5 — T4, T5, T6 unchanged

No edits. T4 (embedded player refactor), T5 (state-focus 3-leg chain), T6 (polish) keep their original scopes and ordering.

### Edit 6 — Add an "Amendment 1 trail" footer

At the end of the file, add:

```markdown
---

## Amendment trail

| # | Date | Change | Doc |
|---|---|---|---|
| 1 | 2026-05-07 | Hybrid reroute — T1 to Strength tab, T2/T3 swap (cross_pillar promoted, yoga demoted) | `Trackers/SPRINT_14_PLAN_AMENDMENT_1.md` |
```

---

## Commit plan for Sprint 14 plan changes

These three commits go on the `s14-t1` branch (current HEAD `61821ee` = T1 spec). They land before the T1 reroute build prompt is dispatched, because the build prompt references the new T1 scope.

### Commit A — Sprint plan amendment doc

```bash
git add Trackers/SPRINT_14_PLAN_AMENDMENT_1.md
git commit -m "docs(s14): amendment 1 — hybrid reroute (T1 to Strength tab, T2/T3 swap)

T1 device test surfaced home _onStart produces cross_pillar, not pillar_pure.
Hybrid: keep T1 build, reroute call site to Strength tab. Promote cross_pillar
to T2 (was T3); demote yoga to T3 (was T2).

Full rationale in committed file."
```

### Commit B — In-place sprint plan edits

```bash
git add Trackers/SPRINT_14_PLAN.md
git commit -m "docs(s14): apply amendment 1 to sprint plan

In-place edits per Trackers/SPRINT_14_PLAN_AMENDMENT_1.md:
- Header callout
- T1 row updated (Strength tab call site, not home Start)
- T2 row replaced (cross_pillar 5-phase, was yoga)
- T3 row replaced (yoga adapter, was cross_pillar)
- Amendment trail footer added"
```

### Commit C — T1 spec amendment doc

The `Trackers/S14-T1-spec.md` file already lives on this branch. Rather than editing it in place (which would muddy the original spec's intent), we follow Project Instructions principle #16 (mid-build spec-vs-data drift gets an AMENDMENT doc, not a spec patch).

```bash
git add Trackers/S14-T1-AMENDMENT-1-strength-tab-reroute.md
git commit -m "docs(s14-t1): amendment 1 — strength tab reroute

Original spec assumed home _onStart could ship pillar_pure strength. Engine
verification proves it ships cross_pillar. Reroute call site to a new 'Today's
strength workout' card on StrengthPage (bottom-nav Strength tab).

Original spec stays as v1; this amendment is the canonical contract for the
fix-forward build."
```

The T1 amendment doc itself is the next deliverable after this sprint plan amendment is committed. It captures the fix-forward scope plainly so the reroute build prompt can reference it.

---

## What does NOT change in T1's deliverables

The 9 deliverables shipped in T1's first build are nearly all reusable:

| # | T1 deliverable | Reroute disposition |
|---|---|---|
| 1 | New endpoint `POST /api/sessions/start-from-list` | ✅ unchanged |
| 2 | Server JOINs `target_muscles` | ✅ unchanged |
| 3 | Engine adds `metadata.focus_slug` | ✅ unchanged |
| 4 | `SessionLauncher` class (strength branch) | ✅ unchanged |
| 5 | `WorkoutSessionProvider.startFromList` | ✅ unchanged |
| 6 | Home `_onStart` rewired to launcher | ❌ revert to placeholder snackbar |
| 7 | `SessionMetadata.focusSlug` model field | ✅ unchanged |
| 8 | `ExerciseSessionCard` `targetReps` param | ✅ unchanged |
| 9 | `ExerciseSessionCard` "target: N" hint render | ✅ unchanged |

**New work (added by reroute):**
- `SuggestProvider` gains explicit-entry-point method (was implicit `_entryPointHome` only). Adds `_entryPointStrengthTab = 'strength_tab'` constant.
- `StrengthPage` gains a "Today's strength workout" card (above whatever currently exists on the page). Card calls the new SuggestProvider method, then on Start tap dispatches `SessionLauncher.launch(context, session)`.
- Home `_onStart` placeholder snackbar text: *"Strength workouts available now from the Strength tab. Full home flow lands in S14-T2."*

---

## Smoke / analyze impact

T1's existing 18 START-FROM-LIST smoke assertions remain valid (they test the endpoint, not the call site). No new server-side changes from the reroute. **Smoke baseline preserved at 3455/9.**

`flutter analyze`: ≤12 info hints baseline preserved. New `StrengthPage` card and SuggestProvider method must not introduce hints.

---

*Document committed as the rationale archive. Sprint plan and T1 spec amendments follow as their own commits.*
