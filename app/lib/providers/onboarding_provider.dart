import 'package:flutter/foundation.dart';
import '../services/api_service.dart';
import '../services/onboarding_service.dart';

/// Holds the three selected pillar levels in memory across the
/// onboarding-stub screens. State is non-persistent — if the user
/// force-quits mid-flow they restart from the strength screen
/// (matches Decision 5 in the S13-T1 spec). Per-pillar setters only
/// notifyListeners() when the value changes, so back-navigation
/// re-renders the previously-picked chip without a flicker.
class OnboardingProvider extends ChangeNotifier {
  final OnboardingService _service;

  String? _strengthLevel;
  String? _yogaLevel;
  String? _breathworkLevel;
  bool _isSubmitting = false;
  String? _error;

  OnboardingProvider(this._service);

  String? get strengthLevel => _strengthLevel;
  String? get yogaLevel => _yogaLevel;
  String? get breathworkLevel => _breathworkLevel;
  bool get isSubmitting => _isSubmitting;
  String? get error => _error;

  void setStrengthLevel(String level) {
    if (_strengthLevel == level) return;
    _strengthLevel = level;
    notifyListeners();
  }

  void setYogaLevel(String level) {
    if (_yogaLevel == level) return;
    _yogaLevel = level;
    notifyListeners();
  }

  void setBreathworkLevel(String level) {
    if (_breathworkLevel == level) return;
    _breathworkLevel = level;
    notifyListeners();
  }

  void clearError() {
    if (_error == null) return;
    _error = null;
    notifyListeners();
  }

  /// Wipes selections + error + submitting flag. Called after a successful
  /// submit so a logout/login cycle starts fresh, and from main.dart's
  /// auth-change listener.
  void reset() {
    _strengthLevel = null;
    _yogaLevel = null;
    _breathworkLevel = null;
    _error = null;
    _isSubmitting = false;
    notifyListeners();
  }

  /// POSTs all three levels in one transactional request. Returns true on
  /// success; on failure returns false and sets [error] to a user-facing
  /// message (caller renders a snackbar with retry — the breathwork page).
  Future<bool> submit() async {
    // Guard against a second tap landing before notifyListeners() repaints
    // the disabled button (rare but reproducible on slow Android devices).
    if (_isSubmitting) return false;

    if (_strengthLevel == null ||
        _yogaLevel == null ||
        _breathworkLevel == null) {
      _error = 'Please pick a level for all three pillars before continuing.';
      notifyListeners();
      return false;
    }

    _isSubmitting = true;
    _error = null;
    notifyListeners();

    try {
      await _service.submitLevels(
        strength: _strengthLevel!,
        yoga: _yogaLevel!,
        breathwork: _breathworkLevel!,
      );
      _isSubmitting = false;
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      _error = e.message;
      _isSubmitting = false;
      notifyListeners();
      return false;
    }
  }
}
