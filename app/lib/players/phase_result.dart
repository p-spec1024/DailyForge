import '../models/suggested_session.dart';

/// Immutable per-phase completion payload. Players emit this via
/// `onPhaseComplete` when their completion condition fires. The orchestrator
/// appends it to `CrossPillarSessionProvider._phaseResults` for the eventual
/// `POST /api/cross-pillar-sessions` write.
class PhaseResult {
  /// Engine phase name ('warmup', 'main', etc.).
  final String phase;

  /// 'strength' | 'yoga' | 'breathwork'. Determines which session table
  /// holds the [sessionId] (sessions for strength/yoga; breathwork_sessions
  /// for breathwork) — see S14-T4 AMENDMENT-1 D3.
  final String contentType;

  /// UTC timestamp the phase finished.
  final DateTime completedAt;

  /// Wall-clock duration the player ran (not the phase target).
  final Duration actualDuration;

  /// Items the phase was seeded with. Carried forward for the summary
  /// screen (T6).
  final List<SessionItem> items;

  /// Pillar-specific structured data. Schema by contentType:
  ///   strength: `{ 'sets_logged': int, 'total_volume_kg': double }`
  ///   yoga:     `{ 'poses_completed': int, 'poses_skipped': int }`
  ///   breath:   `{ 'rounds_completed': int, 'total_rounds': int }`
  final Map<String, dynamic>? pillarSpecific;

  /// True when the user tapped "Skip phase" instead of completing it.
  /// Cross-pillar provider's `phasesCompleted` getter excludes skipped.
  final bool wasSkipped;

  /// FK to the per-pillar session row:
  /// - strength/yoga → `sessions.id`
  /// - breathwork    → `breathwork_sessions.id`
  /// Nullable for failure paths (logSession 5xx, etc.) — the phase still
  /// counted but no row exists to FK.
  final int? sessionId;

  const PhaseResult({
    required this.phase,
    required this.contentType,
    required this.completedAt,
    required this.actualDuration,
    required this.items,
    required this.pillarSpecific,
    required this.wasSkipped,
    required this.sessionId,
  });

  Map<String, dynamic> toJson() => {
        'phase': phase,
        'content_type': contentType,
        'completed_at': completedAt.toIso8601String(),
        'actual_duration_seconds': actualDuration.inSeconds,
        'items': items.map((i) => i.toJson()).toList(),
        'pillar_specific': pillarSpecific,
        'was_skipped': wasSkipped,
        'session_id': sessionId,
      };

  factory PhaseResult.fromJson(Map<String, dynamic> json) {
    return PhaseResult(
      phase: json['phase'] as String,
      contentType: json['content_type'] as String,
      completedAt: DateTime.parse(json['completed_at'] as String),
      actualDuration: Duration(
        seconds: (json['actual_duration_seconds'] as num).toInt(),
      ),
      items: ((json['items'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(SessionItem.fromJson)
          .toList(),
      pillarSpecific: json['pillar_specific'] as Map<String, dynamic>?,
      wasSkipped: json['was_skipped'] as bool? ?? false,
      sessionId: json['session_id'] as int?,
    );
  }
}
