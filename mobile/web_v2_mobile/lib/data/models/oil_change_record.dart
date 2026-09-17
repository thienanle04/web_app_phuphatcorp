class OilChangeRecord {
  final int id;
  final int vehicleId;
  final String? plateNumber;
  final String? driverName;
  final String changeDate;
  final double odometerAt;
  final String? oilType;
  final String? notes;
  final String status; // 'active' | 'deleted'
  final int? createdBy;
  final String? createdAt;
  final String? updatedAt;

  OilChangeRecord({
    required this.id,
    required this.vehicleId,
    this.plateNumber,
    this.driverName,
    required this.changeDate,
    required this.odometerAt,
    this.oilType,
    this.notes,
    required this.status,
    this.createdBy,
    this.createdAt,
    this.updatedAt,
  });

  factory OilChangeRecord.fromJson(Map<String, dynamic> json) {
    return OilChangeRecord(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id'].toString()) ?? 0,
      vehicleId: json['vehicle_id'] is int
          ? json['vehicle_id']
          : int.tryParse(json['vehicle_id']?.toString() ?? '') ?? 0,
      plateNumber: json['plate_number'],
      driverName: json['driver_name'],
      changeDate: json['change_date'] ?? '',
      odometerAt: json['odometer_at'] != null
          ? (json['odometer_at'] is num
              ? (json['odometer_at'] as num).toDouble()
              : double.tryParse(json['odometer_at'].toString()) ?? 0.0)
          : 0.0,
      oilType: json['oil_type'],
      notes: json['notes'],
      status: json['status'] ?? 'active',
      createdBy: json['created_by'] != null ? int.tryParse(json['created_by'].toString()) : null,
      createdAt: json['created_at'],
      updatedAt: json['updated_at'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'vehicle_id': vehicleId,
      'plate_number': plateNumber,
      'driver_name': driverName,
      'change_date': changeDate,
      'odometer_at': odometerAt,
      'oil_type': oilType,
      'notes': notes,
      'status': status,
      'created_by': createdBy,
      'created_at': createdAt,
      'updated_at': updatedAt,
    };
  }
}

class OilChangeListResult {
  final List<OilChangeRecord> records;
  final int total;
  final int page;
  final int limit;

  OilChangeListResult({
    required this.records,
    required this.total,
    required this.page,
    required this.limit,
  });

  factory OilChangeListResult.fromJson(Map<String, dynamic> json) {
    final list = (json['records'] as List? ?? json['oil_changes'] as List? ?? [])
        .map((e) => OilChangeRecord.fromJson(e as Map<String, dynamic>))
        .toList();

    return OilChangeListResult(
      records: list,
      total: json['total'] ?? 0,
      page: json['page'] ?? 1,
      limit: json['limit'] ?? 20,
    );
  }
}
