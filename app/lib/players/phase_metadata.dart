import '../models/suggested_session.dart';

/// Immutable phase metadata passed to an embeddable player.
///
/// Standalone players (running on their own route) receive a metadata object
/// with `isEmbedded == false` and routes-args-derived fields. Embedded
/// players receive engine-derived metadata via
/// [PhaseMetadata.fromSessionPhase].
class PhaseMetadata {
  /// Engine focus_slug (e.g. 'biceps', 'full_body', 'calm'). Nullable to
  /// tolerate standalone routes pre-dating engine-seeded sessions.
  final String? focusSlug;

  /// Engine phase name: 'warmup', 'main', 'cooldown', 'bookend_open',
  /// 'bookend_close'. Standalone strength sessions use 'main'.
  final String phase;

  /// 'strength' | 'yoga' | 'breathwork'. Determines which player renders
  /// when the orchestrator's body builder switches on this field.
  final String contentType;

  /// Target duration cap. Embedded breathwork honors this as a hard cap;
  /// embedded yoga uses it for pacing; embedded strength ignores it (sets
  /// drive completion).
  final int? durationMinutes;

  /// Engine-supplied items for this phase. For strength: exercise rows.
  /// For yoga: pose rows. For breathwork: technique row (singular).
  final List<SessionItem> items;

  /// Per-pillar user levels from `metadata.user_levels` — `{'strength':
  /// 'beginner', 'yoga': 'intermediate', 'breathwork': 'beginner'}`. Used
  /// by players to pick level-appropriate timings (e.g. yoga hold seconds).
  final Map<String, String> userLevels;

  /// True when the player is rendered inside a host (e.g. orchestrator);
  /// false when on its own route.
  final bool isEmbedded;

  /// S14-T5: session-level endless flag. Sourced from
  /// `SuggestedSession.metadata.isEndless`, propagated down to embedded
  /// players so they can switch UX mode:
  ///   - state-focus practice + isEndless → stopwatch + "I'm done"
  ///   - state-focus reflection + isEndless → silent screen, no timer
  /// Defaults to false; cross-pillar phases (T4) never set this.
  final bool isEndless;

  const PhaseMetadata({
    required this.focusSlug,
    required this.phase,
    required this.contentType,
    required this.durationMinutes,
    required this.items,
    required this.userLevels,
    required this.isEmbedded,
    this.isEndless = false,
  });

  /// Construct a PhaseMetadata from an engine-supplied [SessionPhase]. Used
  /// by the orchestrator's body builder when handing a phase to its embedded
  /// player.
  factory PhaseMetadata.fromSessionPhase(
    SessionPhase phase, {
    required String? focusSlug,
    required Map<String, String> userLevels,
    required bool isEmbedded,
    bool isEndless = false,
  }) {
    if (phase.items.isEmpty) {
      throw StateError(
        'PhaseMetadata.fromSessionPhase: phase "${phase.phase}" has no items',
      );
    }
    final firstItem = phase.items.first;
    // For multi-item phases (strength main, yoga warmup/cooldown), the
    // duration_minutes is null on individual items (strength) or per-item
    // (yoga). Embedded breathwork phases carry a single item with a
    // duration; we surface that directly. Other pillars get null and the
    // player drives completion by its own rules.
    final dur = phase.items.length == 1 ? firstItem.durationMinutes : null;
    return PhaseMetadata(
      focusSlug: focusSlug,
      phase: phase.phase,
      contentType: firstItem.contentType,
      durationMinutes: dur,
      items: phase.items,
      userLevels: userLevels,
      isEmbedded: isEmbedded,
      isEndless: isEndless,
    );
  }
}
