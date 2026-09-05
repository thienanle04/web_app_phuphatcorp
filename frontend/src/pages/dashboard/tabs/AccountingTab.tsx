import { FileSearch, CheckCircle2, XCircle } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../../../components/ui/Table';
import { Button } from '../../../components/ui/Button';
import { useAccountingDashboard } from '../../../hooks/useDashboard';
import { useI18n } from '../../../i18n/useI18n';
import { formatDateTime } from '../../../utils/format';

export function AccountingTab() {
  const { t } = useI18n();
  const { data, isLoading, isError, refetch } = useAccountingDashboard();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="animate-pulse bg-neutral-100 dark:bg-neutral-800 rounded-lg h-24" />
          ))}
        </div>
        <div className="animate-pulse bg-neutral-100 dark:bg-neutral-800 rounded-lg h-64" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">{t('dashboard.error')}</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            {t('dashboard.retry')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { totals, by_month, recent_batches, job_logs } = data;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4">
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                {totals.matched.toLocaleString('vi-VN')}
              </p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                {t('dashboard.accounting.matched')}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4">
            <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                {totals.unmatched.toLocaleString('vi-VN')}
              </p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                {t('dashboard.accounting.unmatched')}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <FileSearch className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                {totals.total.toLocaleString('vi-VN')}
              </p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                {t('dashboard.accounting.total')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent>
          <h3 className="text-base font-medium text-neutral-900 dark:text-neutral-100 mb-4">
            {t('dashboard.accounting.byMonth')}
          </h3>
          {by_month.every((m) => m.matched === 0 && m.unmatched === 0) ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400 py-12 text-center">
              {t('dashboard.noData')}
            </p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={by_month} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6b7280' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} width={40} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar
                    dataKey="matched"
                    name={t('dashboard.accounting.matched')}
                    stackId="a"
                    fill="#22c55e"
                    maxBarSize={40}
                  />
                  <Bar
                    dataKey="unmatched"
                    name={t('dashboard.accounting.unmatched')}
                    stackId="a"
                    fill="#ef4444"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <h3 className="text-base font-medium text-neutral-900 dark:text-neutral-100 mb-4">
            {t('dashboard.accounting.recentBatches')}
          </h3>
          {recent_batches.length === 0 ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400 py-8 text-center">
              {t('dashboard.noData')}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('dashboard.accounting.file')}</TableHead>
                  <TableHead>{t('dashboard.accounting.dateRange')}</TableHead>
                  <TableHead className="text-right">{t('dashboard.accounting.rows')}</TableHead>
                  <TableHead className="text-right">{t('dashboard.accounting.matched')}</TableHead>
                  <TableHead className="text-right">{t('dashboard.accounting.unmatched')}</TableHead>
                  <TableHead>{t('dashboard.accounting.uploadedBy')}</TableHead>
                  <TableHead>{t('dashboard.accounting.uploadedAt')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent_batches.map((b) => (
                  <TableRow key={b.batch_id}>
                    <TableCell className="max-w-xs truncate" title={b.original_filename}>
                      {b.original_filename}
                    </TableCell>
                    <TableCell>
                      {b.min_date} — {b.max_date}
                    </TableCell>
                    <TableCell className="text-right">{b.total_rows.toLocaleString('vi-VN')}</TableCell>
                    <TableCell className="text-right text-green-600 dark:text-green-400">
                      {b.matched_count.toLocaleString('vi-VN')}
                    </TableCell>
                    <TableCell className="text-right text-red-600 dark:text-red-400">
                      {b.unmatched_count.toLocaleString('vi-VN')}
                    </TableCell>
                    <TableCell>{b.uploaded_by_name}</TableCell>
                    <TableCell>{formatDateTime(b.uploaded_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <h3 className="text-base font-medium text-neutral-900 dark:text-neutral-100 mb-4">
            {t('dashboard.accounting.jobLogs')}
          </h3>
          {job_logs.length === 0 ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400 py-8 text-center">
              {t('dashboard.noData')}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('dashboard.accounting.startedAt')}</TableHead>
                  <TableHead>{t('dashboard.accounting.trigger')}</TableHead>
                  <TableHead>{t('dashboard.accounting.status')}</TableHead>
                  <TableHead className="text-right">{t('dashboard.accounting.scanned')}</TableHead>
                  <TableHead className="text-right">{t('dashboard.accounting.matched')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {job_logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>{formatDateTime(log.started_at)}</TableCell>
                    <TableCell>
                      {log.trigger_type === 'manual'
                        ? t('dashboard.accounting.manual')
                        : t('dashboard.accounting.scheduled')}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          log.status === 'success' ? 'success' : log.status === 'running' ? 'info' : 'danger'
                        }
                      >
                        {log.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{log.scanned_count.toLocaleString('vi-VN')}</TableCell>
                    <TableCell className="text-right">{log.matched_count.toLocaleString('vi-VN')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
