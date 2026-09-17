import { useState } from 'react';
import {
  Truck,
  ReceiptText,
  Droplets,
  AlertTriangle,
  CalendarRange,
  RefreshCw,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { useOverview } from '../../../hooks/useDashboard';
import { useI18n } from '../../../i18n/useI18n';
import { formatCurrency } from '../../../utils/format';

type Period = 'month' | 'quarter';

export function OverviewTab() {
  const { t } = useI18n();
  const [period, setPeriod] = useState<Period>('month');
  const { data, isLoading, isError, refetch } = useOverview(period);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
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

  const { kpis, monthly_tons, alerts, dispatch_today, last_reconcile } = data;

  const kpiCards = [
    {
      icon: Truck,
      color: 'blue',
      label: t('dashboard.kpi.deliveredTons'),
      value: `${kpis.delivered_tons.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} MT`,
    },
    {
      icon: ReceiptText,
      color: 'green',
      label: t('dashboard.kpi.invoiceCount'),
      value: kpis.invoice_count.toLocaleString('vi-VN'),
    },
    {
      icon: Droplets,
      color: 'orange',
      label: t('dashboard.kpi.fuelCost'),
      value: formatCurrency(kpis.fuel_cost),
    },
  ];

  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    green: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    orange: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
  };

  const alertItems: { label: string; count: number; variant: 'danger' | 'warning' }[] = [
    {
      label: t('dashboard.alerts.expiredInspections'),
      count: alerts.expired_inspections,
      variant: 'danger',
    },
    {
      label: t('dashboard.alerts.dueInspections'),
      count: alerts.due_inspections.length,
      variant: 'warning',
    },
    {
      label: t('dashboard.alerts.expiredInsurances'),
      count: alerts.expired_insurances,
      variant: 'danger',
    },
    {
      label: t('dashboard.alerts.dueInsurances'),
      count: alerts.due_insurances.length,
      variant: 'warning',
    },
    { label: t('dashboard.alerts.oilOverdue'), count: alerts.oil_overdue, variant: 'danger' },
    { label: t('dashboard.alerts.oilDueSoon'), count: alerts.oil_due_soon, variant: 'warning' },
    {
      label: t('dashboard.alerts.unmatchedInvoices'),
      count: alerts.unmatched_invoices,
      variant: 'warning',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-neutral-900 dark:text-neutral-100">
          {t('dashboard.overview.kpiTitle')}
        </h2>
        <div className="flex gap-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg p-1">
          {(['month', 'quarter'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 text-xs font-medium rounded-md ${
                period === p
                  ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-sm'
                  : 'text-neutral-500 dark:text-neutral-400'
              }`}
            >
              {t(`dashboard.period.${p}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {kpiCards.map(({ icon: Icon, color, label, value }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
                <Icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                  {value}
                </p>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardContent>
            <h3 className="text-base font-medium text-neutral-900 dark:text-neutral-100 mb-4">
              {t('dashboard.overview.monthlyTons')}
            </h3>
            {monthly_tons.length === 0 ? (
              <p className="text-sm text-neutral-500 dark:text-neutral-400 py-12 text-center">
                {t('dashboard.noData')}
              </p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthly_tons} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6b7280' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} width={40} />
                    <Tooltip
                      formatter={(value) => [`${value} MT`, t('dashboard.overview.tons')]}
                      contentStyle={{
                        fontSize: 12,
                        borderRadius: 8,
                        border: '1px solid #e5e7eb',
                      }}
                    />
                    <Bar
                      dataKey="tons"
                      name={t('dashboard.overview.tons')}
                      fill="#525252"
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
            <div className="flex items-center gap-2 mb-4">
              <CalendarRange className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
              <h3 className="text-base font-medium text-neutral-900 dark:text-neutral-100">
                {t('dashboard.overview.dispatchToday')}
              </h3>
            </div>
            <div className="space-y-2">
              {[
                [t('dashboard.overview.smallVehicles'), dispatch_today.xe_nho],
                [t('dashboard.overview.largeVehicles'), dispatch_today.xe_lon],
                [t('dashboard.overview.outsideRoutes'), dispatch_today.tuyen_ngoai],
              ].map(([label, count]) => (
                <div
                  key={label as string}
                  className="flex items-center justify-between py-2 border-b border-neutral-100 dark:border-neutral-700 last:border-0"
                >
                  <span className="text-sm text-neutral-600 dark:text-neutral-400">{label}</span>
                  <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    {count as number}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 mt-6 mb-3">
              <RefreshCw className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
              <h3 className="text-base font-medium text-neutral-900 dark:text-neutral-100">
                {t('dashboard.overview.lastReconcile')}
              </h3>
            </div>
            {last_reconcile ? (
              <div className="text-sm space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant={last_reconcile.status === 'success' ? 'success' : last_reconcile.status === 'running' ? 'info' : 'danger'}>
                    {last_reconcile.status}
                  </Badge>
                  {last_reconcile.started_at && (
                    <span className="text-neutral-500 dark:text-neutral-400 text-xs">
                      {new Date(last_reconcile.started_at).toLocaleString('vi-VN')}
                    </span>
                  )}
                </div>
                <p className="text-neutral-500 dark:text-neutral-400">
                  {t('dashboard.overview.reconcileResult', {
                    matched: last_reconcile.matched_count,
                    scanned: last_reconcile.scanned_count,
                  })}
                </p>
              </div>
            ) : (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                {t('dashboard.noData')}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent>
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
            <h3 className="text-base font-medium text-neutral-900 dark:text-neutral-100">
              {t('dashboard.alerts.title')}
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {alertItems.map(({ label, count, variant }) => (
              <div
                key={label}
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg border ${
                  count === 0
                    ? 'border-neutral-200 dark:border-neutral-700'
                    : variant === 'danger'
                      ? 'border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20'
                      : 'border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-900/20'
                }`}
              >
                <span className="text-sm text-neutral-600 dark:text-neutral-400">{label}</span>
                <span
                  className={`text-sm font-semibold ${
                    count === 0
                      ? 'text-neutral-400 dark:text-neutral-500'
                      : variant === 'danger'
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {count}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
