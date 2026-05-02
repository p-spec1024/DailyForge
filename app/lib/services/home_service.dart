import '../config/api_config.dart';
import '../models/home.dart';
import 'api_service.dart';

/// HTTP client for the `/api/home/*` endpoints. All four endpoints are
/// GET + JWT-authenticated:
///   GET /home/stats            → HomeStats             (S10-T5c-b)
///   GET /home/weekly-activity  → List<WeeklyActivity>  (S10-T5c-b)
///   GET /home/daily-load       → DailyLoad             (S13-T4)
///   GET /home/daily-counts     → List<DailyCount>      (S13-T4)
class HomeService {
  final ApiService _api;

  HomeService(this._api);

  Future<HomeStats> fetchStats() async {
    final raw = await _api.get(ApiConfig.homeStats);
    return HomeStats.fromJson(raw);
  }

  Future<List<WeeklyActivity>> fetchWeeklyActivity() async {
    final raw = await _api.get(ApiConfig.homeWeeklyActivity);
    final weeks = raw['weeks'];
    if (weeks is! List) return const [];
    return weeks
        .whereType<Map<String, dynamic>>()
        .map(WeeklyActivity.fromJson)
        .toList(growable: false);
  }

  Future<DailyLoad> fetchDailyLoad() async {
    final raw = await _api.get(ApiConfig.homeDailyLoad);
    return DailyLoad.fromJson(raw);
  }

  Future<List<DailyCount>> fetchDailyCounts() async {
    final raw = await _api.get(ApiConfig.homeDailyCounts);
    final pts = raw['points'];
    if (pts is! List) return const [];
    return pts
        .whereType<Map<String, dynamic>>()
        .map(DailyCount.fromJson)
        .toList(growable: false);
  }
}
