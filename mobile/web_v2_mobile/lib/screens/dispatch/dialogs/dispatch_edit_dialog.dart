import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';
import '../../../data/models/dispatch_schedule.dart';
import '../../../widgets/custom_button.dart';
import '../../../widgets/custom_text_field.dart';

class DispatchEditDialog extends StatefulWidget {
  final DispatchScheduleItem item;
  final Function(String diemNhan, String? tan, String? can, String? ghiChu) onSave;
  final bool isLoading;

  const DispatchEditDialog({
    super.key,
    required this.item,
    required this.onSave,
    this.isLoading = false,
  });

  @override
  State<DispatchEditDialog> createState() => _DispatchEditDialogState();
}

class _DispatchEditDialogState extends State<DispatchEditDialog> {
  late final TextEditingController _diemNhanController;
  late final TextEditingController _tanController;
  late final TextEditingController _canController;
  late final TextEditingController _ghiChuController;

  String? _diemNhanError;

  @override
  void initState() {
    super.initState();
    _diemNhanController = TextEditingController(text: widget.item.diemNhan);
    _tanController = TextEditingController(text: widget.item.tan ?? '');
    _canController = TextEditingController(text: widget.item.can ?? '');
    _ghiChuController = TextEditingController(text: widget.item.ghiChu ?? '');
  }

  @override
  void dispose() {
    _diemNhanController.dispose();
    _tanController.dispose();
    _canController.dispose();
    _ghiChuController.dispose();
    super.dispose();
  }

  void _submit() {
    final diemNhan = _diemNhanController.text.trim();
    if (diemNhan.isEmpty) {
      setState(() => _diemNhanError = 'Vui lòng nhập điểm nhận hàng');
      return;
    }

    final tan = _tanController.text.trim();
    final can = _canController.text.trim();
    final ghiChu = _ghiChuController.text.trim();

    widget.onSave(
      diemNhan,
      tan.isNotEmpty ? tan : null,
      can.isNotEmpty ? can : null,
      ghiChu.isNotEmpty ? ghiChu : null,
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return AlertDialog(
      backgroundColor: isDark ? AppColors.neutral900 : AppColors.white,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      title: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: isDark ? AppColors.neutral800 : AppColors.neutral100,
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(Icons.edit_note, size: 22),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'Chỉnh sửa chuyến xe',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: isDark ? AppColors.neutral100 : AppColors.neutral900,
              ),
            ),
          ),
        ],
      ),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Vehicle Info Header
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: isDark ? AppColors.neutral800.withValues(alpha: 0.6) : AppColors.neutral100.withValues(alpha: 0.8),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        widget.item.bienSo,
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                          color: isDark ? AppColors.neutral100 : AppColors.neutral900,
                        ),
                      ),
                      Text(
                        '${widget.item.loaiTuyen} • ${widget.item.loaiXe}',
                        style: TextStyle(fontSize: 11, color: isDark ? AppColors.neutral400 : AppColors.neutral600),
                      ),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Tài xế: ${widget.item.taiXe ?? "Chưa gán"}',
                    style: TextStyle(fontSize: 12, color: isDark ? AppColors.neutral300 : AppColors.neutral700),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),

            // Điểm nhận
            CustomTextField(
              label: 'Điểm nhận hàng *',
              placeholder: 'Nhập địa chỉ / kho nhận hàng...',
              controller: _diemNhanController,
              errorText: _diemNhanError,
              onChanged: (_) {
                if (_diemNhanError != null) setState(() => _diemNhanError = null);
              },
            ),
            const SizedBox(height: 12),

            // Tấn & CAN row
            Row(
              children: [
                Expanded(
                  child: CustomTextField(
                    label: 'Tấn',
                    placeholder: 'Ví dụ: 2.5',
                    controller: _tanController,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: CustomTextField(
                    label: 'CAN',
                    placeholder: 'Ví dụ: MCC, CLF',
                    controller: _canController,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Ghi chú
            CustomTextField(
              label: 'Ghi chú',
              placeholder: 'Nhập ghi chú cho chuyến...',
              controller: _ghiChuController,
              keyboardType: TextInputType.multiline,
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: widget.isLoading ? null : () => Navigator.of(context).pop(),
          child: const Text('Hủy'),
        ),
        SizedBox(
          width: 120,
          child: CustomButton(
            text: 'Lưu cập nhật',
            size: ButtonSize.sm,
            isLoading: widget.isLoading,
            onPressed: _submit,
          ),
        ),
      ],
    );
  }
}
