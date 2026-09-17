class VehicleInspectionSummary {
  final int vehicleId;
  final String plateNumber;
  final String? driverName;
  final int? latestInspectionId;
  final String? latestInspectionDate;
  final String? latestExpiryDate;
  final String? latestStatus;
  final int inspectionCount;

  VehicleInspectionSummary({
    required this.vehicleId,
    required this.plateNumber,
    this.driverName,
    this.latestInspectionId,
    this.latestInspectionDate,
    this.latestExpiryDate,
    this.latestStatus,
    this.inspectionCount = 0,
  });

  factory VehicleInspectionSummary.fromJson(Map<String, dynamic> json) {
    return VehicleInspectionSummary(
      vehicleId: json['vehicle_id'] is int
          ? json['vehicle_id']
          : int.tryParse(json['vehicle_id']?.toString() ?? '') ?? 0,
      plateNumber: json['plate_number'] ?? '',
      driverName: json['driver_name'],
      latestInspectionId: json['latest_inspection_id'] != null
          ? int.tryParse(json['latest_inspection_id'].toString())
          : null,
      latestInspectionDate: json['latest_inspection_date'],
      latestExpiryDate: json['latest_expiry_date'],
      latestStatus: json['latest_status'],
      inspectionCount: json['inspection_count'] != null
          ? (json['inspection_count'] is int
              ? json['inspection_count']
              : int.tryParse(json['inspection_count'].toString()) ?? 0)
          : 0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'vehicle_id': vehicleId,
      'plate_number': plateNumber,
      'driver_name': driverName,
      'latest_inspection_id': latestInspectionId,
      'latest_inspection_date': latestInspectionDate,
      'latest_expiry_date': latestExpiryDate,
      'latest_status': latestStatus,
      'inspection_count': inspectionCount,
    };
  }

  /// Tính số ngày còn lại đến hạn đăng kiểm
  int? get daysLeft {
    if (latestExpiryDate == null || latestExpiryDate!.isEmpty) return null;
    try {
      final expiry = DateTime.parse(latestExpiryDate!).toLocal();
      final today = DateTime.now();
      final todayMidnight = DateTime(today.year, today.month, today.day);
      final expiryMidnight = DateTime(expiry.year, expiry.month, expiry.day);
      return expiryMidnight.difference(todayMidnight).inDays;
    } catch (_) {
      return null;
    }
  }

  /// Trạng thái đăng kiểm hiển thị: 'con_han', 'sap_het_han', 'het_han', 'chua_dang_kiem'
  String get displayStatus {
    if (latestExpiryDate == null || latestExpiryDate!.isEmpty) {
      return 'chua_dang_kiem';
    }
    final days = daysLeft;
    if (days == null) return 'chua_dang_kiem';
    if (days < 0) return 'het_han';
    if (days <= 30) return 'sap_het_han';
    return 'con_han';
  }
}

class VehicleSummaryResult {
  final List<VehicleInspectionSummary> vehicles;
  final int total;
  final int page;
  final int limit;

  VehicleSummaryResult({
    required this.vehicles,
    required this.total,
    required this.page,
    required this.limit,
  });

  factory VehicleSummaryResult.fromJson(Map<String, dynamic> json) {
    final list = (json['vehicles'] as List? ?? [])
        .map((e) => VehicleInspectionSummary.fromJson(e as Map<String, dynamic>))
        .toList();

    return VehicleSummaryResult(
      vehicles: list,
      total: json['total'] ?? (list.isNotEmpty ? (json['vehicles']?[0]?['total_count'] ?? list.length) : 0),
      page: json['page'] ?? 1,
      limit: json['limit'] ?? 20,
    );
  }
}
