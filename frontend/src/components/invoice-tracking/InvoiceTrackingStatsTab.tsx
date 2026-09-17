import { useState, useMemo } from 'react';
import { useI18n } from '../../i18n/useI18n';
import { useInvoiceTrackingStatistics } from '../../hooks/useInvoiceTracking';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../ui/Table';
import {
  BarChart3,
  Calendar,
  Truck,
  User,
  RotateCcw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileCheck,
  FileText,
  TrendingUp,
} from 'lucide-react';

export function InvoiceTrackingStatsTab() {
  const { t } = useI18n();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [bienSo, setBienSo] = useState('');
  const [taiXe, setTaiXe] = useState('');
  const [note, setNote] = useState('');

  const filters = useMemo(
    () => ({
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      bien_so: bienSo.trim() || undefined,
      tai_xe: taiXe.trim() || undefined,
      ghi_chu: note.trim() || undefined,
    }),
    [dateFrom, dateTo, bienSo, taiXe, note],
  );

  const { data, isLoading, isError, refetch } = useInvoiceTrackingStatistics(filters);

  const handleResetFilters = () => {
    setDateFrom('');
    setDateTo('');
    setBienSo('');
    setTaiXe('');
    setNote('');
  };

  const hasActiveFilters = Boolean(dateFrom || dateTo || bienSo || taiXe || note);

  if (isError) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-neutral-500 dark:text-neutral-400">Không thể tải dữ liệu thống kê</p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-3">
            <RotateCcw className="w-4 h-4 mr-1.5" />
            {t('invoice_tracking.page.retry')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const summary = data?.summary || {
    total_tickets: 0,
    created_count: 0,
    pending_review_count: 0,
    request_supplement_count: 0,
    completed_count: 0,
    completion_rate: 0,
  };

  const drivers = data?.by_driver || [];

  return (
    <div className="space-y-6">
      {/* Filters Bar Card */}
      <Card>
        <CardHeader className="p-4 sm:p-5 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
              <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                {t('invoice_tracking.stats.title')}
              </h2>
            </div>

            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetFilters}
                className="self-start sm:self-auto h-9 text-xs"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1 text-neutral-500" />
                {t('invoice_tracking.stats.filters.clear')}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {t('invoice_tracking.stats.filters.dateFrom')}
              </label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-10 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {t('invoice_tracking.stats.filters.dateTo')}
              </label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-10 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1 flex items-center gap-1">
                <Truck className="w-3.5 h-3.5" />
                {t('invoice_tracking.stats.filters.plate')}
              </label>
              <Input
                placeholder={t('invoice_tracking.stats.filters.platePlaceholder')}
                value={bienSo}
                onChange={(e) => setBienSo(e.target.value)}
                className="h-10 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1 flex items-center gap-1">
                <User className="w-3.5 h-3.5" />
                {t('invoice_tracking.stats.filters.driver')}
              </label>
              <Input
                placeholder={t('invoice_tracking.stats.filters.driverPlaceholder')}
                value={taiXe}
                onChange={(e) => setTaiXe(e.target.value)}
                className="h-10 text-sm"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5" />
                {t('invoice_tracking.stats.filters.note')}
              </label>
              <Input
                placeholder={t('invoice_tracking.stats.filters.notePlaceholder')}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="h-10 text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Total */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between gap-1 text-neutral-500 dark:text-neutral-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">{t('invoice_tracking.stats.kpi.total')}</span>
            <FileCheck className="w-4 h-4 text-neutral-600 dark:text-neutral-300" />
          </div>
          <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            {isLoading ? <div className="h-8 w-16 bg-neutral-200 dark:bg-neutral-800 animate-pulse rounded" /> : summary.total_tickets}
          </div>
        </div>

        {/* Created */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between gap-1 text-neutral-500 dark:text-neutral-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">{t('invoice_tracking.stats.kpi.created')}</span>
            <Clock className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            {isLoading ? <div className="h-8 w-16 bg-neutral-200 dark:bg-neutral-800 animate-pulse rounded" /> : summary.created_count}
          </div>
        </div>

        {/* Pending Review */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between gap-1 text-amber-600 dark:text-amber-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">{t('invoice_tracking.stats.kpi.pendingReview')}</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {isLoading ? <div className="h-8 w-16 bg-neutral-200 dark:bg-neutral-800 animate-pulse rounded" /> : summary.pending_review_count}
          </div>
        </div>

        {/* Request Supplement */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between gap-1 text-red-600 dark:text-red-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">{t('invoice_tracking.stats.kpi.requestSupplement')}</span>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">
            {isLoading ? <div className="h-8 w-16 bg-neutral-200 dark:bg-neutral-800 animate-pulse rounded" /> : summary.request_supplement_count}
          </div>
        </div>

        {/* Completed */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between gap-1 text-emerald-600 dark:text-emerald-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">{t('invoice_tracking.stats.kpi.completed')}</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {isLoading ? <div className="h-8 w-16 bg-neutral-200 dark:bg-neutral-800 animate-pulse rounded" /> : summary.completed_count}
          </div>
        </div>

        {/* Completion Rate */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 shadow-2xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between gap-1 text-neutral-600 dark:text-neutral-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">{t('invoice_tracking.stats.kpi.completionRate')}</span>
            <TrendingUp className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 flex items-baseline gap-1">
            {isLoading ? (
              <div className="h-8 w-16 bg-neutral-200 dark:bg-neutral-800 animate-pulse rounded" />
            ) : (
              <>
                <span>{summary.completion_rate}</span>
                <span className="text-sm text-neutral-500">%</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Driver Statistics Table Card */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded bg-neutral-100 dark:bg-neutral-800" />
              ))}
            </div>
          ) : drivers.length === 0 ? (
            <div className="py-16 px-4 text-center">
              <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-3">
                <BarChart3 className="w-6 h-6 text-neutral-400" />
              </div>
              <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">{t('invoice_tracking.stats.empty')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-neutral-50/70 dark:bg-neutral-800/60">
                    <TableHead className="w-12 text-center">{t('invoice_tracking.stats.table.stt')}</TableHead>
                    <TableHead className="min-w-[180px]">{t('invoice_tracking.stats.table.driver')}</TableHead>
                    <TableHead className="min-w-[150px]">{t('invoice_tracking.stats.table.vehicles')}</TableHead>
                    <TableHead className="text-center whitespace-nowrap">{t('invoice_tracking.stats.table.created')}</TableHead>
                    <TableHead className="text-center whitespace-nowrap">{t('invoice_tracking.stats.table.pending')}</TableHead>
                    <TableHead className="text-center whitespace-nowrap">{t('invoice_tracking.stats.table.supplement')}</TableHead>
                    <TableHead className="text-center whitespace-nowrap">{t('invoice_tracking.stats.table.completed')}</TableHead>
                    <TableHead className="text-center whitespace-nowrap font-bold">{t('invoice_tracking.stats.table.total')}</TableHead>
                    <TableHead className="text-center whitespace-nowrap font-bold">{t('invoice_tracking.stats.table.rate')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drivers.map((driver, idx) => (
                    <TableRow key={driver.driver_id || idx} className="hover:bg-neutral-50/80 dark:hover:bg-neutral-800/50">
                      <TableCell className="text-center text-neutral-400 font-mono text-xs">
                        {idx + 1}
                      </TableCell>
                      <TableCell className="font-semibold text-neutral-900 dark:text-neutral-100">
                        {driver.driver_name}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {driver.vehicles.length > 0 ? (
                            driver.vehicles.map((v, vIdx) => (
                              <span
                                key={vIdx}
                                className="inline-block px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700 text-[11px] font-mono text-neutral-700 dark:text-neutral-300"
                              >
                                {v}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-neutral-400 italic">—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-medium text-neutral-700 dark:text-neutral-300">
                        {driver.created_count || 0}
                      </TableCell>
                      <TableCell className="text-center font-medium text-amber-600 dark:text-amber-400">
                        {driver.pending_review_count || 0}
                      </TableCell>
                      <TableCell className="text-center font-medium text-red-600 dark:text-red-400">
                        {driver.request_supplement_count || 0}
                      </TableCell>
                      <TableCell className="text-center font-medium text-emerald-600 dark:text-emerald-400">
                        {driver.completed_count || 0}
                      </TableCell>
                      <TableCell className="text-center font-bold text-neutral-900 dark:text-neutral-100">
                        {driver.total_tickets}
                      </TableCell>
                      <TableCell className="text-center font-bold text-neutral-900 dark:text-neutral-100">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs ${
                            driver.completion_rate >= 80
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                              : driver.completion_rate >= 50
                                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                          }`}
                        >
                          {driver.completion_rate}%
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>

                {/* Table Footer: Grand Total Row */}
                <tfoot>
                  <tr className="bg-neutral-100/80 dark:bg-neutral-800/90 font-bold border-t-2 border-neutral-300 dark:border-neutral-700 text-xs sm:text-sm">
                    <td colSpan={3} className="px-4 py-3 text-neutral-900 dark:text-neutral-100 uppercase tracking-wider">
                      {t('invoice_tracking.stats.table.grandTotal')}
                    </td>
                    <td className="px-3 py-3 text-center text-neutral-800 dark:text-neutral-200">
                      {summary.created_count}
                    </td>
                    <td className="px-3 py-3 text-center text-amber-600 dark:text-amber-400">
                      {summary.pending_review_count}
                    </td>
                    <td className="px-3 py-3 text-center text-red-600 dark:text-red-400">
                      {summary.request_supplement_count}
                    </td>
                    <td className="px-3 py-3 text-center text-emerald-600 dark:text-emerald-400">
                      {summary.completed_count}
                    </td>
                    <td className="px-3 py-3 text-center text-neutral-900 dark:text-neutral-100 text-base">
                      {summary.total_tickets}
                    </td>
                    <td className="px-3 py-3 text-center text-neutral-900 dark:text-neutral-100">
                      <span className="inline-block px-2 py-0.5 rounded bg-neutral-200/80 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 text-xs">
                        {summary.completion_rate}%
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
