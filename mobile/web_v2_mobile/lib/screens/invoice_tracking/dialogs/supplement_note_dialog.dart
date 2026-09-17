import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';
import '../../../widgets/custom_button.dart';
import '../../../widgets/custom_text_field.dart';

class SupplementNoteDialog extends StatefulWidget {
  final Function(String note) onSubmit;
  final bool isLoading;

  const SupplementNoteDialog({
    super.key,
    required this.onSubmit,
    this.isLoading = false,
  });

  @override
  State<SupplementNoteDialog> createState() => _SupplementNoteDialogState();
}

class _SupplementNoteDialogState extends State<SupplementNoteDialog> {
  final TextEditingController _controller = TextEditingController();
  String? _error;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit() {
    final note = _controller.text.trim();
    if (note.isEmpty) {
      setState(() => _error = 'Vui lòng nhập lý do yêu cầu bổ sung');
      return;
    }
    if (note.length < 5) {
      setState(() => _error = 'Lý do phải có ít nhất 5 ký tự');
      return;
    }
    widget.onSubmit(note);
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return AlertDialog(
      backgroundColor: isDark ? AppColors.neutral900 : AppColors.white,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      title: Text(
        'Yêu cầu bổ sung chứng từ',
        style: TextStyle(
          fontSize: 17,
          fontWeight: FontWeight.w600,
          color: isDark ? AppColors.neutral100 : AppColors.neutral900,
        ),
      ),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Nhập hướng dẫn hoặc lý do để tài xế nắm và bổ sung lại hình chụp chứng từ:',
              style: TextStyle(
                fontSize: 13,
                color: isDark ? AppColors.neutral400 : AppColors.neutral600,
              ),
            ),
            const SizedBox(height: 12),
            CustomTextField(
              controller: _controller,
              placeholder: 'Ví dụ: Hình ảnh bị mờ, vui lòng chụp lại phiếu xuất kho...',
              errorText: _error,
              keyboardType: TextInputType.multiline,
              onChanged: (_) {
                if (_error != null) setState(() => _error = null);
              },
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
            text: 'Gửi yêu cầu',
            size: ButtonSize.sm,
            isLoading: widget.isLoading,
            onPressed: _submit,
          ),
        ),
      ],
    );
  }
}
