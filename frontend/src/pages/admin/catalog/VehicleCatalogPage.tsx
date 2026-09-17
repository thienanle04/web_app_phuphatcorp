import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Plus, Pencil, AlertTriangle, RefreshCw, ToggleLeft, ToggleRight } from 'lucide-react';
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
import { useGetVehicles, useToggleVehicleStatus } from '../../../hooks/useVehicleCatalog';
import { UploadVehiclesModal } from '../../../components/catalog/UploadVehiclesModal';
import { VehicleFormModal } from '../../../components/catalog/VehicleFormModal';
import type { Vehicle } from '../../../api/vehicleCatalogApi';

interface Toast {
  id: number;
  message: string;
  variant: 'success' | 'error';
}

export function VehicleCatalogPage() {
  const navigate = useNavigate();
  const [modal, setModal] = useState<{ type: 'upload' } | { type: 'create' } | { type: 'edit'; vehicle: Vehicle } | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const PAGE_SIZE = 20;

  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const { data, isLoading, isError, refetch } = useGetVehicles(search, statusFilter, typeFilter, page, PAGE_SIZE);
  const toggleMutation = useToggleVehicleStatus();

  const showToast = (message: string, variant: 'success' | 'error' = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  };

  const handleToggle = async (vehicle: Vehicle) => {
    try {
      const updated = await toggleMutation.mutateAsync(vehicle.id);
      showToast(updated.status === 'active' ? `Đã kích hoạt xe ${updated.plate_number}` : `Đã vô hiệu hóa xe ${updated.plate_number}`);
    } catch {
      showToast('Không thể cập nhật trạng thái.', 'error');
    }
  };

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;
  const vehicles = data?.vehicles ?? [];

  return (
    <div className="p-6 space-y-6">
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

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
          Danh mục xe
        </h1>
        <div className="flex items-center gap-2">
          <Button onClick={() => setModal({ type: 'create' })} variant="outline">
            <Plus className="w-4 h-4 mr-2" />
            Thêm mới
          </Button>
          <Button onClick={() => setModal({ type: 'upload' })}>
            <Upload className="w-4 h-4 mr-2" />
            Upload Excel
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex gap-3 flex-wrap">
            <Input
              placeholder="Tìm theo biển số hoặc tên tài xế..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="flex-1 min-w-48 max-w-md"
            />
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100"
            >
              <option value="all">Tất cả phân loại</option>
              <option value="Xe nhà">Xe nhà</option>
              <option value="Xe ngoài">Xe ngoài</option>
            </select>
          </div>
        </CardContent>
      </Card>

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
              <p className="text-sm">Không thể tải dữ liệu.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Thử lại
              </Button>
            </div>
          ) : vehicles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-neutral-500 dark:text-neutral-400">
              <p className="text-sm">
                {search
                  ? 'Không tìm thấy xe nào phù hợp.'
                  : 'Chưa có xe nào. Upload Excel để bắt đầu.'}
              </p>
              {!search && (
                <Button size="sm" onClick={() => setModal({ type: 'upload' })}>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Excel
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">STT</TableHead>
                    <TableHead className="w-48">Biển số</TableHead>
                    <TableHead>Tên tài xế</TableHead>
                    <TableHead className="w-28 text-center">Phân loại</TableHead>
                    <TableHead className="w-28 text-center">Số tài xế</TableHead>
                    <TableHead className="w-28 text-center">Trạng thái</TableHead>
                    <TableHead className="w-44">Ngày tạo</TableHead>
                    <TableHead className="w-20 text-center">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vehicles.map((vehicle, idx) => (
                    <TableRow key={vehicle.id}>
                      <TableCell className="text-neutral-500 dark:text-neutral-400 text-sm">
                        {(page - 1) * PAGE_SIZE + idx + 1}
                      </TableCell>
                      <TableCell className="font-mono font-medium text-neutral-900 dark:text-neutral-100">
                        <button
                          onClick={() => navigate(`/catalog/vehicles/${vehicle.id}`)}
                          className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer text-left"
                        >
                          {vehicle.plate_number}
                        </button>
                      </TableCell>
                      <TableCell className="text-neutral-700 dark:text-neutral-300">
                        {vehicle.driver_name}
                      </TableCell>
                      <TableCell className="text-center text-sm text-neutral-600 dark:text-neutral-400">
                        {vehicle.vehicle_type}
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                          (vehicle.driver_count ?? 0) > 0
                            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500'
                        }`}>
                          {vehicle.driver_count ?? 0}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {vehicle.status === 'active' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400">
                            Inactive
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-neutral-500 dark:text-neutral-400 text-sm">
                        {new Date(vehicle.created_at).toLocaleDateString('vi-VN')}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setModal({ type: 'edit', vehicle })}
                            className="p-1.5 text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors"
                            title="Sửa"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleToggle(vehicle)}
                            disabled={toggleMutation.isPending}
                            className="p-1.5 text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors disabled:opacity-50"
                            title={vehicle.status === 'active' ? 'Vô hiệu hóa' : 'Kích hoạt'}
                          >
                            {vehicle.status === 'active' ? (
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

      <VehicleFormModal
        isOpen={modal?.type === 'create' || modal?.type === 'edit'}
        onClose={() => setModal(null)}
        onSuccess={(msg) => showToast(msg)}
        onError={(msg) => showToast(msg, 'error')}
        vehicle={modal?.type === 'edit' ? modal.vehicle : null}
      />

      <UploadVehiclesModal
        isOpen={modal?.type === 'upload'}
        onClose={() => setModal(null)}
        onSuccess={(msg) => showToast(msg)}
        onError={(msg) => showToast(msg, 'error')}
      />
    </div>
  );
}
