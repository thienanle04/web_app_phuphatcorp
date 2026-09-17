import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/api/api_endpoints.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/utils/format_utils.dart';
import '../../../data/models/invoice_tracking_ticket.dart';
import '../../../providers/invoice_tracking_provider.dart';
import '../../../widgets/custom_button.dart';
import '../../../widgets/custom_text_field.dart';
import '../../../widgets/invoice_status_badge.dart';

class CopyDocumentsModal extends StatefulWidget {
  final int ticketId;
  final String ticketDate;
  final VoidCallback? onSuccess;

  const CopyDocumentsModal({
    super.key,
    required this.ticketId,
    required this.ticketDate,
    this.onSuccess,
  });

  @override
  State<CopyDocumentsModal> createState() => _CopyDocumentsModalState();
}

class _CopyDocumentsModalState extends State<CopyDocumentsModal> {
  final TextEditingController _searchController = TextEditingController();
  final TextEditingController _noteController = TextEditingController();

  List<CopyableTicket> _copyableTickets = [];
  int? _selectedSourceId;
  bool _isLoading = true;
  String? _errorMessage;
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _loadTickets();
  }

  @override
  void dispose() {
    _searchController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  Future<void> _loadTickets() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final tickets = await context.read<InvoiceTrackingProvider>().fetchCopyableTickets(widget.ticketId);
      if (mounted) {
        setState(() {
          _copyableTickets = tickets;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _errorMessage = e.toString().replaceAll('Exception: ', '');
        });
      }
    }
  }

  List<CopyableTicket> get _filteredTickets {
    final query = _searchController.text.trim().toLowerCase();
    if (query.isEmpty) return _copyableTickets;
    return _copyableTickets.where((tk) {
      final matchPlate = tk.bienSo.toLowerCase().contains(query);
      final matchDriver = tk.taiXe?.toLowerCase().contains(query) ?? false;
      final matchDest = tk.diemNhan.toLowerCase().contains(query);
      return matchPlate || matchDriver || matchDest;
    }).toList();
  }

  CopyableTicket? get _selectedTicket {
    if (_selectedSourceId == null) return null;
    try {
      return _copyableTickets.firstWhere((t) => t.id == _selectedSourceId);
    } catch (_) {
      return null;
    }
  }

  Future<void> _submit() async {
    if (_selectedSourceId == null) return;

    setState(() => _isSubmitting = true);
    final provider = context.read<InvoiceTrackingProvider>();

    try {
      await provider.copyDocuments(
        id: widget.ticketId,
        sourceTicketId: _selectedSourceId!,
        driverNote: _noteController.text.trim().isNotEmpty ? _noteController.text.trim() : null,
      );

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Sao chép chứng từ thành công!'),
          backgroundColor: Colors.green,
        ),
      );
      Navigator.of(context).pop();
      widget.onSuccess?.call();
    } catch (e) {
      if (!mounted) return;
      setState(() => _isSubmitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Sao chép thất bại: $e'),
          backgroundColor: AppColors.red600,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final filtered = _filteredTickets;
    final selected = _selectedTicket;

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.85,
      ),
      decoration: BoxDecoration(
        color: isDark ? AppColors.neutral900 : AppColors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom + 16,
        left: 16,
        right: 16,
        top: 12,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Drag handle
          Center(
            child: Container(
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: isDark ? AppColors.neutral700 : AppColors.neutral300,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 12),

          // Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Sao chép chứng từ (${FormatUtils.formatDate(widget.ticketDate)})',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: isDark ? AppColors.neutral100 : AppColors.neutral900,
                ),
              ),
              IconButton(
                icon: const Icon(Icons.close, size: 20),
                onPressed: () => Navigator.of(context).pop(),
              ),
            ],
          ),
          const SizedBox(height: 8),

          // Info Banner
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: isDark ? Colors.blue.withValues(alpha: 0.15) : const Color(0xFFEFF6FF),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(
                color: isDark ? Colors.blue.withValues(alpha: 0.3) : const Color(0xFFBFDBFE),
              ),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  Icons.copy_rounded,
                  size: 16,
                  color: isDark ? Colors.blue[300] : const Color(0xFF2563EB),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Chọn chuyến xe cùng ngày đã có chứng từ để dùng chung ảnh mà không tốn dung lượng.',
                    style: TextStyle(
                      fontSize: 12,
                      color: isDark ? Colors.blue[200] : const Color(0xFF1E40AF),
                      height: 1.3,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),

          // Search Field
          TextField(
            controller: _searchController,
            onChanged: (_) => setState(() {}),
            style: TextStyle(
              fontSize: 13,
              color: isDark ? AppColors.neutral100 : AppColors.neutral900,
            ),
            decoration: InputDecoration(
              hintText: 'Tìm theo biển số, tài xế, điểm giao...',
              hintStyle: TextStyle(
                fontSize: 12.5,
                color: isDark ? AppColors.neutral500 : AppColors.neutral400,
              ),
              prefixIcon: Icon(
                Icons.search,
                size: 18,
                color: isDark ? AppColors.neutral400 : AppColors.neutral500,
              ),
              suffixIcon: _searchController.text.isNotEmpty
                  ? IconButton(
                      icon: const Icon(Icons.clear, size: 16),
                      onPressed: () {
                        _searchController.clear();
                        setState(() {});
                      },
                    )
                  : null,
              filled: true,
              fillColor: isDark ? AppColors.neutral800 : AppColors.neutral100,
              contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: BorderSide.none,
              ),
            ),
          ),
          const SizedBox(height: 10),

          // List of Copyable Trips
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _errorMessage != null
                    ? Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(_errorMessage!, style: const TextStyle(fontSize: 13, color: AppColors.red600)),
                            const SizedBox(height: 8),
                            TextButton(onPressed: _loadTickets, child: const Text('Thử lại')),
                          ],
                        ),
                      )
                    : filtered.isEmpty
                        ? Center(
                            child: Padding(
                              padding: const EdgeInsets.all(20),
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.local_shipping_outlined, size: 40, color: isDark ? AppColors.neutral700 : AppColors.neutral300),
                                  const SizedBox(height: 8),
                                  Text(
                                    'Chưa có chuyến xe nào khác cùng ngày đã tải lên chứng từ.',
                                    textAlign: TextAlign.center,
                                    style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w500,
                                      color: isDark ? AppColors.neutral400 : AppColors.neutral600,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          )
                        : ListView.separated(
                            itemCount: filtered.length,
                            separatorBuilder: (_, _) => const SizedBox(height: 8),
                            itemBuilder: (context, index) {
                              final tk = filtered[index];
                              final isSelected = _selectedSourceId == tk.id;

                              return GestureDetector(
                                onTap: () => setState(() => _selectedSourceId = tk.id),
                                child: Container(
                                  padding: const EdgeInsets.all(12),
                                  decoration: BoxDecoration(
                                    color: isSelected
                                        ? (isDark ? AppColors.neutral800 : AppColors.neutral100)
                                        : (isDark ? AppColors.neutral900 : AppColors.white),
                                    borderRadius: BorderRadius.circular(10),
                                    border: Border.all(
                                      color: isSelected
                                          ? (isDark ? AppColors.neutral100 : AppColors.neutral900)
                                          : (isDark ? AppColors.neutral700 : AppColors.neutral300),
                                      width: isSelected ? 1.5 : 1,
                                    ),
                                  ),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      // Top: Radio + Biển số + Badge
                                      Row(
                                        children: [
                                          Icon(
                                            isSelected ? Icons.check_circle : Icons.radio_button_unchecked,
                                            size: 18,
                                            color: isSelected
                                                ? (isDark ? AppColors.neutral100 : AppColors.neutral900)
                                                : (isDark ? AppColors.neutral600 : AppColors.neutral400),
                                          ),
                                          const SizedBox(width: 8),
                                          Text(
                                            tk.bienSo,
                                            style: TextStyle(
                                              fontSize: 15,
                                              fontWeight: FontWeight.bold,
                                              color: isDark ? AppColors.neutral100 : AppColors.neutral900,
                                            ),
                                          ),
                                          const SizedBox(width: 8),
                                          Text(
                                            tk.taiXe ?? 'Chưa gán',
                                            style: TextStyle(
                                              fontSize: 12.5,
                                              color: isDark ? AppColors.neutral300 : AppColors.neutral700,
                                            ),
                                          ),
                                          const Spacer(),
                                          InvoiceStatusBadge(status: tk.invoiceStatus),
                                        ],
                                      ),
                                      const SizedBox(height: 6),

                                      // Destination
                                      Row(
                                        children: [
                                          Icon(Icons.location_on_outlined, size: 14, color: isDark ? AppColors.neutral400 : AppColors.neutral500),
                                          const SizedBox(width: 4),
                                          Expanded(
                                            child: Text(
                                              tk.diemNhan,
                                              style: TextStyle(fontSize: 12, color: isDark ? AppColors.neutral400 : AppColors.neutral600),
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                            ),
                                          ),
                                          Text(
                                            '${tk.documentCount} tệp đính kèm',
                                            style: TextStyle(
                                              fontSize: 11,
                                              fontWeight: FontWeight.w600,
                                              color: isDark ? Colors.blue[300] : Colors.blue[700],
                                            ),
                                          ),
                                        ],
                                      ),

                                      // Thumbnail previews if available
                                      if (tk.documents.isNotEmpty) ...[
                                        const SizedBox(height: 8),
                                        SizedBox(
                                          height: 48,
                                          child: ListView.separated(
                                            scrollDirection: Axis.horizontal,
                                            itemCount: tk.documents.length > 5 ? 5 : tk.documents.length,
                                            separatorBuilder: (_, _) => const SizedBox(width: 6),
                                            itemBuilder: (context, dIdx) {
                                              final doc = tk.documents[dIdx];
                                              final isImg = doc.mimeType.startsWith('image/');
                                              final imgUrl = doc.filename != null && doc.filename!.isNotEmpty
                                                  ? ApiEndpoints.invoiceTrackingFile(doc.filename!)
                                                  : null;

                                              Widget thumbWidget;
                                              if (isImg && imgUrl != null) {
                                                thumbWidget = Image.network(
                                                  imgUrl,
                                                  fit: BoxFit.cover,
                                                  errorBuilder: (_, _, _) => const Icon(Icons.image_outlined, size: 20),
                                                );
                                              } else if (isImg && doc.fileData.isNotEmpty) {
                                                try {
                                                  thumbWidget = Image.memory(base64Decode(doc.fileData), fit: BoxFit.cover);
                                                } catch (_) {
                                                  thumbWidget = const Icon(Icons.image, size: 20);
                                                }
                                              } else {
                                                thumbWidget = const Icon(Icons.insert_drive_file, size: 20);
                                              }

                                              return Container(
                                                width: 48,
                                                height: 48,
                                                decoration: BoxDecoration(
                                                  borderRadius: BorderRadius.circular(6),
                                                  border: Border.all(color: isDark ? AppColors.neutral700 : AppColors.neutral300),
                                                ),
                                                child: ClipRRect(
                                                  borderRadius: BorderRadius.circular(5),
                                                  child: thumbWidget,
                                                ),
                                              );
                                            },
                                          ),
                                        ),
                                      ],
                                    ],
                                  ),
                                ),
                              );
                            },
                          ),
          ),

          // Optional driver note
          if (selected != null) ...[
            const SizedBox(height: 10),
            CustomTextField(
              label: 'Ghi chú tài xế (tùy chọn)',
              placeholder: 'Ví dụ: Đi chung điểm nhận hàng với xe ${selected.bienSo}...',
              controller: _noteController,
            ),
          ],
          const SizedBox(height: 14),

          // Submit & Cancel buttons
          Row(
            children: [
              Expanded(
                child: CustomButton(
                  text: 'Hủy',
                  variant: ButtonVariant.outline,
                  onPressed: _isSubmitting ? null : () => Navigator.of(context).pop(),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                flex: 2,
                child: CustomButton(
                  text: selected != null
                      ? 'Sao chép (${selected.documentCount} tệp)'
                      : 'Chọn chuyến xe',
                  isLoading: _isSubmitting,
                  onPressed: selected != null && !_isSubmitting ? _submit : null,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
