import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../core/utils/format_utils.dart';
import '../../providers/dispatch_schedule_provider.dart';
import '../../widgets/app_card.dart';
import '../../widgets/custom_button.dart';
import '../../widgets/custom_text_field.dart';

class DispatchFormScreen extends StatefulWidget {
  final String? initialLoaiTuyen;
  final String? initialLoaiXe;

  const DispatchFormScreen({
    super.key,
    this.initialLoaiTuyen,
    this.initialLoaiXe,
  });

  @override
  State<DispatchFormScreen> createState() => _DispatchFormScreenState();
}

class _DispatchFormScreenState extends State<DispatchFormScreen> {
  final _formKey = GlobalKey<FormState>();

  String _loaiTuyen = 'Tuyến cố định';
  String _loaiXe = 'Xe nhỏ';
  String _xeType = 'Xe nhà'; // 'Xe nhà' | 'Xe ngoài'

  int? _selectedVehicleId;
  String? _selectedPlateNumber;
  String? _selectedDriverName;

  final TextEditingController _customPlateController = TextEditingController();
  final TextEditingController _customDriverController = TextEditingController();
  final TextEditingController _diemNhanController = TextEditingController();
  final TextEditingController _tanController = TextEditingController();
  final TextEditingController _canController = TextEditingController();
  final TextEditingController _ghiChuController = TextEditingController();

