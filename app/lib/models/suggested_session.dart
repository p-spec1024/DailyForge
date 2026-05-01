// Suggested-session models for the S12-T7 HTTP surface
// (`POST /api/sessions/suggest`). Shape is locked in
// Trackers/S12-T7-http-surface-spec.md Appendix B/C.
//
// Parsing is strict by design: any contract violation throws
// `FormatException` rather than silently dropping or coercing.
// Per the T7 contract, a missing/wrong-typed field is a server bug,
// not a graceful-degradation case.

class SuggestedSession {
  final String sessionShape;
  final List<SessionPhase> phases;
  final List<Map<String, dynamic>> warnings;
  final SessionMetadata metadata;

  const SuggestedSession({
    required this.sessionShape,
    required this.phases,
    required this.warnings,
    required this.metadata,
  });

  factory SuggestedSession.fromJson(Map<String, dynamic> json) {
    final shape = json['session_shape'];
    if (shape is! String) {
      throw FormatException(
        'SuggestedSession: expected `session_shape` to be a string, got ${shape.runtimeType}',
      );
    }
    final rawPhases = json['phases'];
    if (rawPhases is! List) {
      throw FormatException(
        'SuggestedSession: expected `phases` to be a list, got ${rawPhases.runtimeType}',
      );
    }
    final rawWarnings = json['warnings'];
    if (rawWarnings is! List) {
      throw FormatException(
        'SuggestedSession: expected `warnings` to be a list, got ${rawWarnings.runtimeType}',
      );
    }
    final rawMetadata = json['metadata'];
    if (rawMetadata is! Map<String, dynamic>) {
      throw FormatException(
        'SuggestedSession: expected `metadata` to be an object, got ${rawMetadata.runtimeType}',
      );
    }
    return SuggestedSession(
      sessionShape: shape,
      phases: _strictMap(rawPhases, 'phases', SessionPhase.fromJson),
      warnings: _strictWarnings(rawWarnings),
      metadata: SessionMetadata.fromJson(rawMetadata),
    );
  }
}

class SessionPhase {
  final String phase;
  final List<SessionItem> items;

  const SessionPhase({required this.phase, required this.items});

  factory SessionPhase.fromJson(Map<String, dynamic> json) {
    final phase = json['phase'];
    if (phase is! String) {
      throw FormatException(
        'SessionPhase: expected `phase` to be a string, got ${phase.runtimeType}',
      );
    }
    final rawItems = json['items'];
    if (rawItems is! List) {
      throw FormatException(
        'SessionPhase: expected `items` to be a list, got ${rawItems.runtimeType}',
      );
    }
    return SessionPhase(
      phase: phase,
      items: _strictMap(rawItems, 'items', SessionItem.fromJson),
    );
  }
}

class SessionItem {
  final String contentType;
  final int? contentId;
  final String name;
  final int durationMinutes;
  final String? tierBadge;
  final int? sets;
  final int? reps;

  const SessionItem({
    required this.contentType,
    required this.contentId,
    required this.name,
    required this.durationMinutes,
    required this.tierBadge,
    required this.sets,
    required this.reps,
  });

  factory SessionItem.fromJson(Map<String, dynamic> json) {
    final contentType = json['content_type'];
    if (contentType is! String) {
      throw FormatException(
        'SessionItem: expected `content_type` to be a string, got ${contentType.runtimeType}',
      );
    }
    final name = json['name'];
    if (name is! String) {
      throw FormatException(
        'SessionItem: expected `name` to be a string, got ${name.runtimeType}',
      );
    }
    final duration = json['duration_minutes'];
    if (duration is! num) {
      throw FormatException(
        'SessionItem: expected `duration_minutes` to be a number, got ${duration.runtimeType}',
      );
    }
    final rawId = json['content_id'];
    if (rawId != null && rawId is! num) {
      throw FormatException(
        'SessionItem: expected `content_id` to be a number or null, got ${rawId.runtimeType}',
      );
    }
    final tier = json['tier_badge'];
    if (tier != null && tier is! String) {
      throw FormatException(
        'SessionItem: expected `tier_badge` to be a string or null, got ${tier.runtimeType}',
      );
    }
    final sets = json['sets'];
    if (sets != null && sets is! num) {
      throw FormatException(
        'SessionItem: expected `sets` to be a number or null, got ${sets.runtimeType}',
      );
    }
    final reps = json['reps'];
    if (reps != null && reps is! num) {
      throw FormatException(
        'SessionItem: expected `reps` to be a number or null, got ${reps.runtimeType}',
      );
    }
    return SessionItem(
      contentType: contentType,
      contentId: rawId == null ? null : (rawId as num).toInt(),
      name: name,
      durationMinutes: duration.toInt(),
      tierBadge: tier as String?,
      sets: sets == null ? null : (sets as num).toInt(),
      reps: reps == null ? null : (reps as num).toInt(),
    );
  }
}

class SessionMetadata {
  final int estimatedTotalMin;
  final Map<String, String> userLevels;
  final String source;

  const SessionMetadata({
    required this.estimatedTotalMin,
    required this.userLevels,
    required this.source,
  });

  factory SessionMetadata.fromJson(Map<String, dynamic> json) {
    final est = json['estimated_total_min'];
    if (est is! num) {
      throw FormatException(
        'SessionMetadata: expected `estimated_total_min` to be a number, got ${est.runtimeType}',
      );
    }
    final source = json['source'];
    if (source is! String) {
      throw FormatException(
        'SessionMetadata: expected `source` to be a string, got ${source.runtimeType}',
      );
    }
    final rawLevels = json['user_levels'];
    if (rawLevels is! Map<String, dynamic>) {
      throw FormatException(
        'SessionMetadata: expected `user_levels` to be an object, got ${rawLevels.runtimeType}',
      );
    }
    final levels = <String, String>{};
    rawLevels.forEach((k, v) {
      if (v is! String) {
        throw FormatException(
          'SessionMetadata: expected `user_levels.$k` to be a string, got ${v.runtimeType}',
        );
      }
      levels[k] = v;
    });
    return SessionMetadata(
      estimatedTotalMin: est.toInt(),
      userLevels: Map.unmodifiable(levels),
      source: source,
    );
  }
}

List<T> _strictMap<T>(
  List raw,
  String fieldPath,
  T Function(Map<String, dynamic>) ctor,
) {
  final out = <T>[];
  for (var i = 0; i < raw.length; i++) {
    final el = raw[i];
    if (el is! Map<String, dynamic>) {
      throw FormatException(
        '$fieldPath[$i]: expected object, got ${el.runtimeType}',
      );
    }
    out.add(ctor(el));
  }
  return List.unmodifiable(out);
}

List<Map<String, dynamic>> _strictWarnings(List raw) {
  final out = <Map<String, dynamic>>[];
  for (var i = 0; i < raw.length; i++) {
    final el = raw[i];
    if (el is! Map<String, dynamic>) {
      throw FormatException(
        'warnings[$i]: expected object, got ${el.runtimeType}',
      );
    }
    out.add(el);
  }
  return List.unmodifiable(out);
}
