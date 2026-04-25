import 'package:flutter/foundation.dart';
import '../config/api_config.dart';
import '../models/user_settings.dart';
import '../services/api_service.dart';

class SettingsProvider extends ChangeNotifier {
  final ApiService _api;

  UserSettings _settings = const UserSettings();
  bool _isLoading = false;
  bool _isSaving = false;
  String? _error;
  bool _loaded = false;

  SettingsProvider(this._api);

  UserSettings get settings => _settings;
  bool get isLoading => _isLoading;
  bool get isSaving => _isSaving;
  String? get error => _error;
  bool get loaded => _loaded;

  /// Clear cached settings — call on logout/auth invalidation so the next
  /// user doesn't see the previous user's cached values.
  void reset() {
    _settings = const UserSettings();
    _loaded = false;
    _error = null;
    _isLoading = false;
    _isSaving = false;
    notifyListeners();
  }

  void clearError() {
    if (_error != null) {
      _error = null;
      notifyListeners();
    }
  }

  Future<void> fetchSettings({bool force = false}) async {
    if (_isLoading) return;
    if (_loaded && !force) return;
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _api.get(ApiConfig.settings);
      _settings = UserSettings.fromJson(response);
      _loaded = true;
    } on ApiException catch (e) {
      _error = e.message;
    } catch (e) {
      _error = 'Failed to load settings';
      debugPrint('Unexpected error fetching settings: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> updateSettings(UserSettings next) async {
    if (_isSaving) return false;
    _isSaving = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _api.put(ApiConfig.settings, next.toJson());
      _settings = UserSettings.fromJson(response);
      _loaded = true;
      return true;
    } on ApiException catch (e) {
      _error = e.message;
      return false;
    } catch (e) {
      _error = 'Failed to save settings';
      debugPrint('Unexpected error updating settings: $e');
      return false;
    } finally {
      _isSaving = false;
      notifyListeners();
    }
  }
}
