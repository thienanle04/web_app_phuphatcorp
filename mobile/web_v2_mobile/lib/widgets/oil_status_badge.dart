import 'package:flutter/material.dart';
import '../core/constants/app_colors.dart';

class OilStatusBadge extends StatelessWidget {
  final String status;

  const OilStatusBadge({
    super.key,
    required this.status,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    Color bg;
    Color text;
    String label;

    switch (status) {
      case 'overdue':
        bg = isDark ? AppColors.red900.withValues(alpha: 0.4) : AppColors.red50;
        text = isDark ? AppColors.red400 : AppColors.red600;
        label = 'Quá hạn';
        break;
      case 'due_soon':
        bg = isDark ? const Color(0xFF451A03) : const Color(0xFFFEF3C7);
        text = isDark ? const Color(0xFFFBBF24) : const Color(0xFFD97706);
        label = 'Sắp đến hạn';
        break;
      case 'ok':
        bg = isDark ? const Color(0xFF064E3B) : const Color(0xFFD1FAE5);
        text = isDark ? const Color(0xFF34D399) : const Color(0xFF059669);
        label = 'Bình thường';
        break;
      case 'no_data':
      default:
        bg = isDark ? AppColors.neutral800 : AppColors.neutral100;
        text = isDark ? AppColors.neutral400 : AppColors.neutral500;
        label = 'Chưa có ODO';
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3.5),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(
          color: text.withValues(alpha: 0.3),
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
