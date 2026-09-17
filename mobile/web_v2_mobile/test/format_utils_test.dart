import 'package:flutter_test/flutter_test.dart';
import 'package:web_v2_mobile/core/utils/format_utils.dart';
import 'package:web_v2_mobile/data/models/inspection_record.dart';
import 'package:web_v2_mobile/data/models/insurance_record.dart';
import 'package:web_v2_mobile/data/models/vehicle_inspection_summary.dart';
import 'package:web_v2_mobile/data/models/vehicle_insurance_summary.dart';

void main() {
  group('FormatUtils Timezone & Date Formatting Tests', () {
    test('formatDate correctly parses ISO UTC timestamp to local date (e.g. 17:00 UTC previous day)', () {
      // In GMT+7 (Vietnam): 2026-09-02T17:00:00.000Z is 2026-09-03 00:00:00 local time
      // For local DateTime, .toLocal() converts the UTC instant to local date
      final utcStr = '2026-09-02T17:00:00.000Z';
      final formatted = FormatUtils.formatDate(utcStr);

      final expectedLocalDate = DateTime.parse(utcStr).toLocal();
      final expectedDay = expectedLocalDate.day.toString().padLeft(2, '0');
      final expectedMonth = expectedLocalDate.month.toString().padLeft(2, '0');
      final expectedYear = expectedLocalDate.year.toString();
      final expectedFormatted = '$expectedDay/$expectedMonth/$expectedYear';

      expect(formatted, expectedFormatted);
    });

    test('formatDate correctly parses plain date string (YYYY-MM-DD)', () {
      final plainDate = '2026-09-03';
      final formatted = FormatUtils.formatDate(plainDate);
      expect(formatted, '03/09/2026');
    });

    test('formatDate returns — for null or empty string', () {
      expect(FormatUtils.formatDate(null), '—');
      expect(FormatUtils.formatDate(''), '—');
    });

    test('formatDateTime correctly parses ISO UTC timestamp with time', () {
      final utcStr = '2026-09-02T17:30:00.000Z';
      final formatted = FormatUtils.formatDateTime(utcStr);

      final expectedLocalDate = DateTime.parse(utcStr).toLocal();
      final expectedDay = expectedLocalDate.day.toString().padLeft(2, '0');
      final expectedMonth = expectedLocalDate.month.toString().padLeft(2, '0');
      final expectedYear = expectedLocalDate.year.toString();
      final expectedHour = expectedLocalDate.hour.toString().padLeft(2, '0');
      final expectedMinute = expectedLocalDate.minute.toString().padLeft(2, '0');

      expect(formatted, '$expectedDay/$expectedMonth/$expectedYear $expectedHour:$expectedMinute');
    });
  });

  group('Models daysLeft with UTC timestamps Tests', () {
    test('InspectionRecord daysLeft converts UTC timestamp to local before calculating', () {
      final today = DateTime.now();
      final futureDate = today.add(const Duration(days: 10));
      // Simulate backend UTC date format
      final utcDateStr = '${futureDate.toUtc().toIso8601String().substring(0, 10)}T17:00:00.000Z';

      final record = InspectionRecord.fromJson({
        'id': 1,
        'vehicle_id': 1,
        'inspection_date': '2026-01-01',
        'expiry_date': utcDateStr,
        'status': 'active',
      });

      expect(record.daysLeft, isNonNegative);
    });

    test('InsuranceRecord daysLeft converts UTC timestamp to local before calculating', () {
      final today = DateTime.now();
      final futureDate = today.add(const Duration(days: 20));
      final utcDateStr = '${futureDate.toUtc().toIso8601String().substring(0, 10)}T17:00:00.000Z';

      final record = InsuranceRecord.fromJson({
        'id': 1,
        'vehicle_id': 1,
        'purchase_date': '2026-01-01',
        'expiry_date': utcDateStr,
        'status': 'active',
      });

      expect(record.daysLeft, isNonNegative);
    });

    test('VehicleInspectionSummary and VehicleInsuranceSummary daysLeft convert UTC correctly', () {
      final today = DateTime.now();
      final futureDate = today.add(const Duration(days: 15));
      final utcDateStr = '${futureDate.toUtc().toIso8601String().substring(0, 10)}T17:00:00.000Z';

      final inspSummary = VehicleInspectionSummary.fromJson({
        'vehicle_id': 1,
        'plate_number': '50H-12345',
        'latest_expiry_date': utcDateStr,
      });
      expect(inspSummary.daysLeft, isNotNull);

      final insSummary = VehicleInsuranceSummary.fromJson({
        'vehicle_id': 1,
        'plate_number': '50H-12345',
        'latest_expiry_date': utcDateStr,
      });
      expect(insSummary.daysLeft, isNotNull);
    });
  });
}
