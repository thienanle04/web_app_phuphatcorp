import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, Ban, Pencil, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { DataGrid, DataGridTip } from '../../components/ui/DataGrid';
import type { DataGridColumn } from '../../components/ui/DataGrid';
import { Pagination } from '../../components/ui/Pagination';
import { Select } from '../../components/ui/Select';
import { useAuth } from '../../hooks/useAuth';
import { useCustomerSurcharges } from '../../hooks/useCustomerSurcharges';
import { useI18n } from '../../i18n/useI18n';
import type { CustomerSurchargeRule } from '../../api/customerSurchargeApi';
import { SurchargeFormModal } from './SurchargeFormModal';
import { SurchargeLookupModal } from './SurchargeLookupModal';
import { SurchargeDeleteDialog } from './SurchargeDeleteDialog';
import { SurchargeStopDialog } from './SurchargeStopDialog';
import { FEE_TYPES, VEHICLE_CLASSES, ZONES, formatDate, formatMoney, supplierToken } from './surchargeLabels';

const PAGE_SIZE = 50;
const NAME_FILTER_DELAY_MS = 400;

type ModalState =
  | { kind: 'create' }
  | { kind: 'replace'; rule: CustomerSurchargeRule }
  | { kind: 'stop'; rule: CustomerSurchargeRule }
  | { kind: 'delete'; rule: CustomerSurchargeRule }
  | { kind: 'lookup' }
  | null;

