# S14-T1 Amendment 1 — Strength Tab Reroute

**Date:** May 7, 2026
**Source spec:** `Trackers/S14-T1-spec.md` (v1, committed `61821ee`)
**Trigger:** device test of T1's first build. See §1.

This amendment supersedes the call-site sections of the original spec (§5.3 home `_onStart` rewire). Everything else in the original spec stands.

Per Project Instructions principle #16, the original spec stays clean as v1; this amendment is its own artifact and the canonical contract for the fix-forward build.

---

## §1 — Why this amendment exists

### What we built

T1's first build (commit hash will be assigned once the reroute lands; original feature build never committed) shipped 9 deliverables per `Trackers/S14-T1-spec.md`. All 9 functioned correctly in isolation: server endpoint passed all 18 smoke assertions, model parsed cleanly, launcher correctly threw `UnimplementedError` on `cross_pillar` and `state_focus` shapes per spec.

### What broke

Device test step 3 (tap **Start** on home, expect spinner + navigation to workout page) hung. Cause: the home page session card displays whatever shape `SuggestProvider` returns; for body focus + 30/60min the engine returns `cross_pillar`; the launcher correctly threw `UnimplementedError("cross_pillar shape lands in S14-T3 (5-phase orchestrator).")`.

The launcher behaved correctly. The spec was wrong about what shape the home page would feed it.

### Engine verification

Throwaway script `server/scripts/verify-s14-t1-shapes.mjs` confirmed:

```
| entry_point   | focus    | session_shape  |
|---------------|----------|----------------|
| home          | biceps   | cross_pillar   |
| home          | full_body| cross_pillar   |
| strength_tab  | biceps   | pillar_pure    |
| strength_tab  | full_body| pillar_pure    |
| yoga_tab      | biceps   | pillar_pure (yoga) |
```

The Flutter client today hardcodes `_entryPointHome = 'home'` for all `/suggest` calls (`app/lib/providers/suggest_provider.dart:12`, used at lines 79 and 92). There is no `strength_tab` caller anywhere. T1's launcher cannot be exercised from the home page — it can only be exercised from a caller that sends `entry_point: 'strength_tab'`.

### Decision

Hybrid reroute (γ) per `Trackers/SPRINT_14_PLAN_AMENDMENT_1.md`. T1 ships strength-only via Strength tab, NOT home Start. Cross_pillar promoted to T2.

---

## §2 — Scope changes

### Deliverables that stand unchanged from `S14-T1-spec.md`

| # | Original spec § | Status |
|---|---|---|
| 1 | §4.1 — `POST /api/sessions/start-from-list` endpoint | ✅ unchanged |
| 2 | §4.1 — server JOINs `target_muscles` | ✅ unchanged |
| 3 | §4.2 — engine `metadata.focus_slug` added to all recipes | ✅ unchanged |
| 4 | §5.1 — `SessionLauncher` class (strength-only branch) | ✅ unchanged |
| 5 | §5.2 — `WorkoutSessionProvider.startFromList(...)` | ✅ unchanged |
| 6 | §5.4 — `SessionMetadata.focusSlug` field | ✅ unchanged |
| 7 | §5.5 — `ExerciseSessionCard` "target: N" hint | ✅ unchanged |
| 8 | §5.6 — `ApiConfig.sessionsStartFromList` constant | ✅ unchanged |
| 9 | §6.2 — server smoke (≥18 assertions) | ✅ unchanged |

### Deliverable that reverts (was §5.3)

**Original spec §5.3** — home `_onStart` rewired to call launcher. **REVERT.**

Replace with:

```dart
void _onStart() {
  ScaffoldMessenger.of(context).showSnackBar(
    const SnackBar(
      content: Text(
        "Strength workouts available now from the Strength tab. "
        "Full home flow lands in S14-T2.",
      ),
      duration: Duration(seconds: 3),
    ),
  );
}
```

The `_onStart` body returns to a placeholder, with text updated to reflect the new sprint reality (T2 is cross_pillar, not T3).

### New deliverables (added by reroute)

#### Deliverable R1 — Multi-entry-point support in `SuggestProvider`

**File:** `app/lib/providers/suggest_provider.dart`.

Currently:
```dart
const String _entryPointHome = 'home';
```

Add:
```dart
const String _entryPointHome = 'home';
const String _entryPointStrengthTab = 'strength_tab';  // NEW
// (placeholders for T3 / T5 — keep commented OR add now, choose at impl time)
// const String _entryPointYogaTab = 'yoga_tab';
```

Add a new method on the provider that takes an explicit entry-point. Existing `selectBodyFocus` / `selectStateFocus` continue to use `_entryPointHome` implicitly — do not change their signatures.

