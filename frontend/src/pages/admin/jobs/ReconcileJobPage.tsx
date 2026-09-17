import { Fragment, useState } from 'react';
import { RefreshCw, Play, Pencil, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/Table';
import { Pagination } from '../../../components/ui/Pagination';
import { Switch } from '../../../components/ui/Switch';
import { HourSelector } from '../../../components/accounting-data/HourSelector';
import {
  useGetConfigs,
  useCreateConfig,
  useUpdateConfig,
  useDeleteConfig,
  useToggleConfig,
  useTriggerReconcile,
  useGetLogs,
} from '../../../hooks/useReconcileJobs';
import { useAuth } from '../../../hooks/useAuth';
import type { ReconcileJobConfig } from '../../../api/reconcileJobApi';

interface Toast {
  id: number;
  message: string;
  variant: 'success' | 'error';
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusBadge(status: string) {
  switch (status) {
    case 'success':
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full dark:bg-green-900/30 dark:text-green-400">
          Thành công
        </span>
      );
    case 'failed':
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded-full dark:bg-red-900/30 dark:text-red-400">
          Thất bại
        </span>
      );
    case 'running':
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full dark:bg-blue-900/30 dark:text-blue-400">
          <RefreshCw className="w-3 h-3 animate-spin" />
          Đang chạy
        </span>
      );
    default:
      return status;
  }
}

