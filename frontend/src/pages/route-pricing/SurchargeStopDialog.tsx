import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { DateInput } from '../../components/ui/DateInput';
import { Modal } from '../../components/ui/Modal';
import { useI18n } from '../../i18n/useI18n';
import { useCustomerSurchargeMutations } from '../../hooks/useCustomerSurcharges';
import type { CustomerSurchargeRule } from '../../api/customerSurchargeApi';
import { apiMessage, formatMoney, todayIso } from './surchargeLabels';

interface Props {
  rule: CustomerSurchargeRule;
  onClose: () => void;
  onSaved: (message: string) => void;
  onFailed: (message: string) => void;
}

export function SurchargeStopDialog({ rule, onClose, onSaved, onFailed }: Props) {
  const { t } = useI18n();
  const mutations = useCustomerSurchargeMutations();
  const [endDate, setEndDate] = useState(todayIso());
  const [error, setError] = useState('');

  async function submit() {
    if (endDate < rule.start_date) {
      setError(t('customerSurcharges.validation.stopDate'));
      return;
    }
    try {
      await mutations.stop.mutateAsync({ id: rule.id, end_date: endDate });
      onSaved(t('customerSurcharges.message.success.stop'));
      onClose();
    } catch (err) {
      onFailed(apiMessage(err, t('customerSurcharges.message.error.generic')));
    }
  }

  const zone = rule.zone ? t(`customerSurcharges.zone.${rule.zone}`) : t('customerSurcharges.zone.any');
  const vehicle = rule.vehicle_class ? t(`customerSurcharges.vehicle.${rule.vehicle_class}`) : t('customerSurcharges.vehicle.any');

  return (
    <Modal isOpen title={t('customerSurcharges.confirm.stopTitle')} onClose={onClose} size="md">
      <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-3">
        {rule.ten_khach_hang} · {t(`customerSurcharges.fee.${rule.fee_type}`)} · {zone} · {vehicle}
      </p>
      <p className="text-sm tabular-nums mb-3">{formatMoney(rule.amount)}</p>
      <p className="text-sm text-neutral-500 mb-4">{t('customerSurcharges.confirm.stopBody')}</p>
      <label htmlFor="surcharge-stop-date" className="block text-sm font-medium mb-1.5">{t('customerSurcharges.field.endDate')}</label>
      <DateInput value={endDate} onChange={setEndDate} error={error} />
      <div className="flex justify-end gap-2 mt-4">
        <Button type="button" variant="outline" onClick={onClose}>{t('customerSurcharges.action.cancel')}</Button>
        <Button type="button" variant="danger" onClick={() => void submit()} isLoading={mutations.stop.isPending} disabled={mutations.stop.isPending}>
          {mutations.stop.isPending ? t('customerSurcharges.stopping') : t('customerSurcharges.action.stop')}
        </Button>
      </div>
    </Modal>
  );
}
