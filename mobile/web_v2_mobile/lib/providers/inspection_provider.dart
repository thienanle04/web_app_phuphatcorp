import 'package:flutter/foundation.dart';
import 'package:image_picker/image_picker.dart';
import '../data/models/inspection_record.dart';
import '../data/models/vehicle_inspection_summary.dart';
import '../data/models/vehicle_option.dart';
import '../data/services/inspection_service.dart';

class InspectionProvider extends ChangeNotifier {
  final InspectionService _service;

  // Summary List State (Main Screen)
  List<VehicleInspectionSummary> _summaries = [];
  int _total = 0;
  int _currentPage = 1;
  static const int pageSize = 20;

  String _search = '';
  String _statusFilter = 'all'; // 'all', 'con_han', 'sap_het_han', 'het_han', 'chua_dang_kiem'
  bool _isLoading = false;
  bool _isRefreshing = false;
  String? _errorMessage;

  // Selected Detail State
  InspectionRecord? _selectedInspection;
  bool _isLoadingDetail = false;

  // Vehicle History State
  List<InspectionRecord> _vehicleHistory = [];
  bool _isLoadingHistory = false;

  // Vehicles for Form Picker
  List<VehicleOption> _vehicles = [];
  bool _isLoadingVehicles = false;

  // Action / Mutation submitting state
  bool _isSubmitting = false;

  InspectionProvider({InspectionService? service})
      : _service = service ?? InspectionService();

  // Getters
  List<VehicleInspectionSummary> get summaries => _summaries;
  int get total => _total;
  int get currentPage => _currentPage;
  int get totalPages => (_total / pageSize).ceil();
  String get search => _search;
  String get statusFilter => _statusFilter;
  bool get isLoading => _isLoading;
  bool get isRefreshing => _isRefreshing;
  String? get errorMessage => _errorMessage;

  InspectionRecord? get selectedInspection => _selectedInspection;
  bool get isLoadingDetail => _isLoadingDetail;

  List<InspectionRecord> get vehicleHistory => _vehicleHistory;
  bool get isLoadingHistory => _isLoadingHistory;

  List<VehicleOption> get vehicles => _vehicles;
  bool get isLoadingVehicles => _isLoadingVehicles;

  bool get isSubmitting => _isSubmitting;

  void setSearch(String query) {
    if (_search != query) {
      _search = query;
      _currentPage = 1;
      fetchSummary();
    }
  }

  void setStatusFilter(String status) {
    if (_statusFilter != status) {
      _statusFilter = status;
      _currentPage = 1;
      fetchSummary();
    }
  }

  void setPage(int page) {
    if (_currentPage != page) {
      _currentPage = page;
      fetchSummary();
    }
  }

  /// Lấy danh sách tóm tắt đăng kiểm theo xe
  Future<void> fetchSummary({bool isRefresh = false}) async {
    if (isRefresh) {
      _isRefreshing = true;
    } else {
      _isLoading = true;
    }
    _errorMessage = null;
    notifyListeners();

    try {
      // Backend status filter mapping: 'active', 'expired', 'expiring', 'no_inspection', 'all'
      String? beStatus;
      if (_statusFilter == 'con_han') beStatus = 'active';
      if (_statusFilter == 'sap_het_han') beStatus = 'expiring';
      if (_statusFilter == 'het_han') beStatus = 'expired';
      if (_statusFilter == 'chua_dang_kiem') beStatus = 'no_inspection';

      final result = await _service.fetchSummary(
        search: _search,
        status: beStatus,
        page: _currentPage,
        limit: pageSize,
      );

      _summaries = result.vehicles;
      _total = result.total;
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
    } finally {
      _isLoading = false;
      _isRefreshing = false;
      notifyListeners();
    }
  }

  /// Lấy chi tiết 1 bản ghi đăng kiểm
  Future<void> fetchInspectionDetail(int id) async {
    _isLoadingDetail = true;
    notifyListeners();

    try {
      final record = await _service.fetchById(id);
      _selectedInspection = record;
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
    } finally {
      _isLoadingDetail = false;
      notifyListeners();
    }
  }

