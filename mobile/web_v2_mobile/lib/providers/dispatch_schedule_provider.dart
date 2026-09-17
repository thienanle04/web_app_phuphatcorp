import 'package:flutter/foundation.dart';
import 'package:intl/intl.dart';
import '../data/models/dispatch_schedule.dart';
import '../data/models/vehicle_option.dart';
import '../data/services/dispatch_schedule_service.dart';

class DispatchScheduleProvider extends ChangeNotifier {
  final DispatchScheduleService _service;

  DateTime _selectedDate = DateTime.now();
  DispatchScheduleGroupResult _groupResult = DispatchScheduleGroupResult();
  bool _isLoading = false;
  bool _isRefreshing = false;
  String? _errorMessage;

  // Active vehicles for picker
  List<VehicleOption> _vehicles = [];
  bool _isLoadingVehicles = false;

  // Submitting state
  bool _isSubmitting = false;

  DispatchScheduleProvider({DispatchScheduleService? service})
      : _service = service ?? DispatchScheduleService();

  // Getters
  DateTime get selectedDate => _selectedDate;
  String get selectedDateStr => DateFormat('yyyy-MM-dd').format(_selectedDate);
  DispatchScheduleGroupResult get groupResult => _groupResult;
  List<DispatchScheduleItem> get xeNho => _groupResult.xeNho;
  List<DispatchScheduleItem> get xeLon => _groupResult.xeLon;
  List<DispatchScheduleItem> get tuyenNgoai => _groupResult.tuyenNgoai;
  int get totalTrips => _groupResult.totalTrips;

  bool get isLoading => _isLoading;
  bool get isRefreshing => _isRefreshing;
  String? get errorMessage => _errorMessage;

  List<VehicleOption> get vehicles => _vehicles;
  bool get isLoadingVehicles => _isLoadingVehicles;
  bool get isSubmitting => _isSubmitting;

  bool get isToday {
    final now = DateTime.now();
    return _selectedDate.year == now.year &&
        _selectedDate.month == now.month &&
        _selectedDate.day == now.day;
  }

  void setDate(DateTime date) {
    _selectedDate = date;
    fetchSchedules();
  }

  void prevDay() {
    _selectedDate = _selectedDate.subtract(const Duration(days: 1));
    fetchSchedules();
  }

  void nextDay() {
    _selectedDate = _selectedDate.add(const Duration(days: 1));
    fetchSchedules();
  }

  void today() {
    _selectedDate = DateTime.now();
    fetchSchedules();
  }

  /// Lấy lịch điều phối theo ngày đang chọn
  Future<void> fetchSchedules({bool isRefresh = false}) async {
    if (isRefresh) {
      _isRefreshing = true;
    } else {
      _isLoading = true;
    }
    _errorMessage = null;
    notifyListeners();

    try {
      _groupResult = await _service.fetchByDate(selectedDateStr);
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
    } finally {
      _isLoading = false;
      _isRefreshing = false;
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

  /// Tạo chuyến xe mới
  Future<DispatchScheduleItem> createSchedule({
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
    _isSubmitting = true;
    notifyListeners();

    try {
      final item = await _service.create(
        ngay: selectedDateStr,
        loaiTuyen: loaiTuyen,
        loaiXe: loaiXe,
        xeType: xeType,
        bienSo: bienSo,
        taiXe: taiXe,
        vehicleId: vehicleId,
        driverId: driverId,
        diemNhan: diemNhan,
        tan: tan,
        can: can,
        ghiChu: ghiChu,
      );

      // Refresh data
      await fetchSchedules(isRefresh: true);

      _isSubmitting = false;
      notifyListeners();
      return item;
    } catch (e) {
      _isSubmitting = false;
      notifyListeners();
      rethrow;
    }
  }

  /// Cập nhật chuyến xe
  Future<DispatchScheduleItem> updateSchedule({
    required int id,
    required String diemNhan,
    String? tan,
    String? can,
    String? ghiChu,
  }) async {
    _isSubmitting = true;
    notifyListeners();

    try {
      final item = await _service.update(
        id: id,
        diemNhan: diemNhan,
        tan: tan,
        can: can,
        ghiChu: ghiChu,
      );

      // Refresh data
      await fetchSchedules(isRefresh: true);

      _isSubmitting = false;
      notifyListeners();
      return item;
    } catch (e) {
      _isSubmitting = false;
      notifyListeners();
      rethrow;
    }
  }

  /// Xóa chuyến xe
  Future<void> deleteSchedule(int id) async {
    _isSubmitting = true;
    notifyListeners();

    try {
      await _service.remove(id);
      await fetchSchedules(isRefresh: true);
      _isSubmitting = false;
      notifyListeners();
    } catch (e) {
      _isSubmitting = false;
      notifyListeners();
      rethrow;
    }
  }
}
