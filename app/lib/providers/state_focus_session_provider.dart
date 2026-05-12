import '../services/storage_service.dart';
import 'multi_phase_session_provider.dart';

/// S14-T5 state-focus 3-stage orchestrator provider.
///
/// Inherits the full state machine + persistence + completion plumbing
/// from [MultiPhaseSessionProvider]. The only divergences from cross-
/// pillar are the storage key (isolates resume state from cross-pillar's
/// blob), the session_shape value written to the server, the smoother
/// transition UX (no 3s countdown), and the snackbar wording (Decision
/// #21 — "stages" reads more naturally for calm/energize/etc.).
class StateFocusSessionProvider extends MultiPhaseSessionProvider {
  @override
  String get sessionShape => 'state_focus';

  @override
  String get storageKey => kStateFocusSessionKey;

  /// Calm sessions skip the countdown chime/visual urgency (spec §9
  /// Decision). Host page reads this and renders an [AnimatedSwitcher]
  /// fade between phases instead.
  @override
  bool get useAutoAdvanceCountdown => false;

  /// State-focus snackbar copy: "N stages logged."
  @override
  String phasesNoun(int n) => n == 1 ? 'stage' : 'stages';
}
