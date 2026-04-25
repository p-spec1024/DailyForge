import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../config/api_config.dart';
import 'storage_service.dart';

const Duration _kRequestTimeout = Duration(seconds: 15);

class ApiException implements Exception {
  final int statusCode;
  final String message;
  ApiException(this.statusCode, this.message);

  @override
  String toString() => 'ApiException($statusCode): $message';
}

class UnauthorizedException extends ApiException {
  UnauthorizedException()
      : super(401, 'Session expired. Please login again.');
}

class NetworkException extends ApiException {
  NetworkException([String? message])
      : super(0, message ?? 'Network error. Check your connection and try again.');
}

class TimeoutApiException extends ApiException {
  TimeoutApiException()
      : super(0, 'Request timed out. Is the API server reachable?');
}

class ApiService {
  final StorageService _storage;

  /// Called when a 401 is received — set by AuthProvider to trigger logout.
  void Function()? onUnauthorized;

  ApiService(this._storage);

  Future<Map<String, String>> _getHeaders({bool withAuth = true}) async {
    final headers = <String, String>{
      'Content-Type': 'application/json',
    };
    if (withAuth) {
      final token = await _storage.getToken();
      if (token != null) {
        headers['Authorization'] = 'Bearer $token';
      }
    }
    return headers;
  }

  Future<Map<String, dynamic>> get(String path) =>
      _send('GET', path, () async => http.get(
            Uri.parse(ApiConfig.url(path)),
            headers: await _getHeaders(),
          ));

  Future<List<dynamic>> getList(String path) async {
    final url = ApiConfig.url(path);
    if (kDebugMode) debugPrint('[API] GET $url');
    try {
      final response = await http
          .get(Uri.parse(url), headers: await _getHeaders())
          .timeout(_kRequestTimeout);
      if (kDebugMode) debugPrint('[API] GET $url → ${response.statusCode}');
      if (response.statusCode >= 200 && response.statusCode < 300) {
        return response.body.isNotEmpty
            ? jsonDecode(response.body) as List<dynamic>
            : <dynamic>[];
      }
      if (response.statusCode == 401) {
        await _storage.deleteToken();
        await _storage.deleteUser();
        onUnauthorized?.call();
        throw UnauthorizedException();
      }
      String? message;
      try {
        final body = jsonDecode(response.body);
        if (body is Map<String, dynamic>) message = body['error'] as String?;
      } catch (_) {}
      throw ApiException(response.statusCode, message ?? 'Something went wrong');
    } on TimeoutException {
      throw TimeoutApiException();
    } on SocketException {
      throw NetworkException();
    } on HttpException catch (e) {
      throw NetworkException(e.message);
    } on http.ClientException catch (e) {
      // Android throws ClientException for certain failed requests. Not a
      // subclass of SocketException/HttpException — must be caught explicitly
      // or it propagates unwrapped (FUTURE_SCOPE #107).
      throw NetworkException(e.message);
    }
  }

  Future<Map<String, dynamic>> post(
    String path,
    Map<String, dynamic> body, {
    bool withAuth = true,
  }) =>
      _send('POST', path, () async => http.post(
            Uri.parse(ApiConfig.url(path)),
            headers: await _getHeaders(withAuth: withAuth),
            body: jsonEncode(body),
          ));

  Future<Map<String, dynamic>> put(String path, Map<String, dynamic> body) =>
      _send('PUT', path, () async => http.put(
            Uri.parse(ApiConfig.url(path)),
            headers: await _getHeaders(),
            body: jsonEncode(body),
          ));

  Future<Map<String, dynamic>> delete(String path) =>
      _send('DELETE', path, () async => http.delete(
            Uri.parse(ApiConfig.url(path)),
            headers: await _getHeaders(),
          ));

  Future<Map<String, dynamic>> _send(
    String method,
    String path,
    Future<http.Response> Function() request,
  ) async {
    final url = ApiConfig.url(path);
    if (kDebugMode) debugPrint('[API] $method $url');
    try {
      final response = await request().timeout(_kRequestTimeout);
      if (kDebugMode) {
        debugPrint('[API] $method $url → ${response.statusCode}');
      }
      return await _handleResponse(response);
    } on TimeoutException {
      if (kDebugMode) debugPrint('[API] $method $url → TIMEOUT');
      throw TimeoutApiException();
    } on SocketException catch (e) {
      if (kDebugMode) debugPrint('[API] $method $url → SOCKET ${e.message}');
      throw NetworkException();
    } on HttpException catch (e) {
      if (kDebugMode) debugPrint('[API] $method $url → HTTP ${e.message}');
      throw NetworkException(e.message);
    } on http.ClientException catch (e) {
      if (kDebugMode) debugPrint('[API] $method $url → CLIENT ${e.message}');
      throw NetworkException(e.message);
    }
  }

  Future<Map<String, dynamic>> _handleResponse(http.Response response) async {
    final body = response.body.isNotEmpty
        ? jsonDecode(response.body) as Map<String, dynamic>
        : <String, dynamic>{};

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return body;
    }

    if (response.statusCode == 401) {
      await _storage.deleteToken();
      await _storage.deleteUser();
      onUnauthorized?.call();
      throw UnauthorizedException();
    }

    throw ApiException(
      response.statusCode,
      body['error'] as String? ?? 'Something went wrong',
    );
  }
}
