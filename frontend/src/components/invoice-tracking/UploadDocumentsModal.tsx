import { useState, useRef, useEffect } from 'react';
import { useI18n } from '../../i18n/useI18n';
import { Upload, X, AlertCircle, FileText, Image as ImageIcon, Copy } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface FileItem {
  file: File;
  previewUrl?: string;
  error?: string;
}

interface UploadDocumentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (files: File[], note: string) => void;
  onOpenCopyModal?: () => void;
  isLoading?: boolean;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_SIZE = 50 * 1024 * 1024; // 50MB to match backend limit
const MAX_FILES = 10;

export function UploadDocumentsModal({
  isOpen,
  onClose,
  onSubmit,
  onOpenCopyModal,
  isLoading,
}: UploadDocumentsModalProps) {
  const { t } = useI18n();
  const [fileItems, setFileItems] = useState<FileItem[]>([]);
  const [note, setNote] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cleanupPreviews = (items: FileItem[]) => {
    items.forEach((item) => {
      if (item.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
      }
    });
  };

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      cleanupPreviews(fileItems);
    };
  }, []);

  const validateAndBuildFiles = (files: File[]): FileItem[] => {
    return files.map((file) => {
      if (!ALLOWED_TYPES.includes(file.type)) {
        return { file, error: t('invoice_tracking.upload.errorType') };
      }
      if (file.size > MAX_SIZE) {
        return { file, error: t('invoice_tracking.upload.errorSize') };
      }
      let previewUrl: string | undefined;
      if (file.type.startsWith('image/')) {
        previewUrl = URL.createObjectURL(file);
      }
      return { file, previewUrl };
    });
  };

  const handleFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const totalFiles = fileItems.length + fileArray.length;

    if (totalFiles > MAX_FILES) {
      setFileItems((prev) => [
        ...prev,
        { file: fileArray[0], error: t('invoice_tracking.upload.errorCount') },
      ]);
      return;
    }

    const validated = validateAndBuildFiles(fileArray);
    setFileItems((prev) => [...prev, ...validated]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const removeFile = (index: number) => {
    setFileItems((prev) => {
      const target = prev[index];
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSubmit = () => {
    const validFiles = fileItems.filter((f) => !f.error).map((f) => f.file);
    if (validFiles.length === 0) return;
    onSubmit(validFiles, note.trim());
    cleanupPreviews(fileItems);
    setFileItems([]);
    setNote('');
  };

  const handleClose = () => {
    cleanupPreviews(fileItems);
    setFileItems([]);
    setNote('');
    onClose();
  };

  const validCount = fileItems.filter((f) => !f.error).length;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t('invoice_tracking.upload.title')} size="md">
      <div className="space-y-4">
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`cursor-pointer rounded-xl border-2 border-dashed p-5 sm:p-7 text-center transition ${
            dragOver
              ? 'border-primary bg-primary/5'
              : 'border-neutral-300 hover:border-primary dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
          }`}
        >
          <Upload className="mx-auto h-8 w-8 sm:h-10 sm:w-10 text-neutral-400" />
          <p className="mt-2 text-xs sm:text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {t('invoice_tracking.upload.dropzone')}
          </p>
          <p className="mt-1 text-[11px] sm:text-xs text-neutral-500">{t('invoice_tracking.upload.supported')}</p>
          <p className="text-[11px] sm:text-xs text-neutral-400">{t('invoice_tracking.upload.max')}</p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={(e) => {
              if (e.target.files) {
                handleFiles(e.target.files);
                e.target.value = '';
              }
            }}
            className="hidden"
          />
        </div>

        {onOpenCopyModal && fileItems.length === 0 && (
          <div className="text-center pt-0.5">
            <button
              type="button"
              onClick={() => {
                handleClose();
                onOpenCopyModal();
              }}
              className="inline-flex items-center gap-1.5 text-xs text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 font-medium py-1 px-2.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5 text-sky-500" />
              <span>Hoặc sao chép chứng từ từ chuyến xe khác cùng ngày</span>
            </button>
          </div>
        )}

        {fileItems.length > 0 && (
          <div className="max-h-44 sm:max-h-52 space-y-2 overflow-y-auto pr-1">
            {fileItems.map((item, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-2.5 rounded-lg border p-2.5 transition-colors ${
                  item.error
                    ? 'border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/30'
                    : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/40'
                }`}
              >
                {item.previewUrl ? (
                  <img
                    src={item.previewUrl}
                    alt={item.file.name}
                    className="w-10 h-10 object-cover rounded shrink-0 border border-neutral-200 dark:border-neutral-700"
                  />
                ) : item.file.type === 'application/pdf' ? (
                  <div className="w-10 h-10 rounded bg-rose-100 dark:bg-rose-950/60 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center shrink-0">
                    <ImageIcon className="w-5 h-5 text-neutral-500" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <p className="truncate text-xs sm:text-sm font-medium text-neutral-800 dark:text-neutral-200">
                    {item.file.name}
                  </p>
                  <p className="text-[11px] text-neutral-400">
                    {(item.file.size / 1024 / 1024).toFixed(2)} MB
                    {item.error && <span className="ml-2 text-red-500 font-medium">{item.error}</span>}
                  </p>
                </div>

                {item.error ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      className="p-1 text-neutral-400 hover:text-red-500 rounded transition-colors cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    className="p-1 text-neutral-400 hover:text-red-500 rounded transition-colors shrink-0 cursor-pointer"
                    title="Xóa file"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-xs sm:text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {t('invoice_tracking.upload.noteLabel')}
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('invoice_tracking.upload.notePlaceholder')}
            rows={3}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-base sm:text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 placeholder:text-neutral-400"
          />
        </div>

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
            className="w-full sm:w-auto h-11 sm:h-10"
          >
            {t('invoice_tracking.action.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            isLoading={isLoading}
            disabled={validCount === 0 || isLoading}
            className="w-full sm:w-auto h-11 sm:h-10"
          >
            {t('invoice_tracking.upload.submit')} ({validCount})
          </Button>
        </div>
      </div>
    </Modal>
  );
}
