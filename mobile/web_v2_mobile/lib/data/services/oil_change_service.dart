import 'package:dio/dio.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_endpoints.dart';
import '../models/oil_change_due_vehicle.dart';
import '../models/oil_change_record.dart';
import '../models/vehicle_option.dart';

class OilChangeService {
  final ApiClient _apiClient;

  OilChangeService({ApiClient? apiClient}) : _apiClient = apiClient ?? ApiClient();

  /// Lấy danh sách xe kèm tính toán hạn thay nhớt (Due vehicles)
  Future<List<OilChangeDueVehicle>> fetchDueVehicles() async {
    try {
      final response = await _apiClient.dio.get(ApiEndpoints.vehicleOilChangesDue);

      final dynamic body = response.data;
      if (body is Map && body['success'] == true && body['data'] != null) {
        final data = body['data'];
        List rawList = [];
        if (data is Map && data['vehicles'] is List) {
          rawList = data['vehicles'];
        } else if (data is List) {
          rawList = data;
        }
        return rawList.map((e) => OilChangeDueVehicle.fromJson(e as Map<String, dynamic>)).toList();
      } else if (body is Map && body['message'] != null) {
        throw Exception(body['message']);
      } else {
        throw Exception('Không thể tải danh sách xe cần thay nhớt.');
      }
    } on DioException catch (e) {
      if (e.response?.data is Map) {
        final msg = e.response?.data['message'] ?? e.response?.data['error'];
        if (msg != null) throw Exception(msg.toString());
      }
      if (e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.sendTimeout ||
          e.type == DioExceptionType.receiveTimeout) {
        throw Exception('Hết thời gian chờ kết nối máy chủ (Timeout). Vui lòng thử lại.');
      }
      throw Exception('Lỗi kết nối máy chủ khi lấy danh sách xe thay nhớt.');
    } catch (e) {
      throw Exception(e.toString().replaceAll('Exception: ', ''));
    }
  }

  /// Lấy danh sách lịch sử thay nhớt (toàn hệ thống hoặc theo xe)
  Future<OilChangeListResult> fetchHistory({
    int? vehicleId,
    int page = 1,
    int limit = 20,
  }) async {
    try {
      final queryParams = <String, dynamic>{
        'page': page,
        'limit': limit,
      };
      if (vehicleId != null) queryParams['vehicle_id'] = vehicleId;

      final response = await _apiClient.dio.get(
        ApiEndpoints.vehicleOilChanges,
        queryParameters: queryParams,
      );

      final dynamic body = response.data;
      if (body is Map && body['success'] == true && body['data'] != null) {
        return OilChangeListResult.fromJson(body['data']);
      } else if (body is Map && body['message'] != null) {
        throw Exception(body['message']);
      } else {
        throw Exception('Không thể tải lịch sử thay nhớt.');
      }
    } on DioException catch (e) {
      if (e.response?.data is Map) {
        final msg = e.response?.data['message'] ?? e.response?.data['error'];
        if (msg != null) throw Exception(msg.toString());
      }
      throw Exception('Lỗi tải lịch sử thay nhớt.');
    } catch (e) {
      throw Exception(e.toString().replaceAll('Exception: ', ''));
    }
  }

  /// Lấy chi tiết 1 lần thay nhớt
  Future<OilChangeRecord> fetchById(int id) async {
    try {
      final response = await _apiClient.dio.get(
        ApiEndpoints.vehicleOilChangeDetail(id),
      );

      final dynamic body = response.data;
      if (body is Map && body['success'] == true && body['data'] != null) {
        return OilChangeRecord.fromJson(body['data']);
      } else if (body is Map && body['message'] != null) {
        throw Exception(body['message']);
      } else {
        throw Exception('Không tìm thấy bản ghi thay nhớt.');
      }
    } on DioException catch (e) {
      if (e.response?.data is Map) {
        final msg = e.response?.data['message'] ?? e.response?.data['error'];
        if (msg != null) throw Exception(msg.toString());
      }
      throw Exception('Lỗi tải chi tiết thay nhớt.');
    } catch (e) {
      throw Exception(e.toString().replaceAll('Exception: ', ''));
    }
  }

