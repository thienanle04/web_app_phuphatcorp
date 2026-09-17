import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:web_v2_mobile/core/theme/app_theme.dart';
import 'package:web_v2_mobile/data/models/dispatch_schedule.dart';
import 'package:web_v2_mobile/data/services/dispatch_schedule_service.dart';
import 'package:web_v2_mobile/providers/auth_provider.dart';
import 'package:web_v2_mobile/providers/dispatch_schedule_provider.dart';
import 'package:web_v2_mobile/screens/dispatch/dispatch_schedule_screen.dart';

class MockDispatchScheduleService extends DispatchScheduleService {
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
          vehicleId: 1,
          driverId: 1,
          diemNhan: 'Kho CLF - Bình Dương',
          tan: '2.5',
          can: 'MCC',
          ghiChu: 'Giao trước 10h',
        ),
      ],
      xeLon: [
        DispatchScheduleItem(
          id: 2,
          ngay: date,
          loaiTuyen: 'Tuyến cố định',
          loaiXe: 'Xe lớn',
          xeType: 'Xe nhà',
          bienSo: '50H55116',
          taiXe: 'Trần Văn B',
          vehicleId: 2,
          driverId: 2,
          diemNhan: 'Kho NDFC',
          tan: '8.0',
          can: 'CLF',
        ),
      ],
      tuyenNgoai: [
        DispatchScheduleItem(
          id: 3,
          ngay: date,
          loaiTuyen: 'Tuyến ngoài',
          loaiXe: 'Xe nhỏ',
          xeType: 'Xe ngoài',
          bienSo: '51H99999',
          taiXe: 'Lê C',
          diemNhan: 'Cảng Cát Lái',
          tan: '1.5',
        ),
      ],
    );
  }
}

void main() {
  group('Dispatch Schedule Models Test', () {
    test('DispatchScheduleItem parses JSON correctly', () {
      final json = {
        'id': 10,
        'ngay': '2026-09-11',
        'loai_tuyen': 'Tuyến cố định',
        'loai_xe': 'Xe nhỏ',
        'xe_type': 'Xe nhà',
        'bien_so': '51C81056',
        'tai_xe': 'Nguyễn Văn A',
        'vehicle_id': 5,
        'driver_id': 2,
        'diem_nhan': 'Kho CLF',
        'tan': '2.5',
        'can': 'MCC',
        'ghi_chu': 'Giao gấp',
        'invoice_status': 'created',
      };

      final item = DispatchScheduleItem.fromJson(json);
      expect(item.id, 10);
      expect(item.ngay, '2026-09-11');
      expect(item.loaiTuyen, 'Tuyến cố định');
      expect(item.loaiXe, 'Xe nhỏ');
      expect(item.xeType, 'Xe nhà');
      expect(item.bienSo, '51C81056');
      expect(item.taiXe, 'Nguyễn Văn A');
      expect(item.diemNhan, 'Kho CLF');
      expect(item.tan, '2.5');
      expect(item.can, 'MCC');
      expect(item.ghiChu, 'Giao gấp');
    });

    test('DispatchScheduleGroupResult parses 3 groups correctly', () {
      final json = {
        'xe_nho': [
          {'id': 1, 'bien_so': '51C1', 'diem_nhan': 'Kho 1', 'loai_tuyen': 'Tuyến cố định', 'loai_xe': 'Xe nhỏ', 'xe_type': 'Xe nhà'}
        ],
        'xe_lon': [
          {'id': 2, 'bien_so': '51C2', 'diem_nhan': 'Kho 2', 'loai_tuyen': 'Tuyến cố định', 'loai_xe': 'Xe lớn', 'xe_type': 'Xe nhà'}
        ],
        'tuyen_ngoai': [
          {'id': 3, 'bien_so': '51C3', 'diem_nhan': 'Kho 3', 'loai_tuyen': 'Tuyến ngoài', 'loai_xe': 'Xe nhỏ', 'xe_type': 'Xe ngoài'}
        ],
      };

      final result = DispatchScheduleGroupResult.fromJson(json);
      expect(result.xeNho.length, 1);
      expect(result.xeLon.length, 1);
      expect(result.tuyenNgoai.length, 1);
      expect(result.totalTrips, 3);
    });
  });

  group('Dispatch Schedule Screen Test', () {
    testWidgets('DispatchScheduleScreen renders date toolbar and 3 tabs', (WidgetTester tester) async {
      final authProvider = AuthProvider();
      final dispatchProvider = DispatchScheduleProvider(service: MockDispatchScheduleService());

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider<AuthProvider>.value(value: authProvider),
            ChangeNotifierProvider<DispatchScheduleProvider>.value(value: dispatchProvider),
          ],
          child: MaterialApp(
            theme: AppTheme.lightTheme,
            home: const DispatchScheduleScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Điều hành vận tải'), findsOneWidget);
      expect(find.text('Xe nhỏ (1)'), findsOneWidget);
      expect(find.text('Xe lớn (1)'), findsOneWidget);
      expect(find.text('Tuyến ngoài (1)'), findsOneWidget);
      expect(find.text('51C81056'), findsOneWidget);
      expect(find.text('Kho CLF - Bình Dương'), findsOneWidget);
      expect(find.text('2.5 tấn'), findsOneWidget);
      expect(find.text('CAN: MCC'), findsOneWidget);
    });
  });
}
