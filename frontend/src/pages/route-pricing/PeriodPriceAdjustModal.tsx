import { useMemo, useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useI18n } from '../../i18n/useI18n';
import { formatDate } from '../../utils/format';
import { usePriceSets } from '../../hooks/useRoutePricing';
import type { PriceSetTier, PricingMode, RoutePriceVersion } from '../../api/routePricingApi';
import { formatTierRangeLabel } from './priceDisplay';

export type AdjustChange = {
  key: string;
  label: string;
  from: number;
  to: number;
  added?: boolean;
};

type Props = {
  version: RoutePriceVersion;
  priceSetId?: number | null;
  laterVersions: RoutePriceVersion[];
  onClose: () => void;
  onConfirm: (body: {
    pallet_trip_price: number | null;
    tiers: { id: number; price: number }[];
    added_tiers: { price_set_tier_id: number; price: number }[];
  }) => void;
  isSubmitting: boolean;
};

function parsePrice(raw: string): number | null {
  const n = Number(String(raw).replace(/,/g, '').trim());
  if (String(raw).trim() === '' || Number.isNaN(n)) return null;
  return n;
}

function setTierLabel(mode: PricingMode, tier: PriceSetTier): string {
  return formatTierRangeLabel(mode, {
    price_set_tier_id: tier.id,
    range_from: tier.range_from ?? 0,
    range_to: tier.range_to,
    pricing_unit: tier.pricing_unit,
    price: 0,
    min_billable_ton: tier.min_billable_ton,
    label: tier.label,
  });
}

