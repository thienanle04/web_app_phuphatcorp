class VehicleOption {
  final int id;
  final String plateNumber;
  final String? driverName;
  final String? vehicleType;
  final String? status;

  VehicleOption({
    required this.id,
    required this.plateNumber,
    this.driverName,
    this.vehicleType,
    this.status,
  });

  factory VehicleOption.fromJson(Map<String, dynamic> json) {
    return VehicleOption(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id'].toString()) ?? 0,
      plateNumber: json['plate_number'] ?? json['bien_so'] ?? '',
      driverName: json['driver_name'] ?? json['tai_xe'],
      vehicleType: json['vehicle_type'] ?? json['loai_xe'],
      status: json['status'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'plate_number': plateNumber,
      'driver_name': driverName,
      'vehicle_type': vehicleType,
      'status': status,
    };
  }
}
