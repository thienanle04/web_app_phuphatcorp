import { useState, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SearchableSelect } from '../ui/SearchableSelect';
import { Check, Loader2, Search, Truck } from 'lucide-react';
import {
  useCreateDriver,
  useUpdateDriver,
  useGetAvailableDriverUsers,
  useGetAvailableDriverVehicles,
} from '../../hooks/useDrivers';
import type { Driver } from '../../api/driverApi';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  driver: Driver | null;
}

function FormContent({
  driver,
  onSuccess,
  onError,
  onClose,
}: Omit<Props, 'isOpen'>) {
  const isEdit = !!driver;
  const createMutation = useCreateDriver();
  const updateMutation = useUpdateDriver();

  const { data: availableUsers = [], isLoading: loadingUsers } =
    useGetAvailableDriverUsers(driver?.id, true);
  const { data: availableVehicles = [], isLoading: loadingVehicles } =
    useGetAvailableDriverVehicles(true);

  const [userId, setUserId] = useState<string>(
    driver?.user_id ? String(driver.user_id) : '',
  );
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<number[]>(
    driver?.vehicles?.map((v) => v.id) ?? [],
  );
  const [vehicleSearch, setVehicleSearch] = useState<string>('');
  const [notes, setNotes] = useState<string>(driver?.notes ?? '');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const userOptions = useMemo(() => {
    return availableUsers.map((u) => ({
      value: String(u.id),
      label: `${u.full_name} (${u.username})${u.email ? ` - ${u.email}` : ''}`,
    }));
  }, [availableUsers]);

  const filteredVehicles = useMemo(() => {
    const q = vehicleSearch.trim().toLowerCase();
    if (!q) return availableVehicles;
    return availableVehicles.filter(
      (v) =>
        v.plate_number.toLowerCase().includes(q) ||
        (v.driver_name && v.driver_name.toLowerCase().includes(q)),
    );
  }, [availableVehicles, vehicleSearch]);

  const toggleVehicle = (id: number) => {
    setSelectedVehicleIds((prev) =>
      prev.includes(id) ? prev.filter((vId) => vId !== id) : [...prev, id],
    );
  };

  const selectAllVehicles = () => {
    if (selectedVehicleIds.length === availableVehicles.length) {
      setSelectedVehicleIds([]);
    } else {
      setSelectedVehicleIds(availableVehicles.map((v) => v.id));
    }
  };

  const handleSubmit = async () => {
    setFieldErrors({});

    if (!isEdit && !userId) {
      setFieldErrors({ user_id: 'Vui lòng chọn tài khoản người dùng' });
      return;
    }

    try {
      if (isEdit && driver) {
        await updateMutation.mutateAsync({
          id: driver.id,
          data: {
            vehicle_ids: selectedVehicleIds,
            notes,
          },
        });
        onSuccess(`Cập nhật tài xế ${driver.full_name} thành công.`);
      } else {
        await createMutation.mutateAsync({
          user_id: Number(userId),
          vehicle_ids: selectedVehicleIds,
          notes,
        });
        onSuccess('Thêm tài xế thành công.');
      }
      onClose();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const e = err as {
          response?: {
            data?: {
              message?: string;
              errors?: { path: string; msg: string }[];
            };
            status?: number;
          };
        };
        if (e.response?.status === 409) {
          setFieldErrors({
            user_id: 'Tài khoản người dùng này đã được gán làm tài xế',
          });
          return;
        }
        if (e.response?.data?.message) {
          onError(e.response.data.message);
          return;
        }
      }
      onError('Lỗi khi lưu tài xế. Vui lòng thử lại.');
    }
  };

  return (
    <div className="space-y-4">
      {/* Chọn User với SearchableSelect */}
      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
          Tài khoản người dùng <span className="text-red-500">*</span>
        </label>
        {isEdit ? (
          <div className="p-2.5 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-sm font-medium text-neutral-900 dark:text-neutral-100 flex items-center justify-between">
            <span>{driver.full_name} ({driver.username})</span>
            <span className="text-xs text-neutral-500">{driver.email}</span>
          </div>
        ) : loadingUsers ? (
          <div className="flex items-center gap-2 text-sm text-neutral-500 py-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Đang tải danh sách người dùng...
          </div>
        ) : (
          <div>
            <SearchableSelect
              options={userOptions}
              value={userId}
              onChange={(val) => setUserId(val)}
              placeholder="-- Chọn hoặc tìm kiếm tài khoản người dùng --"
              searchPlaceholder="Tìm kiếm tên, username, email..."
              clearable
              error={fieldErrors.user_id}
            />
            {availableUsers.length === 0 && (
              <p className="text-xs text-neutral-400 mt-1">
                Tất cả người dùng hoạt động đã được phân quyền làm tài xế.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Chọn Xe (Multi-select có Search Filter) */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Xe phụ trách
          </label>
          {availableVehicles.length > 0 && (
            <button
              type="button"
              onClick={selectAllVehicles}
              className="text-xs text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 underline"
            >
              {selectedVehicleIds.length === availableVehicles.length
                ? 'Bỏ chọn tất cả'
                : 'Chọn tất cả'}
            </button>
          )}
        </div>

        {loadingVehicles ? (
          <div className="flex items-center gap-2 text-sm text-neutral-500 py-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Đang tải danh sách xe...
          </div>
        ) : availableVehicles.length === 0 ? (
          <p className="text-xs text-neutral-400 bg-neutral-50 dark:bg-neutral-800/50 p-3 rounded-lg border border-neutral-200 dark:border-neutral-700">
            Chưa có xe nào đang hoạt động trong Danh mục xe.
          </p>
        ) : (
          <div className="space-y-2">
            {/* Input Search xe */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                value={vehicleSearch}
                onChange={(e) => setVehicleSearch(e.target.value)}
                placeholder="Tìm theo biển số, tài xế, phân loại..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-neutral-100"
              />
            </div>

            {/* List xe */}
            <div className="max-h-48 overflow-y-auto p-2 border border-neutral-200 dark:border-neutral-700 rounded-lg space-y-1 bg-neutral-50 dark:bg-neutral-950">
              {filteredVehicles.length === 0 ? (
                <p className="text-xs text-neutral-400 text-center py-3">
                  Không tìm thấy xe nào phù hợp.
                </p>
              ) : (
                filteredVehicles.map((v) => {
                  const isSelected = selectedVehicleIds.includes(v.id);
                  return (
                    <div
                      key={v.id}
                      onClick={() => toggleVehicle(v.id)}
                      className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors text-sm ${
                        isSelected
                          ? 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 font-medium'
                          : 'hover:bg-neutral-200/60 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4 opacity-70" />
                        <span className="font-mono">{v.plate_number}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                            isSelected
                              ? 'bg-white/20 text-white dark:text-neutral-900'
                              : v.vehicle_type === 'Xe nhà'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                          }`}
                        >
                          {v.vehicle_type}
                        </span>
                        {v.driver_name && (
                          <span className="text-xs opacity-75">({v.driver_name})</span>
                        )}
                      </div>
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center ${
                          isSelected
                            ? 'border-white dark:border-neutral-900 bg-white/20'
                            : 'border-neutral-400 dark:border-neutral-600'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
        <p className="text-xs text-neutral-400 mt-1">
          Đã chọn: {selectedVehicleIds.length} xe. (1 tài xế có thể phụ trách nhiều xe và 1 xe có thể có nhiều tài xế)
        </p>
      </div>

      {/* Ghi chú */}
      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
          Ghi chú
        </label>
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ghi chú về tài xế (nếu có)..."
        />
      </div>

      {/* Buttons */}
      <div className="flex justify-end gap-3 pt-3 border-t border-neutral-200 dark:border-neutral-800">
        <Button variant="outline" type="button" onClick={onClose}>
          Hủy
        </Button>
        <Button
          type="button"
          isLoading={createMutation.isPending || updateMutation.isPending}
          onClick={handleSubmit}
        >
          {isEdit ? 'Lưu thay đổi' : 'Thêm mới'}
        </Button>
      </div>
    </div>
  );
}

export function DriverFormModal({
  isOpen,
  onClose,
  onSuccess,
  onError,
  driver,
}: Props) {
  const isEdit = !!driver;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Sửa thông tin tài xế' : 'Thêm tài xế mới'}
      size="md"
    >
      {isOpen && (
        <FormContent
          key={driver?.id ?? 'new'}
          driver={driver}
          onSuccess={onSuccess}
          onError={onError}
          onClose={onClose}
        />
      )}
    </Modal>
  );
}

