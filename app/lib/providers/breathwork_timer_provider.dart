import 'dart:async';
import 'package:flutter/foundation.dart';
import '../models/breathwork_technique.dart';
import '../services/api_service.dart';
import '../services/breathwork_service.dart';

enum TimerState { idle, running, paused, completed }

/// Why the session ended. Distinguishes natural completion from user stop
/// from duration-cap (embedded mode). Set inside [_completeSession].
///
/// AMENDMENT-1 D5: pre-T5 the provider had no end-reason field; the player
/// inferred "stopped early" from `roundsCompleted < totalRounds`, which
/// misfired when the completion state wasn't normalized (off-by-one) and
/// hung silently when the duration cap fired (no notifyListeners).
enum BreathworkEndReason { none, naturalCompletion, userStopped, durationCap }

class BreathworkPhase {
  final String type;
  final int duration;
  final String? instruction;

  BreathworkPhase({required this.type, required this.duration, this.instruction});

  factory BreathworkPhase.fromJson(Map<String, dynamic> json) {
    return BreathworkPhase(
      type: (json['type'] as String?) ?? 'hold',
      duration: (json['duration'] as num?)?.toInt() ?? 0,
      instruction: json['instruction'] as String?,
    );
  }
}

class BreathworkTimerProvider extends ChangeNotifier {
  final BreathworkService _service;

  BreathworkTimerProvider(ApiService api) : _service = BreathworkService(api);

  /// Test seam — bypasses the production [ApiService] / [BreathworkService]
  /// construction so unit tests can drive completion without a real network
  /// or platform plugin (StorageService uses flutter_secure_storage which
  /// throws MissingPluginException in `flutter test`).
  @visibleForTesting
  BreathworkTimerProvider.withService(this._service);

  BreathworkTechnique? _technique;
  List<BreathworkPhase> _phases = const [];
  int _totalRounds = 1;

  TimerState _state = TimerState.idle;
  int _currentPhaseIndex = 0;
  int _currentRound = 1;
  int _phaseSecondsRemaining = 0;
  int _totalElapsedSeconds = 0;
  bool _sessionLogged = false;
  BreathworkEndReason _endReason = BreathworkEndReason.none;

  Timer? _timer;

  /// S14-T4: server-side `breathwork_sessions.id` after _logSession resolves.
  /// Null until logging completes (or if logging fails). Embedded mode
  /// reads this for cross_pillar FK linkage.
  int? _loggedSessionId;
  int? get loggedSessionId => _loggedSessionId;

  /// S14-T4: the in-flight logging Future. Embedded players await this via
  /// [awaitLogging] before emitting onPhaseComplete so the FK id is ready.
  Future<void>? _loggingFuture;

  /// Awaits the in-flight breathwork_sessions write (if any) and returns
  /// the logged id. Idempotent: safe to call after completion.
  Future<int?> awaitLogging() async {
    if (_loggingFuture != null) {
      try {
        await _loggingFuture;
      } catch (_) {
        // _logSession already swallows errors; this catch is defensive.
      }
    }
    return _loggedSessionId;
  }

  /// S14-T4: optional hard duration cap in seconds. When set and reached
  /// mid-protocol, the timer transitions to completed (logging the rounds
  /// actually achieved). Used by embedded mode to honor engine
  /// `duration_minutes`. Null = no cap (standalone / full protocol).
  int? _durationCapSeconds;

  /// S14-T4: focus_slug to thread through the breathwork_sessions write.
  /// Embedded mode passes the engine-supplied slug; standalone is null.
  String? _focusSlug;

  // Getters
  BreathworkTechnique? get technique => _technique;
  TimerState get state => _state;
  bool get isIdle => _state == TimerState.idle;
  bool get isRunning => _state == TimerState.running;
  bool get isPaused => _state == TimerState.paused;
  bool get isCompleted => _state == TimerState.completed;

  int get currentRound => _currentRound;
  int get totalRounds => _totalRounds;
  int get totalElapsedSeconds => _totalElapsedSeconds;
  int get secondsRemaining => _phaseSecondsRemaining;

  BreathworkEndReason get endReason => _endReason;

  /// True only for user-initiated stops (Stop button). Natural completion
  /// and duration-cap completion are NOT interruptions — they're the
  /// session ending on its own terms.
  bool get wasInterrupted => _endReason == BreathworkEndReason.userStopped;

  BreathworkPhase? get _currentPhase =>
      _phases.isEmpty ? null : _phases[_currentPhaseIndex];

  String get currentPhaseType => _currentPhase?.type ?? 'hold';

  String get currentInstruction {
    final p = _currentPhase;
    if (p == null) return '';
    final i = p.instruction;
    if (i != null && i.isNotEmpty) return i;
    switch (p.type) {
      case 'inhale':
        return 'Breathe in slowly';
      case 'exhale':
        return 'Breathe out gently';
      case 'hold_out':
        return 'Hold empty';
      case 'hold':
      case 'hold_in':
        return 'Hold your breath';
      default:
        return '';
    }
  }

