# S14-T5 — State-focus 3-leg chain (Spec)

**Author:** Claude.ai (PM/Architect)
**Date:** May 11, 2026
**Status:** LOCKED — drives the Claude Code build prompt for S14-T5
**Depends on:** S14-T1 (launcher), S14-T4 (`EmbeddablePlayer` mixin, `PhaseMetadata`, `PhaseResult`, `BreathworkPlayer`, persistence schema)
**Blocks:** S14-T6 (silent-sit polish in cross-pillar will consume the same `SilentTimerPlayer`; recency warnings + breathwork max-duration cap depend on T5 paths)
**Branch:** `s14-t5` off `s14-t4` HEAD (sprint-chained pattern)
**Size:** M

---

## 1. Purpose

State-focus sessions (calm, energize, focus, sleep, recover) emit a **3-phase chain: centering → practice → reflection**. All three are `content_type: 'breathwork'`. Centering and practice play breathwork techniques. **Reflection has `content_id: null`** and is silent — a quiet countdown screen with "Breathe naturally" prompt.

T4 shipped cross-pillar end-to-end. T5 completes the trio by wiring `_launchStateFocus` into the same launcher, building the missing player surfaces, and reusing T4's persistence + quit-intent + auto-advance plumbing.

Two enterprise-grade abstractions land in T5 that pay off across the rest of the app's lifetime:

1. **`MultiPhaseSessionProvider` base class** — T4's `CrossPillarSessionProvider` and T5's new `StateFocusSessionProvider` both inherit. Keeps cross-pillar's high-energy workflow and state-focus's calm-session workflow free to diverge cleanly.
2. **`SilentTimerPlayer` generic widget** — reflection uses it; cross-pillar's "silent sit" at the end of phase 5 (Blueprint v5 §6) will reuse it in T6.

---

## 2. Decisions locked

