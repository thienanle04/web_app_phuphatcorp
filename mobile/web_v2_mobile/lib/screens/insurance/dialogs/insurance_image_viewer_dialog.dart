import 'package:flutter/material.dart';
import '../../../core/api/api_endpoints.dart';
import '../../../core/constants/app_colors.dart';
import '../../../data/models/insurance_record.dart';

class InsuranceImageViewerDialog extends StatefulWidget {
  final List<InsuranceImage> images;
  final int initialIndex;

  const InsuranceImageViewerDialog({
    super.key,
    required this.images,
    this.initialIndex = 0,
  });

  @override
  State<InsuranceImageViewerDialog> createState() => _InsuranceImageViewerDialogState();
}

class _InsuranceImageViewerDialogState extends State<InsuranceImageViewerDialog> {
  late int _currentIndex;

  @override
  void initState() {
    super.initState();
    _currentIndex = widget.initialIndex >= 0 && widget.initialIndex < widget.images.length
        ? widget.initialIndex
        : 0;
  }

  void _prev() {
    if (_currentIndex > 0) {
      setState(() => _currentIndex--);
    }
  }

  void _next() {
    if (_currentIndex < widget.images.length - 1) {
      setState(() => _currentIndex++);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final currentImg = widget.images[_currentIndex];
    final hasMultiple = widget.images.length > 1;
    final canPrev = _currentIndex > 0;
    final canNext = _currentIndex < widget.images.length - 1;
    final imageUrl = ApiEndpoints.vehicleInsuranceFile(currentImg.filename);

    return Dialog(
      backgroundColor: isDark ? AppColors.neutral900 : AppColors.white,
      insetPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 20),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Header
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 8, 10),
            child: Row(
              children: [
                if (hasMultiple) ...[
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: isDark ? AppColors.neutral800 : AppColors.neutral100,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      '${_currentIndex + 1}/${widget.images.length}',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: isDark ? AppColors.neutral300 : AppColors.neutral700,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                ],
                Expanded(
                  child: Text(
                    currentImg.originalFilename ?? currentImg.filename,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: isDark ? AppColors.neutral100 : AppColors.neutral900,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close, size: 20),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
          ),
          const Divider(height: 1),

          // Image Box with Overlay Navigation Buttons
          Flexible(
            child: Container(
              constraints: const BoxConstraints(maxHeight: 500, minHeight: 250),
              width: double.infinity,
              color: isDark ? AppColors.neutral950 : AppColors.neutral100,
              padding: const EdgeInsets.all(4),
              child: Stack(
                alignment: Alignment.center,
                children: [
                  // Main Image View
                  InteractiveViewer(
                    panEnabled: true,
                    minScale: 0.8,
                    maxScale: 4.0,
                    child: Image.network(
                      imageUrl,
                      fit: BoxFit.contain,
                      loadingBuilder: (context, child, progress) {
                        if (progress == null) return child;
                        return const Center(child: CircularProgressIndicator());
                      },
                      errorBuilder: (_, _, _) => const Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.broken_image_outlined, size: 40, color: AppColors.neutral400),
                            SizedBox(height: 8),
                            Text('Không thể tải hình ảnh này.', style: TextStyle(fontSize: 12, color: AppColors.neutral500)),
                          ],
                        ),
                      ),
                    ),
                  ),

                  // Left Button
                  if (hasMultiple)
                    Positioned(
                      left: 6,
                      child: IconButton.filled(
                        style: IconButton.styleFrom(
                          backgroundColor: Colors.black54,
                          foregroundColor: Colors.white,
                          disabledBackgroundColor: Colors.black12,
                          disabledForegroundColor: Colors.white24,
                        ),
                        icon: const Icon(Icons.chevron_left, size: 28),
                        onPressed: canPrev ? _prev : null,
                      ),
                    ),

                  // Right Button
                  if (hasMultiple)
                    Positioned(
                      right: 6,
                      child: IconButton.filled(
                        style: IconButton.styleFrom(
                          backgroundColor: Colors.black54,
                          foregroundColor: Colors.white,
                          disabledBackgroundColor: Colors.black12,
                          disabledForegroundColor: Colors.white24,
                        ),
                        icon: const Icon(Icons.chevron_right, size: 28),
                        onPressed: canNext ? _next : null,
                      ),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
