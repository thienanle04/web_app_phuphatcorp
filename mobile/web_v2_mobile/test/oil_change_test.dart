import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:web_v2_mobile/core/theme/app_theme.dart';
import 'package:web_v2_mobile/data/models/oil_change_due_vehicle.dart';
import 'package:web_v2_mobile/data/models/oil_change_record.dart';
import 'package:web_v2_mobile/data/services/oil_change_service.dart';
import 'package:web_v2_mobile/providers/auth_provider.dart';
import 'package:web_v2_mobile/providers/oil_change_provider.dart';
import 'package:web_v2_mobile/screens/oil_change/oil_change_screen.dart';
import 'package:web_v2_mobile/widgets/oil_status_badge.dart';

class MockOilChangeService extends OilChangeService {
  @override
  Future<List<OilChangeDueVehicle>> fetchDueVehicles() async {
    return [
      OilChangeDueVehicle(
        vehicleId: 1,
        plateNumber: '50H-11111',
        driverName: 'Nguyễn Văn A',
        intervalKm: 5000,
        lastChangeDate: '2026-01-01',
        lastOdometer: 100000,
        currentKm: 105500,
        kmSinceChange: 5500,
        oilStatus: 'overdue',
      ),
      OilChangeDueVehicle(
        vehicleId: 2,
        plateNumber: '51C-22222',
        driverName: 'Trần B',
        intervalKm: 5000,
        lastChangeDate: '2026-02-01',
        lastOdometer: 80000,
        currentKm: 84200,
        kmSinceChange: 4200,
        oilStatus: 'due_soon',
      ),
    ];
  }

  @override
  Future<OilChangeListResult> fetchHistory({
    int? vehicleId,
    int page = 1,
    int limit = 20,
  }) async {
    return OilChangeListResult(
      records: [
        OilChangeRecord(
          id: 1,
          vehicleId: 1,
          plateNumber: '50H-11111',
          driverName: 'Nguyễn Văn A',
          changeDate: '2026-01-01',
          odometerAt: 100000,
          oilType: '15W-40',
          notes: 'Thay nhớt định kỳ',
          status: 'active',
          createdAt: '2026-01-01T10:00:00Z',
          updatedAt: '2026-01-01T10:00:00Z',
        ),
      ],
      total: 1,
      page: 1,
      limit: 20,
    );
  }
}

void main() {
  group('Oil Change Models Test', () {
    test('OilChangeRecord parses JSON correctly', () {
      final record = OilChangeRecord.fromJson({
        'id': 10,
        'vehicle_id': 2,
        'plate_number': '50H-99999',
        'driver_name': 'Lê Văn C',
        'change_date': '2026-03-01',
        'odometer_at': 150200.5,
        'oil_type': '20W-50',
        'notes': 'Thay lọc nhớt',
        'status': 'active',
      });

      expect(record.id, 10);
      expect(record.vehicleId, 2);
      expect(record.plateNumber, '50H-99999');
      expect(record.driverName, 'Lê Văn C');
      expect(record.odometerAt, 150200.5);
      expect(record.oilType, '20W-50');
      expect(record.notes, 'Thay lọc nhớt');
    });

    test('OilChangeDueVehicle parses JSON and computes progressRatio and remainingKm correctly', () {
      final dueOverdue = OilChangeDueVehicle.fromJson({
        'vehicle_id': 1,
        'plate_number': '50H-11111',
        'driver_name': 'Nguyễn Văn A',
        'interval_km': 5000,
        'last_change_date': '2026-01-01',
        'last_odometer': 100000,
        'current_km': 105500,
        'km_since_change': 5500,
        'oil_status': 'overdue',
      });

      expect(dueOverdue.progressRatio, 1.0); // clamped to 1.0 max
      expect(dueOverdue.remainingKm, -500.0); // overdue by 500 km

      final dueSoon = OilChangeDueVehicle.fromJson({
        'vehicle_id': 2,
        'plate_number': '51C-22222',
        'interval_km': 5000,
        'km_since_change': 4000,
        'oil_status': 'due_soon',
      });

      expect(dueSoon.progressRatio, 0.8);
      expect(dueSoon.remainingKm, 1000.0);

      final noData = OilChangeDueVehicle.fromJson({
        'vehicle_id': 3,
        'plate_number': '51C-33333',
        'interval_km': 5000,
        'oil_status': 'no_data',
      });

      expect(noData.progressRatio, 0.0);
      expect(noData.remainingKm, null);
    });
  });

  group('Oil Change Widgets Test', () {
    testWidgets('OilStatusBadge renders correct labels for each status', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: const Scaffold(
            body: Column(
              children: [
                OilStatusBadge(status: 'overdue'),
                OilStatusBadge(status: 'due_soon'),
                OilStatusBadge(status: 'ok'),
                OilStatusBadge(status: 'no_data'),
              ],
            ),
          ),
        ),
      );

      expect(find.text('Quá hạn'), findsOneWidget);
      expect(find.text('Sắp đến hạn'), findsOneWidget);
      expect(find.text('Bình thường'), findsOneWidget);
      expect(find.text('Chưa có ODO'), findsOneWidget);
    });

    testWidgets('OilChangeScreen renders TabBar and Due Vehicles card list', (WidgetTester tester) async {
      final authProvider = AuthProvider();
      final oilProvider = OilChangeProvider(service: MockOilChangeService());

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider<AuthProvider>.value(value: authProvider),
            ChangeNotifierProvider<OilChangeProvider>.value(value: oilProvider),
          ],
          child: MaterialApp(
            theme: AppTheme.lightTheme,
            home: const OilChangeScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Quản lý thay nhớt'), findsOneWidget);
      expect(find.text('Xe cần thay nhớt'), findsOneWidget);
      expect(find.text('Lịch sử thay nhớt'), findsNWidgets(3)); // 1 in TabBar + 2 in due vehicle cards
      expect(find.text('50H-11111'), findsOneWidget);
      expect(find.text('51C-22222'), findsOneWidget);
      expect(find.text('Quá hạn'), findsNWidgets(2)); // 1 in FilterChip + 1 in OilStatusBadge
      expect(find.text('Sắp đến hạn'), findsNWidgets(2)); // 1 in FilterChip + 1 in OilStatusBadge
    });
  });
}
