import 'package:flutter/foundation.dart';

import '../models/focus_area.dart';
import '../models/home.dart';
import '../services/api_service.dart';
import '../services/focus_areas_service.dart';
import '../services/home_service.dart';
import '../services/onboarding_service.dart';

/// Backs the home page (S13-T4 redesign + earlier S10-T5c-b stats).
///
/// Errors are tracked per-slice so a single endpoint failure doesn't blank
/// the whole page. All slices fan out in parallel from [load] / [refresh].
///
/// **Fresh-user gate:** if `/api/users/me/pillar-levels` returns an empty
/// list, [isFreshUser] is true and the home page redirects to onboarding.
/// We keep the levels in state (instead of just the boolean) so future
/// surfaces can read individual pillar levels without re-fetching.
class HomeProvider extends ChangeNotifier {
  final HomeService _service;
  final FocusAreasService _focusAreasService;
  final OnboardingService _onboardingService;

  // Sprint 10 stats
  HomeStats? _stats;
  List<WeeklyActivity>? _weeks;
  String? _statsError;
  String? _weeksError;

  // Sprint 13 home-page additions
  List<FocusArea>? _focusAreas;
  DailyLoad? _dailyLoad;
  List<DailyCount>? _dailyCounts;
  List<Map<String, dynamic>>? _pillarLevels;
  String? _focusAreasError;
  String? _dailyLoadError;
  String? _dailyCountsError;
  String? _pillarLevelsError;

  bool _loading = false;

  HomeProvider(ApiService api)
      : _service = HomeService(api),
        _focusAreasService = FocusAreasService(api),
        _onboardingService = OnboardingService(api);

  // Sprint 10 surface
  HomeStats? get stats => _stats;
  List<WeeklyActivity>? get weeks => _weeks;
  String? get statsError => _statsError;
  String? get weeksError => _weeksError;

  // Sprint 13 surface
  List<FocusArea>? get focusAreas => _focusAreas;
  DailyLoad? get dailyLoad => _dailyLoad;
  List<DailyCount>? get dailyCounts => _dailyCounts;
  List<Map<String, dynamic>>? get pillarLevels => _pillarLevels;
  String? get focusAreasError => _focusAreasError;
  String? get dailyLoadError => _dailyLoadError;
  String? get dailyCountsError => _dailyCountsError;
  String? get pillarLevelsError => _pillarLevelsError;

  bool get loading => _loading;

  PillarDurations get pillarDurations =>
      _stats?.pillarDurations ?? PillarDurations.fallback;

  bool get hasNoData => _stats == null && _weeks == null;

  /// True iff `/me/pillar-levels` resolved to an empty list. We deliberately
  /// don't return true while the request is in-flight or after a failure —
  /// callers redirect on a positive signal only, never on absence of data.
  bool get isFreshUser =>
      _pillarLevels != null && _pillarLevels!.isEmpty;

  /// Sessions completed in the current calendar week. Derived from the last
  /// bucket of `/home/weekly-activity` (which is the current Mon-Sun window).
  /// Returns 0 if weekly data isn't loaded yet or has no buckets.
  int get sessionsThisWeek {
    final weeks = _weeks;
    if (weeks == null || weeks.isEmpty) return 0;
    return weeks.last.total;
  }

  /// 0-100 scaled progress toward the weekly session goal (default 5).
  /// Capped at 100 so an extra-active week doesn't break the progress ring.
  int get weeklyProgressPercent {
    const goal = 5;
    final pct = (sessionsThisWeek * 100) ~/ goal;
    return pct > 100 ? 100 : pct;
  }

  Future<void> load() => _fetchAll();
  Future<void> refresh() => _fetchAll();

  Future<void> _fetchAll() async {
    _loading = true;
    notifyListeners();
    await Future.wait([
      _fetchStats(),
      _fetchWeeks(),
      _fetchFocusAreas(),
      _fetchDailyLoad(),
      _fetchDailyCounts(),
      _fetchPillarLevels(),
    ]);
    _loading = false;
    notifyListeners();
  }

  Future<void> _fetchStats() async {
    try {
      _stats = await _service.fetchStats();
      _statsError = null;
    } on ApiException catch (e) {
      _statsError = e.message;
      debugPrint('[HomeProvider] stats error: $e');
    }
  }

  Future<void> _fetchWeeks() async {
    try {
      _weeks = await _service.fetchWeeklyActivity();
      _weeksError = null;
    } on ApiException catch (e) {
      _weeksError = e.message;
      debugPrint('[HomeProvider] weekly-activity error: $e');
    }
  }

  Future<void> _fetchFocusAreas() async {
    try {
      _focusAreas = await _focusAreasService.fetch();
      _focusAreasError = null;
    } on ApiException catch (e) {
      _focusAreasError = e.message;
      debugPrint('[HomeProvider] focus-areas error: $e');
    }
  }

  Future<void> _fetchDailyLoad() async {
    try {
      _dailyLoad = await _service.fetchDailyLoad();
      _dailyLoadError = null;
    } on ApiException catch (e) {
      _dailyLoadError = e.message;
      debugPrint('[HomeProvider] daily-load error: $e');
    }
  }

  Future<void> _fetchDailyCounts() async {
    try {
      _dailyCounts = await _service.fetchDailyCounts();
      _dailyCountsError = null;
    } on ApiException catch (e) {
      _dailyCountsError = e.message;
      debugPrint('[HomeProvider] daily-counts error: $e');
    }
  }

  Future<void> _fetchPillarLevels() async {
    try {
      _pillarLevels = await _onboardingService.fetchLevels();
      _pillarLevelsError = null;
    } on ApiException catch (e) {
      _pillarLevelsError = e.message;
      debugPrint('[HomeProvider] pillar-levels error: $e');
    }
  }

  void clear() {
    _stats = null;
    _weeks = null;
    _focusAreas = null;
    _dailyLoad = null;
    _dailyCounts = null;
    _pillarLevels = null;
    _statsError = null;
    _weeksError = null;
    _focusAreasError = null;
    _dailyLoadError = null;
    _dailyCountsError = null;
    _pillarLevelsError = null;
    notifyListeners();
  }
}
