// Home-page stats + weekly activity models (S10-T5c-b).
// Decoded from `/api/home/stats` and `/api/home/weekly-activity`.

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
