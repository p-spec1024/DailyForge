import 'dart:developer' as developer;

import '../config/api_config.dart';
import '../models/available_durations.dart';
import 'api_service.dart';

/// HTTP client for the S13-T5 picker-support endpoints under
/// /api/focus-areas/:slug/... — the bracket grid (state focuses) and the
/// last-used default (both focus types).
///
/// Pattern-matches `SuggestService`: all transport through `ApiService`
/// (auth + timeout + 401-logout inherited), `ApiException` mapped to the
/// stable error codes the route layer emits.
class FocusDurationService {
  final ApiService _api;

  FocusDurationService(this._api);

  Future<AvailableDurations> fetchAvailableDurations(String focusSlug) async {
    final path = ApiConfig.focusAreaAvailableDurations(focusSlug);
    developer.log('GET $path', name: 'FocusDurationService');
    try {
      final raw = await _api.get(path);
      return AvailableDurations.fromJson(raw);
    } on TimeoutApiException {
      throw FocusDurationServiceException.timeout();
    } on NetworkException catch (e) {
      throw FocusDurationServiceException.network(e.message);
    } on UnauthorizedException {
      // ApiService.onUnauthorized has already triggered the global logout
      // flow. Let the unauthorized exception propagate so AuthProvider's
      // listener handles the UI transition.
      rethrow;
    } on ApiException catch (e) {
      throw _mapApiException(e);
    }
  }

  Future<SuggestedDefault> fetchSuggestedDefault(String focusSlug) async {
    final path = ApiConfig.focusAreaSuggestedDefault(focusSlug);
    developer.log('GET $path', name: 'FocusDurationService');
    try {
      final raw = await _api.get(path);
      return SuggestedDefault.fromJson(raw);
    } on TimeoutApiException {
      throw FocusDurationServiceException.timeout();
    } on NetworkException catch (e) {
      throw FocusDurationServiceException.network(e.message);
    } on UnauthorizedException {
      rethrow;
    } on ApiException catch (e) {
      throw _mapApiException(e);
    }
  }

  FocusDurationServiceException _mapApiException(ApiException e) {
    if (e.statusCode >= 500) {
      return FocusDurationServiceException(
          code: 'engine_error', message: e.message);
    }
    // Stable error codes from server/src/routes/focus-areas.js (S13-T5).
    switch (e.message) {
      case 'unknown_focus_slug':
      case 'invalid_focus_type_for_durations':
      case 'breathwork_level_not_set':
      case 'engine_error':
        return FocusDurationServiceException(code: e.message, message: e.message);
      default:
        return FocusDurationServiceException(code: null, message: e.message);
    }
  }
}

class FocusDurationServiceException implements Exception {
  /// Stable error code from the route layer, or null for transport-layer
  /// failures (network, parse). Surface-level UI uses this to pick copy.
  final String? code;
  final String message;

  const FocusDurationServiceException({required this.code, required this.message});

  factory FocusDurationServiceException.network([String? message]) =>
      FocusDurationServiceException(
        code: 'network_error',
        message: message ?? 'Check your connection and try again.',
      );

  factory FocusDurationServiceException.timeout([String? message]) =>
      FocusDurationServiceException(
        code: 'timeout_error',
        message: message ?? 'DailyForge took too long to respond. Please try again.',
      );

  String get userFacingMessage {
    switch (code) {
      case 'breathwork_level_not_set':
        return 'Set up your breathwork level to see duration options.';
      case 'invalid_focus_type_for_durations':
        return 'This focus does not have a bracket picker.';
      case 'unknown_focus_slug':
        return "Couldn't find that focus area.";
      case 'network_error':
        return 'Check your connection and try again.';
      case 'timeout_error':
        return 'DailyForge took too long to respond. Please try again.';
      default:
        return "Couldn't load duration options.";
    }
  }

  @override
  String toString() =>
      'FocusDurationServiceException(${code ?? "?"}): $message';
}
