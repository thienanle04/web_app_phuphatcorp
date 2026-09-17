import { useState } from 'react';
import { Plus, Calendar, RefreshCw, Car, Truck, Navigation } from 'lucide-react';
import { useI18n } from '../../i18n/useI18n';
import { Button } from '../../components/ui/Button';
import { DateInput } from '../../components/ui/DateInput';
import { cn } from '../../utils/cn';
import { ScheduleTable } from '../../components/dispatch/ScheduleTable';
import { OutsideRouteTable } from '../../components/dispatch/OutsideRouteTable';
import { CreateScheduleModal } from '../../components/dispatch/CreateScheduleModal';
import { EditScheduleModal } from '../../components/dispatch/EditScheduleModal';
import { ImportDispatchExcelModal } from '../../components/dispatch/ImportDispatchExcelModal';
import {
  useDispatchSchedules,
  useBatchCreateDispatchSchedule,
  useUpdateDispatchSchedule,
  useDeleteDispatchSchedule,
} from '../../hooks/useDispatchSchedules';
import type { CreateDispatchScheduleBatchItem, UpdateDispatchScheduleRequest, DispatchSchedule } from '../../api/dispatchApi';

type LoaiTuyen = 'Tuyến cố định' | 'Tuyến ngoài';
type LoaiXe = 'Xe lớn' | 'Xe nhỏ';
type DispatchTab = 'xe_nho' | 'xe_lon' | 'tuyen_ngoai';

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

