import { useState } from 'react';
import {
  Plus,
  Pencil,
  AlertTriangle,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  Truck,
  UserCheck,
} from 'lucide-react';
import { Pagination } from '../../../components/ui/Pagination';
import { Card, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../components/ui/Table';
import { useGetDrivers, useToggleDriverStatus } from '../../../hooks/useDrivers';
import { DriverFormModal } from '../../../components/catalog/DriverFormModal';
import type { Driver } from '../../../api/driverApi';

interface Toast {
  id: number;
  message: string;
  variant: 'success' | 'error';
}

export function DriverCatalogPage() {
  const [modal, setModal] = useState<
    | { type: 'create' }
    | { type: 'edit'; driver: Driver }
    | null
  >(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const PAGE_SIZE = 20;

  const { data, isLoading, isError, refetch } = useGetDrivers({
    search,
    status: statusFilter,
    page,
    limit: PAGE_SIZE,
  });

  const toggleMutation = useToggleDriverStatus();

  const showToast = (
    message: string,
    variant: 'success' | 'error' = 'success',
  ) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  };

  const handleToggle = async (driver: Driver) => {
    try {
      const updated = await toggleMutation.mutateAsync(driver.id);
      showToast(
        updated.status === 'active'
          ? `Đã kích hoạt tài xế ${updated.full_name}`
          : `Đã vô hiệu hóa tài xế ${updated.full_name}`,
      );
    } catch {
      showToast('Không thể cập nhật trạng thái.', 'error');
    }
  };

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;
  const drivers = data?.drivers ?? [];

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
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
            Danh mục tài xế
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Quản lý tài xế từ tài khoản người dùng và phân công xe nhà
          </p>
        </div>
        <Button onClick={() => setModal({ type: 'create' })}>
          <Plus className="w-4 h-4 mr-2" />
          Thêm mới
        </Button>
      </div>

      {/* Toolbar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-3 flex-wrap">
            <Input
              placeholder="Tìm theo họ tên, username, biển số xe..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="flex-1 min-w-48 max-w-md"
            />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
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
                <div
                  key={i}
                  className="h-10 bg-neutral-100 dark:bg-neutral-800 rounded animate-pulse"
                />
              ))}
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-neutral-500 dark:text-neutral-400">
              <AlertTriangle className="w-8 h-8 text-red-400" />
              <p className="text-sm">Không thể tải danh sách tài xế.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Thử lại
              </Button>
            </div>
          ) : drivers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-neutral-500 dark:text-neutral-400">
              <UserCheck className="w-12 h-12 text-neutral-300 dark:text-neutral-600" />
              <p className="text-sm">
                {search
                  ? 'Không tìm thấy tài xế nào phù hợp.'
                  : 'Chưa có tài xế nào trong danh mục.'}
              </p>
              {!search && (
                <Button size="sm" onClick={() => setModal({ type: 'create' })}>
                  <Plus className="w-4 h-4 mr-2" />
                  Thêm tài xế đầu tiên
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">STT</TableHead>
                    <TableHead className="w-48">Họ tên tài xế</TableHead>
                    <TableHead className="w-40">Tên đăng nhập</TableHead>
                    <TableHead className="min-w-64">Xe phụ trách</TableHead>
                    <TableHead className="w-48 hidden md:table-cell">Ghi chú</TableHead>
                    <TableHead className="w-28 text-center">Trạng thái</TableHead>
                    <TableHead className="w-36">Ngày tạo</TableHead>
                    <TableHead className="w-24 text-center">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drivers.map((driver, idx) => (
                    <TableRow key={driver.id}>
                      <TableCell className="text-neutral-500 dark:text-neutral-400 text-sm">
                        {(page - 1) * PAGE_SIZE + idx + 1}
                      </TableCell>
                      <TableCell className="font-medium text-neutral-900 dark:text-neutral-100">
                        {driver.full_name}
                      </TableCell>
                      <TableCell className="text-neutral-600 dark:text-neutral-400 font-mono text-sm">
                        {driver.username}
                      </TableCell>
                      <TableCell>
                        {driver.vehicles && driver.vehicles.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 py-1">
                            {driver.vehicles.map((v) => (
                              <span
                                key={v.id}
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 font-mono text-xs font-medium border border-neutral-200 dark:border-neutral-700"
                                title={`Phân loại: ${v.vehicle_type} | Tài xế mặc định: ${v.driver_name || '—'}`}
                              >
                                <Truck className="w-3 h-3 text-neutral-500" />
                                <span>{v.plate_number}</span>
                                <span
                                  className={`text-[10px] px-1 rounded font-sans ${
                                    v.vehicle_type === 'Xe nhà'
                                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                                  }`}
                                >
                                  {v.vehicle_type}
                                </span>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-neutral-400 italic">Chưa gắn xe</span>
                        )}
                      </TableCell>
                      <TableCell className="text-neutral-500 dark:text-neutral-400 text-sm hidden md:table-cell truncate max-w-48">
                        {driver.notes || '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        {driver.status === 'active' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400">
                            Inactive
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-neutral-500 dark:text-neutral-400 text-sm">
                        {new Date(driver.created_at).toLocaleDateString('vi-VN')}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setModal({ type: 'edit', driver })}
                            className="p-1.5 text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors"
                            title="Sửa xe phụ trách"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleToggle(driver)}
                            disabled={toggleMutation.isPending}
                            className="p-1.5 text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors disabled:opacity-50"
                            title={
                              driver.status === 'active'
                                ? 'Vô hiệu hóa tài xế'
                                : 'Kích hoạt tài xế'
                            }
                          >
                            {driver.status === 'active' ? (
                              <ToggleRight className="w-5 h-5 text-green-600 dark:text-green-400" />
                            ) : (
                              <ToggleLeft className="w-5 h-5" />
                            )}
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
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

      {/* Driver Form Modal */}
      <DriverFormModal
        isOpen={modal?.type === 'create' || modal?.type === 'edit'}
        onClose={() => setModal(null)}
        onSuccess={(msg) => showToast(msg)}
        onError={(msg) => showToast(msg, 'error')}
        driver={modal?.type === 'edit' ? modal.driver : null}
      />
    </div>
  );
}
