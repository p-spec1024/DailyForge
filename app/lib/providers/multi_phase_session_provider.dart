import 'dart:convert';

import 'package:flutter/foundation.dart';

import '../models/suggested_session.dart';
import '../players/phase_result.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';

enum PhaseStatus { pending, active, paused, completed, skipped }

/// S14-T4 quit intent — three categories per spec §6 (T4 inherited by T5):
///   - null       : in-progress, no quit intent recorded yet
///   - 'pause'    : user tapped "Save and quit"; resume on next launch
///   - 'end_early': user tapped "End early"; completed phases logged, session
///                  closed (`multi_phase_sessions.end_intent='end_early'`)
typedef QuitIntent = String?;

/// S14-T5: abstract base for multi-phase orchestrator providers.
///
/// `CrossPillarSessionProvider` (T4) and `StateFocusSessionProvider` (T5)
/// both inherit. The base owns the full state machine: phase index, per-
/// phase statuses, paused flag, the list of completed [PhaseResult]s, and
/// the persistence + completion plumbing. Subclasses provide:
///
/// * [sessionShape] — server-side discriminator (`'cross_pillar'` |
///   `'state_focus'`). Sent in the POST body to `/multi-phase-sessions`.
/// * [storageKey] — SharedPreferences key for the in-progress snapshot.
///   Each subclass owns its own slot so the two flows don't step on each
///   other's resume state.
/// * [useAutoAdvanceCountdown] — whether the host page should render the
///   3s countdown overlay between phases. Cross-pillar: yes (T4 behavior
///   preserved). State-focus: no (spec §9 Decision — calm sessions skip).
/// * [phasesNoun] — singular/plural noun for the completion snackbar.
///   Cross-pillar: "phase(s)". State-focus: "stage(s)" (spec §21).
abstract class MultiPhaseSessionProvider extends ChangeNotifier {
  String get sessionShape;
  String get storageKey;
  bool get useAutoAdvanceCountdown;
  String phasesNoun(int n);

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

  /// Count of non-skipped completed phases. Used by `multi_phase_sessions.
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
  /// before deciding between [resumeFromStorage] and [startFresh].
  Future<MultiPhaseSessionSnapshot?> peekFromStorage(
    StorageService storage,
  ) async {
    final raw = await storage.getPreference(storageKey);
    if (raw is! String) return null;
    try {
      final decoded = jsonDecode(raw) as Map<String, dynamic>;
      return MultiPhaseSessionSnapshot.fromJson(decoded);
    } catch (_) {
      await storage.removePreference(storageKey);
      return null;
    }
  }

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
    _quitIntent = null;
    await _persist(storage);
    notifyListeners();
  }

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

  Future<void> pauseAndQuit({required StorageService storage}) async {
    _requireActive();
    _quitIntent = 'pause';
    _paused = true;
    await _persist(storage);
    notifyListeners();
  }

  Future<void> endEarly({
    required StorageService storage,
    required ApiService api,
  }) async {
    _requireActive();
    _quitIntent = 'end_early';
    await _writeMultiPhaseSessionRow(api, endIntent: 'end_early');
    await storage.removePreference(storageKey);
    _resetInMemory();
    notifyListeners();
  }

  Future<void> discard(StorageService storage) async {
    await storage.removePreference(storageKey);
    _resetInMemory();
    notifyListeners();
  }

  Future<void> complete({
    required StorageService storage,
    required ApiService api,
  }) async {
    _requireActive();
    await _writeMultiPhaseSessionRow(api, endIntent: 'completed');
    await storage.removePreference(storageKey);
    _resetInMemory();
    notifyListeners();
  }

  /// POSTs to /api/multi-phase-sessions with focus_slug, session_shape,
  /// timing, phase counts, end-intent, and the partitioned per-pillar
  /// session id arrays. Errors are swallowed (logged via debugPrint) — the
  /// orchestrator shouldn't block the user's home-bound navigation on a
  /// server hiccup.
  Future<void> _writeMultiPhaseSessionRow(
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
      await api.post('/multi-phase-sessions', {
        'focus_slug': s.metadata.focusSlug ?? 'unknown',
        'session_shape': sessionShape,
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
        '[$runtimeType] multi-phase-sessions POST failed: $e',
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
      throw StateError('$runtimeType has no active session');
    }
  }

  Future<void> _persist(StorageService storage) async {
    final snapshot = MultiPhaseSessionSnapshot(
      session: _session!,
      currentPhaseIndex: _currentPhaseIndex,
      statuses: _statuses,
      paused: _paused,
      startedAt: _startedAt!,
      phaseResults: List.of(_phaseResults),
      quitIntent: _quitIntent,
    );
    await storage.setPreference(
      storageKey,
      jsonEncode(snapshot.toJson()),
    );
  }
}

/// On-disk shape for the orchestrator's persisted snapshot. T4 originally
/// introduced this as `CrossPillarSessionSnapshot`; T5 generalized + renamed
/// when extracting the base provider. The JSON shape is unchanged — T4-era
/// blobs deserialize cleanly into this class.
class MultiPhaseSessionSnapshot {
  final SuggestedSession session;
  final int currentPhaseIndex;
  final Map<int, PhaseStatus> statuses;
  final bool paused;
  final DateTime startedAt;
  final List<PhaseResult> phaseResults;
  final QuitIntent quitIntent;

  const MultiPhaseSessionSnapshot({
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

  factory MultiPhaseSessionSnapshot.fromJson(Map<String, dynamic> json) {
    final rawResults = (json['phaseResults'] as List?) ?? const [];
    return MultiPhaseSessionSnapshot(
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
