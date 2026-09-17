import 'package:flutter/foundation.dart';
import '../data/models/oil_change_due_vehicle.dart';
import '../data/models/oil_change_record.dart';
import '../data/models/vehicle_option.dart';
import '../data/services/oil_change_service.dart';

class OilChangeProvider extends ChangeNotifier {
  final OilChangeService _service;

  // Tab 1: Due Vehicles State
  List<OilChangeDueVehicle> _allDueVehicles = [];
  String _dueSearch = '';
  String _dueStatusFilter = 'all'; // 'all', 'overdue', 'due_soon', 'ok', 'no_data'
  bool _isLoadingDue = false;
  bool _isRefreshingDue = false;

  // Tab 2: History Records State
  List<OilChangeRecord> _historyRecords = [];
  int _historyTotal = 0;
  int _historyPage = 1;
  static const int historyPageSize = 20;
  int? _historyVehicleId;
  bool _isLoadingHistory = false;
  bool _isRefreshingHistory = false;

  // Selected Record Detail
  OilChangeRecord? _selectedRecord;
  bool _isLoadingDetail = false;

  // Active vehicles for picker
  List<VehicleOption> _vehicles = [];
  bool _isLoadingVehicles = false;

  // Action submitting state
  bool _isSubmitting = false;
  String? _errorMessage;

  OilChangeProvider({OilChangeService? service})
      : _service = service ?? OilChangeService();

  // Getters - Due Vehicles
  List<OilChangeDueVehicle> get allDueVehicles => _allDueVehicles;
  String get dueSearch => _dueSearch;
  String get dueStatusFilter => _dueStatusFilter;
  bool get isLoadingDue => _isLoadingDue;
  bool get isRefreshingDue => _isRefreshingDue;

  /// Lọc xe theo từ khóa tìm kiếm và trạng thái cảnh báo ở client side
  List<OilChangeDueVehicle> get filteredDueVehicles {
    return _allDueVehicles.where((v) {
      // Search match
      final query = _dueSearch.trim().toLowerCase();
      final matchSearch = query.isEmpty ||
          v.plateNumber.toLowerCase().contains(query) ||
          (v.driverName != null && v.driverName!.toLowerCase().contains(query));

      // Status filter match
      final matchStatus = _dueStatusFilter == 'all' || v.oilStatus == _dueStatusFilter;

      return matchSearch && matchStatus;
    }).toList();
  }

  // Getters - History
  List<OilChangeRecord> get historyRecords => _historyRecords;
  int get historyTotal => _historyTotal;
  int get historyPage => _historyPage;
  int get historyTotalPages => (_historyTotal / historyPageSize).ceil();
  int? get historyVehicleId => _historyVehicleId;
  bool get isLoadingHistory => _isLoadingHistory;
  bool get isRefreshingHistory => _isRefreshingHistory;

  // Getters - Shared / Detail
  OilChangeRecord? get selectedRecord => _selectedRecord;
  bool get isLoadingDetail => _isLoadingDetail;
  List<VehicleOption> get vehicles => _vehicles;
  bool get isLoadingVehicles => _isLoadingVehicles;
  bool get isSubmitting => _isSubmitting;
  String? get errorMessage => _errorMessage;

  // Setters - Due filters
  void setDueSearch(String query) {
    _dueSearch = query;
    notifyListeners();
  }

  void setDueStatusFilter(String status) {
    _dueStatusFilter = status;
    notifyListeners();
  }

  // Setters - History filters
  void setHistoryVehicleId(int? vehicleId) {
    if (_historyVehicleId != vehicleId) {
      _historyVehicleId = vehicleId;
      _historyPage = 1;
      fetchHistory();
    }
  }

  void setHistoryPage(int page) {
    if (_historyPage != page) {
      _historyPage = page;
      fetchHistory();
    }
  }

