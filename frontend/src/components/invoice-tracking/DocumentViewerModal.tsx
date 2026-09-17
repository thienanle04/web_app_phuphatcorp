import { useEffect, useCallback } from 'react';
import { FileText, X, Download, ExternalLink, ChevronLeft, ChevronRight, Copy } from 'lucide-react';
import { type DocumentFile, invoiceTrackingApi } from '../../api/invoiceTrackingApi';

interface DocumentViewerModalProps {
  document: DocumentFile | null;
  documents?: DocumentFile[];
  onClose: () => void;
  onNavigate?: (doc: DocumentFile) => void;
}

export function DocumentViewerModal({
  document: doc,
  documents = [],
  onClose,
  onNavigate,
}: DocumentViewerModalProps) {
  const currentIndex =
    doc && documents.length > 0
      ? documents.findIndex(
          (d) =>
            (d.filename && d.filename === doc.filename) ||
            (d.original_filename && d.original_filename === doc.original_filename) ||
            (d.file_name && d.file_name === doc.file_name),
        )
      : -1;

  const hasMultiple = documents.length > 1 && currentIndex >= 0;
  const hasPrev = hasMultiple && currentIndex > 0;
  const hasNext = hasMultiple && currentIndex < documents.length - 1;

  const handlePrev = useCallback(() => {
    if (hasPrev && onNavigate) {
      onNavigate(documents[currentIndex - 1]);
    }
  }, [hasPrev, onNavigate, documents, currentIndex]);

  const handleNext = useCallback(() => {
    if (hasNext && onNavigate) {
      onNavigate(documents[currentIndex + 1]);
    }
  }, [hasNext, onNavigate, documents, currentIndex]);

  // Handle Keyboard navigation (ESC, ArrowLeft, ArrowRight)
  useEffect(() => {
    if (!doc) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [doc, onClose, handlePrev, handleNext]);

  if (!doc) return null;

  const fileName = doc.original_filename || doc.file_name || 'Chứng từ';
  const fileUrl = doc.filename ? `/api/invoice-tracking/files/${doc.filename}` : null;
  const isImage = doc.mime_type?.startsWith('image/');

  const handleDownload = () => {
    invoiceTrackingApi.downloadDocumentFile(doc, fileName);
  };

  const handleOpenPdfTab = () => {
    if (doc.filename) {
      window.open(`/api/invoice-tracking/files/${doc.filename}`, '_blank');
    } else if (doc.file_data) {
      try {
        const byteCharacters = atob(doc.file_data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: doc.mime_type });
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank');
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
      } catch (e) {
        console.error('Failed to open PDF tab:', e);
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 sm:p-4 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Xem chứng từ"
    >
      <div
        className="relative max-h-[92vh] max-w-[95vw] sm:max-w-[90vw] overflow-hidden rounded-2xl bg-white dark:bg-neutral-900 shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 sm:px-4 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-2 truncate max-w-[200px] sm:max-w-md">
            {hasMultiple && (
              <span className="px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-[11px] font-mono font-semibold text-neutral-600 dark:text-neutral-300 shrink-0">
                {currentIndex + 1} / {documents.length}
              </span>
            )}
            <span className="text-xs sm:text-sm font-medium text-neutral-800 dark:text-neutral-200 truncate">
              {fileName}
            </span>
            {doc.source_plate_number && (
              <span className="px-2 py-0.5 rounded-full bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-[10px] font-medium shrink-0 flex items-center gap-1">
                <Copy className="w-2.5 h-2.5 text-sky-400" />
                <span>Từ xe {doc.source_plate_number}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {doc.mime_type === 'application/pdf' && (
              <button
                type="button"
                onClick={handleOpenPdfTab}
                className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
                title="Mở trong tab mới"
                aria-label="Mở PDF trong tab mới"
              >
                <ExternalLink className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={handleDownload}
              className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
              title="Tải về máy"
              aria-label="Tải về máy"
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
              title="Đóng (Esc)"
              aria-label="Đóng"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content Viewer with Navigation arrows */}
        <div className="relative p-2 sm:p-4 flex items-center justify-center overflow-auto max-h-[80vh] min-h-[220px]">
          {/* Back Button */}
          {hasMultiple && (
            <button
              type="button"
              onClick={handlePrev}
              disabled={!hasPrev}
              className={`absolute left-2 sm:left-4 z-10 p-2 sm:p-2.5 rounded-full bg-black/60 text-white shadow-lg backdrop-blur-xs transition-all ${
                hasPrev
                  ? 'hover:bg-black/80 hover:scale-105 cursor-pointer opacity-85 hover:opacity-100'
                  : 'opacity-20 cursor-not-allowed'
              }`}
              title="Hình trước (←)"
              aria-label="Hình trước"
            >
              <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          )}

          {/* Media Rendering */}
          <div className="flex items-center justify-center w-full h-full px-8 sm:px-12">
            {isImage && (fileUrl || doc.file_data) ? (
              <img
                src={fileUrl || `data:${doc.mime_type};base64,${doc.file_data}`}
                alt={fileName}
                className="max-h-[75vh] w-auto max-w-full object-contain rounded-lg transition-all duration-150 select-none"
              />
            ) : (
              <div className="flex h-56 w-72 flex-col items-center justify-center gap-3 text-center p-4">
                <div className="w-14 h-14 rounded-2xl bg-rose-100 dark:bg-rose-950/60 flex items-center justify-center text-rose-600 dark:text-rose-400">
                  <FileText className="h-8 w-8" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-semibold text-neutral-800 dark:text-neutral-200 truncate max-w-full">
                    {fileName}
                  </p>
                  <p className="text-[11px] text-neutral-400 mt-1">Định dạng {doc.mime_type || 'Tài liệu'}</p>
                </div>
                {doc.mime_type === 'application/pdf' && (
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      type="button"
                      onClick={handleOpenPdfTab}
                      className="px-3 py-1.5 rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-xs font-medium hover:bg-neutral-800 dark:hover:bg-neutral-200 transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Mở trong tab mới
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Next Button */}
          {hasMultiple && (
            <button
              type="button"
              onClick={handleNext}
              disabled={!hasNext}
              className={`absolute right-2 sm:right-4 z-10 p-2 sm:p-2.5 rounded-full bg-black/60 text-white shadow-lg backdrop-blur-xs transition-all ${
                hasNext
                  ? 'hover:bg-black/80 hover:scale-105 cursor-pointer opacity-85 hover:opacity-100'
                  : 'opacity-20 cursor-not-allowed'
              }`}
              title="Hình tiếp theo (→)"
              aria-label="Hình tiếp theo"
            >
              <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
