import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../core/utils/format_utils.dart';
import '../../providers/auth_provider.dart';
import '../../providers/inspection_provider.dart';
import '../../widgets/app_card.dart';
import '../../widgets/custom_button.dart';
import '../../widgets/inspection_status_badge.dart';
import 'inspection_detail_screen.dart';
import 'inspection_form_screen.dart';
import 'inspection_history_screen.dart';

class InspectionListScreen extends StatefulWidget {
  const InspectionListScreen({super.key});

  @override
  State<InspectionListScreen> createState() => _InspectionListScreenState();
}

class _InspectionListScreenState extends State<InspectionListScreen> {
  final TextEditingController _searchController = TextEditingController();

  final List<Map<String, String>> _statusFilters = [
    {'value': 'all', 'label': 'Tất cả'},
    {'value': 'con_han', 'label': 'Còn hạn'},
    {'value': 'sap_het_han', 'label': 'Sắp hết hạn'},
    {'value': 'het_han', 'label': 'Hết hạn'},
    {'value': 'chua_dang_kiem', 'label': 'Chưa ĐK'},
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        context.read<InspectionProvider>().fetchSummary();
      }
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final provider = context.watch<InspectionProvider>();
    final authProvider = context.watch<AuthProvider>();
    final canManage = authProvider.hasPermission('vehicle_data.manage');

