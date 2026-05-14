import '../models/yoga_models.dart';
import '../models/yoga_pose_details.dart';
import 'api_service.dart';

class YogaService {
  final ApiService _api;

  YogaService(this._api);

  /// S14-T3: hydrate yoga pose details for a list of pose ids. Used by the
  /// engine→player adapter to fill in name/description/etc. that the engine
  /// doesn't carry. Strict-mode: server returns 404 if any id is missing,
  /// which surfaces here as an [ApiException]. Caller must block navigation
  /// on any failure (Q3 lock).
  Future<List<YogaPoseDetails>> fetchPosesByIds(List<int> ids) async {
    final raw = await _api.post('/yoga/poses-by-ids', {'ids': ids});
    final poses = raw['poses'] as List?;
    if (poses == null) {
      throw ApiException(500, 'No poses array in response');
    }
    return poses
        .whereType<Map<String, dynamic>>()
        .map(YogaPoseDetails.fromJson)
        .toList();
  }

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
