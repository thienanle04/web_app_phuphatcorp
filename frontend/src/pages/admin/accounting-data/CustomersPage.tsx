import { useState, useMemo } from 'react';
import { Plus, Upload, Pencil, Trash2, AlertTriangle, RefreshCw, Check, X } from 'lucide-react';
import { Pagination } from '../../../components/ui/Pagination';
import { Card, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/Table';
import { useGetCustomers } from '../../../hooks/useCustomers';
import { CreateCustomerModal } from '../../../components/admin/CreateCustomerModal';
import { EditCustomerModal } from '../../../components/admin/EditCustomerModal';
import { DeleteCustomerDialog } from '../../../components/admin/DeleteCustomerDialog';
import { UploadCustomersModal } from '../../../components/admin/UploadCustomersModal';
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
  const PAGE_SIZE = 20;

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

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 bg-neutral-100 dark:bg-neutral-800 rounded animate-pulse" />
              ))}
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-neutral-500 dark:text-neutral-400">
              <AlertTriangle className="w-8 h-8 text-red-400" />
              <p className="text-sm">{t('customers.errorLoad')}</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="w-4 h-4 mr-2" />
                {t('customers.retry')}
              </Button>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-neutral-500 dark:text-neutral-400">
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">{t('customers.columns.stt')}</TableHead>
                    <TableHead className="w-48">{t('customers.columns.diemTraHang')}</TableHead>
                    <TableHead className="w-48 hidden md:table-cell">{t('customers.columns.tuyenPhuong')}</TableHead>
                    <TableHead className="min-w-48 hidden md:table-cell">{t('customers.columns.diemGiaoHangTinhPhi')}</TableHead>
                    <TableHead className="min-w-64">{t('customers.columns.tenKhachHang')}</TableHead>
                    <TableHead className="w-20 text-center">{t('customers.columns.bocXep')}</TableHead>
                    <TableHead className="hidden lg:table-cell">{t('customers.columns.nhaCungCap')}</TableHead>
                    {canManage && <TableHead className="w-20">{t('customers.columns.actions')}</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedRows.map((row, idx) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-neutral-500 dark:text-neutral-400 text-sm">
                        {(page - 1) * PAGE_SIZE + idx + 1}
                      </TableCell>
                      <TableCell
                        className="font-medium text-neutral-900 dark:text-neutral-100 max-w-48 truncate"
                        title={row.diem_tra_hang}
                      >
                        {row.diem_tra_hang}
                      </TableCell>
                      <TableCell className="text-neutral-600 dark:text-neutral-400 hidden md:table-cell max-w-48 truncate">
                        {row.tuyen_phuong || '—'}
                      </TableCell>
                      <TableCell
                        className="text-neutral-600 dark:text-neutral-400 hidden md:table-cell min-w-0 max-w-48 truncate"
                        title={row.diem_giao_hang_tinh_phi ?? undefined}
                      >
                        {row.diem_giao_hang_tinh_phi || (
                          <span className="text-neutral-400 dark:text-neutral-600">—</span>
                        )}
                      </TableCell>
                      <TableCell
                        className="text-neutral-700 dark:text-neutral-300 max-w-64 truncate"
                        title={row.ten_khach_hang}
                      >
                        {row.ten_khach_hang}
                      </TableCell>
                      <TableCell className="text-center">
                        {row.boc_xep ? (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">
                            <Check className="w-3 h-3" />
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500">
                            <X className="w-3 h-3" />
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-neutral-600 dark:text-neutral-400 hidden lg:table-cell">
                        {row.supplier ? (
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                            title={row.supplier.supplier_code}
                          >
                            {row.supplier.name}
                          </span>
                        ) : (
                          <span className="text-neutral-400 dark:text-neutral-600">—</span>
                        )}
                      </TableCell>
                      {canManage && (
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setModal({ type: 'edit', row })}
                              className="p-1.5 text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors"
                              title="Sửa"
                              aria-label="Sửa"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setModal({ type: 'delete', row })}
                              className="p-1.5 text-neutral-400 dark:text-neutral-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                              title="Xóa"
                              aria-label="Xóa"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={filteredRows.length}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            </div>
          )}
        </CardContent>
      </Card>

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
