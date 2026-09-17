class InsuranceImage {
  final int id;
  final int insuranceId;
  final String filename;
  final String? originalFilename;
  final String? filePath;
  final int? fileSize;
  final String? mimeType;
  final String? createdAt;

  InsuranceImage({
    required this.id,
    required this.insuranceId,
    required this.filename,
    this.originalFilename,
    this.filePath,
    this.fileSize,
    this.mimeType,
    this.createdAt,
  });

  factory InsuranceImage.fromJson(Map<String, dynamic> json) {
    return InsuranceImage(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id'].toString()) ?? 0,
      insuranceId: json['insurance_id'] is int
          ? json['insurance_id']
          : int.tryParse(json['insurance_id']?.toString() ?? '') ?? 0,
      filename: json['filename'] ?? '',
      originalFilename: json['original_filename'],
      filePath: json['file_path'],
      fileSize: json['file_size'] != null ? int.tryParse(json['file_size'].toString()) : null,
      mimeType: json['mime_type'],
      createdAt: json['created_at'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'insurance_id': insuranceId,
      'filename': filename,
      'original_filename': originalFilename,
      'file_path': filePath,
      'file_size': fileSize,
      'mime_type': mimeType,
      'created_at': createdAt,
    };
  }
}

class InsuranceRecord {
  final int id;
  final int vehicleId;
  final String? plateNumber;
  final String? driverName;
  final String purchaseDate;
  final String expiryDate;
  final String? notes;
  final String status; // 'active' | 'expired' | 'superseded' | 'deleted'
  final int? createdBy;
  final String? createdAt;
  final String? updatedAt;
  final List<InsuranceImage> images;

  InsuranceRecord({
    required this.id,
    required this.vehicleId,
    this.plateNumber,
    this.driverName,
    required this.purchaseDate,
    required this.expiryDate,
    this.notes,
    required this.status,
    this.createdBy,
    this.createdAt,
    this.updatedAt,
    this.images = const [],
  });

  factory InsuranceRecord.fromJson(Map<String, dynamic> json) {
    var imgList = <InsuranceImage>[];
    if (json['images'] != null && json['images'] is List) {
      imgList = (json['images'] as List)
          .map((img) => InsuranceImage.fromJson(img as Map<String, dynamic>))
          .toList();
    }

    return InsuranceRecord(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id'].toString()) ?? 0,
      vehicleId: json['vehicle_id'] is int
          ? json['vehicle_id']
          : int.tryParse(json['vehicle_id']?.toString() ?? '') ?? 0,
      plateNumber: json['plate_number'],
      driverName: json['driver_name'],
      purchaseDate: json['purchase_date'] ?? '',
      expiryDate: json['expiry_date'] ?? '',
      notes: json['notes'],
      status: json['status'] ?? 'active',
      createdBy: json['created_by'] != null ? int.tryParse(json['created_by'].toString()) : null,
      createdAt: json['created_at'],
      updatedAt: json['updated_at'],
      images: imgList,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'vehicle_id': vehicleId,
      'plate_number': plateNumber,
      'driver_name': driverName,
      'purchase_date': purchaseDate,
      'expiry_date': expiryDate,
      'notes': notes,
      'status': status,
      'created_by': createdBy,
      'created_at': createdAt,
      'updated_at': updatedAt,
      'images': images.map((i) => i.toJson()).toList(),
    };
  }

  /// Tính số ngày còn lại đến hạn
  int get daysLeft {
    try {
      final expiry = DateTime.parse(expiryDate).toLocal();
      final today = DateTime.now();
      final todayMidnight = DateTime(today.year, today.month, today.day);
      final expiryMidnight = DateTime(expiry.year, expiry.month, expiry.day);
      return expiryMidnight.difference(todayMidnight).inDays;
    } catch (_) {
      return 0;
    }
  }

  /// Trạng thái hiệu lực hiển thị: 'con_han', 'sap_het_han', 'het_han', 'superseded'
  String get displayStatus {
    if (status == 'superseded') return 'superseded';
    if (status == 'deleted') return 'deleted';
    final days = daysLeft;
    if (days < 0) return 'het_han';
    if (days <= 30) return 'sap_het_han';
    return 'con_han';
  }
}

class InsuranceListResult {
  final List<InsuranceRecord> insurances;
  final int total;
  final int page;
  final int limit;

  InsuranceListResult({
    required this.insurances,
    required this.total,
    required this.page,
    required this.limit,
  });

  factory InsuranceListResult.fromJson(Map<String, dynamic> json) {
    final list = (json['insurances'] as List? ?? [])
        .map((e) => InsuranceRecord.fromJson(e as Map<String, dynamic>))
        .toList();

    return InsuranceListResult(
      insurances: list,
      total: json['total'] ?? 0,
      page: json['page'] ?? 1,
      limit: json['limit'] ?? 20,
    );
  }
}
