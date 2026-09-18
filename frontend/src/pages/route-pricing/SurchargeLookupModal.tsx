import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { DateInput } from '../../components/ui/DateInput';
import { Modal } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Select';
import { useI18n } from '../../i18n/useI18n';
import { useCustomerSurchargeMutations } from '../../hooks/useCustomerSurcharges';
import type { FeeHit, FeeType, SurchargeLookupResult, SurchargeZone, VehicleClass } from '../../api/customerSurchargeApi';
import { FEE_TYPES, VEHICLE_CLASSES, ZONES, apiMessage, formatMoney, matchedPointLabel, todayIso } from './surchargeLabels';

interface Props {
  onClose: () => void;
  onFailed: (message: string) => void;
}

export function SurchargeLookupModal({ onClose, onFailed }: Props) {
  const { t } = useI18n();
  const mutations = useCustomerSurchargeMutations();
  const [customer, setCustomer] = useState('');
  const [address, setAddress] = useState('');
  const [zone, setZone] = useState<SurchargeZone | ''>('');
  const [vehicleClass, setVehicleClass] = useState<VehicleClass | ''>('');
  const [onDate, setOnDate] = useState(todayIso());
  const [supplierCode, setSupplierCode] = useState('');
  const [submittedCode, setSubmittedCode] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<SurchargeLookupResult | null>(null);

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!customer.trim()) next.customer = t('customerSurcharges.validation.required');
    if (!address.trim()) next.address = t('customerSurcharges.validation.required');
    if (!zone) next.zone = t('customerSurcharges.validation.zone');
    if (!vehicleClass) next.vehicle = t('customerSurcharges.validation.vehicle');
    if (!onDate) next.onDate = t('customerSurcharges.validation.required');
    setErrors(next);
    const first = Object.keys(next)[0];
    if (first) document.getElementById(`lookup-${first}`)?.focus();
    return Object.keys(next).length === 0;
  }

  async function submit() {
    if (!validate() || !zone || !vehicleClass) return;
    try {
      const code = supplierCode.trim();
      const data = await mutations.lookup.mutateAsync({
        ten_khach_hang: customer,
        dia_chi_giao_hang: address,
        zone,
        vehicle_class: vehicleClass,
        on_date: onDate,
        supplier_code: code || undefined,
      });
      setSubmittedCode(code);
      setResult(data);
    } catch (err) {
      onFailed(apiMessage(err, t('customerSurcharges.message.error.generic')));
    }
  }

  function pointText(): string {
    if (!result) return '';
    if (result.point_status === 'NO_POINT') return t('customerSurcharges.lookup.noPoint');
    if (result.point_status === 'AMBIGUOUS') {
      return submittedCode
        ? t('customerSurcharges.lookup.ambiguousSameCode')
        : t('customerSurcharges.lookup.ambiguousNeedCode');
    }
    return result.point?.diem_tra_hang ?? '';
  }

  function feeText(hit: FeeHit): { rate: string; result: string; source: string } {
    if (hit.reason === 'NO_RULE') return { rate: '—', result: t('customerSurcharges.lookup.noRule'), source: '' };
    if (hit.reason === 'AMBIGUOUS') return { rate: '—', result: t('customerSurcharges.lookup.ambiguous'), source: '' };
    return {
      rate: hit.rate == null ? '—' : formatMoney(hit.rate),
      result: t('customerSurcharges.lookup.matched'),
      source: hit.scope === 'diem' ? t('customerSurcharges.scope.pointShort') : t('customerSurcharges.scope.dealerShort'),
    };
  }

  return (
    <Modal isOpen title={t('customerSurcharges.action.lookup')} onClose={onClose} size="lg">
      <div className="space-y-3">
        <p className="text-sm text-neutral-500">{t('customerSurcharges.lookup.freeText')}</p>
        <div>
          <label htmlFor="lookup-customer" className="block text-sm font-medium mb-1.5">{t('customerSurcharges.field.customer')}</label>
          <input
            id="lookup-customer"
            name="ten_khach_hang"
            autoComplete="off"
            spellCheck={false}
            value={customer}
            onChange={(event) => setCustomer(event.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus-visible:ring-2"
          />
          {errors.customer && <p className="mt-1 text-sm text-red-600">{errors.customer}</p>}
        </div>
        <div>
          <label htmlFor="lookup-address" className="block text-sm font-medium mb-1.5">{t('customerSurcharges.field.address')}</label>
          <textarea
            id="lookup-address"
            name="dia_chi_giao_hang"
            autoComplete="off"
            rows={2}
            placeholder={t('customerSurcharges.placeholder.address')}
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus-visible:ring-2"
          />
          {errors.address && <p className="mt-1 text-sm text-red-600">{errors.address}</p>}
        </div>
        <div>
          <label htmlFor="lookup-supplier" className="block text-sm font-medium mb-1.5">{t('customerSurcharges.field.supplierCode')}</label>
          <input
            id="lookup-supplier"
            name="supplier_code"
            autoComplete="off"
            spellCheck={false}
            translate="no"
            placeholder={t('customerSurcharges.placeholder.supplierCode')}
            value={supplierCode}
            onChange={(event) => setSupplierCode(event.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus-visible:ring-2"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Select
            id="lookup-zone"
            label={t('customerSurcharges.field.zone')}
            value={zone}
            error={errors.zone}
            options={[{ value: '', label: t('customerSurcharges.placeholder.customer') }, ...ZONES.map((item) => ({ value: item, label: t(`customerSurcharges.zone.${item}`) }))]}
            onChange={(event) => setZone(event.target.value as SurchargeZone | '')}
          />
          <Select
            id="lookup-vehicle"
            label={t('customerSurcharges.field.vehicleClass')}
            value={vehicleClass}
            error={errors.vehicle}
            options={[{ value: '', label: t('customerSurcharges.placeholder.customer') }, ...VEHICLE_CLASSES.map((item) => ({ value: item, label: t(`customerSurcharges.vehicle.${item}`) }))]}
            onChange={(event) => setVehicleClass(event.target.value as VehicleClass | '')}
          />
          <div>
            <label htmlFor="lookup-onDate" className="block text-sm font-medium mb-1.5">{t('customerSurcharges.field.onDate')}</label>
            <div id="lookup-onDate"><DateInput value={onDate} onChange={setOnDate} error={errors.onDate} /></div>
          </div>
        </div>
        <Button type="button" onClick={() => void submit()} isLoading={mutations.lookup.isPending} disabled={mutations.lookup.isPending}>
          {mutations.lookup.isPending ? t('customerSurcharges.lookingUp') : t('customerSurcharges.action.lookup')}
        </Button>
        {result && (
          <div className="border-t pt-3 space-y-2 text-sm">
            <p><span className="text-neutral-500">{t('customerSurcharges.lookup.pointLabel')}: </span>{result.point_status === 'MATCHED' && result.point ? matchedPointLabel(result.point) : pointText()}</p>
            <p><span className="text-neutral-500">{t('customerSurcharges.lookup.routeLabel')}: </span>{result.point_status === 'MATCHED' ? (result.point?.tuyen_phuong || '—') : pointText()}</p>
            <p><span className="text-neutral-500">{t('customerSurcharges.lookup.feePointLabel')}: </span>{result.point_status === 'MATCHED' ? (result.point?.diem_giao_hang_tinh_phi || '—') : pointText()}</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-neutral-500">
                  <th>{t('customerSurcharges.field.feeType')}</th>
                  <th>{t('customerSurcharges.field.amount')}</th>
                  <th>{t('customerSurcharges.field.source')}</th>
                  <th>{t('customerSurcharges.field.result')}</th>
                </tr>
              </thead>
              <tbody>
                {FEE_TYPES.map((fee: FeeType) => {
                  const hit = feeText(result.fees[fee]);
                  return (
                    <tr key={fee}>
                      <td>{t(`customerSurcharges.fee.${fee}`)}</td>
                      <td className="tabular-nums">{hit.rate}</td>
                      <td>{hit.source}</td>
                      <td>{hit.result}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}
