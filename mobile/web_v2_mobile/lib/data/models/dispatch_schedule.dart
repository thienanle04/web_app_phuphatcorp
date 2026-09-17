class DispatchScheduleItem {
  final int id;
  final String ngay;
  final String loaiTuyen; // 'Tuyến cố định' | 'Tuyến ngoài'
  final String loaiXe; // 'Xe lớn' | 'Xe nhỏ'
  final String xeType; // 'Xe nhà' | 'Xe ngoài'
  final String bienSo;
  final String? taiXe;
  final int? vehicleId;
  final int? driverId;
  final String diemNhan;
  final String? tan;
  final String? can;
  final String? ghiChu;
  final String invoiceStatus;
  final int? createdBy;
  final String? createdAt;
  final String? updatedAt;

  DispatchScheduleItem({
    required this.id,
    required this.ngay,
    required this.loaiTuyen,
    required this.loaiXe,
    required this.xeType,
    required this.bienSo,
    this.taiXe,
    this.vehicleId,
    this.driverId,
    required this.diemNhan,
    this.tan,
    this.can,
    this.ghiChu,
    this.invoiceStatus = 'created',
    this.createdBy,
    this.createdAt,
    this.updatedAt,
  });

  factory DispatchScheduleItem.fromJson(Map<String, dynamic> json) {
    return DispatchScheduleItem(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id'].toString()) ?? 0,
      ngay: json['ngay'] ?? '',
      loaiTuyen: json['loai_tuyen'] ?? 'Tuyến cố định',
      loaiXe: json['loai_xe'] ?? 'Xe nhỏ',
      xeType: json['xe_type'] ?? 'Xe nhà',
      bienSo: json['bien_so'] ?? '',
      taiXe: json['tai_xe'],
      vehicleId: json['vehicle_id'] != null ? int.tryParse(json['vehicle_id'].toString()) : null,
      driverId: json['driver_id'] != null ? int.tryParse(json['driver_id'].toString()) : null,
      diemNhan: json['diem_nhan'] ?? '',
      tan: json['tan']?.toString(),
      can: json['can']?.toString(),
      ghiChu: json['ghi_chu']?.toString(),
      invoiceStatus: json['invoice_status'] ?? 'created',
      createdBy: json['created_by'] != null ? int.tryParse(json['created_by'].toString()) : null,
      createdAt: json['created_at'],
      updatedAt: json['updated_at'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'ngay': ngay,
      'loai_tuyen': loaiTuyen,
      'loai_xe': loaiXe,
      'xe_type': xeType,
      'bien_so': bienSo,
      'tai_xe': taiXe,
      'vehicle_id': vehicleId,
      'driver_id': driverId,
      'diem_nhan': diemNhan,
      'tan': tan,
      'can': can,
      'ghi_chu': ghiChu,
      'invoice_status': invoiceStatus,
      'created_by': createdBy,
      'created_at': createdAt,
      'updated_at': updatedAt,
    };
  }
}

class DispatchScheduleGroupResult {
  final List<DispatchScheduleItem> xeNho;
  final List<DispatchScheduleItem> xeLon;
  final List<DispatchScheduleItem> tuyenNgoai;

  DispatchScheduleGroupResult({
    this.xeNho = const [],
    this.xeLon = const [],
    this.tuyenNgoai = const [],
  });

  int get totalTrips => xeNho.length + xeLon.length + tuyenNgoai.length;

  factory DispatchScheduleGroupResult.fromJson(Map<String, dynamic> json) {
    final xeNhoList = (json['xe_nho'] as List? ?? [])
        .map((e) => DispatchScheduleItem.fromJson(e as Map<String, dynamic>))
        .toList();

    final xeLonList = (json['xe_lon'] as List? ?? [])
        .map((e) => DispatchScheduleItem.fromJson(e as Map<String, dynamic>))
        .toList();

    final tuyenNgoaiList = (json['tuyen_ngoai'] as List? ?? [])
        .map((e) => DispatchScheduleItem.fromJson(e as Map<String, dynamic>))
        .toList();

    return DispatchScheduleGroupResult(
      xeNho: xeNhoList,
      xeLon: xeLonList,
      tuyenNgoai: tuyenNgoaiList,
    );
  }
}
