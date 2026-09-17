import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:web_v2_mobile/core/theme/app_theme.dart';
import 'package:web_v2_mobile/data/models/insurance_record.dart';
import 'package:web_v2_mobile/data/models/vehicle_insurance_summary.dart';
import 'package:web_v2_mobile/data/services/insurance_service.dart';
import 'package:web_v2_mobile/providers/auth_provider.dart';
import 'package:web_v2_mobile/providers/insurance_provider.dart';
import 'package:web_v2_mobile/screens/insurance/insurance_list_screen.dart';
import 'package:web_v2_mobile/widgets/insurance_status_badge.dart';

class MockInsuranceService extends InsuranceService {
  @override
  Future<VehicleInsuranceSummaryResult> fetchSummary({
    String? search,
    String? status,
    int page = 1,
    int limit = 20,
  }) async {
    return VehicleInsuranceSummaryResult(
      vehicles: [
        VehicleInsuranceSummary(
          vehicleId: 1,
          plateNumber: '50H-55555',
          driverName: 'Nguyễn Văn Bảo',
          latestInsuranceId: 10,
          latestPurchaseDate: '2026-01-01',
          latestExpiryDate: '2027-01-01',
          latestStatus: 'active',
          insuranceCount: 3,
        ),
      ],
      total: 1,
      page: 1,
      limit: 20,
    );
  }
}

void main() {
  group('Insurance Models Test', () {
    test('InsuranceRecord parses JSON and computes daysLeft & status correctly', () {
      final now = DateTime.now();
      final expiryFuture = now.add(const Duration(days: 90)).toIso8601String().substring(0, 10);
      final expiryExpiring = now.add(const Duration(days: 20)).toIso8601String().substring(0, 10);
      final expiryPast = now.subtract(const Duration(days: 5)).toIso8601String().substring(0, 10);

      final recordActive = InsuranceRecord.fromJson({
        'id': 1,
        'vehicle_id': 5,
        'plate_number': '50H-11111',
        'driver_name': 'Lê Văn A',
        'purchase_date': '2026-01-01',
        'expiry_date': expiryFuture,
        'status': 'active',
        'notes': 'Bảo hiểm thân vỏ',
        'images': [
          {
            'id': 100,
            'insurance_id': 1,
            'filename': 'ins1.jpg',
            'original_filename': 'giay_bh.jpg',
          }
        ],
      });

      expect(recordActive.id, 1);
      expect(recordActive.vehicleId, 5);
      expect(recordActive.plateNumber, '50H-11111');
      expect(recordActive.displayStatus, 'con_han');
      expect(recordActive.images.length, 1);
      expect(recordActive.images.first.filename, 'ins1.jpg');

      final recordExpiring = InsuranceRecord.fromJson({
        'id': 2,
        'vehicle_id': 5,
        'purchase_date': '2025-01-01',
        'expiry_date': expiryExpiring,
        'status': 'active',
      });
      expect(recordExpiring.displayStatus, 'sap_het_han');

      final recordExpired = InsuranceRecord.fromJson({
        'id': 3,
        'vehicle_id': 5,
        'purchase_date': '2025-01-01',
        'expiry_date': expiryPast,
        'status': 'active',
      });
      expect(recordExpired.displayStatus, 'het_han');

      final recordSuperseded = InsuranceRecord.fromJson({
        'id': 4,
        'vehicle_id': 5,
        'purchase_date': '2025-01-01',
        'expiry_date': expiryFuture,
        'status': 'superseded',
      });
      expect(recordSuperseded.displayStatus, 'superseded');
    });

    test('VehicleInsuranceSummary parses JSON and computes displayStatus correctly', () {
      final summary = VehicleInsuranceSummary.fromJson({
        'vehicle_id': 10,
        'plate_number': '51B-88888',
        'driver_name': 'Phạm D',
        'latest_insurance_id': 50,
        'latest_purchase_date': '2026-02-01',
        'latest_expiry_date': '2027-02-01',
        'latest_status': 'active',
        'insurance_count': 2,
      });

      expect(summary.vehicleId, 10);
      expect(summary.plateNumber, '51B-88888');
      expect(summary.driverName, 'Phạm D');
      expect(summary.insuranceCount, 2);

      final summaryNoInsurance = VehicleInsuranceSummary.fromJson({
        'vehicle_id': 12,
        'plate_number': '51B-00000',
      });
      expect(summaryNoInsurance.displayStatus, 'chua_co_bao_hiem');
    });
  });

  group('Insurance Widgets Test', () {
    testWidgets('InsuranceStatusBadge renders correct labels', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: const Scaffold(
            body: Column(
              children: [
                InsuranceStatusBadge(status: 'con_han', daysLeft: 60),
                InsuranceStatusBadge(status: 'sap_het_han', daysLeft: 10),
                InsuranceStatusBadge(status: 'het_han', daysLeft: -3),
                InsuranceStatusBadge(status: 'chua_co_bao_hiem'),
                InsuranceStatusBadge(status: 'superseded'),
              ],
            ),
          ),
        ),
      );

      expect(find.text('Còn 60 ngày'), findsOneWidget);
      expect(find.text('Còn 10 ngày'), findsOneWidget);
      expect(find.text('Quá hạn 3 ngày'), findsOneWidget);
      expect(find.text('Chưa có BH'), findsOneWidget);
      expect(find.text('Đã thay thế'), findsOneWidget);
    });

    testWidgets('InsuranceListScreen renders search bar and filter chips', (WidgetTester tester) async {
      final authProvider = AuthProvider();
      final insuranceProvider = InsuranceProvider(service: MockInsuranceService());

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider<AuthProvider>.value(value: authProvider),
            ChangeNotifierProvider<InsuranceProvider>.value(value: insuranceProvider),
          ],
          child: MaterialApp(
            theme: AppTheme.lightTheme,
            home: const InsuranceListScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Quản lý bảo hiểm'), findsOneWidget);
      expect(find.text('Tìm theo biển số, tài xế...'), findsOneWidget);
      expect(find.text('Tất cả'), findsOneWidget);
      expect(find.text('Còn hạn'), findsOneWidget);
      expect(find.text('Sắp hết hạn'), findsOneWidget);
      expect(find.text('Hết hạn'), findsOneWidget);
      expect(find.text('Chưa có BH'), findsOneWidget);
      expect(find.text('50H-55555'), findsOneWidget);
      expect(find.text('Nguyễn Văn Bảo'), findsOneWidget);
    });
  });
}
