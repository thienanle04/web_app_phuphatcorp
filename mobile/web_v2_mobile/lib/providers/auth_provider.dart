import 'dart:convert';
import 'package:flutter/foundation.dart';
import '../../core/storage/token_storage.dart';
import '../../data/models/user_model.dart';
import '../../data/services/auth_service.dart';

class AuthProvider extends ChangeNotifier {
  final AuthService _authService;

  UserModel? _user;
  bool _isLoading = false;
  bool _isInitialized = false;
  String? _errorMessage;

  AuthProvider({AuthService? authService}) : _authService = authService ?? AuthService();

  UserModel? get user => _user;
  bool get isAuthenticated => _user != null;
  bool get isLoading => _isLoading;
  bool get isInitialized => _isInitialized;
  String? get errorMessage => _errorMessage;

  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }

  Future<void> initializeAuth() async {
    _isLoading = true;
    notifyListeners();

    try {
      final token = await TokenStorage.getToken();
      if (token != null && token.isNotEmpty) {
        // Try to load cached user first for instant UI response
        final cachedUserStr = await TokenStorage.getUserData();
        if (cachedUserStr != null) {
          try {
            _user = UserModel.fromJson(jsonDecode(cachedUserStr));
            notifyListeners();
          } catch (_) {}
        }

        // Verify with server /auth/me
        try {
          final serverUser = await _authService.getMe();
          _user = serverUser;
        } catch (_) {
          // If token expired or invalid
          _user = null;
          await TokenStorage.clearToken();
        }
      }
    } catch (_) {
      _user = null;
    } finally {
      _isLoading = false;
      _isInitialized = true;
      notifyListeners();
    }
  }

  Future<bool> login(String username, String password) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final authResponse = await _authService.login(username, password);
      _user = authResponse.user;
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _isLoading = false;
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      notifyListeners();
      return false;
    }
  }

  Future<void> logout() async {
    _isLoading = true;
    notifyListeners();

    await _authService.logout();
    _user = null;
    _isLoading = false;
    _errorMessage = null;
    notifyListeners();
  }

  bool hasPermission(String code) {
    if (_user == null) return false;
    if (_user?.role == 'ADMIN') return true;
    return _user?.permissions?.contains(code) ?? false;
  }

  bool hasAnyPermission(List<String> codes) {
    if (_user == null) return false;
    if (_user?.role == 'ADMIN') return true;
    return codes.any((code) => _user?.permissions?.contains(code) ?? false);
  }
}
