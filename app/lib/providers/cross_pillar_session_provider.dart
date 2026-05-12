import '../services/storage_service.dart';
import 'multi_phase_session_provider.dart';

// Re-export so existing callers (launcher, widgets) that import via
// cross_pillar_session_provider.dart still see PhaseStatus / QuitIntent /
// MultiPhaseSessionSnapshot without churn. New code can import the symbols
// directly from `multi_phase_session_provider.dart`.
export 'multi_phase_session_provider.dart'
    show PhaseStatus, QuitIntent, MultiPhaseSessionSnapshot;

/// S14-T4 cross-pillar 5-phase orchestrator provider. S14-T5 refactored:
/// 95% of the state machine + persistence moved up to
/// [MultiPhaseSessionProvider]. This class keeps the cross-pillar identity
/// — storage key, snackbar wording, auto-advance UX — and inherits
/// everything else.
///
/// Public API surface preserved exactly from T4 — page, widgets, launcher
/// continue to call `startFresh`, `peekFromStorage`, `complete`, etc.
/// without modification.
class CrossPillarSessionProvider extends MultiPhaseSessionProvider {
  @override
  String get sessionShape => 'cross_pillar';

  @override
  String get storageKey => kCrossPillarSessionKey;

  /// Cross-pillar uses the 3s auto-advance countdown overlay between
  /// phases (T4 spec §8). State-focus subclass overrides to suppress it.
  @override
  bool get useAutoAdvanceCountdown => true;

  /// Cross-pillar snackbar copy: "N phases logged."
  @override
  String phasesNoun(int n) => n == 1 ? 'phase' : 'phases';
}
