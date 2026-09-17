import { useState } from 'react';
import { ReceiptText } from 'lucide-react';
import { Card, CardContent } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[0, 1].map((i) => (
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardContent className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                <ReceiptText className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                  {data.driver_invoices.record_count.toLocaleString('vi-VN')}
                </p>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  {t('dashboard.operations.driverInvoiceRecords')}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">
                <ReceiptText className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                  {data.driver_invoices.invoice_count.toLocaleString('vi-VN')}
                </p>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  {t('dashboard.operations.driverInvoiceCount')}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
