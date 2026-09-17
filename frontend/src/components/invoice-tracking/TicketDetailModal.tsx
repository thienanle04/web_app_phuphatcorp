import { useState, useMemo } from 'react';
import { useI18n } from '../../i18n/useI18n';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { InvoiceStatusBadge } from './InvoiceStatusBadge';
import { DocumentPreview } from './DocumentPreview';
import { DocumentViewerModal } from './DocumentViewerModal';
import { UploadDocumentsModal } from './UploadDocumentsModal';
import { CopyDocumentsModal } from './CopyDocumentsModal';
import { SupplementNoteDialog } from './SupplementNoteDialog';
import { ConfirmFinishDialog } from './ConfirmFinishDialog';
import { ShareTicketDialog } from './ShareTicketDialog';
import { useUploadDocuments, useReviewTicket, useInvoiceTrackingHistory, useInvoiceTrackingDetail, useCreateShareLink } from '../../hooks/useInvoiceTracking';
import { type InvoiceTrackingTicket, type DocumentFile, invoiceTrackingApi } from '../../api/invoiceTrackingApi';
import { formatDate, formatDateTime } from '../../utils/format';
import { copyToClipboard } from '../../utils/clipboard';
import {
  Truck,
  AlertCircle,
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  History,
  Upload,
  PlusCircle,
  User,
  Image as ImageIcon,
  ExternalLink,
  Share2,
  Check,
  Copy,
  Download,
} from 'lucide-react';

interface TicketDetailModalProps {
  ticket: InvoiceTrackingTicket | null;
  isOpen: boolean;
  onClose: () => void;
}