```dart
/// Fetch a suggested session for an explicit entry-point.
///
/// Used by entry-point-specific surfaces (Strength tab, Yoga tab) where the
/// caller knows the entry-point at compile time and wants the engine to
/// produce a pillar-pure session shape rather than the home page's
/// cross_pillar default.
Future<void> refreshForEntryPoint({
  required String entryPoint,
  required String focusSlug,
  int timeBudgetMin = 30,
}) async {
  await _runRequest(
    entryPoint: entryPoint,
    focusSlug: focusSlug,
    timeBudgetMin: timeBudgetMin,
  );
}
```

Method name and parameter shape match the existing `_runRequest` private helper (whose signature is already known per pre-flight). If `_runRequest` accepts additional fields (level overrides, bracket, etc.), expose only the ones the Strength tab needs (entry_point + focus_slug + time_budget).

**Race-condition note:** the home page's `previewFocus` race condition (Anomaly #10 from S13-T6) does NOT apply to the Strength tab. The Strength tab has no preview-on-chip-tap workflow — focus is captured at fetch time, not picker time. So `currentFocusSlug` is reliable at Start tap on this surface.

#### Deliverable R2 — "Today's strength workout" card on `StrengthPage`

**File:** `app/lib/pages/strength/strength_page.dart` (route `/strength`, bottom-nav Strength tab).

Add a new card at the **top** of the page, above whatever exists today (likely a routine list). The card mirrors the home page session-card UX as closely as possible — same visual hierarchy, same Start button styling — but driven by `entry_point: 'strength_tab'` not `entry_point: 'home'`.

**Card states:**

| State | Render |
|---|---|
| Loading | Card skeleton with spinner |
| Suggested ready | "TODAY'S STRENGTH" label, focus name (e.g. "Biceps"), duration, exercise count, **Start** button |
| Error | Card with error message + Retry button |
| Refreshing | Card with previous content dimmed + loading indicator overlay |

**Focus selection:** for T1 reroute, the Strength tab's "Today's workout" card uses **the same focus slug that home page is currently showing**. This avoids needing a Strength-tab-specific focus picker. Read from `suggest.currentFocusSlug` (the home value); if null, default to `'biceps'` or the first available body focus.

> **Open detail (architect to confirm at build time):** should the Strength tab card show *literally the same focus the home page is on* (so picking biceps on home applies everywhere), or should it default `'biceps'` regardless? The simpler shippable behavior is "default to whatever home is showing" — same focus value, but the engine produces strength_only because the entry_point is different. This avoids a second focus picker UI.

**On mount:** call `provider.refreshForEntryPoint(entryPoint: 'strength_tab', focusSlug: <currentHomeFocus>)`. Surface result on the card.

**On Start tap:** dispatch `SessionLauncher.launch(context, session)`. Same launcher as the original home spec; same error mapping; same Snackbar copy.

**Below the new card:** existing StrengthPage content remains untouched (presumably routine list + create-routine affordance). The new card is purely additive at the top.

#### Deliverable R3 — Smoke unchanged

The 18 START-FROM-LIST smoke assertions test the server endpoint's contract. The reroute doesn't change the endpoint, so smoke doesn't change. **No new smoke assertions for the reroute.** The card behavior is device-verified (UI ticket convention).

#### Deliverable R4 — Documentation updates

- `Trackers/SPRINT_TRACKER.md` row template (in original spec §11) needs one line addition: "Call site: Strength tab `/strength` page Today's-workout card. Home `_onStart` is placeholder until S14-T2."
- This amendment doc itself.

---

## §3 — Architectural shape (revised)

```
   StrengthPage          (Strength tab, bottom nav, route /strength)
   "Today's strength    │  on mount: refreshForEntryPoint('strength_tab', focus)
   workout" card        │  on tap Start: SessionLauncher.launch(ctx, session)
                         ▼
                  SessionLauncher                  ←  unchanged from spec §5.1
                  .launch(ctx, sess)
                         │
                  switch (sessionShape)
                    pillar_pure  → strength path  ←  T1 ships this
                    cross_pillar → throw          ←  T2 fills this in
                    state_focus  → throw          ←  T5 fills this in
                         │ pillar_pure + strength
                         ▼
                  WorkoutSessionProvider           ←  unchanged from spec §5.2
                  .startFromList(...)
                         │
                  POST /api/sessions/start-from-list  ←  unchanged from spec §4.1
                         │
                  WorkoutPage                      ←  unchanged from existing route
                  (pre-seed pattern: provider
                  already active when page mounts)
```

