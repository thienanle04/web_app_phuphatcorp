import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:web_v2_mobile/core/storage/token_storage.dart';
import 'package:web_v2_mobile/data/models/auth_response.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Token Storage & Auth Response Refresh Tests', () {
    setUp(() {
      SharedPreferences.setMockInitialValues({});
    });

    test('AuthResponseModel parses accessToken and refreshToken', () {
      final json = {
        'user': {
          'id': 1,
          'email': 'driver@phuphat.com',
          'username': 'driver',
          'full_name': 'Driver User',
          'role': 'TAI_XE',
        },
        'accessToken': 'access_token_123',
        'refreshToken': 'refresh_token_456',
      };

      final authResponse = AuthResponseModel.fromJson(json);
      expect(authResponse.accessToken, 'access_token_123');
      expect(authResponse.refreshToken, 'refresh_token_456');
      expect(authResponse.user.fullName, 'Driver User');

      final serialized = authResponse.toJson();
      expect(serialized['accessToken'], 'access_token_123');
      expect(serialized['refreshToken'], 'refresh_token_456');
    });

    test('TokenStorage saves and clears both access and refresh tokens', () async {
      await TokenStorage.saveToken('access_1');
      await TokenStorage.saveRefreshToken('refresh_1');

      expect(await TokenStorage.getToken(), 'access_1');
      expect(await TokenStorage.getRefreshToken(), 'refresh_1');

      await TokenStorage.clearToken();

      expect(await TokenStorage.getToken(), isNull);
      expect(await TokenStorage.getRefreshToken(), isNull);
    });
  });
}
