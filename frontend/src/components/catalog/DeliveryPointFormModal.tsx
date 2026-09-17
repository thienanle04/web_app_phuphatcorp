import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useCreateDeliveryPoint, useUpdateDeliveryPoint } from '../../hooks/useDeliveryPoints';
import type { DeliveryPoint, DeliveryPointData } from '../../api/deliveryPointApi';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  item: DeliveryPoint | null;
}

function FormContent({ item, onSuccess, onError, onClose }: Omit<Props, 'isOpen'>) {
  const createMutation = useCreateDeliveryPoint();
  const updateMutation = useUpdateDeliveryPoint();
  const isEdit = !!item;

  const [form, setForm] = useState<DeliveryPointData>({
    code: item?.code ?? '',
    address: item?.address ?? '',
    notes: item?.notes ?? '',
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleSubmit = async () => {
    setFieldErrors({});

    const errs: Record<string, string> = {};
    if (!form.code.trim()) errs.code = 'Mã là bắt buộc';
    if (!form.address.trim()) errs.address = 'Địa chỉ là bắt buộc';
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    try {
      if (isEdit && item) {
        await updateMutation.mutateAsync({ id: item.id, data: form });
        onSuccess('Cập nhật điểm nhận hàng thành công.');
      } else {
        await createMutation.mutateAsync(form);
        onSuccess('Thêm điểm nhận hàng thành công.');
      }
      onClose();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const e = err as {
          response?: { data?: { message?: string; errors?: { path: string; msg: string }[] }; status?: number };
        };
        if (e.response?.status === 409) {
          setFieldErrors({ code: 'Mã đã tồn tại' });
          return;
        }
        if (e.response?.data?.errors) {
          const errs2: Record<string, string> = {};
          e.response.data.errors.forEach((item) => {
            errs2[item.path] = item.msg;
          });
          setFieldErrors(errs2);
          return;
        }
        onError(e.response?.data?.message || 'Lỗi. Vui lòng thử lại.');
      } else {
        onError('Lỗi kết nối. Vui lòng thử lại.');
      }
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
          Mã <span className="text-red-500">*</span>
        </label>
        <Input
          value={form.code}
          onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
          placeholder="VD: DN001"
          error={fieldErrors.code}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
          Địa chỉ <span className="text-red-500">*</span>
        </label>
        <Input
          value={form.address}
          onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
          placeholder="Nhập địa chỉ"
          error={fieldErrors.address}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
          Ghi chú
        </label>
        <Input
          value={form.notes ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          placeholder="Ghi chú thêm..."
        />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="outline" type="button" onClick={onClose}>
          Hủy
        </Button>
        <Button
          type="button"
          isLoading={createMutation.isPending || updateMutation.isPending}
          onClick={handleSubmit}
        >
          {isEdit ? 'Lưu' : 'Thêm mới'}
        </Button>
      </div>
    </div>
  );
}

export function DeliveryPointFormModal({ isOpen, onClose, onSuccess, onError, item }: Props) {
  const isEdit = !!item;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Sửa điểm nhận hàng' : 'Thêm điểm nhận hàng'} size="md">
      {isOpen && (
        <FormContent
          key={item?.id ?? 'new'}
          item={item}
          onSuccess={onSuccess}
          onError={onError}
          onClose={onClose}
        />
      )}
    </Modal>
  );
}
