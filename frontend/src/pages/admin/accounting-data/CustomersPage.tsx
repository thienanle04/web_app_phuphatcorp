import { useState, useMemo } from 'react';
import { Plus, Upload, AlertTriangle, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { useGetCustomers } from '../../../hooks/useCustomers';
import { CreateCustomerModal } from '../../../components/admin/CreateCustomerModal';
import { EditCustomerModal } from '../../../components/admin/EditCustomerModal';
import { DeleteCustomerDialog } from '../../../components/admin/DeleteCustomerDialog';
import { UploadCustomersModal } from '../../../components/admin/UploadCustomersModal';
import { CustomersTable } from '../../../components/admin/CustomersTable';
import { useAuth } from '../../../hooks/useAuth';
import { useI18n } from '../../../i18n/useI18n';
import type { Customer } from '../../../api/customersApi';

type ModalState =
  | { type: 'create' }
  | { type: 'edit'; row: Customer }
  | { type: 'delete'; row: Customer }
  | { type: 'upload' }
  | null;

interface Toast {
  id: number;
  message: string;
  variant: 'success' | 'error';
}

export function CustomersPage() {
  const { t } = useI18n();
  const { data, isLoading, isError, refetch } = useGetCustomers();
  const { hasPermission, user } = useAuth();

  const canManage = hasPermission('accounting_data.manage') || user?.role === 'ADMIN';

  const [modal, setModal] = useState<ModalState>(null);
  const [search, setSearch] = useState('');
  const [filterTuyen, setFilterTuyen] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  const showToast = (message: string, variant: 'success' | 'error' = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  };

  const tuyenOptions = useMemo(() => {
    if (!data) return [];
    const set = new Set<string>();
    data.forEach((row) => {
      if (row.tuyen_phuong) set.add(row.tuyen_phuong);
    });
    return Array.from(set).sort();
  }, [data]);

  const filteredRows = useMemo(() => {
    if (!data) return [];
    const q = search.toLowerCase();
    return data.filter((row) => {
      const matchSearch =
        !q ||
        row.diem_tra_hang.toLowerCase().includes(q) ||
        row.ten_khach_hang.toLowerCase().includes(q) ||
        (row.diem_giao_hang_tinh_phi ?? '').toLowerCase().includes(q);
      const matchTuyen = !filterTuyen || row.tuyen_phuong === filterTuyen;
      return matchSearch && matchTuyen;
    });
  }, [data, search, filterTuyen]);

  const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE);
  const pagedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, page]);

  const closeModal = () => setModal(null);

  return (
    <div className="p-6 space-y-6">
      {/* Toast notifications */}
      <div className="fixed top-4 right-4 z-[100] space-y-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-4 py-3 rounded-lg shadow-lg text-sm font-medium max-w-xs pointer-events-auto transition-all ${
              toast.variant === 'success'
                ? 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900'
                : 'bg-red-600 text-white'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
          {t('customers.title')}
        </h1>
        {canManage && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setModal({ type: 'upload' })}>
              <Upload className="w-4 h-4 mr-2" />
              {t('customers.importExcel')}
            </Button>
            <Button onClick={() => setModal({ type: 'create' })}>
              <Plus className="w-4 h-4 mr-2" />
              {t('customers.addCustomer')}
            </Button>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-3 flex-wrap">
            <Input
              placeholder={t('customers.search')}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="flex-1 min-w-48"
            />
            <select
              value={filterTuyen}
              onChange={(e) => { setFilterTuyen(e.target.value); setPage(1); }}
              className="px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100"
            >
              <option value="">{t('customers.allTuyen')}</option>
              {tuyenOptions.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3 rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 rounded bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-neutral-200 bg-white py-16 text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
          <AlertTriangle className="w-8 h-8 text-red-400" />
          <p className="text-sm">{t('customers.errorLoad')}</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            {t('customers.retry')}
          </Button>
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-neutral-200 bg-white py-16 text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
          <p className="text-sm">
            {search || filterTuyen ? t('customers.noResults') : t('customers.empty')}
          </p>
          {!search && !filterTuyen && canManage && (
            <Button size="sm" onClick={() => setModal({ type: 'create' })}>
              <Plus className="w-4 h-4 mr-2" />
              {t('customers.addCustomer')}
            </Button>
          )}
        </div>
      ) : (
        <CustomersTable
          rows={pagedRows}
          page={page}
          pageSize={PAGE_SIZE}
          totalItems={filteredRows.length}
          totalPages={totalPages}
          canManage={canManage}
          onPageChange={setPage}
          onEdit={(row) => setModal({ type: 'edit', row })}
          onDelete={(row) => setModal({ type: 'delete', row })}
        />
      )}

      {/* Create modal */}
      <CreateCustomerModal
        isOpen={modal?.type === 'create'}
        onClose={closeModal}
        onSuccess={(msg) => showToast(msg)}
        onError={(msg) => showToast(msg, 'error')}
      />

      {/* Edit modal */}
      <EditCustomerModal
        isOpen={modal?.type === 'edit'}
        onClose={closeModal}
        onSuccess={(msg) => showToast(msg)}
        onError={(msg) => showToast(msg, 'error')}
        customer={modal?.type === 'edit' ? modal.row : null}
      />

      {/* Delete dialog */}
      <DeleteCustomerDialog
        isOpen={modal?.type === 'delete'}
        onClose={closeModal}
        onSuccess={(msg) => showToast(msg)}
        onError={(msg) => showToast(msg, 'error')}
        customer={modal?.type === 'delete' ? modal.row : null}
      />

      {/* Upload modal */}
      <UploadCustomersModal
        isOpen={modal?.type === 'upload'}
        onClose={closeModal}
        onSuccess={(msg) => showToast(msg)}
      />
    </div>
  );
}
