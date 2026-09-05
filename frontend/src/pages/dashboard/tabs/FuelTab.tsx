import { Droplets, Banknote, Gauge, Route } from 'lucide-react';
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
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../../../components/ui/Table';
import { Button } from '../../../components/ui/Button';
import { useFuelDashboard } from '../../../hooks/useDashboard';
import { useI18n } from '../../../i18n/useI18n';
import { formatCurrency } from '../../../utils/format';

export function FuelTab() {
  const { t } = useI18n();
  const { data, isLoading, isError, refetch } = useFuelDashboard();

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

  const { summary, by_month, by_vehicle, deviations } = data;

  const kpiCards = [
    {
      icon: Droplets,
      color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
      label: t('dashboard.fuel.totalLiters'),
      value: `${summary.liters.toLocaleString('vi-VN', { maximumFractionDigits: 0 })} L`,
    },
    {
      icon: Banknote,
      color: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
      label: t('dashboard.fuel.totalCost'),
      value: formatCurrency(summary.cost),
    },
    {
      icon: Route,
      color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
      label: t('dashboard.fuel.totalDistance'),
      value: `${summary.distance.toLocaleString('vi-VN', { maximumFractionDigits: 0 })} km`,
    },
    {
      icon: Gauge,
      color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
      label: t('dashboard.fuel.avgRate'),
      value: summary.avg_fuel_rate !== null ? `${summary.avg_fuel_rate.toFixed(1)} L/100km` : '—',
    },
  ];

  return (
    <div className="space-y-6">
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        {t('dashboard.fuel.last6Months')}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {kpiCards.map(({ icon: Icon, color, label, value }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${color}`}>
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

      <Card>
        <CardContent>
          <h3 className="text-base font-medium text-neutral-900 dark:text-neutral-100 mb-4">
            {t('dashboard.fuel.byMonth')}
          </h3>
          {by_month.every((m) => m.cost === 0) ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400 py-12 text-center">
              {t('dashboard.noData')}
            </p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={by_month} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6b7280' }} />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#6b7280' }}
                    width={56}
                    tickFormatter={(v: number) =>
                      v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}M` : v.toLocaleString('vi-VN')
                    }
                  />
                  <Tooltip
                    formatter={(value) => [formatCurrency(Number(value)), t('dashboard.fuel.cost')]}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                  />
                  <Bar
                    dataKey="cost"
                    name={t('dashboard.fuel.cost')}
                    fill="#f97316"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent>
            <h3 className="text-base font-medium text-neutral-900 dark:text-neutral-100 mb-4">
              {t('dashboard.fuel.byVehicle')}
            </h3>
            {by_vehicle.length === 0 ? (
              <p className="text-sm text-neutral-500 dark:text-neutral-400 py-8 text-center">
                {t('dashboard.noData')}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('dashboard.fuel.plateNumber')}</TableHead>
                    <TableHead className="text-right">{t('dashboard.fuel.liters')}</TableHead>
                    <TableHead className="text-right">{t('dashboard.fuel.cost')}</TableHead>
                    <TableHead className="text-right">{t('dashboard.fuel.rate')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {by_vehicle.map((v) => (
                    <TableRow key={v.vehicle_id}>
                      <TableCell className="font-medium">{v.plate_number}</TableCell>
                      <TableCell className="text-right">
                        {v.liters.toLocaleString('vi-VN', { maximumFractionDigits: 0 })}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(v.cost)}</TableCell>
                      <TableCell className="text-right">
                        {v.avg_fuel_rate !== null ? `${v.avg_fuel_rate.toFixed(1)}` : '—'}
                      </TableCell>
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
              {t('dashboard.fuel.deviations')}
            </h3>
            {deviations.length === 0 ? (
              <p className="text-sm text-neutral-500 dark:text-neutral-400 py-8 text-center">
                {t('dashboard.fuel.noDeviation')}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('dashboard.fuel.plateNumber')}</TableHead>
                    <TableHead className="text-right">{t('dashboard.fuel.odometer')}</TableHead>
                    <TableHead className="text-right">GPS</TableHead>
                    <TableHead className="text-right">{t('dashboard.fuel.diff')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deviations.map((d) => (
                    <TableRow key={d.vehicle_id}>
                      <TableCell className="font-medium">{d.plate_number}</TableCell>
                      <TableCell className="text-right">
                        {d.odometer_distance.toLocaleString('vi-VN', { maximumFractionDigits: 0 })}
                      </TableCell>
                      <TableCell className="text-right">
                        {d.gps_distance.toLocaleString('vi-VN', { maximumFractionDigits: 0 })}
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium ${
                          Math.abs(d.diff_pct ?? 0) > 10
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {d.diff_pct !== null ? `${d.diff_pct > 0 ? '+' : ''}${d.diff_pct.toFixed(1)}%` : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
