// Models for the S13-T5 picker endpoints under /api/focus-areas/:slug/...
//
// Strict JSON parsing: contract violations throw FormatException naming the
// offending field. Matches the SuggestedSession parser style — a missing or
// wrong-typed field is a server bug, not a graceful-degradation case.

class AvailableDurations {
  final String focusSlug;
  final String breathworkLevel;
  final List<DurationBracket> ranges;

  /// Server-side hint for which bracket to pre-select. Always one of the
  /// labels in [ranges] when non-null. Null when the user has no qualifying
  /// history and [ranges] is empty.
  final String? suggestedDefault;

  const AvailableDurations({
    required this.focusSlug,
    required this.breathworkLevel,
    required this.ranges,
    required this.suggestedDefault,
  });

  factory AvailableDurations.fromJson(Map<String, dynamic> json) {
    final slug = json['focus_slug'];
    if (slug is! String || slug.isEmpty) {
      throw FormatException(
        'AvailableDurations: expected non-empty `focus_slug` string, '
        'got ${slug.runtimeType}',
      );
    }
    final level = json['breathwork_level'];
    if (level is! String || level.isEmpty) {
      throw FormatException(
        'AvailableDurations: expected non-empty `breathwork_level` string, '
        'got ${level.runtimeType}',
      );
    }
    final rawRanges = json['ranges'];
    if (rawRanges is! List) {
      throw FormatException(
        'AvailableDurations: expected `ranges` to be a list, '
        'got ${rawRanges.runtimeType}',
      );
    }
    final ranges = <DurationBracket>[];
    for (var i = 0; i < rawRanges.length; i++) {
      final el = rawRanges[i];
      if (el is! Map<String, dynamic>) {
        throw FormatException(
          'AvailableDurations: ranges[$i] expected object, got ${el.runtimeType}',
        );
      }
      ranges.add(DurationBracket.fromJson(el));
    }
    final rawDefault = json['suggested_default'];
    if (rawDefault != null && rawDefault is! String) {
      throw FormatException(
        'AvailableDurations: expected `suggested_default` to be a string or null, '
        'got ${rawDefault.runtimeType}',
      );
    }
    return AvailableDurations(
      focusSlug: slug,
      breathworkLevel: level,
      ranges: List.unmodifiable(ranges),
      suggestedDefault: rawDefault as String?,
    );
  }
}

class DurationBracket {
  /// One of '0-10', '10-20', '21-30', '30-45', 'endless'. Hyphenated to
  /// match the engine's BRACKET_TABLE keys; not interchangeable with the
  /// underscore form used in the design doc draft.
  final String label;
  final String display;

  /// null for the 'endless' bracket; otherwise the lower bound of the
  /// engine's bracket window in minutes.
  final int? minTotalMinutes;

  /// null for the 'endless' bracket; otherwise the upper bound.
  final int? maxTotalMinutes;

  /// Always 'available' — the route layer filters out locked/empty entries
  /// before serializing (S13-T5 Decision #10). Surfaced anyway so future
  /// consumers can read it without parser changes.
  final String state;

  /// Number of main-eligible breathwork techniques the engine could place
  /// in this bracket at the user's level.
  final int? techniqueCount;

  const DurationBracket({
    required this.label,
    required this.display,
    required this.minTotalMinutes,
    required this.maxTotalMinutes,
    required this.state,
    required this.techniqueCount,
  });

  factory DurationBracket.fromJson(Map<String, dynamic> json) {
    final label = json['label'];
    if (label is! String || label.isEmpty) {
      throw FormatException(
        'DurationBracket: expected non-empty `label` string, got ${label.runtimeType}',
      );
    }
    final display = json['display'];
    if (display is! String || display.isEmpty) {
      throw FormatException(
        'DurationBracket: expected non-empty `display` string, got ${display.runtimeType}',
      );
    }
    final minRaw = json['min_total_minutes'];
    if (minRaw != null && minRaw is! num) {
      throw FormatException(
        'DurationBracket: expected `min_total_minutes` to be a number or null, '
        'got ${minRaw.runtimeType}',
      );
    }
    final maxRaw = json['max_total_minutes'];
    if (maxRaw != null && maxRaw is! num) {
      throw FormatException(
        'DurationBracket: expected `max_total_minutes` to be a number or null, '
        'got ${maxRaw.runtimeType}',
      );
    }
    final state = json['state'];
    if (state is! String || state.isEmpty) {
      throw FormatException(
        'DurationBracket: expected non-empty `state` string, got ${state.runtimeType}',
      );
    }
    final tcRaw = json['technique_count'];
    if (tcRaw != null && tcRaw is! num) {
      throw FormatException(
        'DurationBracket: expected `technique_count` to be a number or null, '
        'got ${tcRaw.runtimeType}',
      );
    }
    return DurationBracket(
      label: label,
      display: display,
      minTotalMinutes: minRaw == null ? null : (minRaw as num).toInt(),
      maxTotalMinutes: maxRaw == null ? null : (maxRaw as num).toInt(),
      state: state,
      techniqueCount: tcRaw == null ? null : (tcRaw as num).toInt(),
    );
  }

  bool get isEndless => label == 'endless';
}

/// Lightweight result of GET /api/focus-areas/:slug/suggested-default.
/// Polymorphic payload: int (minutes) for body focuses, String (bracket label)
/// for state focuses, null when the user has no qualifying history. The
/// typed accessors below pick the right shape based on [focusType].
class SuggestedDefault {
  final String focusSlug;
  final String focusType; // 'body' | 'state'
  final int? bodyMinutes;
  final String? stateBracket;

  const SuggestedDefault({
    required this.focusSlug,
    required this.focusType,
    required this.bodyMinutes,
    required this.stateBracket,
  });

  factory SuggestedDefault.fromJson(Map<String, dynamic> json) {
    final slug = json['focus_slug'];
    if (slug is! String || slug.isEmpty) {
      throw FormatException(
        'SuggestedDefault: expected non-empty `focus_slug` string, '
        'got ${slug.runtimeType}',
      );
    }
    final type = json['focus_type'];
    if (type != 'body' && type != 'state') {
      throw FormatException(
        'SuggestedDefault: expected `focus_type` in {body,state}, got $type',
      );
    }
    final raw = json['suggested_default'];
    int? bodyMinutes;
    String? stateBracket;
    if (raw != null) {
      if (type == 'body') {
        if (raw is! num) {
          throw FormatException(
            'SuggestedDefault: expected `suggested_default` to be a number for body focus, '
            'got ${raw.runtimeType}',
          );
        }
        bodyMinutes = raw.toInt();
      } else {
        if (raw is! String) {
          throw FormatException(
            'SuggestedDefault: expected `suggested_default` to be a string for state focus, '
            'got ${raw.runtimeType}',
          );
        }
        stateBracket = raw;
      }
    }
    return SuggestedDefault(
      focusSlug: slug,
      focusType: type as String,
      bodyMinutes: bodyMinutes,
      stateBracket: stateBracket,
    );
  }
}
