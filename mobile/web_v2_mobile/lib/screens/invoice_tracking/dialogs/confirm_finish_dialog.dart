import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';
import '../../../widgets/custom_button.dart';

class ConfirmFinishDialog extends StatelessWidget {
  final VoidCallback onConfirm;
  final bool isLoading;

  const ConfirmFinishDialog({
    super.key,
    required this.onConfirm,
    this.isLoading = false,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return AlertDialog(
      backgroundColor: isDark ? AppColors.neutral900 : AppColors.white,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      title: Row(
        children: [
          const Icon(Icons.check_circle_outline, color: Colors.green, size: 24),
          const SizedBox(width: 8),
          Text(
            'Xác nhận duyệt hoàn thành',
            style: TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.w600,
              color: isDark ? AppColors.neutral100 : AppColors.neutral900,
            ),
          ),
        ],
      ),
      content: Text(
        'Bạn có chắc chắn muốn xác nhận đã nhận đầy đủ và hợp lệ chứng từ cho chuyến xe này?',
        style: TextStyle(
          fontSize: 14,
          color: isDark ? AppColors.neutral300 : AppColors.neutral700,
        ),
      ),
      actions: [
        TextButton(
          onPressed: isLoading ? null : () => Navigator.of(context).pop(),
          child: const Text('Hủy'),
        ),
        SizedBox(
          width: 130,
          child: CustomButton(
            text: 'Hoàn thành',
            size: ButtonSize.sm,
            isLoading: isLoading,
            onPressed: onConfirm,
          ),
        ),
      ],
    );
  }
}
