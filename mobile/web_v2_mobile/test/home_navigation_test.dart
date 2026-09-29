import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:web_v2_mobile/core/theme/app_theme.dart';
import 'package:web_v2_mobile/data/models/dispatch_schedule.dart';
import 'package:web_v2_mobile/data/models/user_model.dart';
import 'package:web_v2_mobile/data/services/dispatch_schedule_service.dart';
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

class FakeDispatchScheduleService extends DispatchScheduleService {
  @override
  Future<DispatchScheduleGroupResult> fetchByDate(String date) async {
    return DispatchScheduleGroupResult(
      xeNho: [
        DispatchScheduleItem(
          id: 1,
          ngay: date,
          loaiTuyen: 'Tuyến cố định',
          loaiXe: 'Xe nhỏ',
          xeType: 'Xe nhà',
          bienSo: '51C81056',
          taiXe: 'Nguyễn Văn A',
          diemNhan: 'Kho CLF',
        ),
      ],
      xeLon: [],
      tuyenNgoai: [],
    );
  }
}

void main() {
  group('HomeScreen Persistent Bottom Navigation & Nested Navigation Tests', () {
    late UserModel adminUser;

    setUp(() {
      adminUser = UserModel(
        id: 1,
        email: 'admin@phuphat.com',
        username: 'admin',
        fullName: 'Admin User',
        role: 'ADMIN',
        permissions: [],
      );
    });

    Widget createTestApp() {
      return MultiProvider(
        providers: [
          ChangeNotifierProvider<AuthProvider>.value(value: FakeAuthProvider(adminUser)),
          ChangeNotifierProvider<DispatchScheduleProvider>(
            create: (_) => DispatchScheduleProvider(service: FakeDispatchScheduleService()),
          ),
          ChangeNotifierProvider<InvoiceTrackingProvider>(create: (_) => InvoiceTrackingProvider()),
          ChangeNotifierProvider<InspectionProvider>(create: (_) => InspectionProvider()),
          ChangeNotifierProvider<InsuranceProvider>(create: (_) => InsuranceProvider()),
          ChangeNotifierProvider<OilChangeProvider>(create: (_) => OilChangeProvider()),
        ],
        child: MaterialApp(
          theme: AppTheme.lightTheme,
          home: const HomeScreen(),
        ),
      );
    }

    testWidgets('Footer menu remains visible when navigating to sub-screens', (WidgetTester tester) async {
      await tester.pumpWidget(createTestApp());
      await tester.pumpAndSettle();

      // Check initially on Home Hub
      expect(find.text('PhuPhatCorp Hub'), findsOneWidget);
      expect(find.text('Trang chủ'), findsOneWidget);
      expect(find.text('Tài khoản'), findsOneWidget);

      // Tap on "Điều phối xe" card
      await tester.tap(find.text('Điều phối xe'));
      await tester.pumpAndSettle();

      // Now on DispatchScheduleScreen
      expect(find.text('Điều hành vận tải'), findsOneWidget);

      // Verify that BottomNavigationBar footer menu is STILL visible!
      expect(find.text('Trang chủ'), findsOneWidget);
      expect(find.text('Tài khoản'), findsOneWidget);
      expect(find.byType(BottomNavigationBar), findsOneWidget);
    });

    testWidgets('Tapping Trang chủ on footer menu resets nested navigator to root Hub', (WidgetTester tester) async {
      await tester.pumpWidget(createTestApp());
      await tester.pumpAndSettle();

      // Tap on "Điều phối xe" card
      await tester.tap(find.text('Điều phối xe'));
      await tester.pumpAndSettle();
      expect(find.text('Điều hành vận tải'), findsOneWidget);

      // Tap on "Trang chủ" in the BottomNavigationBar (index 0)
      await tester.tap(find.byIcon(Icons.grid_view_rounded));
      await tester.pumpAndSettle();

      // Should have popped back to root Hub
      expect(find.text('PhuPhatCorp Hub'), findsOneWidget);
      expect(find.text('Điều phối xe'), findsOneWidget);
    });

    testWidgets('Switching between tabs retains nested state', (WidgetTester tester) async {
      await tester.pumpWidget(createTestApp());
      await tester.pumpAndSettle();

      // Go to Dispatch screen in Tab 0
      await tester.tap(find.text('Điều phối xe'));
      await tester.pumpAndSettle();
      expect(find.text('Điều hành vận tải'), findsOneWidget);

      // Switch to Tab 1 (Tài khoản)
      await tester.tap(find.text('Tài khoản'));
      await tester.pumpAndSettle();

      expect(find.text('Thông tin tài khoản'), findsOneWidget);
      expect(find.text('Admin User'), findsOneWidget);
      expect(find.byType(BottomNavigationBar), findsOneWidget);

      // Switch back to Tab 0 (Trang chủ)
      await tester.tap(find.text('Trang chủ'));
      await tester.pumpAndSettle();

      // Should still be on the Dispatch screen!
      expect(find.text('Điều hành vận tải'), findsOneWidget);

      // Tap "Trang chủ" again to reset to root Hub
      await tester.tap(find.text('Trang chủ'));
      await tester.pumpAndSettle();
      expect(find.text('PhuPhatCorp Hub'), findsOneWidget);
    });
  });
}