  int get phaseDuration => _currentPhase?.duration ?? 1;

  String get currentPhaseLabel {
    final t = currentPhaseType;
    if (t == 'inhale') return 'INHALE';
    if (t == 'exhale') return 'EXHALE';
    return 'HOLD';
  }

  String get currentPhaseKey {
    final t = currentPhaseType;
    if (t == 'inhale') return 'inhale';
    if (t == 'exhale') return 'exhale';
    return 'hold';
  }

  /// 0.0 → 1.0 progress within the current phase.
  double get phaseProgress {
    final d = phaseDuration;
    if (d <= 0) return 0;
    return ((d - _phaseSecondsRemaining) / d).clamp(0.0, 1.0);
  }

  void setTechnique(
    BreathworkTechnique technique, {
    int? durationCapSeconds,
    String? focusSlug,
  }) {
    _technique = technique;
    _durationCapSeconds = durationCapSeconds;
    _focusSlug = focusSlug;
    final protocol = technique.protocol;
    final rawPhases = (protocol['phases'] as List?) ?? const [];
    _phases = rawPhases
        .whereType<Map>()
        .map((e) => BreathworkPhase.fromJson(e.cast<String, dynamic>()))
        .where((p) => p.duration > 0)
        .toList();
    _totalRounds = (protocol['cycles'] as num?)?.toInt() ?? 1;
    reset();
  }

  void reset() {
    _timer?.cancel();
    _timer = null;
    _state = TimerState.idle;
    _currentPhaseIndex = 0;
    _currentRound = 1;
    _phaseSecondsRemaining = _phases.isNotEmpty ? _phases.first.duration : 0;
    _totalElapsedSeconds = 0;
    _sessionLogged = false;
    _endReason = BreathworkEndReason.none;
    notifyListeners();
  }

  void start() {
    if (_phases.isEmpty) return;
    _state = TimerState.running;
    _startTicker();
    notifyListeners();
  }

  void pause() {
    if (_state != TimerState.running) return;
    _state = TimerState.paused;
    _timer?.cancel();
    notifyListeners();
  }

  void resume() {
    if (_state != TimerState.paused) return;
    _state = TimerState.running;
    _startTicker();
    notifyListeners();
  }

  void stop() {
    if (_state == TimerState.completed) return;
    _completeSession(BreathworkEndReason.userStopped);
  }

  void _startTicker() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) => _tick());
  }

  @visibleForTesting
  void debugTick() => _tick();

  void _tick() {
    if (_state != TimerState.running) return;
    _totalElapsedSeconds += 1;
    _phaseSecondsRemaining -= 1;
    // S14-T4: duration cap (embedded mode honors engine's phase budget).
    final cap = _durationCapSeconds;
    if (cap != null && _totalElapsedSeconds >= cap) {
      _completeSession(BreathworkEndReason.durationCap);
      return;
    }
    if (_phaseSecondsRemaining <= 0) {
      _advancePhase();
      if (_state == TimerState.completed) return;
    }
    notifyListeners();
  }

  void _advancePhase() {
    final nextIndex = _currentPhaseIndex + 1;
    if (nextIndex >= _phases.length) {
      // End of round
      if (_currentRound >= _totalRounds) {
        _completeSession(BreathworkEndReason.naturalCompletion);
        return;
      }
      _currentRound += 1;
      _currentPhaseIndex = 0;
    } else {
      _currentPhaseIndex = nextIndex;
    }
    _phaseSecondsRemaining = _phases[_currentPhaseIndex].duration;
  }

  void _completeSession(BreathworkEndReason reason) {
    _timer?.cancel();
    _state = TimerState.completed;
    _endReason = reason;
    _phaseSecondsRemaining = 0;
    _loggingFuture = _logSession(
      completed: reason == BreathworkEndReason.naturalCompletion,
    );
    notifyListeners();
  }

  Future<void> _logSession({required bool completed}) async {
    if (_sessionLogged || _technique == null) return;
    _sessionLogged = true;
    final rounds = completed ? _totalRounds : (_currentRound - 1).clamp(0, _totalRounds);
    try {
      _loggedSessionId = await _service.logSession(
        techniqueId: _technique!.id,
        durationSeconds: _totalElapsedSeconds,
        roundsCompleted: rounds,
        completed: completed,
        focusSlug: _focusSlug,
      );
    } catch (_) {
      // Silently ignore — session completion shouldn't block UI.
    }
  }

  int get roundsCompleted {
    // AMENDMENT-1 D5: authoritative via _endReason. Pre-fix, this getter
    // used a state-shape sentinel (_currentPhaseIndex == 0 &&
    // _phaseSecondsRemaining == 0) which both missed natural completion
    // (when state wasn't normalized) and false-positived on user-stop at
    // a round boundary.
    if (_endReason == BreathworkEndReason.naturalCompletion) {
      return _totalRounds;
    }
    return (_currentRound - 1).clamp(0, _totalRounds);
  }

  bool get fullyCompleted =>
      _endReason == BreathworkEndReason.naturalCompletion;

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }
}
