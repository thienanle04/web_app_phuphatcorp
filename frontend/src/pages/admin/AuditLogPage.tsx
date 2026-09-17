import { useState } from 'react';
import { FileText, ChevronDown, ChevronRight, AlertTriangle, XCircle } from 'lucide-react';
import { cn } from '../../utils/cn';
import { DateInput } from '../../components/ui/DateInput';
import { useAccessLogs, useAuditLogs } from '../../hooks/useAuditLogs';
import type { AccessLogFilters, AuditLogFilters, AccessLog, AuditLog } from '../../api/auditLogApi';
import { useUsers } from '../../hooks/useUsers';
import { useI18n } from '../../i18n/useI18n';

type Tab = 'access' | 'audit';

const STATUS_COLORS: Record<string, string> = {
  '2': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  '3': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  '4': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  '5': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const STATUS_LABELS: Record<number, string> = {
  200: '200 OK',
  201: '201 Created',
  400: '400 Bad Request',
  401: '401 Unauthorized',
  403: '403 Forbidden',
  404: '404 Not Found',
  409: '409 Conflict',
  422: '422 Unprocessable',
  500: '500 Server Error',
};

const ACTION_COLORS: Record<string, string> = {
  LOGIN: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  LOGOUT: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400',
  CREATE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  UPDATE: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  DELETE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  UPLOAD: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  IMPORT: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  TOGGLE: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  TRIGGER: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  UPDATE_PERMISSIONS: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
};

const ACTION_LABELS: Record<string, string> = {
  LOGIN: 'Đăng nhập',
  LOGOUT: 'Đăng xuất',
  CREATE: 'Tạo mới',
  UPDATE: 'Cập nhật',
  DELETE: 'Xóa',
  UPLOAD: 'Upload',
  IMPORT: 'Import',
  TOGGLE: 'Bật/Tắt',
  TRIGGER: 'Kích hoạt',
  UPDATE_PERMISSIONS: 'Cập nhật quyền',
};

const ENTITY_LABELS: Record<string, string> = {
  auth: 'Xác thực',
  user: 'Người dùng',
  role: 'Vai trò',
  permission: 'Quyền',
  driver_invoice: 'HĐ tài xế',
  customer: 'Khách hàng',
  supplier: 'Nhà cung cấp',
  vehicle: 'Phương tiện',
  weight_adjustment: 'Điều chỉnh TL',
  batch: 'Batch dữ liệu',
  dispatch_schedule: 'Điều phối',
  job: 'Job đối chiếu',
};

function getStatusColor(statusCode: number): string {
  const prefix = String(statusCode)[0];
  return STATUS_COLORS[prefix] || 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400';
}

function getStatusLabel(statusCode: number): string {
  return STATUS_LABELS[statusCode] || String(statusCode);
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AuditLogPage() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<Tab>('access');

  const [accessFilters, setAccessFilters] = useState<AccessLogFilters>({ page: 1, limit: 50 });
  const [auditFilters, setAuditFilters] = useState<AuditLogFilters>({ page: 1, limit: 50 });
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const [draftAccessFilters, setDraftAccessFilters] = useState<AccessLogFilters>({ page: 1, limit: 50 });
  const [draftAuditFilters, setDraftAuditFilters] = useState<AuditLogFilters>({ page: 1, limit: 50 });

  const { data: usersData } = useUsers({ limit: 100 });
  const users = usersData?.data || [];

  const { data: accessData, isLoading: accessLoading, isError: accessError, refetch: refetchAccess } = useAccessLogs(accessFilters);
  const { data: auditData, isLoading: auditLoading, isError: auditError, refetch: refetchAudit } = useAuditLogs(auditFilters);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setExpandedRows(new Set());
  };

  const handleAccessSearch = () => {
    setAccessFilters({ ...draftAccessFilters, page: 1 });
  };

  const handleAuditSearch = () => {
    setAuditFilters({ ...draftAuditFilters, page: 1 });
    setExpandedRows(new Set());
  };

  const handleAccessPageChange = (page: number) => {
    setAccessFilters({ ...accessFilters, page });
  };

  const handleAuditPageChange = (page: number) => {
    setAuditFilters({ ...auditFilters, page });
    setExpandedRows(new Set());
  };

  const toggleExpand = (id: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearAccessFilters = () => {
    const empty: AccessLogFilters = { page: 1, limit: 50 };
    setDraftAccessFilters(empty);
    setAccessFilters(empty);
  };

  const clearAuditFilters = () => {
    const empty: AuditLogFilters = { page: 1, limit: 50 };
    setDraftAuditFilters(empty);
    setAuditFilters(empty);
  };

  const renderSkeleton = () => (
    <div className="animate-pulse">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-4 px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
          <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-28" />
          <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-20" />
          <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-16" />
          <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-40" />
          <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-16" />
          <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-24" />
          <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-16" />
        </div>
      ))}
    </div>
  );

  return (
    <div className="p-6 max-w-full">
      <div className="flex items-center gap-3 mb-6">
        <FileText className="w-7 h-7 text-neutral-700 dark:text-neutral-300" />
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
          {t('auditLog.title' as never) || 'Nhật ký hệ thống'}
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-neutral-200 dark:border-neutral-800 mb-6">
        <button
          onClick={() => handleTabChange('access')}
          className={cn(
            'px-4 py-3 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'access'
              ? 'border-neutral-900 dark:border-neutral-100 text-neutral-900 dark:text-neutral-100'
              : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300',
          )}
        >
          {t('auditLog.tabs.access' as never) || 'Nhật ký truy cập'}
        </button>
        <button
          onClick={() => handleTabChange('audit')}
          className={cn(
            'px-4 py-3 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'audit'
              ? 'border-neutral-900 dark:border-neutral-100 text-neutral-900 dark:text-neutral-100'
              : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300',
          )}
        >
          {t('auditLog.tabs.audit' as never) || 'Nhật ký thao tác'}
        </button>
      </div>

      {/* Access Logs Tab */}
      {activeTab === 'access' && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-neutral-500 dark:text-neutral-400">
                {t('auditLog.filters.user' as never)}
              </label>
              <select
                className="px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-sm text-neutral-900 dark:text-neutral-100"
                value={draftAccessFilters.userId || ''}
                onChange={(e) => setDraftAccessFilters({ ...draftAccessFilters, userId: e.target.value ? Number(e.target.value) : undefined })}
              >
                <option value="">{t('auditLog.filters.allUsers' as never)}</option>
                {users.map((u: any) => (
                  <option key={u.id} value={u.id}>{u.full_name || u.username}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-neutral-500 dark:text-neutral-400">
                {t('auditLog.filters.method' as never)}
              </label>
              <select
                className="px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-sm text-neutral-900 dark:text-neutral-100"
                value={draftAccessFilters.method || ''}
                onChange={(e) => setDraftAccessFilters({ ...draftAccessFilters, method: e.target.value || undefined })}
              >
                <option value="">{t('auditLog.filters.allMethods' as never)}</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
                <option value="PATCH">PATCH</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-neutral-500 dark:text-neutral-400">
                {t('auditLog.filters.path' as never)}
              </label>
              <input
                type="text"
                className="px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-sm text-neutral-900 dark:text-neutral-100 w-48"
                placeholder="/api/..."
                value={draftAccessFilters.path || ''}
                onChange={(e) => setDraftAccessFilters({ ...draftAccessFilters, path: e.target.value || undefined })}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-neutral-500 dark:text-neutral-400">
                {t('auditLog.filters.status' as never)}
              </label>
              <select
                className="px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-sm text-neutral-900 dark:text-neutral-100"
                value={draftAccessFilters.statusCode || ''}
                onChange={(e) => setDraftAccessFilters({ ...draftAccessFilters, statusCode: e.target.value ? Number(e.target.value) : undefined })}
              >
                <option value="">{t('auditLog.filters.allStatuses' as never)}</option>
                <option value="200">200 OK</option>
                <option value="201">201 Created</option>
                <option value="400">400 Bad Request</option>
                <option value="401">401 Unauthorized</option>
                <option value="403">403 Forbidden</option>
                <option value="404">404 Not Found</option>
                <option value="409">409 Conflict</option>
                <option value="500">500 Server Error</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-neutral-500 dark:text-neutral-400">
                {t('auditLog.filters.dateFrom' as never)}
              </label>
              <DateInput
                value={draftAccessFilters.dateFrom || ''}
                onChange={(newValue) => setDraftAccessFilters({ ...draftAccessFilters, dateFrom: newValue || undefined })}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-neutral-500 dark:text-neutral-400">
                {t('auditLog.filters.dateTo' as never)}
              </label>
              <DateInput
                value={draftAccessFilters.dateTo || ''}
                onChange={(newValue) => setDraftAccessFilters({ ...draftAccessFilters, dateTo: newValue || undefined })}
              />
            </div>

            <button
              onClick={handleAccessSearch}
              disabled={accessLoading}
              className="px-4 py-2 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-lg text-sm font-medium hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors disabled:opacity-50"
            >
              {t('auditLog.filters.search' as never) || 'Tìm kiếm'}
            </button>
          </div>

          {/* Results */}
          {accessLoading ? (
            renderSkeleton()
          ) : accessError ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertTriangle className="w-12 h-12 text-red-400 mb-3" />
              <p className="text-neutral-600 dark:text-neutral-400 mb-2">
                {t('auditLog.error.load' as never)}
              </p>
              <button
                onClick={() => refetchAccess()}
                className="px-4 py-2 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-lg text-sm font-medium hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
              >
                {t('auditLog.error.retry' as never)}
              </button>
            </div>
          ) : !accessData || accessData.data.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <XCircle className="w-12 h-12 text-neutral-300 dark:text-neutral-600 mb-3" />
              <p className="text-neutral-500 dark:text-neutral-400">
                {Object.keys(accessFilters).some(k => k !== 'page' && k !== 'limit' && (accessFilters as any)[k])
                  ? (t('auditLog.empty.noResults' as never))
                  : (t('auditLog.empty.default' as never))}
              </p>
              {Object.keys(accessFilters).some(k => k !== 'page' && k !== 'limit' && (accessFilters as any)[k]) && (
                <button
                  onClick={clearAccessFilters}
                  className="mt-3 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {t('auditLog.filters.clearFilters' as never)}
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Table */}
              <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-800 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 dark:bg-neutral-900">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-400">
                        {t('auditLog.columns.time' as never)}
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-400">
                        {t('auditLog.columns.user' as never)}
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-400">
                        {t('auditLog.columns.method' as never)}
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-400">
                        {t('auditLog.columns.path' as never)}
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-400">
                        {t('auditLog.columns.status' as never)}
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-400">
                        {t('auditLog.columns.ip' as never)}
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-400">
                        {t('auditLog.columns.responseTime' as never)}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {accessData.data.map((row: AccessLog) => (
                      <tr key={row.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/50">
                        <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400 whitespace-nowrap text-xs">
                          {formatTime(row.created_at)}
                        </td>
                        <td className="px-4 py-3 text-neutral-900 dark:text-neutral-100 whitespace-nowrap">
                          {row.user_name || (row.user_id ? `#${row.user_id}` : '—')}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            {row.method}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400 max-w-xs truncate font-mono text-xs">
                          {row.path}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium', getStatusColor(row.status_code))}>
                            {getStatusLabel(row.status_code)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400 font-mono text-xs">
                          {row.ip_address || '—'}
                        </td>
                        <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                          {row.response_time_ms !== null ? `${row.response_time_ms}ms` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {accessData.meta && accessData.meta.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    {`Hiển thị ${((accessData.meta.page - 1) * accessData.meta.limit) + 1}-${Math.min(accessData.meta.page * accessData.meta.limit, accessData.meta.total)} của ${accessData.meta.total}`}
                  </p>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleAccessPageChange(accessData.meta.page - 1)}
                      disabled={accessData.meta.page <= 1}
                      className="px-3 py-1.5 text-sm border border-neutral-300 dark:border-neutral-700 rounded-lg disabled:opacity-40 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                    >
                      ‹
                    </button>
                    {Array.from({ length: Math.min(accessData.meta.totalPages, 7) }).map((_, i) => {
                      const startPage = Math.max(1, Math.min(accessData.meta.page - 3, accessData.meta.totalPages - 6));
                      const pageNum = startPage + i;
                      if (pageNum > accessData.meta.totalPages) return null;
                      return (
                        <button
                          key={pageNum}
                          onClick={() => handleAccessPageChange(pageNum)}
                          className={cn(
                            'px-3 py-1.5 text-sm border rounded-lg',
                            pageNum === accessData.meta.page
                              ? 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 border-neutral-900 dark:border-neutral-100'
                              : 'border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-900 dark:text-neutral-100',
                          )}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => handleAccessPageChange(accessData.meta.page + 1)}
                      disabled={accessData.meta.page >= accessData.meta.totalPages}
                      className="px-3 py-1.5 text-sm border border-neutral-300 dark:border-neutral-700 rounded-lg disabled:opacity-40 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                    >
                      ›
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Audit Logs Tab */}
      {activeTab === 'audit' && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-neutral-500 dark:text-neutral-400">
                {t('auditLog.filters.user' as never)}
              </label>
              <select
                className="px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-sm text-neutral-900 dark:text-neutral-100"
                value={draftAuditFilters.userId || ''}
                onChange={(e) => setDraftAuditFilters({ ...draftAuditFilters, userId: e.target.value ? Number(e.target.value) : undefined })}
              >
                <option value="">{t('auditLog.filters.allUsers' as never)}</option>
                {users.map((u: any) => (
                  <option key={u.id} value={u.id}>{u.full_name || u.username}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-neutral-500 dark:text-neutral-400">
                {t('auditLog.filters.action' as never)}
              </label>
              <select
                className="px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-sm text-neutral-900 dark:text-neutral-100"
                value={draftAuditFilters.action || ''}
                onChange={(e) => setDraftAuditFilters({ ...draftAuditFilters, action: e.target.value || undefined })}
              >
                <option value="">{t('auditLog.filters.allActions' as never)}</option>
                {Object.entries(ACTION_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-neutral-500 dark:text-neutral-400">
                {t('auditLog.filters.entityType' as never)}
              </label>
              <select
                className="px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-sm text-neutral-900 dark:text-neutral-100"
                value={draftAuditFilters.entityType || ''}
                onChange={(e) => setDraftAuditFilters({ ...draftAuditFilters, entityType: e.target.value || undefined })}
              >
                <option value="">{t('auditLog.filters.allEntities' as never)}</option>
                {Object.entries(ENTITY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-neutral-500 dark:text-neutral-400">
                {t('auditLog.filters.dateFrom' as never)}
              </label>
              <DateInput
                value={draftAuditFilters.dateFrom || ''}
                onChange={(newValue) => setDraftAuditFilters({ ...draftAuditFilters, dateFrom: newValue || undefined })}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-neutral-500 dark:text-neutral-400">
                {t('auditLog.filters.dateTo' as never)}
              </label>
              <DateInput
                value={draftAuditFilters.dateTo || ''}
                onChange={(newValue) => setDraftAuditFilters({ ...draftAuditFilters, dateTo: newValue || undefined })}
              />
            </div>

            <button
              onClick={handleAuditSearch}
              disabled={auditLoading}
              className="px-4 py-2 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-lg text-sm font-medium hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors disabled:opacity-50"
            >
              {t('auditLog.filters.search' as never) || 'Tìm kiếm'}
            </button>
          </div>

          {/* Results */}
          {auditLoading ? (
            renderSkeleton()
          ) : auditError ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertTriangle className="w-12 h-12 text-red-400 mb-3" />
              <p className="text-neutral-600 dark:text-neutral-400 mb-2">
                {t('auditLog.error.load' as never)}
              </p>
              <button
                onClick={() => refetchAudit()}
                className="px-4 py-2 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-lg text-sm font-medium hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
              >
                {t('auditLog.error.retry' as never)}
              </button>
            </div>
          ) : !auditData || auditData.data.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <XCircle className="w-12 h-12 text-neutral-300 dark:text-neutral-600 mb-3" />
              <p className="text-neutral-500 dark:text-neutral-400">
                {Object.keys(auditFilters).some(k => k !== 'page' && k !== 'limit' && (auditFilters as any)[k])
                  ? (t('auditLog.empty.noResults' as never))
                  : (t('auditLog.empty.default' as never))}
              </p>
              {Object.keys(auditFilters).some(k => k !== 'page' && k !== 'limit' && (auditFilters as any)[k]) && (
                <button
                  onClick={clearAuditFilters}
                  className="mt-3 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {t('auditLog.filters.clearFilters' as never)}
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Table */}
              <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-800 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 dark:bg-neutral-900">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-400 w-8" />
                      <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-400">
                        {t('auditLog.columns.time' as never)}
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-400">
                        {t('auditLog.columns.user' as never)}
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-400">
                        {t('auditLog.columns.action' as never)}
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-400">
                        {t('auditLog.columns.entity' as never)}
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-400">
                        {t('auditLog.columns.entityLabel' as never)}
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-400">
                        {t('auditLog.columns.ip' as never)}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {auditData.data.map((row: AuditLog) => (
                      <>
                        <tr key={row.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/50 cursor-pointer" onClick={() => toggleExpand(row.id)}>
                          <td className="px-4 py-3">
                            {row.details ? (
                              expandedRows.has(row.id)
                                ? <ChevronDown className="w-4 h-4 text-neutral-500" />
                                : <ChevronRight className="w-4 h-4 text-neutral-500" />
                            ) : <span className="w-4 inline-block" />}
                          </td>
                          <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400 whitespace-nowrap text-xs">
                            {formatTime(row.created_at)}
                          </td>
                          <td className="px-4 py-3 text-neutral-900 dark:text-neutral-100 whitespace-nowrap">
                            {row.username || (row.user_id ? `#${row.user_id}` : '—')}
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn(
                              'inline-flex px-2 py-0.5 rounded-full text-xs font-medium',
                              ACTION_COLORS[row.action] || 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
                            )}>
                              {ACTION_LABELS[row.action] || row.action}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                              {ENTITY_LABELS[row.entity_type] || row.entity_type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400 max-w-xs truncate">
                            {row.entity_label || '—'}
                          </td>
                          <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400 font-mono text-xs">
                            {row.ip_address || '—'}
                          </td>
                        </tr>
                        {expandedRows.has(row.id) && row.details && (
                          <tr key={`${row.id}-details`}>
                            <td colSpan={7} className="px-4 py-3 bg-neutral-50 dark:bg-neutral-900/50">
                              <pre className="text-xs text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap font-mono overflow-x-auto">
                                {JSON.stringify(row.details, null, 2)}
                              </pre>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {auditData.meta && auditData.meta.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    {`Hiển thị ${((auditData.meta.page - 1) * auditData.meta.limit) + 1}-${Math.min(auditData.meta.page * auditData.meta.limit, auditData.meta.total)} của ${auditData.meta.total}`}
                  </p>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleAuditPageChange(auditData.meta.page - 1)}
                      disabled={auditData.meta.page <= 1}
                      className="px-3 py-1.5 text-sm border border-neutral-300 dark:border-neutral-700 rounded-lg disabled:opacity-40 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                    >
                      ‹
                    </button>
                    {Array.from({ length: Math.min(auditData.meta.totalPages, 7) }).map((_, i) => {
                      const startPage = Math.max(1, Math.min(auditData.meta.page - 3, auditData.meta.totalPages - 6));
                      const pageNum = startPage + i;
                      if (pageNum > auditData.meta.totalPages) return null;
                      return (
                        <button
                          key={pageNum}
                          onClick={() => handleAuditPageChange(pageNum)}
                          className={cn(
                            'px-3 py-1.5 text-sm border rounded-lg',
                            pageNum === auditData.meta.page
                              ? 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 border-neutral-900 dark:border-neutral-100'
                              : 'border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-900 dark:text-neutral-100',
                          )}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => handleAuditPageChange(auditData.meta.page + 1)}
                      disabled={auditData.meta.page >= auditData.meta.totalPages}
                      className="px-3 py-1.5 text-sm border border-neutral-300 dark:border-neutral-700 rounded-lg disabled:opacity-40 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                    >
                      ›
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
