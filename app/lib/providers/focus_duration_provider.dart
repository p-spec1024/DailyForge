import 'package:flutter/foundation.dart';

import '../models/available_durations.dart';
import '../services/api_service.dart';
import '../services/focus_duration_service.dart';

/// Backs the S13-T5 half-pie picker sheet (AMENDMENT-1 unified the previous
/// BracketPickerSheet and DurationSliderSheet into a single widget). Holds
/// the most recent available-durations result and the most recent
/// suggested-default result, each scoped to a slug so stale responses can
/// be dropped.
///
/// **Race handling:** if a sheet opens for focus A then quickly switches
/// to focus B before A's response arrives, A's late response is dropped —
/// the provider tracks `_lastAvailableSlug` / `_lastDefaultSlug` and ignores
/// any in-flight result whose request slug no longer matches.
class FocusDurationProvider extends ChangeNotifier {
  final FocusDurationService _service;

  FocusDurationProvider(ApiService api)
      : _service = FocusDurationService(api);

  // ── available-durations state ────────────────────────────────────────
  String? _lastAvailableSlug;
  AvailableDurations? _availableDurations;
  bool _availableLoading = false;
  FocusDurationServiceException? _availableError;

  AvailableDurations? get availableDurations => _availableDurations;
  bool get isAvailableLoading => _availableLoading;
  FocusDurationServiceException? get availableError => _availableError;

  // ── suggested-default state ──────────────────────────────────────────
  String? _lastDefaultSlug;
  SuggestedDefault? _suggestedDefault;
  bool _defaultLoading = false;
  FocusDurationServiceException? _defaultError;

  SuggestedDefault? get suggestedDefault => _suggestedDefault;
  bool get isSuggestedDefaultLoading => _defaultLoading;
  FocusDurationServiceException? get suggestedDefaultError => _defaultError;

  Future<void> fetchAvailableDurations(String focusSlug) async {
    _lastAvailableSlug = focusSlug;
    _availableLoading = true;
    _availableError = null;
    _availableDurations = null;
    notifyListeners();

    try {
      final result = await _service.fetchAvailableDurations(focusSlug);
      if (_lastAvailableSlug != focusSlug) return; // superseded
      _availableDurations = result;
    } on UnauthorizedException {
      // Global logout flow already triggered by ApiService.
    } on FocusDurationServiceException catch (e) {
      if (_lastAvailableSlug != focusSlug) return;
      _availableError = e;
      _availableDurations = null;
      debugPrint('[FocusDurationProvider] available-durations error: ${e.code}');
    } catch (e, st) {
      if (_lastAvailableSlug != focusSlug) return;
      _availableError = FocusDurationServiceException(
        code: 'parse_error',
        message: e.toString(),
      );
      debugPrint('[FocusDurationProvider] available-durations parse error: $e\n$st');
    } finally {
      if (_lastAvailableSlug == focusSlug) {
        _availableLoading = false;
        notifyListeners();
      }
    }
  }

  Future<void> fetchSuggestedDefault(String focusSlug) async {
    _lastDefaultSlug = focusSlug;
    _defaultLoading = true;
    _defaultError = null;
    _suggestedDefault = null;
    notifyListeners();

    try {
      final result = await _service.fetchSuggestedDefault(focusSlug);
      if (_lastDefaultSlug != focusSlug) return;
      _suggestedDefault = result;
    } on UnauthorizedException {
      // Global logout flow already triggered.
    } on FocusDurationServiceException catch (e) {
      if (_lastDefaultSlug != focusSlug) return;
      _defaultError = e;
      _suggestedDefault = null;
      debugPrint('[FocusDurationProvider] suggested-default error: ${e.code}');
    } catch (e, st) {
      if (_lastDefaultSlug != focusSlug) return;
      _defaultError = FocusDurationServiceException(
        code: 'parse_error',
        message: e.toString(),
      );
      debugPrint('[FocusDurationProvider] suggested-default parse error: $e\n$st');
    } finally {
      if (_lastDefaultSlug == focusSlug) {
        _defaultLoading = false;
        notifyListeners();
      }
    }
  }

  /// Reset on logout so the next user doesn't see prior state. No persistent
  /// storage to clear — picker results live only in memory.
  void clear() {
    _lastAvailableSlug = null;
    _availableDurations = null;
    _availableLoading = false;
    _availableError = null;
    _lastDefaultSlug = null;
    _suggestedDefault = null;
    _defaultLoading = false;
    _defaultError = null;
    notifyListeners();
  }
}
