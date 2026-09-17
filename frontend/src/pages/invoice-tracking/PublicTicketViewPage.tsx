import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useI18n } from '../../i18n/useI18n';
import { usePublicTicket } from '../../hooks/useInvoiceTracking';
import { DocumentViewerModal } from '../../components/invoice-tracking/DocumentViewerModal';
import { InvoiceStatusBadge } from '../../components/invoice-tracking/InvoiceStatusBadge';
import { ThemeToggle } from '../../components/ui/ThemeToggle';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { formatDate } from '../../utils/format';
import { type DocumentFile, invoiceTrackingApi } from '../../api/invoiceTrackingApi';
import {
  Truck,
  FileText,
  ZoomIn,
  Download,
  MapPin,
  Calendar,
  User,
  AlertTriangle,
  RotateCcw,
  ShieldCheck,
  PackageCheck,
  Copy,
} from 'lucide-react';

export default function PublicTicketViewPage() {
  const { token } = useParams<{ token: string }>();
  const { t } = useI18n();
  const [selectedDoc, setSelectedDoc] = useState<DocumentFile | null>(null);

  const { data: ticket, isLoading, isError, refetch } = usePublicTicket(token);

  const handleDownloadAll = () => {
    if (!ticket?.documents || ticket.documents.length === 0) return;

    ticket.documents.forEach((doc, idx) => {
      setTimeout(() => {
        invoiceTrackingApi.downloadDocumentFile(doc, `chung_tu_${ticket.bien_so}_${idx + 1}`);
      }, idx * 300);
    });
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 flex flex-col">
      {/* Public Header */}
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md border-b border-neutral-200 dark:border-neutral-800 shadow-2xs">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-neutral-900 dark:bg-neutral-100 flex items-center justify-center text-white dark:text-neutral-900 shadow-xs">
              <Truck className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <span className="font-bold text-sm sm:text-base tracking-tight block leading-tight">PhuPhatCorp</span>
              <span className="text-[10px] sm:text-xs text-neutral-500 dark:text-neutral-400 block leading-tight">
                Chứng từ chuyến hàng
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {ticket?.documents && ticket.documents.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadAll}
                className="h-8 sm:h-9 px-2.5 sm:px-3 text-xs font-medium"
              >
                <Download className="w-3.5 h-3.5 mr-1 text-neutral-500" />
                <span className="hidden sm:inline">Tải tất cả ({ticket.documents.length})</span>
                <span className="sm:hidden">Tải hết</span>
              </Button>
            )}
            <ThemeToggle className="h-8 w-8 sm:h-9 sm:w-9" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
        {isLoading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-44 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6" />
            <div className="h-72 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6" />
          </div>
        ) : isError || !ticket ? (
          <Card className="border-red-200 dark:border-red-900/60 bg-red-50/30 dark:bg-red-950/20">
            <CardContent className="py-16 px-4 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h2 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-neutral-100">
                Liên kết không hợp lệ hoặc đã hết hạn
              </h2>
              <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 max-w-md mx-auto">
                Vui lòng kiểm tra lại liên kết hoặc yêu cầu người gửi cung cấp liên kết chia sẻ mới nhất.
              </p>
              <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-2">
                <RotateCcw className="w-4 h-4 mr-1.5" />
                Thử tải lại
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Trip Summary Card */}
            <Card className="border border-neutral-200 dark:border-neutral-800 shadow-2xs rounded-2xl overflow-hidden">
              <CardHeader className="p-4 sm:p-5 border-b border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/60 dark:bg-neutral-900/50">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-neutral-900 dark:bg-neutral-100 flex items-center justify-center text-white dark:text-neutral-900">
                      <Truck className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
                        {ticket.bien_so}
                      </h2>
                      <span className="text-xs text-neutral-500 dark:text-neutral-400">
                        {ticket.loai_tuyen} • {ticket.loai_xe}
                      </span>
                    </div>
                  </div>

                  <div className="self-start sm:self-auto">
                    <InvoiceStatusBadge status={ticket.invoice_status as any} />
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-4 sm:p-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-3 text-xs sm:text-sm">
                  <div className="bg-neutral-50 dark:bg-neutral-900/80 p-3 rounded-xl border border-neutral-100 dark:border-neutral-800">
                    <span className="text-neutral-500 dark:text-neutral-400 text-xs flex items-center gap-1 mb-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {t('invoice_tracking.table.date')}
                    </span>
                    <span className="font-semibold text-neutral-900 dark:text-neutral-100 text-sm">
                      {formatDate(ticket.ngay)}
                    </span>
                  </div>

                  <div className="bg-neutral-50 dark:bg-neutral-900/80 p-3 rounded-xl border border-neutral-100 dark:border-neutral-800">
                    <span className="text-neutral-500 dark:text-neutral-400 text-xs flex items-center gap-1 mb-1">
                      <User className="w-3.5 h-3.5" />
                      {t('invoice_tracking.table.taiXe')}
                    </span>
                    <span className="font-semibold text-neutral-900 dark:text-neutral-100 text-sm">
                      {ticket.tai_xe || 'Chưa phân công'}
                    </span>
                  </div>

                  <div className="bg-neutral-50 dark:bg-neutral-900/80 p-3 rounded-xl border border-neutral-100 dark:border-neutral-800">
                    <span className="text-neutral-500 dark:text-neutral-400 text-xs flex items-center gap-1 mb-1">
                      <PackageCheck className="w-3.5 h-3.5" />
                      Số lượng / Trọng tải
                    </span>
                    <span className="font-medium text-neutral-900 dark:text-neutral-100 text-sm">
                      {ticket.tan ? `${ticket.tan} tấn` : '—'} {ticket.can ? `• ${ticket.can} can` : ''}
                    </span>
                  </div>

                  <div className="bg-neutral-50 dark:bg-neutral-900/80 p-3 rounded-xl border border-neutral-100 dark:border-neutral-800 sm:col-span-2 md:col-span-3">
                    <span className="text-neutral-500 dark:text-neutral-400 text-xs flex items-center gap-1 mb-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {t('invoice_tracking.table.diemNhan')}
                    </span>
                    <span className="font-medium text-neutral-900 dark:text-neutral-100 text-sm break-words">
                      {ticket.diem_nhan || '—'}
                    </span>
                  </div>
                </div>

                {ticket.ghi_chu && (
                  <div className="mt-3 p-3 bg-neutral-100/60 dark:bg-neutral-900/50 rounded-xl border border-neutral-200/60 dark:border-neutral-800 text-xs sm:text-sm">
                    <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 block mb-0.5">
                      Ghi chú chuyến xe:
                    </span>
                    <p className="text-neutral-800 dark:text-neutral-200">{ticket.ghi_chu}</p>
                  </div>
                )}

                {ticket.driver_note && (
                  <div className="mt-2.5 p-3 bg-neutral-100/60 dark:bg-neutral-900/50 rounded-xl border border-neutral-200/60 dark:border-neutral-800 text-xs sm:text-sm">
                    <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 block mb-0.5">
                      Ghi chú từ tài xế:
                    </span>
                    <p className="text-neutral-800 dark:text-neutral-200 italic">"{ticket.driver_note}"</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Document Gallery Card with Lightbox Gallery */}
            <Card className="border border-neutral-200 dark:border-neutral-800 shadow-2xs rounded-2xl overflow-hidden">
              <CardHeader className="p-4 sm:p-5 border-b border-neutral-100 dark:border-neutral-800/80">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
                    <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                      Hình ảnh & Chứng từ đính kèm
                    </h3>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-xs font-semibold font-mono text-neutral-600 dark:text-neutral-300">
                    {ticket.documents?.length || 0} tệp
                  </span>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  Nhấp vào bất kỳ hình ảnh nào để phóng to và sử dụng phím ⬅️ ➡️ để duyệt qua các hình
                </p>
              </CardHeader>

              <CardContent className="p-4 sm:p-5">
                {!ticket.documents || ticket.documents.length === 0 ? (
                  <div className="py-12 text-center text-neutral-400 dark:text-neutral-500 italic text-sm">
                    Chuyến xe này chưa có hình ảnh hoặc chứng từ nào được tải lên.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
                    {ticket.documents.map((doc, idx) => {
                      const isImage = doc.mime_type?.startsWith('image/');
                      const fileName = doc.original_filename || doc.file_name || `Chứng từ #${idx + 1}`;
                      const imgSrc = doc.filename
                        ? `/api/invoice-tracking/files/${doc.filename}`
                        : doc.file_data
                          ? `data:${doc.mime_type};base64,${doc.file_data}`
                          : null;

                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSelectedDoc(doc)}
                          className="group relative aspect-square overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100/70 transition hover:border-neutral-900 dark:hover:border-neutral-300 hover:shadow-lg dark:border-neutral-800 dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-400 text-left"
                        >
                          {isImage && imgSrc ? (
                            <>
                              <img
                                src={imgSrc}
                                alt={fileName}
                                className="h-full w-full object-cover transition duration-200 group-hover:scale-105 select-none"
                                loading="lazy"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white p-2 text-center">
                                <ZoomIn className="w-6 h-6 mb-1" />
                                <span className="text-[11px] font-medium truncate max-w-full px-1">
                                  {fileName}
                                </span>
                              </div>
                            </>
                          ) : (
                            <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-3 text-center bg-rose-50/60 dark:bg-rose-950/20">
                              <div className="w-12 h-12 rounded-xl bg-rose-100 dark:bg-rose-950/60 flex items-center justify-center text-rose-600 dark:text-rose-400">
                                <FileText className="h-6 w-6 group-hover:scale-110 transition-transform" />
                              </div>
                              <span className="line-clamp-2 text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                                {fileName}
                              </span>
                              <span className="text-[10px] text-rose-600 dark:text-rose-400 font-medium">
                                Tài liệu PDF
                              </span>
                            </div>
                          )}

                          {/* Index Badge */}
                          <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/60 text-white font-mono text-[10px] font-medium backdrop-blur-xs">
                            #{idx + 1}
                          </span>

                          {/* Source Plate Badge */}
                          {doc.source_plate_number && (
                            <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/60 text-white font-mono text-[10px] font-medium backdrop-blur-xs flex items-center gap-1">
                              <Copy className="w-2.5 h-2.5 text-sky-400" />
                              <span>Xe {doc.source_plate_number}</span>
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>

      {/* Public Footer */}
      <footer className="mt-auto border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 py-4 text-center text-xs text-neutral-500 dark:text-neutral-400">
        <div className="flex items-center justify-center gap-1.5 mb-1">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span className="font-semibold text-neutral-700 dark:text-neutral-300">Hệ thống Quản lý Kế toán & Vận tải PhuPhatCorp</span>
        </div>
        <p className="text-[11px]">Trang tra cứu chứng từ điện tử an toàn • © {new Date().getFullYear()}</p>
      </footer>

      {/* Lightbox Gallery Viewer with Back / Next Navigation */}
      <DocumentViewerModal
        document={selectedDoc}
        documents={ticket?.documents || []}
        onClose={() => setSelectedDoc(null)}
        onNavigate={(newDoc) => setSelectedDoc(newDoc)}
      />
    </div>
  );
}
