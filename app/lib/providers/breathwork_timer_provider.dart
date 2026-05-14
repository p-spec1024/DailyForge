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

/// How the timer decides when to stop.
///
/// S14-T6 / AMENDMENT-1 Decision C: cap semantics moved from mid-tick to
/// cycle boundary — "always ≥ engine budget, never <". Cycle integrity is
/// the UX contract; bookends may overshoot the budget by up to one cycle
/// length.
///
/// * [protocolCycles] — standalone default. Runs the technique's full
///   `protocol.cycles` count, then completes naturally.
/// * [endless] — state-focus practice. Runs without a cap; user drives
///   completion via the "I'm done" button (which calls [stop]). If the
///   protocol cycle count is reached first, natural completion still fires.
/// * [capped] — cross-pillar embedded bookend / centering. Runs until at
///   least [maxDuration] has elapsed, then completes the in-progress cycle
///   and stops. Always ≥ budget, never <.
enum BreathworkMode { protocolCycles, endless, capped }

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
  BreathworkMode _mode = BreathworkMode.protocolCycles;

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
  BreathworkMode get mode => _mode;

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
    BreathworkMode mode = BreathworkMode.protocolCycles,
  }) {
    _technique = technique;
    _durationCapSeconds = durationCapSeconds;
    _focusSlug = focusSlug;
    _mode = mode;
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

  /// S14-T6 §6.5: configure + immediately start in capped mode. Cap fires
  /// at the next cycle boundary once elapsed >= maxDuration (Decision C —
  /// "always ≥ engine budget, never <"). Used by cross-pillar embedded
  /// bookends and state-focus centering.
  void startCapped({
    required BreathworkTechnique technique,
    required Duration maxDuration,
    String? focusSlug,
  }) {
    if (maxDuration <= Duration.zero) {
      throw ArgumentError.value(
        maxDuration,
        'maxDuration',
        'must be > 0 (engine clamps via *_duration_min — defensive)',
      );
    }
    // S14-T6 Commit 1.7 (/review W-7): defensive cycle-length consistency
    // log. The cap fires at end-of-cycle, so a cap shorter than one cycle
    // means "run exactly one cycle, then stop" — by design per Decision C.
    // Logging makes the (intentional) overshoot observable when an engine
    // emit drifts (e.g. picking a 20s cycle for a 5s bookend budget).
    final cycleSeconds = _estimateCycleSeconds(technique);
    if (cycleSeconds > 0 && maxDuration.inSeconds < cycleSeconds) {
      debugPrint(
        '[BreathworkTimerProvider] startCapped: cap '
        '${maxDuration.inSeconds}s is shorter than one cycle '
        '(${cycleSeconds}s) — session will run exactly 1 cycle '
        '(${cycleSeconds}s) per cycle-integrity contract (Decision C).',
      );
    }
    setTechnique(
      technique,
      durationCapSeconds: maxDuration.inSeconds,
      focusSlug: focusSlug,
      mode: BreathworkMode.capped,
    );
    start();
  }

  /// Sums the duration of every protocol phase to produce a per-cycle
  /// total. Used by [startCapped]'s consistency log. Returns 0 if the
  /// technique has no phases (shouldn't happen — engine validates).
  int _estimateCycleSeconds(BreathworkTechnique technique) {
    final rawPhases = (technique.protocol['phases'] as List?) ?? const [];
    var total = 0;
    for (final p in rawPhases.whereType<Map>()) {
      final d = (p['duration'] as num?)?.toInt() ?? 0;
      if (d > 0) total += d;
    }
    return total;
  }

  /// S14-T6 §6.5: configure + immediately start in endless mode. No cap;
  /// user drives completion via [stop]. If the protocol cycle count is
  /// reached first, natural completion fires (the user is unlikely to
  /// outlast 5+ cycles of a state-focus practice, but the path is honored
  /// for cleanliness).
  void startEndless({
    required BreathworkTechnique technique,
    String? focusSlug,
  }) {
    setTechnique(
      technique,
      durationCapSeconds: null,
      focusSlug: focusSlug,
      mode: BreathworkMode.endless,
    );
    start();
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
    // S14-T6 Decision C: the duration cap moved from mid-tick to the
    // cycle-boundary branch of [_advancePhase]. Cycle integrity > exact
    // budget compliance — bookends may overshoot by < one cycle length.
    if (_phaseSecondsRemaining <= 0) {
      _advancePhase();
      if (_state == TimerState.completed) return;
    }
    notifyListeners();
  }

  void _advancePhase() {
    final nextIndex = _currentPhaseIndex + 1;
    if (nextIndex >= _phases.length) {
      // End of cycle. Decide whether to start another cycle or complete.
      //
      // S14-T6 Decision C: capped mode checks the budget here, AFTER the
      // current cycle completed. "Always ≥ engine budget, never <" —
      // overshoots up to one cycle length are acceptable; mid-cycle cuts
      // feel jarring and broken.
      final cap = _durationCapSeconds;
      if (_mode == BreathworkMode.capped &&
          cap != null &&
          _totalElapsedSeconds >= cap) {
        _completeSession(BreathworkEndReason.durationCap);
        return;
      }
      // protocolCycles completes at totalRounds; endless does NOT auto-
      // complete on the protocol count (user drives via stop()). If the
      // user happens to ride a state-focus practice past its protocol
      // count, endless keeps cycling — the round counter increments past
      // _totalRounds; the endless UI shows the stopwatch instead.
      if (_mode != BreathworkMode.endless &&
          _currentRound >= _totalRounds) {
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
    // S14-T6 Decision C: cap now fires at cycle boundary (after the in-
    // progress cycle completes), so _currentRound reflects fully-completed
    // cycles — no -1 needed. User-stop still subtracts 1 (user interrupted
    // mid-round; the current round is in progress, not complete).
    if (_endReason == BreathworkEndReason.durationCap) {
      return _currentRound.clamp(0, _totalRounds);
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
