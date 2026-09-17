import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/app_card.dart';
import '../../widgets/hub_menu_card.dart';
import '../dispatch/dispatch_schedule_screen.dart';
import '../inspection/inspection_list_screen.dart';
import '../insurance/insurance_list_screen.dart';
import '../invoice_tracking/invoice_tracking_screen.dart';
import '../oil_change/oil_change_screen.dart';

class DashboardHubTab extends StatelessWidget {
  const DashboardHubTab({super.key});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final authProvider = context.watch<AuthProvider>();
    final user = authProvider.user;

    final hasDispatch = authProvider.hasAnyPermission(['dispatch.view', 'dispatch.manage']);
    final hasInvoice = authProvider.hasAnyPermission(['invoice_tracking.view', 'invoice_tracking.manage']);
    final hasVehicleData = authProvider.hasAnyPermission(['vehicle_data.view', 'vehicle_data.manage']);

    final hasAnyModule = hasDispatch || hasInvoice || hasVehicleData;

    return Scaffold(
      backgroundColor: isDark ? AppColors.neutral950 : AppColors.neutral50,
      appBar: AppBar(
        title: Row(
          children: [
            Image.asset(
              'assets/icon/logo_nobackground.png',
              width: 30,
              height: 30,
              fit: BoxFit.contain,
              errorBuilder: (_, _, _) => const Icon(Icons.local_shipping_rounded, size: 24),
            ),
            const SizedBox(width: 10),
            const Text(
              'PhuPhatCorp Hub',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
            ),
          ],
        ),
        backgroundColor: isDark ? AppColors.neutral900 : AppColors.white,
        foregroundColor: isDark ? AppColors.neutral100 : AppColors.neutral900,
        elevation: 0.5,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // User Greeting Banner
              AppCard(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 24,
                      backgroundColor: isDark ? AppColors.neutral700 : AppColors.neutral200,
                      child: Text(
                        (user?.fullName.isNotEmpty == true
                                ? user!.fullName[0]
                                : (user?.username.isNotEmpty == true ? user!.username[0] : 'U'))
                            .toUpperCase(),
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: isDark ? AppColors.neutral100 : AppColors.neutral900,
                        ),
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Xin chào, ${user?.fullName.isNotEmpty == true ? user!.fullName : (user?.username ?? "Bạn")}',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: isDark ? AppColors.neutral100 : AppColors.neutral900,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 3),
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: isDark ? const Color(0xFF064E3B) : const Color(0xFFD1FAE5),
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(
                                  user?.roleName ?? user?.role ?? 'Người dùng',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                    color: isDark ? const Color(0xFF34D399) : const Color(0xFF059669),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // SECTION 1: ĐIỀU HÀNH & VẬN TẢI
              if (hasDispatch || hasInvoice) ...[
                _buildSectionTitle('ĐIỀU HÀNH & VẬN TẢI', Icons.local_shipping_outlined, isDark),
                const SizedBox(height: 10),
                GridView.count(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  crossAxisCount: 2,
                  crossAxisSpacing: 12,
                  mainAxisSpacing: 12,
                  childAspectRatio: 1.05,
                  children: [
                    if (hasDispatch)
                      HubMenuCard(
                        title: 'Điều phối xe',
                        description: 'Lịch trình theo ngày cho xe nhỏ, xe lớn & tuyến ngoài',
                        icon: Icons.calendar_month_rounded,
                        iconColor: const Color(0xFF2563EB),
                        iconBgColor: const Color(0xFFDBEAFE),
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => const DispatchScheduleScreen()),
                          );
                        },
                      ),
                    if (hasInvoice)
                      HubMenuCard(
                        title: 'Theo dõi HĐ',
                        description: 'Chụp ảnh chứng từ, hóa đơn & duyệt hồ sơ',
                        icon: Icons.receipt_long_rounded,
                        iconColor: const Color(0xFF7C3AED),
                        iconBgColor: const Color(0xFFEDE9FE),
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => const InvoiceTrackingScreen()),
                          );
                        },
                      ),
                  ],
                ),
                const SizedBox(height: 22),
              ],

              // SECTION 2: DỮ LIỆU & BẢO TRÌ XE
              if (hasVehicleData) ...[
                _buildSectionTitle('DỮ LIỆU & BẢO TRÌ XE', Icons.build_outlined, isDark),
                const SizedBox(height: 10),
                GridView.count(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  crossAxisCount: 2,
                  crossAxisSpacing: 12,
                  mainAxisSpacing: 12,
                  childAspectRatio: 1.05,
                  children: [
                    HubMenuCard(
                      title: 'Đăng kiểm',
                      description: 'Theo dõi thời hạn và lịch sử đăng kiểm từng xe',
                      icon: Icons.fact_check_rounded,
                      iconColor: const Color(0xFF0D9488),
                      iconBgColor: const Color(0xFFCCFBF1),
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => const InspectionListScreen()),
                        );
                      },
                    ),
                    HubMenuCard(
                      title: 'Bảo hiểm',
                      description: 'Quản lý hạn mức bảo hiểm xe nhà & đính kèm ảnh',
                      icon: Icons.shield_rounded,
                      iconColor: const Color(0xFF4F46E5),
                      iconBgColor: const Color(0xFFE0E7FF),
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => const InsuranceListScreen()),
                        );
                      },
                    ),
                    HubMenuCard(
                      title: 'Thay nhớt',
                      description: 'Cảnh báo ODO định mức km & lịch sử thay nhớt',
                      icon: Icons.oil_barrel_rounded,
                      iconColor: const Color(0xFFD97706),
                      iconBgColor: const Color(0xFFFEF3C7),
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => const OilChangeScreen()),
                        );
                      },
                    ),
                  ],
                ),
                const SizedBox(height: 22),
              ],

              // Empty permissions fallback
              if (!hasAnyModule) ...[
                Center(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 20),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.shield_outlined,
                          size: 56,
                          color: isDark ? AppColors.neutral700 : AppColors.neutral300,
                        ),
                        const SizedBox(height: 14),
                        Text(
                          'Chào mừng bạn đến với PhuPhatCorp Mobile',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                            color: isDark ? AppColors.neutral100 : AppColors.neutral900,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'Tài khoản của bạn hiện chưa được cấp quyền truy cập các phân hệ điều hành hoặc kỹ thuật xe. Vui lòng liên hệ Quản trị viên để được phân quyền.',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 13,
                            color: isDark ? AppColors.neutral400 : AppColors.neutral600,
                            height: 1.4,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSectionTitle(String title, IconData icon, bool isDark) {
    return Row(
      children: [
        Icon(
          icon,
          size: 16,
          color: isDark ? AppColors.neutral400 : AppColors.neutral500,
        ),
        const SizedBox(width: 6),
        Text(
          title,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.bold,
            letterSpacing: 0.6,
            color: isDark ? AppColors.neutral400 : AppColors.neutral600,
          ),
        ),
      ],
    );
  }
}