    return Scaffold(
      backgroundColor: isDark ? AppColors.neutral950 : AppColors.neutral50,
      appBar: AppBar(
        title: const Text(
          'Quản lý đăng kiểm',
          style: TextStyle(fontWeight: FontWeight.w600, fontSize: 18),
        ),
        backgroundColor: isDark ? AppColors.neutral900 : AppColors.white,
        foregroundColor: isDark ? AppColors.neutral100 : AppColors.neutral900,
        elevation: 0.5,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, size: 22),
            tooltip: 'Làm mới',
            onPressed: () => provider.fetchSummary(isRefresh: true),
          ),
        ],
      ),
      floatingActionButton: canManage
          ? FloatingActionButton.extended(
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => const InspectionFormScreen(),
                  ),
                );
              },
              backgroundColor: isDark ? AppColors.neutral100 : AppColors.neutral900,
              foregroundColor: isDark ? AppColors.neutral900 : AppColors.white,
              icon: const Icon(Icons.add, size: 20),
              label: const Text('Thêm đăng kiểm', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
            )
          : null,
      body: SafeArea(
        child: Column(
          children: [
            // Filter Bar Container
            Container(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
              color: isDark ? AppColors.neutral900 : AppColors.white,
              child: Column(
                children: [
                  // Search Input
                  TextField(
                    controller: _searchController,
                    onChanged: (val) => provider.setSearch(val),
                    style: TextStyle(
                      fontSize: 14,
                      color: isDark ? AppColors.neutral100 : AppColors.neutral900,
                    ),
                    decoration: InputDecoration(
                      hintText: 'Tìm theo biển số, tài xế...',
                      hintStyle: TextStyle(
                        fontSize: 13,
                        color: isDark ? AppColors.neutral500 : AppColors.neutral400,
                      ),
                      prefixIcon: Icon(
                        Icons.search,
                        size: 20,
                        color: isDark ? AppColors.neutral400 : AppColors.neutral500,
                      ),
                      suffixIcon: _searchController.text.isNotEmpty
                          ? IconButton(
                              icon: const Icon(Icons.clear, size: 18),
                              onPressed: () {
                                _searchController.clear();
                                provider.setSearch('');
                              },
                            )
                          : null,
                      filled: true,
                      fillColor: isDark ? AppColors.neutral800 : AppColors.neutral100,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: BorderSide.none,
                      ),
                    ),
                  ),
                  const SizedBox(height: 10),

                  // Horizontal Status Filter Chips
                  SizedBox(
                    height: 34,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      itemCount: _statusFilters.length,
                      separatorBuilder: (_, _) => const SizedBox(width: 8),
                      itemBuilder: (context, index) {
                        final item = _statusFilters[index];
                        final isSelected = provider.statusFilter == item['value'];

                        return FilterChip(
                          label: Text(item['label']!),
                          selected: isSelected,
                          onSelected: (_) => provider.setStatusFilter(item['value']!),
                          labelStyle: TextStyle(
                            fontSize: 12,
                            fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                            color: isSelected
                                ? (isDark ? AppColors.neutral900 : AppColors.white)
                                : (isDark ? AppColors.neutral300 : AppColors.neutral700),
                          ),
                          backgroundColor: isDark ? AppColors.neutral800 : AppColors.neutral100,
                          selectedColor: isDark ? AppColors.neutral200 : AppColors.neutral900,
                          showCheckmark: false,
                          padding: const EdgeInsets.symmetric(horizontal: 4),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(6),
                            side: BorderSide(
                              color: isSelected
                                  ? Colors.transparent
                                  : (isDark ? AppColors.neutral700 : AppColors.neutral300),
                              width: 0.8,
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),

            // Vehicle Inspection Cards List
            Expanded(
              child: provider.isLoading && !provider.isRefreshing
                  ? const Center(child: CircularProgressIndicator())
                  : provider.errorMessage != null
                      ? Center(
                          child: Padding(
                            padding: const EdgeInsets.all(24),
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(Icons.error_outline, size: 48, color: AppColors.red500),
                                const SizedBox(height: 12),
                                Text(
                                  provider.errorMessage!,
                                  textAlign: TextAlign.center,
                                  style: const TextStyle(fontSize: 14, color: AppColors.red600),
                                ),
                                const SizedBox(height: 16),
                                CustomButton(
                                  text: 'Thử lại',
                                  size: ButtonSize.sm,
                                  isFullWidth: false,
                                  onPressed: () => provider.fetchSummary(),
                                ),
                              ],
                            ),
                          ),
                        )
                      : provider.summaries.isEmpty
                          ? Center(
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    Icons.fact_check_outlined,
                                    size: 56,
                                    color: isDark ? AppColors.neutral700 : AppColors.neutral300,
                                  ),
                                  const SizedBox(height: 12),
                                  Text(
                                    'Không tìm thấy dữ liệu đăng kiểm nào.',
                                    style: TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w500,
                                      color: isDark ? AppColors.neutral400 : AppColors.neutral600,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    'Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm',
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: isDark ? AppColors.neutral500 : AppColors.neutral400,
                                    ),
                                  ),
                                ],
                              ),
                            )
                          : RefreshIndicator(
                              onRefresh: () => provider.fetchSummary(isRefresh: true),
                              child: ListView.separated(
                                padding: const EdgeInsets.all(16),
                                itemCount: provider.summaries.length,
                                separatorBuilder: (_, _) => const SizedBox(height: 12),
                                itemBuilder: (context, index) {
                                  final vehicle = provider.summaries[index];
                                  final hasInspection = vehicle.latestInspectionId != null;

                                  return GestureDetector(
                                    onTap: () {
                                      if (hasInspection) {
                                        Navigator.push(
                                          context,
                                          MaterialPageRoute(
                                            builder: (_) => InspectionDetailScreen(
                                              inspectionId: vehicle.latestInspectionId!,
                                              vehicleId: vehicle.vehicleId,
                                            ),
                                          ),
                                        );
                                      } else if (canManage) {
                                        Navigator.push(
                                          context,
                                          MaterialPageRoute(
                                            builder: (_) => InspectionFormScreen(
                                              preselectedVehicleId: vehicle.vehicleId,
                                            ),
                                          ),
                                        );
                                      }
                                    },
                                    child: AppCard(
                                      padding: const EdgeInsets.all(16),
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          // Top Row: Biển số & Badge
                                          Row(
                                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                            children: [
                                              Row(
                                                children: [
                                                  Container(
                                                    padding: const EdgeInsets.all(6),
                                                    decoration: BoxDecoration(
                                                      color: isDark ? AppColors.neutral800 : AppColors.neutral100,
                                                      borderRadius: BorderRadius.circular(6),
                                                    ),
                                                    child: Icon(
                                                      Icons.local_shipping_outlined,
                                                      size: 16,
                                                      color: isDark ? AppColors.neutral300 : AppColors.neutral700,
                                                    ),
                                                  ),
                                                  const SizedBox(width: 8),
                                                  Text(
                                                    vehicle.plateNumber,
                                                    style: TextStyle(
                                                      fontSize: 16,
                                                      fontWeight: FontWeight.bold,
                                                      color: isDark ? AppColors.neutral100 : AppColors.neutral900,
                                                    ),
                                                  ),
                                                ],
                                              ),
                                              InspectionStatusBadge(
                                                status: vehicle.displayStatus,
                                                daysLeft: vehicle.daysLeft,
                                              ),
                                            ],
                                          ),
                                          const SizedBox(height: 12),

                                          // Driver & Inspection Count Row
                                          Row(
                                            children: [
                                              Expanded(
                                                child: Row(
                                                  children: [
                                                    Icon(
                                                      Icons.person_outline,
                                                      size: 15,
                                                      color: isDark ? AppColors.neutral400 : AppColors.neutral500,
                                                    ),
                                                    const SizedBox(width: 6),
                                                    Expanded(
                                                      child: Text(
                                                        vehicle.driverName ?? 'Chưa gán',
                                                        style: TextStyle(
                                                          fontSize: 13,
                                                          color: isDark ? AppColors.neutral300 : AppColors.neutral700,
                                                        ),
                                                        overflow: TextOverflow.ellipsis,
                                                      ),
                                                    ),
                                                  ],
                                                ),
                                              ),
                                              Container(
                                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                                decoration: BoxDecoration(
                                                  color: isDark ? AppColors.neutral800 : AppColors.neutral100,
                                                  borderRadius: BorderRadius.circular(4),
                                                ),
                                                child: Text(
                                                  '${vehicle.inspectionCount} lần ĐK',
                                                  style: TextStyle(
                                                    fontSize: 11,
                                                    fontWeight: FontWeight.w500,
                                                    color: isDark ? AppColors.neutral400 : AppColors.neutral600,
                                                  ),
                                                ),
                                              ),
                                            ],
                                          ),
                                          const SizedBox(height: 8),

                                          // Dates Row
                                          Row(
                                            children: [
                                              Expanded(
                                                child: Row(
                                                  children: [
                                                    Icon(
                                                      Icons.event_outlined,
                                                      size: 14,
                                                      color: isDark ? AppColors.neutral400 : AppColors.neutral500,
                                                    ),
                                                    const SizedBox(width: 6),
                                                    Text(
                                                      'ĐK: ${FormatUtils.formatDate(vehicle.latestInspectionDate)}',
                                                      style: TextStyle(
                                                        fontSize: 12,
                                                        color: isDark ? AppColors.neutral400 : AppColors.neutral600,
                                                      ),
                                                    ),
                                                  ],
                                                ),
                                              ),
                                              Expanded(
                                                child: Row(
                                                  children: [
                                                    Icon(
                                                      Icons.event_busy_outlined,
                                                      size: 14,
                                                      color: vehicle.displayStatus == 'het_han'
                                                          ? AppColors.red500
                                                          : (isDark ? AppColors.neutral400 : AppColors.neutral500),
                                                    ),
                                                    const SizedBox(width: 6),
                                                    Text(
                                                      'Hết hạn: ${FormatUtils.formatDate(vehicle.latestExpiryDate)}',
                                                      style: TextStyle(
                                                        fontSize: 12,
                                                        fontWeight: FontWeight.w500,
                                                        color: vehicle.displayStatus == 'het_han'
                                                            ? AppColors.red500
                                                            : (isDark ? AppColors.neutral300 : AppColors.neutral700),
                                                      ),
                                                    ),
                                                  ],
                                                ),
                                              ),
                                            ],
                                          ),
                                          const SizedBox(height: 12),
                                          const Divider(height: 1),
                                          const SizedBox(height: 10),

                                          // Card Footer: History action + Details hint
                                          Row(
                                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                            children: [
                                              GestureDetector(
                                                onTap: () {
                                                  Navigator.push(
                                                    context,
                                                    MaterialPageRoute(
                                                      builder: (_) => InspectionHistoryScreen(
                                                        vehicleId: vehicle.vehicleId,
                                                        plateNumber: vehicle.plateNumber,
                                                      ),
                                                    ),
                                                  );
                                                },
                                                child: Row(
                                                  children: [
                                                    Icon(
                                                      Icons.history,
                                                      size: 15,
                                                      color: isDark ? AppColors.neutral400 : AppColors.neutral600,
                                                    ),
                                                    const SizedBox(width: 4),
                                                    Text(
                                                      'Xem lịch sử',
                                                      style: TextStyle(
                                                        fontSize: 12,
                                                        fontWeight: FontWeight.w500,
                                                        color: isDark ? AppColors.neutral300 : AppColors.neutral700,
                                                        decoration: TextDecoration.underline,
                                                      ),
                                                    ),
                                                  ],
                                                ),
                                              ),
                                              Row(
                                                children: [
                                                  Text(
                                                    hasInspection ? 'Chi tiết' : (canManage ? 'Thêm mới' : 'Chưa có ĐK'),
                                                    style: TextStyle(
                                                      fontSize: 12,
                                                      fontWeight: FontWeight.w600,
                                                      color: isDark ? AppColors.neutral300 : AppColors.neutral700,
                                                    ),
                                                  ),
                                                  Icon(
                                                    Icons.chevron_right,
                                                    size: 16,
                                                    color: isDark ? AppColors.neutral400 : AppColors.neutral500,
                                                  ),
                                                ],
                                              ),
                                            ],
                                          ),
                                        ],
                                      ),
                                    ),
                                  );
                                },
                              ),
                            ),
            ),
          ],
        ),
      ),
    );
  }
}
