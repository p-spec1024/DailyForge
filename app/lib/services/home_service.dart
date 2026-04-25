import '../models/home.dart';
import 'api_service.dart';

/// HTTP client for the `/api/home/*` endpoints (S10-T5c-b).
/// Two endpoints, both GET, both auth-required:
///   GET /home/stats            → HomeStats
///   GET /home/weekly-activity  → List<WeeklyActivity>
class HomeService {
  final ApiService _api;

  HomeService(this._api);

  Future<HomeStats> fetchStats() async {
    final raw = await _api.get('/home/stats');
    return HomeStats.fromJson(raw);
  }

  Future<List<WeeklyActivity>> fetchWeeklyActivity() async {
    final raw = await _api.get('/home/weekly-activity');
    final weeks = raw['weeks'];
    if (weeks is! List) return const [];
    return weeks
        .whereType<Map<String, dynamic>>()
        .map(WeeklyActivity.fromJson)
        .toList(growable: false);
  }
}
