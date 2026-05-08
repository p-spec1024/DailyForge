# Sprint 14 — Temporary Lessons File

> **Temporary file.** Captures lessons from S14-T1 that future Sprint 14 tickets (T2, T3, T5) need to read before spec authoring. **Retires at sprint-14 close** — at that point, the contents fold into Project Instructions principles (next regular PI refresh) or into long-term docs (the strength player UX contract).
>
> **Why temporary not PI:** Project Instructions get refreshed at sprint close per existing convention, not per ticket. But these lessons matter for T2 spec authoring **now**. A temporary file bridges the gap.
>
> **What to do with this file at sprint close:** Delete it after folding contents into:
> - Lessons #1 and #2 → Project Instructions Key Principles section (PI patches below)
> - Lesson #3 → strength player UX contract doc (location TBD; possibly `Trackers/UX_CONTRACTS.md` or the next sprint's design docs)

---

## Lesson 1 — Engine-consuming tickets must run end-to-end shape verification at pre-flight

### What happened (S14-T1)

T1's pre-flight inventoried the engine's three output shapes (`pillar_pure`, `cross_pillar`, `state_focus`) by source-grepping `suggestionEngine.js` for the literals. It did NOT verify which `(entry_point, focus_type, time_budget)` tuples produce which shape.

Spec assumed: home page Start button → `pillar_pure` strength session.
Reality: home page Start button → `cross_pillar` 5-phase session (always, for any body focus).

The mismatch surfaced at device test, after a working build had already shipped. Cost: ~32m Claude Code rebuild + ~40m architect replanning + 2 amendment docs.

### The fix going forward

Before any ticket whose spec consumes engine output, the pre-flight must include a script that:
1. Loads the engine
2. Calls it with realistic input tuples (the ones the ticket actually depends on)
3. Captures and reports the actual `session_shape` returned for each

The reference template is `server/scripts/verify-s14-t1-shapes.mjs` — built mid-T1 to surface the bug after device test, deleted at commit. **For future tickets, write this script as a normal pre-flight artifact, not a fix-up.**

### How to apply this in T2-T6

**T2 (cross_pillar 5-phase orchestrator).** Pre-flight script must verify:
- `(entry_point='home', focus='biceps', time_budget=30/60)` → expect `cross_pillar`
- `(entry_point='home', focus='full_body', time_budget=30/60)` → expect `cross_pillar`
- `(entry_point='home', focus='mobility', time_budget=30/60)` → expect `cross_pillar` or special-case
- For each, capture the exact phase sequence (bookend_open → warmup → main → cooldown → bookend_close) and the content_type within each phase

**T3 (yoga adapter).** Pre-flight script must verify:
- `(entry_point='yoga_tab', focus='biceps', time_budget=15/30/45/60)` → expect `pillar_pure` yoga
- `(entry_point='yoga_tab', focus='full_body', ...)` — same
- `(entry_point='yoga_tab', focus='mobility', ...)` → may produce `pillar_pure` mobility variant

**T5 (state-focus 3-leg chain).** Pre-flight is critical here — see Lesson 1 + the FUTURE_SCOPE entry for the bracket-value bug. Specifically:
- Determine the engine's accepted bracket-token vocabulary (the verify script tried `'10_to_20'` and got `RangeError: invalid bracket value`)
- Confirm what string the existing S13-T5 bracket picker actually emits
- Confirm the engine accepts that string

If pre-flight surfaces drift, **stop and amend the spec — do not patch around it.**

### Project Instructions patch (apply at sprint close)

Extend principle #14 by adding bullet (i):

> (i) **which `(entry_point, focus_type, time_budget)` tuple produces which `session_shape`** — verified via end-to-end engine execution against representative tuples, not source-grep of shape literals.

That single bullet captures the rule. The full lesson body above goes into the chat history, not PI.

---

## Lesson 2 — UI/layout architect calls are provisional until device-verified

### What happened (S14-T1)

During T1 spec authoring, I locked Pattern A+ ("empty input boxes WITH separate 'target: 10' sidecar hint label") over Pattern B ("pre-fill the reps input"). Reasoned through it on the spec side: A+ avoided "nudging users to overshoot fatigue."

Reality on device:
- A+ caused a 10-pixel layout overflow (yellow/black striped indicator on every set row)
- The separate target column duplicated information that should just live inside the reps input
- Reversed to B in fix-up #1

Then in fix-up #1, B applied pre-fill to ALL un-logged sets at once. Device test showed inactive sets shouldn't pre-fill — only the active (next un-logged) set. Reversed again with sequential activation in fix-up #2.

Cost: 2 fix-up cycles × (build + device-test + amend) + drift log noise.

### The fix going forward

