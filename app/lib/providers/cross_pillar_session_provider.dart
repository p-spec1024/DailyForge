import 'dart:convert';

import 'package:flutter/foundation.dart';

import '../models/suggested_session.dart';
import '../players/phase_result.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';

enum PhaseStatus { pending, active, paused, completed, skipped }

/// S14-T4 quit intent — three categories per spec §6:
///   - null       : in-progress, no quit intent recorded yet
///   - 'pause'    : user tapped "Save and quit"; resume on next launch
///   - 'end_early': user tapped "End early"; completed phases logged, session
///                  closed (`cross_pillar_sessions.end_intent='end_early'`)
typedef QuitIntent = String?;

/// Phase state machine for the cross_pillar 5-phase orchestrator.
///
/// Holds the engine-supplied phase array, current phase index, per-phase
/// statuses, paused flag, the list of completed [PhaseResult]s, and a
/// quit-intent marker. Persists every mutation via [StorageService] so a
/// force-stop / cold-launch can resume within the freshness window. T4
/// extended the persistence schema with `phaseResults[]` + `quitIntent`
/// (backward-compatible — old blobs without these fields parse cleanly).
///
/// Iteration is `phases.length`-driven — never hard-coded to 5 — because the
/// engine emits 4-phase shapes for some focuses (mobility under Shape B
/// hypothetical, biceps under content-pool degradation; see
/// `Trackers/S14-T2-AMENDMENT-1-biceps-4-phase-drift.md`).
class CrossPillarSessionProvider extends ChangeNotifier {
  SuggestedSession? _session;
  int _currentPhaseIndex = 0;
  Map<int, PhaseStatus> _statuses = {};
  bool _paused = false;
  DateTime? _startedAt;
  final List<PhaseResult> _phaseResults = [];
  QuitIntent _quitIntent;

  SuggestedSession? get session => _session;
  int get currentPhaseIndex => _currentPhaseIndex;
  Map<int, PhaseStatus> get statuses => Map.unmodifiable(_statuses);
  bool get paused => _paused;
  bool get isActive => _session != null;
  DateTime? get startedAt => _startedAt;
  List<PhaseResult> get phaseResults => List.unmodifiable(_phaseResults);
  QuitIntent get quitIntent => _quitIntent;

  /// Count of non-skipped completed phases. Used by `cross_pillar_sessions.
  /// phases_completed` and by the end-early snackbar.
  int get phasesCompletedCount =>
      _phaseResults.where((r) => !r.wasSkipped).length;

  /// True when the orchestrator is on its final phase (zero-indexed).
  bool get isLastPhase {
    final s = _session;
    if (s == null) return false;
    return _currentPhaseIndex >= s.phases.length - 1;
  }

