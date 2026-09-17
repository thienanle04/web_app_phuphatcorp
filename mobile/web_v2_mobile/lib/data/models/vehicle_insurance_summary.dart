class VehicleInsuranceSummary {
  final int vehicleId;
  final String plateNumber;
  final String? driverName;
  final int? latestInsuranceId;
  final String? latestPurchaseDate;
  final String? latestExpiryDate;
  final String? latestStatus;
  final int insuranceCount;

  VehicleInsuranceSummary({
    required this.vehicleId,
    required this.plateNumber,
    this.driverName,
    this.latestInsuranceId,
    this.latestPurchaseDate,
    this.latestExpiryDate,
    this.latestStatus,
    this.insuranceCount = 0,
  });

  factory VehicleInsuranceSummary.fromJson(Map<String, dynamic> json) {
    return VehicleInsuranceSummary(
      vehicleId: json['vehicle_id'] is int
          ? json['vehicle_id']
          : int.tryParse(json['vehicle_id']?.toString() ?? '') ?? 0,
      plateNumber: json['plate_number'] ?? '',
      driverName: json['driver_name'],
      latestInsuranceId: json['latest_insurance_id'] != null
          ? int.tryParse(json['latest_insurance_id'].toString())
          : null,
      latestPurchaseDate: json['latest_purchase_date'],
      latestExpiryDate: json['latest_expiry_date'],
      latestStatus: json['latest_status'],
      insuranceCount: json['insurance_count'] != null
          ? (json['insurance_count'] is int
              ? json['insurance_count']
              : int.tryParse(json['insurance_count'].toString()) ?? 0)
          : 0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'vehicle_id': vehicleId,
      'plate_number': plateNumber,
      'driver_name': driverName,
      'latest_insurance_id': latestInsuranceId,
      'latest_purchase_date': latestPurchaseDate,
      'latest_expiry_date': latestExpiryDate,
      'latest_status': latestStatus,
      'insurance_count': insuranceCount,
    };
  }

  /// Tính số ngày còn lại đến hạn bảo hiểm
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

  /// Trạng thái bảo hiểm hiển thị: 'con_han', 'sap_het_han', 'het_han', 'chua_co_bao_hiem'
  String get displayStatus {
    if (latestExpiryDate == null || latestExpiryDate!.isEmpty) {
      return 'chua_co_bao_hiem';
    }
    final days = daysLeft;
    if (days == null) return 'chua_co_bao_hiem';
    if (days < 0) return 'het_han';
    if (days <= 30) return 'sap_het_han';
    return 'con_han';
  }
}

class VehicleInsuranceSummaryResult {
  final List<VehicleInsuranceSummary> vehicles;
  final int total;
  final int page;
  final int limit;

  VehicleInsuranceSummaryResult({
    required this.vehicles,
    required this.total,
    required this.page,
    required this.limit,
  });

  factory VehicleInsuranceSummaryResult.fromJson(Map<String, dynamic> json) {
    final list = (json['vehicles'] as List? ?? [])
        .map((e) => VehicleInsuranceSummary.fromJson(e as Map<String, dynamic>))
        .toList();

    return VehicleInsuranceSummaryResult(
      vehicles: list,
      total: json['total'] ?? (list.isNotEmpty ? (json['vehicles']?[0]?['total_count'] ?? list.length) : 0),
      page: json['page'] ?? 1,
      limit: json['limit'] ?? 20,
    );
  }
}
