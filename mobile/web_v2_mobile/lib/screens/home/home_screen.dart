import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/app_card.dart';
import '../../widgets/custom_button.dart';
import 'dashboard_hub_tab.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _currentIndex = 0;

  final List<GlobalKey<NavigatorState>> _navigatorKeys = [
    GlobalKey<NavigatorState>(),
    GlobalKey<NavigatorState>(),
  ];

  void _onTabTapped(int index) {
    if (index == _currentIndex) {
      // Tap active tab -> pop to root screen of this tab (1-tap home return)
      _navigatorKeys[index].currentState?.popUntil((route) => route.isFirst);
    } else {
      setState(() => _currentIndex = index);
    }
  }

  Widget _buildTabNavigator(int index) {
    return Navigator(
      key: _navigatorKeys[index],
      onGenerateRoute: (routeSettings) {
        return MaterialPageRoute(
          builder: (context) {
            switch (index) {
              case 0:
                return const DashboardHubTab();
              case 1:
                return const _ProfileTab();
              default:
                return const SizedBox.shrink();
            }
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) async {
        if (didPop) return;
        final currentNavigator = _navigatorKeys[_currentIndex].currentState;
        if (currentNavigator != null && currentNavigator.canPop()) {
          currentNavigator.pop();
        } else if (_currentIndex != 0) {
          setState(() => _currentIndex = 0);
        } else {
          await SystemNavigator.pop();
        }
      },
      child: Scaffold(
        body: IndexedStack(
          index: _currentIndex,
          children: [
            _buildTabNavigator(0),
            _buildTabNavigator(1),
          ],
        ),
        bottomNavigationBar: BottomNavigationBar(
          currentIndex: _currentIndex,
          onTap: _onTabTapped,
          backgroundColor: isDark ? AppColors.neutral900 : AppColors.white,
          selectedItemColor: isDark ? AppColors.neutral100 : AppColors.neutral900,
          unselectedItemColor: isDark ? AppColors.neutral500 : AppColors.neutral400,
          selectedLabelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
          unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.normal, fontSize: 12),
          type: BottomNavigationBarType.fixed,
          elevation: 8,
          items: const [
            BottomNavigationBarItem(
              icon: Icon(Icons.grid_view_rounded),
              activeIcon: Icon(Icons.grid_view_rounded),
              label: 'Trang chủ',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.person_outline),
              activeIcon: Icon(Icons.person),
              label: 'Tài khoản',
            ),
          ],
        ),
      ),
    );
  }
}

class _ProfileTab extends StatelessWidget {
  const _ProfileTab();

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final authProvider = context.watch<AuthProvider>();
    final user = authProvider.user;

    return Scaffold(
      backgroundColor: isDark ? AppColors.neutral950 : AppColors.neutral50,
      appBar: AppBar(
        title: const Text(
          'Thông tin tài khoản',
          style: TextStyle(fontWeight: FontWeight.w600, fontSize: 18),
        ),
        backgroundColor: isDark ? AppColors.neutral900 : AppColors.white,
        foregroundColor: isDark ? AppColors.neutral100 : AppColors.neutral900,
        elevation: 0.5,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AppCard(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        CircleAvatar(
                          radius: 28,
                          backgroundColor: isDark ? AppColors.neutral700 : AppColors.neutral200,
                          child: Text(
                            (user?.fullName.isNotEmpty == true
                                    ? user!.fullName[0]
                                    : (user?.username.isNotEmpty == true ? user!.username[0] : 'U'))
                                .toUpperCase(),
                            style: TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.bold,
                              color: isDark ? AppColors.neutral100 : AppColors.neutral900,
                            ),
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                user?.fullName.isNotEmpty == true ? user!.fullName : (user?.username ?? ''),
                                style: TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.w600,
                                  color: isDark ? AppColors.neutral100 : AppColors.neutral900,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                user?.email ?? '',
                                style: TextStyle(
                                  fontSize: 13,
                                  color: isDark ? AppColors.neutral400 : AppColors.neutral500,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),
                    const Divider(height: 1),
                    const SizedBox(height: 16),
                    _buildInfoRow('Tên đăng nhập', user?.username ?? '-', isDark),
                    const SizedBox(height: 10),
                    _buildInfoRow('Vai trò', user?.roleName ?? user?.role ?? 'Người dùng', isDark),
                    const SizedBox(height: 10),
                    _buildInfoRow(
                      'Trạng thái',
                      user?.isActive == false ? 'Đã khóa' : 'Hoạt động',
                      isDark,
                      valueColor: user?.isActive == false ? AppColors.red600 : Colors.green[600],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              CustomButton(
                text: 'Đăng xuất',
                variant: ButtonVariant.outline,
                icon: const Icon(Icons.logout, size: 18),
                onPressed: () => authProvider.logout(),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildInfoRow(String label, String value, bool isDark, {Color? valueColor}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: 14,
            color: isDark ? AppColors.neutral400 : AppColors.neutral500,
          ),
        ),
        Text(
          value,
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w500,
            color: valueColor ?? (isDark ? AppColors.neutral200 : AppColors.neutral800),
          ),
        ),
      ],
    );
  }
}
