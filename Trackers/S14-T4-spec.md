# S14-T4 — Player embedding refactor (Spec)

**Author:** Claude.ai (PM/Architect)
**Date:** May 10, 2026
**Status:** LOCKED — drives the Claude Code build prompt for S14-T4
**Depends on:** S14-T1 (launcher + strength `startFromList`), S14-T2 (cross_pillar orchestrator + `PhaseStubView` swap point), S14-T3 (yoga adapter + `loadFromEngineSession`)
**Blocks:** S14-T5 (state-focus reuses the embedding contract for the 3-leg chain), S14-T6 (multi-phase summary screen consumes the per-phase results contract defined here)
**Branch:** `s14-t4` off `s14-t3` HEAD (sprint-chained pattern)
**Size:** L

---

## 1. Purpose

T2 shipped the cross_pillar 5-phase orchestrator with `PhaseStubView` as a placeholder body — text-only output of phase items, with a "T2 stub" banner. T4 replaces that stub with **real strength / yoga / breathwork players running embedded inside the orchestrator**, ending with a working cross-pillar end-to-end flow: pick full-body + 45 min → tap Start → orchestrator runs all 5 phases → completion summary.

The key architectural move is a **Page / Player split** across all three pillars. Today each pillar's player logic is fused with its hosting page — `WorkoutPage` owns both the `Scaffold`/`AppBar` shell and the workout state machine. Standalone usage (a route like `/workout/:id`) and embedded usage (orchestrator phase host) need the same behavior with different chrome. T4 extracts:

```
Today                                After T4
─────────────────────────────        ─────────────────────────────
WorkoutPage (Scaffold + logic)  →    WorkoutPage (Scaffold/AppBar shell)
                                     └─ StrengthPlayer (logic widget)
YogaSessionPage (Scaffold + logic) → YogaSessionPage (Scaffold shell)
                                     └─ YogaSessionPlayer (logic widget)
BreathworkTimerPage (S/A + logic) →  BreathworkTimerPage (Scaffold shell)
                                     └─ BreathworkPlayer (logic widget)
```

Standalone routes embed the page (which embeds the player). The orchestrator embeds the player directly, providing its own chrome (the `FivePhaseSessionPage` AppBar + `PhaseIndicator` strip).

A shared **`EmbeddablePlayer` interface** (Dart abstract mixin) enforces the contract every player must implement: completion callback, progress stream, partial-result hand-back. T5 reuses this interface unchanged for state-focus legs.

---

## 2. Decisions locked

