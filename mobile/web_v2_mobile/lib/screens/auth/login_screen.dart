import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/app_card.dart';
import '../../widgets/custom_button.dart';
import '../../widgets/custom_text_field.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();

  String? _usernameError;
  String? _passwordError;

  @override
  void dispose() {
    _usernameController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _validateAndSubmit() async {
    final username = _usernameController.text.trim();
    final password = _passwordController.text;

    setState(() {
      _usernameError = username.isEmpty ? 'Tên đăng nhập là bắt buộc' : null;
      _passwordError = password.isEmpty ? 'Mật khẩu là bắt buộc' : null;
    });

    if (_usernameError != null || _passwordError != null) {
      return;
    }

    final authProvider = context.read<AuthProvider>();
    await authProvider.login(username, password);
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final authProvider = context.watch<AuthProvider>();

    return Scaffold(
      backgroundColor: isDark ? AppColors.neutral950 : AppColors.neutral50,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // App Brand Logo
                  Image.asset(
                    'assets/icon/logo_nobackground.png',
                    width: MediaQuery.of(context).size.width * 0.5,
                    fit: BoxFit.contain,
                    errorBuilder: (_, _, _) => Container(
                      width: 56,
                      height: 56,
                      decoration: BoxDecoration(
                        color: isDark ? AppColors.neutral200 : AppColors.neutral800,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Icon(
                        Icons.calculate_outlined,
                        size: 32,
                        color: isDark ? AppColors.neutral900 : AppColors.white,
                      ),
                    ),
                  ),
                  const SizedBox(height: 28),

                  // Login Card Container
                  AppCard(
                    padding: const EdgeInsets.all(28),
                    child: Form(
                      key: _formKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Card Header: Icon & "Đăng nhập"
                          Row(
                            children: [
                              Container(
                                width: 32,
                                height: 32,
                                decoration: BoxDecoration(
                                  color: isDark ? AppColors.neutral200 : AppColors.neutral800,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Icon(
                                  Icons.calculate_outlined,
                                  size: 20,
                                  color: isDark ? AppColors.neutral900 : AppColors.white,
                                ),
                              ),
                              const SizedBox(width: 10),
                              Text(
                                'Đăng nhập',
                                style: TextStyle(
                                  fontSize: 20,
                                  fontWeight: FontWeight.w600,
                                  color: isDark ? AppColors.neutral100 : AppColors.neutral900,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 24),

                          // Server Error Alert Box
                          if (authProvider.errorMessage != null) ...[
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                              decoration: BoxDecoration(
                                color: isDark ? AppColors.red900.withValues(alpha: 0.25) : AppColors.red50,
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(
                                  color: isDark ? AppColors.red800 : AppColors.red200,
                                  width: 1,
                                ),
                              ),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.center,
                                children: [
                                  Icon(
                                    Icons.error_outline,
                                    size: 18,
                                    color: isDark ? AppColors.red400 : AppColors.red700,
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      authProvider.errorMessage!,
                                      style: TextStyle(
                                        fontSize: 13,
                                        color: isDark ? AppColors.red400 : AppColors.red700,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 16),
                          ],

                          // Username Field
                          CustomTextField(
                            label: 'Tên đăng nhập',
                            placeholder: 'Nhập tên đăng nhập',
                            controller: _usernameController,
                            errorText: _usernameError,
                            onChanged: (_) {
                              if (_usernameError != null) {
                                setState(() => _usernameError = null);
                              }
                              authProvider.clearError();
                            },
                          ),
                          const SizedBox(height: 16),

                          // Password Field
                          CustomTextField(
                            label: 'Mật khẩu',
                            placeholder: 'Nhập mật khẩu',
                            isPassword: true,
                            controller: _passwordController,
                            errorText: _passwordError,
                            onChanged: (_) {
                              if (_passwordError != null) {
                                setState(() => _passwordError = null);
                              }
                              authProvider.clearError();
                            },
                          ),
                          const SizedBox(height: 24),

                          // Submit Button
                          CustomButton(
                            text: 'Đăng nhập',
                            isLoading: authProvider.isLoading,
                            onPressed: _validateAndSubmit,
                          ),

                          const SizedBox(height: 20),

                          // Footer Signup Link
                          Center(
                            child: Wrap(
                              alignment: WrapAlignment.center,
                              crossAxisAlignment: WrapCrossAlignment.center,
                              children: [
                                Text(
                                  'Chưa có tài khoản? ',
                                  style: TextStyle(
                                    fontSize: 14,
                                    color: isDark ? AppColors.neutral400 : AppColors.neutral600,
                                  ),
                                ),
                                GestureDetector(
                                  onTap: () {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(
                                        content: Text('Vui lòng liên hệ Admin để tạo tài khoản.'),
                                        duration: Duration(seconds: 2),
                                      ),
                                    );
                                  },
                                  child: Text(
                                    'Đăng ký',
                                    style: TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w500,
                                      color: isDark ? AppColors.neutral100 : AppColors.neutral900,
                                      decoration: TextDecoration.underline,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
