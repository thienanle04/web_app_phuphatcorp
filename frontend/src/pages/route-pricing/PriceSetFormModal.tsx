import { useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { useI18n } from '../../i18n/useI18n';
import { useRoutePricingMutations } from '../../hooks/useRoutePricing';
import type { PriceSet, PriceSetTierInput, PricingMode } from '../../api/routePricingApi';
import {
  addTripsTier,
  apiErrorCode,
  defaultDraftTiers,
  draftFromSetTier,
  draftToInput,
  newDraftTier,
  rechainTrips,
  updateTripsTo,
  type DraftTier,
} from './priceSetForm';

type Mode = 'create' | 'structure' | 'rename' | 'addTier';

function toast(msg: string) {
  window.alert(msg);
}

export function PriceSetFormModal({
  mode,
  priceSet,
  onClose,
}: {
  mode: Mode;
  priceSet?: PriceSet;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const mutations = useRoutePricingMutations();
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(priceSet?.name ?? '');
  const [pricingMode, setPricingMode] = useState<PricingMode>(priceSet?.pricing_mode ?? 'by_weight');
  const [hasPallet, setHasPallet] = useState(Boolean(priceSet?.has_pallet));
  const [tiers, setTiers] = useState<DraftTier[]>(() =>
    mode === 'addTier'
      ? [newDraftTier(priceSet?.pricing_mode ?? 'by_weight')]
      : priceSet
        ? priceSet.tiers.map(draftFromSetTier)
        : defaultDraftTiers('by_weight'),
  );
  const [nameError, setNameError] = useState('');
  const [tierErrors, setTierErrors] = useState<Record<string, string>>({});

  const pending =
    mutations.createPriceSet.isPending ||
    mutations.replacePriceSet.isPending ||
    mutations.renamePriceSet.isPending ||
    mutations.addPriceSetTier.isPending;

  const title =
    mode === 'rename'
      ? t('routePricing.priceSet.rename')
      : mode === 'addTier'
        ? t('routePricing.priceSet.addTier')
        : mode === 'structure'
          ? t('routePricing.priceSet.editStructure')
          : t('routePricing.priceSet.create');

  function switchMode(next: PricingMode) {
    if (next === pricingMode) return;
    setPricingMode(next);
    setTiers(defaultDraftTiers(next));
    setTierErrors({});
  }

  function validateTiers(list: DraftTier[], modeValue: PricingMode): Record<string, string> {
    const errors: Record<string, string> = {};
    list.forEach((tier, index) => {
      if (modeValue === 'by_truck') {
        if (!tier.label.trim()) errors[tier.key] = t('routePricing.priceSet.tierLabelRequired');
        return;
      }
      if (tier.range_from.trim() === '' || Number.isNaN(Number(tier.range_from))) {
        errors[tier.key] = t('routePricing.priceSet.tierRangeRequired');
        return;
      }
      if (tier.range_to.trim() !== '' && Number(tier.range_from) > Number(tier.range_to)) {
        errors[tier.key] = t('routePricing.priceSet.tierRangeRequired');
      }
      if (index === 0) return;
    });
    return errors;
  }

  function focusFirst(errors: Record<string, string>, nameFailed: boolean) {
    if (nameFailed) {
      nameRef.current?.focus();
      return;
    }
    const first = tiers.find((tier) => errors[tier.key]);
    if (!first) return;
    document.getElementById(`set-tier-${first.key}`)?.focus();
  }

  async function submit() {
    if (mode === 'rename') {
      if (!name.trim()) {
        setNameError(t('routePricing.priceSet.nameRequired'));
        nameRef.current?.focus();
        return;
      }
      try {
        await mutations.renamePriceSet.mutateAsync({ id: priceSet!.id, name: name.trim() });
        toast(t('routePricing.message.success.renameSet'));
        onClose();
      } catch (err) {
        if (apiErrorCode(err) === 'PRICE_SET_NAME_DUPLICATE') {
          setNameError(t('routePricing.priceSet.duplicate'));
          nameRef.current?.focus();
        } else toast(t('routePricing.message.error.generic'));
      }
      return;
    }

    if (mode === 'addTier') {
      const errors = validateTiers(tiers, priceSet!.pricing_mode);
      setTierErrors(errors);
      if (Object.keys(errors).length > 0) {
        focusFirst(errors, false);
        return;
      }
      try {
        await mutations.addPriceSetTier.mutateAsync({
          id: priceSet!.id,
          ...draftToInput(priceSet!.pricing_mode, tiers[0]),
        });
        toast(t('routePricing.message.success.addTier'));
        onClose();
      } catch (err) {
        toast(
          apiErrorCode(err) === 'PRICE_SET_SUBSET'
            ? t('routePricing.priceSet.subset')
            : t('routePricing.message.error.generic'),
        );
      }
      return;
    }

    const nameFailed = !name.trim();
    const errors = validateTiers(tiers, pricingMode);
    setNameError(nameFailed ? t('routePricing.priceSet.nameRequired') : '');
    setTierErrors(errors);
    if (nameFailed || Object.keys(errors).length > 0 || tiers.length === 0) {
      focusFirst(errors, nameFailed);
      return;
    }
    const payloadTiers: PriceSetTierInput[] = tiers.map((tier) => draftToInput(pricingMode, tier));
    try {
      if (mode === 'structure') {
        await mutations.replacePriceSet.mutateAsync({
          id: priceSet!.id,
          has_pallet: hasPallet,
          tiers: payloadTiers,
        });
        if (name.trim() !== priceSet!.name) {
          await mutations.renamePriceSet.mutateAsync({ id: priceSet!.id, name: name.trim() });
        }
        toast(t('routePricing.message.success.renameSet'));
      } else {
        await mutations.createPriceSet.mutateAsync({
          name: name.trim(),
          pricing_mode: pricingMode,
          has_pallet: hasPallet,
          tiers: payloadTiers,
        });
        toast(t('routePricing.message.success.createSet'));
      }
      onClose();
    } catch (err) {
      const code = apiErrorCode(err);
      if (code === 'PRICE_SET_NAME_DUPLICATE') {
        setNameError(t('routePricing.priceSet.duplicate'));
        nameRef.current?.focus();
      } else if (code === 'PRICE_SET_SUBSET' || code === 'PRICE_SET_IN_USE') {
        toast(code === 'PRICE_SET_IN_USE' ? t('routePricing.priceSet.deleteInUse') : t('routePricing.priceSet.subset'));
      } else toast(t('routePricing.message.error.generic'));
    }
  }

  const showTiers = mode === 'create' || mode === 'structure' || mode === 'addTier';
  const activeMode = mode === 'addTier' ? priceSet!.pricing_mode : pricingMode;

  return (
    <Modal isOpen onClose={onClose} title={title} size={mode === 'rename' ? 'sm' : 'xl'}>
      <div className="space-y-4">
        {mode !== 'addTier' && (
          <Input
            ref={nameRef}
            id="price-set-name"
            name="name"
            autoComplete="off"
            spellCheck={false}
            label={t('routePricing.priceSet.name')}
            placeholder={t('routePricing.priceSet.namePlaceholder')}
            value={name}
            error={nameError}
            onChange={(e) => {
              setName(e.target.value);
            }}
          />
        )}

        {mode === 'create' && (
          <fieldset>
            <legend className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
              {t('routePricing.priceSet.mode')}
            </legend>
            <div className="flex flex-wrap gap-4 text-sm">
              {(['by_weight', 'by_trips', 'by_truck'] as PricingMode[]).map((value) => (
                <label key={value} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="price-set-mode"
                    checked={pricingMode === value}
                    onChange={() => switchMode(value)}
                  />
                  {t(`routePricing.mode.${value}`)}
                </label>
              ))}
            </div>
            {pricingMode === 'by_truck' && (
              <p className="mt-1 text-xs text-neutral-500">{t('routePricing.priceSet.truckHint')}</p>
            )}
          </fieldset>
        )}

        {(mode === 'create' || mode === 'structure') && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={hasPallet}
              onChange={(e) => {
                setHasPallet(e.target.checked);
              }}
            />
            {t('routePricing.priceSet.hasPallet')}
          </label>
        )}

        {showTiers && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              {t('routePricing.priceSet.tiers')}
            </p>
            {mode === 'addTier' && (
              <p className="text-xs text-neutral-500 dark:text-neutral-400">{t('routePricing.priceSet.addTierHint')}</p>
            )}
            {tiers.map((tier, index) => {
              const chainTrips = activeMode === 'by_trips' && mode !== 'addTier';
              const isLastTrip = chainTrips && index === tiers.length - 1;
              const unitOptions = [
                { value: 'chuyen', label: t('routePricing.priceSet.unitTrip') },
                { value: 'tan', label: t('routePricing.priceSet.unitTon') },
              ];
              return (
                <div
                  key={tier.key}
                  className="flex flex-wrap sm:flex-nowrap gap-2 items-end rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-3"
                >
                  {activeMode === 'by_truck' ? (
                    <div className="min-w-0 flex-1 basis-48">
                      <Input
                        id={`set-tier-${tier.key}`}
                        label={t('routePricing.priceSet.truckLabel')}
                        value={tier.label}
                        spellCheck={false}
                        autoComplete="off"
                        placeholder={t('routePricing.priceSet.truckPlaceholder')}
                        error={tierErrors[tier.key]}
                        onChange={(e) => {
                          setTiers((prev) =>
                            prev.map((row) => (row.key === tier.key ? { ...row, label: e.target.value } : row)),
                          );
                        }}
                      />
                    </div>
                  ) : activeMode === 'by_trips' ? (
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                      <label
                        htmlFor={`set-tier-${tier.key}`}
                        className="shrink-0 text-sm text-neutral-700 dark:text-neutral-300"
                      >
                        {t('routePricing.priceSet.rangeFromGte')}
                      </label>
                      <div className="w-24 shrink-0">
                        <Input
                          id={`set-tier-${tier.key}`}
                          type="number"
                          value={tier.range_from}
                          disabled={chainTrips}
                          error={tierErrors[tier.key]}
                          onChange={(e) => {
                            setTiers((prev) =>
                              prev.map((row) =>
                                row.key === tier.key ? { ...row, range_from: e.target.value } : row,
                              ),
                            );
                          }}
                        />
                      </div>
                      <label
                        htmlFor={`set-tier-to-${tier.key}`}
                        className="shrink-0 text-sm text-neutral-700 dark:text-neutral-300"
                      >
                        {isLastTrip ? t('routePricing.priceSet.rangeToInf') : t('routePricing.priceSet.rangeToLte')}
                      </label>
                      <div className="w-24 shrink-0">
                        <Input
                          id={`set-tier-to-${tier.key}`}
                          type="number"
                          value={isLastTrip ? '' : tier.range_to}
                          disabled={isLastTrip}
                          placeholder={isLastTrip ? '∞' : undefined}
                          onChange={(e) => {
                            setTiers((prev) =>
                              chainTrips
                                ? updateTripsTo(prev, index, e.target.value)
                                : prev.map((row) =>
                                    row.key === tier.key ? { ...row, range_to: e.target.value } : row,
                                  ),
                            );
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="w-28 shrink-0">
                        <Select
                          id={`set-tier-${tier.key}`}
                          label={t('routePricing.priceSet.unit')}
                          value={tier.pricing_unit}
                          error={tierErrors[tier.key]}
                          onChange={(e) => {
                            const unit = e.target.value as 'chuyen' | 'tan';
                            setTiers((prev) =>
                              prev.map((row) =>
                                row.key === tier.key
                                  ? {
                                      ...row,
                                      pricing_unit: unit,
                                      min_billable_ton: unit === 'chuyen' ? '' : row.min_billable_ton,
                                    }
                                  : row,
                              ),
                            );
                          }}
                          options={unitOptions}
                        />
                      </div>
                      <div className="w-24 shrink-0">
                        <Input
                          label={t('routePricing.priceSet.rangeFromTon')}
                          type="number"
                          value={tier.range_from}
                          onChange={(e) => {
                            setTiers((prev) =>
                              prev.map((row) =>
                                row.key === tier.key ? { ...row, range_from: e.target.value } : row,
                              ),
                            );
                          }}
                        />
                      </div>
                      <div className="w-24 shrink-0">
                        <Input
                          label={t('routePricing.priceSet.rangeToTon')}
                          type="number"
                          value={tier.range_to}
                          placeholder="∞"
                          onChange={(e) => {
                            setTiers((prev) =>
                              prev.map((row) =>
                                row.key === tier.key ? { ...row, range_to: e.target.value } : row,
                              ),
                            );
                          }}
                        />
                      </div>
                      {tier.pricing_unit === 'tan' && (
                        <div className="w-24 shrink-0">
                          <Input
                            label={t('routePricing.priceSet.minTon')}
                            type="number"
                            value={tier.min_billable_ton}
                            onChange={(e) => {
                              setTiers((prev) =>
                                prev.map((row) =>
                                  row.key === tier.key ? { ...row, min_billable_ton: e.target.value } : row,
                                ),
                              );
                            }}
                          />
                        </div>
                      )}
                    </>
                  )}
                  {activeMode !== 'by_weight' && activeMode !== 'by_trips' && (
                    <div className="w-28 shrink-0">
                      <Select
                        label={t('routePricing.priceSet.unit')}
                        value={tier.pricing_unit}
                        onChange={(e) => {
                          setTiers((prev) =>
                            prev.map((row) =>
                              row.key === tier.key
                                ? { ...row, pricing_unit: e.target.value as 'chuyen' | 'tan' }
                                : row,
                            ),
                          );
                        }}
                        options={unitOptions}
                      />
                    </div>
                  )}
                  {mode !== 'addTier' && (
                    <button
                      type="button"
                      className="ml-auto shrink-0 self-end p-2 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
                      title={t('routePricing.priceSet.removeTier')}
                      aria-label={t('routePricing.priceSet.removeTier')}
                      disabled={tiers.length <= 1}
                      onClick={() => {
                        setTiers((prev) => {
                          const filtered = prev.filter((row) => row.key !== tier.key);
                          return chainTrips ? rechainTrips(filtered) : filtered;
                        });
                      }}
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
              );
            })}
            {mode !== 'addTier' && (
              <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setTiers((prev) => {
                    if (activeMode === 'by_trips') return addTripsTier(prev);
                    if (activeMode === 'by_weight') {
                      return [
                        ...prev,
                        { ...newDraftTier('by_weight'), range_from: '0', pricing_unit: 'tan' },
                      ];
                    }
                    return [...prev, newDraftTier(activeMode)];
                  });
                }}
              >
                + {t('routePricing.priceSet.addTier')}
              </Button>
              </div>
            )}
            {(mode === 'create' || mode === 'structure') && (
              <p className="text-xs text-neutral-500 dark:text-neutral-400">{t('routePricing.priceSet.hint')}</p>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            {t('routePricing.action.cancel')}
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={pending}>
            {pending
              ? t('routePricing.priceSet.saving')
              : mode === 'rename'
                ? t('routePricing.priceSet.saveName')
                : t('routePricing.priceSet.save')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
