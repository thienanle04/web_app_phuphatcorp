import 'package:flutter/material.dart';
import '../core/constants/app_colors.dart';

class InspectionStatusBadge extends StatelessWidget {
  final String status;
  final int? daysLeft;

  const InspectionStatusBadge({
    super.key,
    required this.status,
    this.daysLeft,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    Color bg;
    Color text;
    String label;

    switch (status) {
      case 'con_han':
      case 'active':
        bg = isDark ? const Color(0xFF064E3B) : const Color(0xFFD1FAE5);
        text = isDark ? const Color(0xFF34D399) : const Color(0xFF059669);
        label = 'Còn hạn';
        if (daysLeft != null && daysLeft! > 0) {
          label = 'Còn $daysLeft ngày';
        }
        break;
      case 'sap_het_han':
      case 'expiring':
        bg = isDark ? const Color(0xFF451A03) : const Color(0xFFFEF3C7);
        text = isDark ? const Color(0xFFFBBF24) : const Color(0xFFD97706);
        label = daysLeft != null && daysLeft! >= 0
            ? 'Còn $daysLeft ngày'
            : 'Sắp hết hạn';
        break;
      case 'het_han':
      case 'expired':
        bg = isDark ? AppColors.red900.withValues(alpha: 0.4) : AppColors.red50;
        text = isDark ? AppColors.red400 : AppColors.red600;
        label = daysLeft != null && daysLeft! < 0
            ? 'Quá hạn ${-daysLeft!} ngày'
            : 'Hết hạn';
        break;
      case 'chua_dang_kiem':
      case 'no_inspection':
        bg = isDark ? AppColors.neutral800 : AppColors.neutral100;
        text = isDark ? AppColors.neutral400 : AppColors.neutral500;
        label = 'Chưa ĐK';
        break;
      case 'superseded':
        bg = isDark ? AppColors.neutral800 : AppColors.neutral100;
        text = isDark ? AppColors.neutral400 : AppColors.neutral500;
        label = 'Đã thay thế';
        break;
      default:
        bg = isDark ? AppColors.neutral800 : AppColors.neutral100;
        text = isDark ? AppColors.neutral400 : AppColors.neutral600;
        label = status;
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
