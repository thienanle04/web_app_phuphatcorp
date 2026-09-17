import 'package:flutter/material.dart';
import '../../core/constants/app_colors.dart';

enum ButtonVariant { primary, secondary, danger, outline, ghost }
enum ButtonSize { sm, md, lg }

class CustomButton extends StatelessWidget {
  final String text;
  final VoidCallback? onPressed;
  final ButtonVariant variant;
  final ButtonSize size;
  final bool isLoading;
  final bool isFullWidth;
  final Widget? icon;

  const CustomButton({
    super.key,
    required this.text,
    this.onPressed,
    this.variant = ButtonVariant.primary,
    this.size = ButtonSize.md,
    this.isLoading = false,
    this.isFullWidth = true,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    // Background and text colors based on variant
    Color getBackgroundColor() {
      switch (variant) {
        case ButtonVariant.primary:
          return isDark ? AppColors.neutral200 : AppColors.neutral800;
        case ButtonVariant.secondary:
          return isDark ? AppColors.neutral700 : AppColors.neutral100;
        case ButtonVariant.danger:
          return AppColors.red600;
        case ButtonVariant.outline:
        case ButtonVariant.ghost:
          return Colors.transparent;
      }
    }

    Color getTextColor() {
      switch (variant) {
        case ButtonVariant.primary:
          return isDark ? AppColors.neutral900 : AppColors.white;
        case ButtonVariant.secondary:
          return isDark ? AppColors.neutral100 : AppColors.neutral900;
        case ButtonVariant.danger:
          return AppColors.white;
        case ButtonVariant.outline:
          return isDark ? AppColors.neutral200 : AppColors.neutral700;
        case ButtonVariant.ghost:
          return isDark ? AppColors.neutral300 : AppColors.neutral700;
      }
    }

    BorderSide getBorderSide() {
      if (variant == ButtonVariant.outline) {
        return BorderSide(
          color: isDark ? AppColors.neutral600 : AppColors.neutral300,
          width: 1,
        );
      }
      return BorderSide.none;
    }

    // Padding & Font size based on size
    EdgeInsets getPadding() {
      switch (size) {
        case ButtonSize.sm:
          return const EdgeInsets.symmetric(horizontal: 12, vertical: 8);
        case ButtonSize.md:
          return const EdgeInsets.symmetric(horizontal: 16, vertical: 12);
        case ButtonSize.lg:
          return const EdgeInsets.symmetric(horizontal: 24, vertical: 14);
      }
    }

    final double fontSize = size == ButtonSize.lg ? 16 : 14;

    Widget content = Row(
      mainAxisSize: isFullWidth ? MainAxisSize.max : MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (isLoading) ...[
          SizedBox(
            width: 16,
            height: 16,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              valueColor: AlwaysStoppedAnimation<Color>(getTextColor()),
            ),
          ),
          const SizedBox(width: 8),
        ] else if (icon != null) ...[
          icon!,
          const SizedBox(width: 8),
        ],
        Flexible(
          child: Text(
            text,
            style: TextStyle(
              fontSize: fontSize,
              fontWeight: FontWeight.w500,
              color: getTextColor(),
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
          ),
        ),
      ],
    );

    return SizedBox(
      width: isFullWidth ? double.infinity : null,
      child: ElevatedButton(
        onPressed: isLoading ? null : onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: getBackgroundColor(),
          foregroundColor: getTextColor(),
          disabledBackgroundColor: getBackgroundColor().withValues(alpha: 0.5),
          disabledForegroundColor: getTextColor().withValues(alpha: 0.5),
          elevation: 0,
          padding: getPadding(),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(8),
            side: getBorderSide(),
          ),
        ),
        child: content,
      ),
    );
  }
}