  /// True when every phase up to `phases.length` is either completed or
  /// skipped. Page should call [complete] on the next tick.
  bool get allPhasesDone {
    final s = _session;
    if (s == null) return false;
    for (var i = 0; i < s.phases.length; i++) {
      final st = _statuses[i];
      if (st != PhaseStatus.completed && st != PhaseStatus.skipped) {
        return false;
      }
    }
    return true;
  }

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
    _phaseResults.clear();
    _quitIntent = null;
    await _persist(storage);
    notifyListeners();
  }

  /// Returns the persisted snapshot without mutating in-memory provider
  /// state. The launcher uses this to ask "is there something to resume?"
  /// before deciding between `resumeFromStorage` and `startFresh`.
  Future<CrossPillarSessionSnapshot?> peekFromStorage(
    StorageService storage,
  ) async {
    final raw = await storage.getPreference(kCrossPillarSessionKey);
    if (raw is! String) return null;
    try {
      final decoded = jsonDecode(raw) as Map<String, dynamic>;
      return CrossPillarSessionSnapshot.fromJson(decoded);
    } catch (_) {
      // Corrupted blob — drop and treat as no-session rather than crash a
      // fresh launch.
      await storage.removePreference(kCrossPillarSessionKey);
      return null;
    }
  }

  /// Restore in-memory state from storage. Caller must have already verified
  /// freshness via [peekFromStorage].
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
    _phaseResults
      ..clear()
      ..addAll(snapshot.phaseResults);
    _quitIntent = null; // Resume implies the pause is being consumed.
    await _persist(storage);
    notifyListeners();
  }

  /// S14-T4: takes a [PhaseResult] from the embedded player, appends it,
  /// marks the phase completed (or skipped), advances, and persists.
  Future<void> completeCurrentPhase(
    PhaseResult result, {
    required StorageService storage,
  }) async {
    _requireActive();
    _phaseResults.add(result);
    _statuses[_currentPhaseIndex] =
        result.wasSkipped ? PhaseStatus.skipped : PhaseStatus.completed;
    _advance();
    await _persist(storage);
    notifyListeners();
  }

  /// User-initiated phase skip (action-bar "Skip" button). Records a
  /// minimal skip-only PhaseResult so phasesCompletedCount stays accurate
  /// and the cross_pillar endpoint sees the phase in `phaseResults`.
  Future<void> skipCurrentPhase({required StorageService storage}) async {
    _requireActive();
    final phase = _session!.phases[_currentPhaseIndex];
    _phaseResults.add(PhaseResult(
      phase: phase.phase,
      contentType:
          phase.items.isNotEmpty ? phase.items.first.contentType : 'unknown',
      completedAt: DateTime.now(),
      actualDuration: Duration.zero,
      items: phase.items,
      pillarSpecific: const <String, dynamic>{'user_skipped': true},
      wasSkipped: true,
      sessionId: null,
    ));
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

  /// S14-T4 quit intent (b) — "Save and quit". Persists the session with
  /// `quitIntent='pause'` so the next launch shows a resume prompt rather
  /// than auto-resuming. Does NOT write a cross_pillar_sessions row yet —
  /// that lands on either [endEarly] or natural [complete].
  Future<void> pauseAndQuit({required StorageService storage}) async {
    _requireActive();
    _quitIntent = 'pause';
    _paused = true;
    await _persist(storage);
    notifyListeners();
  }

  /// S14-T4 quit intent (c) — "End early". Writes a cross_pillar_sessions
  /// row tying together the completed-phase session ids, clears storage,
  /// resets in-memory state. The page surfaces the "Session ended — N
  /// phases logged" snackbar.
  Future<void> endEarly({
    required StorageService storage,
    required ApiService api,
  }) async {
    _requireActive();
    _quitIntent = 'end_early';
    await _writeCrossPillarSessionRow(api, endIntent: 'end_early');
    await storage.removePreference(kCrossPillarSessionKey);
    _resetInMemory();
    notifyListeners();
  }

  /// Throw away an in-progress session without completing it OR writing a
  /// cross_pillar_sessions row. Clears storage and resets in-memory state.
  Future<void> discard(StorageService storage) async {
    await storage.removePreference(kCrossPillarSessionKey);
    _resetInMemory();
    notifyListeners();
  }

  /// Natural completion — writes the cross_pillar_sessions row with
  /// `end_intent='completed'`, clears storage, resets in-memory state.
  /// T4 ships this as the standard path; T6 will hand off to a multi-phase
  /// summary screen before clearing state.
  Future<void> complete({
    required StorageService storage,
    required ApiService api,
  }) async {
    _requireActive();
    await _writeCrossPillarSessionRow(api, endIntent: 'completed');
    await storage.removePreference(kCrossPillarSessionKey);
    _resetInMemory();
    notifyListeners();
  }

  /// POSTs to /api/cross-pillar-sessions with the focus_slug, timing, phase
  /// counts, end-intent, and the partitioned per-pillar session id arrays.
  /// Errors are swallowed (logged via debugPrint) — the orchestrator
  /// shouldn't block the user's home-bound navigation on a server hiccup.
  Future<void> _writeCrossPillarSessionRow(
    ApiService api, {
    required String endIntent,
  }) async {
    final s = _session;
    if (s == null) return;
    final start = _startedAt ?? DateTime.now();
    final strengthYogaIds = <int>[];
    final breathworkIds = <int>[];
    for (final r in _phaseResults) {
      final id = r.sessionId;
      if (id == null) continue;
      if (r.contentType == 'breathwork') {
        breathworkIds.add(id);
      } else {
        strengthYogaIds.add(id);
      }
    }
    try {
      await api.post('/cross-pillar-sessions', {
        'focus_slug': s.metadata.focusSlug ?? 'unknown',
        'started_at': start.toIso8601String(),
        'completed_at': DateTime.now().toIso8601String(),
        'phases_completed': phasesCompletedCount,
        'total_phases': s.phases.length,
        'end_intent': endIntent,
        'strength_yoga_session_ids': strengthYogaIds,
        'breathwork_session_ids': breathworkIds,
      });
    } catch (e) {
      debugPrint(
        '[CrossPillarSessionProvider] cross-pillar-sessions POST failed: $e',
      );
    }
  }

  void _resetInMemory() {
    _session = null;
    _currentPhaseIndex = 0;
    _statuses = {};
    _paused = false;
    _startedAt = null;
    _phaseResults.clear();
    _quitIntent = null;
  }

  void _advance() {
    final n = _session!.phases.length;
    if (_currentPhaseIndex + 1 < n) {
      _currentPhaseIndex += 1;
      _statuses[_currentPhaseIndex] = PhaseStatus.active;
    }
    _paused = false;
  }

  void _requireActive() {
    if (_session == null) {
      throw StateError('CrossPillarSessionProvider has no active session');
    }
  }

  Future<void> _persist(StorageService storage) async {
    final snapshot = CrossPillarSessionSnapshot(
      session: _session!,
      currentPhaseIndex: _currentPhaseIndex,
      statuses: _statuses,
      paused: _paused,
      startedAt: _startedAt!,
      phaseResults: List.of(_phaseResults),
      quitIntent: _quitIntent,
    );
    await storage.setPreference(
      kCrossPillarSessionKey,
      jsonEncode(snapshot.toJson()),
    );
  }
}

