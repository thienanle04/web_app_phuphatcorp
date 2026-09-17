import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:web_v2_mobile/core/theme/app_theme.dart';
import 'package:web_v2_mobile/providers/auth_provider.dart';
import 'package:web_v2_mobile/screens/auth/login_screen.dart';

void main() {
  testWidgets('LoginScreen smoke test - renders form inputs & buttons', (WidgetTester tester) async {
    final authProvider = AuthProvider();

    await tester.pumpWidget(
      ChangeNotifierProvider<AuthProvider>.value(
        value: authProvider,
        child: MaterialApp(
          theme: AppTheme.lightTheme,
          home: const LoginScreen(),
        ),
      ),
    );

    // Verify Title and elements
    expect(find.text('Đăng nhập'), findsNWidgets(2)); // Card title & Button
    expect(find.text('Tên đăng nhập'), findsOneWidget);
    expect(find.text('Mật khẩu'), findsOneWidget);

    // Tap Login without typing to trigger validation
    await tester.tap(find.text('Đăng nhập').last);
    await tester.pump();

    // Verify error messages appear
    expect(find.text('Tên đăng nhập là bắt buộc'), findsOneWidget);
    expect(find.text('Mật khẩu là bắt buộc'), findsOneWidget);
  });
}
