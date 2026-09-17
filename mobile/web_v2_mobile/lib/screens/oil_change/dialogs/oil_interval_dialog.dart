import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';
import '../../../widgets/custom_button.dart';
import '../../../widgets/custom_text_field.dart';

class OilIntervalDialog extends StatefulWidget {
  final int vehicleId;
  final String plateNumber;
  final int currentIntervalKm;
  final Function(int newIntervalKm) onSave;
  final bool isLoading;

  const OilIntervalDialog({
    super.key,
    required this.vehicleId,
    required this.plateNumber,
    required this.currentIntervalKm,
    required this.onSave,
    this.isLoading = false,
  });

  @override
  State<OilIntervalDialog> createState() => _OilIntervalDialogState();
}

class _OilIntervalDialogState extends State<OilIntervalDialog> {
  late final TextEditingController _controller;
  String? _error;

  final List<int> _presetIntervals = [3000, 4000, 5000, 6000, 8000, 10000];

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.currentIntervalKm.toString());
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit() {
    final text = _controller.text.trim();
    final value = int.tryParse(text);

    if (value == null || value <= 0) {
      setState(() => _error = 'Vui lòng nhập số km định mức hợp lệ (> 0)');
      return;
    }

    widget.onSave(value);
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
            child: const Icon(Icons.settings_outlined, size: 20),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'Định mức xe ${widget.plateNumber}',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: isDark ? AppColors.neutral100 : AppColors.neutral900,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Cài đặt số km định mức giữa 2 lần thay nhớt cho xe này:',
              style: TextStyle(
                fontSize: 13,
                color: isDark ? AppColors.neutral400 : AppColors.neutral600,
              ),
            ),
            const SizedBox(height: 14),

            // Number input
            CustomTextField(
              controller: _controller,
              placeholder: 'Ví dụ: 5000',
              errorText: _error,
              keyboardType: TextInputType.number,
              onChanged: (_) {
                if (_error != null) setState(() => _error = null);
              },
            ),
            const SizedBox(height: 12),

            // Quick Preset Chips
            Text(
              'Gợi ý nhanh:',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: isDark ? AppColors.neutral400 : AppColors.neutral500,
              ),
            ),
            const SizedBox(height: 6),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: _presetIntervals.map((km) {
                final isSelected = _controller.text == km.toString();
                return ChoiceChip(
                  label: Text('${km.toString()} km'),
                  selected: isSelected,
                  onSelected: (selected) {
                    if (selected) {
                      setState(() {
                        _controller.text = km.toString();
                        _error = null;
                      });
                    }
                  },
                  labelStyle: TextStyle(
                    fontSize: 11,
                    fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                    color: isSelected
                        ? (isDark ? AppColors.neutral900 : AppColors.white)
                        : (isDark ? AppColors.neutral300 : AppColors.neutral700),
                  ),
                  backgroundColor: isDark ? AppColors.neutral800 : AppColors.neutral100,
                  selectedColor: isDark ? AppColors.neutral200 : AppColors.neutral900,
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  visualDensity: VisualDensity.compact,
                );
              }).toList(),
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
            text: 'Lưu định mức',
            size: ButtonSize.sm,
            isLoading: widget.isLoading,
            onPressed: _submit,
          ),
        ),
      ],
    );
  }
}
