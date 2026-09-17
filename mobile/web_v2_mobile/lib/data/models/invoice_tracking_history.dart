class InvoiceTrackingHistoryItem {
  final int id;
  final String action;
  final String actionLabel;
  final int? userId;
  final String? username;
  final String? userFullName;
  final Map<String, dynamic>? details;
  final String createdAt;

  InvoiceTrackingHistoryItem({
    required this.id,
    required this.action,
    required this.actionLabel,
    this.userId,
    this.username,
    this.userFullName,
    this.details,
    required this.createdAt,
  });

  factory InvoiceTrackingHistoryItem.fromJson(Map<String, dynamic> json) {
    return InvoiceTrackingHistoryItem(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id'].toString()) ?? 0,
      action: json['action'] ?? '',
      actionLabel: json['action_label'] ?? json['actionLabel'] ?? json['action'] ?? '',
      userId: json['user_id'],
      username: json['username'],
      userFullName: json['user_full_name'],
      details: json['details'] is Map ? Map<String, dynamic>.from(json['details']) : null,
      createdAt: json['created_at'] ?? '',
    );
  }
}
