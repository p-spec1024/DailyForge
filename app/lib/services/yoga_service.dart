import '../models/yoga_models.dart';
import 'api_service.dart';

class YogaService {
  final ApiService _api;

  YogaService(this._api);

  Future<YogaSession> generateSession({
    required String type,
    required String level,
    required int duration,
    List<String> focus = const [],
  }) async {
    final params = <String, String>{
      'type': type,
      'level': level,
      'duration': duration.toString(),
    };
    if (focus.isNotEmpty) {
      params['focus'] = focus.join(',');
    }
    final qs = Uri(queryParameters: params).query;
    final raw = await _api.get('/yoga/generate?$qs');
    final session = raw['session'] as Map<String, dynamic>?;
    if (session == null) throw ApiException(500, 'No session data returned');
    return YogaSession.fromJson(session);
  }

  Future<List<RecentYogaSession>> getRecentSessions() async {
    final raw = await _api.get('/yoga/recent');
    final sessions = raw['sessions'] as List?;
    if (sessions == null) return const [];
    return sessions
        .whereType<Map<String, dynamic>>()
        .map(RecentYogaSession.fromJson)
        .toList();
  }
}
