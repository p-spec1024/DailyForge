import 'package:wakelock_plus/wakelock_plus.dart';

/// Thin wrapper around `wakelock_plus` so callers don't import the package
/// directly. Two reasons:
/// 1. Easy to stub or swap if the package gets replaced.
/// 2. Centralized error swallowing — wakelock failures are non-fatal.
///
/// S14-T5 AMENDMENT-1 D12: pre-existing Sprint 9 gap; Android display
/// timeout was firing mid-session because nothing held a wakelock. Acquired
/// in `initState` and released in `dispose` of every session-bearing page
/// (multi-phase orchestrator + 3 standalone player shells).
///
/// Static methods (deviates from the instance-with-DI pattern used by
/// [ApiService] / [StorageService]) because `WakelockPlus` is itself
/// static and there is no state / dependency to inject. Avoids ceremonial
/// Provider registration for a stateless concern.
class WakelockService {
  /// Idempotent — safe to call twice; safe to call without a prior disable.
  static Future<void> enable() async {
    try {
      await WakelockPlus.enable();
    } catch (_) {
      // Better a darkening screen than a crashed session.
    }
  }

  /// Idempotent — safe to call without a prior enable.
  static Future<void> disable() async {
    try {
      await WakelockPlus.disable();
    } catch (_) {
      // Same — non-fatal.
    }
  }
}
