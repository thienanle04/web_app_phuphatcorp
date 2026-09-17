import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../data/models/oil_change_record.dart';
import '../../providers/oil_change_provider.dart';
import '../../widgets/app_card.dart';
import '../../widgets/custom_button.dart';
import '../../widgets/custom_text_field.dart';

class OilChangeFormScreen extends StatefulWidget {
  final OilChangeRecord? record;
  final int? preselectedVehicleId;

  const OilChangeFormScreen({
    super.key,
    this.record,
    this.preselectedVehicleId,
  });

  @override
  State<OilChangeFormScreen> createState() => _OilChangeFormScreenState();
}

class _OilChangeFormScreenState extends State<OilChangeFormScreen> {
  final _formKey = GlobalKey<FormState>();

  int? _selectedVehicleId;
  DateTime? _changeDate;
  final TextEditingController _odometerController = TextEditingController();
  final TextEditingController _oilTypeController = TextEditingController();
  final TextEditingController _notesController = TextEditingController();

  final List<String> _presetOilTypes = ['15W-40', '20W-50', '10W-40', '5W-30'];

  String? _vehicleError;
  String? _odometerError;
  String? _serverError;
  bool _isLoading = false;

  bool get isEditMode => widget.record != null;

  @override
  void initState() {
    super.initState();
    if (isEditMode) {
      final rec = widget.record!;
      _selectedVehicleId = rec.vehicleId;
      try {
        _changeDate = DateTime.parse(rec.changeDate).toLocal();
      } catch (_) {
        _changeDate = DateTime.now();
      }
      _odometerController.text = rec.odometerAt.toStringAsFixed(rec.odometerAt.truncateToDouble() == rec.odometerAt ? 0 : 1);
      _oilTypeController.text = rec.oilType ?? '';
      _notesController.text = rec.notes ?? '';
    } else {
      _selectedVehicleId = widget.preselectedVehicleId;
      _changeDate = DateTime.now();
      _oilTypeController.text = '15W-40'; // Popular default preset
    }

    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<OilChangeProvider>().fetchVehicles();
    });
  }

  @override
  void dispose() {
    _odometerController.dispose();
    _oilTypeController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _selectChangeDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _changeDate ?? DateTime.now(),
      firstDate: DateTime(2020),
      lastDate: DateTime(2035),
      helpText: 'Chọn ngày thay nhớt',
    );

    if (picked != null) {
      setState(() => _changeDate = picked);
    }
  }

  Future<void> _submit() async {
    setState(() {
      _vehicleError = _selectedVehicleId == null ? 'Vui lòng chọn xe' : null;
      _odometerError = null;
      _serverError = null;
    });

    if (_selectedVehicleId == null) return;

    final odoText = _odometerController.text.trim();
    final odoValue = double.tryParse(odoText);
    if (odoValue == null || odoValue < 0) {
      setState(() => _odometerError = 'Vui lòng nhập số km (ODO) hợp lệ (>= 0)');
      return;
    }

    if (_changeDate == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Vui lòng chọn ngày thay nhớt'), backgroundColor: AppColors.red600),
      );
      return;
    }

    final changeDateStr = DateFormat('yyyy-MM-dd').format(_changeDate!);
    final oilType = _oilTypeController.text.trim();
    final notes = _notesController.text.trim();

    setState(() => _isLoading = true);
    final provider = context.read<OilChangeProvider>();

    try {
      if (isEditMode) {
        await provider.updateOilChange(
          id: widget.record!.id,
          changeDate: changeDateStr,
          odometerAt: odoValue,
          oilType: oilType.isNotEmpty ? oilType : null,
          notes: notes.isNotEmpty ? notes : null,
        );
      } else {
        await provider.createOilChange(
          vehicleId: _selectedVehicleId!,
          changeDate: changeDateStr,
          odometerAt: odoValue,
          oilType: oilType.isNotEmpty ? oilType : null,
          notes: notes.isNotEmpty ? notes : null,
        );
      }

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(isEditMode ? 'Cập nhật thay nhớt thành công!' : 'Ghi nhận thay nhớt thành công!'),
          backgroundColor: Colors.green,
        ),
      );
      Navigator.of(context).pop(true);
    } catch (e) {
      setState(() {
        _isLoading = false;
        _serverError = e.toString().replaceAll('Exception: ', '');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final provider = context.watch<OilChangeProvider>();
    final vehicles = provider.vehicles;

    return Scaffold(
      backgroundColor: isDark ? AppColors.neutral950 : AppColors.neutral50,
      appBar: AppBar(
        title: Text(
          isEditMode ? 'Chỉnh sửa lần thay nhớt' : 'Ghi nhận thay nhớt',
          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 18),
        ),
        backgroundColor: isDark ? AppColors.neutral900 : AppColors.white,
        foregroundColor: isDark ? AppColors.neutral100 : AppColors.neutral900,
        elevation: 0.5,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (_serverError != null) ...[
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: isDark ? AppColors.red900.withValues(alpha: 0.3) : AppColors.red50,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: isDark ? AppColors.red800 : AppColors.red200),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.error_outline, size: 18, color: AppColors.red600),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(_serverError!, style: const TextStyle(fontSize: 13, color: AppColors.red600)),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                ],

                // Form Container Card
                AppCard(
                  padding: const EdgeInsets.all(18),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Vehicle Selection
                      Text(
                        'Xe vận chuyển *',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                          color: isDark ? AppColors.neutral300 : AppColors.neutral700,
                        ),
                      ),
                      const SizedBox(height: 6),
                      if (isEditMode && widget.record != null) ...[
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                          decoration: BoxDecoration(
                            color: isDark ? AppColors.neutral800 : AppColors.neutral100,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: isDark ? AppColors.neutral700 : AppColors.neutral300),
                          ),
                          child: Text(
                            '${widget.record?.plateNumber ?? ''} ${widget.record?.driverName != null ? '(${widget.record?.driverName})' : ''}',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: isDark ? AppColors.neutral200 : AppColors.neutral800,
                            ),
                          ),
                        ),
                      ] else ...[
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          decoration: BoxDecoration(
                            color: isDark ? AppColors.neutral800 : AppColors.white,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(
                              color: _vehicleError != null
                                  ? AppColors.red500
                                  : (isDark ? AppColors.neutral600 : AppColors.neutral300),
                            ),
                          ),
                          child: DropdownButtonHideUnderline(
                            child: DropdownButton<int>(
                              value: _selectedVehicleId,
                              isExpanded: true,
                              hint: Text(
                                provider.isLoadingVehicles ? 'Đang tải danh sách xe...' : 'Chọn biển số xe',
                                style: TextStyle(
                                  fontSize: 14,
                                  color: isDark ? AppColors.neutral500 : AppColors.neutral400,
                                ),
                              ),
                              dropdownColor: isDark ? AppColors.neutral900 : AppColors.white,
                              items: vehicles.map((v) {
                                return DropdownMenuItem<int>(
                                  value: v.id,
                                  child: Text(
                                    '${v.plateNumber} ${v.driverName != null && v.driverName!.isNotEmpty ? '- ${v.driverName}' : ''}',
                                    style: TextStyle(
                                      fontSize: 14,
                                      color: isDark ? AppColors.neutral100 : AppColors.neutral900,
                                    ),
                                  ),
                                );
                              }).toList(),
                              onChanged: (val) {
                                setState(() {
                                  _selectedVehicleId = val;
                                  _vehicleError = null;
                                });
                              },
                            ),
                          ),
                        ),
                        if (_vehicleError != null) ...[
                          const SizedBox(height: 4),
                          Text(_vehicleError!, style: const TextStyle(fontSize: 12, color: AppColors.red600)),
                        ],
                      ],
                      const SizedBox(height: 16),

                      // Change Date Picker
                      Text(
                        'Ngày thay nhớt *',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                          color: isDark ? AppColors.neutral300 : AppColors.neutral700,
                        ),
                      ),
                      const SizedBox(height: 6),
                      GestureDetector(
                        onTap: _selectChangeDate,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                          decoration: BoxDecoration(
                            color: isDark ? AppColors.neutral800 : AppColors.white,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: isDark ? AppColors.neutral600 : AppColors.neutral300),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                _changeDate != null
                                    ? DateFormat('dd/MM/yyyy').format(_changeDate!)
                                    : 'Chọn ngày thay',
                                style: TextStyle(
                                  fontSize: 14,
                                  color: isDark ? AppColors.neutral100 : AppColors.neutral900,
                                ),
                              ),
                              Icon(Icons.calendar_today_outlined, size: 18, color: isDark ? AppColors.neutral400 : AppColors.neutral500),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),

                      // Odometer Input
                      CustomTextField(
                        label: 'Số km (ODO) lúc thay nhớt *',
                        placeholder: 'Ví dụ: 154200',
                        controller: _odometerController,
                        errorText: _odometerError,
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        onChanged: (_) {
                          if (_odometerError != null) setState(() => _odometerError = null);
                        },
                      ),
                      const SizedBox(height: 16),

                      // Oil Type Input & Preset Chips
                      CustomTextField(
                        label: 'Loại nhớt',
                        placeholder: 'Ví dụ: 15W-40',
                        controller: _oilTypeController,
                      ),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: _presetOilTypes.map((type) {
                          final isSelected = _oilTypeController.text == type;
                          return ChoiceChip(
                            label: Text(type),
                            selected: isSelected,
                            onSelected: (selected) {
                              if (selected) {
                                setState(() => _oilTypeController.text = type);
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
                      const SizedBox(height: 16),

                      // Notes Input
                      CustomTextField(
                        label: 'Ghi chú',
                        placeholder: 'Nhập ghi chú lần thay nhớt (nếu có)...',
                        controller: _notesController,
                        keyboardType: TextInputType.multiline,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),

                // Submit Button
                CustomButton(
                  text: isEditMode ? 'Lưu cập nhật' : 'Xác nhận ghi nhận',
                  isLoading: _isLoading || provider.isSubmitting,
                  onPressed: _submit,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
