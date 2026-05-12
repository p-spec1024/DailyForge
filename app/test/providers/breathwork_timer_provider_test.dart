import 'package:flutter/foundation.dart' show debugPrint;
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
      // S14-T6 Decision C: cap fires at cycle boundary, not mid-tick.
      // Box Breathing cycle is 16s; with cap=10 the cap fires at end of
      // cycle 1 (tick 16, elapsed=16 >= 10) — overshoot of 6s is the
      // documented "always ≥ budget, never <" behavior.
      provider.startCapped(
        technique: _boxBreathing(cycles: 3),
        maxDuration: const Duration(seconds: 10),
      );

      var notifications = 0;
      provider.addListener(() => notifications += 1);

      for (var i = 0; i < 16; i++) {
        provider.debugTick();
      }

      expect(provider.isCompleted, isTrue,
          reason: 'cap should complete the session at cycle 1 end');
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

  // ─────────────────────────────────────────────────────────────────────
  // S14-T6 — BreathworkMode capped (Decision C: cycle-boundary cap;
  // "always ≥ engine budget, never <"). Each case uses a 10s-per-cycle
  // technique so the math is easy to read.
  // ─────────────────────────────────────────────────────────────────────
  group('S14-T6: BreathworkMode capped (cycle-boundary; Decision C)', () {
    test('30s cap, 10s cycle → 3 cycles, stops at ~30s', () async {
      final service = _FakeBreathworkService();
      final provider = BreathworkTimerProvider.withService(service);
      provider.startCapped(
        technique: _tenSecondCycle(cycles: 10),
        maxDuration: const Duration(seconds: 30),
      );
      for (var i = 0; i < 30; i++) {
        provider.debugTick();
      }
      expect(provider.isCompleted, isTrue);
      expect(provider.endReason, BreathworkEndReason.durationCap);
      expect(provider.roundsCompleted, 3);
      expect(provider.totalElapsedSeconds, 30);
      expect(provider.mode, BreathworkMode.capped);
    });

    test('5s cap, 10s cycle → 1 cycle, stops at ~10s (cycle integrity wins)',
        () async {
      final service = _FakeBreathworkService();
      final provider = BreathworkTimerProvider.withService(service);
      provider.startCapped(
        technique: _tenSecondCycle(cycles: 10),
        maxDuration: const Duration(seconds: 5),
      );
      for (var i = 0; i < 10; i++) {
        provider.debugTick();
      }
      expect(provider.isCompleted, isTrue);
      expect(provider.endReason, BreathworkEndReason.durationCap);
      expect(provider.roundsCompleted, 1,
          reason: 'cap is < cycle length — completes exactly 1 cycle');
      expect(provider.totalElapsedSeconds, 10);
    });

    test('0s cap → throws ArgumentError', () async {
      final service = _FakeBreathworkService();
      final provider = BreathworkTimerProvider.withService(service);
      expect(
        () => provider.startCapped(
          technique: _tenSecondCycle(cycles: 1),
          maxDuration: Duration.zero,
        ),
        throwsA(isA<ArgumentError>()),
      );
    });

    test('endless mode does NOT auto-complete at totalRounds (regression)',
        () async {
      final service = _FakeBreathworkService();
      final provider = BreathworkTimerProvider.withService(service);
      provider.startEndless(technique: _tenSecondCycle(cycles: 2));
      // Tick past the protocol cycle count — 3 cycles' worth.
      for (var i = 0; i < 30; i++) {
        provider.debugTick();
      }
      expect(provider.isCompleted, isFalse,
          reason: 'endless mode keeps cycling past protocol totalRounds');
      expect(provider.mode, BreathworkMode.endless);
      // User-driven stop still works in endless mode.
      provider.stop();
      expect(provider.isCompleted, isTrue);
      expect(provider.endReason, BreathworkEndReason.userStopped);
    });

    test('protocolCycles mode still completes at totalRounds (regression)',
        () async {
      final service = _FakeBreathworkService();
      final provider = BreathworkTimerProvider.withService(service);
      provider.setTechnique(_tenSecondCycle(cycles: 2));
      expect(provider.mode, BreathworkMode.protocolCycles);
      provider.start();
      for (var i = 0; i < 20; i++) {
        provider.debugTick();
      }
      expect(provider.isCompleted, isTrue);
      expect(provider.endReason, BreathworkEndReason.naturalCompletion);
      expect(provider.roundsCompleted, 2);
    });

    test('25s cap, 10s cycle → 3 cycles, stops at 30s (overshoot of 5s)',
        () async {
      final service = _FakeBreathworkService();
      final provider = BreathworkTimerProvider.withService(service);
      provider.startCapped(
        technique: _tenSecondCycle(cycles: 10),
        maxDuration: const Duration(seconds: 25),
      );
      for (var i = 0; i < 30; i++) {
        provider.debugTick();
      }
      expect(provider.isCompleted, isTrue,
          reason: 'cap (25s) crossed during cycle 3 — finish the cycle, then stop');
      expect(provider.endReason, BreathworkEndReason.durationCap);
      expect(provider.roundsCompleted, 3,
          reason: 'cycle 3 was completed in-progress when cap crossed');
      expect(provider.totalElapsedSeconds, 30,
          reason: 'overshoot of 5s is the documented Decision C behavior');
    });

    // S14-T6 Commit 1.7 (/review W-7): defensive consistency log fires when
    // cap < one cycle. Behavior is unchanged (Test 2 already verifies 1
    // cycle runs); this test guards the observability shim.
    test('startCapped logs warning when cap < one cycle', () async {
      final service = _FakeBreathworkService();
      final provider = BreathworkTimerProvider.withService(service);
      final logs = <String>[];
      final original = debugPrint;
      debugPrint = (String? message, {int? wrapWidth}) {
        if (message != null) logs.add(message);
      };
      try {
        provider.startCapped(
          technique: _tenSecondCycle(cycles: 10),
          maxDuration: const Duration(seconds: 5),
        );
      } finally {
        debugPrint = original;
      }
      expect(
        logs.any((m) =>
            m.contains('startCapped') && m.contains('shorter than one cycle')),
        isTrue,
        reason: 'sub-cycle cap should emit a consistency warning',
      );
    });
  });
}

/// Helper: build a 10-second-per-cycle technique for capped-mode tests.
/// Two phases of 5s each = 10s cycle, regardless of `cycles` count.
BreathworkTechnique _tenSecondCycle({required int cycles}) {
  return BreathworkTechnique(
    id: 99,
    name: '10s test technique',
    tradition: 'modern',
    category: 'balancing',
    purposes: const ['calm'],
    difficulty: 'beginner',
    safetyLevel: 'green',
    protocol: <String, dynamic>{
      'cycles': cycles,
      'phases': <Map<String, dynamic>>[
        {'type': 'inhale', 'duration': 5},
        {'type': 'exhale', 'duration': 5},
      ],
    },
  );
}
