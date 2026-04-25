import '../data/mock_body_map_data.dart';
import '../models/body_map.dart';
import 'api_service.dart';

/// Spec name: `DEBUG_USE_MOCK_BODY_MAP`. When true, all three fetch methods
/// return the bundled mock data instead of hitting the backend. Default
/// `false`. Flip locally for offline UI work; **verify before commit**.
const bool kUseMockBodyMap = false;

/// HTTP client for the `/api/body-map/*` endpoints (S10-T5b / T5c-b).
/// Three endpoints, all GET, all auth-required:
///   GET /muscle-volumes?range=… → MuscleVolumesResponse { volumes, details }
///   GET /flexibility?range=…    → Map<String, int> (Spine, Hips, Shoulders)
///   GET /recent-wins?limit=…    → List<RecentWin>  (icon/title/subtitle)
class BodyMapService {
  final ApiService _api;

  BodyMapService(this._api);

  Future<MuscleVolumesResponse> fetchMuscleVolumes({
    String range = '30d',
  }) async {
    if (kUseMockBodyMap) {
      return MuscleVolumesResponse(
        volumes: Map<String, int>.from(mockMuscleVolumes),
        details: Map<String, MuscleDetail>.from(mockMuscleDetails),
      );
    }
    final raw = await _api.get('/body-map/muscle-volumes?range=$range');
    return MuscleVolumesResponse.fromJson(raw);
  }

  Future<Map<String, int>> fetchFlexibility({String range = '30d'}) async {
    if (kUseMockBodyMap) {
      return Map<String, int>.from(mockFlexibilityScores);
    }
    final raw = await _api.get('/body-map/flexibility?range=$range');
    return _intMap(raw);
  }

  Future<List<RecentWin>> fetchRecentWins({int limit = 5}) async {
    if (kUseMockBodyMap) {
      return List<RecentWin>.from(mockRecentWins);
    }
    final raw = await _api.getList('/body-map/recent-wins?limit=$limit');
    return raw
        .whereType<Map<String, dynamic>>()
        .map(RecentWin.fromJson)
        .toList(growable: false);
  }

  Map<String, int> _intMap(Map<String, dynamic> raw) {
    return raw.map((k, v) => MapEntry(k, (v as num).toInt()));
  }
}
