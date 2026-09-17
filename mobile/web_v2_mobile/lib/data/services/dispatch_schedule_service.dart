import 'package:dio/dio.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_endpoints.dart';
import '../models/dispatch_schedule.dart';
import '../models/vehicle_option.dart';

class DispatchScheduleService {
  final ApiClient _apiClient;

  DispatchScheduleService({ApiClient? apiClient}) : _apiClient = apiClient ?? ApiClient();

  /// Lấy danh sách lịch điều phối trong ngày (chia làm 3 nhóm: xe_nho, xe_lon, tuyen_ngoai)
  Future<DispatchScheduleGroupResult> fetchByDate(String date) async {
    try {
      final response = await _apiClient.dio.get(
        ApiEndpoints.dispatchSchedules,
        queryParameters: {'date': date},
      );

      final dynamic body = response.data;
      if (body is Map && body['success'] == true && body['data'] != null) {
        return DispatchScheduleGroupResult.fromJson(body['data']);
      } else if (body is Map && body['message'] != null) {
        throw Exception(body['message']);
      } else {
        throw Exception('Không thể tải lịch điều phối xe.');
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
      throw Exception('Lỗi kết nối máy chủ khi lấy lịch điều phối.');
    } catch (e) {
      throw Exception(e.toString().replaceAll('Exception: ', ''));
    }
  }

  /// Tạo chuyến xe mới
  Future<DispatchScheduleItem> create({
    required String ngay,
    required String loaiTuyen,
    required String loaiXe,
    required String xeType,
    required String bienSo,
    String? taiXe,
    int? vehicleId,
    int? driverId,
    required String diemNhan,
    String? tan,
    String? can,
    String? ghiChu,
  }) async {
    try {
      final response = await _apiClient.dio.post(
        ApiEndpoints.dispatchSchedules,
        data: {
          'ngay': ngay,
          'loai_tuyen': loaiTuyen,
          'loai_xe': loaiXe,
          'xe_type': xeType,
          'bien_so': bienSo.trim(),
          if (taiXe != null && taiXe.trim().isNotEmpty) 'tai_xe': taiXe.trim(),
          ?vehicleId: vehicleId,
          ?driverId: driverId,
          'diem_nhan': diemNhan.trim(),
          if (tan != null && tan.trim().isNotEmpty) 'tan': tan.trim(),
          if (can != null && can.trim().isNotEmpty) 'can': can.trim(),
          if (ghiChu != null && ghiChu.trim().isNotEmpty) 'ghi_chu': ghiChu.trim(),
        },
      );

      final dynamic body = response.data;
      if (body is Map && body['success'] == true && body['data'] != null) {
        return DispatchScheduleItem.fromJson(body['data']);
      } else if (body is Map && body['message'] != null) {
        throw Exception(body['message']);
      } else {
        throw Exception('Không thể tạo mới chuyến xe.');
      }
    } on DioException catch (e) {
      if (e.response?.data is Map) {
        final msg = e.response?.data['message'] ?? e.response?.data['error'];
        if (msg != null) throw Exception(msg.toString());
      }
      throw Exception('Lỗi tạo mới chuyến xe.');
    } catch (e) {
      throw Exception(e.toString().replaceAll('Exception: ', ''));
    }
  }

  /// Cập nhật thông tin chuyến xe
  Future<DispatchScheduleItem> update({
    required int id,
    required String diemNhan,
    String? tan,
    String? can,
    String? ghiChu,
  }) async {
    try {
      final response = await _apiClient.dio.put(
        ApiEndpoints.dispatchScheduleDetail(id),
        data: {
          'diem_nhan': diemNhan.trim(),
          if (tan != null) 'tan': tan.trim(),
          if (can != null) 'can': can.trim(),
          if (ghiChu != null) 'ghi_chu': ghiChu.trim(),
        },
      );

      final dynamic body = response.data;
      if (body is Map && body['success'] == true && body['data'] != null) {
        return DispatchScheduleItem.fromJson(body['data']);
      } else if (body is Map && body['message'] != null) {
        throw Exception(body['message']);
      } else {
        throw Exception('Không thể cập nhật chuyến xe.');
      }
    } on DioException catch (e) {
      if (e.response?.data is Map) {
        final msg = e.response?.data['message'] ?? e.response?.data['error'];
        if (msg != null) throw Exception(msg.toString());
      }
      throw Exception('Lỗi cập nhật chuyến xe.');
    } catch (e) {
      throw Exception(e.toString().replaceAll('Exception: ', ''));
    }
  }

  /// Xóa chuyến xe
  Future<void> remove(int id) async {
    try {
      final response = await _apiClient.dio.delete(
        ApiEndpoints.dispatchScheduleDetail(id),
      );

      final dynamic body = response.data;
      if (body is Map && body['success'] != true) {
        throw Exception(body['message'] ?? 'Xóa chuyến xe thất bại.');
      }
    } on DioException catch (e) {
      if (e.response?.data is Map) {
        final msg = e.response?.data['message'] ?? e.response?.data['error'];
        if (msg != null) throw Exception(msg.toString());
      }
      throw Exception('Lỗi xóa chuyến xe.');
    } catch (e) {
      throw Exception(e.toString().replaceAll('Exception: ', ''));
    }
  }

  /// Lấy danh sách xe đang hoạt động cho dropdown chọn xe
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
