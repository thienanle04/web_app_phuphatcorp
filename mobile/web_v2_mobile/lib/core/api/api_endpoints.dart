import 'package:flutter/foundation.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';

class ApiEndpoints {
  /// Lấy Base URL từ file .env hoặc tự động fallback theo platform
  static String get baseUrl {
    String? envUrl;
    if (dotenv.isInitialized) {
      envUrl = dotenv.env['API_URL'];
    }
    
    if (envUrl != null && envUrl.trim().isNotEmpty) {
      // Nếu chạy Android Emulator và URL là localhost / 127.0.0.1 thì tự map sang 10.0.2.2
      if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
        return envUrl
            .replaceAll('http://localhost:', 'http://10.0.2.2:')
            .replaceAll('http://127.0.0.1:', 'http://10.0.2.2:');
      }
      return envUrl;
    }

    // Fallback mặc định nếu chưa load được .env
    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
      return 'http://10.0.2.2:3021/api';
    }
    return 'http://localhost:3021/api';
  }

  static const String login = '/auth/login';
  static const String register = '/auth/register';
  static const String me = '/auth/me';
  static const String logout = '/auth/logout';
  static const String refresh = '/auth/refresh';

  // Invoice Tracking Endpoints
  static const String invoiceTracking = '/invoice-tracking';
  static String invoiceTrackingDetail(int id) => '/invoice-tracking/$id';
  static String invoiceTrackingHistory(int id) => '/invoice-tracking/$id/history';
  static String invoiceTrackingDocuments(int id) => '/invoice-tracking/$id/documents';
  static String invoiceTrackingReview(int id) => '/invoice-tracking/$id/review';
  static String invoiceTrackingCopyableTickets(int id) => '/invoice-tracking/$id/copyable-tickets';
  static String invoiceTrackingCopyDocuments(int id) => '/invoice-tracking/$id/copy-documents';
  static String invoiceTrackingFile(String filename) => '$baseUrl/invoice-tracking/files/$filename';

  // Vehicle Inspection Endpoints
  static const String vehicleInspections = '/vehicle-inspections';
  static const String vehicleInspectionsSummary = '/vehicle-inspections/summary';
  static const String vehicleInspectionsExpiring = '/vehicle-inspections/expiring';
  static String vehicleInspectionDetail(int id) => '/vehicle-inspections/$id';
  static String vehicleInspectionImages(int id) => '/vehicle-inspections/$id/images';
  static String vehicleInspectionImageDelete(int id, int imageId) => '/vehicle-inspections/$id/images/$imageId';
  static String vehicleInspectionFile(String filename) => '$baseUrl/vehicle-inspections/files/$filename';

  // Vehicle Insurance Endpoints
  static const String vehicleInsurances = '/vehicle-insurances';
  static const String vehicleInsurancesSummary = '/vehicle-insurances/summary';
  static const String vehicleInsurancesExpiring = '/vehicle-insurances/expiring';
  static String vehicleInsuranceDetail(int id) => '/vehicle-insurances/$id';
  static String vehicleInsuranceImages(int id) => '/vehicle-insurances/$id/images';
  static String vehicleInsuranceImageDelete(int id, int imageId) => '/vehicle-insurances/$id/images/$imageId';
  static String vehicleInsuranceFile(String filename) => '$baseUrl/vehicle-insurances/files/$filename';

  // Vehicle Oil Change Endpoints
  static const String vehicleOilChanges = '/vehicle-oil-changes';
  static const String vehicleOilChangesDue = '/vehicle-oil-changes/due';
  static String vehicleOilChangeDetail(int id) => '/vehicle-oil-changes/$id';
  static String vehicleOilInterval(int vehicleId) => '/vehicles/$vehicleId/oil-interval';

  // Vehicle Catalog
  static const String vehicles = '/vehicles';

  // Dispatch Schedules Endpoints
  static const String dispatchSchedules = '/dispatch-schedules';
  static String dispatchScheduleDetail(int id) => '/dispatch-schedules/$id';
}
