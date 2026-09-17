import { useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Pagination } from '../../../components/ui/Pagination';
import { BangKeThoDropzone } from '../../../components/bang-ke-tho/BangKeThoDropzone';
import { BangKeThoTable } from '../../../components/bang-ke-tho/BangKeThoTable';
import { BangKeThoOverwriteDialog } from '../../../components/bang-ke-tho/BangKeThoOverwriteDialog';
import { BangKeThoDeleteDialog } from '../../../components/bang-ke-tho/BangKeThoDeleteDialog';
import { useBangKeThoBatches, useDeleteBangKeTho, useUploadBangKeTho } from '../../../hooks/useBangKeTho';
import { bangKeThoApi, type BangKeBatch } from '../../../api/bangKeThoApi';
import { useAuth } from '../../../hooks/useAuth';
import { useI18n } from '../../../i18n/useI18n';

interface Toast {
  id: number;
  message: string;
  variant: 'success' | 'error';
}

function apiMessage(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const status = err.response?.status;
    if (status === 403) return '';
    const data = err.response?.data as { message?: string } | undefined;
    if (data?.message) return data.message;
  }
  return fallback;
}

function isDuplicate(err: unknown): boolean {
  if (!isAxiosError(err)) return false;
  const data = err.response?.data as { data?: { code?: string } } | undefined;
  return err.response?.status === 409 && data?.data?.code === 'BANG_KE_DUPLICATE';
}

export function BangKeThoPage() {
  const { t } = useI18n();
  const { hasPermission, user } = useAuth();
  const canManage = hasPermission('accounting_data.manage') || user?.role === 'ADMIN';

  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const qParam = searchParams.get('q') || '';
  const [searchInput, setSearchInput] = useState(qParam);

  useEffect(() => {
    setSearchInput(qParam);
  }, [qParam]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const next = searchInput.trim();
      if (next === qParam) return;
      const params = new URLSearchParams(searchParams);
      if (next) params.set('q', next);
      else params.delete('q');
      params.set('page', '1');
      setSearchParams(params, { replace: true });
    }, 300);
    return () => window.clearTimeout(handle);
  }, [searchInput, qParam, searchParams, setSearchParams]);

  const { data, isLoading, isError, refetch, isFetching } = useBangKeThoBatches(page, qParam);
  const uploadMutation = useUploadBangKeTho();
  const deleteMutation = useDeleteBangKeTho();

  const [file, setFile] = useState<File | null>(null);
  const [overwriteOpen, setOverwriteOpen] = useState(false);
  const [deleteRow, setDeleteRow] = useState<BangKeBatch | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (message: string, variant: 'success' | 'error') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, variant }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 4000);
  };

  const setPage = (next: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(next));
    setSearchParams(params);
  };

  const handleUpload = async (overwrite: boolean) => {
    if (!file) return;
    try {
      await uploadMutation.mutateAsync({ file, overwrite });
      showToast(
        overwrite ? t('bangKeTho.message.success.overwrite') : t('bangKeTho.message.success.save'),
        'success',
      );
      setFile(null);
      setOverwriteOpen(false);
      setPage(1);
    } catch (err) {
      if (!overwrite && isDuplicate(err)) {
        setOverwriteOpen(true);
        return;
      }
      if (isAxiosError(err) && err.response?.status === 403) {
        showToast(t('bangKeTho.message.error.forbidden'), 'error');
        return;
      }
      showToast(apiMessage(err, t('bangKeTho.message.error.save')), 'error');
    }
  };

  const handleDownload = async (row: BangKeBatch) => {
    setDownloadingId(row.id);
    try {
      await bangKeThoApi.downloadInput(row.id, row.original_filename);
    } catch {
      showToast(t('bangKeTho.message.error.download'), 'error');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteRow) return;
    try {
      await deleteMutation.mutateAsync(deleteRow.id);
      showToast(t('bangKeTho.message.success.delete'), 'success');
      setDeleteRow(null);
      const remaining = (data?.data.length ?? 1) - 1;
      if (remaining <= 0 && page > 1) setPage(page - 1);
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 403) {
        showToast(t('bangKeTho.message.error.forbidden'), 'error');
        return;
      }
      showToast(apiMessage(err, t('bangKeTho.message.error.save')), 'error');
    }
  };

  const rows = data?.data ?? [];
  const total = data?.pagination.total ?? 0;
  const totalPages = data?.pagination.totalPages ?? 1;
  const showEmpty = !isLoading && !isError && total === 0 && !qParam;
  const showEmptySearch = !isLoading && !isError && total === 0 && !!qParam;

  return (
    <div className="p-6 space-y-6">
      <div aria-live="polite" className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={
              toast.variant === 'success'
                ? 'rounded-lg bg-green-600 text-white px-4 py-2 text-sm shadow'
                : 'rounded-lg bg-red-600 text-white px-4 py-2 text-sm shadow'
            }
          >
            {toast.message}
          </div>
        ))}
      </div>

      <div>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 text-pretty">
          {t('bangKeTho.title')}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">{t('bangKeTho.subtitle')}</p>
        <p className="text-sm text-neutral-500">{t('bangKeTho.subtitleHint')}</p>
      </div>

      {canManage && (
        <Card>
          <CardContent>
            <BangKeThoDropzone
              file={file}
              uploading={uploadMutation.isPending}
              onFile={setFile}
              onSave={() => handleUpload(false)}
              onInvalid={(msg) => showToast(msg, 'error')}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-4">
          <Input
            id="bang-ke-search"
            type="search"
            autoComplete="off"
            spellCheck={false}
            placeholder={t('bangKeTho.searchPlaceholder')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label={t('bangKeTho.searchPlaceholder')}
          />

          {isLoading && (
            <div className="space-y-2" aria-busy="true">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-800" />
              ))}
            </div>
          )}

          {isError && (
            <div className="py-8 text-center space-y-3">
              <p className="text-sm text-neutral-500">{t('bangKeTho.error')}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
                {t('bangKeTho.retry')}
              </Button>
            </div>
          )}

          {showEmpty && (
            <p className="py-8 text-center text-sm text-neutral-500">
              {t('bangKeTho.empty')}
              {canManage ? ` ${t('bangKeTho.emptyHintManage')}` : ''}
            </p>
          )}

          {showEmptySearch && (
            <p className="py-8 text-center text-sm text-neutral-500">
              {t('bangKeTho.emptySearch', { q: qParam })}
            </p>
          )}

          {!isLoading && !isError && rows.length > 0 && (
            <>
              <div className={isFetching ? 'opacity-70' : undefined}>
                <BangKeThoTable
                  rows={rows}
                  canManage={canManage}
                  downloadingId={downloadingId}
                  onDownload={handleDownload}
                  onDelete={setDeleteRow}
                />
              </div>
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={total}
                pageSize={20}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>

      <BangKeThoOverwriteDialog
        open={overwriteOpen}
        filename={file?.name ?? ''}
        submitting={uploadMutation.isPending}
        onClose={() => setOverwriteOpen(false)}
        onConfirm={() => handleUpload(true)}
      />
      <BangKeThoDeleteDialog
        open={!!deleteRow}
        filename={deleteRow?.original_filename ?? ''}
        submitting={deleteMutation.isPending}
        onClose={() => setDeleteRow(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
