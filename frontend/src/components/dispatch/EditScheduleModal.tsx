import { useState, useEffect, useMemo } from 'react';
import { useI18n } from '../../i18n/useI18n';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { SearchableSelect, type SearchableSelectOption } from '../ui/SearchableSelect';
import { cn } from '../../utils/cn';
import { useGetDeliveryPoints } from '../../hooks/useDeliveryPoints';
import type { DispatchSchedule, UpdateDispatchScheduleRequest } from '../../api/dispatchApi';

interface EditScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: DispatchSchedule | null;
  onSubmit: (id: number, data: UpdateDispatchScheduleRequest) => Promise<void>;
  isSubmitting: boolean;
}

interface FormData {
  diem_nhan: string;
  tan: string;
  can: string;
  ghi_chu: string;
}

interface FieldErrors {
  diem_nhan?: string;
}

export function EditScheduleModal({
  isOpen,
  onClose,
  schedule,
  onSubmit,
  isSubmitting,
}: EditScheduleModalProps) {
  const { t } = useI18n();

  const { data: deliveryPointsData } = useGetDeliveryPoints('', 1, 200);
  const deliveryPoints = deliveryPointsData?.items ?? [];

  const deliveryPointOptions: SearchableSelectOption[] = useMemo(
    () =>
      deliveryPoints.map((dp) => ({
        value: dp.code,
        label: dp.address ? `${dp.code} - ${dp.address}` : dp.code,
      })),
    [deliveryPoints],
  );

  const [form, setForm] = useState<FormData>({
    diem_nhan: '',
    tan: '',
    can: '',
    ghi_chu: '',
  });
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (schedule) {
      setForm({
        diem_nhan: schedule.diem_nhan,
        tan: schedule.tan ?? '',
        can: schedule.can ?? '',
        ghi_chu: schedule.ghi_chu ?? '',
      });
      setErrors({});
    }
  }, [schedule]);

  const validate = (): boolean => {
    const newErrors: FieldErrors = {};
    if (!form.diem_nhan.trim()) {
      newErrors.diem_nhan = t('dispatch.validation.diemNhanRequired' as never);
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate() || !schedule) return;
    await onSubmit(schedule.id, {
      diem_nhan: form.diem_nhan,
      tan: form.tan || null,
      can: form.can || null,
      ghi_chu: form.ghi_chu || null,
    });
  };

  const inputClass = (hasError?: boolean) =>
    cn(
      'w-full px-3 py-2.5 rounded-lg border text-base sm:text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 outline-none transition-colors h-11 sm:h-10',
      hasError
        ? 'border-red-400 focus:border-red-500'
        : 'border-neutral-300 dark:border-neutral-600 focus:border-neutral-500 dark:focus:border-neutral-400',
    );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('dispatch.editModal.title' as never)}
      size="md"
    >
      {schedule && (
        <div className="flex gap-1.5 mb-4 flex-wrap">
          {schedule.bien_so && (
            <span className="text-xs font-bold bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 px-2.5 py-1 rounded-md">
              {schedule.bien_so}
            </span>
          )}
          {[schedule.loai_tuyen, schedule.xe_type, schedule.loai_xe].filter(Boolean).map((label) => (
            <span
              key={label}
              className="text-xs bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 px-2.5 py-1 rounded-md"
            >
              {label}
            </span>
          ))}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-xs sm:text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
            {t('dispatch.createModal.diemNhan' as never)} <span className="text-red-500">*</span>
          </label>
          <SearchableSelect
            options={deliveryPointOptions}
            value={form.diem_nhan}
            onChange={(val) => setForm((p) => ({ ...p, diem_nhan: val }))}
            placeholder={t('dispatch.createModal.diemNhanPlaceholder' as never)}
            searchPlaceholder="Tìm điểm nhận..."
            clearable
            error={errors.diem_nhan}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
              {t('dispatch.createModal.tan' as never)}
            </label>
            <input
              type="text"
              value={form.tan}
              onChange={(e) => setForm((p) => ({ ...p, tan: e.target.value }))}
              placeholder="Số tấn"
              className={inputClass()}
            />
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
              {t('dispatch.createModal.can' as never)}
            </label>
            <input
              type="text"
              value={form.can}
              onChange={(e) => setForm((p) => ({ ...p, can: e.target.value }))}
              placeholder="Cán"
              className={inputClass()}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs sm:text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
            {t('dispatch.createModal.ghiChu' as never)}
          </label>
          <textarea
            value={form.ghi_chu}
            onChange={(e) => setForm((p) => ({ ...p, ghi_chu: e.target.value }))}
            placeholder={t('dispatch.createModal.ghiChuPlaceholder' as never)}
            rows={3}
            className="w-full px-3 py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-600 text-base sm:text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 outline-none focus:border-neutral-500 dark:focus:border-neutral-400 transition-colors"
          />
        </div>

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-full sm:w-auto h-11 sm:h-10"
          >
            {t('dispatch.deleteModal.cancel' as never)}
          </Button>
          <Button
            onClick={handleSubmit}
            isLoading={isSubmitting}
            disabled={isSubmitting}
            className="w-full sm:w-auto h-11 sm:h-10 font-medium"
          >
            {isSubmitting
              ? t('dispatch.editModal.submitting' as never)
              : t('dispatch.editModal.submit' as never)}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
