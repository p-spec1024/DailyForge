import 'dart:convert';

import 'package:flutter/foundation.dart';

import '../models/suggested_session.dart';
import '../services/storage_service.dart';

enum PhaseStatus { pending, active, paused, completed, skipped }

/// Phase state machine for the cross_pillar 5-phase orchestrator (S14-T2).
///
/// Holds the engine-supplied phase array, current phase index, per-phase
/// statuses, and a paused flag. Persists every mutation via [StorageService]
/// so a force-stop / cold-launch can resume the session within the freshness
/// window. T2 ships stub phase content; T4 will swap [PhaseStubView] for real
/// embedded players, but this provider's contract stays stable across the
/// swap.
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

  SuggestedSession? get session => _session;
  int get currentPhaseIndex => _currentPhaseIndex;
  Map<int, PhaseStatus> get statuses => Map.unmodifiable(_statuses);
  bool get paused => _paused;
  bool get isActive => _session != null;
  DateTime? get startedAt => _startedAt;

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
    notifyListeners();
  }

  Future<void> completeCurrentPhase({required StorageService storage}) async {
    _requireActive();
    _statuses[_currentPhaseIndex] = PhaseStatus.completed;
    _advance();
    await _persist(storage);
    notifyListeners();
  }

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

  /// Throw away an in-progress session without completing it. Clears storage
  /// and resets in-memory state. After this returns, [isActive] is false.
  Future<void> discard(StorageService storage) async {
    _session = null;
    _currentPhaseIndex = 0;
    _statuses = {};
    _paused = false;
    _startedAt = null;
    await storage.removePreference(kCrossPillarSessionKey);
    notifyListeners();
  }

  /// Final completion — clears storage and resets in-memory state. T6 will
  /// hand off to a multi-phase summary screen; T2 just snackbars + routes
  /// home. After this returns, [isActive] is false.
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

  void _advance() {
    final n = _session!.phases.length;
    if (_currentPhaseIndex + 1 < n) {
      _currentPhaseIndex += 1;
      _statuses[_currentPhaseIndex] = PhaseStatus.active;
    }
    // At the last phase the index stays put; the page reads allPhasesDone
    // and calls complete() next tick.
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
    );
    await storage.setPreference(
      kCrossPillarSessionKey,
      jsonEncode(snapshot.toJson()),
    );
  }
}

/// On-disk shape for the orchestrator's persisted snapshot. Exposed so the
/// launcher can read [startedAt] in its resume freshness check without
/// mutating provider state.
class CrossPillarSessionSnapshot {
  final SuggestedSession session;
  final int currentPhaseIndex;
  final Map<int, PhaseStatus> statuses;
  final bool paused;
  final DateTime startedAt;

  const CrossPillarSessionSnapshot({
    required this.session,
    required this.currentPhaseIndex,
    required this.statuses,
    required this.paused,
    required this.startedAt,
  });

  Map<String, dynamic> toJson() => {
        'session': session.toJson(),
        'currentPhaseIndex': currentPhaseIndex,
        'statuses':
            statuses.map((k, v) => MapEntry(k.toString(), v.name)),
        'paused': paused,
        'startedAt': startedAt.toIso8601String(),
      };

  factory CrossPillarSessionSnapshot.fromJson(Map<String, dynamic> json) {
    return CrossPillarSessionSnapshot(
      session:
          SuggestedSession.fromJson(json['session'] as Map<String, dynamic>),
      currentPhaseIndex: (json['currentPhaseIndex'] as num).toInt(),
      statuses: (json['statuses'] as Map<String, dynamic>).map(
        (k, v) => MapEntry(int.parse(k), PhaseStatus.values.byName(v as String)),
      ),
      paused: json['paused'] as bool,
      startedAt: DateTime.parse(json['startedAt'] as String),
    );
  }
}
