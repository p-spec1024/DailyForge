import '../config/api_config.dart';
import '../models/focus_area.dart';
import 'api_service.dart';

/// HTTP client for `GET /api/focus-areas` (S13-T2 endpoint, S13-T4 consumer).
/// Returns the 17 focus areas the home-page orbit picker renders. Read-only,
/// JWT-authenticated; the list is small enough that callers refetch on each
/// home-page mount rather than caching.
class FocusAreasService {
  final ApiService _api;

  FocusAreasService(this._api);

  Future<List<FocusArea>> fetch() async {
    final raw = await _api.get(ApiConfig.focusAreas);
    final list = raw['focus_areas'];
    if (list is! List) return const [];
    return list
        .whereType<Map<String, dynamic>>()
        .map(FocusArea.fromJson)
        .toList(growable: false);
  }
}
