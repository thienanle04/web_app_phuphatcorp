import 'dart:async';
import 'package:dio/dio.dart';
import '../api/api_endpoints.dart';
import '../storage/token_storage.dart';

class ApiClient {
  static bool _isRefreshing = false;
  static final List<Completer<String>> _refreshQueue = [];

  Dio get dio {
    final dioInstance = Dio(
      BaseOptions(
        baseUrl: ApiEndpoints.baseUrl,
        connectTimeout: const Duration(seconds: 45),
        receiveTimeout: const Duration(seconds: 45),
        sendTimeout: const Duration(seconds: 45),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ),
    );

    dioInstance.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await TokenStorage.getToken();
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          return handler.next(options);
        },
        onError: (DioException error, handler) async {
          final statusCode = error.response?.statusCode;
          final requestPath = error.requestOptions.path;
          final isRetry = error.requestOptions.extra['isRetry'] == true;

          // Do not attempt refresh on auth endpoints or if already retried
          if ((statusCode != 401 && statusCode != 403) ||
              isRetry ||
              requestPath.contains(ApiEndpoints.login) ||
              requestPath.contains(ApiEndpoints.refresh) ||
              requestPath.contains(ApiEndpoints.register)) {
            return handler.next(error);
          }

          // Check if role was revoked by admin (403 with specific message)
          final responseData = error.response?.data;
          if (statusCode == 403 && responseData is Map) {
            final msg = responseData['message']?.toString() ?? '';
            if (msg.contains('Vai trò')) {
              await TokenStorage.clearToken();
              return handler.next(error);
            }
          }

          // If a refresh is already in progress, queue this request
          if (_isRefreshing) {
            final completer = Completer<String>();
            _refreshQueue.add(completer);
            try {
              final newToken = await completer.future;
              final retryOptions = error.requestOptions;
              retryOptions.headers['Authorization'] = 'Bearer $newToken';
              retryOptions.extra['isRetry'] = true;
              final retryResponse = await dioInstance.fetch(retryOptions);
              return handler.resolve(retryResponse);
            } catch (e) {
              return handler.next(error);
            }
          }

          _isRefreshing = true;

          try {
            final refreshToken = await TokenStorage.getRefreshToken();
            if (refreshToken == null || refreshToken.isEmpty) {
              await TokenStorage.clearToken();
              _flushQueue(error: 'No refresh token available');
              return handler.next(error);
            }

            // Direct call to /auth/refresh without interceptors to avoid circular loops
            final rawDio = Dio(
              BaseOptions(
                baseUrl: ApiEndpoints.baseUrl,
                connectTimeout: const Duration(seconds: 15),
                receiveTimeout: const Duration(seconds: 15),
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                  'Cookie': 'refreshToken=$refreshToken',
                },
              ),
            );

            final refreshRes = await rawDio.post(
              ApiEndpoints.refresh,
              data: {'refreshToken': refreshToken},
            );

            final resData = refreshRes.data;
            if (resData is Map && resData['success'] == true && resData['data'] != null) {
              final data = resData['data'];
              final newAccessToken = data['accessToken']?.toString() ?? data['access_token']?.toString() ?? '';
              final newRefreshToken = data['refreshToken']?.toString() ?? data['refresh_token']?.toString();

              if (newAccessToken.isNotEmpty) {
                await TokenStorage.saveToken(newAccessToken);
                if (newRefreshToken != null && newRefreshToken.isNotEmpty) {
                  await TokenStorage.saveRefreshToken(newRefreshToken);
                }

                _flushQueue(token: newAccessToken);

                // Retry original request with new access token
                final retryOptions = error.requestOptions;
                retryOptions.headers['Authorization'] = 'Bearer $newAccessToken';
                retryOptions.extra['isRetry'] = true;
                final retryResponse = await dioInstance.fetch(retryOptions);
                return handler.resolve(retryResponse);
              }
            }

            await TokenStorage.clearToken();
            _flushQueue(error: 'Refresh token response invalid');
            return handler.next(error);
          } catch (refreshErr) {
            await TokenStorage.clearToken();
            _flushQueue(error: refreshErr);
            return handler.next(error);
          } finally {
            _isRefreshing = false;
          }
        },
      ),
    );

    return dioInstance;
  }

  static void _flushQueue({String? token, Object? error}) {
    for (final completer in _refreshQueue) {
      if (token != null) {
        completer.complete(token);
      } else {
        completer.completeError(error ?? 'Token refresh failed');
      }
    }
    _refreshQueue.clear();
  }
}
