import { useMemo, useRef, useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { useI18n } from '../../i18n/useI18n';
import {
  useAdjustmentPeriods,
  usePriceSets,
  useRoutePricingMutations,
} from '../../hooks/useRoutePricing';
import type { PriceSet, RoutePriceVersion } from '../../api/routePricingApi';
import { formatDate } from '../../utils/format';
import { formatTierRangeLabel } from './priceDisplay';
import { apiErrorCode, parsePositivePrice } from './priceSetForm';

function periodLabel(start: string, percent: number, note: string | null): string {
  const abs = Math.abs(percent);
  const pct = percent > 0 ? `tăng ${abs}%` : percent < 0 ? `giảm ${abs}%` : `${percent}%`;
  return `${formatDate(start)} (${pct})${note ? ` - ${note}` : ''}`;
}

export function PriceFormModal({
  routeGroupId,
  editVersion,
  boundPriceSetId,
  onClose,
}: {
  routeGroupId: number;
  editVersion?: RoutePriceVersion;
  boundPriceSetId?: number | null;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const mutations = useRoutePricingMutations();
  const { data: periods = [], isLoading: periodsLoading } = useAdjustmentPeriods();
  const { data: sets = [] } = usePriceSets();
  const isEdit = Boolean(editVersion);
  const [periodId, setPeriodId] = useState(
    editVersion?.adjustment_period_id ? String(editVersion.adjustment_period_id) : '',
  );
  const [priceSetId, setPriceSetId] = useState(
    boundPriceSetId ? String(boundPriceSetId) : '',
  );
  const [prices, setPrices] = useState<Record<number, string>>(() => {
    const next: Record<number, string> = {};
    for (const tier of editVersion?.tiers ?? []) {
      if (tier.price_set_tier_id != null) next[tier.price_set_tier_id] = String(tier.price);
    }
    return next;
  });
  const [pallet, setPallet] = useState(
    editVersion?.pallet_trip_price != null ? String(editVersion.pallet_trip_price) : '',
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const dirtyRef = useRef(false);
  const setSelectRef = useRef<HTMLSelectElement>(null);

  const selectedSet: PriceSet | undefined = sets.find((set) => String(set.id) === priceSetId);
  const earliestPeriodId = useMemo(() => {
    if (periods.length === 0) return '';
    const earliest = [...periods].sort((a, b) => a.start_date.localeCompare(b.start_date))[0];
    return earliest ? String(earliest.id) : '';
  }, [periods]);
  const effectivePeriodId = isEdit ? periodId : periodId || earliestPeriodId;
  const pending = mutations.createPrice.isPending || mutations.updateAbsolutePrice.isPending;

  function requestClose() {
    if (dirtyRef.current && !window.confirm(t('routePricing.priceSet.discard'))) return;
    onClose();
  }

  function changeSet(nextId: string) {
    if (nextId === priceSetId) return;
    const hasValue = Object.values(prices).some((v) => v.trim() !== '') || pallet.trim() !== '';
    if (hasValue && !window.confirm(t('routePricing.priceSet.discard'))) return;
    setPriceSetId(nextId);
    setPrices({});
    setPallet('');
    dirtyRef.current = true;
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!selectedSet) next.set = t('routePricing.price.pickSetRequired');
    if (!isEdit && !effectivePeriodId) next.period = t('routePricing.price.periodRequired');
    if (selectedSet) {
      for (const tier of selectedSet.tiers) {
        const raw = prices[tier.id] ?? '';
        if (!raw.trim()) continue;
        const n = parsePositivePrice(raw);
        if (n == null || n <= 0) next[`tier:${tier.id}`] = t('routePricing.price.pricePositive');
      }
      if (selectedSet.has_pallet && pallet.trim()) {
        const n = parsePositivePrice(pallet);
        if (n == null || n <= 0) next.pallet = t('routePricing.price.pricePositive');
      }
      const priced = selectedSet.tiers.some((tier) => {
        const n = parsePositivePrice(prices[tier.id] ?? '');
        return n != null && n > 0;
      });
      const palletOk = selectedSet.has_pallet && parsePositivePrice(pallet) != null && parsePositivePrice(pallet)! > 0;
      if (!priced && !palletOk && !next.set) next.form = t('routePricing.price.atLeastOne');
    }
    setErrors(next);
    setFormError(next.form ?? '');
    if (next.set) setSelectRef.current?.focus();
    else {
      const firstTier = selectedSet?.tiers.find((tier) => next[`tier:${tier.id}`]);
      if (firstTier) document.getElementById(`price-tier-${firstTier.id}`)?.focus();
      else if (next.pallet) document.getElementById('price-pallet')?.focus();
    }
    return Object.keys(next).length === 0;
  }

  async function submit() {
    if (!validate() || !selectedSet) return;
    if (isEdit && !window.confirm(t('routePricing.price.confirmRecascade'))) return;
    const tiers = selectedSet.tiers
      .map((tier) => {
        const n = parsePositivePrice(prices[tier.id] ?? '');
        return n != null && n > 0 ? { price_set_tier_id: tier.id, price: n } : null;
      })
      .filter((row): row is { price_set_tier_id: number; price: number } => row != null);
    const palletValue =
      selectedSet.has_pallet && parsePositivePrice(pallet) != null && parsePositivePrice(pallet)! > 0
        ? parsePositivePrice(pallet)
        : null;
    try {
      if (isEdit) {
        await mutations.updateAbsolutePrice.mutateAsync({
          routeGroupId,
          price_set_id: selectedSet.id,
          pallet_trip_price: palletValue,
          tiers,
        });
      } else {
        await mutations.createPrice.mutateAsync({
          route_group_id: routeGroupId,
          adjustment_period_id: Number(effectivePeriodId),
          price_set_id: selectedSet.id,
          pallet_trip_price: palletValue,
          tiers,
        });
      }
      window.alert(t('routePricing.message.success.savePrice'));
      onClose();
    } catch (err) {
      const code = apiErrorCode(err);
      if (code === 'PRICE_NOT_POSITIVE') setFormError(t('routePricing.price.pricePositive'));
      else if (code === 'PRICE_SET_LOCKED') setFormError(t('routePricing.price.setLocked'));
      else window.alert(t('routePricing.message.error.generic'));
    }
  }

  return (
    <Modal
      isOpen
      onClose={requestClose}
      title={isEdit ? t('routePricing.price.editTitle') : t('routePricing.price.createTitle')}
      size="lg"
    >
      <div className="space-y-3">
        {!isEdit && (
          <Select
            id="price-period"
            label={t('routePricing.price.period')}
            value={effectivePeriodId}
            error={errors.period}
            onChange={(e) => {
              setPeriodId(e.target.value);
              dirtyRef.current = true;
            }}
            options={[
              {
                value: '',
                label: periodsLoading
                  ? t('routePricing.priceSet.loading')
                  : periods.length
                    ? t('routePricing.price.periodPlaceholder')
                    : t('routePricing.price.periodEmpty'),
              },
              ...[...periods]
                .sort((a, b) => a.start_date.localeCompare(b.start_date))
                .map((p) => ({
                  value: String(p.id),
                  label: periodLabel(p.start_date, p.percent, p.note),
                })),
            ]}
          />
        )}
        <div>
          <label htmlFor="price-set" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
            {t('routePricing.price.pickSet')}
          </label>
          <select
            ref={setSelectRef}
            id="price-set"
            name="price_set_id"
            autoComplete="off"
            disabled={isEdit}
            className="w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-600 disabled:cursor-not-allowed"
            value={priceSetId}
            onChange={(e) => changeSet(e.target.value)}
          >
            <option value="">{t('routePricing.price.pickSetPlaceholder')}</option>
            {sets.map((set) => (
              <option key={set.id} value={set.id}>
                {set.name}
              </option>
            ))}
          </select>
          {errors.set && <p className="mt-1 text-sm text-red-600">{errors.set}</p>}
          {isEdit && <p className="mt-1 text-xs text-neutral-500">{t('routePricing.price.setLocked')}</p>}
        </div>

        {selectedSet?.has_pallet && (
          <Input
            id="price-pallet"
            label={t('routePricing.price.pallet')}
            type="number"
            min={0}
            inputMode="decimal"
            autoComplete="off"
            value={pallet}
            error={errors.pallet}
            onChange={(e) => {
              setPallet(e.target.value);
              dirtyRef.current = true;
            }}
          />
        )}

        {selectedSet &&
          selectedSet.tiers.map((tier) => (
            <div
              key={tier.id}
              className="flex flex-wrap gap-2 items-end rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-3"
            >
              <div className="min-w-0 flex-1 basis-40">
                <Input
                  label={t('routePricing.priceSet.tier')}
                  value={formatTierRangeLabel(selectedSet.pricing_mode, {
                    ...tier,
                    price: 0,
                    range_from: tier.range_from ?? 0,
                  })}
                  disabled
                  readOnly
                />
              </div>
              <div className="w-32 shrink-0">
                <Input
                  label={t('routePricing.priceSet.unit')}
                  value={
                    tier.pricing_unit === 'chuyen'
                      ? t('routePricing.price.unitTrip')
                      : t('routePricing.price.unitTon')
                  }
                  disabled
                  readOnly
                />
              </div>
              <div className="w-36 min-w-[8rem] flex-1">
                <Input
                  id={`price-tier-${tier.id}`}
                  label={t('routePricing.price.amount')}
                  type="number"
                  min={0}
                  inputMode="decimal"
                  autoComplete="off"
                  value={prices[tier.id] ?? ''}
                  error={errors[`tier:${tier.id}`]}
                  onChange={(e) => {
                    setPrices((prev) => ({ ...prev, [tier.id]: e.target.value }));
                    dirtyRef.current = true;
                  }}
                />
              </div>
            </div>
          ))}

        {selectedSet && <p className="text-xs text-neutral-500">{t('routePricing.price.blankHint')}</p>}
        {formError && <p className="text-sm text-red-600">{formError}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={requestClose} disabled={pending}>
            {t('routePricing.action.cancel')}
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={pending}>
            {pending ? t('routePricing.priceSet.saving') : t('routePricing.action.save')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
