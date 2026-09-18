import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { DateInput } from '../../components/ui/DateInput';
import { Modal } from '../../components/ui/Modal';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { Select } from '../../components/ui/Select';
import { useI18n } from '../../i18n/useI18n';
import { useCustomerSurchargeMutations, useSurchargeCustomerOptions } from '../../hooks/useCustomerSurcharges';
import type { CustomerSurchargeRule, FeeType, SurchargeZone, VehicleClass } from '../../api/customerSurchargeApi';
import { FEE_TYPES, VEHICLE_CLASSES, ZONES, apiFailures, apiMessage, pointOptionLabel, supplierToken, todayIso, unitFor } from './surchargeLabels';
import { SurchargeNamePicker } from './SurchargeNamePicker';

const REASON_KEY: Record<string, string> = {
  RULE_OPEN_EXISTS: 'customerSurcharges.reason.openExists',
  RULE_OVERLAP: 'customerSurcharges.reason.overlap',
  RULE_AMBIGUOUS: 'customerSurcharges.reason.ambiguous',
  CUSTOMER_NAME_UNKNOWN: 'customerSurcharges.reason.unknownName',
};

function BranchOptionContent({
  supplier,
  point,
  address,
}: {
  supplier: string | null;
  point: string;
  address: string;
}) {
  return (
    <span className="block min-w-0">
      <span className="flex min-w-0 items-baseline gap-1.5">
        {supplier && (
          <span className="max-w-[45%] shrink-0 truncate font-semibold text-neutral-900 dark:text-neutral-50">
            {supplier}
          </span>
        )}
        <span className="min-w-0 truncate font-medium text-neutral-800 dark:text-neutral-100">{point}</span>
      </span>
      {address ? (
        <span className="mt-0.5 block truncate text-xs font-normal text-neutral-400 dark:text-neutral-500">{address}</span>
      ) : null}
    </span>
  );
}

function branchOption(point: {
  diem_tra_hang: string;
  dia_chi_giao_hang: string;
  supplier_name?: string | null;
  supplier_code?: string | null;
}, value: string) {
  return {
    value,
    label: pointOptionLabel(point),
    content: (
      <BranchOptionContent
        supplier={supplierToken(point.supplier_name, point.supplier_code)}
        point={point.diem_tra_hang}
        address={point.dia_chi_giao_hang}
      />
    ),
  };
}

interface Props {
  mode: 'create' | 'replace';
  rule?: CustomerSurchargeRule;
  onClose: () => void;
  onSaved: (message: string) => void;
  onFailed: (message: string) => void;
}

