import 'package:dio/dio.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_endpoints.dart';
import '../models/inspection_record.dart';
import '../models/vehicle_inspection_summary.dart';
import '../models/vehicle_option.dart';

class InspectionService {
  final ApiClient _apiClient;

  InspectionService({ApiClient? apiClient}) : _apiClient = apiClient ?? ApiClient();

  /// Lấy danh sách tóm tắt đăng kiểm theo từng xe
  Future<VehicleSummaryResult> fetchSummary({
    String? search,
    String? status,
    int page = 1,
    int limit = 20,
  }) async {
    try {
      final queryParams = <String, dynamic>{
        'page': page,
        'limit': limit,
      };
      if (search != null && search.trim().isNotEmpty) {
        queryParams['search'] = search.trim();
      }
      if (status != null && status.isNotEmpty && status != 'all') {
        queryParams['status'] = status;
      }

      final response = await _apiClient.dio.get(
        ApiEndpoints.vehicleInspectionsSummary,
        queryParameters: queryParams,
      );

      final dynamic body = response.data;
      if (body is Map && body['success'] == true && body['data'] != null) {
        return VehicleSummaryResult.fromJson(body['data']);
      } else if (body is Map && body['message'] != null) {
        throw Exception(body['message']);
      } else {
        throw Exception('Không thể tải tóm tắt đăng kiểm xe.');
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
      throw Exception('Lỗi kết nối máy chủ khi lấy danh sách đăng kiểm.');
    } catch (e) {
      throw Exception(e.toString().replaceAll('Exception: ', ''));
    }
  }

  /// Lấy danh sách đăng kiểm (theo xe hoặc theo trạng thái)
  Future<InspectionListResult> fetchInspections({
    int? vehicleId,
    String? status,
    String? search,
    int page = 1,
    int limit = 20,
  }) async {
    try {
      final queryParams = <String, dynamic>{
        'page': page,
        'limit': limit,
      };
      if (vehicleId != null) queryParams['vehicle_id'] = vehicleId;
      if (status != null && status.isNotEmpty) queryParams['status'] = status;
      if (search != null && search.trim().isNotEmpty) queryParams['search'] = search.trim();

      final response = await _apiClient.dio.get(
        ApiEndpoints.vehicleInspections,
        queryParameters: queryParams,
      );

      final dynamic body = response.data;
      if (body is Map && body['success'] == true && body['data'] != null) {
        return InspectionListResult.fromJson(body['data']);
      } else if (body is Map && body['message'] != null) {
        throw Exception(body['message']);
      } else {
        throw Exception('Không thể tải danh sách đăng kiểm.');
      }
    } on DioException catch (e) {
      if (e.response?.data is Map) {
        final msg = e.response?.data['message'] ?? e.response?.data['error'];
        if (msg != null) throw Exception(msg.toString());
      }
      throw Exception('Lỗi tải danh sách đăng kiểm.');
    } catch (e) {
      throw Exception(e.toString().replaceAll('Exception: ', ''));
    }
  }

  /// Lấy chi tiết 1 bản ghi đăng kiểm kèm hình ảnh
  Future<InspectionRecord> fetchById(int id) async {
    try {
      final response = await _apiClient.dio.get(
        ApiEndpoints.vehicleInspectionDetail(id),
      );

      final dynamic body = response.data;
      if (body is Map && body['success'] == true && body['data'] != null) {
        return InspectionRecord.fromJson(body['data']);
      } else if (body is Map && body['message'] != null) {
        throw Exception(body['message']);
      } else {
        throw Exception('Không tìm thấy bản ghi đăng kiểm.');
      }
    } on DioException catch (e) {
      if (e.response?.data is Map) {
        final msg = e.response?.data['message'] ?? e.response?.data['error'];
        if (msg != null) throw Exception(msg.toString());
      }
      throw Exception('Lỗi tải chi tiết đăng kiểm.');
    } catch (e) {
      throw Exception(e.toString().replaceAll('Exception: ', ''));
    }
  }

  /// Tạo mới bản ghi đăng kiểm
  Future<InspectionRecord> create({
    required int vehicleId,
    required String inspectionDate,
    required String expiryDate,
    String? notes,
  }) async {
    try {
      final response = await _apiClient.dio.post(
        ApiEndpoints.vehicleInspections,
        data: {
          'vehicle_id': vehicleId,
          'inspection_date': inspectionDate,
          'expiry_date': expiryDate,
          if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
        },
      );

      final dynamic body = response.data;
      if (body is Map && body['success'] == true && body['data'] != null) {
        return InspectionRecord.fromJson(body['data']);
      } else if (body is Map && body['message'] != null) {
        throw Exception(body['message']);
      } else {
        throw Exception('Không thể tạo mới đăng kiểm.');
      }
    } on DioException catch (e) {
      if (e.response?.data is Map) {
        final msg = e.response?.data['message'] ?? e.response?.data['error'];
        if (msg != null) throw Exception(msg.toString());
      }
      throw Exception('Lỗi tạo mới đăng kiểm.');
    } catch (e) {
      throw Exception(e.toString().replaceAll('Exception: ', ''));
    }
  }

  /// Cập nhật bản ghi đăng kiểm
  Future<InspectionRecord> update({
    required int id,
    String? inspectionDate,
    String? expiryDate,
    String? notes,
  }) async {
    try {
      final payload = <String, dynamic>{};
      if (inspectionDate != null) payload['inspection_date'] = inspectionDate;
      if (expiryDate != null) payload['expiry_date'] = expiryDate;
      if (notes != null) payload['notes'] = notes.trim();

      final response = await _apiClient.dio.put(
        ApiEndpoints.vehicleInspectionDetail(id),
        data: payload,
      );

      final dynamic body = response.data;
      if (body is Map && body['success'] == true && body['data'] != null) {
        return InspectionRecord.fromJson(body['data']);
      } else if (body is Map && body['message'] != null) {
        throw Exception(body['message']);
      } else {
        throw Exception('Không thể cập nhật đăng kiểm.');
      }
    } on DioException catch (e) {
      if (e.response?.data is Map) {
        final msg = e.response?.data['message'] ?? e.response?.data['error'];
        if (msg != null) throw Exception(msg.toString());
      }
      throw Exception('Lỗi cập nhật đăng kiểm.');
    } catch (e) {
      throw Exception(e.toString().replaceAll('Exception: ', ''));
    }
  }

  /// Xóa mềm đăng kiểm
  Future<void> remove(int id) async {
    try {
      final response = await _apiClient.dio.delete(
        ApiEndpoints.vehicleInspectionDetail(id),
      );

      final dynamic body = response.data;
      if (body is Map && body['success'] != true) {
        throw Exception(body['message'] ?? 'Xóa đăng kiểm thất bại.');
      }
    } on DioException catch (e) {
      if (e.response?.data is Map) {
        final msg = e.response?.data['message'] ?? e.response?.data['error'];
        if (msg != null) throw Exception(msg.toString());
      }
      throw Exception('Lỗi xóa đăng kiểm.');
    } catch (e) {
      throw Exception(e.toString().replaceAll('Exception: ', ''));
    }
  }

  /// Upload 1 file hình ảnh cho bản ghi đăng kiểm (multipart/form-data)
  Future<InspectionImage> uploadImage({
    required int inspectionId,
    required List<int> fileBytes,
    required String filename,
  }) async {
    try {
      final formData = FormData.fromMap({
        'image': MultipartFile.fromBytes(
          fileBytes,
          filename: filename,
        ),
      });

      final response = await _apiClient.dio.post(
        ApiEndpoints.vehicleInspectionImages(inspectionId),
        data: formData,
      );

      final dynamic body = response.data;
      if (body is Map && body['success'] == true && body['data'] != null) {
        return InspectionImage.fromJson(body['data']);
      } else if (body is Map && body['message'] != null) {
        throw Exception(body['message']);
      } else {
        throw Exception('Tải lên ảnh đăng kiểm thất bại.');
      }
    } on DioException catch (e) {
      if (e.response?.data is Map) {
        final msg = e.response?.data['message'] ?? e.response?.data['error'];
        if (msg != null) throw Exception(msg.toString());
      }
      throw Exception('Lỗi tải lên ảnh đăng kiểm.');
    } catch (e) {
      throw Exception(e.toString().replaceAll('Exception: ', ''));
    }
  }

  /// Xóa 1 ảnh đăng kiểm
  Future<void> deleteImage({
    required int inspectionId,
    required int imageId,
  }) async {
    try {
      final response = await _apiClient.dio.delete(
        ApiEndpoints.vehicleInspectionImageDelete(inspectionId, imageId),
      );

      final dynamic body = response.data;
      if (body is Map && body['success'] != true) {
        throw Exception(body['message'] ?? 'Xóa ảnh thất bại.');
      }
    } on DioException catch (e) {
      if (e.response?.data is Map) {
        final msg = e.response?.data['message'] ?? e.response?.data['error'];
        if (msg != null) throw Exception(msg.toString());
      }
      throw Exception('Lỗi xóa ảnh.');
    } catch (e) {
      throw Exception(e.toString().replaceAll('Exception: ', ''));
    }
  }

  /// Lấy danh sách các xe đang hoạt động (dùng cho picker form)
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
