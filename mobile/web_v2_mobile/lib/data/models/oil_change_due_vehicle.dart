class OilChangeDueVehicle {
  final int vehicleId;
  final String plateNumber;
  final String? driverName;
  final int intervalKm;
  final String? lastChangeDate;
  final double? lastOdometer;
  final double? currentKm;
  final double? kmSinceChange;
  final String oilStatus; // 'overdue' | 'due_soon' | 'ok' | 'no_data'

  OilChangeDueVehicle({
    required this.vehicleId,
    required this.plateNumber,
    this.driverName,
    required this.intervalKm,
    this.lastChangeDate,
    this.lastOdometer,
    this.currentKm,
    this.kmSinceChange,
    required this.oilStatus,
  });

  factory OilChangeDueVehicle.fromJson(Map<String, dynamic> json) {
    return OilChangeDueVehicle(
      vehicleId: json['vehicle_id'] is int
          ? json['vehicle_id']
          : int.tryParse(json['vehicle_id']?.toString() ?? '') ?? 0,
      plateNumber: json['plate_number'] ?? '',
      driverName: json['driver_name'],
      intervalKm: json['interval_km'] != null
          ? (json['interval_km'] is int
              ? json['interval_km']
              : int.tryParse(json['interval_km'].toString()) ?? 5000)
          : 5000,
      lastChangeDate: json['last_change_date'],
      lastOdometer: json['last_odometer'] != null
          ? (json['last_odometer'] is num
              ? (json['last_odometer'] as num).toDouble()
              : double.tryParse(json['last_odometer'].toString()))
          : null,
      currentKm: json['current_km'] != null
          ? (json['current_km'] is num
              ? (json['current_km'] as num).toDouble()
              : double.tryParse(json['current_km'].toString()))
          : null,
      kmSinceChange: json['km_since_change'] != null
          ? (json['km_since_change'] is num
              ? (json['km_since_change'] as num).toDouble()
              : double.tryParse(json['km_since_change'].toString()))
          : null,
      oilStatus: json['oil_status'] ?? 'no_data',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'vehicle_id': vehicleId,
      'plate_number': plateNumber,
      'driver_name': driverName,
      'interval_km': intervalKm,
      'last_change_date': lastChangeDate,
      'last_odometer': lastOdometer,
      'current_km': currentKm,
      'km_since_change': kmSinceChange,
      'oil_status': oilStatus,
    };
  }

  /// Tỷ lệ tiến độ đã đi so với định mức (0.0 đến 1.0)
  double get progressRatio {
    if (kmSinceChange == null || intervalKm <= 0) return 0.0;
    final ratio = kmSinceChange! / intervalKm;
    if (ratio < 0.0) return 0.0;
    if (ratio > 1.0) return 1.0;
    return ratio;
  }

  /// Số km còn lại trước khi đến hạn (nếu âm là đã quá hạn)
  double? get remainingKm {
    if (kmSinceChange == null) return null;
    return intervalKm - kmSinceChange!;
  }
}
