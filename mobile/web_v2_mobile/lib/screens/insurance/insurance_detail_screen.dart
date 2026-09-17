import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/api/api_endpoints.dart';
import '../../core/constants/app_colors.dart';
import '../../core/utils/format_utils.dart';
import '../../data/models/insurance_record.dart';
import '../../providers/auth_provider.dart';
import '../../providers/insurance_provider.dart';
import '../../widgets/app_card.dart';
import '../../widgets/custom_button.dart';
import '../../widgets/insurance_status_badge.dart';
import '../inspection/dialogs/delete_confirm_dialog.dart';
import 'dialogs/insurance_image_viewer_dialog.dart';
import 'insurance_form_screen.dart';
import 'insurance_history_screen.dart';

class InsuranceDetailScreen extends StatefulWidget {
  final int insuranceId;
  final int? vehicleId;

  const InsuranceDetailScreen({
    super.key,
    required this.insuranceId,
    this.vehicleId,
  });

  @override
  State<InsuranceDetailScreen> createState() => _InsuranceDetailScreenState();
}

class _InsuranceDetailScreenState extends State<InsuranceDetailScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<InsuranceProvider>().fetchInsuranceDetail(widget.insuranceId);
    });
  }

  void _openImageViewer(List<InsuranceImage> images, int index) {
    showDialog(
      context: context,
      builder: (_) => InsuranceImageViewerDialog(
        images: images,
        initialIndex: index,
      ),
    );
  }

  void _confirmDelete(InsuranceRecord record) {
    showDialog(
      context: context,
      builder: (dialogContext) => DeleteConfirmDialog(
        title: 'Xóa bảo hiểm',
        content: 'Bạn có chắc chắn muốn xóa bản ghi bảo hiểm ngày mua ${FormatUtils.formatDate(record.purchaseDate)} của xe ${record.plateNumber ?? ''}?',
        onConfirm: () async {
          Navigator.of(dialogContext).pop();
          try {
            await context.read<InsuranceProvider>().deleteInsurance(record.id);
            if (!mounted) return;
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Đã xóa bảo hiểm thành công!'),
                backgroundColor: Colors.green,
              ),
            );
            Navigator.of(context).pop(); // Back to list
          } catch (e) {
            if (!mounted) return;
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('Xóa thất bại: $e'),
                backgroundColor: AppColors.red600,
              ),
            );
          }
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final provider = context.watch<InsuranceProvider>();
    final authProvider = context.watch<AuthProvider>();
    final canManage = authProvider.hasPermission('vehicle_data.manage');
    final record = provider.selectedInsurance;

    return Scaffold(
      backgroundColor: isDark ? AppColors.neutral950 : AppColors.neutral50,
      appBar: AppBar(
        title: Text(
          record != null ? 'BH xe ${record.plateNumber ?? ''}' : 'Chi tiết bảo hiểm',
          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 18),
        ),
        backgroundColor: isDark ? AppColors.neutral900 : AppColors.white,
        foregroundColor: isDark ? AppColors.neutral100 : AppColors.neutral900,
        elevation: 0.5,
        actions: [
          if (record != null && canManage)
            IconButton(
              icon: const Icon(Icons.edit_outlined, size: 20),
              tooltip: 'Chỉnh sửa',
              onPressed: () async {
                final updated = await Navigator.push<bool>(
                  context,
                  MaterialPageRoute(
                    builder: (_) => InsuranceFormScreen(insurance: record),
                  ),
                );
                if (updated == true && mounted) {
                  provider.fetchInsuranceDetail(widget.insuranceId);
                }
              },
            ),
          IconButton(
            icon: const Icon(Icons.refresh, size: 22),
            onPressed: () => provider.fetchInsuranceDetail(widget.insuranceId),
          ),
        ],
      ),
      body: SafeArea(
        child: provider.isLoadingDetail && record == null
            ? const Center(child: CircularProgressIndicator())
            : record == null
                ? Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.error_outline, size: 48, color: AppColors.red500),
                        const SizedBox(height: 12),
                        const Text('Không tìm thấy bản ghi bảo hiểm'),
                        const SizedBox(height: 16),
                        CustomButton(
                          text: 'Thử lại',
                          size: ButtonSize.sm,
                          isFullWidth: false,
                          onPressed: () => provider.fetchInsuranceDetail(widget.insuranceId),
                        ),
                      ],
                    ),
                  )
                : SingleChildScrollView(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Card 1: Overview
                        AppCard(
                          padding: const EdgeInsets.all(18),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Row(
                                    children: [
                                      Container(
                                        padding: const EdgeInsets.all(8),
                                        decoration: BoxDecoration(
                                          color: isDark ? AppColors.neutral800 : AppColors.neutral100,
                                          borderRadius: BorderRadius.circular(8),
                                        ),
                                        child: const Icon(Icons.shield_outlined, size: 20),
                                      ),
                                      const SizedBox(width: 10),
                                      Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            record.plateNumber ?? 'Xe #${record.vehicleId}',
                                            style: TextStyle(
                                              fontSize: 17,
                                              fontWeight: FontWeight.bold,
                                              color: isDark ? AppColors.neutral100 : AppColors.neutral900,
                                            ),
                                          ),
                                          Text(
                                            record.driverName ?? 'Chưa gán tài xế',
                                            style: TextStyle(
                                              fontSize: 12,
                                              color: isDark ? AppColors.neutral400 : AppColors.neutral500,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ],
                                  ),
                                  InsuranceStatusBadge(
                                    status: record.displayStatus,
                                    daysLeft: record.daysLeft,
                                  ),
                                ],
                              ),
                              const SizedBox(height: 16),
                              const Divider(height: 1),
                              const SizedBox(height: 14),

                              _buildDetailRow('Ngày mua bảo hiểm', FormatUtils.formatDate(record.purchaseDate), isDark),
                              const SizedBox(height: 8),
                              _buildDetailRow(
                                'Ngày hết hạn',
                                FormatUtils.formatDate(record.expiryDate),
                                isDark,
                                valueColor: record.displayStatus == 'het_han' ? AppColors.red500 : null,
                              ),
                              const SizedBox(height: 8),
                              _buildDetailRow(
                                'Số ngày còn lại',
                                record.daysLeft >= 0 ? '${record.daysLeft} ngày' : 'Đã quá hạn ${-record.daysLeft} ngày',
                                isDark,
                                valueColor: record.daysLeft < 0
                                    ? AppColors.red500
                                    : (record.daysLeft <= 30 ? const Color(0xFFD97706) : Colors.green[600]),
                              ),
                              if (record.notes != null && record.notes!.isNotEmpty) ...[
                                const SizedBox(height: 8),
                                _buildDetailRow('Ghi chú', record.notes!, isDark),
                              ],
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),

                        // Card 2: Attached Images
                        AppCard(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    'Hình chụp giấy bảo hiểm (${record.images.length})',
                                    style: TextStyle(
                                      fontSize: 15,
                                      fontWeight: FontWeight.bold,
                                      color: isDark ? AppColors.neutral100 : AppColors.neutral900,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 12),

                              if (record.images.isEmpty) ...[
                                Center(
                                  child: Padding(
                                    padding: const EdgeInsets.symmetric(vertical: 18),
                                    child: Column(
                                      children: [
                                        Icon(
                                          Icons.photo_library_outlined,
                                          size: 40,
                                          color: isDark ? AppColors.neutral700 : AppColors.neutral300,
                                        ),
                                        const SizedBox(height: 8),
                                        Text(
                                          'Chưa có hình ảnh đính kèm.',
                                          style: TextStyle(
                                            fontSize: 13,
                                            color: isDark ? AppColors.neutral400 : AppColors.neutral500,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ] else ...[
                                GridView.builder(
                                  shrinkWrap: true,
                                  physics: const NeverScrollableScrollPhysics(),
                                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                                    crossAxisCount: 3,
                                    crossAxisSpacing: 10,
                                    mainAxisSpacing: 10,
                                    childAspectRatio: 1,
                                  ),
                                  itemCount: record.images.length,
                                  itemBuilder: (context, idx) {
                                    final img = record.images[idx];
                                    final imgUrl = ApiEndpoints.vehicleInsuranceFile(img.filename);

                                    return GestureDetector(
                                      onTap: () => _openImageViewer(record.images, idx),
                                      child: Container(
                                        decoration: BoxDecoration(
                                          borderRadius: BorderRadius.circular(8),
                                          border: Border.all(
                                            color: isDark ? AppColors.neutral700 : AppColors.neutral300,
                                          ),
                                          color: isDark ? AppColors.neutral800 : AppColors.neutral100,
                                        ),
                                        child: ClipRRect(
                                          borderRadius: BorderRadius.circular(7),
                                          child: Stack(
                                            fit: StackFit.expand,
                                            children: [
                                              Image.network(
                                                imgUrl,
                                                fit: BoxFit.cover,
                                                loadingBuilder: (_, child, progress) {
                                                  if (progress == null) return child;
                                                  return const Center(child: CircularProgressIndicator(strokeWidth: 2));
                                                },
                                                errorBuilder: (_, _, _) => const Icon(Icons.broken_image_outlined, size: 28),
                                              ),
                                              Positioned(
                                                bottom: 0,
                                                left: 0,
                                                right: 0,
                                                child: Container(
                                                  color: Colors.black.withValues(alpha: 0.6),
                                                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                                                  child: Text(
                                                    img.originalFilename ?? img.filename,
                                                    style: const TextStyle(fontSize: 10, color: Colors.white),
                                                    maxLines: 1,
                                                    overflow: TextOverflow.ellipsis,
                                                  ),
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ),
                                    );
                                  },
                                ),
                              ],
                            ],
                          ),
                        ),
                        const SizedBox(height: 24),

                        // Action Buttons
                        CustomButton(
                          text: 'Xem lịch sử bảo hiểm xe này',
                          variant: ButtonVariant.outline,
                          icon: const Icon(Icons.history, size: 18),
                          onPressed: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) => InsuranceHistoryScreen(
                                  vehicleId: record.vehicleId,
                                  plateNumber: record.plateNumber ?? 'Xe #${record.vehicleId}',
                                ),
                              ),
                            );
                          },
                        ),
                        const SizedBox(height: 10),

                        if (canManage) ...[
                          CustomButton(
                            text: 'Chỉnh sửa bảo hiểm',
                            variant: ButtonVariant.secondary,
                            icon: const Icon(Icons.edit_outlined, size: 18),
                            onPressed: () async {
                              final updated = await Navigator.push<bool>(
                                context,
                                MaterialPageRoute(
                                  builder: (_) => InsuranceFormScreen(insurance: record),
                                ),
                              );
                              if (updated == true && mounted) {
                                provider.fetchInsuranceDetail(widget.insuranceId);
                              }
                            },
                          ),
                          const SizedBox(height: 10),
                          CustomButton(
                            text: 'Xóa bản ghi bảo hiểm',
                            variant: ButtonVariant.danger,
                            icon: const Icon(Icons.delete_outline, size: 18),
                            onPressed: () => _confirmDelete(record),
                          ),
                        ],
                      ],
                    ),
                  ),
      ),
    );
  }

  Widget _buildDetailRow(String label, String value, bool isDark, {Color? valueColor}) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: 13,
            color: isDark ? AppColors.neutral400 : AppColors.neutral500,
          ),
        ),
        const SizedBox(width: 12),
        Flexible(
          child: Text(
            value,
            textAlign: TextAlign.right,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w500,
              color: valueColor ?? (isDark ? AppColors.neutral200 : AppColors.neutral800),
            ),
          ),
        ),
      ],
    );
  }
}