export function ReconcileJobPage() {
  const { data: configs, isLoading: configsLoading } = useGetConfigs();
  const createConfig = useCreateConfig();
  const updateConfig = useUpdateConfig();
  const deleteConfig = useDeleteConfig();
  const toggleConfig = useToggleConfig();
  const triggerReconcile = useTriggerReconcile();
  const { hasPermission, user } = useAuth();

  const canManage = hasPermission('jobs.manage') || user?.role === 'ADMIN';

  const [editing, setEditing] = useState(false);
  const [formName, setFormName] = useState('');
  const [formLookback, setFormLookback] = useState(180);
  const [formHours, setFormHours] = useState<number[]>([8, 12, 18]);
  const [formActive, setFormActive] = useState(true);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [logPage, setLogPage] = useState(1);
  const [logStatusFilter, setLogStatusFilter] = useState('');
  const [showLog, setShowLog] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);

  const config = configs && configs.length > 0 ? configs[0] : null;

  const { data: logData, isLoading: logsLoading } = useGetLogs({
    page: logPage,
    limit: 10,
    config_id: config?.id,
    status: logStatusFilter || undefined,
  });

  const showToast = (message: string, variant: 'success' | 'error' = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  };

  const startEdit = () => {
    if (config) {
      setFormName(config.name);
      setFormLookback(config.lookback_days);
      setFormHours(config.schedule_hours);
      setFormActive(config.is_active);
    } else {
      setFormName('Đối chiếu hóa đơn');
      setFormLookback(180);
      setFormHours([8, 12, 18]);
      setFormActive(true);
    }
    setFormErrors({});
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setFormErrors({});
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formName.trim()) errors.name = 'Tên job không được để trống';
    if (formLookback < 1) errors.lookback = 'Số ngày quét phải >= 1';
    if (formHours.length === 0) errors.hours = 'Vui lòng chọn ít nhất 1 giờ';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      if (config) {
        await updateConfig.mutateAsync({
          id: config.id,
          input: {
            name: formName,
            lookback_days: formLookback,
            schedule_hours: formHours,
            is_active: formActive,
          },
        });
        showToast('Đã cập nhật cấu hình job');
      } else {
        await createConfig.mutateAsync({
          name: formName,
          lookback_days: formLookback,
          schedule_hours: formHours,
          is_active: formActive,
        });
        showToast('Đã tạo cấu hình job');
      }
      setEditing(false);
    } catch {
      showToast('Lỗi khi lưu cấu hình', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async () => {
    if (!config) return;
    try {
      const result = await toggleConfig.mutateAsync(config.id);
      showToast(result.is_active ? 'Đã bật job' : 'Đã tắt job');
    } catch {
      showToast('Lỗi khi thay đổi trạng thái', 'error');
    }
  };

  const handleDelete = async () => {
    if (!config) return;
    if (!window.confirm('Bạn có chắc muốn xóa cấu hình này?')) return;
    try {
      await deleteConfig.mutateAsync(config.id);
      showToast('Đã xóa cấu hình job');
    } catch {
      showToast('Lỗi khi xóa cấu hình', 'error');
    }
  };

  const handleTrigger = async () => {
    if (!config && !canManage) return;
    setTriggering(true);
    try {
      const result = await triggerReconcile.mutateAsync(
        config ? { config_id: config.id } : { lookback_days: 180 },
      );
      showToast(`${result.matched_count}/${result.scanned_count} hóa đơn đã khớp`);
    } catch {
      showToast('Lỗi khi chạy đối chiếu', 'error');
    } finally {
      setTriggering(false);
    }
  };

  const isEmpty = !configsLoading && !config;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
          Cấu hình Job Đối chiếu
        </h1>
      </div>

      {toasts.map((t) => (
        <div
          key={t.id}
          className={`px-4 py-3 rounded-lg text-sm font-medium ${
            t.variant === 'success'
              ? 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-400'
          }`}
        >
          {t.message}
        </div>
      ))}

      {configsLoading && (
        <div className="text-neutral-500">Đang tải...</div>
      )}

      {isEmpty && !editing && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
            <RefreshCw className="w-12 h-12 text-neutral-300 dark:text-neutral-600" />
            <p className="text-neutral-500 dark:text-neutral-400">
              Chưa có cấu hình job nào
            </p>
            {canManage && (
              <Button onClick={startEdit}>
                <Pencil className="w-4 h-4 mr-2" />
                Tạo cấu hình
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {(config || editing) && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                Cấu hình
              </h2>
              {!editing && canManage && (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={startEdit}>
                    <Pencil className="w-4 h-4 mr-1" />
                    Sửa
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleTrigger} disabled={triggering}>
                    <Play className={`w-4 h-4 mr-1 ${triggering ? 'animate-pulse' : ''}`} />
                    {triggering ? 'Đang chạy...' : 'Chạy ngay'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDelete}>
                    <Trash2 className="w-4 h-4 mr-1" />
                    Xóa
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Tên job
              </label>
              {editing ? (
                <div>
                  <Input
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    disabled={saving}
                  />
                  {formErrors.name && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>
                  )}
                </div>
              ) : (
                <p className="text-neutral-900 dark:text-neutral-100">{config?.name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Số ngày quét
              </label>
              {editing ? (
                <div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      value={formLookback}
                      onChange={(e) => setFormLookback(parseInt(e.target.value, 10) || 0)}
                      disabled={saving}
                      className="w-32"
                    />
                    <span className="text-sm text-neutral-500">ngày</span>
                  </div>
                  {formErrors.lookback && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.lookback}</p>
                  )}
                </div>
              ) : (
                <p className="text-neutral-900 dark:text-neutral-100">
                  {config?.lookback_days} ngày
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Giờ chạy
              </label>
              {editing ? (
                <div>
                  <HourSelector
                    selected={formHours}
                    onChange={setFormHours}
                    disabled={saving}
                    error={formErrors.hours}
                  />
                </div>
              ) : (
                <p className="text-neutral-900 dark:text-neutral-100">
                  {config?.schedule_hours
                    .map((h) => `${h.toString().padStart(2, '0')}:00`)
                    .join(', ')}
                </p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Trạng thái
              </label>
              {editing || canManage ? (
                <div className="flex items-center gap-2">
                  <Switch
                    checked={editing ? formActive : config?.is_active ?? false}
                    onChange={(v) => {
                      if (editing) {
                        setFormActive(v);
                      } else {
                        handleToggle();
                      }
                    }}
                  />
                  <span className="text-sm text-neutral-600 dark:text-neutral-400">
                    {(editing ? formActive : config?.is_active)
                      ? 'Đang hoạt động'
                      : 'Đã tắt'}
                  </span>
                </div>
              ) : (
                <span className="text-sm text-neutral-600 dark:text-neutral-400">
                  {config?.is_active ? 'Đang hoạt động' : 'Đã tắt'}
                </span>
              )}
            </div>

            {!editing && config && (
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-neutral-200 dark:border-neutral-700">
                <div>
                  <span className="text-sm text-neutral-500">Lần chạy cuối:</span>
                  <p className="text-sm text-neutral-900 dark:text-neutral-100">
                    {formatDateTime(config.last_run_at)}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-neutral-500">Lần chạy tiếp:</span>
                  <p className="text-sm text-neutral-900 dark:text-neutral-100">
                    {config.schedule_hours.length > 0 && config.is_active
                      ? config.schedule_hours
                          .map((h) => `${h.toString().padStart(2, '0')}:00`)
                          .join(', ')
                      : '—'}
                  </p>
                </div>
              </div>
            )}

            {editing && canManage && (
              <div className="flex items-center gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-700">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? 'Đang lưu...' : 'Lưu'}
                </Button>
                <Button variant="outline" onClick={cancelEdit} disabled={saving}>
                  Hủy
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {config && (
        <Card>
          <CardHeader>
            <button
              onClick={() => setShowLog(!showLog)}
              className="flex items-center gap-2 text-lg font-semibold text-neutral-900 dark:text-neutral-100 hover:text-neutral-600"
            >
              <ChevronDown
                className={`w-5 h-5 transition-transform ${showLog ? 'rotate-0' : '-rotate-90'}`}
              />
              Lịch sử chạy
            </button>
          </CardHeader>
          {showLog && (
            <CardContent>
              <div className="flex items-center gap-3 mb-4">
                <select
                  value={logStatusFilter}
                  onChange={(e) => {
                    setLogStatusFilter(e.target.value);
                    setLogPage(1);
                  }}
                  className="px-3 py-1.5 text-sm border border-neutral-300 rounded-lg bg-white dark:bg-neutral-800 dark:border-neutral-600 dark:text-neutral-200"
                >
                  <option value="">Tất cả trạng thái</option>
                  <option value="success">Thành công</option>
                  <option value="failed">Thất bại</option>
                  <option value="running">Đang chạy</option>
                </select>
              </div>

              {logsLoading ? (
                <p className="text-sm text-neutral-500">Đang tải...</p>
              ) : logData && logData.data.length > 0 ? (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Thời gian bắt đầu</TableHead>
                        <TableHead>Thời gian kết thúc</TableHead>
                        <TableHead>Loại</TableHead>
                        <TableHead>Trạng thái</TableHead>
                        <TableHead>Đã quét</TableHead>
                        <TableHead>Đã khớp</TableHead>
                        <TableHead>Lỗi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logData.data.map((log) => {
                        const isExpanded = expandedLogId === log.id;
                        return (
                            <Fragment key={log.id}>
                            <TableRow
                              key={log.id}
                              className="cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                              onClick={() =>
                                setExpandedLogId(isExpanded ? null : log.id)
                              }
                            >
                              <TableCell className="text-sm">
                                <div className="flex items-center gap-1">
                                  <ChevronRight
                                    className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''} ${
                                      log.matched_invoices && log.matched_invoices.length > 0
                                        ? 'text-neutral-700 dark:text-neutral-300'
                                        : 'text-neutral-300 dark:text-neutral-600'
                                    }`}
                                  />
                                  {formatDateTime(log.started_at)}
                                </div>
                              </TableCell>
                              <TableCell className="text-sm">
                                {formatDateTime(log.finished_at)}
                              </TableCell>
                              <TableCell className="text-sm">
                                {log.trigger_type === 'manual' ? 'Thủ công' : 'Định kỳ'}
                              </TableCell>
                              <TableCell>{statusBadge(log.status)}</TableCell>
                              <TableCell className="text-sm">{log.scanned_count}</TableCell>
                              <TableCell className="text-sm font-medium text-green-700 dark:text-green-400">
                                {log.matched_count}
                              </TableCell>
                              <TableCell className="text-sm max-w-[200px] truncate text-red-600">
                                {log.error_message || '—'}
                              </TableCell>
                            </TableRow>
                            {isExpanded && (
                              <TableRow key={`${log.id}-detail`} className="bg-neutral-50 dark:bg-neutral-800/30">
                                <TableCell colSpan={7} className="p-0">
                                  {log.matched_invoices && log.matched_invoices.length > 0 ? (
                                    <div className="px-4 py-3 max-h-48 overflow-auto">
                                      <table className="w-full text-sm">
                                        <thead>
                                          <tr className="border-b border-neutral-200 dark:border-neutral-700">
                                            <th className="text-left py-1 text-neutral-500 font-medium">Số HĐ</th>
                                            <th className="text-left py-1 text-neutral-500 font-medium">Số xe</th>
                                            <th className="text-left py-1 text-neutral-500 font-medium">Ngày</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {log.matched_invoices.map((inv) => (
                                            <tr key={inv.id} className="border-b border-neutral-100 dark:border-neutral-800 last:border-0">
                                              <td className="py-1 pr-4">{inv.so_hoa_don}</td>
                                              <td className="py-1 pr-4">{inv.so_xe}</td>
                                              <td className="py-1">{inv.ngay}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  ) : (
                                    <p className="px-4 py-3 text-sm text-neutral-400 italic">
                                      {log.status === 'running'
                                        ? 'Job đang chạy...'
                                        : log.status === 'failed'
                                          ? 'Job thất bại, không có dữ liệu'
                                          : 'Không có hóa đơn nào được cập nhật trong lần chạy này'}
                                    </p>
                                  )}
                                </TableCell>
                              </TableRow>
                            )}
                            </Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                  {logData.pagination.totalPages > 1 && (
                    <div className="mt-4">
                      <Pagination
                        currentPage={logData.pagination.page}
                        totalPages={logData.pagination.totalPages}
                        totalItems={logData.pagination.total}
                        pageSize={logData.pagination.limit}
                        onPageChange={setLogPage}
                      />
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-neutral-500 py-8 text-center">
                  Chưa có lịch sử chạy
                </p>
              )}
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
