import 'api_service.dart';

/// S14-T6 §6.1.1: client for `GET /api/users/me/streaks`.
///
/// Endpoint computes three streaks server-side (daily / focus / weekly) so
/// the summary screen doesn't have to do timezone-sensitive date math.
class StreaksService {
  final ApiService _api;

  StreaksService(this._api);

  /// Fetches the user's current streak metrics. Pass [focusSlug] from the
  /// session that just finished so `focus_streak` populates with the right
  /// per-focus count.
  ///
  /// Throws via [ApiService] on network/auth failure — caller (summary
  /// page) should fall back to a "Streaks unavailable" empty state.
  Future<StreaksSnapshot> fetch({String? focusSlug}) async {
    final qp = focusSlug != null && focusSlug.isNotEmpty
        ? '?focus_slug=${Uri.encodeQueryComponent(focusSlug)}'
        : '';
    final body = await _api.get('/users/me/streaks$qp');
    return StreaksSnapshot.fromJson(body);
  }
}

class StreaksSnapshot {
  final int dailyStreakDays;
  final FocusStreak focusStreak;
  final int weeklyCount;

  const StreaksSnapshot({
    required this.dailyStreakDays,
    required this.focusStreak,
    required this.weeklyCount,
  });

  factory StreaksSnapshot.fromJson(Map<String, dynamic> json) {
    return StreaksSnapshot(
      dailyStreakDays: (json['daily_streak_days'] as num?)?.toInt() ?? 0,
      focusStreak: FocusStreak.fromJson(
        (json['focus_streak'] as Map<String, dynamic>?) ?? const {},
      ),
      weeklyCount: (json['weekly_count'] as num?)?.toInt() ?? 0,
    );
  }
}

class FocusStreak {
  /// The focus the just-finished session targeted. Null when the caller
  /// didn't pass `focus_slug` (e.g. summary page is rendering before the
  /// focus is known).
  final String? focusSlug;
  final int countThisWeek;
  final bool isFirst;

  const FocusStreak({
    required this.focusSlug,
    required this.countThisWeek,
    required this.isFirst,
  });

  factory FocusStreak.fromJson(Map<String, dynamic> json) {
    return FocusStreak(
      focusSlug: json['focus_slug'] as String?,
      countThisWeek: (json['count_this_week'] as num?)?.toInt() ?? 0,
      isFirst: json['is_first'] as bool? ?? false,
    );
  }
}
