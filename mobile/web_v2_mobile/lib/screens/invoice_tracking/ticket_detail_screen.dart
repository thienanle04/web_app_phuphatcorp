import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/api/api_endpoints.dart';
import '../../core/constants/app_colors.dart';
import '../../core/utils/format_utils.dart';
import '../../data/models/invoice_tracking_ticket.dart';
import '../../providers/auth_provider.dart';
import '../../providers/invoice_tracking_provider.dart';
import '../../widgets/app_card.dart';
import '../../widgets/custom_button.dart';
import '../../widgets/invoice_status_badge.dart';
import 'dialogs/confirm_finish_dialog.dart';
import 'dialogs/copy_documents_modal.dart';
import 'dialogs/document_viewer_dialog.dart';
import 'dialogs/supplement_note_dialog.dart';
import 'dialogs/upload_documents_modal.dart';

class TicketDetailScreen extends StatefulWidget {
  final int ticketId;

  const TicketDetailScreen({super.key, required this.ticketId});

  @override
  State<TicketDetailScreen> createState() => _TicketDetailScreenState();
}

class _TicketDetailScreenState extends State<TicketDetailScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<InvoiceTrackingProvider>().fetchTicketDetail(widget.ticketId);
    });
  }

  void _openCopyModal(BuildContext screenContext, String ticketDate) {
    showModalBottomSheet(
      context: screenContext,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (modalContext) => CopyDocumentsModal(
        ticketId: widget.ticketId,
        ticketDate: ticketDate,
        onSuccess: () {
          context.read<InvoiceTrackingProvider>().fetchTicketDetail(widget.ticketId);
        },
      ),
    );
  }

  void _openUploadModal(BuildContext screenContext) {
    showModalBottomSheet(
      context: screenContext,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (modalContext) => UploadDocumentsModal(
        onUpload: (files, driverNote) async {
          Navigator.of(modalContext).pop();
          try {
            final provider = screenContext.read<InvoiceTrackingProvider>();
            await provider.uploadDocuments(
              id: widget.ticketId,
              files: files,
              driverNote: driverNote,
            );
            if (!mounted) return;
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Tải lên chứng từ thành công!'),
                backgroundColor: Colors.green,
              ),
            );
          } catch (e) {
            if (!mounted) return;
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('Tải lên thất bại: $e'),
                backgroundColor: AppColors.red600,
              ),
            );
          }
        },
      ),
    );
  }

  void _openSupplementDialog(BuildContext screenContext) {
    showDialog(
      context: screenContext,
      builder: (dialogContext) => SupplementNoteDialog(
        onSubmit: (note) async {
          Navigator.of(dialogContext).pop();
          try {
            final provider = screenContext.read<InvoiceTrackingProvider>();
            await provider.reviewTicket(
              id: widget.ticketId,
              action: 'request_supplement',
              supplementNote: note,
            );
            if (!mounted) return;
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Đã gửi yêu cầu bổ sung thành công!'),
                backgroundColor: Colors.orange,
              ),
            );
          } catch (e) {
            if (!mounted) return;
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('Thao tác thất bại: $e'),
                backgroundColor: AppColors.red600,
              ),
            );
          }
        },
      ),
    );
  }

  void _openConfirmFinishDialog(BuildContext screenContext) {
    showDialog(
      context: screenContext,
      builder: (dialogContext) => ConfirmFinishDialog(
        onConfirm: () async {
          Navigator.of(dialogContext).pop();
          try {
            final provider = screenContext.read<InvoiceTrackingProvider>();
            await provider.reviewTicket(
              id: widget.ticketId,
              action: 'finish',
            );
            if (!mounted) return;
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Đã xác nhận hoàn thành ticket!'),
                backgroundColor: Colors.green,
              ),
            );
          } catch (e) {
            if (!mounted) return;
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('Thao tác thất bại: $e'),
                backgroundColor: AppColors.red600,
              ),
            );
          }
        },
      ),
    );
  }

  void _viewDocument(BuildContext context, DocumentFile doc, List<DocumentFile> allDocs, int index) {
    showDialog(
      context: context,
      builder: (_) => DocumentViewerDialog(
        document: doc,
        documents: allDocs,
        initialIndex: index,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final provider = context.watch<InvoiceTrackingProvider>();
    final authProvider = context.watch<AuthProvider>();
    final ticket = provider.selectedTicket;

    // Permissions: Check dynamic backend evaluation or Admin / Dispatcher roles
    final canUpload = ticket?.userPermissions?.canUpload ??
        (ticket != null && (ticket.invoiceStatus == 'created' || ticket.invoiceStatus == 'request_supplement'));
    final canFinish = ticket?.userPermissions?.canFinish ??
        (authProvider.user?.role == 'ADMIN' && ticket?.invoiceStatus == 'pending_review');
    final canRequestSupplement = ticket?.userPermissions?.canRequestSupplement ??
        (authProvider.user?.role == 'ADMIN' && ticket?.invoiceStatus == 'pending_review');

    return Scaffold(
      backgroundColor: isDark ? AppColors.neutral950 : AppColors.neutral50,
      appBar: AppBar(
        title: Text(
          ticket != null ? 'Chuyến ${ticket.bienSo}' : 'Chi tiết chuyến xe',
          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 18),
        ),
        backgroundColor: isDark ? AppColors.neutral900 : AppColors.white,
        foregroundColor: isDark ? AppColors.neutral100 : AppColors.neutral900,
        elevation: 0.5,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => provider.fetchTicketDetail(widget.ticketId),
          ),
        ],
      ),
      body: SafeArea(
        child: provider.isLoadingDetail && ticket == null
            ? const Center(child: CircularProgressIndicator())
            : ticket == null
                ? Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.error_outline, size: 48, color: AppColors.red500),
                        const SizedBox(height: 12),
                        const Text('Không tìm thấy thông tin chuyến xe'),
                        const SizedBox(height: 16),
                        CustomButton(
                          text: 'Thử lại',
                          size: ButtonSize.sm,
                          isFullWidth: false,
                          onPressed: () => provider.fetchTicketDetail(widget.ticketId),
                        ),
                      ],
                    ),
                  )
                : SingleChildScrollView(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Card 1: Trip Info Summary
                        AppCard(
                          padding: const EdgeInsets.all(18),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: Row(
                                      children: [
                                        Container(
                                          padding: const EdgeInsets.all(8),
                                          decoration: BoxDecoration(
                                            color: isDark ? AppColors.neutral800 : AppColors.neutral100,
                                            borderRadius: BorderRadius.circular(8),
                                          ),
                                          child: const Icon(Icons.local_shipping, size: 20),
                                        ),
                                        const SizedBox(width: 10),
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                ticket.bienSo,
                                                style: TextStyle(
                                                  fontSize: 17,
                                                  fontWeight: FontWeight.bold,
                                                  color: isDark ? AppColors.neutral100 : AppColors.neutral900,
                                                ),
                                                overflow: TextOverflow.ellipsis,
                                              ),
                                              Text(
                                                '${ticket.loaiTuyen} • ${ticket.loaiXe}',
                                                style: TextStyle(
                                                  fontSize: 12,
                                                  color: isDark ? AppColors.neutral400 : AppColors.neutral500,
                                                ),
                                                overflow: TextOverflow.ellipsis,
                                              ),
                                            ],
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  InvoiceStatusBadge(status: ticket.invoiceStatus),
                                ],
                              ),
                              const SizedBox(height: 16),
                              const Divider(height: 1),
                              const SizedBox(height: 14),

                              _buildDetailRow('Ngày vận chuyển', FormatUtils.formatDate(ticket.ngay), isDark),
                              const SizedBox(height: 8),
                              _buildDetailRow('Tài xế', ticket.taiXe ?? 'Chưa gán', isDark),
                              const SizedBox(height: 8),
                              _buildDetailRow('Điểm nhận', ticket.diemNhan.isNotEmpty ? ticket.diemNhan : '—', isDark),
                              const SizedBox(height: 8),
                              _buildDetailRow('Điểm trả', ticket.tan ?? '—', isDark),
                              if (ticket.ghiChu != null && ticket.ghiChu!.isNotEmpty) ...[
                                const SizedBox(height: 8),
                                _buildDetailRow('Ghi chú chuyến', ticket.ghiChu!, isDark),
                              ],
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),

                        // Card 2: Supplement/Driver Notes (if any)
                        if (ticket.supplementNote != null || ticket.driverNote != null) ...[
                          AppCard(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                if (ticket.supplementNote != null && ticket.supplementNote!.isNotEmpty) ...[
                                  Container(
                                    width: double.infinity,
                                    padding: const EdgeInsets.all(12),
                                    decoration: BoxDecoration(
                                      color: isDark ? AppColors.red900.withValues(alpha: 0.25) : AppColors.red50,
                                      borderRadius: BorderRadius.circular(8),
                                      border: Border.all(color: isDark ? AppColors.red800 : AppColors.red200),
                                    ),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        const Row(
                                          children: [
                                            Icon(Icons.warning_amber_rounded, size: 16, color: AppColors.red600),
                                            SizedBox(width: 6),
                                            Text(
                                              'Yêu cầu bổ sung từ Điều phối:',
                                              style: TextStyle(
                                                fontSize: 12,
                                                fontWeight: FontWeight.w600,
                                                color: AppColors.red700,
                                              ),
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          ticket.supplementNote!,
                                          style: TextStyle(
                                            fontSize: 13,
                                            color: isDark ? AppColors.red300 : AppColors.red700,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(height: 10),
                                ],
                                if (ticket.driverNote != null && ticket.driverNote!.isNotEmpty) ...[
                                  Container(
                                    width: double.infinity,
                                    padding: const EdgeInsets.all(12),
                                    decoration: BoxDecoration(
                                      color: isDark ? AppColors.neutral800 : AppColors.neutral100,
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          'Ghi chú tài xế:',
                                          style: TextStyle(
                                            fontSize: 12,
                                            fontWeight: FontWeight.w600,
                                            color: isDark ? AppColors.neutral300 : AppColors.neutral700,
                                          ),
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          ticket.driverNote!,
                                          style: TextStyle(
                                            fontSize: 13,
                                            color: isDark ? AppColors.neutral200 : AppColors.neutral800,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),
                          const SizedBox(height: 16),
                        ],

                        // Card 3: Attached Documents
                        AppCard(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Expanded(
                                    child: Text(
                                      'Chứng từ (${ticket.documents.length})',
                                      style: TextStyle(
                                        fontSize: 15,
                                        fontWeight: FontWeight.bold,
                                        color: isDark ? AppColors.neutral100 : AppColors.neutral900,
                                      ),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                  if (canUpload)
                                    TextButton.icon(
                                      onPressed: () => _openUploadModal(context),
                                      icon: const Icon(Icons.add_photo_alternate_outlined, size: 16),
                                      label: const Text('Thêm ảnh', style: TextStyle(fontSize: 12.5)),
                                    ),
                                ],
                              ),
                              const SizedBox(height: 12),

                              if (ticket.documents.isEmpty) ...[
                                Center(
                                  child: Padding(
                                    padding: const EdgeInsets.symmetric(vertical: 20),
                                    child: Column(
                                      children: [
                                        Icon(
                                          Icons.photo_library_outlined,
                                          size: 40,
                                          color: isDark ? AppColors.neutral700 : AppColors.neutral300,
                                        ),
                                        const SizedBox(height: 8),
                                        Text(
                                          'Chưa có chứng từ / hóa đơn nào được tải lên.',
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
                                  itemCount: ticket.documents.length,
                                  itemBuilder: (context, idx) {
                                    final doc = ticket.documents[idx];
                                    final isImg = doc.mimeType.startsWith('image/');

                                    Widget thumbnail;
                                    if (doc.isMinIO && isImg) {
                                      final imgUrl = ApiEndpoints.invoiceTrackingFile(doc.filename!);
                                      thumbnail = Image.network(
                                        imgUrl,
                                        fit: BoxFit.cover,
                                        loadingBuilder: (_, child, progress) {
                                          if (progress == null) return child;
                                          return const Center(child: CircularProgressIndicator(strokeWidth: 2));
                                        },
                                        errorBuilder: (_, _, _) => const Icon(Icons.broken_image_outlined, size: 28),
                                      );
                                    } else if (doc.fileData.isNotEmpty && isImg) {
                                      try {
                                        final bytes = base64Decode(doc.fileData);
                                        thumbnail = Image.memory(bytes, fit: BoxFit.cover);
                                      } catch (_) {
                                        thumbnail = const Icon(Icons.broken_image, size: 32);
                                      }
                                    } else {
                                      thumbnail = const Icon(Icons.insert_drive_file, size: 32);
                                    }

                                    return GestureDetector(
                                      onTap: () => _viewDocument(context, doc, ticket.documents, idx),
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
                                              thumbnail,

                                              // Copied source badge
                                              if (doc.isCopied)
                                                Positioned(
                                                  top: 3,
                                                  left: 3,
                                                  child: Container(
                                                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1.5),
                                                    decoration: BoxDecoration(
                                                      color: Colors.black.withValues(alpha: 0.75),
                                                      borderRadius: BorderRadius.circular(4),
                                                    ),
                                                    child: Row(
                                                      mainAxisSize: MainAxisSize.min,
                                                      children: [
                                                        const Icon(Icons.link, size: 10, color: Colors.lightBlueAccent),
                                                        const SizedBox(width: 2),
                                                        Text(
                                                          doc.sourcePlateNumber!,
                                                          style: const TextStyle(
                                                            fontSize: 9,
                                                            fontWeight: FontWeight.bold,
                                                            color: Colors.white,
                                                          ),
                                                        ),
                                                      ],
                                                    ),
                                                  ),
                                                ),

                                              // File Name footer
                                              Positioned(
                                                bottom: 0,
                                                left: 0,
                                                right: 0,
                                                child: Container(
                                                  color: Colors.black.withValues(alpha: 0.6),
                                                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                                                  child: Text(
                                                    doc.displayName,
                                                    style: const TextStyle(
                                                      fontSize: 10,
                                                      color: Colors.white,
                                                    ),
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
                        const SizedBox(height: 16),

                        // Card 4: Operation History Timeline
                        AppCard(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Lịch sử thao tác (${provider.history.length})',
                                style: TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.bold,
                                  color: isDark ? AppColors.neutral100 : AppColors.neutral900,
                                ),
                              ),
                              const SizedBox(height: 12),

                              if (provider.isLoadingHistory)
                                const Center(
                                  child: Padding(
                                    padding: EdgeInsets.all(12),
                                    child: CircularProgressIndicator(),
                                  ),
                                )
                              else if (provider.history.isEmpty)
                                Text(
                                  'Chưa có lịch sử thao tác.',
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: isDark ? AppColors.neutral500 : AppColors.neutral400,
                                    fontStyle: FontStyle.italic,
                                  ),
                                )
                              else
                                ListView.separated(
                                  shrinkWrap: true,
                                  physics: const NeverScrollableScrollPhysics(),
                                  itemCount: provider.history.length,
                                  separatorBuilder: (_, _) => const SizedBox(height: 12),
                                  itemBuilder: (context, idx) {
                                    final item = provider.history[idx];
                                    return Row(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Container(
                                          margin: const EdgeInsets.only(top: 2),
                                          padding: const EdgeInsets.all(4),
                                          decoration: BoxDecoration(
                                            shape: BoxShape.circle,
                                            color: item.action == 'UPLOAD_DOCUMENTS'
                                                ? Colors.blue[600]
                                                : item.action == 'REVIEW_FINISH'
                                                    ? Colors.green[600]
                                                    : item.action == 'REQUEST_SUPPLEMENT'
                                                        ? Colors.orange[700]
                                                        : AppColors.neutral600,
                                          ),
                                          child: const Icon(Icons.circle, size: 6, color: Colors.white),
                                        ),
                                        const SizedBox(width: 10),
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Row(
                                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                                children: [
                                                  Text(
                                                    item.actionLabel,
                                                    style: TextStyle(
                                                      fontSize: 13,
                                                      fontWeight: FontWeight.w600,
                                                      color: isDark ? AppColors.neutral100 : AppColors.neutral900,
                                                    ),
                                                  ),
                                                  Text(
                                                    FormatUtils.formatDateTime(item.createdAt),
                                                    style: TextStyle(
                                                      fontSize: 11,
                                                      color: isDark ? AppColors.neutral500 : AppColors.neutral400,
                                                    ),
                                                  ),
                                                ],
                                              ),
                                              const SizedBox(height: 2),
                                              Text(
                                                item.userFullName ?? item.username ?? 'Hệ thống',
                                                style: TextStyle(
                                                  fontSize: 12,
                                                  color: isDark ? AppColors.neutral400 : AppColors.neutral600,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ],
                                    );
                                  },
                                ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 24),

                        // Action Buttons Bar
                        if (canUpload) ...[
                          CustomButton(
                            text: 'Sao chép chứng từ cùng ngày',
                            variant: ButtonVariant.outline,
                            icon: const Icon(Icons.copy_rounded, size: 18),
                            onPressed: () => _openCopyModal(context, ticket.ngay),
                          ),
                          const SizedBox(height: 10),
                          CustomButton(
                            text: ticket.documents.isEmpty ? 'Tải lên chứng từ' : 'Bổ sung thêm chứng từ',
                            icon: const Icon(Icons.upload_file_outlined, size: 20),
                            onPressed: () => _openUploadModal(context),
                          ),
                          const SizedBox(height: 10),
                        ],

                        if (canRequestSupplement) ...[
                          CustomButton(
                            text: 'Yêu cầu bổ sung',
                            variant: ButtonVariant.secondary,
                            icon: const Icon(Icons.edit_note, size: 20),
                            onPressed: () => _openSupplementDialog(context),
                          ),
                          const SizedBox(height: 10),
                        ],

                        if (canFinish) ...[
                          CustomButton(
                            text: 'Duyệt hoàn thành',
                            variant: ButtonVariant.primary,
                            icon: const Icon(Icons.check_circle_outline, size: 20),
                            onPressed: () => _openConfirmFinishDialog(context),
                          ),
                          const SizedBox(height: 10),
                        ],
                      ],
                    ),
                  ),
      ),
    );
  }

  Widget _buildDetailRow(String label, String value, bool isDark) {
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
              color: isDark ? AppColors.neutral200 : AppColors.neutral800,
            ),
          ),
        ),
      ],
    );
  }
}
