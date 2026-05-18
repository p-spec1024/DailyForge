import 'package:flutter/foundation.dart';
import 'package:sentry_flutter/sentry_flutter.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';

class AuthProvider extends ChangeNotifier {
  final AuthService _authService;
  final ApiService _apiService;

  bool _isAuthenticated = false;
  bool _isLoading = true;
  Map<String, dynamic>? _user;
  String? _error;

  bool get isAuthenticated => _isAuthenticated;
  bool get isLoading => _isLoading;
  Map<String, dynamic>? get user => _user;
  String? get error => _error;

  AuthProvider(this._authService, this._apiService) {
    // Wire up 401 handling — if any API call gets a 401, trigger logout.
    _apiService.onUnauthorized = _handleUnauthorized;
  }

  /// Check stored token on app start.
  Future<void> initialize() async {
    final loggedIn = await _authService.isLoggedIn();
    if (loggedIn) {
      _isAuthenticated = true;
      _user = await _authService.getCurrentUser();
      if (_user != null) {
        _setSentryUser(_user!['id'].toString());
      }
    }
    _isLoading = false;
    notifyListeners();
  }

  Future<bool> login(String email, String password) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      _user = await _authService.login(email, password);
      _isAuthenticated = true;
      _setSentryUser(_user!['id'].toString());
      _isLoading = false;
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      _error = e.message;
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> register(String email, String password, String name) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      _user = await _authService.register(email, password, name);
      _isAuthenticated = true;
      _setSentryUser(_user!['id'].toString());
      _isLoading = false;
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      _error = e.message;
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<void> logout() async {
    await _authService.logout();
    _isAuthenticated = false;
    _user = null;
    _error = null;
    _clearSentryUser();
    notifyListeners();
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }

  void _handleUnauthorized() {
    _isAuthenticated = false;
    _user = null;
    _clearSentryUser();
    notifyListeners();
  }

  // S15-T2: Sentry user-context helpers. Scope mutation is synchronous;
  // the returned FutureOr resolves immediately. PII-minimal — only `id`
  // is set, never email/username/IP.
  void _setSentryUser(String id) {
    Sentry.configureScope((scope) {
      scope.setUser(SentryUser(id: id));
    });
  }

  void _clearSentryUser() {
    Sentry.configureScope((scope) {
      scope.setUser(null);
    });
  }
}
