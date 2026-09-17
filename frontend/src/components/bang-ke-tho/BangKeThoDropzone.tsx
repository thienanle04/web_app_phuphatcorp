import { useCallback, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';
import { useI18n } from '../../i18n/useI18n';

const MAX_BYTES = 10 * 1024 * 1024;

interface BangKeThoDropzoneProps {
  disabled?: boolean;
  uploading?: boolean;
  file: File | null;
  onFile: (file: File | null) => void;
  onSave: () => void;
  onInvalid: (message: string) => void;
}

export function BangKeThoDropzone({
  disabled,
  uploading,
  file,
  onFile,
  onSave,
  onInvalid,
}: BangKeThoDropzoneProps) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const validate = useCallback(
    (next: File) => {
      const name = next.name.toLowerCase();
      if (!name.endsWith('.xlsx')) {
        onInvalid(t('bangKeTho.message.error.type'));
        return;
      }
      if (next.size > MAX_BYTES) {
        onInvalid(t('bangKeTho.message.error.size'));
        return;
      }
      onFile(next);
    },
    [onFile, onInvalid, t],
  );

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled || uploading) return;
    const dropped = e.dataTransfer.files[0];
    if (dropped) validate(dropped);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      inputRef.current?.click();
    }
  };

  const sizeLabel = file
    ? `${(file.size / (1024 * 1024)).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} MB`
    : '';

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={t('bangKeTho.chooseFile')}
        onKeyDown={onKeyDown}
        onClick={() => !disabled && !uploading && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled && !uploading) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          'rounded-xl border-2 border-dashed px-6 py-8 text-center cursor-pointer',
          'transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400',
          dragOver
            ? 'border-neutral-700 bg-neutral-50 dark:bg-neutral-800'
            : 'border-neutral-300 dark:border-neutral-600',
          (disabled || uploading) && 'opacity-60 cursor-not-allowed',
        )}
      >
        <FileSpreadsheet className="mx-auto h-8 w-8 text-neutral-400" aria-hidden="true" />
        <p className="mt-2 text-sm text-neutral-800 dark:text-neutral-200">{t('bangKeTho.dropzone')}</p>
        <p className="mt-1 text-xs text-neutral-500">{t('bangKeTho.dropzoneHint')}</p>
        <input
          id="bang-ke-tho-file"
          ref={inputRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          disabled={disabled || uploading}
          onChange={(e) => {
            const next = e.target.files?.[0];
            if (next) validate(next);
            e.target.value = '';
          }}
        />
      </div>
      {file && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="min-w-0 truncate" translate="no">
            {t('bangKeTho.selectedFile')}: {file.name} ({sizeLabel})
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={() => onFile(null)} disabled={uploading}>
            {t('bangKeTho.clearFile')}
          </Button>
          <Button type="button" size="sm" onClick={onSave} isLoading={uploading} disabled={uploading}>
            {t('bangKeTho.saveFile')}
          </Button>
        </div>
      )}
    </div>
  );
}
