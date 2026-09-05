import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useCreatePromoItem, useUpdatePromoItem } from '../../hooks/usePromoItems';
import type { PromoItem, PromoItemData } from '../../api/promoItemApi';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  item: PromoItem | null;
}

function FormContent({ item, onSuccess, onError, onClose }: Omit<Props, 'isOpen'>) {
  const createMutation = useCreatePromoItem();
  const updateMutation = useUpdatePromoItem();
  const isEdit = !!item;

  const [form, setForm] = useState<PromoItemData>({
    code: item?.code ?? '',
    product_name: item?.product_name ?? '',
    unit_weight_kg: item?.unit_weight_kg ?? 0,
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleSubmit = async () => {
    setFieldErrors({});

    const errs: Record<string, string> = {};
    if (!form.code.trim()) errs.code = 'Mã là bắt buộc';
    if (!form.product_name.trim()) errs.product_name = 'Tên hàng hóa là bắt buộc';
    if (form.unit_weight_kg < 0) errs.unit_weight_kg = 'Trọng lượng phải >= 0';
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    try {
      if (isEdit && item) {
        await updateMutation.mutateAsync({ id: item.id, data: form });
        onSuccess('Cập nhật hàng khuyến mãi thành công.');
      } else {
        await createMutation.mutateAsync(form);
        onSuccess('Thêm hàng khuyến mãi thành công.');
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
          placeholder="VD: KM001"
          error={fieldErrors.code}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
          Tên hàng hóa <span className="text-red-500">*</span>
        </label>
        <Input
          value={form.product_name}
          onChange={(e) => setForm((f) => ({ ...f, product_name: e.target.value }))}
          placeholder="Nhập tên hàng hóa"
          error={fieldErrors.product_name}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
          Trọng lượng đơn vị (kg) <span className="text-red-500">*</span>
        </label>
        <Input
          type="number"
          step="0.001"
          min="0"
          value={form.unit_weight_kg}
          onChange={(e) => setForm((f) => ({ ...f, unit_weight_kg: parseFloat(e.target.value) || 0 }))}
          error={fieldErrors.unit_weight_kg}
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

export function PromoItemFormModal({ isOpen, onClose, onSuccess, onError, item }: Props) {
  const isEdit = !!item;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Sửa hàng khuyến mãi' : 'Thêm hàng khuyến mãi'} size="md">
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
