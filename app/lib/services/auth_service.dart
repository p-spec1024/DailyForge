import '../config/api_config.dart';
import 'api_service.dart';
import 'storage_service.dart';

class AuthService {
  final ApiService _api;
  final StorageService _storage;

  AuthService(this._api, this._storage);

  /// POST /api/auth/login
  /// Body: { email, password }
  /// Response: { user: { id, email, name }, token }
  Future<Map<String, dynamic>> login(String email, String password) async {
    final response = await _api.post(
      ApiConfig.login,
      {'email': email, 'password': password},
      withAuth: false,
    );

    final token = response['token'] as String;
    final user = response['user'] as Map<String, dynamic>;

    await _storage.saveToken(token);
    await _storage.saveUser(user);

    return user;
  }

  /// POST /api/auth/register
  /// Body: { email, password, name }
  /// Response: { user: { id, email, name }, token }
  Future<Map<String, dynamic>> register(
    String email,
    String password,
    String name,
  ) async {
    final response = await _api.post(
      ApiConfig.register,
      {'email': email, 'password': password, 'name': name},
      withAuth: false,
    );

    final token = response['token'] as String;
    final user = response['user'] as Map<String, dynamic>;

    await _storage.saveToken(token);
    await _storage.saveUser(user);

    return user;
  }

  Future<void> logout() => _storage.clearAuth();

  Future<bool> isLoggedIn() async {
    final token = await _storage.getToken();
    return token != null;
  }

  Future<Map<String, dynamic>?> getCurrentUser() => _storage.getUser();
}
