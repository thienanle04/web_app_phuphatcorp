import 'package:dio/dio.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_endpoints.dart';
import '../models/insurance_record.dart';
import '../models/vehicle_insurance_summary.dart';
import '../models/vehicle_option.dart';

class InsuranceService {
  final ApiClient _apiClient;

  InsuranceService({ApiClient? apiClient}) : _apiClient = apiClient ?? ApiClient();

  /// Lấy danh sách tóm tắt bảo hiểm theo từng xe
  Future<VehicleInsuranceSummaryResult> fetchSummary({
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
        ApiEndpoints.vehicleInsurancesSummary,
        queryParameters: queryParams,
      );

      final dynamic body = response.data;
      if (body is Map && body['success'] == true && body['data'] != null) {
        return VehicleInsuranceSummaryResult.fromJson(body['data']);
      } else if (body is Map && body['message'] != null) {
        throw Exception(body['message']);
      } else {
        throw Exception('Không thể tải tóm tắt bảo hiểm xe.');
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
      throw Exception('Lỗi kết nối máy chủ khi lấy danh sách bảo hiểm.');
    } catch (e) {
      throw Exception(e.toString().replaceAll('Exception: ', ''));
    }
  }

  /// Lấy danh sách bảo hiểm (theo xe hoặc theo trạng thái)
  Future<InsuranceListResult> fetchInsurances({
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
        ApiEndpoints.vehicleInsurances,
        queryParameters: queryParams,
      );

      final dynamic body = response.data;
      if (body is Map && body['success'] == true && body['data'] != null) {
        return InsuranceListResult.fromJson(body['data']);
      } else if (body is Map && body['message'] != null) {
        throw Exception(body['message']);
      } else {
        throw Exception('Không thể tải danh sách bảo hiểm.');
      }
    } on DioException catch (e) {
      if (e.response?.data is Map) {
        final msg = e.response?.data['message'] ?? e.response?.data['error'];
        if (msg != null) throw Exception(msg.toString());
      }
      throw Exception('Lỗi tải danh sách bảo hiểm.');
    } catch (e) {
      throw Exception(e.toString().replaceAll('Exception: ', ''));
    }
  }

  /// Lấy chi tiết 1 bản ghi bảo hiểm kèm hình ảnh
  Future<InsuranceRecord> fetchById(int id) async {
    try {
      final response = await _apiClient.dio.get(
        ApiEndpoints.vehicleInsuranceDetail(id),
      );

      final dynamic body = response.data;
      if (body is Map && body['success'] == true && body['data'] != null) {
        return InsuranceRecord.fromJson(body['data']);
      } else if (body is Map && body['message'] != null) {
        throw Exception(body['message']);
      } else {
        throw Exception('Không tìm thấy bản ghi bảo hiểm.');
      }
    } on DioException catch (e) {
      if (e.response?.data is Map) {
        final msg = e.response?.data['message'] ?? e.response?.data['error'];
        if (msg != null) throw Exception(msg.toString());
      }
      throw Exception('Lỗi tải chi tiết bảo hiểm.');
    } catch (e) {
      throw Exception(e.toString().replaceAll('Exception: ', ''));
    }
  }

  /// Tạo mới bản ghi bảo hiểm
  Future<InsuranceRecord> create({
    required int vehicleId,
    required String purchaseDate,
    required String expiryDate,
    String? notes,
  }) async {
    try {
      final response = await _apiClient.dio.post(
        ApiEndpoints.vehicleInsurances,
        data: {
          'vehicle_id': vehicleId,
          'purchase_date': purchaseDate,
          'expiry_date': expiryDate,
          if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
        },
      );

      final dynamic body = response.data;
      if (body is Map && body['success'] == true && body['data'] != null) {
        return InsuranceRecord.fromJson(body['data']);
      } else if (body is Map && body['message'] != null) {
        throw Exception(body['message']);
      } else {
        throw Exception('Không thể tạo mới bảo hiểm.');
      }
    } on DioException catch (e) {
      if (e.response?.data is Map) {
        final msg = e.response?.data['message'] ?? e.response?.data['error'];
        if (msg != null) throw Exception(msg.toString());
      }
      throw Exception('Lỗi tạo mới bảo hiểm.');
    } catch (e) {
      throw Exception(e.toString().replaceAll('Exception: ', ''));
    }
  }

  /// Cập nhật bản ghi bảo hiểm
  Future<InsuranceRecord> update({
    required int id,
    String? purchaseDate,
    String? expiryDate,
    String? notes,
  }) async {
    try {
      final payload = <String, dynamic>{};
      if (purchaseDate != null) payload['purchase_date'] = purchaseDate;
      if (expiryDate != null) payload['expiry_date'] = expiryDate;
      if (notes != null) payload['notes'] = notes.trim();

      final response = await _apiClient.dio.put(
        ApiEndpoints.vehicleInsuranceDetail(id),
        data: payload,
      );

      final dynamic body = response.data;
      if (body is Map && body['success'] == true && body['data'] != null) {
        return InsuranceRecord.fromJson(body['data']);
      } else if (body is Map && body['message'] != null) {
        throw Exception(body['message']);
      } else {
        throw Exception('Không thể cập nhật bảo hiểm.');
      }
    } on DioException catch (e) {
      if (e.response?.data is Map) {
        final msg = e.response?.data['message'] ?? e.response?.data['error'];
        if (msg != null) throw Exception(msg.toString());
      }
      throw Exception('Lỗi cập nhật bảo hiểm.');
    } catch (e) {
      throw Exception(e.toString().replaceAll('Exception: ', ''));
    }
  }

  /// Xóa mềm bảo hiểm
  Future<void> remove(int id) async {
    try {
      final response = await _apiClient.dio.delete(
        ApiEndpoints.vehicleInsuranceDetail(id),
      );

      final dynamic body = response.data;
      if (body is Map && body['success'] != true) {
        throw Exception(body['message'] ?? 'Xóa bảo hiểm thất bại.');
      }
    } on DioException catch (e) {
      if (e.response?.data is Map) {
        final msg = e.response?.data['message'] ?? e.response?.data['error'];
        if (msg != null) throw Exception(msg.toString());
      }
      throw Exception('Lỗi xóa bảo hiểm.');
    } catch (e) {
      throw Exception(e.toString().replaceAll('Exception: ', ''));
    }
  }

  /// Upload 1 file hình ảnh cho bản ghi bảo hiểm (multipart/form-data)
  Future<InsuranceImage> uploadImage({
    required int insuranceId,
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
        ApiEndpoints.vehicleInsuranceImages(insuranceId),
        data: formData,
      );

      final dynamic body = response.data;
      if (body is Map && body['success'] == true && body['data'] != null) {
        return InsuranceImage.fromJson(body['data']);
      } else if (body is Map && body['message'] != null) {
        throw Exception(body['message']);
      } else {
        throw Exception('Tải lên ảnh bảo hiểm thất bại.');
      }
    } on DioException catch (e) {
      if (e.response?.data is Map) {
        final msg = e.response?.data['message'] ?? e.response?.data['error'];
        if (msg != null) throw Exception(msg.toString());
      }
      throw Exception('Lỗi tải lên ảnh bảo hiểm.');
    } catch (e) {
      throw Exception(e.toString().replaceAll('Exception: ', ''));
    }
  }

  /// Xóa 1 ảnh bảo hiểm
  Future<void> deleteImage({
    required int insuranceId,
    required int imageId,
  }) async {
    try {
      final response = await _apiClient.dio.delete(
        ApiEndpoints.vehicleInsuranceImageDelete(insuranceId, imageId),
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

  /// Lấy danh sách các xe "Xe nhà" đang hoạt động (bảo hiểm chỉ áp dụng cho xe nhà)
  Future<List<VehicleOption>> fetchCompanyVehicles() async {
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
        final all = rawList.map((e) => VehicleOption.fromJson(e as Map<String, dynamic>)).toList();
        // Filter to "Xe nhà" only (or all if vehicle_type not set)
        return all.where((v) => v.vehicleType == null || v.vehicleType == 'Xe nhà' || v.vehicleType == 'xe_nha').toList();
      }
      return [];
    } catch (_) {
      return [];
    }
  }
}
