import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { useI18n } from '../../i18n/useI18n';
import { useCustomerSurchargeMutations } from '../../hooks/useCustomerSurcharges';
import type { CustomerSurchargeRule } from '../../api/customerSurchargeApi';
import { apiMessage } from './surchargeLabels';

interface Props {
  rule: CustomerSurchargeRule;
  onClose: () => void;
  onSaved: (message: string) => void;
  onFailed: (message: string) => void;
}

export function SurchargeDeleteDialog({ rule, onClose, onSaved, onFailed }: Props) {
  const { t } = useI18n();
  const mutations = useCustomerSurchargeMutations();
  const closed = rule.end_date != null;
  const hasHistory = !closed && Boolean(rule.has_closed_prior);
  const title = closed
    ? t('customerSurcharges.confirm.deleteClosed')
    : hasHistory
      ? t('customerSurcharges.confirm.deleteOpenHasHistory')
      : t('customerSurcharges.confirm.deleteOpen');
  const body = closed
    ? t('customerSurcharges.confirm.deleteClosedBody')
    : hasHistory
      ? t('customerSurcharges.confirm.deleteOpenHasHistoryBody')
      : t('customerSurcharges.confirm.deleteOpenBody');

  async function submit() {
    try {
      await mutations.remove.mutateAsync(rule.id);
      onSaved(t('customerSurcharges.message.success.delete'));
      onClose();
    } catch (err) {
      onFailed(apiMessage(err, t('customerSurcharges.message.error.generic')));
    }
  }

  return (
    <Modal isOpen title={title} onClose={onClose} size="md">
      <p className="text-sm text-neutral-700 dark:text-neutral-300">{body}</p>
      {hasHistory && rule.customer_id != null && (
        <p className="text-sm text-neutral-700 dark:text-neutral-300 mt-2">{t('customerSurcharges.confirm.deletePointFallback')}</p>
      )}
      <div className="flex justify-end gap-2 mt-4">
        <Button type="button" variant="outline" onClick={onClose}>{t('customerSurcharges.action.cancel')}</Button>
        <Button type="button" variant="danger" onClick={() => void submit()} isLoading={mutations.remove.isPending} disabled={mutations.remove.isPending}>
          {mutations.remove.isPending ? t('customerSurcharges.deleting') : t('customerSurcharges.action.delete')}
        </Button>
      </div>
    </Modal>
  );
}