  /// Tạo mới bản ghi thay nhớt
  Future<OilChangeRecord> create({
    required int vehicleId,
    required String changeDate,
    required double odometerAt,
    String? oilType,
    String? notes,
  }) async {
    try {
      final response = await _apiClient.dio.post(
        ApiEndpoints.vehicleOilChanges,
        data: {
          'vehicle_id': vehicleId,
          'change_date': changeDate,
          'odometer_at': odometerAt,
          if (oilType != null && oilType.trim().isNotEmpty) 'oil_type': oilType.trim(),
          if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
        },
      );

      final dynamic body = response.data;
      if (body is Map && body['success'] == true && body['data'] != null) {
        return OilChangeRecord.fromJson(body['data']);
      } else if (body is Map && body['message'] != null) {
        throw Exception(body['message']);
      } else {
        throw Exception('Không thể tạo mới bản ghi thay nhớt.');
      }
    } on DioException catch (e) {
      if (e.response?.data is Map) {
        final msg = e.response?.data['message'] ?? e.response?.data['error'];
        if (msg != null) throw Exception(msg.toString());
      }
      throw Exception('Lỗi tạo mới thay nhớt.');
    } catch (e) {
      throw Exception(e.toString().replaceAll('Exception: ', ''));
    }
  }

  /// Cập nhật bản ghi thay nhớt
  Future<OilChangeRecord> update({
    required int id,
    String? changeDate,
    double? odometerAt,
    String? oilType,
    String? notes,
  }) async {
    try {
      final payload = <String, dynamic>{};
      if (changeDate != null) payload['change_date'] = changeDate;
      if (odometerAt != null) payload['odometer_at'] = odometerAt;
      if (oilType != null) payload['oil_type'] = oilType.trim();
      if (notes != null) payload['notes'] = notes.trim();

      final response = await _apiClient.dio.put(
        ApiEndpoints.vehicleOilChangeDetail(id),
        data: payload,
      );

      final dynamic body = response.data;
      if (body is Map && body['success'] == true && body['data'] != null) {
        return OilChangeRecord.fromJson(body['data']);
      } else if (body is Map && body['message'] != null) {
        throw Exception(body['message']);
      } else {
        throw Exception('Không thể cập nhật thay nhớt.');
      }
    } on DioException catch (e) {
      if (e.response?.data is Map) {
        final msg = e.response?.data['message'] ?? e.response?.data['error'];
        if (msg != null) throw Exception(msg.toString());
      }
      throw Exception('Lỗi cập nhật thay nhớt.');
    } catch (e) {
      throw Exception(e.toString().replaceAll('Exception: ', ''));
    }
  }

  /// Xóa mềm bản ghi thay nhớt
  Future<void> remove(int id) async {
    try {
      final response = await _apiClient.dio.delete(
        ApiEndpoints.vehicleOilChangeDetail(id),
      );

      final dynamic body = response.data;
      if (body is Map && body['success'] != true) {
        throw Exception(body['message'] ?? 'Xóa thay nhớt thất bại.');
      }
    } on DioException catch (e) {
      if (e.response?.data is Map) {
        final msg = e.response?.data['message'] ?? e.response?.data['error'];
        if (msg != null) throw Exception(msg.toString());
      }
      throw Exception('Lỗi xóa thay nhớt.');
    } catch (e) {
      throw Exception(e.toString().replaceAll('Exception: ', ''));
    }
  }

  /// Cập nhật định mức km thay nhớt của xe
  Future<void> updateInterval({
    required int vehicleId,
    required int intervalKm,
  }) async {
    try {
      final response = await _apiClient.dio.put(
        ApiEndpoints.vehicleOilInterval(vehicleId),
        data: {
          'oil_change_interval_km': intervalKm,
        },
      );

      final dynamic body = response.data;
      if (body is Map && body['success'] != true) {
        throw Exception(body['message'] ?? 'Cập nhật định mức thất bại.');
      }
    } on DioException catch (e) {
      if (e.response?.data is Map) {
        final msg = e.response?.data['message'] ?? e.response?.data['error'];
        if (msg != null) throw Exception(msg.toString());
      }
      throw Exception('Lỗi cập nhật định mức thay nhớt.');
    } catch (e) {
      throw Exception(e.toString().replaceAll('Exception: ', ''));
    }
  }

  /// Lấy danh sách xe đang hoạt động cho picker
  Future<List<VehicleOption>> fetchActiveVehicles() async {
    try {
      final response = await _apiClient.dio.get(
        ApiEndpoints.vehicles,
        queryParameters: {'limit': 100, 'status': 'active'},
      );

      final dynamic body = response.data;
      if (body is Map && body['success'] == true && body['data'] != null) {
        final data = body['data'];
        List rawList = [];
        if (data is Map && data['vehicles'] is List) {
          rawList = data['vehicles'];
        } else if (data is List) {
          rawList = data;
        }
        return rawList.map((e) => VehicleOption.fromJson(e as Map<String, dynamic>)).toList();
      }
      return [];
    } catch (_) {
      return [];
    }
  }
}
