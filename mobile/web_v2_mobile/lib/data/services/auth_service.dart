import 'dart:convert';
import 'package:dio/dio.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_endpoints.dart';
import '../../core/storage/token_storage.dart';
import '../models/auth_response.dart';
import '../models/user_model.dart';

class AuthService {
  final ApiClient _apiClient;

  AuthService({ApiClient? apiClient}) : _apiClient = apiClient ?? ApiClient();

  Future<AuthResponseModel> login(String username, String password) async {
    try {
      final response = await _apiClient.dio.post(
        ApiEndpoints.login,
        data: {
          'username': username.trim(),
          'password': password,
        },
      );

      final body = response.data;
      if (body['success'] == true && body['data'] != null) {
        final authResponse = AuthResponseModel.fromJson(body['data']);
        // Save token, refresh token and cached user
        await TokenStorage.saveToken(authResponse.accessToken);
        if (authResponse.refreshToken != null && authResponse.refreshToken!.isNotEmpty) {
          await TokenStorage.saveRefreshToken(authResponse.refreshToken!);
        }
        await TokenStorage.saveUserData(jsonEncode(authResponse.user.toJson()));
        return authResponse;
      } else {
        throw Exception(body['message'] ?? 'Đăng nhập thất bại');
      }
    } on DioException catch (e) {
      if (e.response?.data != null && e.response?.data is Map) {
        final msg = e.response?.data['message'] ?? e.response?.data['error'];
        if (msg != null) {
          throw Exception(msg.toString());
        }
      }
      if (e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.sendTimeout ||
          e.type == DioExceptionType.receiveTimeout ||
          e.type == DioExceptionType.connectionError) {
        throw Exception('Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại mạng hoặc IP máy chủ.');
      }
      throw Exception('Đã xảy ra lỗi. Vui lòng thử lại.');
    } catch (e) {
      throw Exception(e.toString().replaceAll('Exception: ', ''));
    }
  }

  Future<UserModel> getMe() async {
    try {
      final response = await _apiClient.dio.get(ApiEndpoints.me);
      final body = response.data;
      if (body['success'] == true && body['data'] != null) {
        final user = UserModel.fromJson(body['data']);
        await TokenStorage.saveUserData(jsonEncode(user.toJson()));
        return user;
      } else {
        throw Exception(body['message'] ?? 'Không lấy được thông tin người dùng');
      }
    } on DioException catch (e) {
      if (e.response?.data != null && e.response?.data is Map) {
        final msg = e.response?.data['message'];
        if (msg != null) throw Exception(msg.toString());
      }
      throw Exception('Phiên đăng nhập hết hạn hoặc không hợp lệ.');
    }
  }

  Future<void> logout() async {
    try {
      await _apiClient.dio.post(ApiEndpoints.logout);
    } catch (_) {
      // Ignore network errors on logout
    } finally {
      await TokenStorage.clearToken();
    }
  }
}
