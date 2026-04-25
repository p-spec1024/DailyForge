import 'package:flutter/foundation.dart';
import '../services/api_service.dart';

class ProfileProvider with ChangeNotifier {
  final ApiService _api;

  Map<String, dynamic>? _profile;
  bool _isLoading = false;
  String? _error;

  ProfileProvider(this._api);

  Map<String, dynamic>? get profile => _profile;
  bool get isLoading => _isLoading;
  String? get error => _error;

  String get unitSystem => _profile?['unit_system'] ?? 'metric';
  double? get heightCm {
    final v = _profile?['height_cm'];
    if (v == null) return null;
    if (v is num) return v.toDouble();
    if (v is String) return double.tryParse(v);
    return null;
  }
  String get userName => _profile?['name'] ?? '';
  String get userEmail => _profile?['email'] ?? '';

  Future<void> fetchProfile({bool force = false}) async {
    if (_isLoading) return;
    if (_profile != null && !force) return;
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _api.get('/users/profile');
      _profile = response;
      _error = null;
    } catch (e) {
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> updateUnitSystem(String unitSystem) async {
    try {
      final response = await _api.put('/users/profile', {
        'unit_system': unitSystem,
      });
      _profile = response;
      notifyListeners();
      return true;
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<bool> updateHeight(double heightCm) async {
    try {
      final response = await _api.put('/users/profile', {
        'height_cm': heightCm,
      });
      _profile = response;
      notifyListeners();
      return true;
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      return false;
    }
  }

  void clear() {
    _profile = null;
    _error = null;
    notifyListeners();
  }
}
