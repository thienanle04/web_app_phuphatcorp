import 'package:dio/dio.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_endpoints.dart';
import '../models/invoice_tracking_history.dart';
import '../models/invoice_tracking_ticket.dart';

class InvoiceTrackingService {
  final ApiClient _apiClient;

  InvoiceTrackingService({ApiClient? apiClient}) : _apiClient = apiClient ?? ApiClient();

  Future<InvoiceTrackingListResponse> list({
    String? search,
    List<String>? status,
    int page = 1,
    int limit = 20,
    String? dateFrom,
    String? dateTo,
  }) async {
    try {
      final queryParams = <String, dynamic>{
        'page': page,
        'limit': limit,
      };
      if (search != null && search.trim().isNotEmpty) {
        queryParams['search'] = search.trim();
      }
      if (status != null && status.isNotEmpty) {
        queryParams['status'] = status.join(',');
      }
      if (dateFrom != null && dateFrom.isNotEmpty) {
        queryParams['date_from'] = dateFrom;
      }
      if (dateTo != null && dateTo.isNotEmpty) {
        queryParams['date_to'] = dateTo;
      }

      final response = await _apiClient.dio.get(
        ApiEndpoints.invoiceTracking,
        queryParameters: queryParams,
      );

      final dynamic body = response.data;
      if (body is Map && body['success'] == true && body['data'] != null) {
        return InvoiceTrackingListResponse.fromJson(body['data']);
      } else if (body is Map && body['message'] != null) {
        throw Exception(body['message']);
      } else {
        throw Exception('Không thể tải danh sách hóa đơn từ máy chủ.');
      }
    } on DioException catch (e) {
      if (e.response?.data is Map) {
        final msg = e.response?.data['message'] ?? e.response?.data['error'];
        if (msg != null) throw Exception(msg.toString());
      }
      if (e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.sendTimeout ||
          e.type == DioExceptionType.receiveTimeout) {
        throw Exception('Hết thời gian kết nối máy chủ (Timeout). Vui lòng thử lại.');
      }
      if (e.type == DioExceptionType.connectionError) {
        throw Exception('Không thể kết nối đến máy chủ API (${ApiEndpoints.baseUrl}). Vui lòng kiểm tra lại mạng.');
      }
      throw Exception('Lỗi kết nối máy chủ: ${e.message ?? e.toString()}');
    } catch (e) {
      throw Exception(e.toString().replaceAll('Exception: ', ''));
    }
  }

  Future<InvoiceTrackingTicket> getById(int id) async {
    try {
      final response = await _apiClient.dio.get(ApiEndpoints.invoiceTrackingDetail(id));
      final body = response.data;
      if (body['success'] == true && body['data'] != null) {
        return InvoiceTrackingTicket.fromJson(body['data']);
      } else {
        throw Exception(body['message'] ?? 'Không tìm thấy chuyến xe');
      }
    } on DioException catch (e) {
      if (e.response?.data is Map) {
        final msg = e.response?.data['message'];
        if (msg != null) throw Exception(msg);
      }
      throw Exception('Lỗi tải chi tiết chuyến xe.');
    }
  }

  Future<List<InvoiceTrackingHistoryItem>> getHistory(int id) async {
    try {
      final response = await _apiClient.dio.get(ApiEndpoints.invoiceTrackingHistory(id));
      final body = response.data;
      if (body['success'] == true && body['data'] is List) {
        return (body['data'] as List)
            .map((e) => InvoiceTrackingHistoryItem.fromJson(e as Map<String, dynamic>))
            .toList();
      }
      return [];
    } catch (_) {
      return [];
    }
  }

  Future<List<CopyableTicket>> fetchCopyableTickets(int id) async {
    try {
      final response = await _apiClient.dio.get(
        ApiEndpoints.invoiceTrackingCopyableTickets(id),
      );

      final dynamic body = response.data;
      if (body is Map && body['success'] == true && body['data'] is List) {
        return (body['data'] as List)
            .map((e) => CopyableTicket.fromJson(e as Map<String, dynamic>))
            .toList();
      }
      return [];
    } on DioException catch (e) {
      if (e.response?.data is Map) {
        final msg = e.response?.data['message'];
        if (msg != null) throw Exception(msg);
      }
      throw Exception('Không thể tải danh sách chuyến xe cùng ngày.');
    } catch (e) {
      throw Exception(e.toString().replaceAll('Exception: ', ''));
    }
  }

  Future<InvoiceTrackingTicket> copyDocuments({
    required int id,
    required int sourceTicketId,
    String? driverNote,
  }) async {
    try {
      final response = await _apiClient.dio.post(
        ApiEndpoints.invoiceTrackingCopyDocuments(id),
        data: {
          'source_ticket_id': sourceTicketId,
          if (driverNote != null && driverNote.trim().isNotEmpty)
            'driver_note': driverNote.trim(),
        },
      );

      final dynamic body = response.data;
      if (body is Map && body['success'] == true && body['data'] != null) {
        return InvoiceTrackingTicket.fromJson(body['data']);
      } else if (body is Map && body['message'] != null) {
        throw Exception(body['message']);
      } else {
        throw Exception('Sao chép chứng từ thất bại.');
      }
    } on DioException catch (e) {
      if (e.response?.data is Map) {
        final msg = e.response?.data['message'];
        if (msg != null) throw Exception(msg);
      }
      throw Exception('Lỗi sao chép chứng từ từ máy chủ.');
    } catch (e) {
      throw Exception(e.toString().replaceAll('Exception: ', ''));
    }
  }

  Future<InvoiceTrackingTicket> uploadDocuments({
    required int id,
    required List<DocumentFile> files,
    String? driverNote,
  }) async {
    try {
      final response = await _apiClient.dio.post(
        ApiEndpoints.invoiceTrackingDocuments(id),
        data: {
          'files': files.map((f) => f.toJson()).toList(),
          if (driverNote != null && driverNote.trim().isNotEmpty)
            'driver_note': driverNote.trim(),
        },
      );

      final body = response.data;
      if (body['success'] == true && body['data'] != null) {
        return InvoiceTrackingTicket.fromJson(body['data']);
      } else {
        throw Exception(body['message'] ?? 'Tải lên chứng từ thất bại');
      }
    } on DioException catch (e) {
      if (e.response?.data is Map) {
        final msg = e.response?.data['message'];
        if (msg != null) throw Exception(msg);
      }
      throw Exception('Lỗi tải lên chứng từ lên máy chủ.');
    }
  }

  Future<InvoiceTrackingTicket> review({
    required int id,
    required String action, // 'finish' | 'request_supplement'
    String? supplementNote,
  }) async {
    try {
      final response = await _apiClient.dio.put(
        ApiEndpoints.invoiceTrackingReview(id),
        data: {
          'action': action,
          if (supplementNote != null && supplementNote.trim().isNotEmpty)
            'supplement_note': supplementNote.trim(),
        },
      );

      final body = response.data;
      if (body['success'] == true && body['data'] != null) {
        return InvoiceTrackingTicket.fromJson(body['data']);
      } else {
        throw Exception(body['message'] ?? 'Duyệt chứng từ thất bại');
      }
    } on DioException catch (e) {
      if (e.response?.data is Map) {
        final msg = e.response?.data['message'];
        if (msg != null) throw Exception(msg);
      }
      throw Exception('Lỗi xử lý duyệt chứng từ.');
    }
  }
}
