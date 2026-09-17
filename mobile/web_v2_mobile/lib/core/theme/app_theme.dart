import 'package:flutter/material.dart';
import '../constants/app_colors.dart';

class AppTheme {
  static ThemeData get lightTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      scaffoldBackgroundColor: AppColors.neutral50,
      colorScheme: const ColorScheme.light(
        primary: AppColors.neutral900,
        onPrimary: AppColors.white,
        surface: AppColors.white,
        onSurface: AppColors.neutral900,
        error: AppColors.red600,
        onError: AppColors.white,
      ),
      fontFamily: null, // Default system font
    );
  }

  static ThemeData get darkTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: AppColors.neutral950,
      colorScheme: const ColorScheme.dark(
        primary: AppColors.neutral100,
        onPrimary: AppColors.neutral900,
        surface: AppColors.neutral900,
        onSurface: AppColors.neutral100,
        error: AppColors.red400,
        onError: AppColors.white,
      ),
      fontFamily: null,
    );
  }
}
