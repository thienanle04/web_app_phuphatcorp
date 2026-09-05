import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useUpdateCustomer } from '../../hooks/useCustomers';
import { useI18n } from '../../i18n/useI18n';
import type { Customer, CustomerData } from '../../api/customersApi';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
  customer: Customer | null;
}

const schema = yup.object({
  diem_tra_hang: yup.string().required('customers.errors.diemTraHangRequired'),
  ten_khach_hang: yup.string().required('customers.errors.tenKhachHangRequired'),
  tuyen_phuong: yup.string().nullable().optional(),
  tuyen_cu: yup.string().nullable().optional(),
  dia_chi_giao_hang: yup.string().nullable().optional(),
  diem_giao_hang_tinh_phi: yup.string().nullable().optional().max(255, 'customers.errors.diemGhtpMax'),
  boc_xep: yup.boolean().required(),
  supplier_code: yup.string().nullable().optional(),
});

type FormValues = {
  diem_tra_hang: string;
  ten_khach_hang: string;
  tuyen_phuong?: string | null;
  tuyen_cu?: string | null;
  dia_chi_giao_hang?: string | null;
  diem_giao_hang_tinh_phi?: string | null;
  boc_xep: boolean;
  supplier_code?: string | null;
};

export function EditCustomerModal({ isOpen, onClose, onSuccess, onError, customer }: Props) {
  const { t } = useI18n();
  const updateCustomer = useUpdateCustomer();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isValid },
  } = useForm<FormValues>({
    resolver: yupResolver(schema),
    mode: 'onChange',
  });

  useEffect(() => {
    if (customer) {
      reset({
        diem_tra_hang: customer.diem_tra_hang,
        ten_khach_hang: customer.ten_khach_hang,
        tuyen_phuong: customer.tuyen_phuong ?? '',
        tuyen_cu: customer.tuyen_cu ?? '',
        dia_chi_giao_hang: customer.dia_chi_giao_hang ?? '',
        diem_giao_hang_tinh_phi: customer.diem_giao_hang_tinh_phi ?? '',
        boc_xep: customer.boc_xep,
        supplier_code: customer.supplier_code ?? '',
      });
    }
  }, [customer, reset]);

  const handleClose = () => {
    reset();
    onClose();
  };

  const onSubmit = async (values: FormValues) => {
    if (!customer) return;
    const data: CustomerData = {
      diem_tra_hang: values.diem_tra_hang,
      ten_khach_hang: values.ten_khach_hang,
      tuyen_phuong: values.tuyen_phuong || null,
      tuyen_cu: values.tuyen_cu || null,
      dia_chi_giao_hang: values.dia_chi_giao_hang || null,
      diem_giao_hang_tinh_phi: values.diem_giao_hang_tinh_phi?.trim() || null,
      boc_xep: values.boc_xep,
      supplier_code: values.supplier_code || null,
    };
    try {
      await updateCustomer.mutateAsync({ id: customer.id, data });
      reset();
      onSuccess(t('customers.edit.success'));
      onClose();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const e = err as { response?: { status?: number; data?: { message?: string } } };
        if (e.response?.status === 409) {
          onError(t('customers.errors.diemTraHangDuplicate'));
          return;
        }
        if (e.response?.status === 404) {
          onError(t('customers.errors.notFound'));
          return;
        }
      }
      onError(t('customers.errors.diemTraHangDuplicate'));
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t('customers.edit.title')} size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            {t('customers.fields.diemTraHang')} <span className="text-red-500">*</span>
          </label>
          <Input {...register('diem_tra_hang')} placeholder={t('customers.fields.diemTraHang')} />
          {errors.diem_tra_hang && (
            <p className="mt-1 text-xs text-red-500">{t(errors.diem_tra_hang.message || '')}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            {t('customers.fields.tenKhachHang')} <span className="text-red-500">*</span>
          </label>
          <Input {...register('ten_khach_hang')} placeholder={t('customers.fields.tenKhachHang')} />
          {errors.ten_khach_hang && (
            <p className="mt-1 text-xs text-red-500">{t(errors.ten_khach_hang.message || '')}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            {t('customers.fields.tuyenPhuong')}
          </label>
          <Input {...register('tuyen_phuong')} placeholder={t('customers.fields.tuyenPhuong')} />
        </div>

        <div>
          <label htmlFor="diem_giao_hang_tinh_phi_edit" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            {t('customers.fields.diemGiaoHangTinhPhi')}
          </label>
          <Input
            id="diem_giao_hang_tinh_phi_edit"
            autoComplete="off"
            {...register('diem_giao_hang_tinh_phi')}
            placeholder={t('customers.fields.diemGiaoHangTinhPhiPlaceholder')}
          />
          {errors.diem_giao_hang_tinh_phi && (
            <p className="mt-1 text-xs text-red-500">{t(errors.diem_giao_hang_tinh_phi.message || '')}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            {t('customers.fields.tuyenCu')}
          </label>
          <Input {...register('tuyen_cu')} placeholder={t('customers.fields.tuyenCu')} />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            {t('customers.fields.diaChiGiaoHang')}
          </label>
          <textarea
            {...register('dia_chi_giao_hang')}
            rows={2}
            placeholder={t('customers.fields.diaChiGiaoHang')}
            className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100 resize-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="boc_xep_edit"
            {...register('boc_xep')}
            className="w-4 h-4 rounded border-neutral-300 text-neutral-900"
          />
          <label htmlFor="boc_xep_edit" className="text-sm text-neutral-700 dark:text-neutral-300">
            {t('customers.fields.bocXep')}
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            {t('customers.fields.supplierCode')}
          </label>
          <Input {...register('supplier_code')} placeholder="VD: 2000000001" />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" type="button" onClick={handleClose}>
            Hủy
          </Button>
          <Button type="submit" isLoading={updateCustomer.isPending} disabled={!isValid || updateCustomer.isPending}>
            {t('customers.edit.submit')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
