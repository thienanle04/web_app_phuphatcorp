import { useState } from 'react';
import { Route, Weight, Car, ReceiptText } from 'lucide-react';
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
import { Input } from '../../../components/ui/Input';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../../../components/ui/Table';
import { Button } from '../../../components/ui/Button';
import { useOperationsDashboard } from '../../../hooks/useDashboard';
import { useI18n } from '../../../i18n/useI18n';

export function OperationsTab() {
  const { t } = useI18n();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const params =
    dateFrom || dateTo ? { date_from: dateFrom || undefined, date_to: dateTo || undefined } : undefined;
  const { data, isLoading, isError, refetch } = useOperationsDashboard(params);

  const kpiCards = data
    ? [
        {
          icon: Route,
          color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
          label: t('dashboard.operations.totalTrips'),
          value: data.summary.total_trips.toLocaleString('vi-VN'),
        },
        {
          icon: Weight,
          color: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
          label: t('dashboard.operations.totalTons'),
          value: `${data.summary.total_tons.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} MT`,
        },
        {
          icon: Car,
          color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
          label: t('dashboard.operations.vehicleCount'),
          value: data.summary.vehicle_count.toLocaleString('vi-VN'),
        },
        {
          icon: ReceiptText,
          color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
          label: t('dashboard.operations.driverInvoices'),
          value: `${data.driver_invoices.record_count.toLocaleString('vi-VN')} / ${data.driver_invoices.invoice_count.toLocaleString('vi-VN')}`,
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-44">
          <Input
            type="date"
            label={t('dashboard.operations.dateFrom')}
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div className="w-44">
          <Input
            type="date"
            label={t('dashboard.operations.dateTo')}
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
        {(dateFrom || dateTo) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setDateFrom('');
              setDateTo('');
            }}
          >
            {t('dashboard.operations.reset')}
          </Button>
        )}
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse bg-neutral-100 dark:bg-neutral-800 rounded-lg h-24" />
          ))}
        </div>
      )}

      {isError && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">{t('dashboard.error')}</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              {t('dashboard.retry')}
            </Button>
          </CardContent>
        </Card>
      )}

      {data && (
        <>
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
                {t('dashboard.operations.dailyTrips')}
              </h3>
              {data.daily.every((d) => d.trips === 0) ? (
                <p className="text-sm text-neutral-500 dark:text-neutral-400 py-12 text-center">
                  {t('dashboard.noData')}
                </p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.daily} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7280' }} interval="preserveStartEnd" />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} width={32} />
                      <Tooltip
                        formatter={(value, name) => [
                          name === t('dashboard.operations.trips')
                            ? value
                            : `${value} MT`,
                          name as string,
                        ]}
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                      />
                      <Bar
                        dataKey="trips"
                        name={t('dashboard.operations.trips')}
                        fill="#525252"
                        radius={[3, 3, 0, 0]}
                        maxBarSize={32}
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
                {t('dashboard.operations.byVehicle')}
              </h3>
              {data.by_vehicle.length === 0 ? (
                <p className="text-sm text-neutral-500 dark:text-neutral-400 py-8 text-center">
                  {t('dashboard.noData')}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('dashboard.operations.plateNumber')}</TableHead>
                      <TableHead className="text-right">{t('dashboard.operations.trips')}</TableHead>
                      <TableHead className="text-right">{t('dashboard.operations.tons')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.by_vehicle.map((v) => (
                      <TableRow key={v.so_xe}>
                        <TableCell className="font-medium">{v.so_xe}</TableCell>
                        <TableCell className="text-right">{v.trips.toLocaleString('vi-VN')}</TableCell>
                        <TableCell className="text-right">
                          {v.tons.toLocaleString('vi-VN', { maximumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