  /// Lấy toàn bộ lịch sử đăng kiểm của 1 xe
  Future<void> fetchVehicleHistory(int vehicleId) async {
    _isLoadingHistory = true;
    _vehicleHistory = [];
    notifyListeners();

    try {
      final result = await _service.fetchInspections(
        vehicleId: vehicleId,
        status: 'all',
        limit: 100,
      );
      _vehicleHistory = result.inspections;
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
    } finally {
      _isLoadingHistory = false;
      notifyListeners();
    }
  }

  /// Lấy danh sách xe cho dropdown picker
  Future<void> fetchVehicles() async {
    if (_vehicles.isNotEmpty) return;
    _isLoadingVehicles = true;
    notifyListeners();

    try {
      _vehicles = await _service.fetchActiveVehicles();
    } catch (_) {
      _vehicles = [];
    } finally {
      _isLoadingVehicles = false;
      notifyListeners();
    }
  }

  /// Tạo mới đăng kiểm kèm upload ảnh
  Future<InspectionRecord> createInspection({
    required int vehicleId,
    required String inspectionDate,
    required String expiryDate,
    String? notes,
    List<XFile> images = const [],
  }) async {
    _isSubmitting = true;
    notifyListeners();

    try {
      final record = await _service.create(
        vehicleId: vehicleId,
        inspectionDate: inspectionDate,
        expiryDate: expiryDate,
        notes: notes,
      );

      // Upload images sequentially if any
      if (images.isNotEmpty) {
        for (final img in images) {
          final bytes = await img.readAsBytes();
          await _service.uploadImage(
            inspectionId: record.id,
            fileBytes: bytes,
            filename: img.name.isNotEmpty ? img.name : 'inspection_${DateTime.now().millisecondsSinceEpoch}.jpg',
          );
        }
      }

      // Refresh list
      await fetchSummary(isRefresh: true);
      _isSubmitting = false;
      notifyListeners();
      return record;
    } catch (e) {
      _isSubmitting = false;
      notifyListeners();
      rethrow;
    }
  }

  /// Cập nhật đăng kiểm
  Future<InspectionRecord> updateInspection({
    required int id,
    String? inspectionDate,
    String? expiryDate,
    String? notes,
    List<XFile> newImages = const [],
  }) async {
    _isSubmitting = true;
    notifyListeners();

    try {
      final record = await _service.update(
        id: id,
        inspectionDate: inspectionDate,
        expiryDate: expiryDate,
        notes: notes,
      );

      // Upload new images if any
      if (newImages.isNotEmpty) {
        for (final img in newImages) {
          final bytes = await img.readAsBytes();
          await _service.uploadImage(
            inspectionId: id,
            fileBytes: bytes,
            filename: img.name.isNotEmpty ? img.name : 'inspection_${DateTime.now().millisecondsSinceEpoch}.jpg',
          );
        }
      }

      // Reload detail & list
      await fetchInspectionDetail(id);
      await fetchSummary(isRefresh: true);
      _isSubmitting = false;
      notifyListeners();
      return record;
    } catch (e) {
      _isSubmitting = false;
      notifyListeners();
      rethrow;
    }
  }

  /// Xóa mềm đăng kiểm
  Future<void> deleteInspection(int id) async {
    _isSubmitting = true;
    notifyListeners();

    try {
      await _service.remove(id);
      _selectedInspection = null;
      await fetchSummary(isRefresh: true);
      _isSubmitting = false;
      notifyListeners();
    } catch (e) {
      _isSubmitting = false;
      notifyListeners();
      rethrow;
    }
  }

  /// Xóa 1 ảnh trong bản ghi đăng kiểm
  Future<void> deleteImage(int inspectionId, int imageId) async {
    try {
      await _service.deleteImage(inspectionId: inspectionId, imageId: imageId);
      // Refresh current detail
      await fetchInspectionDetail(inspectionId);
    } catch (e) {
      rethrow;
    }
  }

  void clearSelectedInspection() {
    _selectedInspection = null;
    _vehicleHistory = [];
    notifyListeners();
  }
}
