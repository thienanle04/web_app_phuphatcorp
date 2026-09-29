import { useState } from 'react';
import { AlertTriangle, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/Table';
import { useI18n } from '../../i18n/useI18n';
import { usePriceSets, useRoutePricingMutations } from '../../hooks/useRoutePricing';
import type { PriceSet, PricingMode } from '../../api/routePricingApi';
import { PriceSetFormModal } from './PriceSetFormModal';
import { apiErrorCode } from './priceSetForm';

type ModalState =
  | { kind: 'create' }
  | { kind: 'structure'; set: PriceSet }
  | { kind: 'rename'; set: PriceSet }
  | { kind: 'addTier'; set: PriceSet }
  | null;

function modeLabel(t: (key: string) => string, mode: PricingMode): string {
  if (mode === 'by_trips') return t('routePricing.mode.by_trips');
  if (mode === 'by_truck') return t('routePricing.mode.by_truck');
  return t('routePricing.mode.by_weight');
}

export function PriceSetsTab({ canManage }: { canManage: boolean }) {
  const { t } = useI18n();
  const { data: sets = [], isLoading, isError, refetch } = usePriceSets();
  const mutations = useRoutePricingMutations();
  const [modal, setModal] = useState<ModalState>(null);

  async function confirmDelete(set: PriceSet) {
    if (!window.confirm(t('routePricing.priceSet.confirmDelete', { name: set.name }))) return;
    try {
      await mutations.deactivatePriceSet.mutateAsync(set.id);
      window.alert(t('routePricing.message.success.deleteSet'));
    } catch (err) {
      const code = apiErrorCode(err);
      window.alert(
        code === 'PRICE_SET_IN_USE'
          ? t('routePricing.priceSet.deleteInUse')
          : t('routePricing.message.error.generic'),
      );
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium text-neutral-900 dark:text-neutral-100">
            {t('routePricing.priceSet.title')}
          </h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">{t('routePricing.priceSet.subtitle')}</p>
        </div>
        {canManage && (
          <Button type="button" onClick={() => setModal({ kind: 'create' })}>
            <Plus className="w-4 h-4 mr-2" aria-hidden="true" />
            {t('routePricing.priceSet.create')}
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3" aria-busy="true">
              <p className="sr-only">{t('routePricing.priceSet.loading')}</p>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 bg-neutral-100 dark:bg-neutral-800 rounded animate-pulse" />
              ))}
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-neutral-500 dark:text-neutral-400">
              <AlertTriangle className="w-8 h-8 text-red-400" aria-hidden="true" />
              <p className="text-sm">{t('routePricing.priceSet.loadError')}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
                <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />
                {t('routePricing.priceSet.retry')}
              </Button>
            </div>
          ) : sets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-neutral-500 dark:text-neutral-400">
              <p className="text-sm">{t('routePricing.priceSet.empty')}</p>
              {canManage && (
                <Button type="button" size="sm" onClick={() => setModal({ kind: 'create' })}>
                  <Plus className="w-4 h-4 mr-2" aria-hidden="true" />
                  {t('routePricing.priceSet.create')}
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('routePricing.priceSet.colName')}</TableHead>
                  <TableHead>{t('routePricing.priceSet.colMode')}</TableHead>
                  <TableHead>{t('routePricing.priceSet.colPallet')}</TableHead>
                  <TableHead className="w-20">{t('routePricing.priceSet.colTiers')}</TableHead>
                  {canManage && <TableHead className="w-28">{t('routePricing.priceSet.colActions')}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sets.map((set) => {
                  const inUse = set.group_count > 0;
                  return (
                    <TableRow key={set.id}>
                      <TableCell className="font-medium text-neutral-900 dark:text-neutral-100 max-w-64 truncate" title={set.name}>
                        {set.name}
                      </TableCell>
                      <TableCell className="text-neutral-700 dark:text-neutral-300">
                        {modeLabel(t, set.pricing_mode)}
                      </TableCell>
                      <TableCell className="text-neutral-600 dark:text-neutral-400">
                        {set.has_pallet ? t('routePricing.priceSet.palletYes') : t('routePricing.priceSet.palletNo')}
                      </TableCell>
                      <TableCell className="text-neutral-700 dark:text-neutral-300 tabular-nums">
                        {set.tiers.length}
                      </TableCell>
                      {canManage && (
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              className="p-1.5 text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors"
                              aria-label={inUse ? t('routePricing.priceSet.rename') : t('routePricing.priceSet.editStructure')}
                              title={inUse ? t('routePricing.priceSet.rename') : t('routePricing.priceSet.editStructure')}
                              onClick={() => setModal(inUse ? { kind: 'rename', set } : { kind: 'structure', set })}
                            >
                              <Pencil className="w-4 h-4" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              className="p-1.5 text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors"
                              aria-label={t('routePricing.priceSet.addTier')}
                              title={t('routePricing.priceSet.addTier')}
                              onClick={() => setModal({ kind: 'addTier', set })}
                            >
                              <Plus className="w-4 h-4" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              className="p-1.5 text-neutral-400 dark:text-neutral-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                              aria-label={t('routePricing.priceSet.delete')}
                              title={inUse ? t('routePricing.priceSet.deleteInUse') : t('routePricing.priceSet.delete')}
                              disabled={inUse || mutations.deactivatePriceSet.isPending}
                              onClick={() => void confirmDelete(set)}
                            >
                              <Trash2 className="w-4 h-4" aria-hidden="true" />
                            </button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {modal && (
        <PriceSetFormModal
          mode={modal.kind}
          priceSet={modal.kind === 'create' ? undefined : modal.set}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
