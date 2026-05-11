import '../config/api_config.dart';
import '../models/breathwork_technique.dart';
import 'api_service.dart';

class BreathworkService {
  final ApiService _api;

  BreathworkService(this._api);

  Future<List<BreathworkTechnique>> getTechniques({String? category}) async {
    final qs = (category != null && category.isNotEmpty && category != 'all')
        ? '?category=$category'
        : '';
    final raw = await _api.getList('${ApiConfig.breathworkTechniques}$qs');
    return raw
        .whereType<Map<String, dynamic>>()
        .map(BreathworkTechnique.fromJson)
        .toList();
  }

  Future<BreathworkTechnique> getTechnique(int id) async {
    final raw = await _api.get('${ApiConfig.breathworkTechniques}/$id');
    return BreathworkTechnique.fromJson(raw);
  }

  /// Returns the server-side `breathwork_sessions.id` on success so callers
  /// (S14-T4 embedded mode) can FK it on `cross_pillar_sessions`. null on
  /// any transport failure or malformed response.
  Future<int?> logSession({
    required int techniqueId,
    required int durationSeconds,
    required int roundsCompleted,
    required bool completed,
    String? focusSlug,
  }) async {
    final body = <String, dynamic>{
      'technique_id': techniqueId,
      'duration_seconds': durationSeconds,
      'rounds_completed': roundsCompleted,
      'completed': completed,
    };
    if (focusSlug != null && focusSlug.isNotEmpty) {
      body['focus_slug'] = focusSlug;
    }
    final response = await _api.post(ApiConfig.breathworkSessions, body);
    final id = response['id'];
    if (id is int) return id;
    if (id is num) return id.toInt();
    return null;
  }
}
