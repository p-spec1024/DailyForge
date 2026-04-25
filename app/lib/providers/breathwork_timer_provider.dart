import 'dart:async';
import 'package:flutter/foundation.dart';
import '../models/breathwork_technique.dart';
import '../services/api_service.dart';
import '../services/breathwork_service.dart';

enum TimerState { idle, running, paused, completed }

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

  BreathworkTechnique? _technique;
  List<BreathworkPhase> _phases = const [];
  int _totalRounds = 1;

  TimerState _state = TimerState.idle;
  int _currentPhaseIndex = 0;
  int _currentRound = 1;
  int _phaseSecondsRemaining = 0;
  int _totalElapsedSeconds = 0;
  bool _sessionLogged = false;

  Timer? _timer;

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

  void setTechnique(BreathworkTechnique technique) {
    _technique = technique;
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
    _timer?.cancel();
    _state = TimerState.completed;
    _logSession(completed: false);
    notifyListeners();
  }

  void _startTicker() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) => _tick());
  }

  void _tick() {
    if (_state != TimerState.running) return;
    _totalElapsedSeconds += 1;
    _phaseSecondsRemaining -= 1;
    if (_phaseSecondsRemaining <= 0) {
      _advancePhase();
    }
    notifyListeners();
  }

  void _advancePhase() {
    final nextIndex = _currentPhaseIndex + 1;
    if (nextIndex >= _phases.length) {
      // End of round
      if (_currentRound >= _totalRounds) {
        _completeSession();
        return;
      }
      _currentRound += 1;
      _currentPhaseIndex = 0;
    } else {
      _currentPhaseIndex = nextIndex;
    }
    _phaseSecondsRemaining = _phases[_currentPhaseIndex].duration;
  }

  void _completeSession() {
    _timer?.cancel();
    _state = TimerState.completed;
    _phaseSecondsRemaining = 0;
    _logSession(completed: true);
  }

  Future<void> _logSession({required bool completed}) async {
    if (_sessionLogged || _technique == null) return;
    _sessionLogged = true;
    final rounds = completed ? _totalRounds : (_currentRound - 1).clamp(0, _totalRounds);
    try {
      await _service.logSession(
        techniqueId: _technique!.id,
        durationSeconds: _totalElapsedSeconds,
        roundsCompleted: rounds,
        completed: completed,
      );
    } catch (_) {
      // Silently ignore — session completion shouldn't block UI.
    }
  }

  int get roundsCompleted {
    if (isCompleted && _currentPhaseIndex == 0 && _phaseSecondsRemaining == 0) {
      return _totalRounds;
    }
    return (_currentRound - 1).clamp(0, _totalRounds);
  }

  bool get fullyCompleted =>
      isCompleted &&
      _currentRound > _totalRounds - 1 &&
      (_phaseSecondsRemaining == 0);

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }
}
