import { Pencil, Trash2 } from 'lucide-react';
import { Pagination } from '../ui/Pagination';
import { DataGrid, DataGridTip, formatDataGridValue } from '../ui/DataGrid';
import type { DataGridColumn } from '../ui/DataGrid';
import { useI18n } from '../../i18n/useI18n';
import type { Customer } from '../../api/customersApi';

interface CustomersTableProps {
  rows: Customer[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  canManage: boolean;
  onPageChange: (page: number) => void;
  onEdit: (row: Customer) => void;
  onDelete: (row: Customer) => void;
}

export function CustomersTable({
  rows,
  page,
  pageSize,
  totalItems,
  totalPages,
  canManage,
  onPageChange,
  onEdit,
  onDelete,
}: CustomersTableProps) {
  const { t } = useI18n();

  const columns: DataGridColumn<Customer>[] = [
    {
      id: 'stt',
      header: t('customers.columns.stt'),
      pin: true,
      numeric: true,
      width: 56,
      className: 'text-neutral-500 dark:text-neutral-400',
      cell: (_row, { index }) => (page - 1) * pageSize + index + 1,
    },
    {
      id: 'diemTraHang',
      header: t('customers.columns.diemTraHang'),
      pin: true,
      width: 250,
      className: 'font-medium',
      accessor: (row) => row.diem_tra_hang,
    },
    {
      id: 'tuyenPhuong',
      header: t('customers.columns.tuyenPhuong'),
      minWidth: 192,
      maxWidth: 256,
      hiddenClassName: 'hidden md:table-cell',
      className: 'text-neutral-600 dark:text-neutral-400',
      accessor: (row) => row.tuyen_phuong,
    },
    {
      id: 'diemGiaoHangTinhPhi',
      header: t('customers.columns.diemGiaoHangTinhPhi'),
      minWidth: 192,
      maxWidth: 256,
      hiddenClassName: 'hidden md:table-cell',
      className: 'text-neutral-600 dark:text-neutral-400',
      accessor: (row) => row.diem_giao_hang_tinh_phi,
    },
    {
      id: 'tenKhachHang',
      header: t('customers.columns.tenKhachHang'),
      minWidth: 256,
      className: 'text-neutral-700 dark:text-neutral-300',
      accessor: (row) => row.ten_khach_hang,
    },
    {
      id: 'nhaCungCap',
      header: t('customers.columns.nhaCungCap'),
      maxWidth: 220,
      hiddenClassName: 'hidden lg:table-cell',
      className: 'text-neutral-600 dark:text-neutral-400',
      cell: (row) => {
        if (!row.supplier) return formatDataGridValue(null);
        const name = formatDataGridValue(row.supplier.name);
        return (
          <DataGridTip
            text={`${row.supplier.name} (${row.supplier.supplier_code})`}
            className="block truncate"
          >
            {name}
          </DataGridTip>
        );
      },
    },
  ];

  if (canManage) {
    columns.push({
      id: 'actions',
      header: t('customers.columns.actions'),
      width: 96,
      truncate: false,
      cell: (row) => (
        <div className="flex h-full items-center gap-0.5">
          <DataGridTip text={t('customers.actions.edit')} className="inline-flex">
            <button
              type="button"
              onClick={() => onEdit(row)}
              className="inline-flex size-8 cursor-pointer items-center justify-center rounded text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 dark:text-neutral-500 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
              aria-label={t('customers.actions.edit')}
            >
              <Pencil className="size-[16px]" />
            </button>
          </DataGridTip>
          <DataGridTip text={t('customers.actions.delete')} className="inline-flex">
            <button
              type="button"
              onClick={() => onDelete(row)}
              className="inline-flex size-8 cursor-pointer items-center justify-center rounded text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-neutral-500 dark:hover:bg-red-900/20 dark:hover:text-red-400"
              aria-label={t('customers.actions.delete')}
            >
              <Trash2 className="size-[16px]" />
            </button>
          </DataGridTip>
        </div>
      ),
    });
  }

  return (
    <DataGrid
      columns={columns}
      rows={rows}
      getRowId={(row) => row.id}
      minWidth={1080}
      footer={
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={onPageChange}
        />
      }
    />
  );
}
