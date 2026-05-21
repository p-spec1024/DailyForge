import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../config/api_config.dart';
import 'storage_service.dart';

class ApiException implements Exception {
  final int statusCode;
  final String message;

  /// S16-T2: typed engine contract code (e.g. 'INVALID_TIME_BUDGET') when the
  /// server response carries a `code` field. Null for route-validator
  /// responses, non-engine endpoints, and pre-S16-T2 server responses.
  final String? code;

  ApiException(this.statusCode, this.message, [this.code]);

  @override
  String toString() =>
      'ApiException($statusCode): $message${code != null ? ' [$code]' : ''}';
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
  /// S16-T2b: carry the timeout value + endpoint path so the Sentry
  /// beforeSend hook can tag events with timeout_seconds + endpoint_path.
  /// Both fields are optional for backward-compat with construction sites
  /// that don't have the values handy (none after S16-T2b, but defensive).
  final int? timeoutSeconds;
  final String? endpointPath;

  TimeoutApiException({this.timeoutSeconds, this.endpointPath})
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

  Future<Map<String, dynamic>> get(String path) async {
    final response = await _sendRaw('GET', path);
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return response.body.isNotEmpty
          ? jsonDecode(response.body) as Map<String, dynamic>
          : <String, dynamic>{};
    }
    throw _buildApiException(response);
  }

  Future<List<dynamic>> getList(String path) async {
    final response = await _sendRaw('GET', path);
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return response.body.isNotEmpty
          ? jsonDecode(response.body) as List<dynamic>
          : <dynamic>[];
    }
    throw _buildApiException(response);
  }

  Future<Map<String, dynamic>> post(
    String path,
    Map<String, dynamic> body, {
    bool withAuth = true,
  }) async {
    final response = await _sendRaw('POST', path,
        body: jsonEncode(body), withAuth: withAuth);
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return response.body.isNotEmpty
          ? jsonDecode(response.body) as Map<String, dynamic>
          : <String, dynamic>{};
    }
    throw _buildApiException(response);
  }

  Future<Map<String, dynamic>> put(String path, Map<String, dynamic> body) async {
    final response =
        await _sendRaw('PUT', path, body: jsonEncode(body));
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return response.body.isNotEmpty
          ? jsonDecode(response.body) as Map<String, dynamic>
          : <String, dynamic>{};
    }
    throw _buildApiException(response);
  }

  Future<Map<String, dynamic>> delete(String path) async {
    final response = await _sendRaw('DELETE', path);
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return response.body.isNotEmpty
          ? jsonDecode(response.body) as Map<String, dynamic>
          : <String, dynamic>{};
    }
    throw _buildApiException(response);
  }

  ApiException _buildApiException(http.Response response) {
    String? message;
    String? code;
    try {
      final body = jsonDecode(response.body);
      if (body is Map<String, dynamic>) {
        if (body['error'] is String) message = body['error'] as String;
        if (body['code'] is String) code = body['code'] as String;
      }
    } catch (_) {}
    return ApiException(
        response.statusCode, message ?? 'Something went wrong', code);
  }

  Future<http.Response> _sendRaw(
    String method,
    String path, {
    Object? body,
    bool withAuth = true,
  }) async {
    final url = ApiConfig.url(path);
    final uri = Uri.parse(url);
    final timeout = ApiConfig.timeoutFor(path);
    if (kDebugMode) debugPrint('[API] $method $url (timeout=${timeout.inSeconds}s)');
    try {
      final headers = await _getHeaders(withAuth: withAuth);
      late final Future<http.Response> future;
      switch (method) {
        case 'GET':
          future = http.get(uri, headers: headers);
          break;
        case 'POST':
          future = http.post(uri, headers: headers, body: body);
          break;
        case 'PUT':
          future = http.put(uri, headers: headers, body: body);
          break;
        case 'DELETE':
          future = http.delete(uri, headers: headers);
          break;
        default:
          throw ArgumentError('Unsupported HTTP method: $method');
      }
      final response = await future.timeout(timeout);
      if (kDebugMode) {
        debugPrint('[API] $method $url → ${response.statusCode}');
      }
      if (response.statusCode == 401) {
        await _storage.deleteToken();
        await _storage.deleteUser();
        onUnauthorized?.call();
        throw UnauthorizedException();
      }
      return response;
    } on TimeoutException {
      if (kDebugMode) debugPrint('[API] $method $url → TIMEOUT (${timeout.inSeconds}s)');
      throw TimeoutApiException(
        timeoutSeconds: timeout.inSeconds,
        endpointPath: path,
      );
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
}
