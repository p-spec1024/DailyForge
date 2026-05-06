import 'dart:developer' as developer;

import '../config/api_config.dart';
import '../models/suggested_session.dart';
import 'api_service.dart';

/// HTTP client for `POST /api/sessions/suggest` (S12-T7 surface, S13-T3 consumer).
///
/// Two methods, one for each focus shape T7 accepts:
///   - body focus: sends `time_budget_min`
///   - state focus: sends `bracket`
///
/// Both require an explicit `entryPoint` — T7 validates `entry_point` against
/// a 4-value enum and 400s with `invalid_entry_point` if missing or wrong.
/// Forcing the caller to pass it keeps the contract honest as future surfaces
/// (Sprint 14+ strength-tab affordance, etc.) start calling this service.
class SuggestService {
  final ApiService _api;

  SuggestService(this._api);

  Future<SuggestedSession> requestBodyFocusSession({
    required String focusSlug,
    required int timeBudgetMin,
    required String entryPoint,
  }) =>
      _post({
        'focus_slug': focusSlug,
        'entry_point': entryPoint,
        'time_budget_min': timeBudgetMin,
      });

  Future<SuggestedSession> requestStateFocusSession({
    required String focusSlug,
    required String bracket,
    required String entryPoint,
  }) =>
      _post({
        'focus_slug': focusSlug,
        'entry_point': entryPoint,
        'bracket': bracket,
      });

  Future<SuggestedSession> _post(Map<String, dynamic> body) async {
    developer.log('POST ${ApiConfig.sessionsSuggest}', name: 'SuggestService');
    try {
      final raw = await _api.post(ApiConfig.sessionsSuggest, body);
      return SuggestedSession.fromJson(raw);
    } on TimeoutApiException {
      throw NetworkError();
    } on NetworkException catch (e) {
      throw NetworkError(e.message);
    } on UnauthorizedException {
      // Let the existing auth-aware UnauthorizedException propagate so
      // ApiService.onUnauthorized continues to drive the global logout flow.
      rethrow;
    } on ApiException catch (e) {
      throw _mapApiException(e);
    }
  }

  SuggestServiceException _mapApiException(ApiException e) {
    if (e.statusCode >= 500) return EngineError(e.message);
    switch (e.message) {
      case 'invalid_focus_slug':
        return InvalidFocusSlugException();
      case 'unknown_focus_slug':
        return UnknownFocusSlugException();
      case 'invalid_entry_point':
        return InvalidEntryPointException();
      case 'body_focus_requires_time_budget':
        return BodyFocusRequiresTimeBudgetException();
      case 'state_focus_requires_bracket':
        return StateFocusRequiresBracketException();
      case 'invalid_time_budget':
        return InvalidTimeBudgetException();
      case 'invalid_bracket':
        return InvalidBracketException();
      case 'invalid_focus_entry_combo':
        return InvalidFocusEntryComboException();
      default:
        return SuggestServiceException(e.message);
    }
  }
}

/// Base type for all suggest-flow failures. Catch this for a coarse
/// "something went wrong" case; catch specific subclasses for tailored UX.
class SuggestServiceException implements Exception {
  /// The stable error code from T7 (e.g. `invalid_focus_slug`), or a free-form
  /// transport-layer message for `NetworkError` / `EngineError`.
  final String code;

  SuggestServiceException(this.code);

  /// Human-readable copy for surfacing to the user. Subclasses override.
  String get userFacingMessage => 'Something went wrong. Please report.';

  @override
  String toString() => 'SuggestServiceException($code)';
}

// --- Client-bug-class: only fire when the client request is malformed.
// All map to the same generic copy because the user can't recover; only
// distinct types so that observability/logging can differentiate.

class InvalidFocusSlugException extends SuggestServiceException {
  InvalidFocusSlugException() : super('invalid_focus_slug');
}

class UnknownFocusSlugException extends SuggestServiceException {
  UnknownFocusSlugException() : super('unknown_focus_slug');
}

class InvalidEntryPointException extends SuggestServiceException {
  InvalidEntryPointException() : super('invalid_entry_point');
}

class BodyFocusRequiresTimeBudgetException extends SuggestServiceException {
  BodyFocusRequiresTimeBudgetException()
      : super('body_focus_requires_time_budget');
}

class StateFocusRequiresBracketException extends SuggestServiceException {
  StateFocusRequiresBracketException() : super('state_focus_requires_bracket');
}

class InvalidTimeBudgetException extends SuggestServiceException {
  InvalidTimeBudgetException() : super('invalid_time_budget');
}

class InvalidBracketException extends SuggestServiceException {
  InvalidBracketException() : super('invalid_bracket');
}

class InvalidFocusEntryComboException extends SuggestServiceException {
  InvalidFocusEntryComboException() : super('invalid_focus_entry_combo');
}

// --- Server / transport.

class EngineError extends SuggestServiceException {
  EngineError([super.code = 'engine_error']);

  @override
  String get userFacingMessage =>
      "Couldn't generate a session right now. Try again?";
}

class NetworkError extends SuggestServiceException {
  NetworkError([super.code = 'network_error']);

  @override
  String get userFacingMessage => 'Check your connection and try again.';
}
