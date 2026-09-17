import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../core/utils/format_utils.dart';
import '../../providers/invoice_tracking_provider.dart';
import '../../widgets/app_card.dart';
import '../../widgets/custom_button.dart';
import '../../widgets/invoice_status_badge.dart';
import '../invoice_tracking/ticket_detail_screen.dart';

class InvoiceTrackingScreen extends StatefulWidget {
  const InvoiceTrackingScreen({super.key});

  @override
  State<InvoiceTrackingScreen> createState() => _InvoiceTrackingScreenState();
}

class _InvoiceTrackingScreenState extends State<InvoiceTrackingScreen> {
  final TextEditingController _searchController = TextEditingController();

  final List<Map<String, String>> _statusFilters = [
    {'value': '', 'label': 'Tất cả'},
    {'value': 'created', 'label': 'Tạo mới'},
    {'value': 'pending_review', 'label': 'Chờ duyệt'},
    {'value': 'completed', 'label': 'Hoàn thành'},
    {'value': 'request_supplement', 'label': 'Yêu cầu bổ sung'},
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        context.read<InvoiceTrackingProvider>().fetchTickets();
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
    final provider = context.watch<InvoiceTrackingProvider>();

    return Scaffold(
      backgroundColor: isDark ? AppColors.neutral950 : AppColors.neutral50,
      appBar: AppBar(
        title: const Text(
          'Theo dõi hóa đơn',
          style: TextStyle(fontWeight: FontWeight.w600, fontSize: 18),
        ),
        backgroundColor: isDark ? AppColors.neutral900 : AppColors.white,
        foregroundColor: isDark ? AppColors.neutral100 : AppColors.neutral900,
        elevation: 0.5,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, size: 22),
            tooltip: 'Làm mới',
            onPressed: () => provider.fetchTickets(isRefresh: true),
          ),
        ],
      ),
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
                      hintText: 'Tìm theo biển số, tài xế, điểm nhận...',
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
                        final isSelected = (provider.selectedStatus ?? '') == item['value'];

                        return FilterChip(
                          label: Text(item['label']!),
                          selected: isSelected,
                          onSelected: (_) => provider.setStatus(item['value']),
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

            // Tickets List & States
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
                                  onPressed: () => provider.fetchTickets(),
                                ),
                              ],
                            ),
                          ),
                        )
                      : provider.tickets.isEmpty
                          ? Center(
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    Icons.receipt_long_outlined,
                                    size: 56,
                                    color: isDark ? AppColors.neutral700 : AppColors.neutral300,
                                  ),
                                  const SizedBox(height: 12),
                                  Text(
                                    'Không tìm thấy chuyến xe nào.',
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
                              onRefresh: () => provider.fetchTickets(isRefresh: true),
                              child: ListView.separated(
                                padding: const EdgeInsets.all(16),
                                itemCount: provider.tickets.length,
                                separatorBuilder: (_, _) => const SizedBox(height: 12),
                                itemBuilder: (context, index) {
                                  final ticket = provider.tickets[index];
                                  final docCount = ticket.documents.length;

                                  return GestureDetector(
                                    onTap: () {
                                      Navigator.push(
                                        context,
                                        MaterialPageRoute(
                                          builder: (_) => TicketDetailScreen(ticketId: ticket.id),
                                        ),
                                      );
                                    },
                                    child: AppCard(
                                      padding: const EdgeInsets.all(16),
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          // Top Row: Biển số & Badge Status
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
                                                    ticket.bienSo,
                                                    style: TextStyle(
                                                      fontSize: 16,
                                                      fontWeight: FontWeight.bold,
                                                      color: isDark ? AppColors.neutral100 : AppColors.neutral900,
                                                    ),
                                                  ),
                                                ],
                                              ),
                                              InvoiceStatusBadge(status: ticket.invoiceStatus),
                                            ],
                                          ),
                                          const SizedBox(height: 12),

                                          // Info Grid
                                          Row(
                                            children: [
                                              Expanded(
                                                child: Row(
                                                  children: [
                                                    Icon(
                                                      Icons.calendar_today_outlined,
                                                      size: 14,
                                                      color: isDark ? AppColors.neutral400 : AppColors.neutral500,
                                                    ),
                                                    const SizedBox(width: 6),
                                                    Text(
                                                      FormatUtils.formatDate(ticket.ngay),
                                                      style: TextStyle(
                                                        fontSize: 13,
                                                        color: isDark ? AppColors.neutral300 : AppColors.neutral700,
                                                      ),
                                                    ),
                                                  ],
                                                ),
                                              ),
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
                                                        ticket.taiXe ?? 'Chưa gán',
                                                        style: TextStyle(
                                                          fontSize: 13,
                                                          fontWeight: FontWeight.w500,
                                                          color: isDark ? AppColors.neutral200 : AppColors.neutral800,
                                                        ),
                                                        overflow: TextOverflow.ellipsis,
                                                      ),
                                                    ),
                                                  ],
                                                ),
                                              ),
                                            ],
                                          ),
                                          const SizedBox(height: 8),

                                          // Điểm nhận
                                          Row(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Icon(
                                                Icons.location_on_outlined,
                                                size: 15,
                                                color: isDark ? AppColors.neutral400 : AppColors.neutral500,
                                              ),
                                              const SizedBox(width: 6),
                                              Expanded(
                                                child: Text(
                                                  ticket.diemNhan.isNotEmpty ? ticket.diemNhan : '—',
                                                  style: TextStyle(
                                                    fontSize: 13,
                                                    color: isDark ? AppColors.neutral400 : AppColors.neutral600,
                                                  ),
                                                  maxLines: 2,
                                                  overflow: TextOverflow.ellipsis,
                                                ),
                                              ),
                                            ],
                                          ),
                                          const SizedBox(height: 12),
                                          const Divider(height: 1),
                                          const SizedBox(height: 10),

                                          // Card Footer: Document count & Action hint
                                          Row(
                                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                            children: [
                                              Row(
                                                children: [
                                                  Icon(
                                                    Icons.photo_library_outlined,
                                                    size: 15,
                                                    color: docCount > 0 ? Colors.blue[600] : AppColors.neutral400,
                                                  ),
                                                  const SizedBox(width: 6),
                                                  Text(
                                                    docCount > 0
                                                        ? '$docCount chứng từ đã tải'
                                                        : 'Chưa có chứng từ',
                                                    style: TextStyle(
                                                      fontSize: 12,
                                                      fontWeight: docCount > 0 ? FontWeight.w500 : FontWeight.normal,
                                                      color: docCount > 0
                                                          ? (isDark ? Colors.blue[300] : Colors.blue[700])
                                                          : (isDark ? AppColors.neutral500 : AppColors.neutral400),
                                                    ),
                                                  ),
                                                ],
                                              ),
                                              Row(
                                                children: [
                                                  Text(
                                                    'Chi tiết',
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