  /// Lấy danh sách xe cần thay nhớt
  Future<void> fetchDueVehicles({bool isRefresh = false}) async {
    if (isRefresh) {
      _isRefreshingDue = true;
    } else {
      _isLoadingDue = true;
    }
    _errorMessage = null;
    notifyListeners();

    try {
      _allDueVehicles = await _service.fetchDueVehicles();
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
    } finally {
      _isLoadingDue = false;
      _isRefreshingDue = false;
      notifyListeners();
    }
  }

  /// Lấy danh sách lịch sử thay nhớt
  Future<void> fetchHistory({bool isRefresh = false}) async {
    if (isRefresh) {
      _isRefreshingHistory = true;
    } else {
      _isLoadingHistory = true;
    }
    _errorMessage = null;
    notifyListeners();

    try {
      final result = await _service.fetchHistory(
        vehicleId: _historyVehicleId,
        page: _historyPage,
        limit: historyPageSize,
      );

      _historyRecords = result.records;
      _historyTotal = result.total;
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
    } finally {
      _isLoadingHistory = false;
      _isRefreshingHistory = false;
      notifyListeners();
    }
  }

  /// Lấy chi tiết 1 bản ghi thay nhớt
  Future<void> fetchRecordDetail(int id) async {
    _isLoadingDetail = true;
    notifyListeners();

    try {
      _selectedRecord = await _service.fetchById(id);
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
    } finally {
      _isLoadingDetail = false;
      notifyListeners();
    }
  }

  /// Lấy danh sách xe active cho picker
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

  /// Tạo mới bản ghi thay nhớt
  Future<OilChangeRecord> createOilChange({
    required int vehicleId,
    required String changeDate,
    required double odometerAt,
    String? oilType,
    String? notes,
  }) async {
    _isSubmitting = true;
    notifyListeners();

    try {
      final record = await _service.create(
        vehicleId: vehicleId,
        changeDate: changeDate,
        odometerAt: odometerAt,
        oilType: oilType,
        notes: notes,
      );

      // Refresh both due list and history
      await Future.wait([
        fetchDueVehicles(isRefresh: true),
        fetchHistory(isRefresh: true),
      ]);

      _isSubmitting = false;
      notifyListeners();
      return record;
    } catch (e) {
      _isSubmitting = false;
      notifyListeners();
      rethrow;
    }
  }

  /// Cập nhật bản ghi thay nhớt
  Future<OilChangeRecord> updateOilChange({
    required int id,
    String? changeDate,
    double? odometerAt,
    String? oilType,
    String? notes,
  }) async {
    _isSubmitting = true;
    notifyListeners();

    try {
      final record = await _service.update(
        id: id,
        changeDate: changeDate,
        odometerAt: odometerAt,
        oilType: oilType,
        notes: notes,
      );

      _selectedRecord = record;

      // Refresh both due list and history
      await Future.wait([
        fetchDueVehicles(isRefresh: true),
        fetchHistory(isRefresh: true),
      ]);

      _isSubmitting = false;
      notifyListeners();
      return record;
    } catch (e) {
      _isSubmitting = false;
      notifyListeners();
      rethrow;
    }
  }

  /// Xóa mềm bản ghi thay nhớt
  Future<void> deleteOilChange(int id) async {
    _isSubmitting = true;
    notifyListeners();

    try {
      await _service.remove(id);
      _selectedRecord = null;

      // Refresh both lists
      await Future.wait([
        fetchDueVehicles(isRefresh: true),
        fetchHistory(isRefresh: true),
      ]);

      _isSubmitting = false;
      notifyListeners();
    } catch (e) {
      _isSubmitting = false;
      notifyListeners();
      rethrow;
    }
  }

  /// Cập nhật định mức km thay nhớt của xe
  Future<void> updateInterval({
    required int vehicleId,
    required int intervalKm,
  }) async {
    _isSubmitting = true;
    notifyListeners();

    try {
      await _service.updateInterval(
        vehicleId: vehicleId,
        intervalKm: intervalKm,
      );

      // Refresh due list
      await fetchDueVehicles(isRefresh: true);

      _isSubmitting = false;
      notifyListeners();
    } catch (e) {
      _isSubmitting = false;
      notifyListeners();
      rethrow;
    }
  }
}