export function SurchargeFormModal({ mode, rule, onClose, onSaved, onFailed }: Props) {
  const { t } = useI18n();
  const options = useSurchargeCustomerOptions(true);
  const mutations = useCustomerSurchargeMutations();
  const [customer, setCustomer] = useState(rule?.ten_khach_hang ?? '');
  const [selected, setSelected] = useState<string[]>([]);
  const [scope, setScope] = useState<'dealer' | 'point'>(rule?.customer_id ? 'point' : 'dealer');
  const [pointId, setPointId] = useState(rule?.customer_id ? String(rule.customer_id) : '');
  const [feeType, setFeeType] = useState<FeeType>(rule?.fee_type ?? 'boc_xep');
  const [zone, setZone] = useState<string>(rule?.zone ?? '');
  const [vehicleClass, setVehicleClass] = useState<string>(rule?.vehicle_class ?? '');
  const [amount, setAmount] = useState(mode === 'replace' && rule ? String(rule.amount) : '');
  const [startDate, setStartDate] = useState(mode === 'create' ? todayIso() : '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failures, setFailures] = useState<{ ten_khach_hang: string; code: string }[]>([]);
  const [dirty, setDirty] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const readOnly = mode === 'replace';
  const submitting = mutations.create.isPending || mutations.replace.isPending;

  useEffect(() => {
    if (!dirty) return;
    const onLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, [dirty]);

  const dealerName = readOnly ? customer : selected[0] ?? '';
  const many = !readOnly && selected.length > 1;
  const points = useMemo(
    () => (options.data?.points ?? []).filter((point) => point.ten_khach_hang === dealerName),
    [options.data?.points, dealerName],
  );
  const pointOptions = useMemo(() => {
    const mapped = points.map((point) => branchOption(point, String(point.id)));
    if (rule?.customer_id && rule.diem_tra_hang && !mapped.some((option) => option.value === String(rule.customer_id))) {
      mapped.unshift(
        branchOption(
          {
            diem_tra_hang: rule.diem_tra_hang,
            dia_chi_giao_hang: rule.dia_chi_giao_hang ?? '',
            supplier_name: rule.supplier_name,
            supplier_code: rule.supplier_code,
          },
          String(rule.customer_id),
        ),
      );
    }
    return mapped;
  }, [points, rule]);

  function mark<T>(setter: (value: T) => void) {
    return (value: T) => {
      setDirty(true);
      setter(value);
    };
  }

  function requestClose() {
    if (dirty) setConfirmDiscard(true);
    else onClose();
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!readOnly && (selected.length === 0 || selected.some((name) => !options.data?.names.includes(name)))) {
      next.customer = t('customerSurcharges.validation.customer');
    }
    if (!readOnly && selected.length === 1 && scope === 'point' && !pointId) next.point = t('customerSurcharges.validation.point');
    if (!/^\d+$/.test(amount)) next.amount = t('customerSurcharges.validation.amount');
    if (!startDate) next.startDate = t('customerSurcharges.validation.required');
    if (mode === 'replace' && rule && startDate && startDate <= rule.start_date) {
      next.startDate = t('customerSurcharges.validation.replaceDate');
    }
    setErrors(next);
    const first = Object.keys(next)[0];
    if (first) document.getElementById(`surcharge-${first}`)?.focus();
    return Object.keys(next).length === 0;
  }

  async function submit() {
    if (!validate() || submitting) return;
    try {
      if (mode === 'replace' && rule) {
        await mutations.replace.mutateAsync({ id: rule.id, amount: Number(amount), start_date: startDate });
        onSaved(t('customerSurcharges.message.success.replace'));
      } else {
        const created = await mutations.create.mutateAsync({
          ten_khach_hang: selected[0],
          ten_khach_hangs: selected,
          customer_id: selected.length === 1 && scope === 'point' ? Number(pointId) : null,
          fee_type: feeType,
          zone: (zone || null) as SurchargeZone | null,
          vehicle_class: (vehicleClass || null) as VehicleClass | null,
          amount: Number(amount),
          start_date: startDate,
        });
        onSaved(
          created.items.length > 1
            ? t('customerSurcharges.message.success.createMany', { n: created.items.length })
            : t('customerSurcharges.message.success.create'),
        );
      }
      onClose();
    } catch (err) {
      const nameFailures = apiFailures(err);
      if (nameFailures.length) {
        setFailures(nameFailures);
        return;
      }
      onFailed(apiMessage(err, t('customerSurcharges.message.error.generic')));
    }
  }

  return (
    <>
      <Modal isOpen title={mode === 'create' ? t('customerSurcharges.action.add') : t('customerSurcharges.action.replace')} onClose={requestClose} size="lg">
        <div className="space-y-4">
          {readOnly ? (
            <SearchableSelect
              label={t('customerSurcharges.field.customer')}
              value={customer}
              disabled
              placeholder={t('customerSurcharges.placeholder.customer')}
              options={(options.data?.names ?? []).map((name) => ({ value: name, label: name }))}
              onChange={() => undefined}
            />
          ) : (
            <SurchargeNamePicker
              label={t('customerSurcharges.field.customer')}
              names={options.data?.names ?? []}
              selected={selected}
              placeholder={t('customerSurcharges.placeholder.customer')}
              error={errors.customer}
              onChange={(names) => {
                setDirty(true);
                setSelected(names);
                setFailures([]);
                if (names.length !== 1) {
                  setScope('dealer');
                  setPointId('');
                }
              }}
            />
          )}
          {!many && (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{t('customerSurcharges.field.scope')}</legend>
            {(['dealer', 'point'] as const).map((item) => (
              <label key={item} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="surcharge-scope"
                  className="focus-visible:ring-2"
                  checked={scope === item}
                  disabled={readOnly}
                  onChange={() => mark(setScope)(item)}
                />
                {t(`customerSurcharges.scope.${item}`)}
              </label>
            ))}
          </fieldset>
          )}
          {!many && scope === 'point' && (
            <div id="surcharge-point">
              <SearchableSelect
                label={t('customerSurcharges.field.branch')}
                value={pointId}
                disabled={readOnly || !dealerName}
                placeholder={t('customerSurcharges.placeholder.point')}
                options={pointOptions}
                error={errors.point}
                onChange={mark(setPointId)}
              />
            </div>
          )}
          <Select
            id="surcharge-feeType"
            label={t('customerSurcharges.field.feeType')}
            value={feeType}
            disabled={readOnly}
            options={FEE_TYPES.map((item) => ({ value: item, label: t(`customerSurcharges.fee.${item}`) }))}
            onChange={(event) => mark(setFeeType)(event.target.value as FeeType)}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              id="surcharge-zone"
              label={t('customerSurcharges.field.zone')}
              value={zone}
              disabled={readOnly}
              options={[{ value: '', label: t('customerSurcharges.zone.any') }, ...ZONES.map((item) => ({ value: item, label: t(`customerSurcharges.zone.${item}`) }))]}
              onChange={(event) => mark(setZone)(event.target.value)}
            />
            <Select
              id="surcharge-vehicle"
              label={t('customerSurcharges.field.vehicleClass')}
              value={vehicleClass}
              disabled={readOnly}
              options={[{ value: '', label: t('customerSurcharges.vehicle.any') }, ...VEHICLE_CLASSES.map((item) => ({ value: item, label: t(`customerSurcharges.vehicle.${item}`) }))]}
              onChange={(event) => mark(setVehicleClass)(event.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="surcharge-amount" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                {t('customerSurcharges.field.amount')}
              </label>
              <input
                id="surcharge-amount"
                name="amount"
                inputMode="numeric"
                autoComplete="off"
                value={amount}
                onChange={(event) => mark(setAmount)(event.target.value.replace(/\D/g, ''))}
                className="w-full px-3 py-2 border rounded-lg tabular-nums text-neutral-900 dark:text-neutral-100 dark:bg-neutral-900 focus-visible:ring-2"
              />
              {errors.amount && <p className="mt-1 text-sm text-red-600">{errors.amount}</p>}
              <p className="mt-1 text-sm text-neutral-500">{t(`customerSurcharges.unit.${unitFor(feeType)}`)}. {t('customerSurcharges.hint.rateOnly')}</p>
            </div>
            <div>
              <label htmlFor="surcharge-startDate" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                {t('customerSurcharges.field.startDate')}
              </label>
              <div id="surcharge-startDate">
                <DateInput value={startDate} onChange={mark(setStartDate)} error={errors.startDate} />
              </div>
              {mode === 'replace' && <p className="mt-1 text-sm text-neutral-500">{t('customerSurcharges.hint.replaceDate')}</p>}
            </div>
          </div>
          {failures.length > 0 && (
            <div aria-live="polite" className="text-sm text-red-600">
              <p>{t('customerSurcharges.message.createFailed')}</p>
              <ul className="mt-1 space-y-1">
                {[...failures].sort((a, b) => selected.indexOf(a.ten_khach_hang) - selected.indexOf(b.ten_khach_hang)).map((item) => (
                  <li key={item.ten_khach_hang}>
                    {item.ten_khach_hang} — {t(REASON_KEY[item.code] ?? 'customerSurcharges.message.error.generic')}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={requestClose}>{t('customerSurcharges.action.cancel')}</Button>
            <Button type="button" onClick={() => void submit()} isLoading={submitting} disabled={submitting}>
              {submitting ? t('customerSurcharges.saving') : t('customerSurcharges.action.save')}
            </Button>
          </div>
        </div>
      </Modal>
      <Modal isOpen={confirmDiscard} title={t('customerSurcharges.confirm.discard')} onClose={() => setConfirmDiscard(false)} size="sm">
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setConfirmDiscard(false)}>{t('customerSurcharges.action.stay')}</Button>
          <Button type="button" variant="danger" onClick={onClose}>{t('customerSurcharges.action.discard')}</Button>
        </div>
      </Modal>
    </>
  );
}