```
   Home page             (route /, bottom-nav Home)
   _onStart()           │  shows Snackbar:
                         │  "Strength workouts available now
                         │  from the Strength tab. Full home
                         │  flow lands in S14-T2."
                         │  (no navigation, no launcher call)
```

---

## §4 — Verification plan for the reroute

### Smoke

`server/scripts/test-suggestion-engine-t2.js` — same 3455/9 baseline (the 9 are pre-existing flake hedge per build report). No change.

### Device test — replaces spec §6.4 12-step flow with new 13-step flow

1. Open app, sign in.
2. Open **Strength tab** in the bottom nav.
3. Top of the page shows a "TODAY'S STRENGTH" card with focus name + duration + exercise count + Start button.
4. Tap **Start**. Spinner ~200ms.
5. Lands on `/workout` with the engine's exercises pre-loaded.
6. Each exercise card shows muscle chips below the name.
7. Each set row shows `[__] kg × [__] reps   target: 10` next to the input.
8. Log set 1 with weight=50, reps=8. Tap ✓. Set saves.
9. Repeat for sets 2 and 3. Move to next exercise. Same shape.
10. Finish workout. Summary shows totals.
11. Re-open app cold. Strength tab shows a fresh suggestion (or last suggestion, depending on caching policy — verify).
12. Tap **Home tab**. Tap a focus chip. Tap **Start** on the home card. **Verify Snackbar appears with "Strength workouts available now from the Strength tab" copy. Verify NO navigation, NO error toast.**
13. Tap **Strength tab** again. Tap **Start**. Verify second session starts cleanly.

### Pre-existing acceptance flow steps that drop

Original spec §6.4 step 11 ("Tap a different body focus. Verify focus chip updates the card without race-condition issues") is now N/A on Strength tab (no chip-based race condition there). Re-verify on **home** if home Start eventually wires through, but for T1 reroute this verification is moot.

### `flutter analyze` baseline

≤12 info hints (T1's first build preserved this; the reroute additions must too).

### `/review` grade

A- minimum. The reroute is small enough that `/review` should be straightforward.

---

## §5 — Drift log additions

Append to `Trackers/S14-T1-spec.md` §10 drift log via this amendment (do NOT edit v1 in place — the amendment is the canonical record):

| date | source | drift / decision | resolution |
|---|---|---|---|
| 2026-05-07 | architect-side error | Spec assumed `home` entry_point produces `pillar_pure` strength; engine actually produces `cross_pillar` for body focus | Reroute to Strength tab. cross_pillar belongs in T2 (promoted from T3) |
| 2026-05-07 | engine verification | `home / energize / 30min` throws `invalid bracket value: 10_to_20` | Separate state-focus engine bug; not T1's issue. Captured as `FUTURE_SCOPE` entry to address before T5 |
| 2026-05-07 | code spelunking | `SuggestProvider._entryPointHome` was hardcoded; no `strength_tab` caller existed in client | Add `_entryPointStrengthTab` constant + `refreshForEntryPoint` method |
| 2026-05-07 | hybrid reroute decision | Original Sprint 14 plan's T2/T3 swapped (cross_pillar promoted to T2; yoga demoted to T3) | `Trackers/SPRINT_14_PLAN_AMENDMENT_1.md` |

---

## §6 — Files changed (predicted) for the reroute commit

### Reverted from T1 first-build state

- `app/lib/pages/home/home_page.dart` — `_onStart` body reverted to placeholder snackbar with new copy

### New work

- `app/lib/providers/suggest_provider.dart` — `_entryPointStrengthTab` constant + `refreshForEntryPoint` method
- `app/lib/pages/strength/strength_page.dart` — new "TODAY'S STRENGTH" card at top, mounts → fetches → renders → Start tap dispatches launcher

### Documentation

- `Trackers/SPRINT_14_PLAN.md` — in-place edits per `SPRINT_14_PLAN_AMENDMENT_1.md`
- `Trackers/SPRINT_14_PLAN_AMENDMENT_1.md` — committed (rationale archive)
- `Trackers/S14-T1-AMENDMENT-1-strength-tab-reroute.md` — this file, committed

---

## §7 — Rules for the reroute build prompt

The fix-forward build prompt for Claude Code:

1. References this amendment as canonical contract for the new scope.
2. References the original spec for everything that stands unchanged.
3. Includes a pre-build pre-flight (re-verify `_entryPointHome` location, `StrengthPage` widget signature, etc.) per Project Instructions principle #14.
4. Build steps follow the same halt-on-drift discipline as the first T1 prompt.
5. Final commit message names this as "feat(s14-t1): reroute strength launcher to Strength tab" with reference to the amendment.

---

*This amendment is the canonical contract for the T1 fix-forward. Original spec stays clean as v1.*
