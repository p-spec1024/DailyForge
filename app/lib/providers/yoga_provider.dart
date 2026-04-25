import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/yoga_models.dart';
import '../services/api_service.dart';
import '../services/yoga_service.dart';

const _kConfigKey = 'yoga_config';

class YogaProvider extends ChangeNotifier {
  final YogaService _service;

  YogaConfig _config = YogaConfig.defaults;
  List<RecentYogaSession> _recentSessions = [];
  YogaSession? _generatedSession;
  bool _isGenerating = false;
  bool _isLoadingRecent = false;
  String? _error;

  YogaProvider(ApiService api) : _service = YogaService(api);

  YogaConfig get config => _config;
  List<RecentYogaSession> get recentSessions => _recentSessions;
  YogaSession? get generatedSession => _generatedSession;
  bool get isGenerating => _isGenerating;
  bool get isLoadingRecent => _isLoadingRecent;
  String? get error => _error;

  // --- Config setters ---

  void setType(String type) {
    _config = _config.copyWith(type: type);
    _saveConfig();
    notifyListeners();
  }

  void setLevel(String level) {
    _config = _config.copyWith(level: level);
    _saveConfig();
    notifyListeners();
  }

  void setDuration(int duration) {
    _config = _config.copyWith(duration: duration);
    _saveConfig();
    notifyListeners();
  }

  void toggleFocus(String area) {
    final current = List<String>.from(_config.focus);
    if (current.contains(area)) {
      current.remove(area);
    } else {
      current.add(area);
    }
    _config = _config.copyWith(focus: current);
    _saveConfig();
    notifyListeners();
  }

  // --- Persistence ---

  Future<void> loadConfig() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_kConfigKey);
      if (raw != null) {
        final json = jsonDecode(raw) as Map<String, dynamic>;
        _config = YogaConfig.fromJson(json);
        notifyListeners();
      }
    } catch (e) {
      debugPrint('[YogaProvider] loadConfig error: $e');
    }
  }

  Future<void> _saveConfig() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_kConfigKey, jsonEncode(_config.toJson()));
    } catch (e) {
      debugPrint('[YogaProvider] saveConfig error: $e');
    }
  }

  // --- API calls ---

  Future<void> loadRecentSessions() async {
    _isLoadingRecent = true;
    notifyListeners();
    try {
      _recentSessions = await _service.getRecentSessions();
    } on ApiException catch (e) {
      debugPrint('[YogaProvider] loadRecent error: $e');
    } finally {
      _isLoadingRecent = false;
      notifyListeners();
    }
  }

  Future<void> generateSession() async {
    if (_isGenerating) return;
    _isGenerating = true;
    _error = null;
    notifyListeners();
    try {
      _generatedSession = await _service.generateSession(
        type: _config.type,
        level: _config.level,
        duration: _config.duration,
        focus: _config.focus,
      );
    } on ApiException catch (e) {
      _error = e.message;
    } finally {
      _isGenerating = false;
      notifyListeners();
    }
  }

  void clearSession() {
    _generatedSession = null;
    notifyListeners();
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }

  void loadFromRecent(RecentYogaSession session) {
    _config = YogaConfig(
      type: session.type,
      level: session.level,
      duration: session.duration,
      focus: session.focus,
    );
    _saveConfig();
    notifyListeners();
  }
}
