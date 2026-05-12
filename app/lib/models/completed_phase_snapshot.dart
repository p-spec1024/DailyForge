/// S14-T6 §6.1: per-phase snapshot for the post-session summary screen.
///
/// Derived from a [PhaseResult] + the engine [SessionPhase] at compose-time;
/// holds only the bits the summary UI renders. Kept separate from PhaseResult
/// so the summary contract isn't coupled to the orchestrator's quit-time
/// write shape.
class CompletedPhaseSnapshot {
  /// Display label resolved via `phaseDisplayLabel()` (e.g. 'Warm-up',
  /// 'Bookend (Open)'). Already user-facing.
  final String phaseLabel;

  /// Raw engine slug (e.g. 'bookend_open', 'warmup', 'centering'). Used by
  /// the summary's icon mapping table.
  final String phaseSlug;

  /// Actual elapsed seconds the player ran. Not the engine estimate —
  /// skipped phases get 0.
  final int durationSeconds;

  /// True when the user tapped Skip on this phase.
  final bool wasSkipped;

  /// First-item display name (e.g. 'Box Breathing', 'Bicep Curls'). Null
  /// when the phase had no items (defensive; engine always seeds ≥1).
  final String? primaryContentName;

  const CompletedPhaseSnapshot({
    required this.phaseLabel,
    required this.phaseSlug,
    required this.durationSeconds,
    required this.wasSkipped,
    required this.primaryContentName,
  });
}
