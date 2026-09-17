import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:web_v2_mobile/core/theme/app_theme.dart';
import 'package:web_v2_mobile/data/models/invoice_tracking_ticket.dart';
import 'package:web_v2_mobile/data/services/invoice_tracking_service.dart';
import 'package:web_v2_mobile/providers/auth_provider.dart';
import 'package:web_v2_mobile/providers/invoice_tracking_provider.dart';
import 'package:web_v2_mobile/screens/invoice_tracking/dialogs/copy_documents_modal.dart';

class MockInvoiceTrackingService extends InvoiceTrackingService {
  @override
  Future<List<CopyableTicket>> fetchCopyableTickets(int id) async {
    return [
      CopyableTicket(
        id: 101,
        ngay: '2026-09-13',
        loaiTuyen: 'Tuyến cố định',
        loaiXe: 'Xe nhỏ',
        bienSo: '51C81056',
        taiXe: 'Nguyễn Văn A',
        diemNhan: 'Kho CLF - Bình Dương',
        invoiceStatus: 'completed',
        documentCount: 2,
        documents: [
          DocumentFile(
            filename: 'minio_file_1.jpg',
            originalFilename: 'bien_ban_1.jpg',
            fileName: 'minio_file_1.jpg',
            mimeType: 'image/jpeg',
          ),
          DocumentFile(
            filename: 'minio_file_2.jpg',
            originalFilename: 'hoa_don_2.jpg',
            fileName: 'minio_file_2.jpg',
            mimeType: 'image/jpeg',
          ),
        ],
      ),
      CopyableTicket(
        id: 102,
        ngay: '2026-09-13',
        loaiTuyen: 'Tuyến cố định',
        loaiXe: 'Xe lớn',
        bienSo: '50H55116',
        taiXe: 'Trần Văn B',
        diemNhan: 'Kho NDFC',
        invoiceStatus: 'pending_review',
        documentCount: 1,
        documents: [
          DocumentFile(
            filename: 'minio_file_3.jpg',
            originalFilename: 'phieu_giao_3.jpg',
            fileName: 'minio_file_3.jpg',
            mimeType: 'image/jpeg',
          ),
        ],
      ),
    ];
  }
}

void main() {
  group('Copy Documents Models Test', () {
    test('CopyableTicket parses JSON correctly', () {
      final json = {
        'id': 101,
        'ngay': '2026-09-13',
        'loai_tuyen': 'Tuyến cố định',
        'loai_xe': 'Xe nhỏ',
        'bien_so': '51C81056',
        'tai_xe': 'Nguyễn Văn A',
        'diem_nhan': 'Kho CLF',
        'invoice_status': 'completed',
        'document_count': 2,
        'documents': [
          {
            'filename': 'abc.jpg',
            'original_filename': 'hoa_don.jpg',
            'mime_type': 'image/jpeg',
          }
        ],
      };

      final ticket = CopyableTicket.fromJson(json);
      expect(ticket.id, 101);
      expect(ticket.bienSo, '51C81056');
      expect(ticket.taiXe, 'Nguyễn Văn A');
      expect(ticket.documentCount, 2);
      expect(ticket.documents.length, 1);
      expect(ticket.documents.first.displayName, 'hoa_don.jpg');
      expect(ticket.documents.first.isMinIO, true);
    });

    test('DocumentFile handles copied document metadata correctly', () {
      final json = {
        'filename': 'shared_123.jpg',
        'original_filename': 'shared_invoice.jpg',
        'mime_type': 'image/jpeg',
        'source_ticket_id': 45,
        'source_plate_number': '51C81056',
      };

      final doc = DocumentFile.fromJson(json);
      expect(doc.displayName, 'shared_invoice.jpg');
      expect(doc.isMinIO, true);
      expect(doc.isCopied, true);
      expect(doc.sourceTicketId, 45);
      expect(doc.sourcePlateNumber, '51C81056');
    });
  });

  group('CopyDocumentsModal Widget Test', () {
    testWidgets('renders search field, banner, and copyable trips list', (WidgetTester tester) async {
      final authProvider = AuthProvider();
      final invoiceProvider = InvoiceTrackingProvider(service: MockInvoiceTrackingService());

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider<AuthProvider>.value(value: authProvider),
            ChangeNotifierProvider<InvoiceTrackingProvider>.value(value: invoiceProvider),
          ],
          child: MaterialApp(
            theme: AppTheme.lightTheme,
            home: const Scaffold(
              body: CopyDocumentsModal(
                ticketId: 999,
                ticketDate: '2026-09-13',
              ),
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Sao chép chứng từ (13/09/2026)'), findsOneWidget);
      expect(find.text('51C81056'), findsOneWidget);
      expect(find.text('50H55116'), findsOneWidget);
      expect(find.text('2 tệp đính kèm'), findsOneWidget);
      expect(find.text('1 tệp đính kèm'), findsOneWidget);

      // Select first vehicle
      await tester.tap(find.text('51C81056'));
      await tester.pumpAndSettle();

      expect(find.text('Sao chép (2 tệp)'), findsOneWidget);
      expect(find.text('Ghi chú tài xế (tùy chọn)'), findsOneWidget);
    });
  });
}