/// On-disk shape for the orchestrator's persisted snapshot. T4 extended
/// with `phaseResults` and `quitIntent`. Older blobs without these fields
/// parse cleanly (defaults: empty list, null intent).
class CrossPillarSessionSnapshot {
  final SuggestedSession session;
  final int currentPhaseIndex;
  final Map<int, PhaseStatus> statuses;
  final bool paused;
  final DateTime startedAt;
  final List<PhaseResult> phaseResults;
  final QuitIntent quitIntent;

  const CrossPillarSessionSnapshot({
    required this.session,
    required this.currentPhaseIndex,
    required this.statuses,
    required this.paused,
    required this.startedAt,
    this.phaseResults = const <PhaseResult>[],
    this.quitIntent,
  });

  Map<String, dynamic> toJson() => {
        'session': session.toJson(),
        'currentPhaseIndex': currentPhaseIndex,
        'statuses':
            statuses.map((k, v) => MapEntry(k.toString(), v.name)),
        'paused': paused,
        'startedAt': startedAt.toIso8601String(),
        'phaseResults': phaseResults.map((r) => r.toJson()).toList(),
        'quitIntent': quitIntent,
      };

  factory CrossPillarSessionSnapshot.fromJson(Map<String, dynamic> json) {
    final rawResults = (json['phaseResults'] as List?) ?? const [];
    return CrossPillarSessionSnapshot(
      session:
          SuggestedSession.fromJson(json['session'] as Map<String, dynamic>),
      currentPhaseIndex: (json['currentPhaseIndex'] as num).toInt(),
      statuses: (json['statuses'] as Map<String, dynamic>).map(
        (k, v) => MapEntry(int.parse(k), PhaseStatus.values.byName(v as String)),
      ),
      paused: json['paused'] as bool,
      startedAt: DateTime.parse(json['startedAt'] as String),
      phaseResults: rawResults
          .whereType<Map<String, dynamic>>()
          .map(PhaseResult.fromJson)
          .toList(),
      quitIntent: json['quitIntent'] as String?,
    );
  }
}
