import { useState, useMemo } from 'react';
import { useI18n } from '../../i18n/useI18n';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useCopyableTickets, useCopyDocuments } from '../../hooks/useInvoiceTracking';
import { InvoiceStatusBadge } from './InvoiceStatusBadge';
import { formatDate } from '../../utils/format';
import {
  Copy,
  Search,
  Truck,
  MapPin,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';

interface CopyDocumentsModalProps {
  ticketId: number;
  ticketDate: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CopyDocumentsModal({
  ticketId,
  ticketDate,
  isOpen,
  onClose,
  onSuccess,
}: CopyDocumentsModalProps) {
  const { t } = useI18n();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSourceId, setSelectedSourceId] = useState<number | null>(null);
  const [driverNote, setDriverNote] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const {
    data: copyableTickets,
    isLoading,
    isError,
    refetch,
  } = useCopyableTickets(isOpen ? ticketId : null);

  const copyMutation = useCopyDocuments();

  const filteredTickets = useMemo(() => {
    if (!copyableTickets) return [];
    if (!searchTerm.trim()) return copyableTickets;
    const term = searchTerm.toLowerCase().trim();
    return copyableTickets.filter(
      (tk) =>
        tk.bien_so.toLowerCase().includes(term) ||
        (tk.tai_xe && tk.tai_xe.toLowerCase().includes(term)) ||
        (tk.diem_nhan && tk.diem_nhan.toLowerCase().includes(term)),
    );
  }, [copyableTickets, searchTerm]);

  const selectedTicket = useMemo(() => {
    if (!copyableTickets || !selectedSourceId) return null;
    return copyableTickets.find((t) => t.id === selectedSourceId) || null;
  }, [copyableTickets, selectedSourceId]);

  const handleClose = () => {
    setSelectedSourceId(null);
    setSearchTerm('');
    setDriverNote('');
    setActionError(null);
    onClose();
  };

  const handleSubmit = () => {
    if (!selectedSourceId) return;
    setActionError(null);

    copyMutation.mutate(
      {
        id: ticketId,
        data: {
          source_ticket_id: selectedSourceId,
          driver_note: driverNote.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          handleClose();
          if (onSuccess) onSuccess();
        },
        onError: (err: unknown) => {
          const msg =
            (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
            'Không thể sao chép chứng từ. Vui lòng thử lại.';
          setActionError(msg);
        },
      },
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`${t('invoice_tracking.copy.title') || 'Sao chép chứng từ'} (${formatDate(ticketDate)})`}
      size="lg"
    >
      <div className="space-y-4 py-1">
        {actionError && (
          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg text-xs sm:text-sm text-red-700 dark:text-red-300">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{actionError}</span>
          </div>
        )}

        {/* Description Banner */}
        <div className="flex items-start gap-2.5 p-3 bg-sky-50 dark:bg-sky-950/40 rounded-xl border border-sky-200/80 dark:border-sky-800/80 text-xs text-sky-800 dark:text-sky-300">
          <Copy className="w-4 h-4 shrink-0 mt-0.5 text-sky-600 dark:text-sky-400" />
          <p>
            Chọn chuyến xe cùng ngày đã có chứng từ để sử dụng chung hình ảnh. Tệp sẽ được tham chiếu trực tiếp
            không tốn dung lượng lưu trữ.
          </p>
        </div>

        {/* Search filter input */}
        <div className="relative">
          <Input
            placeholder={t('invoice_tracking.copy.searchPlaceholder') || 'Tìm theo biển số xe, tài xế, điểm nhận...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 text-xs sm:text-sm h-10"
          />
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-3 pointer-events-none" />
        </div>

        {/* List of Copyable Trips */}
        <div className="space-y-2.5 max-h-72 sm:max-h-80 overflow-y-auto pr-1">
          {isLoading ? (
            <div className="space-y-2.5 py-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-24 bg-neutral-100 dark:bg-neutral-800/60 rounded-xl animate-pulse border border-neutral-200 dark:border-neutral-700"
                />
              ))}
            </div>
          ) : isError ? (
            <div className="p-6 text-center text-xs sm:text-sm text-neutral-500">
              <p>Không thể tải danh sách chuyến xe</p>
              <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-2 text-xs">
                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                Thử lại
              </Button>
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="p-8 text-center text-xs sm:text-sm text-neutral-500 bg-neutral-50 dark:bg-neutral-800/40 rounded-xl border border-neutral-200/60 dark:border-neutral-700/60">
              <Truck className="w-8 h-8 text-neutral-400 mx-auto mb-2 opacity-60" />
              <p className="font-medium text-neutral-700 dark:text-neutral-300">
                {t('invoice_tracking.copy.empty') || 'Chưa có chuyến xe nào khác cùng ngày đã tải lên chứng từ.'}
              </p>
              <p className="text-xs text-neutral-400 mt-1">
                Bạn có thể tự chụp và tải ảnh lên trực tiếp bằng nút "Tải ảnh lên".
              </p>
            </div>
          ) : (
            filteredTickets.map((tk) => {
              const isSelected = selectedSourceId === tk.id;
              return (
                <div
                  key={tk.id}
                  onClick={() => setSelectedSourceId(tk.id)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-neutral-900 dark:border-neutral-100 bg-neutral-50/80 dark:bg-neutral-800/80 ring-2 ring-neutral-900/10 dark:ring-neutral-100/10'
                      : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-400 dark:hover:border-neutral-600'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center border transition ${
                          isSelected
                            ? 'border-neutral-900 dark:border-neutral-100 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900'
                            : 'border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800'
                        }`}
                      >
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                      </div>
                      <span className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
                        {tk.bien_so}
                      </span>
                      <span className="text-xs text-neutral-400">•</span>
                      <span className="text-xs text-neutral-600 dark:text-neutral-300 font-medium">
                        {tk.tai_xe || 'Chưa gán'}
                      </span>
                    </div>

                    <InvoiceStatusBadge status={tk.invoice_status as any} />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 mb-2.5">
                    <div className="flex items-center gap-1.5 truncate">
                      <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                      <span className="truncate">{tk.diem_nhan || '—'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                      <span className="font-medium text-neutral-700 dark:text-neutral-300">
                        {tk.document_count} tệp đính kèm
                      </span>
                    </div>
                  </div>

                  {/* Document Thumbnails Preview */}
                  {tk.documents && tk.documents.length > 0 && (
                    <div className="flex items-center gap-2 overflow-x-auto pt-1 pb-0.5">
                      {tk.documents.slice(0, 5).map((doc, dIdx) => {
                        const isImg = doc.mime_type?.startsWith('image/');
                        const imgSrc = doc.filename
                          ? `/api/invoice-tracking/files/${doc.filename}`
                          : doc.file_data
                            ? `data:${doc.mime_type};base64,${doc.file_data}`
                            : null;

                        return (
                          <div
                            key={dIdx}
                            className="w-12 h-12 rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden bg-neutral-100 dark:bg-neutral-800 shrink-0 flex items-center justify-center text-neutral-400"
                            title={doc.original_filename || doc.file_name}
                          >
                            {isImg && imgSrc ? (
                              <img src={imgSrc} alt="" className="w-full h-full object-cover" />
                            ) : isImg ? (
                              <ImageIcon className="w-4 h-4 text-sky-500" />
                            ) : (
                              <FileText className="w-4 h-4 text-rose-500" />
                            )}
                          </div>
                        );
                      })}
                      {tk.documents.length > 5 && (
                        <div className="w-12 h-12 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 flex items-center justify-center text-[10px] font-medium text-neutral-500 dark:text-neutral-400 shrink-0">
                          +{tk.documents.length - 5}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Optional Driver Note */}
        {selectedTicket && (
          <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800">
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              {t('invoice_tracking.copy.driverNoteLabel') || 'Ghi chú tài xế (tùy chọn):'}
            </label>
            <textarea
              value={driverNote}
              onChange={(e) => setDriverNote(e.target.value)}
              placeholder={t('invoice_tracking.copy.driverNotePlaceholder') || 'Ví dụ: Đi chung điểm nhận hàng với xe...'}
              rows={2}
              className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-xs sm:text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-neutral-400"
            />
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={copyMutation.isPending}
            className="w-full sm:w-auto h-10 text-xs sm:text-sm"
          >
            {t('invoice_tracking.action.cancel') || 'Hủy'}
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleSubmit}
            isLoading={copyMutation.isPending}
            disabled={!selectedSourceId || copyMutation.isPending}
            className="w-full sm:w-auto h-10 text-xs sm:text-sm font-medium"
          >
            {selectedTicket
              ? `${t('invoice_tracking.copy.confirmSubmit') || 'Xác nhận sao chép'} (${selectedTicket.document_count} tệp)`
              : (t('invoice_tracking.copy.selectTrip') || 'Chọn chuyến xe')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