export function TicketDetailModal({ ticket: initialTicket, isOpen, onClose }: TicketDetailModalProps) {
  const { t } = useI18n();
  const [showUpload, setShowUpload] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [showSupplement, setShowSupplement] = useState(false);
  const [showConfirmFinish, setShowConfirmFinish] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [selectedHistoryDoc, setSelectedHistoryDoc] = useState<DocumentFile | null>(null);
  const [copied, setCopied] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: detailTicket } = useInvoiceTrackingDetail(isOpen ? initialTicket?.id ?? null : null);
  const ticket = detailTicket || initialTicket;

  const uploadMutation = useUploadDocuments();
  const reviewMutation = useReviewTicket();
  const shareMutation = useCreateShareLink();
  const { data: historyItems, isLoading: isLoadingHistory } = useInvoiceTrackingHistory(ticket?.id ?? null);

  // Determine permissions from backend dynamic evaluation
  const canUpload = useMemo(() => !!ticket?.user_permissions?.can_upload, [ticket?.user_permissions]);
  const canFinish = useMemo(() => !!ticket?.user_permissions?.can_finish, [ticket?.user_permissions]);
  const canRequestSupplement = useMemo(() => !!ticket?.user_permissions?.can_request_supplement, [ticket?.user_permissions]);

  if (!ticket) return null;

  const handleUpload = (files: File[], note: string) => {
    setActionError(null);
    uploadMutation.mutate(
      { id: ticket.id, data: { files, driver_note: note || undefined } },
      {
        onSuccess: () => {
          setShowUpload(false);
          onClose();
        },
        onError: (err: unknown) => {
          const msg =
            (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
            t('invoice_tracking.message.errorUpload');
          setActionError(msg);
        },
      },
    );
  };

  const handleFinish = () => {
    setActionError(null);
    reviewMutation.mutate(
      { id: ticket.id, data: { action: 'finish' } },
      {
        onSuccess: () => {
          setShowConfirmFinish(false);
          onClose();
        },
        onError: (err: unknown) => {
          const msg =
            (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
            t('invoice_tracking.message.errorReview');
          setActionError(msg);
        },
      },
    );
  };

  const handleRequestSupplement = (note: string) => {
    setActionError(null);
    reviewMutation.mutate(
      { id: ticket.id, data: { action: 'request_supplement', supplement_note: note } },
      {
        onSuccess: () => {
          setShowSupplement(false);
          onClose();
        },
        onError: (err: unknown) => {
          const msg =
            (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
            t('invoice_tracking.message.errorReview');
          setActionError(msg);
        },
      },
    );
  };

  const handleShare = async () => {
    setActionError(null);
    try {
      const res = await shareMutation.mutateAsync(ticket.id);
      const url = `${window.location.origin}/shared/invoice-tracking/${res.share_token}`;
      setShareUrl(url);
      setShowShareDialog(true);
      
      const copyOk = await copyToClipboard(url);
      if (copyOk) {
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      }
    } catch (err: unknown) {
      console.error('Failed to create share link:', err);
      setActionError('Không thể tạo liên kết chia sẻ. Vui lòng thử lại.');
    }
  };

  const handleDownloadAll = () => {
    if (!ticket?.documents || ticket.documents.length === 0) return;

    ticket.documents.forEach((doc, idx) => {
      setTimeout(() => {
        invoiceTrackingApi.downloadDocumentFile(doc, `chung_tu_${ticket.bien_so}_${idx + 1}`);
      }, idx * 300);
    });
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={t('invoice_tracking.detail.title')} size="xl">
        <div className="space-y-4 sm:space-y-5">
          {actionError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{actionError}</span>
            </div>
          )}

          {copied && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs sm:text-sm text-emerald-800 dark:text-emerald-300 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Đã sao chép liên kết chia sẻ! Người nhận có thể mở xem trực tiếp mà không cần đăng nhập.</span>
            </div>
          )}

          {/* Main Trip Overview Card */}
          <div className="rounded-xl border border-neutral-200 p-3.5 sm:p-4 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center">
                  <Truck className="w-4 h-4 text-neutral-700 dark:text-neutral-300" />
                </div>
                <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                  {ticket.bien_so}
                </h3>
              </div>
              <InvoiceStatusBadge status={ticket.invoice_status} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-3 text-xs sm:text-sm">
              <div className="bg-white dark:bg-neutral-900 p-2.5 rounded-lg border border-neutral-100 dark:border-neutral-800">
                <span className="text-neutral-500 dark:text-neutral-400 block text-xs">{t('invoice_tracking.table.date')}</span>
                <span className="font-semibold text-neutral-900 dark:text-neutral-100 mt-0.5 block">{formatDate(ticket.ngay)}</span>
              </div>
              <div className="bg-white dark:bg-neutral-900 p-2.5 rounded-lg border border-neutral-100 dark:border-neutral-800">
                <span className="text-neutral-500 dark:text-neutral-400 block text-xs">{t('invoice_tracking.table.taiXe')}</span>
                <span className="font-semibold text-neutral-900 dark:text-neutral-100 mt-0.5 block">{ticket.tai_xe || '—'}</span>
              </div>
              <div className="bg-white dark:bg-neutral-900 p-2.5 rounded-lg border border-neutral-100 dark:border-neutral-800">
                <span className="text-neutral-500 dark:text-neutral-400 block text-xs">Loại tuyến / Loại xe</span>
                <span className="font-medium text-neutral-900 dark:text-neutral-100 mt-0.5 block">
                  {ticket.loai_tuyen} • {ticket.loai_xe}
                </span>
              </div>
              <div className="bg-white dark:bg-neutral-900 p-2.5 rounded-lg border border-neutral-100 dark:border-neutral-800 sm:col-span-2">
                <span className="text-neutral-500 dark:text-neutral-400 block text-xs">{t('invoice_tracking.table.diemNhan')}</span>
                <span className="font-medium text-neutral-900 dark:text-neutral-100 mt-0.5 block break-words">{ticket.diem_nhan || '—'}</span>
              </div>
              <div className="bg-white dark:bg-neutral-900 p-2.5 rounded-lg border border-neutral-100 dark:border-neutral-800">
                <span className="text-neutral-500 dark:text-neutral-400 block text-xs">{t('invoice_tracking.table.diemTra')}</span>
                <span className="font-medium text-neutral-900 dark:text-neutral-100 mt-0.5 block">{ticket.tan || '—'}</span>
              </div>
            </div>

            {ticket.ghi_chu && (
              <div className="mt-2.5 text-xs sm:text-sm bg-white dark:bg-neutral-900 p-2.5 rounded-lg border border-neutral-100 dark:border-neutral-800">
                <span className="text-neutral-500 dark:text-neutral-400 block text-xs font-medium">Ghi chú chuyến:</span>
                <span className="text-neutral-800 dark:text-neutral-200 mt-0.5 block">{ticket.ghi_chu}</span>
              </div>
            )}
          </div>

          {/* Notes & Processing Progress */}
          {(ticket.driver_note || ticket.supplement_note || ticket.reviewed_at || ticket.completed_at) && (
            <div className="rounded-xl border border-neutral-200 p-3.5 sm:p-4 dark:border-neutral-800 space-y-3">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-neutral-500" />
                {t('invoice_tracking.detail.statusHistory')}
              </h3>
              
              <div className="space-y-2.5 text-xs sm:text-sm">
                {ticket.driver_note && (
                  <div className="rounded-lg bg-neutral-100/70 p-3 dark:bg-neutral-800/60 border border-neutral-200/50 dark:border-neutral-700/50">
                    <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                      {t('invoice_tracking.detail.driverNote')}:
                    </span>
                    <p className="text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">{ticket.driver_note}</p>
                  </div>
                )}
                {ticket.supplement_note && (
                  <div className="rounded-lg bg-red-50 p-3 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-800/60">
                    <span className="text-xs font-semibold flex items-center gap-1.5 mb-1 text-red-800 dark:text-red-200">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {t('invoice_tracking.detail.supplementNote')}:
                    </span>
                    <p className="whitespace-pre-wrap">{ticket.supplement_note}</p>
                  </div>
                )}
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-6 pt-1 text-xs text-neutral-500">
                  {ticket.reviewed_at && (
                    <div>
                      <span>{t('invoice_tracking.detail.reviewedAt')}: </span>
                      <span className="font-medium text-neutral-700 dark:text-neutral-300">{formatDateTime(ticket.reviewed_at)}</span>
                    </div>
                  )}
                  {ticket.completed_at && (
                    <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{t('invoice_tracking.detail.completedAt')}: {formatDateTime(ticket.completed_at)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Attached Documents List */}
          <div className="rounded-xl border border-neutral-200 p-3.5 sm:p-4 dark:border-neutral-800">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-neutral-500" />
                {t('invoice_tracking.detail.documents')} ({ticket.documents?.length || 0})
              </h3>
              {ticket.documents && ticket.documents.length > 0 && (
                <button
                  type="button"
                  onClick={handleDownloadAll}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-xs font-medium text-neutral-700 dark:text-neutral-300 transition shadow-2xs cursor-pointer"
                  title="Tải về toàn bộ tệp đính kèm của chuyến xe này"
                >
                  <Download className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
                  <span>{t('invoice_tracking.detail.downloadAll')} ({ticket.documents.length})</span>
                </button>
              )}
            </div>
            <DocumentPreview documents={ticket.documents || []} />
          </div>

          {/* Operation History Timeline */}
          <div className="rounded-xl border border-neutral-200 p-3.5 sm:p-4 dark:border-neutral-800">
            <h3 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
              <History className="w-4 h-4 text-neutral-500" />
              Lịch sử thao tác ({historyItems?.length || 0})
            </h3>

            {isLoadingHistory ? (
              <div className="space-y-2 py-2">
                <div className="h-6 w-1/3 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
                <div className="h-6 w-2/3 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
              </div>
            ) : !historyItems || historyItems.length === 0 ? (
              <p className="text-xs text-neutral-400 dark:text-neutral-500 italic py-1">Chưa có bản ghi lịch sử thao tác.</p>
            ) : (
              <div className="relative pl-5 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-neutral-200 dark:before:bg-neutral-700">
                {historyItems.map((item, index) => {
                  let badgeColor = 'bg-neutral-500 text-white';
                  let Icon = Clock;
                  if (item.action === 'CREATE' || item.action === 'CREATE_DISPATCH') {
                    badgeColor = 'bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-900';
                    Icon = PlusCircle;
                  } else if (item.action === 'UPLOAD_DOCUMENTS') {
                    badgeColor = 'bg-blue-600 text-white';
                    Icon = Upload;
                  } else if (item.action === 'REQUEST_SUPPLEMENT') {
                    badgeColor = 'bg-amber-500 text-white';
                    Icon = AlertTriangle;
                  } else if (item.action === 'REVIEW_FINISH') {
                    badgeColor = 'bg-emerald-600 text-white';
                    Icon = CheckCircle2;
                  }

                  const details = item.details as Record<string, any> | null;

                  return (
                    <div key={item.id || index} className="relative group">
                      {/* Timeline node icon */}
                      <div
                        className={`absolute -left-5 mt-0.5 flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-white dark:ring-neutral-900 ${badgeColor}`}
                      >
                        <Icon className="h-2.5 w-2.5" />
                      </div>

                      {/* Content */}
                      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-0.5 sm:gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                            {item.action_label}
                          </span>
                          <span className="text-neutral-400 text-xs">•</span>
                          <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400 flex items-center gap-1">
                            <User className="w-3 h-3 text-neutral-400" />
                            {item.user_full_name || item.username || 'Hệ thống'}
                          </span>
                        </div>
                        <span className="text-[11px] text-neutral-400 font-mono">
                          {formatDateTime(item.created_at)}
                        </span>
                      </div>

                      {/* Details preview */}
                      {details && (
                        <div className="mt-1 text-xs text-neutral-600 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-800/40 p-2.5 rounded-lg border border-neutral-100 dark:border-neutral-800 space-y-1.5">
                          {details.step && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-neutral-200/80 dark:bg-neutral-700/80 text-neutral-800 dark:text-neutral-200">
                                {details.step}
                              </span>
                            </div>
                          )}

                          {Array.isArray(details.files) && details.files.length > 0 && (
                            <div>
                              <p className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                                Tệp chứng từ đính kèm ({details.files.length}):
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {details.files.map((f: { file_name: string; mime_type?: string }, fIdx: number) => {
                                  const isImg = f.mime_type?.startsWith('image/');
                                  const matchedDoc = (ticket.documents || []).find((d) => d.file_name === f.file_name);

                                  return (
                                    <button
                                      key={fIdx}
                                      type="button"
                                      onClick={() => {
                                        if (matchedDoc) {
                                          setSelectedHistoryDoc(matchedDoc);
                                        } else {
                                          setSelectedHistoryDoc({
                                            file_name: f.file_name,
                                            mime_type: f.mime_type || (isImg ? 'image/jpeg' : 'application/pdf'),
                                            file_data: '',
                                          });
                                        }
                                      }}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 hover:border-neutral-400 dark:border-neutral-700 dark:hover:border-neutral-500 text-xs font-medium text-neutral-800 dark:text-neutral-200 shadow-2xs hover:shadow-xs transition cursor-pointer text-left group/file"
                                      title={`Nhấn để xem tệp "${f.file_name}"`}
                                    >
                                      {isImg ? (
                                        <ImageIcon className="w-3.5 h-3.5 text-sky-500 shrink-0 group-hover/file:scale-110 transition-transform" />
                                      ) : (
                                        <FileText className="w-3.5 h-3.5 text-rose-500 shrink-0 group-hover/file:scale-110 transition-transform" />
                                      )}
                                      <span className="max-w-[170px] sm:max-w-[200px] truncate">
                                        {f.file_name}
                                      </span>
                                      <ExternalLink className="w-2.5 h-2.5 text-neutral-400 opacity-0 group-hover/file:opacity-100 transition-opacity ml-0.5 shrink-0" />
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {!details.files && details.file_count && (
                            <p>Đã tải lên: <span className="font-medium text-neutral-800 dark:text-neutral-200">{details.file_count} tệp chứng từ</span></p>
                          )}

                          {details.driver_note && (
                            <p>Ghi chú tài xế: <span className="italic text-neutral-700 dark:text-neutral-300">"{details.driver_note}"</span></p>
                          )}

                          {details.supplement_note && (
                            <p className="text-amber-700 dark:text-amber-400 font-medium">Lý do yêu cầu: <span>"{details.supplement_note}"</span></p>
                          )}

                          {details.prev_status && details.new_status && (
                            <p className="text-[11px] text-neutral-400">
                              Trạng thái: <span className="font-mono">{details.prev_status}</span> ➔ <span className="font-mono font-medium text-neutral-700 dark:text-neutral-300">{details.new_status}</span>
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bottom Actions Toolbar */}
          <div className="pt-2 flex flex-col sm:flex-row sm:justify-between items-stretch sm:items-center gap-2.5">
            <div>
              <Button
                variant="outline"
                onClick={handleShare}
                isLoading={shareMutation.isPending}
                className="w-full sm:w-auto h-11 sm:h-10 text-sm font-medium"
                title="Sao chép đường link công khai để chia sẻ cho người khác xem"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-1.5 text-emerald-600 dark:text-emerald-400" />
                    <span>{t('invoice_tracking.action.copied')}</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4 mr-1.5 text-neutral-600 dark:text-neutral-400" />
                    <span>{t('invoice_tracking.action.share')}</span>
                  </>
                )}
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              {canUpload && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setShowCopyModal(true)}
                    className="w-full sm:w-auto h-11 sm:h-10 text-sm font-medium"
                    title="Sao chép chứng từ từ chuyến xe khác cùng ngày"
                  >
                    <Copy className="w-4 h-4 mr-1.5 text-sky-600 dark:text-sky-400" />
                    <span>Sao chép chứng từ</span>
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => setShowUpload(true)}
                    className="w-full sm:w-auto h-11 sm:h-10 text-sm font-medium"
                  >
                    <Upload className="w-4 h-4 mr-1.5" />
                    <span>{t('invoice_tracking.action.upload')}</span>
                  </Button>
                </>
              )}
              {canRequestSupplement && (
                <Button
                  variant="secondary"
                  onClick={() => setShowSupplement(true)}
                  className="w-full sm:w-auto h-11 sm:h-10 text-sm font-medium"
                >
                  {t('invoice_tracking.action.requestSupplement')}
                </Button>
              )}
              {canFinish && (
                <Button
                  variant="primary"
                  onClick={() => setShowConfirmFinish(true)}
                  className="w-full sm:w-auto h-11 sm:h-10 text-sm font-medium"
                >
                  {t('invoice_tracking.action.finish')}
                </Button>
              )}
              <Button
                variant="outline"
                onClick={onClose}
                className="w-full sm:w-auto h-11 sm:h-10 text-sm font-medium"
              >
                Đóng
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      <UploadDocumentsModal
        isOpen={showUpload}
        onClose={() => setShowUpload(false)}
        onSubmit={handleUpload}
        onOpenCopyModal={() => setShowCopyModal(true)}
        isLoading={uploadMutation.isPending}
      />
      <CopyDocumentsModal
        ticketId={ticket.id}
        ticketDate={ticket.ngay}
        isOpen={showCopyModal}
        onClose={() => setShowCopyModal(false)}
        onSuccess={() => onClose()}
      />
      <SupplementNoteDialog
        isOpen={showSupplement}
        onClose={() => setShowSupplement(false)}
        onSubmit={handleRequestSupplement}
        isLoading={reviewMutation.isPending}
      />
      <ConfirmFinishDialog
        isOpen={showConfirmFinish}
        onClose={() => setShowConfirmFinish(false)}
        onConfirm={handleFinish}
        isLoading={reviewMutation.isPending}
      />

      {/* Preview File From History Timeline */}
      <DocumentViewerModal
        document={selectedHistoryDoc}
        onClose={() => setSelectedHistoryDoc(null)}
      />

      {/* Share Ticket Dialog */}
      <ShareTicketDialog
        isOpen={showShareDialog}
        onClose={() => setShowShareDialog(false)}
        shareUrl={shareUrl}
        plateNumber={ticket.bien_so}
      />
    </>
  );
}
