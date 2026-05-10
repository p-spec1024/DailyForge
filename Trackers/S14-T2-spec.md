# S14-T2 — Cross_pillar 5-phase orchestrator + home Start

**Sprint:** 14
**Ticket:** T2
**Size:** L
**Status:** Spec locked May 8, 2026
**Branch:** `s14-t2` (sprint-chained off `s14-t1` HEAD; merge happens at sprint-14 close)
**Depends on:** S14-T1 shipped (launcher, `metadata.focus_slug`, pre-seed pattern, `refreshForEntryPoint` seam).
**Unblocks:** S14-T4 (player embedding refactor — T4 swaps T2's stub phase views for real embedded players).

---

## 1. Goal

Wire the **home page Start button** to launch a real cross-pillar 5-phase session orchestrator. T2 ships the orchestrator skeleton — phase state machine, phase navigation, phase persistence, skip / pause / resume — with **stubbed phase content**. T4 will swap the stubs for real embedded strength / yoga / breathwork players.

After T2: every body focus the engine produces (`bookend_open[breath] → warmup[yoga] → main[strength] → cooldown[yoga] → bookend_close[breath]`) advances phase-by-phase end-to-end. State-focus and yoga pillar-pure remain on the launcher's existing throw branches (T5 / T3).

---

## 2. Scope

### 2.1 In scope

**Flutter (10 deliverables):**

1. New `app/lib/launchers/session_launcher.dart` — `cross_pillar` branch implemented, replaces the existing `throw UnimplementedError`. Strength branch unchanged. State-focus and pillar-pure non-strength branches still throw with hand-off messages (T3, T5).
2. New `app/lib/providers/cross_pillar_session_provider.dart` — `ChangeNotifier`-based phase state machine. Holds the engine-supplied phase array + current phase index + per-phase status (`pending` / `active` / `paused` / `completed` / `skipped`). Persists via `StorageService`.
3. New `app/lib/pages/session/five_phase_session_page.dart` — the orchestrator screen. Owns the `Scaffold`, app-bar (focus name + close), phase-indicator strip at top, phase-stub-view body, phase-action footer.
4. New `app/lib/pages/session/widgets/phase_indicator.dart` — five-segment progress strip showing each phase's status (pending / active / completed / skipped). T6 polishes; T2 ships minimal.
5. New `app/lib/pages/session/widgets/phase_stub_view.dart` — placeholder rendering per phase. Shows phase label, item list (names + duration), and a "Next phase" / "Complete phase" CTA. **Explicit T4 seam** — class is named so T4 can replace its body with real embedded players (or extend with a `child:` slot, builder's call at T4 time).
6. New `app/lib/pages/session/widgets/phase_preview_sheet.dart` — bottom sheet listing all 5 phases with current position highlighted; reachable from app-bar overflow. Minimal in T2; T6 polishes.
7. `app/lib/pages/home/home_page.dart` — `_onStart` rewired to dispatch `SessionLauncher.launch(context, suggest.currentSession!)`. Placeholder snackbar deleted.
8. `app/lib/config/routes.dart` — new route `/session/cross-pillar` → `FivePhaseSessionPage`.
9. `app/lib/main.dart` — `CrossPillarSessionProvider` registered alongside existing providers.
10. `app/lib/services/storage_service.dart` — three new key constants for cross-pillar session persistence: `kCrossPillarSessionKey`, `kCrossPillarSessionStartedAtKey`, `kCrossPillarSessionPhaseStatesKey`. (One JSON blob is acceptable; three keys is the conservative seam — locked at build time per StorageService convention review.)

**Server:** zero changes. Engine already emits `cross_pillar` correctly. T2 verifies; doesn't extend.

**Pre-flight artifacts (committed alongside spec):**

- `Trackers/_scratch/S14-T2-PREFLIGHT-engine-shapes.md` — output of the verify script (§6.1) showing actual engine output for each tuple in §6.1.
- `Trackers/_scratch/S14-T2-PREFLIGHT-code-report.md` — Flutter pre-flight (StorageService API surface, existing routes, provider constructor patterns, `WorkoutSessionProvider` lifecycle, app-foreground hook availability).

### 2.2 Out of scope

- **Real embedded players** — T4 refactors strength / yoga / breathwork pages for embedded mode. T2 ships stubs; phase content is text + a Next button. **No real workouts, yoga, or breathwork actually plays in T2.**
- **Per-phase persistence to backend** — T2 logs nothing to the server. The orchestrator is client-side-only until T4 wires real session logging via the embedded players.
- **Multi-phase completion summary screen** — T6 polish. T2 returns home with a "Cross-pillar session completed" snackbar.
- **Recency warnings at session start** — T6 polish.
- **Mid-phase pause-resume polish** — T2 ships phase-level pause (whole orchestrator pauses; resume continues current phase). Mid-rep / mid-cycle pause is T6.
- **Skip-back / undo-skip** — T6 polish. T2's skip is one-way.
- **`duration_minutes` cap on breathwork bookends** (Anomaly #11) — T6 polish; relevant only when real breathwork player runs (T4+).
- **State-focus and pillar-pure yoga from home** — engine doesn't produce these from `entry_point='home'` for the home page surfaces; if they ever appear (e.g. state focus), launcher's existing throw + friendly snackbar handles them. T2 confirms, doesn't fix.

---

## 3. Architectural shape

```
                  ┌─────────────────────┐
   Home tap Start │   _onStart()        │
                  │                     │
                  │  reads from         │
                  │  suggest.currentSession
                  └──────────┬──────────┘
                             │ pass session
                             ▼
                  ┌─────────────────────┐
                  │  SessionLauncher    │
                  │  .launch(ctx, sess) │
                  │                     │
                  │  switch (sessionShape)
                  │    pillar_pure  → strength path     (T1)
                  │    cross_pillar → _launchCrossPillar (T2 — NEW)
                  │    state_focus  → throw              (T5)
                  └──────────┬──────────┘
                             │ cross_pillar
                             ▼
                  ┌─────────────────────────────────────┐
                  │  _launchCrossPillar(ctx, sess)      │
                  │                                     │
                  │  1. validate phase array shape      │
                  │     (5 phases, content types match  │
                  │      what T2 stubs expect)          │
                  │  2. check StorageService for an     │
                  │     in-progress orchestrator        │
                  │     - if stale (>24h) or missing →  │
                  │       fresh start                   │
                  │     - if fresh same-day → "Resume?" │
                  │       dialog (proceed or discard)   │
                  │  3. provider.startFresh(session) OR │
                  │     provider.resumeFromStorage()    │
                  │  4. context.go('/session/cross-     │
                  │      pillar')                       │
                  └──────────┬──────────────────────────┘
                             │
                             ▼
                  ┌─────────────────────────────────────┐
                  │  CrossPillarSessionProvider         │
                  │                                     │
                  │  Fields:                            │
                  │    SuggestedSession session         │
                  │    int currentPhaseIndex            │
                  │    Map<int,PhaseStatus> statuses    │
                  │    bool paused                      │
                  │    DateTime startedAt               │
                  │                                     │
                  │  Methods:                           │
                  │    startFresh(SuggestedSession)     │
                  │    resumeFromStorage()              │
                  │    completeCurrentPhase()           │
                  │    skipCurrentPhase()               │
                  │    pause() / resume()               │
                  │    discard()                        │
                  │                                     │
                  │  All mutators persist on next tick. │
                  │  All mutators notifyListeners.      │
                  └──────────┬──────────────────────────┘
                             │ build read
                             ▼
                  ┌─────────────────────────────────────┐
                  │  FivePhaseSessionPage               │
                  │                                     │
                  │  - app-bar:                         │
                  │    title = focusSlug (e.g. "Biceps")│
                  │    leading: confirm-discard close   │
                  │    actions: phase preview sheet     │
                  │                                     │
                  │  - body:                            │
                  │    PhaseIndicator(statuses, idx)    │
                  │    PhaseStubView(currentPhase)      │
                  │      ← T4 replaces this widget      │
                  │                                     │
                  │  - footer (phase action bar):       │
                  │    [skip] [pause/resume] [next]     │
                  └─────────────────────────────────────┘
```

**Key seams:**

- **Pre-seed pattern preserved.** Launcher hydrates the provider before navigating. The page's `initState` reads provider state; it does not start a new session itself.
- **PhaseStubView is the T4 swap point.** T2 hard-codes a stub. T4 will either replace the widget body or wrap it with a real-player builder. The provider's API contract (`completeCurrentPhase()`, `skipCurrentPhase()`) stays stable across the swap.
- **Persistence is provider-internal.** Page never reads or writes `StorageService` directly. The provider is the single source of truth, both in-memory and on disk.

---

## 4. Engine output contract (verified at pre-flight)

The pre-flight verify script (§6.1) produces this table for the body-focus matrix. **The orchestrator builds against this contract; pre-flight confirms it before code changes.**

### 4.1 Standard cross_pillar (non-mobility, non-special)

For `(entry_point='home', focus IN [biceps, triceps, chest, back, shoulders, legs, glutes, hamstrings, quads, calves, core, full_body], time_budget_min IN [30, 60])`:

- `session_shape: 'cross_pillar'`
- `phases.length: 5`
- Phase order:

| Index | `phase` value | `content_type` of items | Item count (30) | Item count (60) |
|---|---|---|---|---|
| 0 | `bookend_open` | `breathwork` | 1 | 1 |
| 1 | `warmup` | `yoga` | 1 | 2 |
| 2 | `main` | `strength` | 3 | 5 |
| 3 | `cooldown` | `yoga` | 1 | 2 |
| 4 | `bookend_close` | `breathwork` | 1 | 1 |

- `metadata.estimated_total_min`: ≈30 or ≈60 (within ±10%)
- `metadata.focus_slug`: matches input (e.g. `'biceps'`)
- `metadata.user_levels`: `{ strength, yoga, breathwork }` strings

**45-min budget:** engine accepts, returns 5-phase shape, but is currently flaky (FUTURE_SCOPE #181 — quads/45 throws). T2 supports 45 if engine returns; degrades to error snackbar otherwise. T2 does not investigate or fix the flake.

### 4.2 Mobility special case

For `(entry_point='home', focus='mobility', time_budget_min IN [30, 60])`:

Per `Trackers/S12-suggestion-engine-spec.md` "Mobility — special case", strength is omitted; strength's main slot is replaced by yoga.

**Pre-flight verifies the actual emitted shape.** Two plausible shapes:

- **Shape A:** 5 phases, but `main`'s items have `content_type='yoga'` (strength slot reallocated to yoga in place).
- **Shape B:** 4 phases, no `main` at all — `bookend_open → warmup → cooldown → bookend_close`.

The verify script reports which one. **The orchestrator handles whatever pre-flight finds.**

If Shape A: orchestrator treats it identically to standard cross_pillar — phase 2's stub view shows yoga items instead of strength items. No special branching needed.

If Shape B: orchestrator skips the missing phase index; `PhaseIndicator` renders 4 segments; `currentPhaseIndex` advances over the gap. Provider has a `phases.length`-driven navigation, not a hard 5-index assumption.

**Locked design rule:** orchestrator iterates `session.phases` by index; never hard-codes `phases.length == 5`. Phase indicator segment count = `session.phases.length`.

### 4.3 Full-body special case

For `(entry_point='home', focus='full_body', time_budget_min IN [30, 60])`:

Standard 5-phase shape with `array_length(target_muscles, 1) >= 3` filter applied to strength + yoga selections. **No structural difference from §4.1** — orchestrator is identical.

### 4.4 What home Start might NOT produce (and how the launcher handles it)

If a state-focus chip is selected on the home pie, `entry_point='home'` + focus_type='state' → engine returns `state_focus` (not `cross_pillar`). The launcher's existing `state_focus` branch throws `UnimplementedError('state_focus shape lands in S14-T5 (3-leg chain).')`. T1's friendly snackbar wrapper renders this as user-facing copy. **T2 confirms this still works** — no change needed; just a step in device verification.

If `currentSession == null` (user hasn't picked a focus yet), the home page's Start button should not be visible. T2 confirms the existing visibility logic; if absent, surface a "Pick a focus first" snackbar in `_onStart`.

---

## 5. Deliverables

### 5.1 `SessionLauncher._launchCrossPillar`

**File:** `app/lib/launchers/session_launcher.dart`. Replace the existing `throw UnimplementedError('cross_pillar shape lands in S14-T2 (5-phase orchestrator).')` (whatever the exact T1 message is — pre-flight confirms) with:

```dart
case 'cross_pillar':
  return _launchCrossPillar(context, session);
```

And add the method:

```dart
static Future<void> _launchCrossPillar(
  BuildContext context,
  SuggestedSession session,
) async {
  // Validation: at least 1 phase. Mobility may be 4-phase; full-body is 5-phase.
  // We do NOT hard-code phases.length == 5.
  if (session.phases.isEmpty) {
    throw StateError('cross_pillar session has no phases');
  }

  final focusSlug = session.metadata.focusSlug;
  if (focusSlug == null || focusSlug.isEmpty) {
    throw StateError('cross_pillar session metadata.focus_slug is required');
  }

  final provider = context.read<CrossPillarSessionProvider>();
  final storage = context.read<StorageService>();

  // Resume check: is there an in-progress session within the freshness window?
  final existing = await provider.peekFromStorage(storage);
  if (existing != null && _isFresh(existing.startedAt)) {
    final shouldResume = await _showResumeDialog(context, existing);
    if (!context.mounted) return;
    if (shouldResume == _ResumeChoice.resume) {
      await provider.resumeFromStorage(storage);
      context.go('/session/cross-pillar');
      return;
    } else if (shouldResume == _ResumeChoice.discard) {
      await provider.discard(storage);
      // fall through to fresh start
    } else {
      // user dismissed dialog — abort launch
      return;
    }
  }

  await provider.startFresh(session, storage: storage);
  if (!context.mounted) return;
  context.go('/session/cross-pillar');
}

static bool _isFresh(DateTime startedAt) {
  return DateTime.now().difference(startedAt) < const Duration(hours: 24);
}
```

**Friendly error snackbar:** the existing `_friendlyError` helper from T1 stays unchanged. `_launchCrossPillar` falls through to it on any thrown error (wrapped at the outer try/catch around the switch).

### 5.2 `CrossPillarSessionProvider`

**File:** `app/lib/providers/cross_pillar_session_provider.dart` (new).

```dart
import 'dart:convert';
import 'package:flutter/foundation.dart';

import '../models/suggested_session.dart';
import '../services/storage_service.dart';

enum PhaseStatus { pending, active, paused, completed, skipped }

class CrossPillarSessionProvider extends ChangeNotifier {
  SuggestedSession? _session;
  int _currentPhaseIndex = 0;
  Map<int, PhaseStatus> _statuses = {};
  bool _paused = false;
  DateTime? _startedAt;

  // Getters
  SuggestedSession? get session => _session;
  int get currentPhaseIndex => _currentPhaseIndex;
  Map<int, PhaseStatus> get statuses => Map.unmodifiable(_statuses);
  bool get paused => _paused;
  bool get isActive => _session != null;
  DateTime? get startedAt => _startedAt;
  bool get allPhasesDone =>
      _session != null &&
      _statuses.entries.where((e) => e.key < _session!.phases.length).every(
            (e) =>
                e.value == PhaseStatus.completed || e.value == PhaseStatus.skipped,
          );

  /// Begin a new orchestrator session. Wipes any previous storage.
  Future<void> startFresh(
    SuggestedSession session, {
    required StorageService storage,
  }) async {
    _session = session;
    _currentPhaseIndex = 0;
    _statuses = {
      for (int i = 0; i < session.phases.length; i++) i: PhaseStatus.pending,
    };
    _statuses[0] = PhaseStatus.active;
    _paused = false;
    _startedAt = DateTime.now();
    await _persist(storage);
    notifyListeners();
  }

  /// Returns the persisted state without mutating in-memory provider state.
  /// Used by the launcher to ask "is there something to resume?"
  Future<_PersistedSnapshot?> peekFromStorage(StorageService storage) async {
    final raw = await storage.getPreference(kCrossPillarSessionKey);
    if (raw == null) return null;
    try {
      final decoded = jsonDecode(raw) as Map<String, dynamic>;
      return _PersistedSnapshot.fromJson(decoded);
    } catch (_) {
      // Corrupted; clear and treat as no-session.
      await storage.removePreference(kCrossPillarSessionKey);
      return null;
    }
  }

  /// Restore in-memory state from storage. Caller must have already verified
  /// freshness via peekFromStorage.
  Future<void> resumeFromStorage(StorageService storage) async {
    final snapshot = await peekFromStorage(storage);
    if (snapshot == null) {
      throw StateError('resumeFromStorage called with no persisted snapshot');
    }
    _session = snapshot.session;
    _currentPhaseIndex = snapshot.currentPhaseIndex;
    _statuses = Map.of(snapshot.statuses);
    _paused = snapshot.paused;
    _startedAt = snapshot.startedAt;
    notifyListeners();
  }

  /// Mark current phase completed and advance.
  Future<void> completeCurrentPhase({required StorageService storage}) async {
    _requireActive();
    _statuses[_currentPhaseIndex] = PhaseStatus.completed;
    _advance();
    await _persist(storage);
    notifyListeners();
  }

  /// Mark current phase skipped and advance.
  Future<void> skipCurrentPhase({required StorageService storage}) async {
    _requireActive();
    _statuses[_currentPhaseIndex] = PhaseStatus.skipped;
    _advance();
    await _persist(storage);
    notifyListeners();
  }

  Future<void> pause({required StorageService storage}) async {
    _requireActive();
    _paused = true;
    _statuses[_currentPhaseIndex] = PhaseStatus.paused;
    await _persist(storage);
    notifyListeners();
  }

  Future<void> resume({required StorageService storage}) async {
    _requireActive();
    _paused = false;
    _statuses[_currentPhaseIndex] = PhaseStatus.active;
    await _persist(storage);
    notifyListeners();
  }

  /// Throw away the orchestrator session without completing it.
  Future<void> discard(StorageService storage) async {
    _session = null;
    _currentPhaseIndex = 0;
    _statuses = {};
    _paused = false;
    _startedAt = null;
    await storage.removePreference(kCrossPillarSessionKey);
    notifyListeners();
  }

  /// Final completion: clears storage; T6 will hand off to a summary screen.
  Future<void> complete({required StorageService storage}) async {
    _requireActive();
    await storage.removePreference(kCrossPillarSessionKey);
    _session = null;
    _currentPhaseIndex = 0;
    _statuses = {};
    _paused = false;
    _startedAt = null;
    notifyListeners();
  }

  // ── private ─────────────────────────────────────────────────

  void _advance() {
    final n = _session!.phases.length;
    if (_currentPhaseIndex + 1 < n) {
      _currentPhaseIndex += 1;
      _statuses[_currentPhaseIndex] = PhaseStatus.active;
    } else {
      // Last phase complete — caller should call complete() next tick.
    }
    _paused = false;
  }

  void _requireActive() {
    if (_session == null) {
      throw StateError('CrossPillarSessionProvider has no active session');
    }
  }

  Future<void> _persist(StorageService storage) async {
    final snapshot = _PersistedSnapshot(
      session: _session!,
      currentPhaseIndex: _currentPhaseIndex,
      statuses: _statuses,
      paused: _paused,
      startedAt: _startedAt!,
    );
    await storage.setPreference(
      kCrossPillarSessionKey,
      jsonEncode(snapshot.toJson()),
    );
  }
}

class _PersistedSnapshot {
  final SuggestedSession session;
  final int currentPhaseIndex;
  final Map<int, PhaseStatus> statuses;
  final bool paused;
  final DateTime startedAt;

  _PersistedSnapshot({
    required this.session,
    required this.currentPhaseIndex,
    required this.statuses,
    required this.paused,
    required this.startedAt,
  });

  Map<String, dynamic> toJson() => {
        'session': session.toJson(),         // assumes SuggestedSession has toJson
        'currentPhaseIndex': currentPhaseIndex,
        'statuses': statuses.map((k, v) => MapEntry(k.toString(), v.name)),
        'paused': paused,
        'startedAt': startedAt.toIso8601String(),
      };

  factory _PersistedSnapshot.fromJson(Map<String, dynamic> json) {
    return _PersistedSnapshot(
      session: SuggestedSession.fromJson(json['session'] as Map<String, dynamic>),
      currentPhaseIndex: (json['currentPhaseIndex'] as num).toInt(),
      statuses: (json['statuses'] as Map<String, dynamic>).map(
        (k, v) => MapEntry(int.parse(k), PhaseStatus.values.byName(v as String)),
      ),
      paused: json['paused'] as bool,
      startedAt: DateTime.parse(json['startedAt'] as String),
    );
  }
}
```

**Open question for build:** does `SuggestedSession` already have a `toJson` method? If not, build prompt adds one. Pre-flight code report confirms.

### 5.3 `FivePhaseSessionPage`

**File:** `app/lib/pages/session/five_phase_session_page.dart` (new).

Minimal scaffold — per Lesson #2, UI is provisional. Build the smallest version, expect device iteration.

```dart
class FivePhaseSessionPage extends StatelessWidget {
  const FivePhaseSessionPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<CrossPillarSessionProvider>(
      builder: (context, provider, _) {
        final session = provider.session;
        if (session == null) {
          // Defensive: shouldn't happen because launcher pre-seeds.
          // Bail back home rather than crash.
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (context.mounted) context.go('/');
          });
          return const SizedBox.shrink();
        }

        final currentPhase = session.phases[provider.currentPhaseIndex];

        return Scaffold(
          appBar: AppBar(
            title: Text(_focusTitle(session.metadata.focusSlug)),
            leading: IconButton(
              icon: const Icon(Icons.close),
              onPressed: () => _confirmDiscard(context, provider),
            ),
            actions: [
              IconButton(
                icon: const Icon(Icons.format_list_numbered),
                onPressed: () => _showPreview(context, session, provider),
              ),
            ],
          ),
          body: Column(
            children: [
              PhaseIndicator(
                phaseCount: session.phases.length,
                currentIndex: provider.currentPhaseIndex,
                statuses: provider.statuses,
              ),
              Expanded(
                child: PhaseStubView(
                  phase: currentPhase,
                  paused: provider.paused,
                ),
              ),
              _PhaseActionBar(provider: provider),
            ],
          ),
        );
      },
    );
  }

  String _focusTitle(String? slug) {
    if (slug == null) return 'Session';
    return slug.replaceAll('_', ' ').split(' ').map(_capitalize).join(' ');
  }

  String _capitalize(String s) =>
      s.isEmpty ? s : s[0].toUpperCase() + s.substring(1);

  void _confirmDiscard(BuildContext context, CrossPillarSessionProvider provider) async {
    final discard = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Leave session?'),
        content: const Text('Your progress will be lost.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Stay')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Leave')),
        ],
      ),
    );
    if (discard == true) {
      final storage = context.read<StorageService>();
      await provider.discard(storage);
      if (context.mounted) context.go('/');
    }
  }

  void _showPreview(BuildContext context, SuggestedSession session, CrossPillarSessionProvider provider) {
    showModalBottomSheet(
      context: context,
      builder: (_) => PhasePreviewSheet(
        phases: session.phases,
        currentIndex: provider.currentPhaseIndex,
        statuses: provider.statuses,
      ),
    );
  }
}

class _PhaseActionBar extends StatelessWidget {
  final CrossPillarSessionProvider provider;
  const _PhaseActionBar({required this.provider});

  @override
  Widget build(BuildContext context) {
    final storage = context.read<StorageService>();
    final isLastPhase = provider.currentPhaseIndex >= (provider.session!.phases.length - 1);

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          TextButton(
            onPressed: () async {
              await provider.skipCurrentPhase(storage: storage);
              if (provider.allPhasesDone && context.mounted) {
                await provider.complete(storage: storage);
                _onCompletion(context);
              }
            },
            child: const Text('Skip'),
          ),
          const Spacer(),
          IconButton(
            icon: Icon(provider.paused ? Icons.play_arrow : Icons.pause),
            onPressed: () async {
              if (provider.paused) {
                await provider.resume(storage: storage);
              } else {
                await provider.pause(storage: storage);
              }
            },
          ),
          const SizedBox(width: 12),
          ElevatedButton(
            onPressed: provider.paused
                ? null
                : () async {
                    await provider.completeCurrentPhase(storage: storage);
                    if (provider.allPhasesDone && context.mounted) {
                      await provider.complete(storage: storage);
                      _onCompletion(context);
                    }
                  },
            child: Text(isLastPhase ? 'Finish' : 'Next phase'),
          ),
        ],
      ),
    );
  }

  void _onCompletion(BuildContext context) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Cross-pillar session completed.')),
    );
    context.go('/');
  }
}
```

### 5.4 `PhaseIndicator`

**File:** `app/lib/pages/session/widgets/phase_indicator.dart` (new).

Renders `phaseCount` segments horizontally. Each segment colored by its `PhaseStatus`. Minimal. Locked color/spacing decisions are deferred to device test (Lesson #2).

```dart
class PhaseIndicator extends StatelessWidget {
  final int phaseCount;
  final int currentIndex;
  final Map<int, PhaseStatus> statuses;

  const PhaseIndicator({
    super.key,
    required this.phaseCount,
    required this.currentIndex,
    required this.statuses,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: List.generate(phaseCount, (i) {
          return Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 2),
              child: Container(
                height: 4,
                decoration: BoxDecoration(
                  color: _colorFor(statuses[i] ?? PhaseStatus.pending, isCurrent: i == currentIndex),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
          );
        }),
      ),
    );
  }

  Color _colorFor(PhaseStatus s, {required bool isCurrent}) {
    // Locked at device-test time. Stub:
    switch (s) {
      case PhaseStatus.completed:
        return Colors.green;
      case PhaseStatus.skipped:
        return Colors.orange.shade300;
      case PhaseStatus.active:
      case PhaseStatus.paused:
        return Colors.blueAccent;
      case PhaseStatus.pending:
        return Colors.grey.shade400;
    }
  }
}
```

### 5.5 `PhaseStubView`

**File:** `app/lib/pages/session/widgets/phase_stub_view.dart` (new).

Renders the current phase as text + item list. **This is the T4 swap point** — when T4 lands real embedded players, this widget is replaced (or wrapped) per phase content type. T2 ships text-only.

```dart
class PhaseStubView extends StatelessWidget {
  final SuggestedPhase phase;
  final bool paused;
  const PhaseStubView({super.key, required this.phase, required this.paused});

  @override
  Widget build(BuildContext context) {
    final phaseLabel = _phaseLabel(phase.phase);
    final contentTypeLabel = phase.items.isEmpty ? '—' : phase.items.first.contentType;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(phaseLabel, style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 4),
        Text(
          'Content type: $contentTypeLabel',
          style: Theme.of(context).textTheme.bodySmall,
        ),
        const SizedBox(height: 16),
        if (paused) ...[
          const Text('Paused', style: TextStyle(fontStyle: FontStyle.italic)),
          const SizedBox(height: 16),
        ],
        const Text('Items in this phase:'),
        const SizedBox(height: 8),
        ...phase.items.map((item) => Card(
              child: ListTile(
                title: Text(item.name),
                subtitle: _itemSubtitle(item),
              ),
            )),
        const SizedBox(height: 24),
        Card(
          color: Colors.amber.shade50,
          child: const Padding(
            padding: EdgeInsets.all(12),
            child: Text(
              'T2 stub: real player lands in S14-T4. '
              'Tap "Next phase" to advance.',
              style: TextStyle(fontStyle: FontStyle.italic),
            ),
          ),
        ),
      ],
    );
  }

  Widget? _itemSubtitle(SuggestedItem item) {
    final parts = <String>[];
    if (item.durationMinutes != null) parts.add('${item.durationMinutes} min');
    if (item.sets != null) parts.add('${item.sets} sets');
    if (item.reps != null) parts.add('${item.reps} reps');
    return parts.isEmpty ? null : Text(parts.join(' · '));
  }

  String _phaseLabel(String phase) {
    switch (phase) {
      case 'bookend_open':
        return 'Opening Breath';
      case 'warmup':
        return 'Warm-up';
      case 'main':
        return 'Main Work';
      case 'cooldown':
        return 'Cool-down';
      case 'bookend_close':
        return 'Closing Breath';
      default:
        return phase;
    }
  }
}
```

### 5.6 `PhasePreviewSheet`

**File:** `app/lib/pages/session/widgets/phase_preview_sheet.dart` (new).

Bottom sheet listing all phases with current position highlighted. Minimal.

```dart
class PhasePreviewSheet extends StatelessWidget {
  final List<SuggestedPhase> phases;
  final int currentIndex;
  final Map<int, PhaseStatus> statuses;

  const PhasePreviewSheet({
    super.key,
    required this.phases,
    required this.currentIndex,
    required this.statuses,
  });

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('All phases', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 12),
            ...phases.asMap().entries.map((entry) {
              final i = entry.key;
              final phase = entry.value;
              final status = statuses[i] ?? PhaseStatus.pending;
              return ListTile(
                leading: _leadingIcon(status, isCurrent: i == currentIndex),
                title: Text(_phaseLabel(phase.phase)),
                subtitle: Text('${phase.items.length} item(s)'),
              );
            }),
          ],
        ),
      ),
    );
  }
  // _phaseLabel + _leadingIcon helpers — same pattern as PhaseStubView.
}
```

### 5.7 Home page `_onStart` rewire

**File:** `app/lib/pages/home/home_page.dart`.

Replace the placeholder snackbar (current state, May 8 2026 per S14-T1 reroute) with:

```dart
void _onStart() async {
  final suggest = context.read<SuggestProvider>();
  final session = suggest.currentSession;
  if (session == null) return;
  await SessionLauncher.launch(context, session);
}
```

Same code as the original T1 spec §5.3 — pre-flight should confirm whether the home page already has the imports for `SessionLauncher` (not currently used since T1 reroute reverted to placeholder).

**Race-condition note (Anomaly #10):** the launcher reads `focus_slug` from `session.metadata.focusSlug`, NOT from `suggest.currentFocusSlug`. T1's fix preserved.

### 5.8 Routes

**File:** `app/lib/config/routes.dart`. Add:

```dart
GoRoute(
  path: '/session/cross-pillar',
  builder: (_, __) => const FivePhaseSessionPage(),
),
```

### 5.9 Provider registration

**File:** `app/lib/main.dart`. Add `CrossPillarSessionProvider` to the provider tree alongside existing providers (the build prompt confirms current registration pattern at pre-flight).

### 5.10 StorageService keys

**File:** `app/lib/services/storage_service.dart`. Add:

```dart
const String kCrossPillarSessionKey = 'cross_pillar_session_v1';
```

Single key, JSON-encoded blob. Versioned suffix (`_v1`) so future schema changes can migrate cleanly.

---

## 6. Verification plan

### 6.1 Pre-build pre-flight (REQUIRED — Lesson #1)

**Per `Trackers/SPRINT_14_LESSONS.md` Lesson #1**, T2 ships an engine-shape verification script as a normal pre-flight artifact, NOT as a fix-up.

**File:** `server/scripts/verify-s14-t2-shapes.mjs`. **Throwaway** — built before code work, deleted at commit.

The script:

1. Imports the engine.
2. Calls `generateSession(...)` for each tuple in this matrix and prints the result:

| `entry_point` | `focus_slug` | `time_budget_min` | Expected `session_shape` | Expected phase count |
|---|---|---|---|---|
| `home` | `biceps` | `30` | `cross_pillar` | `5` |
| `home` | `biceps` | `60` | `cross_pillar` | `5` |
| `home` | `full_body` | `30` | `cross_pillar` | `5` |
| `home` | `full_body` | `60` | `cross_pillar` | `5` |
| `home` | `mobility` | `30` | `cross_pillar` | `4 or 5 — DISCOVER` |
| `home` | `mobility` | `60` | `cross_pillar` | `4 or 5 — DISCOVER` |
| `home` | `chest` | `30` | `cross_pillar` | `5` |
| `home` | `legs` | `60` | `cross_pillar` | `5` |
| `home` | `core` | `30` | `cross_pillar` | `5` |

3. For each row, the script also prints the phase array's `(phase_name, content_type, item_count)` triple per phase.
4. Output saved to `Trackers/_scratch/S14-T2-PREFLIGHT-engine-shapes.md` for in-spec reference.

**Halt-on-drift discipline:** if any row's actual shape disagrees with the expected column, stop the build, write an `S14-T2-AMENDMENT-1` doc per Project Instructions principle #16, and proceed against the amendment as canonical contract. Never patch `phase_count == 5` assumptions in code; the orchestrator iterates by `phases.length`.

**Excluded from pre-flight:**

- `45`-min budget (not in T2's standard cell set; FUTURE_SCOPE #181).
- State focuses from home (T5 territory; the launcher's `state_focus` throw branch covers them).

### 6.2 Pre-build code report

**File:** `Trackers/_scratch/S14-T2-PREFLIGHT-code-report.md` (committed as scratch).

Verifies:

1. **`StorageService` API surface** — does `getPreference` / `setPreference` / `removePreference` exist with the signatures used in the spec? (T1 amendment confirms these names; re-confirm at T2 build.)
2. **`SuggestedSession.fromJson` / `toJson`** — does `toJson` exist? If not, the build adds it. Confirm `fromJson` round-trips cleanly.
3. **`SuggestedPhase` and `SuggestedItem` model field names** — confirm `phase`, `items[].contentType`, `items[].name`, `items[].durationMinutes`, `items[].sets`, `items[].reps`. (Pre-flight reads `app/lib/models/suggested_session.dart`.)
4. **`go_router` routes file** — confirm location (`app/lib/config/routes.dart`?) and add-route pattern.
5. **`main.dart` provider tree shape** — confirm `MultiProvider` style and registration pattern.
6. **`SessionLauncher`'s current `cross_pillar` throw message** — exact string for the diff-replace in §5.1.
7. **`home_page._onStart` placeholder** — exact text of the May-8 placeholder so the reroute to launcher diff is clean.
8. **Existing `PhaseIndicator`-style widgets in repo** — is there a similar component (S10-era home page indicators?) that should be reused or extended? If yes, that's a constraint; if no, T2 ships fresh.
9. **App-foreground hooks** — does the repo currently observe `WidgetsBindingObserver.didChangeAppLifecycleState`? If so, where, and is it provider-friendly? T2 needs this to handle "user backgrounds the app mid-session, foregrounds 10 minutes later."

**Halt-on-drift:** if any item disagrees with what the spec assumes, write an amendment doc.

### 6.3 No smoke

T2 has zero server-side changes. **No smoke harness updates.** The 3455/9 baseline from S14-T1 stays as-is.

### 6.4 `flutter analyze`

Baseline: 12 info-level hints (preserved through T1). T2 must not introduce new hints in any of the new or modified files.

### 6.5 Device acceptance flow (Prashob runs after Claude Code reports build complete)

1. Cold-launch app. Home page renders. No "resume session?" dialog (no in-progress session).
2. Tap a body focus on the pie (e.g. **biceps**). Pick **30 min** in the half-pie picker. Body-focus session card appears.
3. Tap **Start** on the session card. Cross-pillar session page opens. Phase indicator shows 5 segments; segment 0 is colored (active), 1–4 grey (pending). Phase stub view shows "Opening Breath" + the breathwork item name.
4. Tap **Next phase**. Phase indicator: segment 0 green (completed), segment 1 active. Body shows "Warm-up" + yoga item.
5. Tap **Pause**. Phase view shows "Paused". Pause icon flips to play.
6. Tap **Play**. Resumes.
7. Tap app-bar overflow → phase preview sheet shows all 5 phases with segment 1 highlighted.
8. Background the app. Wait 30s. Foreground. Page renders unchanged with phase 1 still active.
9. Force-stop the app. Cold-launch. Tap any body focus → tap **Start**. **Resume dialog appears.** Tap **Resume**. Page restored to phase 1.
10. Tap **Skip** on phase 1. Segment 1 turns orange (skipped); phase 2 active.
11. Tap **Next phase** through phases 2, 3, 4. After phase 4 completes, page shows snackbar "Cross-pillar session completed" and routes back to home.
12. Tap **Start** again on a body focus. **No resume dialog** (previous session was completed and cleared from storage).
13. **Mobility focus check.** Tap mobility wedge → 30 min → Start. Page opens. Phase indicator shows whatever count pre-flight discovered (4 or 5). All phases advance to completion. Snackbar fires.
14. **State focus check.** Tap a state-focus chip (e.g. calm) → pick a bracket → Start. **Snackbar fires** with T5 hand-off copy ("State-focus sessions land in S14-T5"). Home unchanged. **Confirms launcher's existing throw branch behaves correctly.**

### 6.6 No `/review`

Per Project Instructions principle #12, T2 is UI-heavy with no business-logic complexity that benefits from automated review. Device-test verification is sufficient. Defer `/review` to a future hygiene pass if tech debt accumulates.

---

## 7. Acceptance criteria

| # | Criterion | Verification |
|---|---|---|
| 1 | Home Start dispatches launcher; placeholder snackbar gone | Device step 3 |
| 2 | Cross_pillar phases advance index-by-index | Device step 4 |
| 3 | Pause / resume work | Device step 5–6 |
| 4 | Skip phase works one-way | Device step 10 |
| 5 | Phase preview sheet renders correct phase list | Device step 7 |
| 6 | Background / foreground preserves state | Device step 8 |
| 7 | Cold-start resume dialog works | Device step 9 |
| 8 | Final phase completion routes home with snackbar; storage cleared | Device step 11–12 |
| 9 | Mobility special case advances cleanly to completion (whatever phase count engine emits) | Device step 13 |
| 10 | State_focus from home surfaces T5 hand-off snackbar (no crash) | Device step 14 |
| 11 | `flutter analyze` no new hints | Build report |
| 12 | Pre-flight engine-shape verification matches spec §4 | Pre-flight artifact in `Trackers/_scratch/` |
| 13 | Provider iterates `phases.length`; no hard-coded `== 5` anywhere | Code review during build |

---

## 8. Anomalies surfaced by pre-flight (placeholder — populate at build time)

| anomaly | source | T2 disposition |
|---|---|---|
| (TBD) | (TBD) | (TBD) |

Build-time additions go here. Pattern matches T1 spec §10.

---

## 9. Drift log

Per Project Instructions principle #11 (spec-first ticketing), this section preserves architect-side reasoning that surfaced during spec authoring.

| date | source | drift / decision | resolution |
|---|---|---|---|
| 2026-05-08 | spec author | Five-phase orchestrator route — modal sheet vs full page | Full page at `/session/cross-pillar` (matches existing strength player route pattern; back-stack discipline easier with full page) |
| 2026-05-08 | spec author | Phase state machine — provider vs stateful page | Provider (`CrossPillarSessionProvider`) — matches repo `ChangeNotifier` convention; lets `PhaseStubView` and footer read separately |
| 2026-05-08 | spec author | Phase content rendering during T2 (pre-T4) | Stub view: phase name + items + Next button. Explicit "T2 stub" banner inside view body (Lesson #2 — minimal UI; T4 swaps for real players). |
| 2026-05-08 | spec author | Persistence mechanism | `StorageService.setPreference` with single JSON-encoded blob keyed `cross_pillar_session_v1`. Mirrors existing provider+StorageService pattern; versioned for future migration. |
| 2026-05-08 | spec author | Resume freshness window | 24 hours. Locked. (Polish: T6 may surface this in settings or shorten/lengthen based on user feedback.) |
| 2026-05-08 | spec author | Skip phase semantics — instant or confirm? | Instant for T2. Skip is one-way; no undo. T6 polish may add confirm + undo grace. |
| 2026-05-08 | spec author | Final phase completion — summary screen vs snackbar | Snackbar + return to home. Multi-phase summary screen is T6 polish. |
| 2026-05-08 | spec author | Per-phase persistence to backend | None in T2. T2 stubs don't actually run sessions. T4 wires real per-phase logging when embedded players come online. **Acceptable scope cut**: T2 ships orchestrator-only; nothing is logged to `sessions` table during a T2 cross-pillar run. |
| 2026-05-08 | spec author | Mobility shape — 4 phase or 5 phase? | **Discovered at pre-flight.** Orchestrator iterates by `phases.length`; never hard-codes 5. Pre-flight (§6.1) reports actual mobility shape; spec §4.2 covers both possibilities. |
| 2026-05-08 | spec author | What happens if state_focus reaches the launcher from home Start? | Launcher's existing `state_focus` throw branch fires; T1's `_friendlyError` snackbar surfaces "State-focus sessions land in S14-T5." T2 only **confirms** — no code change. Device step 14 verifies. |
| 2026-05-08 | spec author | 45-min budget support | Best-effort: orchestrator works for any `phases.length ≥ 1`. If engine throws (e.g. quads/45 per FUTURE_SCOPE #181), T1's `_friendlyError` catches it. T2 does not investigate the engine flake. |
| 2026-05-08 | Lesson #1 | Engine-consuming spec must verify shapes at pre-flight | §6.1 mandates `verify-s14-t2-shapes.mjs` as a committed pre-flight artifact, not a fix-up |
| 2026-05-08 | Lesson #2 | UI/layout calls are provisional | All UI specs in §5 (PhaseIndicator colors, PhaseStubView layout, PhaseActionBar arrangement) are intentionally minimal. Build smallest version; iterate via fix-up amendments after device test. |
| 2026-05-08 | Lesson #3 | Strength player UX contract (sequential set activation) | Not exercised in T2 (stub view doesn't run a real strength player). T4 must preserve the contract when embedded strength player lands. **Note in T4 spec.** |
| 2026-05-10 | device test step 7 | `PhasePreviewSheet` bottom sheet overflows by 12 pixels on test device — last phase tile cut off | Wrapped phase list in `Flexible(SingleChildScrollView)`. Lesson #2 — UI is provisional. Fix-up amendment 2. |
| 2026-05-10 | device test step 3 | App-bar title rendering low-contrast grey against dark background | Explicit `Theme.titleLarge.copyWith(onSurface, w600)` on `AppBar.title`. Fix-up amendment 2. |

---

## 10. Sprint tracker row template

When this ticket ships, add the following to `Trackers/SPRINT_TRACKER.md` Sprint 14 section, replacing the current `⏳ Planned` row:

```
| 2 | Cross_pillar 5-phase orchestrator + home Start | ✅ Shipped <date> | Flutter only (server unchanged). Branch `s14-t2`, sprint-chained off `s14-t1` HEAD. Feature commit <SHA> + chore commit <SHA>. **New files:** `app/lib/launchers/session_launcher.dart` cross_pillar branch, `app/lib/providers/cross_pillar_session_provider.dart` (phase state machine, persists via StorageService), `app/lib/pages/session/five_phase_session_page.dart`, `app/lib/pages/session/widgets/phase_indicator.dart`, `app/lib/pages/session/widgets/phase_stub_view.dart`, `app/lib/pages/session/widgets/phase_preview_sheet.dart`. **Modified:** `home_page._onStart` rewired to launcher (placeholder snackbar deleted), `routes.dart` + `/session/cross-pillar`, `main.dart` provider registration, `storage_service.dart` + `kCrossPillarSessionKey`. **Pre-flight artifacts:** `Trackers/_scratch/S14-T2-PREFLIGHT-engine-shapes.md` + `S14-T2-PREFLIGHT-code-report.md`. **Engine shape verification (per Lesson #1):** mobility emits <4 or 5> phases; standard body focuses emit 5 phases as expected. **No server changes; no smoke updates.** Smoke baseline 3455/9 preserved. **`flutter analyze`:** baseline 12 info hints preserved. No `/review` (UI-heavy ticket, device-verified per principle #12). 14-step device acceptance flow passed. **Drift log:** see spec §9. Spec: `Trackers/S14-T2-spec.md`. |
```

---

## 11. Files changed (predicted)

### New

- `app/lib/launchers/session_launcher.dart` — cross_pillar branch implementation (modify, not new — file exists from T1)
- `app/lib/providers/cross_pillar_session_provider.dart`
- `app/lib/pages/session/five_phase_session_page.dart`
- `app/lib/pages/session/widgets/phase_indicator.dart`
- `app/lib/pages/session/widgets/phase_stub_view.dart`
- `app/lib/pages/session/widgets/phase_preview_sheet.dart`

### Modified

- `app/lib/pages/home/home_page.dart` — `_onStart` rewired
- `app/lib/config/routes.dart` — `/session/cross-pillar` route
- `app/lib/main.dart` — provider registration
- `app/lib/services/storage_service.dart` — `kCrossPillarSessionKey` constant

### Throwaway (NOT committed)

- `server/scripts/verify-s14-t2-shapes.mjs` — pre-flight script; deleted before commit

### Documentation (committed alongside spec/build)

- `Trackers/S14-T2-spec.md` — this file
- `Trackers/_scratch/S14-T2-PREFLIGHT-engine-shapes.md` — pre-flight artifact
- `Trackers/_scratch/S14-T2-PREFLIGHT-code-report.md` — pre-flight artifact

---

## 12. Architect-side review checklist (before dispatching prompt)

Per Project Instructions principle #18:

- [ ] Spec assumes `phases.length` iteration, never `== 5`. Verified in §3, §4.2, §5.2 (provider), §5.4 (`PhaseIndicator(phaseCount: ...)`)
- [ ] Pre-flight script (§6.1) is committed as a normal artifact per Lesson #1, not a fix-up
- [ ] UI sections (§5.3–5.6) are minimal per Lesson #2; expect device-driven amendments
- [ ] Lesson #3 strength UX contract called out as T4-relevant in §9 drift log
- [ ] Server changes: zero (verified §2.1 + §6.3)
- [ ] State-focus from home: launcher's existing throw branch is exercised; device step 14 confirms (no new code)
- [ ] Mobility shape: orchestrator handles 4-or-5-phase outcome cleanly (§4.2 + §5.2 + §5.3)
- [ ] Race-condition fix preserved: launcher reads `session.metadata.focusSlug`, not `suggest.currentFocusSlug` (§5.7)
- [ ] Storage versioned (`_v1` suffix) for future migration (§5.10)
- [ ] No backend persistence in T2 — locked, documented, T4 to wire (§9 drift log)

---

*Spec ready for architect-side review and prompt authoring. Build prompt is throwaway per Project Instructions principle #11.*
