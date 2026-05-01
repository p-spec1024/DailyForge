import 'package:flutter/foundation.dart';

import '../models/suggested_session.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';
import '../services/suggest_service.dart';

const String _kPrefLastFocusSlug = 'last_viewed_focus_slug';
const String _kPrefLastTimeBudgetMin = 'last_time_budget_min';
const String _defaultFocusSlug = 'full_body';
const int _defaultTimeBudgetMin = 30;
const String _entryPointHome = 'home';

/// Holds the home-page suggested-session state and the user's last-viewed
/// focus / time-budget preferences. T4 will drive this provider.
///
/// Does NOT auto-fire `/suggest` from the constructor — T4 calls
/// `selectBodyFocus` / `selectStateFocus` explicitly when ready.
///
/// **Initialization order (caller responsibility, T4):**
/// `await provider.hydrate()` once on first home-page mount BEFORE reading
/// `currentFocusSlug` or calling `selectBodyFocus`. Without that await,
/// `currentFocusSlug` returns the default ('full_body') instead of the
/// previously persisted slug, and the first suggest call fires for the
/// wrong focus.
///
/// **Race handling:** if the caller fires `selectBodyFocus('A')` then
/// quickly `selectBodyFocus('B')` before A's response arrives, A's late
/// response is dropped — the provider tracks `_currentFocusSlug` and ignores
/// any in-flight result whose request slug no longer matches.
class SuggestProvider extends ChangeNotifier {
  final SuggestService _service;
  final StorageService _storage;

  SuggestProvider(ApiService api, StorageService storage)
      : _service = SuggestService(api),
        _storage = storage;

  String _currentFocusSlug = _defaultFocusSlug;
  SuggestedSession? _currentSession;
  bool _isLoading = false;
  SuggestServiceException? _lastError;

  String get currentFocusSlug => _currentFocusSlug;
  SuggestedSession? get currentSession => _currentSession;
  bool get isLoading => _isLoading;
  SuggestServiceException? get lastError => _lastError;

  /// Read persisted focus/budget so cold-start can resume from there.
  /// MUST be awaited on first home-page mount before the first
  /// `selectBodyFocus` call — see class doc-comment.
  Future<void> hydrate() async {
    final storedSlug = await _storage.getPreference(_kPrefLastFocusSlug);
    if (storedSlug is String && storedSlug.isNotEmpty) {
      _currentFocusSlug = storedSlug;
    }
    notifyListeners();
  }

  /// Last persisted time-budget, or 30 if none. T3 doesn't expose UI to
  /// change this — Sprint 14 will. Exposed here so T4 can pass it into
  /// `selectBodyFocus`.
  Future<int> getPersistedTimeBudgetMin() async {
    final stored = await _storage.getPreference(_kPrefLastTimeBudgetMin);
    if (stored is int && stored > 0) return stored;
    return _defaultTimeBudgetMin;
  }

  Future<void> selectBodyFocus(
    String focusSlug, {
    int? timeBudgetMin,
  }) async {
    final budget = timeBudgetMin ?? await getPersistedTimeBudgetMin();
    await _runRequest(
      focusSlug: focusSlug,
      request: () => _service.requestBodyFocusSession(
        focusSlug: focusSlug,
        timeBudgetMin: budget,
        entryPoint: _entryPointHome,
      ),
      persistAfterSuccess: () =>
          _storage.setPreference(_kPrefLastTimeBudgetMin, budget),
    );
  }

  Future<void> selectStateFocus(String focusSlug, String bracket) async {
    await _runRequest(
      focusSlug: focusSlug,
      request: () => _service.requestStateFocusSession(
        focusSlug: focusSlug,
        bracket: bracket,
        entryPoint: _entryPointHome,
      ),
    );
  }

  Future<void> _runRequest({
    required String focusSlug,
    required Future<SuggestedSession> Function() request,
    Future<void> Function()? persistAfterSuccess,
  }) async {
    _currentFocusSlug = focusSlug;
    _isLoading = true;
    _lastError = null;
    notifyListeners();

    try {
      final result = await request();
      if (_currentFocusSlug != focusSlug) {
        // Newer selectBodyFocus / selectStateFocus call superseded this one.
        // Drop the stale response untouched — the in-flight newer request
        // will fill state in.
        return;
      }
      _currentSession = result;
      // Persistence is best-effort; don't fail the suggest call on disk error.
      try {
        await _storage.setPreference(_kPrefLastFocusSlug, focusSlug);
        if (persistAfterSuccess != null) await persistAfterSuccess();
      } catch (e) {
        debugPrint('[SuggestProvider] persist failed (non-fatal): $e');
      }
    } on UnauthorizedException {
      // ApiService.onUnauthorized has already triggered logout; AuthProvider's
      // listener will drive the UI transition. Nothing for this provider to do.
    } on SuggestServiceException catch (e) {
      if (_currentFocusSlug != focusSlug) return;
      _lastError = e;
      _currentSession = null;
      debugPrint('[SuggestProvider] suggest error: ${e.code}');
    } finally {
      if (_currentFocusSlug == focusSlug) {
        _isLoading = false;
        notifyListeners();
      }
    }
  }

  void clearError() {
    if (_lastError == null) return;
    _lastError = null;
    notifyListeners();
  }

  /// Reset on logout so the next user doesn't see prior state.
  /// Also purges per-user persistence so the next account that signs in
  /// on the same device doesn't inherit this user's last focus / budget.
  Future<void> clear() async {
    _currentSession = null;
    _lastError = null;
    _isLoading = false;
    _currentFocusSlug = _defaultFocusSlug;
    notifyListeners();
    await _storage.removePreference(_kPrefLastFocusSlug);
    await _storage.removePreference(_kPrefLastTimeBudgetMin);
  }
}
