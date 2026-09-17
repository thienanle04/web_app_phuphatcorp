import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';
import '../../../widgets/custom_button.dart';

class DeleteConfirmDialog extends StatelessWidget {
  final String title;
  final String content;
  final VoidCallback onConfirm;
  final bool isLoading;

  const DeleteConfirmDialog({
    super.key,
    this.title = 'Xác nhận xóa',
    required this.content,
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
          const Icon(Icons.warning_amber_rounded, color: AppColors.red600, size: 24),
          const SizedBox(width: 8),
          Text(
            title,
            style: TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.w600,
              color: isDark ? AppColors.neutral100 : AppColors.neutral900,
            ),
          ),
        ],
      ),
      content: Text(
        content,
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
          width: 100,
          child: CustomButton(
            text: 'Xóa',
            variant: ButtonVariant.danger,
            size: ButtonSize.sm,
            isLoading: isLoading,
            onPressed: onConfirm,
          ),
        ),
      ],
    );
  }
}
