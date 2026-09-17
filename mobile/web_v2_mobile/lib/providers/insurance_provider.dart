import 'package:flutter/foundation.dart';
import 'package:image_picker/image_picker.dart';
import '../data/models/insurance_record.dart';
import '../data/models/vehicle_insurance_summary.dart';
import '../data/models/vehicle_option.dart';
import '../data/services/insurance_service.dart';

class InsuranceProvider extends ChangeNotifier {
  final InsuranceService _service;

  // Summary List State (Main Screen)
  List<VehicleInsuranceSummary> _summaries = [];
  int _total = 0;
  int _currentPage = 1;
  static const int pageSize = 20;

  String _search = '';
  String _statusFilter = 'all'; // 'all', 'con_han', 'sap_het_han', 'het_han', 'chua_co_bao_hiem'
  bool _isLoading = false;
  bool _isRefreshing = false;
  String? _errorMessage;

  // Selected Detail State
  InsuranceRecord? _selectedInsurance;
  bool _isLoadingDetail = false;

  // Vehicle History State
  List<InsuranceRecord> _vehicleHistory = [];
  bool _isLoadingHistory = false;

  // Company Vehicles for Form Picker
  List<VehicleOption> _vehicles = [];
  bool _isLoadingVehicles = false;

  // Action / Mutation submitting state
  bool _isSubmitting = false;

  InsuranceProvider({InsuranceService? service})
      : _service = service ?? InsuranceService();

  // Getters
  List<VehicleInsuranceSummary> get summaries => _summaries;
  int get total => _total;
  int get currentPage => _currentPage;
  int get totalPages => (_total / pageSize).ceil();
  String get search => _search;
  String get statusFilter => _statusFilter;
  bool get isLoading => _isLoading;
  bool get isRefreshing => _isRefreshing;
  String? get errorMessage => _errorMessage;

  InsuranceRecord? get selectedInsurance => _selectedInsurance;
  bool get isLoadingDetail => _isLoadingDetail;

  List<InsuranceRecord> get vehicleHistory => _vehicleHistory;
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

  /// Lấy danh sách tóm tắt bảo hiểm theo xe
  Future<void> fetchSummary({bool isRefresh = false}) async {
    if (isRefresh) {
      _isRefreshing = true;
    } else {
      _isLoading = true;
    }
    _errorMessage = null;
    notifyListeners();

    try {
      // Backend status filter mapping: 'active', 'expired', 'expiring', 'no_insurance', 'all'
      String? beStatus;
      if (_statusFilter == 'con_han') beStatus = 'active';
      if (_statusFilter == 'sap_het_han') beStatus = 'expiring';
      if (_statusFilter == 'het_han') beStatus = 'expired';
      if (_statusFilter == 'chua_co_bao_hiem') beStatus = 'no_insurance';

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

  /// Lấy chi tiết 1 bản ghi bảo hiểm
  Future<void> fetchInsuranceDetail(int id) async {
    _isLoadingDetail = true;
    notifyListeners();

    try {
      final record = await _service.fetchById(id);
      _selectedInsurance = record;
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
    } finally {
      _isLoadingDetail = false;
      notifyListeners();
    }
  }

  /// Lấy toàn bộ lịch sử bảo hiểm của 1 xe
  Future<void> fetchVehicleHistory(int vehicleId) async {
    _isLoadingHistory = true;
    _vehicleHistory = [];
    notifyListeners();

    try {
      final result = await _service.fetchInsurances(
        vehicleId: vehicleId,
        status: 'all',
        limit: 100,
      );
      _vehicleHistory = result.insurances;
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
    } finally {
      _isLoadingHistory = false;
      notifyListeners();
    }
  }

  /// Lấy danh sách xe nhà cho dropdown picker
  Future<void> fetchVehicles() async {
    if (_vehicles.isNotEmpty) return;
    _isLoadingVehicles = true;
    notifyListeners();

    try {
      _vehicles = await _service.fetchCompanyVehicles();
    } catch (_) {
      _vehicles = [];
    } finally {
      _isLoadingVehicles = false;
      notifyListeners();
    }
  }

  /// Tạo mới bảo hiểm kèm upload ảnh
  Future<InsuranceRecord> createInsurance({
    required int vehicleId,
    required String purchaseDate,
    required String expiryDate,
    String? notes,
    List<XFile> images = const [],
  }) async {
    _isSubmitting = true;
    notifyListeners();

    try {
      final record = await _service.create(
        vehicleId: vehicleId,
        purchaseDate: purchaseDate,
        expiryDate: expiryDate,
        notes: notes,
      );

      // Upload images sequentially if any
      if (images.isNotEmpty) {
        for (final img in images) {
          final bytes = await img.readAsBytes();
          await _service.uploadImage(
            insuranceId: record.id,
            fileBytes: bytes,
            filename: img.name.isNotEmpty ? img.name : 'insurance_${DateTime.now().millisecondsSinceEpoch}.jpg',
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

  /// Cập nhật bảo hiểm
  Future<InsuranceRecord> updateInsurance({
    required int id,
    String? purchaseDate,
    String? expiryDate,
    String? notes,
    List<XFile> newImages = const [],
  }) async {
    _isSubmitting = true;
    notifyListeners();

    try {
      final record = await _service.update(
        id: id,
        purchaseDate: purchaseDate,
        expiryDate: expiryDate,
        notes: notes,
      );

      // Upload new images if any
      if (newImages.isNotEmpty) {
        for (final img in newImages) {
          final bytes = await img.readAsBytes();
          await _service.uploadImage(
            insuranceId: id,
            fileBytes: bytes,
            filename: img.name.isNotEmpty ? img.name : 'insurance_${DateTime.now().millisecondsSinceEpoch}.jpg',
          );
        }
      }

      // Reload detail & list
      await fetchInsuranceDetail(id);
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

  /// Xóa mềm bảo hiểm
  Future<void> deleteInsurance(int id) async {
    _isSubmitting = true;
    notifyListeners();

    try {
      await _service.remove(id);
      _selectedInsurance = null;
      await fetchSummary(isRefresh: true);
      _isSubmitting = false;
      notifyListeners();
    } catch (e) {
      _isSubmitting = false;
      notifyListeners();
      rethrow;
    }
  }

  /// Xóa 1 ảnh trong bản ghi bảo hiểm
  Future<void> deleteImage(int insuranceId, int imageId) async {
    try {
      await _service.deleteImage(insuranceId: insuranceId, imageId: imageId);
      // Refresh current detail
      await fetchInsuranceDetail(insuranceId);
    } catch (e) {
      rethrow;
    }
  }

  void clearSelectedInsurance() {
    _selectedInsurance = null;
    _vehicleHistory = [];
    notifyListeners();
  }
}