UI decisions involving **layout** (column widths, what's visible per state, pre-fill behavior, icon presence) cannot be reliably locked from spec alone. Architect-side reasoning is welcome but should be loosely held — expect ~30-50% of layout calls to reverse on first device test.

**Practical implication:** Don't author elaborate UI spec sections trying to nail the visual call upfront. Author the smallest-possible UI per the architect's gut call. Build it. Device-test. Iterate via fix-up amendments.

The drift log captures the iteration honestly. Fix-up commits are normal, not exceptional.

### How to apply this in T2-T6

**T2 (cross_pillar 5-phase orchestrator) is the highest-risk UI ticket.** Phase transitions, mid-phase quit handling, and how the embedded strength/yoga/breath players visually compose are all layout decisions that may need device iteration. Spec what's necessary; expect amendments. Don't try to nail the phase-transition animation in the original spec.

**T3 (yoga adapter):** smaller. Mostly mirrors T1's Strength tab pattern. Lower risk, but same posture.

**T5 (state-focus):** the 3-leg chain UI is novel. Treat it like T2 — spec the contract, build the smallest version, expect device-driven iteration.

**T6 (polish):** by definition this is where deferred layout fixes get cleaned up. Budget time for it.

### Project Instructions patch (apply at sprint close)

Add new principle #20:

> **#20 — UI/layout architect calls are provisional until device-verified.** Architect-side reasoning about visual hierarchy, column widths, pre-fill behavior, icon presence, and other layout-level UX is expected to reverse on first device test ~30-50% of the time. Locking such decisions in the spec is appropriate; treating them as immutable is not. Fix-up amendments for layout calls are normal, not exceptional. The spec drift log is authoritative.

---

## Lesson 3 — Strength player UX contract: sequential set activation

### What happened (S14-T1)

Sequential activation became the locked strength player UX through fix-up #2. The contract is:

**At any moment within a strength session, exactly one set is "active"** — the first un-logged set in order.

| Set state | Reps input | Kg input | ✓ button | Visual |
|---|---|---|---|---|
| **Active** (first un-logged) | Pre-filled with `default_reps` (e.g. `10`) from engine | Empty placeholder `kg`, OR pre-filled from previous-performance if available (existing behavior) | Interactive | Full opacity |
| **Inactive un-logged** (sets after the active one) | Empty placeholder `reps` | Empty placeholder `kg` | Non-interactive | Greyed via opacity 0.4. **No lock icon.** |
| **Logged** (saved) | Saved value, muted/green text style | Saved value, muted/green text style | Confirmed checkmark or hidden | Existing logged-row pattern |

Transition: when the user logs the active set (taps ✓), the row transitions to "logged" state and the next un-logged set becomes "active" (reps input pre-fills, kg accepts entry, ✓ becomes interactive).

### Why this matters for T2

T2 (cross_pillar 5-phase orchestrator) embeds the strength player as one of its 5 phases. **T2 must preserve this contract.**

Two implementation paths:
- **Embed `WorkoutPage`** (or its components) inside the orchestrator. The contract carries automatically — `ExerciseSessionCard` and `SetRow` already implement it. Lower risk.
- **Rebuild the strength view from scratch** within the orchestrator (e.g. a custom embedded layout). The contract must be re-implemented. Higher risk; easy to regress to "all sets pre-filled" or "lock icons on inactive."

**Recommended:** embed the existing components. T2's spec should explicitly state this and reference §10 of `Trackers/S14-T1-spec.md` (or this lesson file) for the contract.

### Files implementing the contract today

- `app/lib/widgets/workout/exercise_session_card.dart` — computes `activeIndex = sets.indexWhere((s) => !s.completed)` per render and passes `isActive: i == activeIndex` to each `SetRow`.
- `app/lib/widgets/workout/set_row.dart` — accepts `isActive` and `isLogged` parameters; gates pre-fill, placeholder rendering, and ✓ button interactivity accordingly. Uses `didUpdateWidget` to handle the inactive→active transition (when the previous set logs).

### How to apply this in T2-T6

**T2:** preserve the contract in the embedded strength phase. If T2's orchestrator renders strength differently (e.g. one exercise at a time instead of a scrollable list), the contract still applies — it's per-exercise-card, not per-page.

**T3:** yoga has its own UX (timer-based pose holds, not set-based). Sequential activation as defined here is **strength-specific**. Don't try to map it to yoga.

**T5:** state-focus is breathwork-only. Same as T3 — the contract doesn't apply directly. Breathwork has its own player UX.

### Long-term home

When this file retires at sprint-14 close, this contract probably wants to live in:
- A new `Trackers/UX_CONTRACTS.md` if other contracts surface during T2-T6 (likely — yoga player and breathwork player will each need their own contracts)
- OR a comment block at the top of `app/lib/widgets/workout/exercise_session_card.dart` if no other contracts emerge

Decide at sprint close based on how many contracts have accumulated.

---

## Retirement plan

At sprint-14 close (after T6 ships and all 6 tickets close):

1. **Apply the PI patches** (Lesson 1 bullet (i) into #14; Lesson 2 as new #20). One commit: `chore(pi): fold S14-T1 lessons into Project Instructions`.

2. **Decide on Lesson 3's long-term home** based on whether T2-T6 surfaced other UX contracts. Either create `Trackers/UX_CONTRACTS.md` or add a header comment to the relevant Flutter widget file.

3. **Delete this file** (`Trackers/SPRINT_14_LESSONS.md`). Single commit: `chore(s14): retire temporary lessons file post sprint close`.

This file should not survive sprint-14 close. Its purpose is bridging the gap between "T1 just shipped" and "PI gets refreshed at sprint close." If it's still here in Sprint 15, something went wrong.

---

*Created May 8, 2026, post S14-T1 ship. Author: Claude.ai (architect). Retires at sprint-14 close.*