  String? _plateError;
  String? _diemNhanError;
  String? _serverError;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    if (widget.initialLoaiTuyen != null) _loaiTuyen = widget.initialLoaiTuyen!;
    if (widget.initialLoaiXe != null) _loaiXe = widget.initialLoaiXe!;

    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<DispatchScheduleProvider>().fetchVehicles();
    });
  }

  @override
  void dispose() {
    _customPlateController.dispose();
    _customDriverController.dispose();
    _diemNhanController.dispose();
    _tanController.dispose();
    _canController.dispose();
    _ghiChuController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _plateError = null;
      _diemNhanError = null;
      _serverError = null;
    });

    String finalPlate;
    String? finalDriver;
    int? finalVehicleId;

    if (_xeType == 'Xe nhà') {
      if (_selectedVehicleId == null || _selectedPlateNumber == null) {
        setState(() => _plateError = 'Vui lòng chọn xe nhà trong danh sách');
        return;
      }
      finalPlate = _selectedPlateNumber!;
      finalDriver = _selectedDriverName;
      finalVehicleId = _selectedVehicleId;
    } else {
      final customPlate = _customPlateController.text.trim();
      if (customPlate.isEmpty) {
        setState(() => _plateError = 'Vui lòng nhập biển số xe ngoài');
        return;
      }
      finalPlate = customPlate;
      finalDriver = _customDriverController.text.trim().isNotEmpty ? _customDriverController.text.trim() : null;
      finalVehicleId = null;
    }

    final diemNhan = _diemNhanController.text.trim();
    if (diemNhan.isEmpty) {
      setState(() => _diemNhanError = 'Vui lòng nhập điểm nhận hàng');
      return;
    }

    final tan = _tanController.text.trim();
    final can = _canController.text.trim();
    final ghiChu = _ghiChuController.text.trim();

    setState(() => _isLoading = true);
    final provider = context.read<DispatchScheduleProvider>();

    try {
      await provider.createSchedule(
        loaiTuyen: _loaiTuyen,
        loaiXe: _loaiXe,
        xeType: _xeType,
        bienSo: finalPlate,
        taiXe: finalDriver,
        vehicleId: finalVehicleId,
        diemNhan: diemNhan,
        tan: tan.isNotEmpty ? tan : null,
        can: can.isNotEmpty ? can : null,
        ghiChu: ghiChu.isNotEmpty ? ghiChu : null,
      );

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Tạo chuyến xe thành công!'), backgroundColor: Colors.green),
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
    final provider = context.watch<DispatchScheduleProvider>();
    final allVehicles = provider.vehicles;

    // Filter company vehicles by loaiXe if Tuyến cố định
    final filteredVehicles = allVehicles.where((v) {
      if (_loaiTuyen == 'Tuyến cố định') {
        return v.vehicleType == _loaiXe;
      }
      return true;
    }).toList();

    return Scaffold(
      backgroundColor: isDark ? AppColors.neutral950 : AppColors.neutral50,
      appBar: AppBar(
        title: Text(
          'Tạo chuyến (${FormatUtils.formatDate(provider.selectedDateStr)})',
          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 17),
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

                // Step 1 & 2: Route & Size Selection Card
                AppCard(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Loại tuyến
                      Text(
                        'Loại tuyến *',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: isDark ? AppColors.neutral300 : AppColors.neutral700,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          Expanded(
                            child: ChoiceChip(
                              label: const Center(child: Text('Tuyến cố định')),
                              selected: _loaiTuyen == 'Tuyến cố định',
                              onSelected: (selected) {
                                if (selected) {
                                  setState(() {
                                    _loaiTuyen = 'Tuyến cố định';
                                    _selectedVehicleId = null;
                                    _selectedPlateNumber = null;
                                  });
                                }
                              },
                              selectedColor: isDark ? AppColors.neutral200 : AppColors.neutral900,
                              labelStyle: TextStyle(
                                fontSize: 12,
                                fontWeight: _loaiTuyen == 'Tuyến cố định' ? FontWeight.bold : FontWeight.normal,
                                color: _loaiTuyen == 'Tuyến cố định'
                                    ? (isDark ? AppColors.neutral900 : AppColors.white)
                                    : (isDark ? AppColors.neutral300 : AppColors.neutral700),
                              ),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: ChoiceChip(
                              label: const Center(child: Text('Tuyến ngoài')),
                              selected: _loaiTuyen == 'Tuyến ngoài',
                              onSelected: (selected) {
                                if (selected) {
                                  setState(() {
                                    _loaiTuyen = 'Tuyến ngoài';
                                    _selectedVehicleId = null;
                                    _selectedPlateNumber = null;
                                  });
                                }
                              },
                              selectedColor: isDark ? AppColors.neutral200 : AppColors.neutral900,
                              labelStyle: TextStyle(
                                fontSize: 12,
                                fontWeight: _loaiTuyen == 'Tuyến ngoài' ? FontWeight.bold : FontWeight.normal,
                                color: _loaiTuyen == 'Tuyến ngoài'
                                    ? (isDark ? AppColors.neutral900 : AppColors.white)
                                    : (isDark ? AppColors.neutral300 : AppColors.neutral700),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),

                      // Cỡ xe
                      Text(
                        'Cỡ xe *',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: isDark ? AppColors.neutral300 : AppColors.neutral700,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          Expanded(
                            child: ChoiceChip(
                              label: const Center(child: Text('Xe nhỏ')),
                              selected: _loaiXe == 'Xe nhỏ',
                              onSelected: (selected) {
                                if (selected) {
                                  setState(() {
                                    _loaiXe = 'Xe nhỏ';
                                    _selectedVehicleId = null;
                                    _selectedPlateNumber = null;
                                  });
                                }
                              },
                              selectedColor: isDark ? AppColors.neutral200 : AppColors.neutral900,
                              labelStyle: TextStyle(
                                fontSize: 12,
                                fontWeight: _loaiXe == 'Xe nhỏ' ? FontWeight.bold : FontWeight.normal,
                                color: _loaiXe == 'Xe nhỏ'
                                    ? (isDark ? AppColors.neutral900 : AppColors.white)
                                    : (isDark ? AppColors.neutral300 : AppColors.neutral700),
                              ),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: ChoiceChip(
                              label: const Center(child: Text('Xe lớn')),
                              selected: _loaiXe == 'Xe lớn',
                              onSelected: (selected) {
                                if (selected) {
                                  setState(() {
                                    _loaiXe = 'Xe lớn';
                                    _selectedVehicleId = null;
                                    _selectedPlateNumber = null;
                                  });
                                }
                              },
                              selectedColor: isDark ? AppColors.neutral200 : AppColors.neutral900,
                              labelStyle: TextStyle(
                                fontSize: 12,
                                fontWeight: _loaiXe == 'Xe lớn' ? FontWeight.bold : FontWeight.normal,
                                color: _loaiXe == 'Xe lớn'
                                    ? (isDark ? AppColors.neutral900 : AppColors.white)
                                    : (isDark ? AppColors.neutral300 : AppColors.neutral700),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),

                      // Loại hình xe: Xe nhà / Xe ngoài
                      Text(
                        'Hình thức xe *',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: isDark ? AppColors.neutral300 : AppColors.neutral700,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          Expanded(
                            child: ChoiceChip(
                              label: const Center(child: Text('Xe nhà')),
                              selected: _xeType == 'Xe nhà',
                              onSelected: (selected) {
                                if (selected) setState(() => _xeType = 'Xe nhà');
                              },
                              selectedColor: isDark ? AppColors.neutral200 : AppColors.neutral900,
                              labelStyle: TextStyle(
                                fontSize: 12,
                                fontWeight: _xeType == 'Xe nhà' ? FontWeight.bold : FontWeight.normal,
                                color: _xeType == 'Xe nhà'
                                    ? (isDark ? AppColors.neutral900 : AppColors.white)
                                    : (isDark ? AppColors.neutral300 : AppColors.neutral700),
                              ),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: ChoiceChip(
                              label: const Center(child: Text('Xe ngoài')),
                              selected: _xeType == 'Xe ngoài',
                              onSelected: (selected) {
                                if (selected) setState(() => _xeType = 'Xe ngoài');
                              },
                              selectedColor: isDark ? AppColors.neutral200 : AppColors.neutral900,
                              labelStyle: TextStyle(
                                fontSize: 12,
                                fontWeight: _xeType == 'Xe ngoài' ? FontWeight.bold : FontWeight.normal,
                                color: _xeType == 'Xe ngoài'
                                    ? (isDark ? AppColors.neutral900 : AppColors.white)
                                    : (isDark ? AppColors.neutral300 : AppColors.neutral700),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),

                // Step 3: Trip Details Card
                AppCard(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Vehicle Selection
                      if (_xeType == 'Xe nhà') ...[
                        Text(
                          'Biển số xe nhà *',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: isDark ? AppColors.neutral300 : AppColors.neutral700,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          decoration: BoxDecoration(
                            color: isDark ? AppColors.neutral800 : AppColors.white,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(
                              color: _plateError != null
                                  ? AppColors.red500
                                  : (isDark ? AppColors.neutral600 : AppColors.neutral300),
                            ),
                          ),
                          child: DropdownButtonHideUnderline(
                            child: DropdownButton<int>(
                              value: _selectedVehicleId,
                              isExpanded: true,
                              hint: Text(
                                provider.isLoadingVehicles ? 'Đang tải xe...' : 'Chọn biển số xe',
                                style: TextStyle(
                                  fontSize: 13,
                                  color: isDark ? AppColors.neutral500 : AppColors.neutral400,
                                ),
                              ),
                              dropdownColor: isDark ? AppColors.neutral900 : AppColors.white,
                              items: filteredVehicles.map((v) {
                                return DropdownMenuItem<int>(
                                  value: v.id,
                                  child: Text(
                                    '${v.plateNumber} ${v.driverName != null ? "(${v.driverName})" : ""}',
                                    style: TextStyle(
                                      fontSize: 13,
                                      color: isDark ? AppColors.neutral100 : AppColors.neutral900,
                                    ),
                                  ),
                                );
                              }).toList(),
                              onChanged: (val) {
                                if (val != null) {
                                  final v = filteredVehicles.firstWhere((element) => element.id == val);
                                  setState(() {
                                    _selectedVehicleId = v.id;
                                    _selectedPlateNumber = v.plateNumber;
                                    _selectedDriverName = v.driverName;
                                    _plateError = null;
                                  });
                                }
                              },
                            ),
                          ),
                        ),
                        if (_selectedDriverName != null) ...[
                          const SizedBox(height: 6),
                          Row(
                            children: [
                              Icon(Icons.person_outline, size: 14, color: isDark ? AppColors.neutral400 : AppColors.neutral500),
                              const SizedBox(width: 4),
                              Text(
                                'Tài xế tự động gán: $_selectedDriverName',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w500,
                                  color: isDark ? Colors.green[300] : Colors.green[700],
                                ),
                              ),
                            ],
                          ),
                        ],
                        if (_plateError != null) ...[
                          const SizedBox(height: 4),
                          Text(_plateError!, style: const TextStyle(fontSize: 12, color: AppColors.red600)),
                        ],
                      ] else ...[
                        CustomTextField(
                          label: 'Biển số xe ngoài *',
                          placeholder: 'Ví dụ: 51H-12345',
                          controller: _customPlateController,
                          errorText: _plateError,
                          onChanged: (_) {
                            if (_plateError != null) setState(() => _plateError = null);
                          },
                        ),
                        const SizedBox(height: 12),
                        CustomTextField(
                          label: 'Tên tài xế (tùy chọn)',
                          placeholder: 'Nhập tên tài xế xe ngoài...',
                          controller: _customDriverController,
                        ),
                      ],
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

                      // Tấn & CAN
                      Row(
                        children: [
                          Expanded(
                            child: CustomTextField(
                              label: 'Số tấn',
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
                        placeholder: 'Nhập ghi chú chuyến (nếu có)...',
                        controller: _ghiChuController,
                        keyboardType: TextInputType.multiline,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),

                // Submit Button
                CustomButton(
                  text: 'Xác nhận tạo chuyến xe',
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
