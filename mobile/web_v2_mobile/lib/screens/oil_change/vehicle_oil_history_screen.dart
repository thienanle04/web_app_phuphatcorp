import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../core/utils/format_utils.dart';
import '../../data/models/oil_change_record.dart';
import '../../providers/auth_provider.dart';
import '../../providers/oil_change_provider.dart';
import '../../widgets/app_card.dart';
import '../../widgets/custom_button.dart';
import '../inspection/dialogs/delete_confirm_dialog.dart';
import 'oil_change_form_screen.dart';

class VehicleOilHistoryScreen extends StatefulWidget {
  final int vehicleId;
  final String plateNumber;

  const VehicleOilHistoryScreen({
    super.key,
    required this.vehicleId,
    required this.plateNumber,
  });

  @override
  State<VehicleOilHistoryScreen> createState() => _VehicleOilHistoryScreenState();
}

class _VehicleOilHistoryScreenState extends State<VehicleOilHistoryScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<OilChangeProvider>().setHistoryVehicleId(widget.vehicleId);
    });
  }

  void _confirmDelete(OilChangeRecord record) {
    showDialog(
      context: context,
      builder: (dialogContext) => DeleteConfirmDialog(
        title: 'Xóa lần thay nhớt',
        content: 'Bạn có chắc chắn muốn xóa lần thay nhớt ngày ${FormatUtils.formatDate(record.changeDate)} (ODO: ${record.odometerAt.toStringAsFixed(0)} km) của xe ${widget.plateNumber}?',
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
    final records = provider.historyRecords;

    return Scaffold(
      backgroundColor: isDark ? AppColors.neutral950 : AppColors.neutral50,
      appBar: AppBar(
        title: Text(
          'Lịch sử thay nhớt xe ${widget.plateNumber}',
          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
        ),
        backgroundColor: isDark ? AppColors.neutral900 : AppColors.white,
        foregroundColor: isDark ? AppColors.neutral100 : AppColors.neutral900,
        elevation: 0.5,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => provider.fetchHistory(isRefresh: true),
          ),
        ],
      ),
      floatingActionButton: canManage
          ? FloatingActionButton.extended(
              onPressed: () async {
                final created = await Navigator.push<bool>(
                  context,
                  MaterialPageRoute(
                    builder: (_) => OilChangeFormScreen(
                      preselectedVehicleId: widget.vehicleId,
                    ),
                  ),
                );
                if (created == true && mounted) {
                  provider.fetchHistory(isRefresh: true);
                }
              },
              backgroundColor: isDark ? AppColors.neutral100 : AppColors.neutral900,
              foregroundColor: isDark ? AppColors.neutral900 : AppColors.white,
              icon: const Icon(Icons.add, size: 20),
              label: const Text('Thêm lần thay nhớt', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
            )
          : null,
      body: SafeArea(
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
                              'Chưa có lịch sử thay nhớt cho xe này.',
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
                            final isLatest = index == 0 && provider.historyPage == 1;

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
                                          if (isLatest) ...[
                                            Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                              decoration: BoxDecoration(
                                                color: isDark ? const Color(0xFF064E3B) : const Color(0xFFD1FAE5),
                                                borderRadius: BorderRadius.circular(4),
                                              ),
                                              child: Text(
                                                'Mới nhất',
                                                style: TextStyle(
                                                  fontSize: 10,
                                                  fontWeight: FontWeight.bold,
                                                  color: isDark ? const Color(0xFF34D399) : const Color(0xFF059669),
                                                ),
                                              ),
                                            ),
                                            const SizedBox(width: 8),
                                          ],
                                          Text(
                                            'Lần ${records.length - index}',
                                            style: TextStyle(
                                              fontSize: 15,
                                              fontWeight: FontWeight.bold,
                                              color: isDark ? AppColors.neutral100 : AppColors.neutral900,
                                            ),
                                          ),
                                        ],
                                      ),
                                      if (canManage) ...[
                                        Row(
                                          children: [
                                            IconButton(
                                              icon: const Icon(Icons.edit_outlined, size: 18),
                                              tooltip: 'Chỉnh sửa',
                                              padding: EdgeInsets.zero,
                                              constraints: const BoxConstraints(),
                                              onPressed: () async {
                                                final updated = await Navigator.push<bool>(
                                                  context,
                                                  MaterialPageRoute(
                                                    builder: (_) => OilChangeFormScreen(record: item),
                                                  ),
                                                );
                                                if (updated == true && mounted) {
                                                  provider.fetchHistory(isRefresh: true);
                                                }
                                              },
                                            ),
                                            const SizedBox(width: 12),
                                            IconButton(
                                              icon: const Icon(Icons.delete_outline, size: 18, color: AppColors.red500),
                                              tooltip: 'Xóa',
                                              padding: EdgeInsets.zero,
                                              constraints: const BoxConstraints(),
                                              onPressed: () => _confirmDelete(item),
                                            ),
                                          ],
                                        ),
                                      ],
                                    ],
                                  ),
                                  const SizedBox(height: 12),

                                  Row(
                                    children: [
                                      Expanded(
                                        child: Text(
                                          'Ngày thay: ${FormatUtils.formatDate(item.changeDate)}',
                                          style: TextStyle(
                                            fontSize: 13,
                                            color: isDark ? AppColors.neutral300 : AppColors.neutral700,
                                          ),
                                        ),
                                      ),
                                      Expanded(
                                        child: Text(
                                          'ODO: ${item.odometerAt.toStringAsFixed(0)} km',
                                          style: TextStyle(
                                            fontSize: 13,
                                            fontWeight: FontWeight.w600,
                                            color: isDark ? AppColors.neutral100 : AppColors.neutral900,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),

                                  if (item.oilType != null && item.oilType!.isNotEmpty) ...[
                                    const SizedBox(height: 6),
                                    Row(
                                      children: [
                                        Text(
                                          'Loại nhớt: ',
                                          style: TextStyle(
                                            fontSize: 12,
                                            color: isDark ? AppColors.neutral400 : AppColors.neutral500,
                                          ),
                                        ),
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
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
                                  ],

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
                          },
                        ),
                      ),
      ),
    );
  }
}
