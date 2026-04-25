import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

class StorageService {
  static const _tokenKey = 'auth_token';
  static const _userKey = 'user_data';

  final FlutterSecureStorage _secure;

  StorageService({FlutterSecureStorage? secure})
      : _secure = secure ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(encryptedSharedPreferences: true),
            );

  // JWT Token (secure)
  Future<void> saveToken(String token) =>
      _secure.write(key: _tokenKey, value: token);

  Future<String?> getToken() => _secure.read(key: _tokenKey);

  Future<void> deleteToken() => _secure.delete(key: _tokenKey);

  // User data (secure)
  Future<void> saveUser(Map<String, dynamic> userData) =>
      _secure.write(key: _userKey, value: jsonEncode(userData));

  Future<Map<String, dynamic>?> getUser() async {
    final data = await _secure.read(key: _userKey);
    if (data == null) return null;
    return jsonDecode(data) as Map<String, dynamic>;
  }

  Future<void> deleteUser() => _secure.delete(key: _userKey);

  // App preferences (non-secure)
  Future<void> setPreference(String key, dynamic value) async {
    final prefs = await SharedPreferences.getInstance();
    if (value is String) {
      await prefs.setString(key, value);
    } else if (value is int) {
      await prefs.setInt(key, value);
    } else if (value is double) {
      await prefs.setDouble(key, value);
    } else if (value is bool) {
      await prefs.setBool(key, value);
    }
  }

  Future<dynamic> getPreference(String key) async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.get(key);
  }

  // Clear auth data on logout (preserves app preferences)
  Future<void> clearAuth() async {
    await deleteToken();
    await deleteUser();
  }
}
