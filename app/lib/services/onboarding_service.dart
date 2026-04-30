import '../config/api_config.dart';
import 'api_service.dart';

class OnboardingService {
  final ApiService _api;

  OnboardingService(this._api);

  /// POST /api/users/pillar-levels — upserts all three pillar levels for the
  /// authenticated user in a single transaction. Source is hardcoded to
  /// 'declared' on the server.
  ///
  /// Throws ApiException on failure with a user-facing message (server-side
  /// stable error codes are mapped to plain English here).
  Future<void> submitLevels({
    required String strength,
    required String yoga,
    required String breathwork,
  }) async {
    try {
      await _api.post(ApiConfig.pillarLevels, {
        'strength': strength,
        'yoga': yoga,
        'breathwork': breathwork,
      });
    } on ApiException catch (e) {
      throw ApiException(e.statusCode, _humanizeError(e.message));
    }
  }

  /// GET /api/users/me/pillar-levels — returns the user's declared/inferred
  /// pillar levels. Empty list means "fresh user; onboarding required" — the
  /// home-page gate (S13-T4) consumes this signal to redirect into the flow.
  Future<List<Map<String, dynamic>>> fetchLevels() async {
    final response = await _api.get(ApiConfig.myPillarLevels);
    final levels = response['levels'] as List<dynamic>? ?? const [];
    return levels.cast<Map<String, dynamic>>();
  }

  /// Maps stable server error codes (server/src/routes/users.js) to short
  /// user-facing strings. Unknown codes (and friendly messages from
  /// ApiException subtypes) collapse to a generic fallback so we never
  /// leak raw codes like 'engine_error' into the snackbar.
  String _humanizeError(String code) {
    switch (code) {
      case 'strength_level_required':
        return 'Please pick a strength level before continuing.';
      case 'yoga_level_required':
        return 'Please pick a yoga level before continuing.';
      case 'breathwork_level_required':
        return 'Please pick a breathwork level before continuing.';
      case 'invalid_strength_level':
      case 'invalid_yoga_level':
      case 'invalid_breathwork_level':
        return "That level isn't valid. Pick beginner, intermediate, or advanced.";
      default:
        return 'Something went wrong. Please try again.';
    }
  }
}