export function PeriodPriceAdjustModal({
  version,
  priceSetId,
  laterVersions,
  onClose,
  onConfirm,
  isSubmitting,
}: Props) {
  const { t } = useI18n();
  const { data: sets = [] } = usePriceSets();
  const mode: PricingMode = version.pricing_mode ?? 'by_weight';
  const hasPallet = version.pallet_trip_price != null;
  const priceSet = sets.find((set) => set.id === priceSetId);
  const canAddPallet = !hasPallet && Boolean(priceSet?.has_pallet);
  const showPallet = hasPallet || canAddPallet;
  const [pallet, setPallet] = useState(hasPallet ? String(version.pallet_trip_price) : '');
  const [tierPrices, setTierPrices] = useState<Record<number, string>>(() =>
    Object.fromEntries(
      version.tiers
        .filter((tier) => tier.id != null)
        .map((tier) => [tier.id!, String(tier.price)]),
    ),
  );
  const [addedPrices, setAddedPrices] = useState<Record<number, string>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const unusedTiers = useMemo(() => {
    const applied = new Set(
      version.tiers
        .map((tier) => tier.price_set_tier_id)
        .filter((id): id is number => id != null),
    );
    return (priceSet?.tiers ?? []).filter((tier) => !applied.has(tier.id));
  }, [priceSet, version.tiers]);

  const changes = useMemo((): AdjustChange[] => {
    const list: AdjustChange[] = [];
    if (hasPallet) {
      const palletNum = parsePrice(pallet);
      if (palletNum != null && palletNum !== Number(version.pallet_trip_price)) {
        list.push({
          key: 'pallet',
          label: t('routePricing.price.pallet'),
          from: Number(version.pallet_trip_price),
          to: palletNum,
        });
      }
    } else if (canAddPallet) {
      const palletNum = parsePrice(pallet);
      if (palletNum != null && palletNum > 0) {
        list.push({
          key: 'pallet',
          label: t('routePricing.price.pallet'),
          from: 0,
          to: palletNum,
          added: true,
        });
      }
    }
    for (const tier of unusedTiers) {
      const next = parsePrice(addedPrices[tier.id] ?? '');
      if (next != null && next > 0) {
        list.push({
          key: `add:${tier.id}`,
          label: setTierLabel(mode, tier),
          from: 0,
          to: next,
          added: true,
        });
      }
    }
    for (const tier of version.tiers) {
      if (tier.id == null) continue;
      const next = parsePrice(tierPrices[tier.id] ?? '');
      if (next != null && next !== Number(tier.price)) {
        list.push({
          key: `tier:${tier.id}`,
          label: formatTierRangeLabel(mode, tier),
          from: Number(tier.price),
          to: next,
        });
      }
    }
    return list;
  }, [pallet, tierPrices, addedPrices, unusedTiers, version, mode, hasPallet, canAddPallet, t]);

  const laterSorted = useMemo(
    () =>
      [...laterVersions].sort(
        (a, b) => String(a.effective_from).localeCompare(String(b.effective_from)),
      ),
    [laterVersions],
  );

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (hasPallet) {
      const palletNum = parsePrice(pallet);
      if (palletNum == null) errors.pallet = t('routePricing.validation.priceInvalid');
      else if (palletNum <= 0) errors.pallet = t('routePricing.price.pricePositive');
    } else if (canAddPallet && pallet.trim()) {
      const palletNum = parsePrice(pallet);
      if (palletNum == null) errors.pallet = t('routePricing.validation.priceInvalid');
      else if (palletNum <= 0) errors.pallet = t('routePricing.price.pricePositive');
    }
    for (const tier of version.tiers) {
      if (tier.id == null) continue;
      const key = `tier:${tier.id}`;
      const n = parsePrice(tierPrices[tier.id] ?? '');
      if (n == null) errors[key] = t('routePricing.validation.priceRequired');
      else if (n <= 0) errors[key] = t('routePricing.price.pricePositive');
    }
    for (const tier of unusedTiers) {
      const raw = addedPrices[tier.id] ?? '';
      if (!raw.trim()) continue;
      const n = parsePrice(raw);
      if (n == null) errors[`add:${tier.id}`] = t('routePricing.validation.priceInvalid');
      else if (n <= 0) errors[`add:${tier.id}`] = t('routePricing.price.pricePositive');
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      const first = Object.keys(errors)[0];
      const id = first === 'pallet' ? 'adjust-pallet' : first.startsWith('add:')
        ? `adjust-add-${first.slice(4)}`
        : `adjust-tier-${first.replace('tier:', '')}`;
      document.getElementById(id)?.focus();
    }
    return Object.keys(errors).length === 0;
  }

  function buildBody() {
    return {
      pallet_trip_price: (() => {
        const n = parsePrice(pallet);
        if (hasPallet) return n;
        return n != null && n > 0 ? n : null;
      })(),
      tiers: version.tiers
        .filter((tier) => tier.id != null)
        .map((tier) => ({
          id: tier.id!,
          price: parsePrice(tierPrices[tier.id!] ?? '') ?? Number(tier.price),
        })),
      added_tiers: unusedTiers
        .map((tier) => {
          const price = parsePrice(addedPrices[tier.id] ?? '');
          return price != null && price > 0 ? { price_set_tier_id: tier.id, price } : null;
        })
        .filter((row): row is { price_set_tier_id: number; price: number } => row != null),
    };
  }

  function losesMark(v: RoutePriceVersion): boolean {
    return changes.some((c) => {
      if (c.key === 'pallet') return Boolean(v.pallet_manual_adjusted);
      if (c.added) {
        const setTierId = Number(c.key.replace('add:', ''));
        const matched = v.tiers.find((x) => x.price_set_tier_id === setTierId);
        return Boolean(matched?.is_manual_adjusted);
      }
      const id = Number(c.key.replace('tier:', ''));
      const tier = v.tiers.find((x) => x.id === id);
      if (!tier) {
        // match by label fingerprint approx — later version same structure: compare by index/label
        const src = version.tiers.find((x) => x.id === id);
        if (!src) return false;
        const matched = v.tiers.find(
          (x) => formatTierRangeLabel(mode, x) === formatTierRangeLabel(mode, src),
        );
        return Boolean(matched?.is_manual_adjusted);
      }
      return Boolean(tier.is_manual_adjusted);
    });
  }

  return (
    <>
      <Modal
        isOpen
        onClose={onClose}
        title={t('routePricing.manage.adjustPricePeriod', {
          date: formatDate(version.effective_from),
        })}
        size="lg"
      >
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-1">{t('routePricing.manage.adjustHint')}</p>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">{t('routePricing.price.periodNoRemoveTier')}</p>
        <div className="space-y-3">
          {showPallet && (
            <Input
              id="adjust-pallet"
              name="pallet_trip_price"
              label={t('routePricing.price.pallet')}
              type="number"
              min={0}
              inputMode="decimal"
              autoComplete="off"
              value={pallet}
              onChange={(e) => setPallet(e.target.value)}
              error={fieldErrors.pallet}
            />
          )}
          {version.tiers.map((tier) => {
            if (tier.id == null) return null;
            const errKey = `tier:${tier.id}`;
            return (
              <div
                key={tier.id}
                className="flex flex-wrap gap-2 items-end rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-3"
              >
                <div className="min-w-0 flex-1 basis-40">
                  <Input
                    label={t('routePricing.priceSet.tier')}
                    value={formatTierRangeLabel(mode, tier)}
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
                    id={`adjust-tier-${tier.id}`}
                    label={t('routePricing.price.amount')}
                    type="number"
                    min={0}
                    inputMode="decimal"
                    autoComplete="off"
                    value={tierPrices[tier.id] ?? ''}
                    onChange={(e) =>
                      setTierPrices((prev) => ({ ...prev, [tier.id!]: e.target.value }))
                    }
                    error={fieldErrors[errKey]}
                  />
                </div>
              </div>
            );
          })}
          {unusedTiers.map((tier) => {
            const errKey = `add:${tier.id}`;
            return (
              <div
                key={`add-${tier.id}`}
                className="flex flex-wrap gap-2 items-end rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-3"
              >
                <div className="min-w-0 flex-1 basis-40">
                  <Input
                    label={t('routePricing.priceSet.tier')}
                    value={setTierLabel(mode, tier)}
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
                    id={`adjust-add-${tier.id}`}
                    name={`added_tier_${tier.id}`}
                    label={t('routePricing.price.amount')}
                    type="number"
                    min={0}
                    inputMode="decimal"
                    autoComplete="off"
                    value={addedPrices[tier.id] ?? ''}
                    onChange={(e) =>
                      setAddedPrices((prev) => ({ ...prev, [tier.id]: e.target.value }))
                    }
                    error={fieldErrors[errKey]}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="outline" onClick={onClose}>
            {t('routePricing.action.cancel')}
          </Button>
          <Button
            disabled={changes.length === 0 || isSubmitting}
            onClick={() => {
              if (!validate()) return;
              setConfirmOpen(true);
            }}
          >
            {t('routePricing.manage.saveAdjust')}
          </Button>
        </div>
      </Modal>

      {confirmOpen && (
        <Modal
          isOpen
          onClose={() => !isSubmitting && setConfirmOpen(false)}
          title={t('routePricing.manage.confirmTitle')}
          size="md"
        >
          <div className="space-y-4 text-sm">
            <div>
              <p className="font-medium text-neutral-800 dark:text-neutral-100 mb-2">
                {t('routePricing.manage.confirmChanges')}
              </p>
              <ul className="list-disc pl-5 space-y-1 text-neutral-700 dark:text-neutral-300">
                {changes.map((c) => (
                  <li key={c.key}>
                    {c.added
                      ? `${c.label}: ${t('routePricing.manage.confirmAdd')} → ${c.to.toLocaleString('vi-VN')}`
                      : `${c.label}: ${c.from.toLocaleString('vi-VN')} → ${c.to.toLocaleString('vi-VN')}`}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-medium text-neutral-800 dark:text-neutral-100 mb-2">
                {t('routePricing.manage.confirmLaterPeriods')}
              </p>
              {laterSorted.length === 0 ? (
                <p className="text-neutral-500 dark:text-neutral-400">{t('routePricing.manage.confirmNoLater')}</p>
              ) : (
                <ul className="list-disc pl-5 space-y-1 text-neutral-700 dark:text-neutral-300">
                  {laterSorted.map((v) => (
                    <li key={v.id}>
                      {formatDate(v.effective_from)}
                      {losesMark(v) ? ` — ${t('routePricing.manage.confirmLoseMark')}` : ''}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <Button
              variant="outline"
              disabled={isSubmitting}
              onClick={() => setConfirmOpen(false)}
            >
              {t('routePricing.action.cancel')}
            </Button>
            <Button
              isLoading={isSubmitting}
              disabled={isSubmitting}
              onClick={() => onConfirm(buildBody())}
            >
              {t('routePricing.manage.confirmSubmit')}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
