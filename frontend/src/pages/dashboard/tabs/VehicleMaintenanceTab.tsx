import { ClipboardCheck, ShieldCheck, Beaker, Wrench } from 'lucide-react';
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
import { useVehicleMaintenanceDashboard } from '../../../hooks/useDashboard';
import { useI18n } from '../../../i18n/useI18n';
import { formatCurrency, formatDate } from '../../../utils/format';
import type { VehicleExpiryRow, ExpiryBucket } from '../../../types/dashboard';

function bucketVariant(bucket: ExpiryBucket): 'danger' | 'warning' | 'success' | 'default' {
  if (bucket === 'expired') return 'danger';
  if (bucket === 'd30') return 'danger';
  if (bucket === 'd60' || bucket === 'd90') return 'warning';
  if (bucket === 'ok') return 'success';
  return 'default';
}

function ExpiryTable({
  rows,
  emptyText,
  t,
}: {
  rows: VehicleExpiryRow[];
  emptyText: string;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const attention = rows.filter((r) => r.bucket !== 'ok');
  if (attention.length === 0) {
    return (
      <p className="text-sm text-neutral-500 dark:text-neutral-400 py-8 text-center">{emptyText}</p>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('dashboard.vehicles.plateNumber')}</TableHead>
          <TableHead>{t('dashboard.vehicles.driver')}</TableHead>
          <TableHead>{t('dashboard.vehicles.expiryDate')}</TableHead>
          <TableHead>{t('dashboard.vehicles.daysLeft')}</TableHead>
          <TableHead>{t('dashboard.vehicles.status')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {attention.map((r) => (
          <TableRow key={r.vehicle_id}>
            <TableCell className="font-medium">{r.plate_number}</TableCell>
            <TableCell>{r.driver_name}</TableCell>
            <TableCell>{r.expiry_date ? formatDate(r.expiry_date) : '—'}</TableCell>
            <TableCell>{r.days_left !== null ? r.days_left : '—'}</TableCell>
            <TableCell>
              <Badge variant={bucketVariant(r.bucket)}>{t(`dashboard.vehicles.bucket.${r.bucket}`)}</Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function VehicleMaintenanceTab() {
  const { t } = useI18n();
  const { data, isLoading, isError, refetch } = useVehicleMaintenanceDashboard();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse bg-neutral-100 dark:bg-neutral-800 rounded-lg h-64" />
        ))}
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

  const { inspections, insurances, oil_changes, repairs } = data;
  const oilAttention = oil_changes.filter((v) => v.status === 'overdue' || v.status === 'due_soon');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardContent>
          <div className="flex items-center gap-2 mb-4">
            <ClipboardCheck className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
            <h3 className="text-base font-medium text-neutral-900 dark:text-neutral-100">
              {t('dashboard.vehicles.inspections')}
            </h3>
          </div>
          <ExpiryTable rows={inspections} emptyText={t('dashboard.vehicles.allOk')} t={t} />
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
            <h3 className="text-base font-medium text-neutral-900 dark:text-neutral-100">
              {t('dashboard.vehicles.insurances')}
            </h3>
          </div>
          <ExpiryTable rows={insurances} emptyText={t('dashboard.vehicles.allOk')} t={t} />
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <div className="flex items-center gap-2 mb-4">
            <Beaker className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
            <h3 className="text-base font-medium text-neutral-900 dark:text-neutral-100">
              {t('dashboard.vehicles.oilChanges')}
            </h3>
          </div>
          {oilAttention.length === 0 ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400 py-8 text-center">
              {t('dashboard.vehicles.allOk')}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('dashboard.vehicles.plateNumber')}</TableHead>
                  <TableHead>{t('dashboard.vehicles.currentKm')}</TableHead>
                  <TableHead>{t('dashboard.vehicles.kmSinceChange')}</TableHead>
                  <TableHead>{t('dashboard.vehicles.status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {oilAttention.map((v) => (
                  <TableRow key={v.vehicle_id}>
                    <TableCell className="font-medium">{v.plate_number}</TableCell>
                    <TableCell>
                      {v.current_km !== null ? v.current_km.toLocaleString('vi-VN') : '—'}
                    </TableCell>
                    <TableCell>
                      {v.km_since_change !== null
                        ? `${v.km_since_change.toLocaleString('vi-VN')} / ${v.interval_km.toLocaleString('vi-VN')}`
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={v.status === 'overdue' ? 'danger' : 'warning'}>
                        {t(`dashboard.vehicles.oil.${v.status}`)}
                      </Badge>
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
          <div className="flex items-center gap-2 mb-4">
            <Wrench className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
            <h3 className="text-base font-medium text-neutral-900 dark:text-neutral-100">
              {t('dashboard.vehicles.repairs')}
            </h3>
            <span className="text-xs text-neutral-400 dark:text-neutral-500">
              {t('dashboard.vehicles.last12Months')}
            </span>
          </div>
          {repairs.length === 0 ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400 py-8 text-center">
              {t('dashboard.noData')}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('dashboard.vehicles.plateNumber')}</TableHead>
                  <TableHead className="text-right">{t('dashboard.vehicles.repairCount')}</TableHead>
                  <TableHead className="text-right">{t('dashboard.vehicles.repairCost')}</TableHead>
                  <TableHead>{t('dashboard.vehicles.lastRepair')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {repairs.map((r) => (
                  <TableRow key={r.vehicle_id}>
                    <TableCell className="font-medium">{r.plate_number}</TableCell>
                    <TableCell className="text-right">{r.repair_count}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.total_cost)}</TableCell>
                    <TableCell>{r.last_repair_date ? formatDate(r.last_repair_date) : '—'}</TableCell>
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
