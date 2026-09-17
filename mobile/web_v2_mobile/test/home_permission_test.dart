import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:web_v2_mobile/core/theme/app_theme.dart';
import 'package:web_v2_mobile/data/models/user_model.dart';
import 'package:web_v2_mobile/providers/auth_provider.dart';
import 'package:web_v2_mobile/providers/dispatch_schedule_provider.dart';
import 'package:web_v2_mobile/providers/inspection_provider.dart';
import 'package:web_v2_mobile/providers/insurance_provider.dart';
import 'package:web_v2_mobile/providers/invoice_tracking_provider.dart';
import 'package:web_v2_mobile/providers/oil_change_provider.dart';
import 'package:web_v2_mobile/screens/home/home_screen.dart';

class FakeAuthProvider extends AuthProvider {
  final UserModel? fakeUser;

  FakeAuthProvider(this.fakeUser);

  @override
  UserModel? get user => fakeUser;

  @override
  bool get isAuthenticated => fakeUser != null;

  @override
  bool hasPermission(String code) {
    if (fakeUser == null) return false;
    if (fakeUser?.role == 'ADMIN') return true;
    return fakeUser?.permissions?.contains(code) ?? false;
  }

  @override
  bool hasAnyPermission(List<String> codes) {
    if (fakeUser == null) return false;
    if (fakeUser?.role == 'ADMIN') return true;
    return codes.any((code) => fakeUser?.permissions?.contains(code) ?? false);
  }
}

