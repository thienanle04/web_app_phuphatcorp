import { useState } from 'react';
import { useI18n } from '../../i18n/useI18n';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface SupplementNoteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (note: string) => void;
  isLoading?: boolean;
}

export function SupplementNoteDialog({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
}: SupplementNoteDialogProps) {
  const { t } = useI18n();
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const trimmedNote = note.trim();
  const isValid = trimmedNote.length >= 5;

  const handleSubmit = () => {
    if (!isValid) {
      setError(t('invoice_tracking.supplement.noteRequired'));
      return;
    }
    onSubmit(trimmedNote);
    setNote('');
    setError('');
  };

  const handleClose = () => {
    setNote('');
    setError('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t('invoice_tracking.supplement.title')} size="sm">
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs sm:text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {t('invoice_tracking.supplement.noteLabel')} <span className="text-red-500">*</span>
          </label>
          <textarea
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              if (e.target.value.trim().length >= 5) setError('');
            }}
            placeholder={t('invoice_tracking.supplement.notePlaceholder')}
            rows={4}
            className={`w-full rounded-lg border px-3 py-2.5 text-base sm:text-sm focus:outline-none focus:ring-1 dark:bg-neutral-800 dark:text-neutral-100 placeholder:text-neutral-400 ${
              error
                ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                : 'border-neutral-300 focus:border-primary focus:ring-primary dark:border-neutral-700'
            }`}
          />
          {error ? (
            <p className="mt-1.5 text-xs sm:text-sm text-red-500 font-medium">{error}</p>
          ) : (
            <p className="mt-1 text-[11px] text-neutral-400">Tối thiểu 5 ký tự</p>
          )}
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
            disabled={!isValid || isLoading}
            variant="primary"
            className="w-full sm:w-auto h-11 sm:h-10"
          >
            {t('invoice_tracking.supplement.submit')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
