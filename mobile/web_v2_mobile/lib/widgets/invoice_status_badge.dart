import 'package:flutter/material.dart';
import '../../core/constants/app_colors.dart';

class InvoiceStatusBadge extends StatelessWidget {
  final String status;

  const InvoiceStatusBadge({super.key, required this.status});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    Color bg;
    Color text;
    String label;

    switch (status) {
      case 'created':
        bg = isDark ? AppColors.neutral800 : AppColors.neutral100;
        text = isDark ? AppColors.neutral300 : AppColors.neutral700;
        label = 'Tạo mới';
        break;
      case 'pending_review':
        bg = isDark ? const Color(0xFF451A03) : const Color(0xFFFEF3C7);
        text = isDark ? const Color(0xFFFBBF24) : const Color(0xFFD97706);
        label = 'Chờ duyệt';
        break;
      case 'completed':
        bg = isDark ? const Color(0xFF064E3B) : const Color(0xFFD1FAE5);
        text = isDark ? const Color(0xFF34D399) : const Color(0xFF059669);
        label = 'Hoàn thành';
        break;
      case 'request_supplement':
        bg = isDark ? AppColors.red900.withValues(alpha: 0.4) : AppColors.red50;
        text = isDark ? AppColors.red400 : AppColors.red600;
        label = 'Yêu cầu bổ sung';
        break;
      default:
        bg = isDark ? AppColors.neutral800 : AppColors.neutral100;
        text = isDark ? AppColors.neutral400 : AppColors.neutral600;
        label = status;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(
          color: text.withValues(alpha: 0.25),
          width: 0.8,
        ),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: text,
        ),
      ),
    );
  }
}