| # | Decision | Choice | Rationale |
|---|---|---|---|
| 1 | Shared interface vs per-player ad-hoc | **Shared `EmbeddablePlayer` interface** (Dart abstract mixin) | Production-grade abstraction. T5 reuses for legs without re-pattern-matching. Pays off when 4th/5th player lands. |
| 2 | Strength embedding shape | **Option D — extract `StrengthPlayer` widget from `WorkoutPage`** (Page = Scaffold/AppBar shell, Widget = behavior). Same Page/Player split applied to yoga and breathwork. | A would have left `WorkoutPage`'s Scaffold/AppBar inside the orchestrator (double chrome). B would have re-implemented sequential set activation (regression risk per Lesson #3). D is ~1 day extra prep that pays off forever. |
| 3 | Phase transition UX | **Auto-advance + 3s countdown** on phase complete, with "Skip wait" button | Sprint 10's React pattern. Consistency is a product principle — mixed transitions break user mental model. Blueprint v5 §6.1: "Auto-flow between phases (no confirmation screens mid-session)". |
| 4 | Quit-mid-phase semantics | **Three quit-intent categories**, each with distinct UX (see §6) | One blanket "save partial" misses real user intents. Cleanest UX comes from naming the three intents explicitly. |
| 5 | Where the `EmbeddablePlayer` mixin lives | `app/lib/players/embeddable_player.dart` (new directory) | New top-level `players/` directory — adjacent to `launchers/`. Players are first-class citizens, not page internals. |
| 6 | Session logging strategy across phases | **One `sessions` row per pillar phase + one `cross_pillar_sessions` row tying them together** (new table in T4) | Rejected: single sessions row with phases_json blob (loses per-pillar query-ability for analytics). Rejected: only cross_pillar row (loses per-pillar history for recency engine). Chosen: two-table model preserves both views. |
| 7 | Completion summary screen | **Defer to T6** — T4 ends each phase silently into auto-advance; final phase completion returns to home with a placeholder snackbar | T6 owns the multi-phase summary screen (engine `metadata.userLevels`, time per phase, level-up impact). T4's job is the embedding plumbing, not the celebration UX. |
| 8 | Skip phase / shorten phase UX polish | **Defer to T6.** T4 ships a basic "Skip phase" button (already in T2) that calls `provider.skipCurrentPhase` — visual polish, confirm dialogs, undo grace period are T6 territory | T2 already wired skip; T4 just ensures it works through the embedded player without orphaning state. |
| 9 | Per-phase result hand-back shape | `PhaseResult` value object (immutable) — `{phase, contentType, completedAt, duration, items[]}` plus optional `pillarSpecific` map for strength sets / yoga pose times / breathwork cycles | Engine and recency layer need structured per-pillar data. A flat blob would force every consumer to re-parse. |
| 10 | What happens when an embedded player calls back into navigation today | **Embedded mode suppresses navigation calls** — `popTo`, `pushNamed`, etc. become no-ops or are routed through the host's `onPhaseComplete` callback | Standalone players today often `Navigator.pop` on session complete. Embedded mode has no parent route to pop to without breaking the orchestrator. The embed contract intercepts. |
| 11 | Engine metadata threading | Each embedded player receives `phaseMetadata: PhaseMetadata` — `{focusSlug, durationMinutes, items, level, isEmbedded: true}` | Players today take their own provider state. Embedding requires explicit phase context. |
| 12 | Provider lifecycle in embedded mode | **Each embedded player gets its own provider instance** scoped to the phase, disposed when the phase ends | Sharing the standalone-route provider would corrupt state across phases (e.g. strength provider's `isActive` would be true for the entire cross-pillar session, not just the strength phase). |
| 13 | Lesson #3 (sequential set activation) preservation | **Strength embedded MUST use the same `ExerciseSessionCard` + `SetRow` widgets** the standalone route uses — embedding extracts at the `StrengthPlayer` level, not below it | Per Lesson #3: rebuilding the strength view from scratch loses sequential activation. The Page/Player split keeps `ExerciseSessionCard` exactly where it is. |
| 14 | Standalone routes still work | All existing routes (`/workout`, `/workout/empty?routineId`, `/workout/resume`, `/yoga/session`, `/breathwork/:id`) preserved without behavior change | Regression test gate. T1's Strength tab card and T3's Yoga tab card both go through standalone — must keep working. |
| 15 | Engine `content_type` → player mapping | `'strength'` → `StrengthPlayer`; `'yoga'` → `YogaSessionPlayer`; `'breathwork'` → `BreathworkPlayer`. Hardcoded switch in `FivePhaseSessionPage`'s body builder | Engine emits stable `content_type` per phase. No need for a registry pattern at this scale. |
| 16 | Phase result persistence during cross-pillar | Each completed phase appends a `PhaseResult` to `CrossPillarSessionProvider`'s in-memory list (the existing `cross_pillar_session_v1` JSON blob extended to carry results) | T2's persistence mechanism already round-trips JSON. Extending the schema is straightforward; full session reconstruction on resume gets the completed phases back. |
| 17 | What "completion" means per pillar | Strength: all exercises logged or skipped. Yoga: all poses passed (timer-driven). Breathwork: timer reached `duration_minutes` cap or technique cycles complete. Each player owns its own definition; surfaces the moment via `onPhaseComplete()` | Players already have notions of done. No re-implementation needed. |
| 18 | Auto-advance countdown control | "Skip wait" button cancels the 3s wait and advances immediately. "Pause" button (existing T2 phase action bar) still works mid-countdown | Power users want to skip the countdown. Existing T2 controls stay functional. |
| 19 | Phase 1 (cold start) — no countdown | First phase starts with no countdown — user just tapped Start, they're ready | The 3s countdown is a transition affordance between phases; before phase 1 it's noise. |
| 20 | Handling biceps 4-phase case (FS #198) | T4 inherits T2's `phases.length` iteration. 4-phase cross_pillar runs cleanly through embedded players the same way 5-phase does | Already proven by T2 amendment. Embedded players don't care about total phase count. |

---

## 3. Pre-flight diagnostic (HALT-GATE)

**This is a Lesson #1 ticket — embedding hits real code paths in three live pillars. Pre-flight runs runnable scripts, not greps.** Halt build on any disagreement.

Pre-flight artifacts go to `Trackers/_scratch/` and are throwaway (deleted at commit time).

### 3.1 Verify each player's current navigation contract

For each of `WorkoutPage`, `YogaSessionPage`, `BreathworkTimerPage`:

1. Trace every `Navigator.*` call site in the file and its component tree.
2. Document the exit conditions (session complete, user back-button, error state, route-replacement on resume).
3. Document the AppBar source — owned by the page Scaffold, or owned by a parent route?
4. Document the back-button intercept (`WillPopScope` / `PopScope`).

**Artifact:** `S14-T4-PREFLIGHT-navigation-audit.md` — three sections, one per player. Halt if any player has navigation entanglement that can't be cleanly extracted (e.g. callback hell into `home_page`).

### 3.2 Verify provider screen-state coupling

For each provider:
- `WorkoutSessionProvider`
- `YogaSessionProvider`
- `BreathworkTimerProvider` (or whatever the breathwork provider is named — pre-flight discovers)

Check whether the provider:
1. Holds `BuildContext` references (red flag — must be untangled).
2. Holds `ScaffoldMessenger` keys (likely OK if context-passed).
3. Calls `Navigator.*` directly (red flag — must route through `onComplete` callback in embedded mode).
4. Subscribes to `WidgetsBindingObserver` for app lifecycle (likely OK; T2 does this).
5. Disposes correctly when the screen closes (must work for both standalone and embedded lifecycles).

**Artifact:** `S14-T4-PREFLIGHT-provider-audit.md`. Halt if any provider has `BuildContext` storage or direct navigation calls that can't be intercepted.

### 3.3 Verify Scaffold / AppBar / route dependencies

For each player widget tree (post-extraction target), confirm it does not implicitly depend on:
- A `Scaffold` ancestor for `ScaffoldMessenger.of(context)` snackbars
- An `AppBar`-provided `actions` slot
- A `Navigator` ancestor that's the route navigator (vs a nested navigator)
- `MediaQuery` insets that the orchestrator's chrome alters

**Artifact:** included as §3 of `S14-T4-PREFLIGHT-provider-audit.md`. Halt and document workarounds if implicit dependencies exist.

### 3.4 Verify engine `content_type` per-phase emission

Run engine against the three canonical cross-pillar focuses (full-body, biceps, hamstrings) at all three duration brackets and dump `phases[].items[].content_type` per phase. Confirm the `content_type` matches the §15 mapping: phase 1 = `breathwork`, phase 2 = `yoga`, phase 3 = `strength`, phase 4 = `yoga`, phase 5 = `breathwork`. Halt and amend if the engine emits a content_type the player switch doesn't handle.

**Artifact:** `S14-T4-PREFLIGHT-content-type-emission.md` (table). Halt if any phase emits an unexpected `content_type`.

### 3.5 Verify session logging schema

Run `\d sessions` and `\d cross_pillar_sessions` (latter doesn't exist yet — T4 creates it). Confirm:
- `sessions.workout_id` is nullable (T1 confirmed; reconfirm)
- `sessions.focus_slug` exists (T1 added; reconfirm)
- No FK constraint blocks per-phase session writes from a cross-pillar session

**Artifact:** included in `S14-T4-PREFLIGHT-content-type-emission.md`. Halt if schema drift.

### 3.6 Verify Lesson #3 contract preservation surface

Confirm `app/lib/widgets/workout/exercise_session_card.dart` and `app/lib/widgets/workout/set_row.dart` are the source of truth for sequential set activation, and that the planned `StrengthPlayer` extraction keeps these widgets in their current import path. The extraction must NOT recreate any logic that lives in these files.

**Artifact:** §4 of `S14-T4-PREFLIGHT-provider-audit.md`. Halt if extraction would split or duplicate the contract.

### 3.7 Throwaway disposition

All four pre-flight artifacts are throwaway. Deleted at commit time. The decisions they validate get folded into the T4 spec (this doc) inline if any decision needs revising.

---

## 4. The `EmbeddablePlayer` interface

```dart
// app/lib/players/embeddable_player.dart

/// Contract every pillar player must satisfy to run embedded inside a host
/// (e.g. FivePhaseSessionPage orchestrator, T5's leg manager).
///
/// Standalone usage does not require this — players are still real widgets
/// that render fine on their own routes. Embedding is opt-in via constructor
/// flag.
abstract mixin class EmbeddablePlayer {
  /// True when running inside a host. False when running on its own route.
  /// Player widgets check this to suppress AppBar / Scaffold creation,
  /// intercept Navigator calls, and route completion to onPhaseComplete.
  bool get isEmbedded;

  /// Phase metadata supplied by the host. Pillar-agnostic shape that includes
  /// engine focus_slug, duration target, items list, user level.
  PhaseMetadata get phaseMetadata;

  /// Called by the host when the phase enters or resumes.
  /// Players use this to seed their internal provider from phaseMetadata.
  Future<void> onPhaseEnter();

  /// Called by the host on tear-down (phase-skip, session-end, host-disposed).
  /// Players use this to flush in-progress state, cancel timers, dispose
  /// scoped providers.
  Future<void> onPhaseExit();

  /// Player-emitted: "I'm done." Called from inside the player when its
  /// completion condition fires (all sets logged, all poses passed, timer
  /// reached cap). Host advances to next phase on this signal.
  /// PhaseResult carries structured per-pillar data for logging + recency.
  void Function(PhaseResult) get onPhaseComplete;

  /// Player-emitted: progress 0.0 → 1.0 for the host's progress indicator.
  /// Stream so the host can listen reactively.
  Stream<double> get progressStream;
}
```

`PhaseMetadata` and `PhaseResult` are immutable value objects:

```dart
// app/lib/players/phase_metadata.dart
class PhaseMetadata {
  final String focusSlug;          // e.g. 'biceps', 'calm'
  final String phase;              // engine phase: 'warmup', 'main', 'bookend_open', etc.
  final String contentType;        // 'strength' | 'yoga' | 'breathwork'
  final int? durationMinutes;      // null for state-focus endless
  final List<SessionItem> items;   // engine-supplied, parsed from suggested_session.dart
  final UserLevels userLevels;     // {strength, yoga, breathwork}
  final bool isEmbedded;           // True when host-driven
  const PhaseMetadata({...});
}

// app/lib/players/phase_result.dart
class PhaseResult {
  final String phase;
  final String contentType;
  final DateTime completedAt;
  final Duration actualDuration;
  final List<SessionItem> items;
  final Map<String, dynamic>? pillarSpecific;  // strength: sets[], yoga: poseTimes[], breath: cycles
  final bool wasSkipped;
  final int? sessionId;            // FK to sessions row written for this phase
  const PhaseResult({...});
}
```

**Why an abstract mixin and not an interface?** Dart's `abstract mixin class` lets a player widget extend `StatefulWidget` AND implement the contract without diamond-inheritance pain. Each player's `State<T>` gets the mixin applied.

---

## 5. Per-player refactor plan

Each player follows the same Page/Player split. The Page is the standalone-route shell; the Player is the embeddable widget.

### 5.1 Strength: `WorkoutPage` → Page + `StrengthPlayer`

**Today** (`app/lib/pages/workout_page.dart`):
- `WorkoutPage` is a `StatefulWidget` that owns Scaffold + AppBar + body.
- `_initSession` reads from `WorkoutSessionProvider` and seeds the workout if not pre-seeded.
- Body is a list of `ExerciseSessionCard`s with sequential activation per Lesson #3.
- Completion calls `_finishWorkout` → POST to `/api/sessions` → `Navigator.pop` to home.

**After T4:**

`app/lib/pages/workout_page.dart` becomes a thin shell:
```dart
class WorkoutPage extends StatelessWidget {
  // ... existing constructor args (workoutId, routineId, etc.) ...
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: ..., actions: ...),
      body: StrengthPlayer(
        isEmbedded: false,
        phaseMetadata: _metadataFromRouteArgs(context),  // route → metadata adapter
        onPhaseComplete: (result) => _onComplete(context, result),
      ),
    );
  }
}
```

`app/lib/players/strength_player.dart` (new):
- `StatefulWidget` with the `EmbeddablePlayer` mixin.
- Owns the body — list of `ExerciseSessionCard`s. **No Scaffold, no AppBar.**
- Owns its own `WorkoutSessionProvider` instance via `ChangeNotifierProvider` scoped to its subtree (so embedded mode doesn't share with other phases).
- On all-sets-logged: emits `onPhaseComplete(PhaseResult{...})`. Does NOT call `Navigator.pop`.
- Standalone mode: parent `WorkoutPage` handles the post-pop navigation in its `onPhaseComplete` callback. Embedded mode: orchestrator handles it.

**Lesson #3 preservation:** `ExerciseSessionCard` and `SetRow` are imported into `StrengthPlayer` unchanged. The active-index logic stays in `ExerciseSessionCard.build`.

### 5.2 Yoga: `YogaSessionPage` → Page + `YogaSessionPlayer`

Same pattern.

`YogaSessionPage` (existing, `app/lib/pages/yoga_session_page.dart`) becomes a Scaffold shell. The pose-flow logic (timers, phase color, hold seconds) extracts to `app/lib/players/yoga_session_player.dart`.

Pre-flight §3.1 will surface whether the existing `YogaSessionPage` is already structured this way (T3's `loadFromEngineSession` work may have already separated concerns somewhat).

**Yoga completion definition:** when the last pose in the last phase (`cooldown` or `peak` if no cooldown) finishes its hold timer.

### 5.3 Breathwork: `BreathworkTimerPage` → Page + `BreathworkPlayer`

Same pattern. Breathwork is the simplest of the three because it's already mostly self-contained timer logic.

`BreathworkPlayer` honors the `phaseMetadata.durationMinutes` cap when embedded — runs the technique for the engine's budget, not the technique's full protocol cycle count. (FS #11 / Anomaly #11 from T6 territory has the long-term fix in T6; T4 does the simplest version: stop at `durationMinutes` reached.)

### 5.4 Standalone-route preservation

After extraction, all standalone routes still work:
- `/workout` → `WorkoutPage` → `StrengthPlayer(isEmbedded: false)`
- `/workout/empty?routineId=X` → `WorkoutPage` → `StrengthPlayer(...)`
- `/yoga/session` → `YogaSessionPage` → `YogaSessionPlayer(isEmbedded: false)`
- `/breathwork/:id` → `BreathworkTimerPage` → `BreathworkPlayer(isEmbedded: false)`

Regression test gate (§9 acceptance flow §9.6).

---

## 6. Quit-mid-phase semantics — three intent categories

Locked Decision #4 fans out into three distinct UX paths:

### 6.1 Intent (a) — App killed / OS cleanup (involuntary)

**Detection:** App relaunches with `cross_pillar_session_v1` blob in `StorageService` showing in-progress state and timestamp ≤24h old.

**UX:** Auto-resume on launch — no prompt. User opens the app and lands directly on `FivePhaseSessionPage` at the phase they were on, with the embedded player rehydrated from `PhaseResult`s already written.

**Implementation:** Existing T2 `resumeFromStorage` + `peekFromStorage` flow already does this for the orchestrator. T4 extends each player's hydration to consume the persisted `PhaseResult` for completed phases (so the orchestrator skips them) and the partial in-progress state for the current phase.

**Edge case:** if rehydration fails (corrupted blob, schema mismatch), fall back to "Discard or restart from current phase?" dialog.

### 6.2 Intent (b) — User intentionally quits to come back later

**Detection:** User taps the AppBar close button (the `_showCloseConfirm` already in T2). The current dialog says "Discard session?" with two options.

**T4 update:** Three options.
- **"Save and quit"** — write current `PhaseResult` for completed phases, save partial state for current phase, persist blob with a `quitIntent: 'pause'` marker. App-launch detects `pause` intent and shows the resume prompt instead of auto-resuming.
- **"End early"** — see (c) below.
- **"Cancel"** — return to session.

**Resume prompt** on next launch: dialog "Resume your <focus> session from <phase>? You completed <N> phases yesterday." with `[Resume] [Discard]` buttons.

### 6.3 Intent (c) — User ends session early because they're done

**Detection:** Same close-confirm dialog, "End early" button.

**UX:** Save all completed phases as logged sessions, discard the in-progress phase, mark cross_pillar_session row complete with `phases_completed: N`, navigate to home with a snackbar: *"Session ended — <N> phases logged."*

**Why this matters:** A user who did breath + yoga warmup + half the strength phase wants credit for the breath + yoga. They didn't fail; they made a choice. Forcing them to "complete" the strength phase to get credit is bad UX.

### 6.4 Implementation surface

`CrossPillarSessionProvider` gains:
- `quitIntent` field (`'pause' | 'end_early' | null`)
- `endEarly()` method — writes completed PhaseResults to `sessions` table, writes cross_pillar row with `phases_completed` count, clears blob, navigates home with snackbar
- `pauseAndQuit()` method — writes completed PhaseResults, persists current phase partial state, marks blob with `quitIntent: 'pause'`
- `peekFromStorage()` returns `quitIntent` so launcher can branch resume-prompt vs auto-resume

`StorageService` blob schema gets `quitIntent` and a `phaseResults: List<PhaseResult>` array.

---

## 7. Orchestrator wiring — replacing `PhaseStubView`

`FivePhaseSessionPage` body builder today:

```dart
body: Column(
  children: [
    PhaseIndicator(...),
    Expanded(child: PhaseStubView(phase: currentPhase)),  // ← TO REPLACE
    _PhaseActionBar(...),
  ],
),
```

After T4:

```dart
body: Column(
  children: [
    PhaseIndicator(...),
    Expanded(child: _buildPhaseBody(context, currentPhase)),  // ← NEW
    _PhaseActionBar(...),
  ],
),

Widget _buildPhaseBody(BuildContext context, SessionPhase phase) {
  final metadata = PhaseMetadata.fromSessionPhase(phase, ...);
  switch (phase.items.first.contentType) {
    case 'strength':
      return StrengthPlayer(
        key: ValueKey('phase-${phase.phase}'),
        isEmbedded: true,
        phaseMetadata: metadata,
        onPhaseComplete: (result) => _handlePhaseComplete(context, result),
      );
    case 'yoga':
      return YogaSessionPlayer(
        key: ValueKey('phase-${phase.phase}'),
        isEmbedded: true,
        phaseMetadata: metadata,
        onPhaseComplete: (result) => _handlePhaseComplete(context, result),
      );
    case 'breathwork':
      return BreathworkPlayer(
        key: ValueKey('phase-${phase.phase}'),
        isEmbedded: true,
        phaseMetadata: metadata,
        onPhaseComplete: (result) => _handlePhaseComplete(context, result),
      );
    default:
      throw EngineContractError('unknown content_type: ${phase.items.first.contentType}');
  }
}

Future<void> _handlePhaseComplete(BuildContext context, PhaseResult result) async {
  final provider = context.read<CrossPillarSessionProvider>();
  await provider.completeCurrentPhase(result);  // T2 method, extended to take PhaseResult
  if (provider.isLastPhase) {
    await provider.complete();  // marks session done, returns to home
  } else {
    _showAutoAdvanceCountdown();  // see §8
  }
}
```

`PhaseStubView` is deleted in T4. The "T2 stub" banner goes with it.

---

## 8. Auto-advance countdown UX

After `_handlePhaseComplete` fires (and there are more phases), show a 3-second auto-advance overlay:

```
┌────────────────────────────────────────┐
│                                         │
│        Phase complete ✓                 │
│                                         │
│        Next: <Phase name>               │
│                                         │
│        Starting in 3...                 │
│                                         │
│        [ Skip wait → ]    [ Pause ]     │
│                                         │
└────────────────────────────────────────┘
```

Implementation: `Stack` + transparent overlay above the phase body. Countdown ticks 3 → 2 → 1 → advance. `[ Skip wait → ]` cancels the wait and advances immediately. `[ Pause ]` reuses T2's existing pause flow.

First phase (cold start, just tapped Start): no countdown. Phase 2 onwards: countdown shows.

If the phase was skipped (user tapped T2's existing "Skip phase" → calls `provider.skipCurrentPhase`): no completion overlay, advance immediately to next phase.

---

## 9. Drift log

| # | Date | Source | Drift | Resolution |
|---|---|---|---|---|
| _(populated during pre-flight + build)_ | | | | |

Pre-flight is expected to surface several rows here per Lesson #1. Spec stays clean as v1; drift log is its own row-per-finding append.

---

## 10. Definition of done

1. **Cross-pillar full end-to-end with real players in all 5 phases** for full-body + 45 min: phase 1 (breath) → phase 2 (yoga warmup) → phase 3 (strength) → phase 4 (yoga cooldown) → phase 5 (breath) → home, with 5 `sessions` rows and 1 `cross_pillar_sessions` row written.
2. **All 4 cross-pillar shape variants pass:** full-body 30/45/60 min and biceps 30 min (4-phase per FS #198 amendment).
3. **Each player runs standalone** (existing routes still work — `/workout`, `/yoga/session`, `/breathwork/:id`).
4. **Each player runs embedded** (orchestrator hosts them via `EmbeddablePlayer` interface).
5. **Lesson #3 preserved** — sequential set activation in strength embedded matches strength standalone.
6. **Auto-advance + 3s countdown** works between phases, with Skip wait and Pause.
7. **Three quit intents work** — kill app + relaunch (auto-resume), tap close → "Save and quit" (resume prompt next launch), tap close → "End early" (logged-as-completed snackbar).
8. **Phase-skip flows cleanly** — orchestrator advances without orphaned player state.
9. **`flutter analyze` baseline preserved** at ≤12 info-hints.
10. **Smoke baseline preserved** at 3471/9 (T3 baseline) — server changes are minimal (one new table `cross_pillar_sessions`); add 5–8 fixture-based assertions for cross-pillar session writes (per the `smoke-fixtures.mjs` helper from S13-T7).
11. **Device acceptance flow** (§11) passes.

---

## 11. Device acceptance flow

The build prompt instructs Claude Code to stop after `flutter analyze` clean and let Prashob device-test. Claude Code does NOT auto-commit per principle #6. The acceptance flow:

1. Boot app, log in, land on home with a body-focus already selected (e.g. full-body).
2. Tap Start. Verify orchestrator opens at phase 1 (breath bookend_open) — **no countdown** (cold-start exemption).
3. Verify embedded breathwork player runs — circle animation, phase chips, audio.
4. Let phase 1 timer reach `duration_minutes`. Verify `onPhaseComplete` fires, auto-advance overlay shows "Phase complete ✓ → Next: Warmup → Starting in 3..." with Skip wait button.
5. Tap Skip wait. Verify orchestrator advances to phase 2 (yoga warmup) immediately.
6. Verify embedded yoga player runs — pose flow, hold timers, peak phase remap.
7. Let phase 2 complete naturally. Verify 3s countdown actually counts down. Verify auto-advance.
8. Verify embedded strength player runs (phase 3). Verify Lesson #3 sequential set activation works — first set pre-fills reps with `default_reps`, inactive sets show placeholders, no lock icons.
9. Log 1–2 sets. Tap close button on AppBar. Verify dialog has three options: Save and quit / End early / Cancel.
10. Tap Cancel. Verify session resumes mid-set with state intact.
11. Log all sets. Verify `onPhaseComplete` fires, auto-advance to phase 4.
12. Phase 4 (yoga cooldown) plays. Phase 5 (breath bookend_close) plays. Final phase complete → return to home with placeholder snackbar.
13. Verify in DB: 5 `sessions` rows (one per phase), 1 `cross_pillar_sessions` row tying them together.
14. **Quit intent (a) test:** start a fresh cross-pillar session, advance to phase 3, force-kill app via OS recents. Reopen app — verify auto-resume on launch lands on phase 3 with completed phases preserved.
15. **Quit intent (b) test:** start fresh, advance to phase 3, tap close → Save and quit. Verify navigation home + snackbar. Reopen app — verify resume prompt appears, tap Resume — verify session continues at phase 3.
16. **Quit intent (c) test:** start fresh, advance to phase 3, tap close → End early. Verify snackbar "Session ended — 2 phases logged." Verify in DB: 2 `sessions` rows (phase 1 + 2) + 1 `cross_pillar_sessions` row with `phases_completed: 2`.
17. **Standalone regression test:** open Strength tab "Today's strength" card → tap Start → verify standalone strength player works as before (no embedding chrome).
18. **Standalone yoga regression test:** Yoga tab "Today's yoga" card → tap Start → verify standalone yoga player works as before.
19. **Skip phase test:** start fresh, tap T2's existing "Skip phase" overflow action. Verify advance is immediate (no countdown overlay).
20. **Biceps 4-phase test:** select biceps focus, tap Start, verify 4-phase orchestrator runs end-to-end (no cooldown phase per FS #198).

If any step fails, document in drift log and fix before re-running.

---

## 12. Files changed

### New
- `app/lib/players/embeddable_player.dart` — abstract mixin
- `app/lib/players/phase_metadata.dart` — value object
- `app/lib/players/phase_result.dart` — value object
- `app/lib/players/strength_player.dart` — extracted from `WorkoutPage`
- `app/lib/players/yoga_session_player.dart` — extracted from `YogaSessionPage`
- `app/lib/players/breathwork_player.dart` — extracted from `BreathworkTimerPage`
- `app/lib/pages/session/widgets/auto_advance_overlay.dart` — 3s countdown
- `server/migrations/<datestamp>_create_cross_pillar_sessions.sql` — new table

### Modified
- `app/lib/pages/workout_page.dart` — slim to Scaffold shell hosting `StrengthPlayer`
- `app/lib/pages/yoga_session_page.dart` — slim to Scaffold shell hosting `YogaSessionPlayer`
- `app/lib/pages/breathwork_timer_page.dart` — slim to Scaffold shell hosting `BreathworkPlayer`
- `app/lib/pages/session/five_phase_session_page.dart` — replace `PhaseStubView` with switch on `content_type`; add auto-advance overlay
- `app/lib/providers/cross_pillar_session_provider.dart` — extend persistence schema with `phaseResults[]` + `quitIntent`; add `endEarly()` + `pauseAndQuit()` methods; extend `completeCurrentPhase` to take `PhaseResult`
- `app/lib/providers/workout_session_provider.dart` — make safe to instantiate scoped (current standalone behavior preserved)
- `app/lib/providers/yoga_session_provider.dart` — same
- `app/lib/providers/breathwork_*_provider.dart` — same (pre-flight discovers exact name)
- `app/lib/services/storage_service.dart` — schema bump for blob format if needed
- `app/lib/models/suggested_session.dart` — add `PhaseMetadata.fromSessionPhase()` + `SessionItem.toJson` extensions if not already present
- `server/src/routes/sessions.js` — extend session-write to optionally accept `cross_pillar_session_id` FK
- `server/scripts/test-suggestion-engine-t2.js` — add S14-T4 sub-block: 5–8 cross-pillar persistence assertions using `smoke-fixtures.mjs` helper

### Deleted
- `app/lib/pages/session/widgets/phase_stub_view.dart` — superseded
- (`Trackers/_scratch/S14-T4-PREFLIGHT-*.md` — throwaway, deleted at commit time)

---

## 13. Out of scope

- **State-focus 3-leg chain** — T5 reuses the `EmbeddablePlayer` interface for legs. T4 builds the contract; T5 consumes it.
- **Multi-phase completion summary screen** — T6.
- **Phase-skip / shorten phase visual polish** — T6.
- **Recency warning surfacing at session start** — T6.
- **Breathwork `duration_minutes` cap full polish (Anomaly #11)** — T6 owns the proper "max duration mode" in `BreathworkTimerProvider`. T4 does the simplest version: stop at `durationMinutes` reached.
- **Engine cross_pillar substitution ladder (FS #198)** — T6.
- **Yoga swap-from-engine** — T6.

---

## 14. Project Instructions principle compliance

- **#6** Claude Code stops after `flutter analyze` clean — Prashob device-tests.
- **#11** Spec-first; this doc IS the spec. Build prompt is throwaway.
- **#12** UI ticket — `/review` deferred to post-device-test judgment. (Possible re-run if device test surfaces architectural issues, not just layout drift.)
- **#14** Pre-flight diagnostic with halt-gate (§3).
- **#15** No `.5` suffix anticipated — T4 is its own ticket. Any contract-level surprise mid-build gets an AMENDMENT doc per #16.
- **#16** Mid-build spec-vs-data drift → `S14-T4-AMENDMENT-N-<topic>.md`.
- **#17** Smoke fixtures use sentinel values via `smoke-fixtures.mjs` helper.
- **#18** Architect-side review of build prompt before dispatch.
- **#19** Match repo convention — players go through `ApiService`, providers extend `ChangeNotifier`, persistence through `StorageService`.

---

*Spec authored May 10, 2026. Build prompt drafted as throwaway markdown after this spec is greenlit and pre-flight diagnostic completes.*
