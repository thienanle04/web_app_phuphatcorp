import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:web_v2_mobile/core/theme/app_theme.dart';
import 'package:web_v2_mobile/data/models/inspection_record.dart';
import 'package:web_v2_mobile/data/models/vehicle_inspection_summary.dart';
import 'package:web_v2_mobile/data/models/vehicle_option.dart';
import 'package:web_v2_mobile/data/services/inspection_service.dart';
import 'package:web_v2_mobile/providers/auth_provider.dart';
import 'package:web_v2_mobile/providers/inspection_provider.dart';
import 'package:web_v2_mobile/screens/inspection/inspection_list_screen.dart';
import 'package:web_v2_mobile/widgets/inspection_status_badge.dart';

class MockInspectionService extends InspectionService {
  @override
  Future<VehicleSummaryResult> fetchSummary({
    String? search,
    String? status,
    int page = 1,
    int limit = 20,
  }) async {
    return VehicleSummaryResult(
      vehicles: [
        VehicleInspectionSummary(
          vehicleId: 1,
          plateNumber: '50H-12345',
          driverName: 'Nguyễn Văn A',
          latestInspectionId: 1,
          latestInspectionDate: '2026-01-01',
          latestExpiryDate: '2026-07-01',
          latestStatus: 'active',
          inspectionCount: 2,
        ),
      ],
      total: 1,
      page: 1,
      limit: 20,
    );
  }
}

void main() {
  group('Inspection Models Test', () {
    test('InspectionRecord parses JSON and computes daysLeft & status correctly', () {
      final now = DateTime.now();
      final expiryFuture = now.add(const Duration(days: 60)).toIso8601String().substring(0, 10);
      final expiryExpiring = now.add(const Duration(days: 15)).toIso8601String().substring(0, 10);
      final expiryPast = now.subtract(const Duration(days: 10)).toIso8601String().substring(0, 10);

      final recordActive = InspectionRecord.fromJson({
        'id': 1,
        'vehicle_id': 5,
        'plate_number': '51A-12345',
        'driver_name': 'Nguyễn Văn A',
        'inspection_date': '2026-01-01',
        'expiry_date': expiryFuture,
        'status': 'active',
        'notes': 'Đăng kiểm định kỳ',
        'images': [
          {
            'id': 10,
            'inspection_id': 1,
            'filename': 'img1.jpg',
            'original_filename': 'photo.jpg',
          }
        ],
      });

      expect(recordActive.id, 1);
      expect(recordActive.vehicleId, 5);
      expect(recordActive.plateNumber, '51A-12345');
      expect(recordActive.displayStatus, 'con_han');
      expect(recordActive.images.length, 1);
      expect(recordActive.images.first.filename, 'img1.jpg');

      final recordExpiring = InspectionRecord.fromJson({
        'id': 2,
        'vehicle_id': 5,
        'inspection_date': '2026-01-01',
        'expiry_date': expiryExpiring,
        'status': 'active',
      });
      expect(recordExpiring.displayStatus, 'sap_het_han');

      final recordExpired = InspectionRecord.fromJson({
        'id': 3,
        'vehicle_id': 5,
        'inspection_date': '2026-01-01',
        'expiry_date': expiryPast,
        'status': 'active',
      });
      expect(recordExpired.displayStatus, 'het_han');

      final recordSuperseded = InspectionRecord.fromJson({
        'id': 4,
        'vehicle_id': 5,
        'inspection_date': '2026-01-01',
        'expiry_date': expiryFuture,
        'status': 'superseded',
      });
      expect(recordSuperseded.displayStatus, 'superseded');
    });

    test('VehicleInspectionSummary parses JSON and computes displayStatus correctly', () {
      final summary = VehicleInspectionSummary.fromJson({
        'vehicle_id': 10,
        'plate_number': '50H-99999',
        'driver_name': 'Trần B',
        'latest_inspection_id': 45,
        'latest_inspection_date': '2026-03-01',
        'latest_expiry_date': '2026-09-01',
        'latest_status': 'active',
        'inspection_count': 4,
      });

      expect(summary.vehicleId, 10);
      expect(summary.plateNumber, '50H-99999');
      expect(summary.driverName, 'Trần B');
      expect(summary.inspectionCount, 4);

      final summaryNoInspection = VehicleInspectionSummary.fromJson({
        'vehicle_id': 11,
        'plate_number': '50H-00000',
      });
      expect(summaryNoInspection.displayStatus, 'chua_dang_kiem');
    });

    test('VehicleOption parses JSON correctly', () {
      final option = VehicleOption.fromJson({
        'id': 7,
        'plate_number': '51C-77777',
        'driver_name': 'Lê C',
        'vehicle_type': 'Xe lớn',
        'status': 'active',
      });

      expect(option.id, 7);
      expect(option.plateNumber, '51C-77777');
      expect(option.driverName, 'Lê C');
      expect(option.vehicleType, 'Xe lớn');
    });
  });

  group('Inspection Widgets Test', () {
    testWidgets('InspectionStatusBadge renders correct labels', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: const Scaffold(
            body: Column(
              children: [
                InspectionStatusBadge(status: 'con_han', daysLeft: 45),
                InspectionStatusBadge(status: 'sap_het_han', daysLeft: 12),
                InspectionStatusBadge(status: 'het_han', daysLeft: -5),
                InspectionStatusBadge(status: 'chua_dang_kiem'),
                InspectionStatusBadge(status: 'superseded'),
              ],
            ),
          ),
        ),
      );

      expect(find.text('Còn 45 ngày'), findsOneWidget);
      expect(find.text('Còn 12 ngày'), findsOneWidget);
      expect(find.text('Quá hạn 5 ngày'), findsOneWidget);
      expect(find.text('Chưa ĐK'), findsOneWidget);
      expect(find.text('Đã thay thế'), findsOneWidget);
    });

    testWidgets('InspectionListScreen renders search bar and filter chips', (WidgetTester tester) async {
      final authProvider = AuthProvider();
      final inspectionProvider = InspectionProvider(service: MockInspectionService());

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider<AuthProvider>.value(value: authProvider),
            ChangeNotifierProvider<InspectionProvider>.value(value: inspectionProvider),
          ],
          child: MaterialApp(
            theme: AppTheme.lightTheme,
            home: const InspectionListScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Quản lý đăng kiểm'), findsOneWidget);
      expect(find.text('Tìm theo biển số, tài xế...'), findsOneWidget);
      expect(find.text('Tất cả'), findsOneWidget);
      expect(find.text('Còn hạn'), findsOneWidget);
      expect(find.text('Sắp hết hạn'), findsOneWidget);
      expect(find.text('Hết hạn'), findsOneWidget);
      expect(find.text('Chưa ĐK'), findsOneWidget);
      expect(find.text('50H-12345'), findsOneWidget);
      expect(find.text('Nguyễn Văn A'), findsOneWidget);
    });
  });
}
