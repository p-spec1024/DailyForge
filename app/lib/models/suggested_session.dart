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

  Map<String, dynamic> toJson() => {
        'session_shape': sessionShape,
        'phases': phases.map((p) => p.toJson()).toList(),
        'warnings': warnings,
        'metadata': metadata.toJson(),
      };
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

  Map<String, dynamic> toJson() => {
        'phase': phase,
        'items': items.map((i) => i.toJson()).toList(),
      };
}

class SessionItem {
  final String contentType;
  final int? contentId;
  final String name;
  /// Engine returns `null` for strength items (the renderer shows sets×reps
  /// instead of a duration). Yoga and breathwork items always carry a value.
  final int? durationMinutes;
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
    if (duration != null && duration is! num) {
      throw FormatException(
        'SessionItem: expected `duration_minutes` to be a number or null, got ${duration.runtimeType}',
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
      durationMinutes: duration == null ? null : (duration as num).toInt(),
      tierBadge: tier as String?,
      sets: sets == null ? null : (sets as num).toInt(),
      reps: reps == null ? null : (reps as num).toInt(),
    );
  }

  Map<String, dynamic> toJson() => {
        'content_type': contentType,
        'content_id': contentId,
        'name': name,
        'duration_minutes': durationMinutes,
        'tier_badge': tierBadge,
        'sets': sets,
        'reps': reps,
      };
}

class SessionMetadata {
  final int estimatedTotalMin;
  final Map<String, String> userLevels;
  final String source;

  /// State-focus only (S13-T5): true when the engine generated an
  /// open-ended practice (no upper duration bound). null on body-focus
  /// responses, which never carry this field. Source: engine writes
  /// `metadata.is_endless` only for `session_shape: 'state_focus'`.
  final bool? isEndless;

  /// State-focus only (S13-T5): the bracket label the engine resolved
  /// the request to (one of '0-10', '10-20', '21-30', '30-45', 'endless').
  /// null on body-focus responses.
  final String? bracket;

  /// S14-T1: the focus_slug the engine resolved the session to. Always
  /// non-null in practice once both server and client ship the T1 changes;
  /// kept nullable in the model to tolerate staged-deploy windows where the
  /// client may receive a pre-T1 response.
  final String? focusSlug;

  const SessionMetadata({
    required this.estimatedTotalMin,
    required this.userLevels,
    required this.source,
    required this.isEndless,
    required this.bracket,
    required this.focusSlug,
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
    final endlessRaw = json['is_endless'];
    if (endlessRaw != null && endlessRaw is! bool) {
      throw FormatException(
        'SessionMetadata: expected `is_endless` to be a bool or absent, got ${endlessRaw.runtimeType}',
      );
    }
    final bracketRaw = json['bracket'];
    if (bracketRaw != null && bracketRaw is! String) {
      throw FormatException(
        'SessionMetadata: expected `bracket` to be a string or absent, got ${bracketRaw.runtimeType}',
      );
    }
    final focusSlugRaw = json['focus_slug'];
    if (focusSlugRaw != null && focusSlugRaw is! String) {
      throw FormatException(
        'SessionMetadata: expected `focus_slug` to be a string or absent, got ${focusSlugRaw.runtimeType}',
      );
    }
    return SessionMetadata(
      estimatedTotalMin: est.toInt(),
      userLevels: Map.unmodifiable(levels),
      source: source,
      isEndless: endlessRaw as bool?,
      bracket: bracketRaw as String?,
      focusSlug: focusSlugRaw as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'estimated_total_min': estimatedTotalMin,
        'user_levels': userLevels,
        'source': source,
        'is_endless': isEndless,
        'bracket': bracket,
        'focus_slug': focusSlug,
      };
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