export function CustomerSurchargesPage() {
  const { t } = useI18n();
  const { hasPermission, user } = useAuth();
  const canManage = hasPermission('route_pricing.manage') || user?.role === 'ADMIN';
  const [params, setParams] = useSearchParams();
  const [modal, setModal] = useState<ModalState>(null);
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null);

  const status = params.get('status') || 'open';
  const page = Math.max(1, Number(params.get('page') || '1'));
  const urlName = params.get('tenKhachHang') ?? '';
  const [nameInput, setNameInput] = useState(urlName);

  useEffect(() => {
    setNameInput(urlName);
  }, [urlName]);

  useEffect(() => {
    if (nameInput === urlName) return;
    const timer = window.setTimeout(() => {
      setParams((current) => {
        const next = new URLSearchParams(current);
        if (!nameInput) next.delete('tenKhachHang');
        else next.set('tenKhachHang', nameInput);
        next.delete('page');
        return next;
      });
    }, NAME_FILTER_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [nameInput, urlName, setParams]);
  const query = useMemo(() => ({
    ten_khach_hang: params.get('tenKhachHang') || undefined,
    fee_type: params.get('feeType') || undefined,
    zone: params.get('zone') || undefined,
    vehicle_class: params.get('vehicleClass') || undefined,
    status,
    page,
    page_size: PAGE_SIZE,
  }), [params, status, page]);
  const list = useCustomerSurcharges(query);
  const filtered = Boolean(query.ten_khach_hang || query.fee_type || query.zone || query.vehicle_class || status !== 'open');

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (!value) next.delete(key);
    else next.set(key, value);
    if (key !== 'page') next.delete('page');
    setParams(next);
  }

  function showToast(message: string, variant: 'success' | 'error') {
    setToast({ message, variant });
    window.setTimeout(() => setToast(null), 4000);
  }

  const total = list.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rows = list.data?.items ?? [];

  const columns = useMemo(() => {
    const defs: DataGridColumn<CustomerSurchargeRule>[] = [
      {
        id: 'customer',
        header: t('customerSurcharges.field.customer'),
        pin: true,
        width: 320,
        cell: (row) => {
          const token = supplierToken(row.supplier_name, row.supplier_code);
          const pointLabel = row.diem_tra_hang
            ? (token ? `${token} - ${row.diem_tra_hang}` : row.diem_tra_hang)
            : null;

          return (
            <div className="flex min-w-0 flex-col justify-center py-0.5 leading-tight">
              <span className="flex min-w-0 items-center gap-1.5">
                <DataGridTip
                  text={row.ten_khach_hang}
                  onlyIfTruncated
                  className="min-w-0 flex-1 truncate text-left [direction:rtl]"
                >
                  <span className="[direction:ltr] [unicode-bidi:plaintext] font-medium text-neutral-900 dark:text-neutral-100">
                    {row.ten_khach_hang}
                  </span>
                </DataGridTip>
                {row.customer_status === 'deactive' && (
                  <Badge className="shrink-0 px-1.5 py-0">{t('customerSurcharges.customerInactive')}</Badge>
                )}
              </span>
              {pointLabel && (
                <DataGridTip text={pointLabel} onlyIfTruncated className="mt-0.5 min-w-0 truncate">
                  <span className="flex min-w-0 items-center gap-1 text-[12px] text-neutral-500 dark:text-neutral-400">
                    <span className="truncate">{pointLabel}</span>
                  </span>
                </DataGridTip>
              )}
            </div>
          );
        },
      },
      {
        id: 'scope',
        header: t('customerSurcharges.field.scope'),
        width: 104,
        accessor: (row) => row.customer_id
          ? t('customerSurcharges.scope.pointShort')
          : t('customerSurcharges.scope.dealerShort'),
      },
      {
        id: 'feeType',
        header: t('customerSurcharges.field.feeType'),
        width: 144,
        accessor: (row) => t(`customerSurcharges.fee.${row.fee_type}`),
      },
      {
        id: 'zone',
        header: t('customerSurcharges.field.zone'),
        width: 96,
        accessor: (row) => row.zone ? t(`customerSurcharges.zone.${row.zone}`) : t('customerSurcharges.zone.any'),
      },
      {
        id: 'vehicleClass',
        header: t('customerSurcharges.field.vehicleClass'),
        width: 124,
        accessor: (row) => row.vehicle_class
          ? t(`customerSurcharges.vehicle.${row.vehicle_class}`)
          : t('customerSurcharges.vehicle.any'),
      },
      {
        id: 'amount',
        header: t('customerSurcharges.column.amount'),
        align: 'left',
        width: 160,
        className: 'text-left',
        headerClassName: 'text-left',
        cell: (row) => (
          <span className="flex w-full items-baseline justify-start gap-1 text-left">
            <span className="tabular-nums">{formatMoney(row.amount)}</span>
            <span className="text-neutral-500">{t(`customerSurcharges.unit.${row.pricing_unit}`)}</span>
          </span>
        ),
      },
      {
        id: 'startDate',
        header: t('customerSurcharges.column.from'),
        numeric: true,
        width: 128,
        accessor: (row) => formatDate(row.start_date),
      },
    ];

    if (status !== 'open') {
      defs.push({
        id: 'endDate',
        header: t('customerSurcharges.column.to'),
        numeric: true,
        width: 108,
        cell: (row) => row.end_date ? formatDate(row.end_date) : '—',
      });
    }

    if (canManage) {
      defs.push({
        id: 'actions',
        header: '',
        width: 140,
        align: 'right',
        headerClassName: 'text-right',
        className: 'text-right',
        truncate: false,
        cell: (row) => (
          <div className="flex h-full items-center justify-end gap-0.5">
            {row.end_date == null && (
              <>
                <DataGridTip text={t('customerSurcharges.action.replace')} className="inline-flex shrink-0">
                  <button
                    type="button"
                    onClick={() => setModal({ kind: 'replace', rule: row })}
                    className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 dark:text-neutral-500 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
                    aria-label={t('customerSurcharges.action.replace')}
                  >
                    <Pencil className="size-[16px]" aria-hidden="true" />
                  </button>
                </DataGridTip>
                <DataGridTip text={t('customerSurcharges.action.stop')} className="inline-flex shrink-0">
                  <button
                    type="button"
                    onClick={() => setModal({ kind: 'stop', rule: row })}
                    className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 dark:text-neutral-500 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
                    aria-label={t('customerSurcharges.action.stop')}
                  >
                    <Ban className="size-[16px]" aria-hidden="true" />
                  </button>
                </DataGridTip>
              </>
            )}
            <DataGridTip text={t('customerSurcharges.action.delete')} className="inline-flex shrink-0">
              <button
                type="button"
                onClick={() => setModal({ kind: 'delete', rule: row })}
                className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-neutral-500 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                aria-label={t('customerSurcharges.action.delete')}
              >
                <Trash2 className="size-[16px]" aria-hidden="true" />
              </button>
            </DataGridTip>
          </div>
        ),
      });
    }

    return defs;
  }, [canManage, status, t]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 text-balance">{t('customerSurcharges.page.title')}</h1>
          <p className="text-sm text-neutral-500">{t('customerSurcharges.page.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => setModal({ kind: 'lookup' })}>
            <Search className="w-4 h-4 mr-2" aria-hidden="true" />
            {t('customerSurcharges.action.lookup')}
          </Button>
          {canManage && (
            <Button type="button" onClick={() => setModal({ kind: 'create' })}>
              <Plus className="w-4 h-4 mr-2" aria-hidden="true" />
              {t('customerSurcharges.action.add')}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
        <label className="text-sm">
          <span className="sr-only">{t('customerSurcharges.field.customer')}</span>
          <input
            name="tenKhachHang"
            autoComplete="off"
            value={nameInput}
            placeholder={t('customerSurcharges.field.customer')}
            onChange={(event) => setNameInput(event.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm focus-visible:ring-2"
          />
        </label>
        <Select id="filter-fee" value={params.get('feeType') ?? ''} options={[{ value: '', label: t('customerSurcharges.field.feeType') }, ...FEE_TYPES.map((item) => ({ value: item, label: t(`customerSurcharges.fee.${item}`) }))]} onChange={(event) => setFilter('feeType', event.target.value)} />
        <Select id="filter-zone" value={params.get('zone') ?? ''} options={[{ value: '', label: t('customerSurcharges.zone.all') }, ...ZONES.map((item) => ({ value: item, label: t(`customerSurcharges.zone.${item}`) }))]} onChange={(event) => setFilter('zone', event.target.value)} />
        <Select id="filter-vehicle" value={params.get('vehicleClass') ?? ''} options={[{ value: '', label: t('customerSurcharges.vehicle.all') }, ...VEHICLE_CLASSES.map((item) => ({ value: item, label: t(`customerSurcharges.vehicle.${item}`) }))]} onChange={(event) => setFilter('vehicleClass', event.target.value)} />
        <Select id="filter-status" value={status} options={['open', 'closed', 'all'].map((item) => ({ value: item, label: t(`customerSurcharges.status.${item}`) }))} onChange={(event) => setFilter('status', event.target.value === 'open' ? '' : event.target.value)} />
      </div>
      {filtered && (
        <Button type="button" variant="ghost" size="sm" onClick={() => setParams(new URLSearchParams())}>{t('customerSurcharges.action.clearFilters')}</Button>
      )}

      {list.isLoading ? (
        <div className="space-y-3 rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900" aria-busy="true">
          <p className="sr-only">{t('customerSurcharges.loading')}</p>
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-10 bg-neutral-100 dark:bg-neutral-800 rounded animate-pulse" />
          ))}
        </div>
      ) : list.isError ? (
        <div className="flex flex-col items-center py-16 gap-3 rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          <AlertTriangle className="w-8 h-8 text-red-400" aria-hidden="true" />
          <p>{t('customerSurcharges.error')}</p>
          <Button type="button" variant="outline" onClick={() => void list.refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />
            {t('customerSurcharges.action.retry')}
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <div className="py-16 text-center space-y-3 rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          <p>{filtered ? t('customerSurcharges.emptyFiltered') : t('customerSurcharges.empty')}</p>
          {filtered ? (
            <Button type="button" variant="outline" onClick={() => setParams(new URLSearchParams())}>{t('customerSurcharges.action.clearFilters')}</Button>
          ) : canManage ? (
            <Button type="button" onClick={() => setModal({ kind: 'create' })}>{t('customerSurcharges.action.add')}</Button>
          ) : null}
        </div>
      ) : (
        <DataGrid
          columns={columns}
          rows={rows}
          getRowId={(row) => row.id}
          footer={
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={total}
              pageSize={PAGE_SIZE}
              onPageChange={(next) => setFilter('page', String(next))}
            />
          }
        />
      )}

      {toast && (
        <div role="status" aria-live="polite" className={`fixed bottom-4 right-4 px-4 py-2 rounded-lg text-sm text-white ${toast.variant === 'error' ? 'bg-red-600' : 'bg-neutral-900'}`}>
          {toast.message}
        </div>
      )}

      {modal?.kind === 'create' && (
        <SurchargeFormModal mode="create" onClose={() => setModal(null)} onSaved={(message) => showToast(message, 'success')} onFailed={(message) => showToast(message, 'error')} />
      )}
      {modal?.kind === 'replace' && (
        <SurchargeFormModal mode="replace" rule={modal.rule} onClose={() => setModal(null)} onSaved={(message) => showToast(message, 'success')} onFailed={(message) => showToast(message, 'error')} />
      )}
      {modal?.kind === 'stop' && (
        <SurchargeStopDialog rule={modal.rule} onClose={() => setModal(null)} onSaved={(message) => showToast(message, 'success')} onFailed={(message) => showToast(message, 'error')} />
      )}
      {modal?.kind === 'delete' && (
        <SurchargeDeleteDialog rule={modal.rule} onClose={() => setModal(null)} onSaved={(message) => showToast(message, 'success')} onFailed={(message) => showToast(message, 'error')} />
      )}
      {modal?.kind === 'lookup' && (
        <SurchargeLookupModal onClose={() => setModal(null)} onFailed={(message) => showToast(message, 'error')} />
      )}
    </div>
  );
}