void main() {
  group('HomeScreen Dashboard Hub Permission Tests', () {
    testWidgets('ADMIN sees all Hub module cards on Home tab', (WidgetTester tester) async {
      final adminUser = UserModel(
        id: 1,
        email: 'admin@phuphat.com',
        username: 'admin',
        fullName: 'Admin User',
        role: 'ADMIN',
        permissions: [],
      );

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider<AuthProvider>.value(value: FakeAuthProvider(adminUser)),
            ChangeNotifierProvider<DispatchScheduleProvider>(create: (_) => DispatchScheduleProvider()),
            ChangeNotifierProvider<InvoiceTrackingProvider>(create: (_) => InvoiceTrackingProvider()),
            ChangeNotifierProvider<InspectionProvider>(create: (_) => InspectionProvider()),
            ChangeNotifierProvider<InsuranceProvider>(create: (_) => InsuranceProvider()),
            ChangeNotifierProvider<OilChangeProvider>(create: (_) => OilChangeProvider()),
          ],
          child: MaterialApp(
            theme: AppTheme.lightTheme,
            home: const HomeScreen(),
          ),
        ),
      );

      // Bottom bar tabs
      expect(find.text('Trang chủ'), findsOneWidget);
      expect(find.text('Tài khoản'), findsOneWidget);

      // All module cards
      expect(find.text('Điều phối xe'), findsOneWidget);
      expect(find.text('Theo dõi HĐ'), findsOneWidget);
      expect(find.text('Đăng kiểm'), findsOneWidget);
      expect(find.text('Bảo hiểm'), findsOneWidget);
      expect(find.text('Thay nhớt'), findsOneWidget);
    });

    testWidgets('Dispatcher user with dispatch.view sees only Điều phối xe card', (WidgetTester tester) async {
      final dispatcherUser = UserModel(
        id: 2,
        email: 'dispatcher@phuphat.com',
        username: 'dispatch1',
        fullName: 'Dispatcher One',
        role: 'DIEU_PHOI_XE',
        permissions: ['dispatch.view'],
      );

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider<AuthProvider>.value(value: FakeAuthProvider(dispatcherUser)),
            ChangeNotifierProvider<DispatchScheduleProvider>(create: (_) => DispatchScheduleProvider()),
            ChangeNotifierProvider<InvoiceTrackingProvider>(create: (_) => InvoiceTrackingProvider()),
            ChangeNotifierProvider<InspectionProvider>(create: (_) => InspectionProvider()),
            ChangeNotifierProvider<InsuranceProvider>(create: (_) => InsuranceProvider()),
            ChangeNotifierProvider<OilChangeProvider>(create: (_) => OilChangeProvider()),
          ],
          child: MaterialApp(
            theme: AppTheme.lightTheme,
            home: const HomeScreen(),
          ),
        ),
      );

      expect(find.text('Trang chủ'), findsOneWidget);
      expect(find.text('Tài khoản'), findsOneWidget);

      expect(find.text('Điều phối xe'), findsOneWidget);
      expect(find.text('Theo dõi HĐ'), findsNothing);
      expect(find.text('Đăng kiểm'), findsNothing);
      expect(find.text('Bảo hiểm'), findsNothing);
      expect(find.text('Thay nhớt'), findsNothing);
    });

    testWidgets('Driver user with invoice_tracking.view sees only Theo dõi HĐ card', (WidgetTester tester) async {
      final driverUser = UserModel(
        id: 3,
        email: 'driver@phuphat.com',
        username: 'driver1',
        fullName: 'Driver One',
        role: 'TAI_XE',
        permissions: ['invoice_tracking.view'],
      );

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider<AuthProvider>.value(value: FakeAuthProvider(driverUser)),
            ChangeNotifierProvider<DispatchScheduleProvider>(create: (_) => DispatchScheduleProvider()),
            ChangeNotifierProvider<InvoiceTrackingProvider>(create: (_) => InvoiceTrackingProvider()),
            ChangeNotifierProvider<InspectionProvider>(create: (_) => InspectionProvider()),
            ChangeNotifierProvider<InsuranceProvider>(create: (_) => InsuranceProvider()),
            ChangeNotifierProvider<OilChangeProvider>(create: (_) => OilChangeProvider()),
          ],
          child: MaterialApp(
            theme: AppTheme.lightTheme,
            home: const HomeScreen(),
          ),
        ),
      );

      expect(find.text('Trang chủ'), findsOneWidget);
      expect(find.text('Tài khoản'), findsOneWidget);

      expect(find.text('Điều phối xe'), findsNothing);
      expect(find.text('Theo dõi HĐ'), findsOneWidget);
      expect(find.text('Đăng kiểm'), findsNothing);
      expect(find.text('Bảo hiểm'), findsNothing);
      expect(find.text('Thay nhớt'), findsNothing);
    });

    testWidgets('Staff user with vehicle_data.view sees Đăng kiểm, Bảo hiểm, Thay nhớt', (WidgetTester tester) async {
      final maintenanceUser = UserModel(
        id: 4,
        email: 'maintenance@phuphat.com',
        username: 'staff1',
        fullName: 'Staff Maintenance',
        role: 'STAFF',
        permissions: ['vehicle_data.view'],
      );

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider<AuthProvider>.value(value: FakeAuthProvider(maintenanceUser)),
            ChangeNotifierProvider<DispatchScheduleProvider>(create: (_) => DispatchScheduleProvider()),
            ChangeNotifierProvider<InvoiceTrackingProvider>(create: (_) => InvoiceTrackingProvider()),
            ChangeNotifierProvider<InspectionProvider>(create: (_) => InspectionProvider()),
            ChangeNotifierProvider<InsuranceProvider>(create: (_) => InsuranceProvider()),
            ChangeNotifierProvider<OilChangeProvider>(create: (_) => OilChangeProvider()),
          ],
          child: MaterialApp(
            theme: AppTheme.lightTheme,
            home: const HomeScreen(),
          ),
        ),
      );

      expect(find.text('Trang chủ'), findsOneWidget);
      expect(find.text('Tài khoản'), findsOneWidget);

      expect(find.text('Điều phối xe'), findsNothing);
      expect(find.text('Theo dõi HĐ'), findsNothing);
      expect(find.text('Đăng kiểm'), findsOneWidget);
      expect(find.text('Bảo hiểm'), findsOneWidget);
      expect(find.text('Thay nhớt'), findsOneWidget);
    });

    testWidgets('User with NO permissions sees empty state on Home tab and Profile on Account tab', (WidgetTester tester) async {
      final noPermUser = UserModel(
        id: 5,
        email: 'guest@phuphat.com',
        username: 'guest',
        fullName: 'Guest User',
        role: 'VIEWER',
        permissions: [],
      );

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider<AuthProvider>.value(value: FakeAuthProvider(noPermUser)),
            ChangeNotifierProvider<DispatchScheduleProvider>(create: (_) => DispatchScheduleProvider()),
            ChangeNotifierProvider<InvoiceTrackingProvider>(create: (_) => InvoiceTrackingProvider()),
            ChangeNotifierProvider<InspectionProvider>(create: (_) => InspectionProvider()),
            ChangeNotifierProvider<InsuranceProvider>(create: (_) => InsuranceProvider()),
            ChangeNotifierProvider<OilChangeProvider>(create: (_) => OilChangeProvider()),
          ],
          child: MaterialApp(
            theme: AppTheme.lightTheme,
            home: const HomeScreen(),
          ),
        ),
      );

      expect(find.text('Trang chủ'), findsOneWidget);
      expect(find.text('Tài khoản'), findsOneWidget);

      expect(find.text('Chào mừng bạn đến với PhuPhatCorp Mobile'), findsOneWidget);
      expect(find.text('Điều phối xe'), findsNothing);
      expect(find.text('Theo dõi HĐ'), findsNothing);
      expect(find.text('Đăng kiểm'), findsNothing);
      expect(find.text('Bảo hiểm'), findsNothing);
      expect(find.text('Thay nhớt'), findsNothing);

      // Switch to Account tab
      await tester.tap(find.text('Tài khoản'));
      await tester.pumpAndSettle();

      expect(find.text('Thông tin tài khoản'), findsOneWidget);
      expect(find.text('Guest User'), findsOneWidget);
    });
  });
}
