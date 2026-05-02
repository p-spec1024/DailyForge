// Home-page stats, weekly activity, daily load, and daily counts models.
// Decoded from `/api/home/stats`, `/api/home/weekly-activity` (S10-T5c-b),
// `/api/home/daily-load`, `/api/home/daily-counts` (S13-T4).

class PillarDurations {
  final int strength;
  final int yoga;
  final int breath;

  const PillarDurations({
    required this.strength,
    required this.yoga,
    required this.breath,
  });

  /// Static fallbacks from the T5c-b spec, used on decode failure so the
  /// three-pillar UI can always render plausible defaults.
  static const fallback = PillarDurations(strength: 45, yoga: 20, breath: 10);

  factory PillarDurations.fromJson(Map<String, dynamic> json) {
    int pick(String k, int dflt) {
      final v = json[k];
      if (v is num) return v.toInt();
      return dflt;
    }
    return PillarDurations(
      strength: pick('strength', fallback.strength),
      yoga: pick('yoga', fallback.yoga),
      breath: pick('breath', fallback.breath),
    );
  }
}

class HomeStats {
  final int streakDays;
  final int minutesThisWeek;
  final int sessionsThisYear;
  final PillarDurations pillarDurations;

  const HomeStats({
    required this.streakDays,
    required this.minutesThisWeek,
    required this.sessionsThisYear,
    required this.pillarDurations,
  });

  factory HomeStats.fromJson(Map<String, dynamic> json) {
    final rawPillar = json['pillarDurations'];
    return HomeStats(
      streakDays: (json['streakDays'] as num?)?.toInt() ?? 0,
      minutesThisWeek: (json['minutesThisWeek'] as num?)?.toInt() ?? 0,
      sessionsThisYear: (json['sessionsThisYear'] as num?)?.toInt() ?? 0,
      pillarDurations: rawPillar is Map<String, dynamic>
          ? PillarDurations.fromJson(rawPillar)
          : PillarDurations.fallback,
    );
  }
}

class WeeklyActivity {
  /// ISO date string of the Monday of the week, e.g. '2026-04-06'.
  final String weekStart;
  final int strength;
  final int yoga;
  final int breath;

  const WeeklyActivity({
    required this.weekStart,
    required this.strength,
    required this.yoga,
    required this.breath,
  });

  int get total => strength + yoga + breath;

  factory WeeklyActivity.fromJson(Map<String, dynamic> json) {
    return WeeklyActivity(
      weekStart: json['weekStart'] as String? ?? '',
      strength: (json['strength'] as num?)?.toInt() ?? 0,
      yoga: (json['yoga'] as num?)?.toInt() ?? 0,
      breath: (json['breath'] as num?)?.toInt() ?? 0,
    );
  }
}

/// One day of training-load minutes from `/api/home/daily-load`.
/// Window is always 30 contiguous days (oldest → newest); empty days
/// emit `loadMinutes: 0` so the chart renders without gap-handling.
class DailyLoadPoint {
  final String date; // YYYY-MM-DD
  final int loadMinutes;

  const DailyLoadPoint({required this.date, required this.loadMinutes});

  factory DailyLoadPoint.fromJson(Map<String, dynamic> json) {
    return DailyLoadPoint(
      date: json['date'] as String? ?? '',
      loadMinutes: (json['load_minutes'] as num?)?.toInt() ?? 0,
    );
  }
}

class DailyLoad {
  final List<DailyLoadPoint> points;
  /// `(last-14-day avg / prior-14-day avg - 1) × 100`. Null when either
  /// window has zero load (fresh user / inactivity).
  final double? deltaPct;

  const DailyLoad({required this.points, required this.deltaPct});

  factory DailyLoad.fromJson(Map<String, dynamic> json) {
    final raw = json['points'];
    final points = raw is List
        ? raw
            .whereType<Map<String, dynamic>>()
            .map(DailyLoadPoint.fromJson)
            .toList(growable: false)
        : const <DailyLoadPoint>[];
    final delta = json['delta_pct'];
    return DailyLoad(
      points: points,
      deltaPct: delta is num ? delta.toDouble() : null,
    );
  }
}

/// One day of completed-session count from `/api/home/daily-counts`.
/// Window is always 14 contiguous days (oldest → newest).
class DailyCount {
  final String date;
  final int sessions;

  const DailyCount({required this.date, required this.sessions});

  factory DailyCount.fromJson(Map<String, dynamic> json) {
    return DailyCount(
      date: json['date'] as String? ?? '',
      sessions: (json['sessions'] as num?)?.toInt() ?? 0,
    );
  }
}
