import { useState } from 'react';
import { Plus, Eye, History, AlertTriangle, RefreshCw, Search, X } from 'lucide-react';
import { Pagination } from '../../../components/ui/Pagination';
import { Card, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../../components/ui/Table';
import { useGetVehicleSummary } from '../../../hooks/useVehicleInsurances';
import { useGetVehicles } from '../../../hooks/useVehicleCatalog';
import { InsuranceFormModal } from '../../../components/vehicle-data/InsuranceFormModal';
import { InsuranceHistoryModal } from '../../../components/vehicle-data/InsuranceHistoryModal';
import type { VehicleInsuranceSummary } from '../../../api/vehicleInsuranceApi';
import { cn } from '../../../utils/cn';

interface Toast {
  id: number;
  message: string;
  variant: 'success' | 'error';
}

export function InsurancePage() {
  const [modal, setModal] = useState<
    { type: 'create'; vehicleId?: number } |
    { type: 'history'; vehicle: VehicleInsuranceSummary } |
    { type: 'view'; vehicle: VehicleInsuranceSummary } |
    null
  >(null);
  const [search, setSearch] = useState('');
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const PAGE_SIZE = 20;

  const { data, isLoading, isError, refetch } = useGetVehicleSummary({
    search: search || undefined,
    status: statusFilter,
    page,
    limit: PAGE_SIZE,
  });
  const { data: vehiclesData } = useGetVehicles('', 'active', 'Xe nhà', 1, 200);

  const vehicles = vehiclesData?.vehicles ?? [];
  const filteredVehicles = vehicles.filter((v) => {
    if (!vehicleSearch) return true;
    const q = vehicleSearch.toLowerCase();
    return v.plate_number.toLowerCase().includes(q) || v.driver_name.toLowerCase().includes(q);
  });

  const showToast = (message: string, variant: 'success' | 'error' = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  };

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;
  const vehicleList = data?.vehicles ?? [];

  const getStatusBadge = (v: VehicleInsuranceSummary) => {
    if (!v.latest_expiry_date) {
      return { label: 'Chưa có', className: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400' };
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(v.latest_expiry_date);
    if (expiry < today) {
      return { label: 'Hết hạn', className: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' };
    }
    const daysUntil = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntil <= 30) {
      return { label: 'Sắp hết hạn', className: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' };
    }
    return { label: 'Còn hạn', className: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' };
  };

  return (
    <div className="p-6 space-y-6">
      <div className="fixed top-4 right-4 z-[100] space-y-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              'px-4 py-3 rounded-lg shadow-lg text-sm font-medium max-w-xs pointer-events-auto transition-all',
              toast.variant === 'success'
                ? 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900'
                : 'bg-red-600 text-white',
            )}
          >
            {toast.message}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
          Quản lý bảo hiểm
        </h1>
        <Button onClick={() => setModal({ type: 'create' })}>
          <Plus className="w-4 h-4 mr-2" />
          Thêm bảo hiểm
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex gap-3 flex-wrap">
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type="text"
                  value={vehicleSearch}
                  placeholder="Tìm theo biển số hoặc tài xế..."
                  onFocus={() => setDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setDropdownOpen(false), 200)}
                  onChange={(e) => {
                    setVehicleSearch(e.target.value);
                    setSearch(e.target.value);
                    setDropdownOpen(true);
                    setPage(1);
                  }}
                  className="pl-9 pr-8 py-2 text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100 w-64"
                />
                {vehicleSearch.length > 0 && (
                  <button
                    onClick={() => { setSearch(''); setVehicleSearch(''); setPage(1); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              {dropdownOpen && filteredVehicles.length > 0 && (
                <div className="absolute z-50 mt-1 w-80 max-h-60 overflow-auto bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg">
                  <button
                    className="w-full text-left px-3 py-2 text-sm text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                    onMouseDown={() => {
                      setSearch('');
                      setVehicleSearch('');
                      setDropdownOpen(false);
                      setPage(1);
                    }}
                  >
                    Tất cả xe
                  </button>
                  {filteredVehicles.map((v) => (
                    <button
                      key={v.id}
                      className="w-full text-left px-3 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                      onMouseDown={() => {
                        setSearch(v.plate_number);
                        setVehicleSearch(`${v.plate_number} - ${v.driver_name}`);
                        setDropdownOpen(false);
                        setPage(1);
                      }}
                    >
                      <span className="font-mono font-medium">{v.plate_number}</span>
                      <span className="text-neutral-400"> - {v.driver_name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="active">Còn hạn</option>
              <option value="expiring">Sắp hết hạn</option>
              <option value="expired">Hết hạn</option>
              <option value="no_insurance">Chưa có bảo hiểm</option>
            </select>
          </div>
        </CardContent>
      </Card>

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
              <p className="text-sm">Không thể tải dữ liệu.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Thử lại
              </Button>
            </div>
          ) : vehicleList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-neutral-500 dark:text-neutral-400">
              <p className="text-sm">
                {search || statusFilter !== 'all'
                  ? 'Không tìm thấy xe nào phù hợp.'
                  : 'Chưa có dữ liệu bảo hiểm.'}
              </p>
              {!search && statusFilter === 'all' && (
                <Button size="sm" onClick={() => setModal({ type: 'create' })}>
                  <Plus className="w-4 h-4 mr-2" />
                  Thêm bảo hiểm
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">STT</TableHead>
                    <TableHead className="w-36">Biển số</TableHead>
                    <TableHead>Tài xế</TableHead>
                    <TableHead className="w-32">Mua gần nhất</TableHead>
                    <TableHead className="w-32">Ngày hết hạn</TableHead>
                    <TableHead className="w-28 text-center">Trạng thái</TableHead>
                    <TableHead className="w-20 text-center">Số lần</TableHead>
                    <TableHead className="w-32 text-center">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vehicleList.map((v, idx) => {
                    const badge = getStatusBadge(v);
                    return (
                      <TableRow key={v.vehicle_id}>
                        <TableCell className="text-neutral-500 dark:text-neutral-400 text-sm">
                          {(page - 1) * PAGE_SIZE + idx + 1}
                        </TableCell>
                        <TableCell className="font-mono font-medium text-neutral-900 dark:text-neutral-100">
                          {v.plate_number}
                        </TableCell>
                        <TableCell className="text-neutral-700 dark:text-neutral-300">
                          {v.driver_name}
                        </TableCell>
                        <TableCell className="text-neutral-700 dark:text-neutral-300 text-sm">
                          {v.latest_purchase_date
                            ? new Date(v.latest_purchase_date).toLocaleDateString('vi-VN')
                            : '-'}
                        </TableCell>
                        <TableCell className="text-neutral-700 dark:text-neutral-300 text-sm font-medium">
                          {v.latest_expiry_date
                            ? new Date(v.latest_expiry_date).toLocaleDateString('vi-VN')
                            : '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={cn('inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium', badge.className)}>
                            {badge.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-center text-neutral-700 dark:text-neutral-300 text-sm">
                          {v.insurance_count}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => setModal({ type: 'view', vehicle: v })}
                              disabled={!v.latest_insurance_id}
                              className="p-1.5 text-neutral-400 dark:text-neutral-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Xem chi tiết"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setModal({ type: 'history', vehicle: v })}
                              disabled={v.insurance_count === 0}
                              className="p-1.5 text-neutral-400 dark:text-neutral-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Lịch sử bảo hiểm"
                            >
                              <History className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setModal({ type: 'create', vehicleId: v.vehicle_id })}
                              className="p-1.5 text-neutral-400 dark:text-neutral-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
                              title="Thêm bảo hiểm mới"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={data?.total ?? 0}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <InsuranceFormModal
        isOpen={modal?.type === 'create'}
        onClose={() => setModal(null)}
        onSuccess={(msg) => showToast(msg)}
        onError={(msg) => showToast(msg, 'error')}
        insurance={null}
        preselectedVehicleId={modal?.type === 'create' ? modal.vehicleId : undefined}
      />

      {modal?.type === 'view' && modal.vehicle.latest_insurance_id && (
        <InsuranceFormModal
          isOpen={true}
          onClose={() => setModal(null)}
          onSuccess={(msg) => showToast(msg)}
          onError={(msg) => showToast(msg, 'error')}
          viewInsuranceId={modal.vehicle.latest_insurance_id}
          viewMode
        />
      )}

      {modal?.type === 'history' && (
        <InsuranceHistoryModal
          isOpen={true}
          onClose={() => setModal(null)}
          vehicle={modal.vehicle}
          onError={(msg) => showToast(msg, 'error')}
          onSuccess={(msg) => showToast(msg)}
        />
      )}
    </div>
  );
}
