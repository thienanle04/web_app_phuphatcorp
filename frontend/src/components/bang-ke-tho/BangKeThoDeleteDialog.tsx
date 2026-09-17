import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useI18n } from '../../i18n/useI18n';

interface BangKeThoDeleteDialogProps {
  filename: string;
  open: boolean;
  submitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function BangKeThoDeleteDialog({
  filename,
  open,
  submitting,
  onClose,
  onConfirm,
}: BangKeThoDeleteDialogProps) {
  const { t } = useI18n();

  return (
    <Modal isOpen={open} onClose={submitting ? () => undefined : onClose} title={t('bangKeTho.delete.title')} size="md">
      <div className="space-y-4">
        <p className="text-sm text-neutral-700 dark:text-neutral-300">
          {t('bangKeTho.delete.body', { filename })}
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            {t('bangKeTho.delete.cancel')}
          </Button>
          <Button type="button" variant="danger" onClick={onConfirm} isLoading={submitting} disabled={submitting}>
            {t('bangKeTho.delete.confirm')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
