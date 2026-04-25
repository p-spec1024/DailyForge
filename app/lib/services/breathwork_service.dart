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

  Future<void> logSession({
    required int techniqueId,
    required int durationSeconds,
    required int roundsCompleted,
    required bool completed,
  }) async {
    await _api.post(ApiConfig.breathworkSessions, {
      'technique_id': techniqueId,
      'duration_seconds': durationSeconds,
      'rounds_completed': roundsCompleted,
      'completed': completed,
    });
  }
}
