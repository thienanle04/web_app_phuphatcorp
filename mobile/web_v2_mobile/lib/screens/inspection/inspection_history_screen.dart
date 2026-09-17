import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../core/utils/format_utils.dart';
import '../../providers/inspection_provider.dart';
import '../../widgets/app_card.dart';
import '../../widgets/custom_button.dart';
import '../../widgets/inspection_status_badge.dart';
import 'inspection_detail_screen.dart';

class InspectionHistoryScreen extends StatefulWidget {
  final int vehicleId;
  final String plateNumber;

  const InspectionHistoryScreen({
    super.key,
    required this.vehicleId,
    required this.plateNumber,
  });

  @override
  State<InspectionHistoryScreen> createState() => _InspectionHistoryScreenState();
}

class _InspectionHistoryScreenState extends State<InspectionHistoryScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<InspectionProvider>().fetchVehicleHistory(widget.vehicleId);
    });
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final provider = context.watch<InspectionProvider>();
    final history = provider.vehicleHistory;

    return Scaffold(
      backgroundColor: isDark ? AppColors.neutral950 : AppColors.neutral50,
      appBar: AppBar(
        title: Text(
          'Lịch sử ĐK xe ${widget.plateNumber}',
          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 17),
        ),
        backgroundColor: isDark ? AppColors.neutral900 : AppColors.white,
        foregroundColor: isDark ? AppColors.neutral100 : AppColors.neutral900,
        elevation: 0.5,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => provider.fetchVehicleHistory(widget.vehicleId),
          ),
        ],
      ),
      body: SafeArea(
        child: provider.isLoadingHistory
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
                            onPressed: () => provider.fetchVehicleHistory(widget.vehicleId),
                          ),
                        ],
                      ),
                    ),
                  )
                : history.isEmpty
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
                              'Chưa có lịch sử đăng kiểm cho xe này.',
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
                        onRefresh: () => provider.fetchVehicleHistory(widget.vehicleId),
                        child: ListView.separated(
                          padding: const EdgeInsets.all(16),
                          itemCount: history.length,
                          separatorBuilder: (_, _) => const SizedBox(height: 12),
                          itemBuilder: (context, index) {
                            final item = history[index];
                            final isLatest = index == 0;

                            return GestureDetector(
                              onTap: () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (_) => InspectionDetailScreen(
                                      inspectionId: item.id,
                                      vehicleId: widget.vehicleId,
                                    ),
                                  ),
                                );
                              },
                              child: AppCard(
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
                                              'Lần ${history.length - index}',
                                              style: TextStyle(
                                                fontSize: 15,
                                                fontWeight: FontWeight.bold,
                                                color: isDark ? AppColors.neutral100 : AppColors.neutral900,
                                              ),
                                            ),
                                          ],
                                        ),
                                        InspectionStatusBadge(
                                          status: item.displayStatus,
                                          daysLeft: item.daysLeft,
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 12),

                                    Row(
                                      children: [
                                        Expanded(
                                          child: Text(
                                            'Ngày ĐK: ${FormatUtils.formatDate(item.inspectionDate)}',
                                            style: TextStyle(
                                              fontSize: 13,
                                              color: isDark ? AppColors.neutral300 : AppColors.neutral700,
                                            ),
                                          ),
                                        ),
                                        Expanded(
                                          child: Text(
                                            'Hết hạn: ${FormatUtils.formatDate(item.expiryDate)}',
                                            style: TextStyle(
                                              fontSize: 13,
                                              fontWeight: FontWeight.w500,
                                              color: item.displayStatus == 'het_han'
                                                  ? AppColors.red500
                                                  : (isDark ? AppColors.neutral300 : AppColors.neutral700),
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
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ],

                                    const SizedBox(height: 10),
                                    const Divider(height: 1),
                                    const SizedBox(height: 8),

                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        Text(
                                          '${item.images.length} ảnh đính kèm',
                                          style: TextStyle(
                                            fontSize: 11,
                                            color: isDark ? AppColors.neutral500 : AppColors.neutral400,
                                          ),
                                        ),
                                        Row(
                                          children: [
                                            Text(
                                              'Xem chi tiết',
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
    );
  }
}
