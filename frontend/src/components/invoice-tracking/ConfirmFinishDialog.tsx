import { useI18n } from '../../i18n/useI18n';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface ConfirmFinishDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
}

export function ConfirmFinishDialog({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
}: ConfirmFinishDialogProps) {
  const { t } = useI18n();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('invoice_tracking.confirmFinish.title')} size="sm">
      <div className="space-y-4">
        <p className="text-sm text-neutral-700 dark:text-neutral-300">
          {t('invoice_tracking.confirmFinish.message')}
        </p>
        <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-800/60 p-3 rounded-lg border border-neutral-200/60 dark:border-neutral-700/60">
          {t('invoice_tracking.confirmFinish.warning')}
        </p>
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="w-full sm:w-auto h-11 sm:h-10"
          >
            {t('invoice_tracking.action.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={onConfirm}
            isLoading={isLoading}
            className="w-full sm:w-auto h-11 sm:h-10"
          >
            {t('invoice_tracking.action.confirm')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