| # | Decision | Choice | Rationale |
|---|---|---|---|
| 1 | Multi-phase manager architecture | **Option C** — extract base `MultiPhaseSessionProvider`; `CrossPillarSessionProvider` and new `StateFocusSessionProvider` both inherit | The two session types look identical today by coincidence of current spec, not stability. Endless mode (state-only) and 3s auto-advance countdown (cross-pillar-only) are real divergences. Base class costs ~30 extra LOC today, saves an `if (sessionType==...)` god-object over time. |
| 2 | Reflection silent-timer implementation | **Option C** — new generic `SilentTimerPlayer` in `app/lib/players/` | T6 reuses for cross-pillar's "1-min silent sit" (Blueprint v5 §6). Reusable from day one. Better than a flag inside `BreathworkPlayer`. |
| 3 | Endless practice UX (`mode: 'open_ended'`) | **Option B** — stopwatch counting up + "I'm done" button | Honest information; matches Othership / Breathwrk patterns. Hides-elapsed-time toggle deferred to T6 polish. |
| 4 | Endless reflection UX (`mode: 'user_triggered'`) | **Option A** — silent screen + "I'm done" button (no timer shown) | Reflection should feel timeless. Calm / Insight Timer hide elapsed time during silent reflection on purpose. |
| 5 | Skip semantics for state-focus stages | **Option B** — confirm dialog before skip on all stages | State-focus users may be in emotionally sensitive states (anxiety, sleep prep). Two-tap friction prevents accidental skips. Industry pattern across Headspace / Calm / Insight Timer. |
| 6 | Where the base provider lives | `app/lib/providers/multi_phase_session_provider.dart` (new) | Adjacent to existing `cross_pillar_session_provider.dart`. Same `providers/` directory — not extracted to a new namespace. |
| 7 | Where `StateFocusSessionProvider` lives | `app/lib/providers/state_focus_session_provider.dart` (new) | Parallel naming with `cross_pillar_session_provider.dart`. |
| 8 | `CrossPillarSessionProvider` refactor scope | Refactor in place to extend base; preserve all T4 public API exactly. Subclass-only behavior: 3s auto-advance countdown stays in `CrossPillarSessionProvider`. | T4's tests + call sites stay green. Subclass override is purely additive. |
| 9 | State-focus auto-advance UX | **No 3s countdown between legs.** Smooth fade (300ms) → next leg appears. | Calm sessions shouldn't have countdown chimes/visual urgency. Override `_showAutoAdvanceCountdown` in `StateFocusSessionProvider` to no-op + return immediately. |
| 10 | Stage-name labels (consumed by `phaseDisplayLabel()` from T4 fix) | Already wired: `centering` → "Centering", `practice` → "Practice", `reflection` → "Reflection" | No new label mapping needed. T4's `phase_label.dart` already covers state-focus slugs. |
| 11 | Skip confirm dialog text | Bottom-sheet (consistent with T4's end-session sheet), three buttons: `[Skip this stage]` `[Stay here]` — exactly two options, not three. Title: "Skip centering?" / "Skip practice?" / "Skip reflection?" | Two-option sheet is consistent with the end-session sheet pattern (which has three because there are three intents). Skip is binary. |
| 12 | Stopwatch display format in endless practice | `MM:SS` if under 1 hour, `HH:MM:SS` past 1 hour. Counts up from 0. Updates every second. | Matches every stopwatch app convention. No fancy display logic needed. |
| 13 | "I'm done" button positioning | Bottom of screen, centered, full-width minus 32px padding. Same Material Button style as T4's `[ Skip wait → ]`. Always tappable (no min-duration gate). | Consistent with T4. No min-duration gate because the user is the authority in endless mode. |
| 14 | What "completion" means per leg | Centering & practice (timed): timer reaches `duration_minutes`. Practice (open_ended): user taps "I'm done." Reflection (timed): timer reaches 0. Reflection (user_triggered): user taps "I'm done." | Three completion modes, mapped clearly to engine's `mode` field on each item. |
| 15 | Logging schema | Reuse T4's `cross_pillar_sessions` table. Rename to `multi_phase_sessions` at T5 build time. Both `cross_pillar` and `state_focus` sessions write rows to it. Adds `session_shape` column (`'cross_pillar'` \| `'state_focus'`). | T4's table was named too narrowly. Renaming now while only T4 uses it is cheap. Avoids a `state_focus_sessions` parallel table. Migration runs against prod Neon (no dev DB). |
| 16 | Per-leg session row | Same as T4: one `breathwork_sessions` row per non-reflection leg (centering + practice). **Reflection writes no row** — `content_id: null` doesn't fit `breathwork_sessions` schema. Reflection's existence is captured only via the parent `multi_phase_sessions.phases_completed` count + the in-blob `PhaseResult` array. | Keeps `breathwork_sessions` schema honest (every row maps to a real technique). The parent multi_phase row carries the "user did reflection" fact. |
| 17 | Reflection log strategy if user ever wants it later | T5 ships reflection-as-unlogged (decision #16). FUTURE_SCOPE entry filed: "Reflection sessions table for analytics on silent practice time." | Today's recency engine doesn't need reflection data. Don't build storage we don't consume. |
| 18 | Endless practice DB write | Engine emits `duration_minutes: null` for endless practice. On user-tap "I'm done": write `breathwork_sessions` row with `duration_seconds = actual elapsed time from stopwatch`. | Endless ≠ unlogged. We want the elapsed time captured for level/recency calculations. The engine's null `duration_minutes` is a *budget* signal; actual elapsed is the *outcome*. |
| 19 | Cold-start with no breathwork level | If `userLevels.breathwork` is missing or null, default behavior: assume `beginner`. Engine already enforces level before reaching the player. | Defensive guard; engine should never emit a state-focus session for a user without a breathwork level, but we don't crash. |
| 20 | Auto-resume policy from T4 | Inherited from base provider unchanged. State-focus session interrupted by app-kill → auto-resume on launch. "Save and quit" → resume prompt. "End early" → log completed legs + snackbar. | T4's three quit intents work identically here. Base class owns the persistence + intent semantics. |
| 21 | Quit-mid-leg snackbar wording | Cross-pillar says "Session complete — N phases logged." State-focus says **"Session complete — N stages logged."** | "Stages" reads more naturally for state-focus than "phases." Cosmetic but matters for product polish. |
| 22 | Lesson #3 not relevant | State-focus is breathwork-only. No sequential set activation applies. | Out of scope. Skip mention in pre-flight. |
| 23 | T4's `EmbeddablePlayer` mixin reuse | `BreathworkPlayer` (existing from T4) is reused as-is for centering and practice legs. `SilentTimerPlayer` (new) implements `EmbeddablePlayer` from scratch for reflection. | Zero changes to T4's `BreathworkPlayer`. T5 only adds. |
| 24 | Where the launcher branch lives | `app/lib/launchers/session_launcher.dart` — fill in the T1-stubbed `_launchStateFocus` method | T1 stubbed this with `throw UnimplementedError('lands in S14-T5')`. T5 fills it in. |

---

## 3. Pre-flight diagnostic (HALT-GATES)

State-focus hits real engine output and the T4-built infrastructure. **Run all 4 halt-gates before writing production code.** Artifacts go to `Trackers/_scratch/`, throwaway, never committed.

### 3.1 — Engine state-focus shape verification

Run the engine against all 5 state focuses (calm, energize, focus, sleep, recover) at brackets `0_10`, `10_20`, `21_30`, `30_45`, `endless`. Use a throwaway `server/scripts/verify-s14-t5-shapes.mjs` (delete at commit time).

For each combination, dump:
- `session_shape` (expect `'state_focus'`)
- `phases.length` (expect `3`)
- `phases[i].phase` values (expect `'centering'`, `'practice'`, `'reflection'`)
- `phases[i].items[0].content_type` (expect `'breathwork'` for all three)
- `phases[i].items[0].content_id` (expect non-null for centering + practice; **expect null for reflection**)
- `phases[i].items[0].mode` (expect `'timed'` for centering; `'timed'` or `'open_ended'` for practice; `'timed'` or `'user_triggered'` for reflection)
- `phases[i].items[0].duration_minutes` (expect int for `'timed'`; null for `'open_ended'`/`'user_triggered'`)

**Artifact:** `S14-T5-PREFLIGHT-engine-shapes.md` — 25 rows (5 focuses × 5 brackets), columns as above.

**HALT** if any focus emits a different shape, or `mode` enum drifts from spec §6.

### 3.2 — `BreathworkPlayer` reflection-shape handling

`BreathworkPlayer` was built in T4 for techniques with `content_id != null`. Reflection has `content_id: null`. Verify that **`BreathworkPlayer` is NEVER instantiated for reflection legs**:

1. Trace the launcher → orchestrator path: confirm reflection's `SessionItem` will be routed to `SilentTimerPlayer`, not `BreathworkPlayer`.
2. Confirm the routing switch in the orchestrator body builder dispatches on more than just `content_type`. Need a secondary check: `if (item.contentType == 'breathwork' && item.contentId == null) → SilentTimerPlayer`.

**Artifact:** `S14-T5-PREFLIGHT-routing-check.md` — code snippet showing the proposed routing switch.

**HALT** if `BreathworkPlayer` would receive a null `content_id` anywhere on the call path.

### 3.3 — Schema migration impact (`cross_pillar_sessions` → `multi_phase_sessions`)

Verify the migration plan:
1. `\d cross_pillar_sessions` against prod Neon — confirm current shape (id, user_id, focus_slug, started_at, completed_at, phases_completed, total_phases, end_intent).
2. Verify FK from `sessions.cross_pillar_session_id` → `cross_pillar_sessions.id`.
3. Plan the rename: `ALTER TABLE cross_pillar_sessions RENAME TO multi_phase_sessions; ALTER TABLE multi_phase_sessions ADD COLUMN session_shape TEXT NOT NULL DEFAULT 'cross_pillar';` followed by `ALTER TABLE multi_phase_sessions ALTER COLUMN session_shape DROP DEFAULT;`
4. Also rename FK column: `ALTER TABLE sessions RENAME COLUMN cross_pillar_session_id TO multi_phase_session_id;`
5. Also rename FK on `breathwork_sessions`: `ALTER TABLE breathwork_sessions RENAME COLUMN cross_pillar_session_id TO multi_phase_session_id;`
6. Index name: `ALTER INDEX idx_cps_user RENAME TO idx_mps_user;`

Verify no other tables reference `cross_pillar_session_id` or `cross_pillar_sessions` by grep on `server/` codebase.

**Artifact:** `S14-T5-PREFLIGHT-schema-migration.md` — full migration script + grep findings.

**HALT** if any code path outside T4's three-table change references the old name (it should be confined; T4 just shipped).

### 3.4 — `EmbeddablePlayer` contract revisit

T4's `EmbeddablePlayer` mixin: `bool isEmbedded`, `PhaseMetadata phaseMetadata`, `onPhaseEnter()`, `onPhaseExit()`, `onPhaseComplete(PhaseResult)`, `Stream<double> progressStream`.

For `SilentTimerPlayer`, verify:
- `progressStream` — for timed reflection: emit 0.0 → 1.0 as timer counts down. For `user_triggered` reflection: emit 0.0 once and don't change (no progress to report; user is in control).
- `onPhaseComplete` — called on timer-reaches-zero OR user taps "I'm done."
- `PhaseResult.pillarSpecific` — what does silent timer record? Just `{actualDurationSeconds: int}`. No technique cycles, no breath counts. Keep minimal.

**Artifact:** §2 of `S14-T5-PREFLIGHT-routing-check.md`.

**HALT** if any field of `EmbeddablePlayer` can't be cleanly implemented for the silent case.

### 3.5 — Throwaway disposition

All 4 pre-flight artifacts deleted at commit time. Their findings either flow into the spec inline (if a decision needs revising) or into a drift-log row (if surfaced mid-build).

---

## 4. Architecture: base + subclasses

### 4.1 — `MultiPhaseSessionProvider` (new abstract base)

`app/lib/providers/multi_phase_session_provider.dart`:

```dart
abstract class MultiPhaseSessionProvider with ChangeNotifier {
  // Core state (subclasses inherit)
  SuggestedSession? _currentSession;
  int _currentPhaseIndex = 0;
  final List<PhaseResult> _phaseResults = [];
  String? _quitIntent;
  DateTime? _startedAt;
  
  SuggestedSession? get currentSession => _currentSession;
  int get currentPhaseIndex => _currentPhaseIndex;
  List<PhaseResult> get phaseResults => List.unmodifiable(_phaseResults);
  int get phasesCompleted => _phaseResults.where((r) => !r.wasSkipped).length;
  bool get isLastPhase => _currentPhaseIndex == (_currentSession?.phases.length ?? 0) - 1;
  String? get quitIntent => _quitIntent;
  
  // Abstract — each subclass declares its session shape + storage key
  String get sessionShape;  // 'cross_pillar' | 'state_focus'
  String get storageKey;    // 'cross_pillar_session_v1' | 'state_focus_session_v1'
  
  // Abstract — each subclass owns transition UX
  Future<void> onPhaseComplete(PhaseResult result);   // can override countdown vs fade
  
  // Concrete — shared lifecycle
  Future<void> startFresh(SuggestedSession session) async { ... }
  Future<void> resumeFromStorage() async { ... }
  Future<MultiPhasePeek?> peekFromStorage() async { ... }
  Future<void> completeCurrentPhase(PhaseResult result) async { ... }
  Future<void> skipCurrentPhase() async { ... }
  Future<void> endEarly(BuildContext context) async { ... }
  Future<void> pauseAndQuit(BuildContext context) async { ... }
  Future<void> complete() async { ... }
  Future<void> discard() async { ... }
  
  // Concrete — persistence (uses storageKey + sessionShape)
  Future<void> _persist() async { ... }
  Future<void> _clearStorage() async { ... }
  Future<void> _writeMultiPhaseSessionRow({required String endIntent}) async { ... }
}
```

The 6 lifecycle methods (`startFresh`, `resumeFromStorage`, etc.) move from T4's `CrossPillarSessionProvider` into the base. They're 95% identical to what T4 has — just generic over the abstract `storageKey` + `sessionShape`.

### 4.2 — `CrossPillarSessionProvider` refactor

Existing class (T4) reduced to:

```dart
class CrossPillarSessionProvider extends MultiPhaseSessionProvider {
  @override String get sessionShape => 'cross_pillar';
  @override String get storageKey => 'cross_pillar_session_v1';
  
  @override
  Future<void> onPhaseComplete(PhaseResult result) async {
    await completeCurrentPhase(result);
    if (isLastPhase) {
      await complete();
      // navigate home + snackbar (cross_pillar wording)
    } else {
      _showAutoAdvanceCountdown();  // 3s overlay (T4)
    }
  }
  
  void _showAutoAdvanceCountdown() { ... }  // moves from T4 spec into here
}
```

**T4's public API preserved exactly.** All call sites in `session_launcher.dart`, `FivePhaseSessionPage`, etc. continue working without modification.

### 4.3 — `StateFocusSessionProvider` (new)

```dart
class StateFocusSessionProvider extends MultiPhaseSessionProvider {
  @override String get sessionShape => 'state_focus';
  @override String get storageKey => 'state_focus_session_v1';
  
  @override
  Future<void> onPhaseComplete(PhaseResult result) async {
    await completeCurrentPhase(result);
    if (isLastPhase) {
      await complete();
      // navigate home + snackbar ("N stages logged")
    } else {
      // No countdown — calm session. 300ms fade transition handled by widget.
      // Provider just calls notifyListeners(); host widget AnimatedSwitcher fades.
    }
  }
}
```

Override is 4 lines. The "calm session" decision lives entirely in this class — no `if (sessionType==...)` polluting the base.

### 4.4 — Provider registration in `main.dart`

```dart
ChangeNotifierProvider(create: (_) => CrossPillarSessionProvider()),
ChangeNotifierProvider(create: (_) => StateFocusSessionProvider()),
```

Both registered. T4's existing `CrossPillarSessionProvider` registration stays exactly as it is; new state-focus provider sits alongside.

---

## 5. Reflection player — `SilentTimerPlayer`

### 5.1 — File

`app/lib/players/silent_timer_player.dart` (new). Implements `EmbeddablePlayer` from scratch (does not extend `BreathworkPlayer`).

### 5.2 — UX — `timed` mode (non-endless reflection, plus future cross-pillar silent sit)

```
┌────────────────────────────────────────┐
│                                         │
│                                         │
│          Breathe naturally              │   ← prompt text, center-top
│                                         │
│                                         │
│             [ ◐◐◐◐◐ ]                   │   ← soft circle/progress indicator
│                                         │
│              02:34                      │   ← countdown timer (MM:SS)
│                                         │
│                                         │
│                                         │
│        [   I'm done    ]                │   ← optional early-exit button
│                                         │
└────────────────────────────────────────┘
```

**Behavior:**
- Background: matches surrounding session screen (dark theme, low contrast).
- Prompt: "Breathe naturally" — single line, mid-weight font, soft contrast.
- Visual: a subtle filling/draining circle (soft, no animated stripes) representing time remaining.
- Timer: `MM:SS` countdown. Counts down to 00:00 — at which point `onPhaseComplete` fires.
- Early-exit button: present so users can advance without waiting. Tap → `onPhaseComplete` with `wasSkipped: false` (early exit ≠ skip; counts as completed).

### 5.3 — UX — `user_triggered` mode (endless reflection only)

```
┌────────────────────────────────────────┐
│                                         │
│                                         │
│          Breathe naturally              │
│                                         │
│                                         │
│             [ ◯◯◯◯◯ ]                   │   ← soft static visual (no countdown)
│                                         │
│              ─────                      │   ← no timer shown
│                                         │
│                                         │
│                                         │
│        [   I'm done    ]                │
│                                         │
└────────────────────────────────────────┘
```

**Behavior:**
- Identical to §5.2 except: no countdown timer rendered, no progress fill on the circle (static visual).
- Only way to advance is the "I'm done" button.
- `progressStream` emits 0.0 once at `onPhaseEnter` and doesn't update.

### 5.4 — Implementation shape

```dart
class SilentTimerPlayer extends StatefulWidget {
  final PhaseMetadata phaseMetadata;
  final bool isEmbedded;
  final void Function(PhaseResult) onPhaseComplete;
  // ...
}

class _SilentTimerPlayerState extends State<SilentTimerPlayer>
    with EmbeddablePlayer, SingleTickerProviderStateMixin {
  Timer? _ticker;
  int _elapsedSeconds = 0;
  late final bool _isTimed;
  late final int _totalSeconds;
  
  @override
  void initState() {
    super.initState();
    final item = widget.phaseMetadata.items.first;
    _isTimed = item.mode == 'timed';
    _totalSeconds = _isTimed ? (item.durationMinutes ?? 0) * 60 : 0;
    if (_isTimed) {
      _ticker = Timer.periodic(const Duration(seconds: 1), _tick);
    }
  }
  
  void _tick(Timer t) {
    setState(() => _elapsedSeconds++);
    if (_isTimed && _elapsedSeconds >= _totalSeconds) {
      _complete(early: false);
    }
  }
  
  void _onUserDoneTap() => _complete(early: true);
  
  void _complete({required bool early}) {
    _ticker?.cancel();
    widget.onPhaseComplete(PhaseResult(
      phase: widget.phaseMetadata.phase,
      contentType: 'breathwork',
      completedAt: DateTime.now(),
      actualDuration: Duration(seconds: _elapsedSeconds),
      items: widget.phaseMetadata.items,
      pillarSpecific: {'actualDurationSeconds': _elapsedSeconds, 'wasEarlyExit': early},
      wasSkipped: false,
      sessionId: null,
    ));
  }
  
  // build() renders the appropriate UI per _isTimed
}
```

### 5.5 — Future reuse note

T6 will use this widget for cross-pillar's end-of-session "1 min silent sit" (Blueprint v5 §6). The cross-pillar phase 5 (`bookend_close`) currently runs breathwork to its `duration_minutes` and then ends; T6 adds a silent-sit overlay phase that uses `SilentTimerPlayer` for the last 60 seconds. T5 doesn't build this — just keeps the widget API clean enough for T6.

---

## 6. Practice endless mode (`open_ended`)

Endless practice = engine `mode: 'open_ended'`, `duration_minutes: null`. `BreathworkPlayer` (T4) runs the technique without a duration cap; user taps "I'm done" to advance.

### 6.1 — `BreathworkPlayer` extension

Minimal change to T4's `BreathworkPlayer`:

1. **If `phaseMetadata.items.first.mode == 'open_ended'`:**
   - Don't run the duration cap loop (today T4 stops at `duration_minutes` reached).
   - Add a stopwatch row to the player UI (above the existing technique controls), counting up `MM:SS` (or `HH:MM:SS` past 1 hour).
   - Add an "I'm done" button at the bottom.
   - On user tap → `onPhaseComplete(PhaseResult(actualDuration: stopwatch elapsed, ...))`.

2. **`PhaseResult.pillarSpecific` for endless practice:**
   ```dart
   {
     'actualDurationSeconds': elapsedSeconds,
     'techniqueId': item.contentId,
     'mode': 'open_ended',
     'cyclesCompleted': cyclesCount,  // optional; null if technique is non-cyclic
   }
   ```

3. **DB write on completion:** `breathwork_sessions` row with `duration_seconds = actualDurationSeconds`. Even though the engine emitted null `duration_minutes`, the actual elapsed time gets logged so the recency engine + level calculations stay correct.

### 6.2 — Visual treatment

```
┌────────────────────────────────────────┐
│                                         │
│         Box Breathing                   │   ← technique name (T4 already shows)
│                                         │
│       [ animated circle ]               │   ← T4's existing inhale/hold/exhale UI
│                                         │
│                                         │
│              03:47                      │   ← NEW: stopwatch counting up
│              elapsed                    │
│                                         │
│                                         │
│        [   I'm done    ]                │   ← NEW: explicit end button
│                                         │
└────────────────────────────────────────┘
```

Stopwatch sits below the technique animation. "I'm done" button at the bottom of the screen.

---

## 7. Skip confirm dialog

### 7.1 — Trigger

User taps overflow menu → "Skip stage" while on any of centering, practice, or reflection.

### 7.2 — Sheet

Bottom sheet (consistent with T4's end-session sheet pattern):

```
┌──────────────────────────────────────┐
│                                      │
│  Skip practice?                      │   ← title varies by stage name
│                                      │
│  This stage will be marked as        │   ← optional body line
│  skipped in your session log.        │
│                                      │
│  [ Skip this stage ]                 │
│  [ Stay here       ]                 │
│                                      │
└──────────────────────────────────────┘
```

### 7.3 — Behavior

- Tap **Skip this stage** → `provider.skipCurrentPhase()` (inherited from base) → advances to next leg silently (state-focus has no countdown; cross-pillar's countdown is also suppressed per T4 spec §8).
- Tap **Stay here** → dismiss sheet, session continues.
- The `PhaseResult` for a skipped leg has `wasSkipped: true`, `actualDuration: Duration.zero`, no DB row written.

### 7.4 — Where the skip lives in the UI

The skip-stage action sits in the `FivePhaseSessionPage` AppBar overflow menu, alongside T4's existing "Skip phase" (cross-pillar) / "End session" actions. State-focus reuses the same page widget — only the player body and provider differ.

---

## 8. Launcher branch — `_launchStateFocus`

`app/lib/launchers/session_launcher.dart` already has the T1-era stub:

```dart
Future<void> _launchStateFocus(BuildContext context, SuggestedSession session) {
  throw UnimplementedError('lands in S14-T5');
}
```

T5 fills it in following T2's `_launchCrossPillar` pattern:

```dart
Future<void> _launchStateFocus(BuildContext context, SuggestedSession session) async {
  // 1. Validation — confirm session.sessionShape == 'state_focus', 3 phases, content_id null only on reflection
  _validateStateFocusShape(session);  // throws on malformed input → translated to friendly error
  
  // 2. Resume check
  final provider = context.read<StateFocusSessionProvider>();
  final peek = await provider.peekFromStorage();
  if (peek != null && _within24h(peek.startedAt)) {
    switch (peek.quitIntent) {
      case 'pause':
        final resume = await _showResumePrompt(context, peek);
        if (resume) { await provider.resumeFromStorage(); } else { await provider.discard(); }
        break;
      case 'end_early':
        await provider.discard();
        break;
      case null:
        await provider.resumeFromStorage();  // auto-resume (app killed)
        break;
    }
  }
  
  // 3. If no resume → startFresh
  if (provider.currentSession == null) {
    await provider.startFresh(session);
  }
  
  // 4. Navigate to FivePhaseSessionPage (the page name is now historical — it hosts both 5-phase and 3-leg sessions)
  if (!context.mounted) return;
  await Navigator.pushNamed(context, '/session/state-focus');
}
```

### 8.1 — Route name

T4 routes cross-pillar to `/session/cross-pillar`. State-focus gets `/session/state-focus`. Both hit the same `FivePhaseSessionPage` widget — see §9.

### 8.2 — Validation

`_validateStateFocusShape` checks:
- `session.sessionShape == 'state_focus'`
- `session.phases.length == 3`
- `session.phases.map((p) => p.phase).toList() == ['centering', 'practice', 'reflection']`
- For centering + practice: `items.first.contentId != null` and `items.first.contentType == 'breathwork'`
- For reflection: `items.first.contentId == null` (this is the contract — reflection is silent)

Each failure throws with a stable error code mapped to a friendly message by the launcher's `_friendlyError`.

---

## 9. Hosting page — `FivePhaseSessionPage` rename or reuse?

T4 named the page `FivePhaseSessionPage`. That's a misnomer for T5 — state-focus has 3 legs. Two options:

**Option chosen: rename `FivePhaseSessionPage` → `MultiPhaseSessionPage`.**

- `app/lib/pages/session/five_phase_session_page.dart` → `app/lib/pages/session/multi_phase_session_page.dart`
- Class rename: `FivePhaseSessionPage` → `MultiPhaseSessionPage`
- Single page hosts both cross-pillar (5 phases) and state-focus (3 stages). The page already iterates `phases.length` (T4 design), so no logic change beyond the rename.
- Body builder switch in §10 dispatches between `BreathworkPlayer` / `YogaSessionPlayer` / `StrengthPlayer` / `SilentTimerPlayer` based on `content_type` + `content_id`.
- AppBar title shows `phaseMetadata.focusSlug` title-cased (e.g. "Calm" for state-focus, "Full Body" for cross-pillar).

This is part of the enterprise-grade move — names should reflect what the thing does, not its history.

---

## 10. Orchestrator body builder — routing extension

`MultiPhaseSessionPage._buildPhaseBody` switch from T4 extends:

```dart
Widget _buildPhaseBody(BuildContext context, SessionPhase phase) {
  final item = phase.items.first;
  final metadata = PhaseMetadata.fromSessionPhase(phase, ...);
  
  // Reflection (silent timer) — content_id == null is the signal
  if (item.contentType == 'breathwork' && item.contentId == null) {
    return SilentTimerPlayer(
      key: ValueKey('phase-${phase.phase}'),
      isEmbedded: true,
      phaseMetadata: metadata,
      onPhaseComplete: (r) => _handlePhaseComplete(context, r),
    );
  }
  
  switch (item.contentType) {
    case 'strength':  return StrengthPlayer(...);    // T4
    case 'yoga':      return YogaSessionPlayer(...); // T4
    case 'breathwork': return BreathworkPlayer(...); // T4 + T5 endless-mode extension
    default: throw StateError('unknown content_type: ${item.contentType}');
  }
}
```

The reflection branch is **a guard before the switch**, not a fourth case in the switch — because reflection is identified by `content_id == null`, not by a unique `content_type`.

`_handlePhaseComplete` reads `context.read<MultiPhaseSessionProvider>()` — the base type. State-focus reads from `StateFocusSessionProvider`, cross-pillar reads from `CrossPillarSessionProvider`, both resolve to the base type for shared logic.

---

## 11. Drift log

| # | Date | Source | Drift | Resolution |
|---|---|---|---|---|
| _(populated during pre-flight + build)_ | | | | |

---

## 12. Definition of done

1. **All 5 state focuses run end-to-end** at all 5 brackets (25 combinations) — centering → practice → reflection → home with snackbar "Session complete — N stages logged."
2. **Reflection silent timer works** in both timed and `user_triggered` modes. Doesn't crash on `content_id: null`.
3. **Endless practice works** — stopwatch counts up, "I'm done" button advances, actual elapsed seconds logged to `breathwork_sessions`.
4. **`MultiPhaseSessionProvider` base class** in place; `CrossPillarSessionProvider` refactored to extend it; all T4 cross-pillar tests + flows pass unchanged.
5. **`StateFocusSessionProvider` parallel** registered in `main.dart`.
6. **Skip confirm dialog** appears before any leg-skip; cancel respects user.
7. **Three quit intents work** for state-focus identically to cross-pillar (app-kill → auto-resume; Save and quit → resume prompt; End early → log + snackbar).
8. **DB schema renamed** — `cross_pillar_sessions` → `multi_phase_sessions` (+ added `session_shape` column); FK columns on `sessions` and `breathwork_sessions` renamed accordingly.
9. **`SilentTimerPlayer`** is a generic widget — not state-focus-specific. T6 can reuse for cross-pillar silent sit.
10. **`flutter analyze` baseline preserved** at ≤12 info-hints.
11. **Smoke baseline preserved** at 3486/9 (T4 baseline). Add 8–12 state-focus-specific assertions covering: 3-phase emission, reflection null content_id, endless mode, multi_phase_sessions row writes with session_shape='state_focus', skip → wasSkipped:true.
12. **Device acceptance flow** (§13) passes.

---

## 13. Device acceptance flow

1. Home → select state focus **calm** → tap Start.
2. Picker bottom sheet appears with 5 brackets. Pick **10–20 min**.
3. State-focus session opens. Stage 1: **Centering**.
4. Verify: breathwork animated circle plays (T4 player), top label reads "Centering", duration ~1–2 min.
5. Let centering complete naturally → smooth fade (300ms) to stage 2 — **no 3s countdown** (calm session).
6. Stage 2: **Practice**. Verify the technique name shows, animated circle plays.
7. Tap AppBar overflow → **Skip stage** → bottom sheet appears with `[Skip this stage] [Stay here]`. Tap **Stay here**. Verify session continues.
8. Let practice complete naturally → smooth fade → stage 3 — **Reflection**.
9. Verify: silent screen with "Breathe naturally" prompt, soft countdown timer, "I'm done" button.
10. Tap "I'm done" → session completes → home with snackbar **"Session complete — 3 stages logged."**
11. DB verify: 1 `multi_phase_sessions` row with `session_shape='state_focus'`, `phases_completed=3`, `end_intent='completed'`. 2 `breathwork_sessions` rows (centering + practice — **not reflection**, per Decision #16). All breathwork rows have `multi_phase_session_id` FK set.
12. **Endless mode test:** select calm → pick **"Until I'm done"** bracket.
13. Stage 1 (centering): plays normally (centering is always timed even in endless mode per engine spec §6, centering_target=2 min default).
14. Stage 2 (practice): verify **stopwatch counting up** at the bottom of the player, and **"I'm done" button**. Let it run ~30 sec. Tap "I'm done."
15. Stage 3 (reflection in user_triggered mode): verify **silent screen, no timer**, just "Breathe naturally" + "I'm done" button. Tap "I'm done."
16. Verify: 1 `multi_phase_sessions` row, 2 `breathwork_sessions` rows. Practice row's `duration_seconds` should reflect the **~30 sec elapsed** from the stopwatch, NOT a placeholder.
17. **Skip leg test:** start a fresh calm session. On centering, overflow → Skip stage → confirm dialog → tap **Skip this stage**. Verify centering skipped (no `breathwork_sessions` row written for it), session advances to practice.
18. **Cross-pillar regression test:** select **full-body** focus → tap Start. Verify the cross-pillar 5-phase flow still works exactly as it did in T4 (T4 acceptance flow §11 #1-13 should pass unchanged after the base-class refactor).
19. **Quit intent test for state-focus:** start a calm session, advance to practice, force-kill app via OS recents. Reopen → verify auto-resume lands on practice with previous progress intact.
20. **Save and quit / End early** also tested same way as T4 (mirrors #15-16 from T4 device flow).

---

## 14. Files changed

### New
- `app/lib/providers/multi_phase_session_provider.dart` — abstract base class
- `app/lib/providers/state_focus_session_provider.dart` — subclass for state-focus
- `app/lib/players/silent_timer_player.dart` — silent timer widget for reflection (and future cross-pillar silent sit)
- `app/lib/pages/session/multi_phase_session_page.dart` — renamed from `five_phase_session_page.dart`
- `server/migrations/<datestamp>_rename_cross_pillar_to_multi_phase.sql` — schema migration

### Modified
- `app/lib/providers/cross_pillar_session_provider.dart` — slim down to extend `MultiPhaseSessionProvider`; preserve all T4 public API
- `app/lib/players/breathwork_player.dart` — extend for `mode: 'open_ended'` (stopwatch + I'm done button)
- `app/lib/launchers/session_launcher.dart` — fill in `_launchStateFocus` (currently throws `UnimplementedError`)
- `app/lib/main.dart` — register `StateFocusSessionProvider`
- `app/lib/router/routes.dart` — add `/session/state-focus` route
- `app/lib/pages/session/widgets/auto_advance_overlay.dart` — confirm correct widget guard so state-focus subclass override skips this entirely
- `server/index.js` — no changes expected; verify
- `server/src/routes/cross_pillar_sessions.js` → renamed to `multi_phase_sessions.js`, payload accepts `session_shape` field
- `server/scripts/test-suggestion-engine-t2.js` — add S14-T5 sub-block with 8–12 state-focus assertions

### Deleted
- `app/lib/pages/session/five_phase_session_page.dart` (renamed)
- (`Trackers/_scratch/S14-T5-PREFLIGHT-*.md` — throwaway, deleted at commit time)
- `server/src/routes/cross_pillar_sessions.js` (renamed)

---

## 15. Out of scope

- **T6 polish items:** multi-phase summary screen, recency warning surfacing, breathwork max-duration cap polish (Anomaly #11 — already worked around in T4/T5 via mode check), skip-phase visual polish (we ship functional skip; T6 may add undo grace period or animation).
- **Cross-pillar silent sit:** `SilentTimerPlayer` exists from T5; wiring it into cross-pillar phase 5's last 60s is T6.
- **Reflection session logging table:** filed as FUTURE_SCOPE; don't build storage we don't consume yet.
- **Stopwatch hide toggle:** "show elapsed time in endless mode" user setting deferred to T6 polish or later.
- **`/review` run:** UI ticket, deferred per principle #12. May run after device test if changes feel architectural.

---

## 16. Project Instructions principle compliance

- **#6** Claude Code stops after `flutter analyze` clean — Prashob device-tests.
- **#11** Spec-first; this doc IS the spec.
- **#12** UI ticket — `/review` deferred.
- **#14** Pre-flight halt-gates (§3).
- **#16** Mid-build drift → AMENDMENT doc per §11 drift log.
- **#17** Smoke fixtures use sentinel cleanup via `smoke-fixtures.mjs` helper (S13-T7).
- **#18** Architect-side review of build prompt before dispatch.
- **#19** Match repo convention — `ApiService`, `ChangeNotifier`, `StorageService`.

---

*Spec authored May 11, 2026. Build prompt drafted as throwaway markdown after greenlight + pre-flight diagnostic completes.*
