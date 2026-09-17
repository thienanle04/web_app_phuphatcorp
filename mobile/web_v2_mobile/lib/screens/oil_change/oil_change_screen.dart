import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../core/utils/format_utils.dart';
import '../../data/models/oil_change_due_vehicle.dart';
import '../../data/models/oil_change_record.dart';
import '../../providers/auth_provider.dart';
import '../../providers/oil_change_provider.dart';
import '../../widgets/app_card.dart';
import '../../widgets/custom_button.dart';
import '../../widgets/oil_status_badge.dart';
import '../inspection/dialogs/delete_confirm_dialog.dart';
import 'dialogs/oil_interval_dialog.dart';
import 'oil_change_form_screen.dart';
import 'vehicle_oil_history_screen.dart';

class OilChangeScreen extends StatefulWidget {
  const OilChangeScreen({super.key});

  @override
  State<OilChangeScreen> createState() => _OilChangeScreenState();
}

class _OilChangeScreenState extends State<OilChangeScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final TextEditingController _searchController = TextEditingController();

  final List<Map<String, String>> _statusFilters = [
    {'value': 'all', 'label': 'Tất cả'},
    {'value': 'overdue', 'label': 'Quá hạn'},
    {'value': 'due_soon', 'label': 'Sắp đến hạn'},
    {'value': 'ok', 'label': 'Bình thường'},
    {'value': 'no_data', 'label': 'Chưa có ODO'},
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        final provider = context.read<OilChangeProvider>();
        provider.fetchDueVehicles();
        provider.fetchHistory();
      }
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  void _openIntervalDialog(BuildContext screenContext, OilChangeDueVehicle vehicle) {
    showDialog(
      context: screenContext,
      builder: (dialogContext) => OilIntervalDialog(
        vehicleId: vehicle.vehicleId,
        plateNumber: vehicle.plateNumber,
        currentIntervalKm: vehicle.intervalKm,
        onSave: (newIntervalKm) async {
          Navigator.of(dialogContext).pop();
          try {
            await screenContext.read<OilChangeProvider>().updateInterval(
              vehicleId: vehicle.vehicleId,
              intervalKm: newIntervalKm,
            );
            if (!mounted) return;
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('Đã cập nhật định mức xe ${vehicle.plateNumber} thành $newIntervalKm km'),
                backgroundColor: Colors.green,
              ),
            );
          } catch (e) {
            if (!mounted) return;
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('Lỗi cập nhật định mức: $e'), backgroundColor: AppColors.red600),
            );
          }
        },
      ),
    );
  }

  void _confirmDeleteHistory(OilChangeRecord record) {
    showDialog(
      context: context,
      builder: (dialogContext) => DeleteConfirmDialog(
        title: 'Xóa lần thay nhớt',
        content: 'Bạn có chắc chắn muốn xóa bản ghi thay nhớt ngày ${FormatUtils.formatDate(record.changeDate)} của xe ${record.plateNumber ?? ''}?',
        onConfirm: () async {
          Navigator.of(dialogContext).pop();
          try {
            await context.read<OilChangeProvider>().deleteOilChange(record.id);
            if (!mounted) return;
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Đã xóa lần thay nhớt thành công!'), backgroundColor: Colors.green),
            );
          } catch (e) {
            if (!mounted) return;
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('Xóa thất bại: $e'), backgroundColor: AppColors.red600),
            );
          }
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final provider = context.watch<OilChangeProvider>();
    final authProvider = context.watch<AuthProvider>();
    final canManage = authProvider.hasPermission('vehicle_data.manage');

    return Scaffold(
      backgroundColor: isDark ? AppColors.neutral950 : AppColors.neutral50,
      appBar: AppBar(
        title: const Text(
          'Quản lý thay nhớt',
          style: TextStyle(fontWeight: FontWeight.w600, fontSize: 18),
        ),
        backgroundColor: isDark ? AppColors.neutral900 : AppColors.white,
        foregroundColor: isDark ? AppColors.neutral100 : AppColors.neutral900,
        elevation: 0.5,
        bottom: TabBar(
          controller: _tabController,
          labelColor: isDark ? AppColors.neutral100 : AppColors.neutral900,
          unselectedLabelColor: isDark ? AppColors.neutral500 : AppColors.neutral400,
          indicatorColor: isDark ? AppColors.neutral100 : AppColors.neutral900,
          indicatorWeight: 2.5,
          labelStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
          tabs: const [
            Tab(text: 'Xe cần thay nhớt'),
            Tab(text: 'Lịch sử thay nhớt'),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, size: 22),
            tooltip: 'Làm mới',
            onPressed: () {
              if (_tabController.index == 0) {
                provider.fetchDueVehicles(isRefresh: true);
              } else {
                provider.fetchHistory(isRefresh: true);
              }
            },
          ),
        ],
      ),
      floatingActionButton: canManage
          ? FloatingActionButton.extended(
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => const OilChangeFormScreen(),
                  ),
                );
              },
              backgroundColor: isDark ? AppColors.neutral100 : AppColors.neutral900,
              foregroundColor: isDark ? AppColors.neutral900 : AppColors.white,
              icon: const Icon(Icons.add, size: 20),
              label: const Text('Ghi nhận thay nhớt', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
            )
          : null,
      body: TabBarView(
        controller: _tabController,
        children: [
          // TAB 1: Due Vehicles List
          _buildDueVehiclesTab(isDark, provider, canManage),

          // TAB 2: History List
          _buildHistoryTab(isDark, provider, canManage),
        ],
      ),
    );
  }

  // ==================== TAB 1: DUE VEHICLES ====================
  Widget _buildDueVehiclesTab(bool isDark, OilChangeProvider provider, bool canManage) {
    final vehicles = provider.filteredDueVehicles;

    return Column(
      children: [
        // Filter & Search bar
        Container(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
          color: isDark ? AppColors.neutral900 : AppColors.white,
          child: Column(
            children: [
              // Search Input
              TextField(
                controller: _searchController,
                onChanged: (val) => provider.setDueSearch(val),
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
                            provider.setDueSearch('');
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

              // Filter Chips
              SizedBox(
                height: 34,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: _statusFilters.length,
                  separatorBuilder: (_, _) => const SizedBox(width: 8),
                  itemBuilder: (context, index) {
                    final item = _statusFilters[index];
                    final isSelected = provider.dueStatusFilter == item['value'];

                    return FilterChip(
                      label: Text(item['label']!),
                      selected: isSelected,
                      onSelected: (_) => provider.setDueStatusFilter(item['value']!),
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

        // List
        Expanded(
          child: provider.isLoadingDue && !provider.isRefreshingDue
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
                              onPressed: () => provider.fetchDueVehicles(),
                            ),
                          ],
                        ),
                      ),
                    )
                  : vehicles.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.oil_barrel_outlined,
                                size: 56,
                                color: isDark ? AppColors.neutral700 : AppColors.neutral300,
                              ),
                              const SizedBox(height: 12),
                              Text(
                                'Không có xe nào phù hợp bộ lọc.',
                                style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w500,
                                  color: isDark ? AppColors.neutral400 : AppColors.neutral600,
                                ),
                              ),
                            ],
                          ),
                        )
                      : RefreshIndicator(
                          onRefresh: () => provider.fetchDueVehicles(isRefresh: true),
                          child: ListView.separated(
                            padding: const EdgeInsets.all(16),
                            itemCount: vehicles.length,
                            separatorBuilder: (_, _) => const SizedBox(height: 12),
                            itemBuilder: (context, index) {
                              final v = vehicles[index];
                              return _buildDueVehicleCard(context, isDark, v, canManage);
                            },
                          ),
                        ),
        ),
      ],
    );
  }

  Widget _buildDueVehicleCard(BuildContext context, bool isDark, OilChangeDueVehicle v, bool canManage) {
    Color progressColor;
    if (v.oilStatus == 'overdue') {
      progressColor = AppColors.red500;
    } else if (v.oilStatus == 'due_soon') {
      progressColor = const Color(0xFFD97706);
    } else if (v.oilStatus == 'ok') {
      progressColor = const Color(0xFF059669);
    } else {
      progressColor = AppColors.neutral400;
    }

    final kmDrivenText = v.kmSinceChange != null
        ? '${v.kmSinceChange!.toStringAsFixed(0)} / ${v.intervalKm} km'
        : 'Chưa có ODO nhật trình';

    final percentText = v.kmSinceChange != null
        ? '${(v.progressRatio * 100).toStringAsFixed(0)}%'
        : '0%';

    return AppCard(
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
                    v.plateNumber,
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: isDark ? AppColors.neutral100 : AppColors.neutral900,
                    ),
                  ),
                ],
              ),
              OilStatusBadge(status: v.oilStatus),
            ],
          ),
          const SizedBox(height: 10),

          // Driver Row
          Row(
            children: [
              Icon(Icons.person_outline, size: 14, color: isDark ? AppColors.neutral400 : AppColors.neutral500),
              const SizedBox(width: 6),
              Text(
                v.driverName ?? 'Chưa gán tài xế',
                style: TextStyle(fontSize: 13, color: isDark ? AppColors.neutral300 : AppColors.neutral700),
              ),
            ],
          ),
          const SizedBox(height: 10),

          // Progress Bar
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Đã chạy: $kmDrivenText',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                      color: isDark ? AppColors.neutral300 : AppColors.neutral700,
                    ),
                  ),
                  Text(
                    percentText,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      color: progressColor,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: v.progressRatio,
                  backgroundColor: isDark ? AppColors.neutral800 : AppColors.neutral200,
                  valueColor: AlwaysStoppedAnimation<Color>(progressColor),
                  minHeight: 6,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Last Change & Remaining stats
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            decoration: BoxDecoration(
              color: isDark ? AppColors.neutral800.withValues(alpha: 0.5) : AppColors.neutral100.withValues(alpha: 0.8),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  v.lastChangeDate != null
                      ? 'Lần thay trước: ${FormatUtils.formatDate(v.lastChangeDate)} (${v.lastOdometer?.toStringAsFixed(0) ?? '-'} km)'
                      : 'Lần thay trước: Chưa có',
                  style: TextStyle(
                    fontSize: 11,
                    color: isDark ? AppColors.neutral400 : AppColors.neutral600,
                  ),
                ),
                if (v.remainingKm != null)
                  Text(
                    v.remainingKm! < 0
                        ? 'Quá ${(-v.remainingKm!).toStringAsFixed(0)} km'
                        : 'Còn ${v.remainingKm!.toStringAsFixed(0)} km',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: progressColor,
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          const Divider(height: 1),
          const SizedBox(height: 8),

          // Actions Row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              GestureDetector(
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => VehicleOilHistoryScreen(
                        vehicleId: v.vehicleId,
                        plateNumber: v.plateNumber,
                      ),
                    ),
                  );
                },
                child: Row(
                  children: [
                    Icon(Icons.history, size: 15, color: isDark ? AppColors.neutral400 : AppColors.neutral600),
                    const SizedBox(width: 4),
                    Text(
                      'Lịch sử thay nhớt',
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
                  if (canManage) ...[
                    GestureDetector(
                      onTap: () => _openIntervalDialog(context, v),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: isDark ? AppColors.neutral800 : AppColors.neutral100,
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: isDark ? AppColors.neutral700 : AppColors.neutral300),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.settings_outlined, size: 14),
                            const SizedBox(width: 4),
                            Text('Định mức', style: TextStyle(fontSize: 11, color: isDark ? AppColors.neutral300 : AppColors.neutral700)),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    GestureDetector(
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => OilChangeFormScreen(
                              preselectedVehicleId: v.vehicleId,
                            ),
                          ),
                        );
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: isDark ? AppColors.neutral100 : AppColors.neutral900,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Row(
                          children: [
                            Icon(Icons.add, size: 14, color: isDark ? AppColors.neutral900 : AppColors.white),
                            const SizedBox(width: 4),
                            Text(
                              'Thay nhớt',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: isDark ? AppColors.neutral900 : AppColors.white,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ==================== TAB 2: HISTORY ====================
  Widget _buildHistoryTab(bool isDark, OilChangeProvider provider, bool canManage) {
    final records = provider.historyRecords;

    return Column(
      children: [
        // List
        Expanded(
          child: provider.isLoadingHistory && !provider.isRefreshingHistory
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
                              onPressed: () => provider.fetchHistory(),
                            ),
                          ],
                        ),
                      ),
                    )
                  : records.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.history_outlined,
                                size: 56,
                                color: isDark ? AppColors.neutral700 : AppColors.neutral300,
                              ),
                              const SizedBox(height: 12),
                              Text(
                                'Chưa có bản ghi thay nhớt nào.',
                                style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w500,
                                  color: isDark ? AppColors.neutral400 : AppColors.neutral600,
                                ),
                              ),
                            ],
                          ),
                        )
                      : RefreshIndicator(
                          onRefresh: () => provider.fetchHistory(isRefresh: true),
                          child: ListView.separated(
                            padding: const EdgeInsets.all(16),
                            itemCount: records.length,
                            separatorBuilder: (_, _) => const SizedBox(height: 12),
                            itemBuilder: (context, index) {
                              final item = records[index];
                              return _buildHistoryRecordCard(context, isDark, item, canManage);
                            },
                          ),
                        ),
        ),
      ],
    );
  }

  Widget _buildHistoryRecordCard(BuildContext context, bool isDark, OilChangeRecord item, bool canManage) {
    return AppCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
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
                    item.plateNumber ?? 'Xe #${item.vehicleId}',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: isDark ? AppColors.neutral100 : AppColors.neutral900,
                    ),
                  ),
                ],
              ),
              if (canManage)
                Row(
                  children: [
                    IconButton(
                      icon: const Icon(Icons.edit_outlined, size: 18),
                      tooltip: 'Sửa',
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(),
                      onPressed: () async {
                        final updated = await Navigator.push<bool>(
                          context,
                          MaterialPageRoute(
                            builder: (_) => OilChangeFormScreen(record: item),
                          ),
                        );
                        if (updated == true && context.mounted) {
                          context.read<OilChangeProvider>().fetchHistory(isRefresh: true);
                        }
                      },
                    ),
                    const SizedBox(width: 12),
                    IconButton(
                      icon: const Icon(Icons.delete_outline, size: 18, color: AppColors.red500),
                      tooltip: 'Xóa',
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(),
                      onPressed: () => _confirmDeleteHistory(item),
                    ),
                  ],
                ),
            ],
          ),
          const SizedBox(height: 10),

          Row(
            children: [
              Expanded(
                child: Text(
                  'Tài xế: ${item.driverName ?? 'Chưa gán'}',
                  style: TextStyle(fontSize: 13, color: isDark ? AppColors.neutral300 : AppColors.neutral700),
                ),
              ),
              Text(
                'ODO: ${item.odometerAt.toStringAsFixed(0)} km',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: isDark ? AppColors.neutral100 : AppColors.neutral900,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),

          Row(
            children: [
              Expanded(
                child: Text(
                  'Ngày thay: ${FormatUtils.formatDate(item.changeDate)}',
                  style: TextStyle(fontSize: 12, color: isDark ? AppColors.neutral400 : AppColors.neutral600),
                ),
              ),
              if (item.oilType != null && item.oilType!.isNotEmpty)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: isDark ? AppColors.neutral800 : AppColors.neutral100,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    item.oilType!,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: isDark ? AppColors.neutral300 : AppColors.neutral700,
                    ),
                  ),
                ),
            ],
          ),

          if (item.notes != null && item.notes!.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              'Ghi chú: ${item.notes}',
              style: TextStyle(
                fontSize: 12,
                fontStyle: FontStyle.italic,
                color: isDark ? AppColors.neutral400 : AppColors.neutral500,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
