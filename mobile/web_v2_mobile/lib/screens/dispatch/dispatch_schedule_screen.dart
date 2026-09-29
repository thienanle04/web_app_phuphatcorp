import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../data/models/dispatch_schedule.dart';
import '../../providers/auth_provider.dart';
import '../../providers/dispatch_schedule_provider.dart';
import '../../widgets/app_card.dart';
import '../../widgets/custom_button.dart';
import '../inspection/dialogs/delete_confirm_dialog.dart';
import 'dialogs/dispatch_edit_dialog.dart';
import 'dispatch_form_screen.dart';

class DispatchScheduleScreen extends StatefulWidget {
  const DispatchScheduleScreen({super.key});

  @override
  State<DispatchScheduleScreen> createState() => _DispatchScheduleScreenState();
}

class _DispatchScheduleScreenState extends State<DispatchScheduleScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        context.read<DispatchScheduleProvider>().fetchSchedules();
      }
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _pickDate(BuildContext context) async {
    final provider = context.read<DispatchScheduleProvider>();
    final picked = await showDatePicker(
      context: context,
      initialDate: provider.selectedDate,
      firstDate: DateTime(2020),
      lastDate: DateTime(2035),
      helpText: 'Chọn ngày điều phối xe',
    );

    if (picked != null) {
      provider.setDate(picked);
    }
  }

  void _openEditDialog(BuildContext screenContext, DispatchScheduleItem item) {
    showDialog(
      context: screenContext,
      builder: (dialogContext) => DispatchEditDialog(
        item: item,
        onSave: (diemNhan, tan, can, ghiChu) async {
          Navigator.of(dialogContext).pop();
          try {
            await screenContext.read<DispatchScheduleProvider>().updateSchedule(
              id: item.id,
              diemNhan: diemNhan,
              tan: tan,
              can: can,
              ghiChu: ghiChu,
            );
            if (!mounted) return;
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Đã cập nhật chuyến xe thành công!'), backgroundColor: Colors.green),
            );
          } catch (e) {
            if (!mounted) return;
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('Cập nhật thất bại: $e'), backgroundColor: AppColors.red600),
            );
          }
        },
      ),
    );
  }

  void _confirmDelete(BuildContext screenContext, DispatchScheduleItem item) {
    showDialog(
      context: screenContext,
      builder: (dialogContext) => DeleteConfirmDialog(
        title: 'Xóa chuyến xe',
        content: 'Bạn có chắc chắn muốn xóa chuyến xe ${item.bienSo} (${item.diemNhan})?',
        onConfirm: () async {
          Navigator.of(dialogContext).pop();
          try {
            await screenContext.read<DispatchScheduleProvider>().deleteSchedule(item.id);
            if (!mounted) return;
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Đã xóa chuyến xe thành công!'), backgroundColor: Colors.green),
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
    final provider = context.watch<DispatchScheduleProvider>();
    final authProvider = context.watch<AuthProvider>();
    final canManage = authProvider.hasPermission('dispatch.manage');

    final xeNhoCount = provider.xeNho.length;
    final xeLonCount = provider.xeLon.length;
    final tuyenNgoaiCount = provider.tuyenNgoai.length;

    return Scaffold(
      backgroundColor: isDark ? AppColors.neutral950 : AppColors.neutral50,
      appBar: AppBar(
        title: const Text(
          'Điều hành vận tải',
          style: TextStyle(fontWeight: FontWeight.w600, fontSize: 18),
        ),
        backgroundColor: isDark ? AppColors.neutral900 : AppColors.white,
        foregroundColor: isDark ? AppColors.neutral100 : AppColors.neutral900,
        elevation: 0.5,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, size: 22),
            tooltip: 'Làm mới',
            onPressed: () => provider.fetchSchedules(isRefresh: true),
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          labelPadding: const EdgeInsets.symmetric(horizontal: 4),
          labelColor: isDark ? AppColors.neutral100 : AppColors.neutral900,
          unselectedLabelColor: isDark ? AppColors.neutral500 : AppColors.neutral400,
          indicatorColor: isDark ? AppColors.neutral100 : AppColors.neutral900,
          indicatorWeight: 2.5,
          labelStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12),
          tabs: [
            Tab(
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.directions_car_outlined, size: 15),
                  const SizedBox(width: 4),
                  Flexible(
                    child: Text(
                      'Xe nhỏ ($xeNhoCount)',
                      overflow: TextOverflow.ellipsis,
                      maxLines: 1,
                    ),
                  ),
                ],
              ),
            ),
            Tab(
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.local_shipping_outlined, size: 15),
                  const SizedBox(width: 4),
                  Flexible(
                    child: Text(
                      'Xe lớn ($xeLonCount)',
                      overflow: TextOverflow.ellipsis,
                      maxLines: 1,
                    ),
                  ),
                ],
              ),
            ),
            Tab(
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.navigation_outlined, size: 15),
                  const SizedBox(width: 4),
                  Flexible(
                    child: Text(
                      'Tuyến ngoài ($tuyenNgoaiCount)',
                      overflow: TextOverflow.ellipsis,
                      maxLines: 1,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      floatingActionButton: canManage
          ? FloatingActionButton.extended(
              onPressed: () async {
                String initialTuyen = 'Tuyến cố định';
                String initialXe = 'Xe nhỏ';
                if (_tabController.index == 1) {
                  initialXe = 'Xe lớn';
                } else if (_tabController.index == 2) {
                  initialTuyen = 'Tuyến ngoài';
                }

                await Navigator.push<bool>(
                  context,
                  MaterialPageRoute(
                    builder: (_) => DispatchFormScreen(
                      initialLoaiTuyen: initialTuyen,
                      initialLoaiXe: initialXe,
                    ),
                  ),
                );
              },
              backgroundColor: isDark ? AppColors.neutral100 : AppColors.neutral900,
              foregroundColor: isDark ? AppColors.neutral900 : AppColors.white,
              icon: const Icon(Icons.add, size: 20),
              label: const Text('Tạo chuyến xe', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
            )
          : null,
      body: SafeArea(
        child: Column(
          children: [
            // Date Toolbar
            _buildDateToolbar(context, isDark, provider),
            const Divider(height: 1),

            // Tab Views
            Expanded(
              child: TabBarView(
                controller: _tabController,
                children: [
                  _buildTripList(context, isDark, provider, provider.xeNho, 'xe nhỏ', canManage),
                  _buildTripList(context, isDark, provider, provider.xeLon, 'xe lớn', canManage),
                  _buildTripList(context, isDark, provider, provider.tuyenNgoai, 'tuyến ngoài', canManage),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ==================== DATE TOOLBAR ====================
  Widget _buildDateToolbar(BuildContext context, bool isDark, DispatchScheduleProvider provider) {
    final formattedDate = DateFormat('dd/MM/yyyy').format(provider.selectedDate);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      color: isDark ? AppColors.neutral900 : AppColors.white,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // Prev Day Button
          IconButton(
            icon: const Icon(Icons.chevron_left, size: 22),
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(),
            tooltip: 'Ngày trước',
            onPressed: () => provider.prevDay(),
          ),

          // Date Selector Button
          GestureDetector(
            onTap: () => _pickDate(context),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: isDark ? AppColors.neutral800 : AppColors.neutral100,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: isDark ? AppColors.neutral700 : AppColors.neutral300),
              ),
              child: Row(
                children: [
                  const Icon(Icons.calendar_month, size: 16),
                  const SizedBox(width: 8),
                  Text(
                    formattedDate,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: isDark ? AppColors.neutral100 : AppColors.neutral900,
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Next Day & Today buttons
          Row(
            children: [
              if (!provider.isToday) ...[
                GestureDetector(
                  onTap: () => provider.today(),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
                    decoration: BoxDecoration(
                      color: isDark ? const Color(0xFF064E3B) : const Color(0xFFD1FAE5),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      'Hôm nay',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: isDark ? const Color(0xFF34D399) : const Color(0xFF059669),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
              ],
              IconButton(
                icon: const Icon(Icons.chevron_right, size: 22),
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
                tooltip: 'Ngày sau',
                onPressed: () => provider.nextDay(),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ==================== TRIP LIST BUILDER ====================
  Widget _buildTripList(
    BuildContext context,
    bool isDark,
    DispatchScheduleProvider provider,
    List<DispatchScheduleItem> trips,
    String typeLabel,
    bool canManage,
  ) {
    if (provider.isLoading && !provider.isRefreshing) {
      return const Center(child: CircularProgressIndicator());
    }

    if (provider.errorMessage != null) {
      return Center(
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
                onPressed: () => provider.fetchSchedules(),
              ),
            ],
          ),
        ),
      );
    }

    if (trips.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.calendar_today_outlined,
              size: 56,
              color: isDark ? AppColors.neutral700 : AppColors.neutral300,
            ),
            const SizedBox(height: 12),
            Text(
              'Chưa có chuyến $typeLabel nào trong ngày này.',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w500,
                color: isDark ? AppColors.neutral400 : AppColors.neutral600,
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: () => provider.fetchSchedules(isRefresh: true),
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: trips.length,
        separatorBuilder: (_, _) => const SizedBox(height: 12),
        itemBuilder: (context, index) {
          final trip = trips[index];
          return _buildTripCard(context, isDark, trip, index + 1, canManage);
        },
      ),
    );
  }

  Widget _buildTripCard(
    BuildContext context,
    bool isDark,
    DispatchScheduleItem trip,
    int stt,
    bool canManage,
  ) {
    return AppCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header: STT, Biển số, Xe nhà/ngoài, Actions (Sửa/Xóa)
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                    decoration: BoxDecoration(
                      color: isDark ? AppColors.neutral800 : AppColors.neutral100,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      '#$stt',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: isDark ? AppColors.neutral300 : AppColors.neutral700,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    trip.bienSo,
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: isDark ? AppColors.neutral100 : AppColors.neutral900,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: trip.xeType == 'Xe nhà'
                          ? (isDark ? const Color(0xFF064E3B) : const Color(0xFFD1FAE5))
                          : (isDark ? const Color(0xFF451A03) : const Color(0xFFFEF3C7)),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      trip.xeType,
                      style: TextStyle(
                        fontSize: 10.5,
                        fontWeight: FontWeight.bold,
                        color: trip.xeType == 'Xe nhà'
                            ? (isDark ? const Color(0xFF34D399) : const Color(0xFF059669))
                            : (isDark ? const Color(0xFFFBBF24) : const Color(0xFFD97706)),
                      ),
                    ),
                  ),
                ],
              ),
              if (canManage)
                Row(
                  children: [
                    IconButton(
                      icon: const Icon(Icons.edit_outlined, size: 18),
                      tooltip: 'Chỉnh sửa',
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(),
                      onPressed: () => _openEditDialog(context, trip),
                    ),
                    const SizedBox(width: 12),
                    IconButton(
                      icon: const Icon(Icons.delete_outline, size: 18, color: AppColors.red500),
                      tooltip: 'Xóa chuyến',
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(),
                      onPressed: () => _confirmDelete(context, trip),
                    ),
                  ],
                ),
            ],
          ),
          const SizedBox(height: 10),

          // Driver Row
          Row(
            children: [
              Icon(Icons.person_outline, size: 15, color: isDark ? AppColors.neutral400 : AppColors.neutral500),
              const SizedBox(width: 6),
              Text(
                trip.taiXe ?? 'Chưa gán tài xế',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                  color: isDark ? AppColors.neutral200 : AppColors.neutral800,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),

          // Delivery Point
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.location_on_outlined, size: 15, color: isDark ? AppColors.neutral400 : AppColors.neutral500),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  trip.diemNhan,
                  style: TextStyle(
                    fontSize: 13,
                    color: isDark ? AppColors.neutral300 : AppColors.neutral700,
                  ),
                ),
              ),
            ],
          ),

          // Tấn & CAN row if present
          if ((trip.tan != null && trip.tan!.isNotEmpty) || (trip.can != null && trip.can!.isNotEmpty)) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                if (trip.tan != null && trip.tan!.isNotEmpty) ...[
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2.5),
                    decoration: BoxDecoration(
                      color: isDark ? AppColors.neutral800 : AppColors.neutral100,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      '${trip.tan} tấn',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: isDark ? AppColors.neutral300 : AppColors.neutral700,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                ],
                if (trip.can != null && trip.can!.isNotEmpty) ...[
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2.5),
                    decoration: BoxDecoration(
                      color: isDark ? AppColors.neutral800 : AppColors.neutral100,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      'CAN: ${trip.can}',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: isDark ? AppColors.neutral300 : AppColors.neutral700,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ],

          // Ghi chú
          if (trip.ghiChu != null && trip.ghiChu!.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              'Ghi chú: ${trip.ghiChu}',
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
