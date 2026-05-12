import 'package:flutter_test/flutter_test.dart';
import 'package:dailyforge/models/breathwork_technique.dart';
import 'package:dailyforge/providers/breathwork_timer_provider.dart';
import 'package:dailyforge/services/breathwork_service.dart';

/// Fake [BreathworkService] for unit tests — provider drives completion
/// state without touching the network or the StorageService/secure-storage
/// platform plugins (which throw MissingPluginException under `flutter test`).
class _FakeBreathworkService implements BreathworkService {
  int logCalls = 0;
  bool? lastCompletedFlag;
  int? lastRoundsCompleted;

  @override
  Future<int?> logSession({
    required int techniqueId,
    required int durationSeconds,
    required int roundsCompleted,
    required bool completed,
    String? focusSlug,
  }) async {
    logCalls += 1;
    lastCompletedFlag = completed;
    lastRoundsCompleted = roundsCompleted;
    return 4242;
  }

  @override
  Future<BreathworkTechnique> getTechnique(int id) =>
      throw UnimplementedError();

  @override
  Future<List<BreathworkTechnique>> getTechniques({String? category}) =>
      throw UnimplementedError();
}

BreathworkTechnique _boxBreathing({int cycles = 6}) {
  return BreathworkTechnique(
    id: 1,
    name: 'Box Breathing',
    tradition: 'modern',
    category: 'balancing',
    purposes: const ['calm'],
    difficulty: 'beginner',
    safetyLevel: 'green',
    protocol: <String, dynamic>{
      'cycles': cycles,
      'phases': <Map<String, dynamic>>[
        {'type': 'inhale', 'duration': 4},
        {'type': 'hold', 'duration': 4},
        {'type': 'exhale', 'duration': 4},
        {'type': 'hold_out', 'duration': 4},
      ],
    },
  );
}

void main() {
  group('BreathworkTimerProvider — completion boundary (AMENDMENT-1 D5)', () {
    test('natural completion at last round normalizes state + sets reason',
        () async {
      final service = _FakeBreathworkService();
      final provider = BreathworkTimerProvider.withService(service);
      provider.setTechnique(_boxBreathing(cycles: 3));
      provider.start();

      // Tick through 3 rounds × 4 phases × 4 seconds = 48 ticks.
      // _tick decrements then advances on phaseSecondsRemaining <= 0.
      for (var i = 0; i < 48; i++) {
        provider.debugTick();
      }

      expect(provider.isCompleted, isTrue,
          reason: 'session should auto-complete after last phase of last round');
      expect(provider.endReason, BreathworkEndReason.naturalCompletion);
      expect(provider.wasInterrupted, isFalse);
      // Display correctness: roundsCompleted must equal totalRounds (no off-by-one).
      expect(provider.roundsCompleted, 3);
      expect(provider.totalRounds, 3);
      // Server log received completed=true with full round count.
      expect(service.logCalls, 1);
      expect(service.lastCompletedFlag, isTrue);
      expect(service.lastRoundsCompleted, 3);
    });

    test('user stop mid-session marks userStopped + interrupted', () async {
      final service = _FakeBreathworkService();
      final provider = BreathworkTimerProvider.withService(service);
      provider.setTechnique(_boxBreathing(cycles: 5));
      provider.start();

      // Tick through 2 full rounds (32 ticks), landing on phase 0 of round 3.
      for (var i = 0; i < 32; i++) {
        provider.debugTick();
      }
      expect(provider.currentRound, 3,
          reason: 'after 2 full rounds, ticker is in round 3');
      expect(provider.isRunning, isTrue);

      provider.stop();

      expect(provider.isCompleted, isTrue);
      expect(provider.endReason, BreathworkEndReason.userStopped);
      expect(provider.wasInterrupted, isTrue);
      // Two rounds were fully completed before the user stopped.
      expect(provider.roundsCompleted, 2);
      expect(service.lastCompletedFlag, isFalse);
      expect(service.lastRoundsCompleted, 2);
    });

    test('duration cap completion notifies listeners + sets durationCap reason',
        () async {
      final service = _FakeBreathworkService();
      final provider = BreathworkTimerProvider.withService(service);
      // Cap shorter than full protocol (3 cycles × 16s = 48s) — cap fires first.
      provider.setTechnique(
        _boxBreathing(cycles: 3),
        durationCapSeconds: 10,
      );

      var notifications = 0;
      provider.addListener(() => notifications += 1);
      provider.start();

      for (var i = 0; i < 10; i++) {
        provider.debugTick();
      }

      expect(provider.isCompleted, isTrue,
          reason: 'cap should complete the session after 10s elapsed');
      expect(provider.endReason, BreathworkEndReason.durationCap);
      expect(provider.wasInterrupted, isFalse,
          reason: 'cap completion is engine-driven, not user-initiated');
      // Pre-fix: cap path did NOT call notifyListeners — hang in embedded mode.
      // Post-fix: at least one notify on completion (in addition to per-tick).
      expect(notifications, greaterThanOrEqualTo(1));
      expect(service.lastCompletedFlag, isFalse,
          reason: 'cap-driven end logs completed=false (partial protocol)');
    });

    test('reset clears endReason back to none', () async {
      final service = _FakeBreathworkService();
      final provider = BreathworkTimerProvider.withService(service);
      provider.setTechnique(_boxBreathing(cycles: 1));
      provider.start();
      provider.stop();
      expect(provider.endReason, BreathworkEndReason.userStopped);

      provider.reset();
      expect(provider.endReason, BreathworkEndReason.none);
      expect(provider.isIdle, isTrue);
    });
  });
}
