import 'phase_metadata.dart';
import 'phase_result.dart';

/// Contract every pillar player must satisfy to run embedded inside a host
/// (e.g. FivePhaseSessionPage orchestrator, T5's leg manager).
///
/// Standalone usage does not require this — players are still real widgets
/// that render fine on their own routes. Embedding is opt-in via constructor
/// flag.
abstract mixin class EmbeddablePlayer {
  /// True when running inside a host. False when running on its own route.
  /// Player widgets check this to suppress AppBar / Scaffold creation,
  /// intercept Navigator calls, and route completion to [onPhaseComplete].
  bool get isEmbedded;

  /// Phase metadata supplied by the host. Pillar-agnostic shape that includes
  /// engine focus_slug, duration target, items list, user levels.
  PhaseMetadata get phaseMetadata;

  /// Player-emitted: "I'm done." Called from inside the player when its
  /// completion condition fires (all sets logged, all poses passed, timer
  /// reached cap). Host advances to next phase on this signal. [PhaseResult]
  /// carries structured per-pillar data for logging + recency.
  void Function(PhaseResult) get onPhaseComplete;
}
