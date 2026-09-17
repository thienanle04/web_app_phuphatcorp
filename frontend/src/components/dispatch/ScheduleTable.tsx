import { useState } from 'react';
import { Trash2, Pencil, Plus, MapPin, Scale, MessageSquare, FileSpreadsheet } from 'lucide-react';
import { useI18n } from '../../i18n/useI18n';
import { cn } from '../../utils/cn';
import type { DispatchSchedule } from '../../api/dispatchApi';

interface ScheduleTableProps {
  title: string;
  data: DispatchSchedule[];
  isLoading: boolean;
  onEdit: (schedule: DispatchSchedule) => void;
  onDelete: (id: number) => void;
  isDeleting: boolean;
  onAdd?: () => void;
  onImport?: () => void;
}

function SkeletonRow() {
  return (
    <tr>
      {[1, 2, 3, 4, 5].map((i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
        </td>
      ))}
    </tr>
  );
}

export function ScheduleTable({ title, data, isLoading, onEdit, onDelete, isDeleting, onAdd, onImport }: ScheduleTableProps) {
  const { t } = useI18n();
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleDelete = (id: number) => {
    setDeletingId(id);
    onDelete(id);
  };

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-xs">
      <div className="px-4 py-3.5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-800/30">
        <div className="flex items-center gap-2">
          <h2 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-neutral-100">{title}</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-200/70 dark:bg-neutral-700 font-semibold text-neutral-700 dark:text-neutral-300">
            {data.length}
          </span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          {onImport && (
            <button
              onClick={onImport}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:border-emerald-300 transition-colors shadow-2xs"
              title={t('dispatch.schedule.importExcel' as never) || 'Import Excel'}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="hidden sm:inline">{t('dispatch.schedule.importExcel' as never) || 'Import Excel'}</span>
            </button>
          )}
          {onAdd && (
            <button
              onClick={onAdd}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors shadow-2xs"
              title={t('dispatch.schedule.addTrip' as never)}
            >
              <Plus className="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-300" />
              <span className="hidden sm:inline">{t('dispatch.schedule.addTrip' as never)}</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Card List (< md) */}
      <div className="md:hidden">
        {isLoading && (
          <div className="p-4 space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-24 bg-neutral-100 dark:bg-neutral-800 rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && data.length === 0 && (
          <div className="px-4 py-8 text-center">
            <p className="text-neutral-500 dark:text-neutral-400 text-xs font-medium">
              {t('dispatch.schedule.emptyState' as never)}
            </p>
            <p className="text-neutral-400 dark:text-neutral-500 text-[11px] mt-0.5">
              {t('dispatch.schedule.emptyStateSub' as never)}
            </p>
          </div>
        )}

        {!isLoading && data.length > 0 && (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {data.map((row) => (
              <div key={row.id} className="p-3.5 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
                      {row.bien_so || 'Chưa gán xe'}
                    </span>
                    {row.tai_xe && (
                      <span className="text-xs text-neutral-500 dark:text-neutral-400 block mt-0.5">
                        Tài xế: <span className="font-medium text-neutral-700 dark:text-neutral-300">{row.tai_xe}</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => onEdit(row)}
                      className="p-2 rounded-lg text-neutral-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 dark:hover:text-blue-400 transition-colors"
                      title={t('dispatch.editModal.title' as never)}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(row.id)}
                      disabled={isDeleting && deletingId === row.id}
                      className={cn(
                        'p-2 rounded-lg text-neutral-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-colors',
                        isDeleting && deletingId === row.id && 'opacity-50 cursor-not-allowed',
                      )}
                      title={t('dispatch.deleteModal.title' as never)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1.5 col-span-2 text-neutral-700 dark:text-neutral-300">
                    <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                    <span className="font-medium truncate">{row.diem_nhan}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400">
                    <Scale className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                    <span>Tấn: <strong className="text-neutral-800 dark:text-neutral-200">{row.tan || '—'}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400">
                    <span>Cán: <strong className="text-neutral-800 dark:text-neutral-200">{row.can || '—'}</strong></span>
                  </div>
                  {row.ghi_chu && (
                    <div className="flex items-start gap-1.5 col-span-2 text-neutral-500 text-[11px] bg-neutral-50 dark:bg-neutral-800/50 p-2 rounded-lg">
                      <MessageSquare className="w-3 h-3 text-neutral-400 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{row.ghi_chu}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Desktop Table (>= md) */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50">
              <th className="text-left px-4 py-2.5 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase whitespace-nowrap">
                {t('dispatch.schedule.columns.bienSo' as never)}
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase whitespace-nowrap">
                {t('dispatch.schedule.columns.diemNhan' as never)}
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase whitespace-nowrap">
                {t('dispatch.schedule.columns.tan' as never)}
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase whitespace-nowrap">
                {t('dispatch.schedule.columns.can' as never)}
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase whitespace-nowrap">
                {t('dispatch.schedule.columns.ghiChu' as never)}
              </th>
              <th className="w-20 text-center" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </>
            )}
            {!isLoading && data.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center">
                  <p className="text-neutral-500 dark:text-neutral-400 text-sm">
                    {t('dispatch.schedule.emptyState' as never)}
                  </p>
                  <p className="text-neutral-400 dark:text-neutral-500 text-xs mt-1">
                    {t('dispatch.schedule.emptyStateSub' as never)}
                  </p>
                </td>
              </tr>
            )}
            {!isLoading &&
              data.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-colors group"
                >
                  <td className="px-4 py-3 text-neutral-900 dark:text-neutral-100 font-semibold whitespace-nowrap">
                    {row.bien_so || '—'}
                  </td>
                  <td className="px-4 py-3 text-neutral-800 dark:text-neutral-200">{row.diem_nhan}</td>
                  <td className="px-4 py-3 text-neutral-800 dark:text-neutral-200 whitespace-nowrap">{row.tan || '—'}</td>
                  <td className="px-4 py-3 text-neutral-800 dark:text-neutral-200 whitespace-nowrap">{row.can || '—'}</td>
                  <td className="px-4 py-3 text-neutral-500 dark:text-neutral-400 max-w-[150px] truncate" title={row.ghi_chu || undefined}>
                    {row.ghi_chu || '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => onEdit(row)}
                        className={cn(
                          'p-1.5 rounded-lg transition-colors opacity-80 group-hover:opacity-100',
                          'text-neutral-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 dark:hover:text-blue-400',
                        )}
                        title={t('dispatch.editModal.title' as never)}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(row.id)}
                        disabled={isDeleting && deletingId === row.id}
                        className={cn(
                          'p-1.5 rounded-lg transition-colors opacity-80 group-hover:opacity-100',
                          'text-neutral-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 dark:hover:text-red-400',
                          isDeleting && deletingId === row.id && 'opacity-50 cursor-not-allowed',
                        )}
                        title={t('dispatch.deleteModal.title' as never)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