export function SchedulePage() {
  const { t } = useI18n();
  const [selectedDate, setSelectedDate] = useState(todayISO);
  const [activeTab, setActiveTab] = useState<DispatchTab>('xe_nho');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importContext, setImportContext] = useState<{ loaiTuyen: LoaiTuyen; loaiXe?: LoaiXe }>({
    loaiTuyen: 'Tuyến cố định',
    loaiXe: 'Xe nhỏ',
  });
  const [editingSchedule, setEditingSchedule] = useState<DispatchSchedule | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [presetLoaiTuyen, setPresetLoaiTuyen] = useState<LoaiTuyen | undefined>();
  const [presetLoaiXe, setPresetLoaiXe] = useState<LoaiXe | undefined>();

  const { data, isLoading, isError, refetch } = useDispatchSchedules(selectedDate);
  const batchCreateSchedule = useBatchCreateDispatchSchedule();
  const updateSchedule = useUpdateDispatchSchedule();
  const deleteSchedule = useDeleteDispatchSchedule();

  const showToast = (msg: string, isError = false) => {
    if (isError) {
      setDeleteError(msg);
      setTimeout(() => setDeleteError(null), 3000);
    } else {
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  };

  const handleAddXeNho = () => {
    setPresetLoaiTuyen('Tuyến cố định');
    setPresetLoaiXe('Xe nhỏ');
    setIsCreateOpen(true);
  };

  const handleAddXeLon = () => {
    setPresetLoaiTuyen('Tuyến cố định');
    setPresetLoaiXe('Xe lớn');
    setIsCreateOpen(true);
  };

  const handleAddTuyenNgoai = () => {
    setPresetLoaiTuyen('Tuyến ngoài');
    setPresetLoaiXe(undefined);
    setIsCreateOpen(true);
  };

  const handleImportXeNho = () => {
    setImportContext({ loaiTuyen: 'Tuyến cố định', loaiXe: 'Xe nhỏ' });
    setIsImportOpen(true);
  };

  const handleImportXeLon = () => {
    setImportContext({ loaiTuyen: 'Tuyến cố định', loaiXe: 'Xe lớn' });
    setIsImportOpen(true);
  };

  const handleImportTuyenNgoai = () => {
    setImportContext({ loaiTuyen: 'Tuyến ngoài', loaiXe: 'Xe nhỏ' });
    setIsImportOpen(true);
  };

  const handleImportSubmit = async (items: CreateDispatchScheduleBatchItem[]) => {
    try {
      await batchCreateSchedule.mutateAsync({ items, date: selectedDate });
      showToast(
        t('dispatch.schedule.importSuccess', { count: items.length } as never) ||
          `Import thành công ${items.length} chuyến xe`,
      );
    } catch {
      showToast(t('dispatch.schedule.importError' as never) || 'Import thất bại. Vui lòng thử lại', true);
    }
  };

  const handleGlobalAdd = () => {
    setPresetLoaiTuyen(undefined);
    setPresetLoaiXe(undefined);
    setIsCreateOpen(true);
  };

  const handleCreate = async (items: CreateDispatchScheduleBatchItem[]) => {
    try {
      setCreateError(null);
      await batchCreateSchedule.mutateAsync({ items, date: selectedDate });
      setIsCreateOpen(false);
      showToast(t('dispatch.createModal.createSuccess' as never));
    } catch {
      setCreateError(t('dispatch.createModal.createError' as never));
    }
  };

  const handleEdit = (schedule: DispatchSchedule) => {
    setEditingSchedule(schedule);
  };

  const handleEditClose = () => {
    setEditingSchedule(null);
  };

  const handleEditSubmit = async (id: number, data: UpdateDispatchScheduleRequest) => {
    await updateSchedule.mutateAsync(
      { id, data, date: selectedDate },
      {
        onSuccess: () => {
          setEditingSchedule(null);
          showToast(t('dispatch.editModal.updateSuccess' as never));
        },
        onError: () => {
          showToast(t('dispatch.editModal.updateError' as never), true);
        },
      },
    );
  };

  const handleDelete = (id: number) => {
    deleteSchedule.mutate(
      { id, date: selectedDate },
      {
        onSuccess: () => showToast(t('dispatch.deleteModal.deleteSuccess' as never)),
        onError: () => showToast(t('dispatch.deleteModal.deleteError' as never), true),
      },
    );
  };

  const totalXeNho = data?.xe_nho?.length || 0;
  const totalXeLon = data?.xe_lon?.length || 0;
  const totalTuyenNgoai = data?.tuyen_ngoai?.length || 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 w-full">
      {/* Responsive Header & Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            {t('dispatch.schedule.title' as never)}
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
            Lịch trình điều phối xe theo ngày cho các tuyến cố định và tuyến ngoài
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <DateInput
              value={selectedDate}
              onChange={(value) => setSelectedDate(value)}
              className="w-full sm:w-44 px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 text-base sm:text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 outline-none focus:border-neutral-500 dark:focus:border-neutral-400 transition-colors h-11 sm:h-10"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedDate(todayISO())}
              className="whitespace-nowrap h-11 sm:h-10 px-3 text-xs sm:text-sm font-medium"
              title="Về hôm nay"
            >
              <Calendar className="w-4 h-4 mr-1 sm:mr-1.5" />
              Hôm nay
            </Button>
          </div>

          <Button
            onClick={handleGlobalAdd}
            className="w-full sm:w-auto h-11 sm:h-10 text-sm font-medium justify-center"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            {t('dispatch.schedule.createTrip' as never)}
          </Button>
        </div>
      </div>

      {/* Toast notifications */}
      {successMsg && (
        <div className="p-3.5 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800/80 rounded-xl text-xs sm:text-sm text-green-800 dark:text-green-300 font-medium">
          {successMsg}
        </div>
      )}
      {deleteError && (
        <div className="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/80 rounded-xl text-xs sm:text-sm text-red-800 dark:text-red-300 font-medium">
          {deleteError}
        </div>
      )}

      {/* Tabs Navigation Switcher */}
      <div className="flex items-center gap-1 sm:gap-2 border-b border-neutral-200 dark:border-neutral-800 overflow-x-auto scrollbar-none pt-1">
        <button
          type="button"
          onClick={() => setActiveTab('xe_nho')}
          className={cn(
            'flex items-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap',
            activeTab === 'xe_nho'
              ? 'border-neutral-900 dark:border-neutral-100 text-neutral-900 dark:text-neutral-100'
              : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200'
          )}
        >
          <Car className="w-4 h-4 text-sky-500" />
          <span>{t('dispatch.schedule.tableXeNho' as never) || 'Xe nhỏ'}</span>
          <span
            className={cn(
              'text-xs px-2 py-0.5 rounded-full font-bold',
              activeTab === 'xe_nho'
                ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
            )}
          >
            {totalXeNho}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('xe_lon')}
          className={cn(
            'flex items-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap',
            activeTab === 'xe_lon'
              ? 'border-neutral-900 dark:border-neutral-100 text-neutral-900 dark:text-neutral-100'
              : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200'
          )}
        >
          <Truck className="w-4 h-4 text-amber-500" />
          <span>{t('dispatch.schedule.tableXeLon' as never) || 'Xe lớn'}</span>
          <span
            className={cn(
              'text-xs px-2 py-0.5 rounded-full font-bold',
              activeTab === 'xe_lon'
                ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
            )}
          >
            {totalXeLon}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('tuyen_ngoai')}
          className={cn(
            'flex items-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap',
            activeTab === 'tuyen_ngoai'
              ? 'border-neutral-900 dark:border-neutral-100 text-neutral-900 dark:text-neutral-100'
              : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200'
          )}
        >
          <Navigation className="w-4 h-4 text-emerald-500" />
          <span>{t('dispatch.schedule.tableTuyenNgoai' as never) || 'Lịch ngoài tuyến'}</span>
          <span
            className={cn(
              'text-xs px-2 py-0.5 rounded-full font-bold',
              activeTab === 'tuyen_ngoai'
                ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
            )}
          >
            {totalTuyenNgoai}
          </span>
        </button>
      </div>

      {/* Error state */}
      {isError && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <p className="text-neutral-500 dark:text-neutral-400 text-sm">
            {t('dispatch.schedule.loadError' as never)}
          </p>
          <Button variant="outline" onClick={() => refetch()} className="h-11 sm:h-10 min-h-[44px]">
            <RefreshCw className="mr-2 h-4 w-4" />
            {t('dispatch.schedule.retry' as never)}
          </Button>
        </div>
      )}

      {/* Tab Content Display */}
      {!isError && (
        <div>
          {activeTab === 'xe_nho' && (
            <ScheduleTable
              title={t('dispatch.schedule.tableXeNho' as never)}
              data={data?.xe_nho ?? []}
              isLoading={isLoading}
              onEdit={handleEdit}
              onDelete={handleDelete}
              isDeleting={deleteSchedule.isPending}
              onAdd={handleAddXeNho}
              onImport={handleImportXeNho}
            />
          )}
          {activeTab === 'xe_lon' && (
            <ScheduleTable
              title={t('dispatch.schedule.tableXeLon' as never)}
              data={data?.xe_lon ?? []}
              isLoading={isLoading}
              onEdit={handleEdit}
              onDelete={handleDelete}
              isDeleting={deleteSchedule.isPending}
              onAdd={handleAddXeLon}
              onImport={handleImportXeLon}
            />
          )}
          {activeTab === 'tuyen_ngoai' && (
            <OutsideRouteTable
              title={t('dispatch.schedule.tableTuyenNgoai' as never)}
              data={data?.tuyen_ngoai ?? []}
              isLoading={isLoading}
              onEdit={handleEdit}
              onDelete={handleDelete}
              isDeleting={deleteSchedule.isPending}
              onAdd={handleAddTuyenNgoai}
              onImport={handleImportTuyenNgoai}
            />
          )}
        </div>
      )}

      {/* Import Excel modal */}
      <ImportDispatchExcelModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        selectedDate={selectedDate}
        loaiTuyen={importContext.loaiTuyen}
        loaiXe={importContext.loaiXe}
        onSubmit={handleImportSubmit}
        isSubmitting={batchCreateSchedule.isPending}
      />

      {/* Create modal */}
      <CreateScheduleModal
        isOpen={isCreateOpen}
        onClose={() => {
          setIsCreateOpen(false);
          setCreateError(null);
        }}
        selectedDate={selectedDate}
        onSubmit={handleCreate}
        isSubmitting={batchCreateSchedule.isPending}
        presetLoaiTuyen={presetLoaiTuyen}
        presetLoaiXe={presetLoaiXe}
      />
      {createError && (
        <div className="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/80 rounded-xl text-xs sm:text-sm text-red-800 dark:text-red-300 font-medium">
          {createError}
        </div>
      )}

      {/* Edit modal */}
      <EditScheduleModal
        isOpen={editingSchedule !== null}
        onClose={handleEditClose}
        schedule={editingSchedule}
        onSubmit={handleEditSubmit}
        isSubmitting={updateSchedule.isPending}
      />
    </div>
  );
}
