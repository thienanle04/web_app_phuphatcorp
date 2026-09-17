import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../core/api/api_endpoints.dart';
import '../../core/constants/app_colors.dart';
import '../../data/models/inspection_record.dart';
import '../../providers/inspection_provider.dart';
import '../../widgets/app_card.dart';
import '../../widgets/custom_button.dart';
import '../../widgets/custom_text_field.dart';

class InspectionFormScreen extends StatefulWidget {
  final InspectionRecord? inspection;
  final int? preselectedVehicleId;

  const InspectionFormScreen({
    super.key,
    this.inspection,
    this.preselectedVehicleId,
  });

  @override
  State<InspectionFormScreen> createState() => _InspectionFormScreenState();
}

class _InspectionFormScreenState extends State<InspectionFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final ImagePicker _picker = ImagePicker();

  int? _selectedVehicleId;
  DateTime? _inspectionDate;
  DateTime? _expiryDate;
  final TextEditingController _notesController = TextEditingController();

  final List<XFile> _newImages = [];
  List<InspectionImage> _existingImages = [];

  String? _vehicleError;
  String? _dateError;
  String? _serverError;
  bool _isLoading = false;

  bool get isEditMode => widget.inspection != null;

  @override
  void initState() {
    super.initState();
    if (isEditMode) {
      final ins = widget.inspection!;
      _selectedVehicleId = ins.vehicleId;
      try {
        _inspectionDate = DateTime.parse(ins.inspectionDate).toLocal();
      } catch (_) {}
      try {
        _expiryDate = DateTime.parse(ins.expiryDate).toLocal();
      } catch (_) {}
      _notesController.text = ins.notes ?? '';
      _existingImages = List.from(ins.images);
    } else {
      _selectedVehicleId = widget.preselectedVehicleId;
      _inspectionDate = DateTime.now();
      _expiryDate = DateTime.now().add(const Duration(days: 180)); // 6 months default
    }

    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<InspectionProvider>().fetchVehicles();
    });
  }

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _pickImage(ImageSource source) async {
    try {
      if (source == ImageSource.camera) {
        final XFile? photo = await _picker.pickImage(
          source: ImageSource.camera,
          imageQuality: 85,
          maxWidth: 1600,
        );
        if (photo != null) {
          setState(() => _newImages.add(photo));
        }
      } else {
        final List<XFile> photos = await _picker.pickMultiImage(
          imageQuality: 85,
          maxWidth: 1600,
        );
        if (photos.isNotEmpty) {
          setState(() => _newImages.addAll(photos));
        }
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Lỗi chọn ảnh: $e'), backgroundColor: AppColors.red600),
      );
    }
  }

  Future<void> _selectDate({required bool isInspectionDate}) async {
    final initialDate = isInspectionDate
        ? (_inspectionDate ?? DateTime.now())
        : (_expiryDate ?? DateTime.now().add(const Duration(days: 180)));

    final picked = await showDatePicker(
      context: context,
      initialDate: initialDate,
      firstDate: DateTime(2020),
      lastDate: DateTime(2035),
      helpText: isInspectionDate ? 'Chọn ngày đăng kiểm' : 'Chọn ngày hết hạn',
    );

    if (picked != null) {
      setState(() {
        if (isInspectionDate) {
          _inspectionDate = picked;
        } else {
          _expiryDate = picked;
        }
        _dateError = null;
      });
    }
  }

  Future<void> _deleteExistingImage(InspectionImage img) async {
    try {
      await context.read<InspectionProvider>().deleteImage(widget.inspection!.id, img.id);
      setState(() {
        _existingImages.removeWhere((i) => i.id == img.id);
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Đã xóa hình ảnh'), backgroundColor: Colors.green),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Không thể xóa ảnh: $e'), backgroundColor: AppColors.red600),
        );
      }
    }
  }

  Future<void> _submit() async {
    setState(() {
      _vehicleError = _selectedVehicleId == null ? 'Vui lòng chọn xe' : null;
      _dateError = null;
      _serverError = null;
    });

    if (_selectedVehicleId == null) return;

    if (_inspectionDate == null || _expiryDate == null) {
      setState(() => _dateError = 'Vui lòng chọn đầy đủ ngày đăng kiểm và ngày hết hạn');
      return;
    }

    if (_expiryDate!.isBefore(_inspectionDate!) || _expiryDate!.isAtSameMomentAs(_inspectionDate!)) {
      setState(() => _dateError = 'Ngày hết hạn phải sau ngày đăng kiểm');
      return;
    }

    final inspectionDateStr = DateFormat('yyyy-MM-dd').format(_inspectionDate!);
    final expiryDateStr = DateFormat('yyyy-MM-dd').format(_expiryDate!);
    final notes = _notesController.text.trim();

    setState(() => _isLoading = true);
    final provider = context.read<InspectionProvider>();

    try {
      if (isEditMode) {
        await provider.updateInspection(
          id: widget.inspection!.id,
          inspectionDate: inspectionDateStr,
          expiryDate: expiryDateStr,
          notes: notes,
          newImages: _newImages,
        );
      } else {
        await provider.createInspection(
          vehicleId: _selectedVehicleId!,
          inspectionDate: inspectionDateStr,
          expiryDate: expiryDateStr,
          notes: notes,
          images: _newImages,
        );
      }

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(isEditMode ? 'Cập nhật đăng kiểm thành công!' : 'Tạo mới đăng kiểm thành công!'),
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
    final provider = context.watch<InspectionProvider>();
    final vehicles = provider.vehicles;

    return Scaffold(
      backgroundColor: isDark ? AppColors.neutral950 : AppColors.neutral50,
      appBar: AppBar(
        title: Text(
          isEditMode ? 'Chỉnh sửa đăng kiểm' : 'Tạo mới đăng kiểm',
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

                // Form Card
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
                      if (isEditMode && widget.inspection != null) ...[
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                          decoration: BoxDecoration(
                            color: isDark ? AppColors.neutral800 : AppColors.neutral100,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: isDark ? AppColors.neutral700 : AppColors.neutral300),
                          ),
                          child: Text(
                            '${widget.inspection?.plateNumber ?? ''} ${widget.inspection?.driverName != null ? '(${widget.inspection?.driverName})' : ''}',
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

                      // Dates Row
                      Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Ngày đăng kiểm *',
                                  style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w500,
                                    color: isDark ? AppColors.neutral300 : AppColors.neutral700,
                                  ),
                                ),
                                const SizedBox(height: 6),
                                GestureDetector(
                                  onTap: () => _selectDate(isInspectionDate: true),
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
                                          _inspectionDate != null
                                              ? DateFormat('dd/MM/yyyy').format(_inspectionDate!)
                                              : 'Chọn ngày',
                                          style: TextStyle(
                                            fontSize: 13,
                                            color: isDark ? AppColors.neutral100 : AppColors.neutral900,
                                          ),
                                        ),
                                        Icon(Icons.calendar_today_outlined, size: 16, color: isDark ? AppColors.neutral400 : AppColors.neutral500),
                                      ],
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Ngày hết hạn *',
                                  style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w500,
                                    color: isDark ? AppColors.neutral300 : AppColors.neutral700,
                                  ),
                                ),
                                const SizedBox(height: 6),
                                GestureDetector(
                                  onTap: () => _selectDate(isInspectionDate: false),
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
                                          _expiryDate != null
                                              ? DateFormat('dd/MM/yyyy').format(_expiryDate!)
                                              : 'Chọn ngày',
                                          style: TextStyle(
                                            fontSize: 13,
                                            color: isDark ? AppColors.neutral100 : AppColors.neutral900,
                                          ),
                                        ),
                                        Icon(Icons.event_busy_outlined, size: 16, color: isDark ? AppColors.neutral400 : AppColors.neutral500),
                                      ],
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      if (_dateError != null) ...[
                        const SizedBox(height: 6),
                        Text(_dateError!, style: const TextStyle(fontSize: 12, color: AppColors.red600)),
                      ],
                      const SizedBox(height: 16),

                      // Notes Input
                      CustomTextField(
                        label: 'Ghi chú',
                        placeholder: 'Nhập ghi chú đăng kiểm (nếu có)...',
                        controller: _notesController,
                        keyboardType: TextInputType.multiline,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // Image Upload Card
                AppCard(
                  padding: const EdgeInsets.all(18),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Hình ảnh giấy đăng kiểm',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          color: isDark ? AppColors.neutral100 : AppColors.neutral900,
                        ),
                      ),
                      const SizedBox(height: 12),

                      // Camera and Gallery buttons
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: () => _pickImage(ImageSource.camera),
                              icon: const Icon(Icons.camera_alt_outlined, size: 18),
                              label: const Text('Chụp ảnh', style: TextStyle(fontSize: 13)),
                              style: OutlinedButton.styleFrom(
                                padding: const EdgeInsets.symmetric(vertical: 10),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                              ),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: () => _pickImage(ImageSource.gallery),
                              icon: const Icon(Icons.photo_library_outlined, size: 18),
                              label: const Text('Thư viện', style: TextStyle(fontSize: 13)),
                              style: OutlinedButton.styleFrom(
                                padding: const EdgeInsets.symmetric(vertical: 10),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),

                      // Existing Images List (Edit mode)
                      if (_existingImages.isNotEmpty) ...[
                        Text(
                          'Ảnh hiện có (${_existingImages.length}):',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: isDark ? AppColors.neutral300 : AppColors.neutral700,
                          ),
                        ),
                        const SizedBox(height: 8),
                        SizedBox(
                          height: 80,
                          child: ListView.separated(
                            scrollDirection: Axis.horizontal,
                            itemCount: _existingImages.length,
                            separatorBuilder: (_, _) => const SizedBox(width: 10),
                            itemBuilder: (context, idx) {
                              final img = _existingImages[idx];
                              final imgUrl = ApiEndpoints.vehicleInspectionFile(img.filename);
                              return Stack(
                                children: [
                                  Container(
                                    width: 80,
                                    height: 80,
                                    decoration: BoxDecoration(
                                      borderRadius: BorderRadius.circular(8),
                                      border: Border.all(color: isDark ? AppColors.neutral700 : AppColors.neutral300),
                                    ),
                                    child: ClipRRect(
                                      borderRadius: BorderRadius.circular(7),
                                      child: Image.network(imgUrl, fit: BoxFit.cover),
                                    ),
                                  ),
                                  Positioned(
                                    top: 2,
                                    right: 2,
                                    child: GestureDetector(
                                      onTap: () => _deleteExistingImage(img),
                                      child: Container(
                                        padding: const EdgeInsets.all(3),
                                        decoration: const BoxDecoration(
                                          color: Colors.black54,
                                          shape: BoxShape.circle,
                                        ),
                                        child: const Icon(Icons.close, size: 14, color: Colors.white),
                                      ),
                                    ),
                                  ),
                                ],
                              );
                            },
                          ),
                        ),
                        const SizedBox(height: 14),
                      ],

                      // New Images Preview
                      if (_newImages.isNotEmpty) ...[
                        Text(
                          'Ảnh mới chọn (${_newImages.length}):',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: isDark ? AppColors.neutral300 : AppColors.neutral700,
                          ),
                        ),
                        const SizedBox(height: 8),
                        SizedBox(
                          height: 80,
                          child: ListView.separated(
                            scrollDirection: Axis.horizontal,
                            itemCount: _newImages.length,
                            separatorBuilder: (_, _) => const SizedBox(width: 10),
                            itemBuilder: (context, idx) {
                              final file = _newImages[idx];
                              return Stack(
                                children: [
                                  Container(
                                    width: 80,
                                    height: 80,
                                    decoration: BoxDecoration(
                                      borderRadius: BorderRadius.circular(8),
                                      border: Border.all(color: isDark ? AppColors.neutral700 : AppColors.neutral300),
                                    ),
                                    child: ClipRRect(
                                      borderRadius: BorderRadius.circular(7),
                                      child: kIsWeb
                                          ? Image.network(file.path, fit: BoxFit.cover)
                                          : Image.file(File(file.path), fit: BoxFit.cover),
                                    ),
                                  ),
                                  Positioned(
                                    top: 2,
                                    right: 2,
                                    child: GestureDetector(
                                      onTap: () => setState(() => _newImages.removeAt(idx)),
                                      child: Container(
                                        padding: const EdgeInsets.all(3),
                                        decoration: const BoxDecoration(
                                          color: Colors.black54,
                                          shape: BoxShape.circle,
                                        ),
                                        child: const Icon(Icons.close, size: 14, color: Colors.white),
                                      ),
                                    ),
                                  ),
                                ],
                              );
                            },
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 24),

                // Submit Button
                CustomButton(
                  text: isEditMode ? 'Lưu cập nhật' : 'Xác nhận tạo mới',
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
