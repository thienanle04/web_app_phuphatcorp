class UserModel {
  final int id;
  final String email;
  final String username;
  final String fullName;
  final String? role;
  final int? roleId;
  final String? roleName;
  final bool? isActive;
  final List<String>? permissions;
  final String? createdAt;

  UserModel({
    required this.id,
    required this.email,
    required this.username,
    required this.fullName,
    this.role,
    this.roleId,
    this.roleName,
    this.isActive,
    this.permissions,
    this.createdAt,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id'].toString()) ?? 0,
      email: json['email'] ?? '',
      username: json['username'] ?? '',
      fullName: json['full_name'] ?? json['fullName'] ?? '',
      role: json['role'],
      roleId: json['role_id'] != null ? (json['role_id'] is int ? json['role_id'] : int.tryParse(json['role_id'].toString())) : null,
      roleName: json['role_name'],
      isActive: json['is_active'],
      permissions: json['permissions'] != null
          ? List<String>.from(json['permissions'].map((x) => x.toString()))
          : null,
      createdAt: json['created_at'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'username': username,
      'full_name': fullName,
      'role': role,
      'role_id': roleId,
      'role_name': roleName,
      'is_active': isActive,
      'permissions': permissions,
      'created_at': createdAt,
    };
  }
}
