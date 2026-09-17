import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useI18n } from '../../i18n/useI18n';
import { OverviewTab } from './tabs/OverviewTab';
import { VehicleMaintenanceTab } from './tabs/VehicleMaintenanceTab';
import { AccountingTab } from './tabs/AccountingTab';
import { OperationsTab } from './tabs/OperationsTab';
import { FuelTab } from './tabs/FuelTab';

type TabKey = 'overview' | 'vehicles' | 'accounting' | 'operations' | 'fuel';

const TAB_KEYS: TabKey[] = ['overview', 'vehicles', 'accounting', 'operations', 'fuel'];

export function DashboardPage() {
  const { user, hasPermission, hasAnyPermission } = useAuth();
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();

  const tabPermissions: Record<TabKey, boolean> = {
    overview: hasPermission('dashboard.view') || user?.role === 'ADMIN',
    vehicles: hasPermission('vehicle_data.view') || user?.role === 'ADMIN',
    accounting: hasPermission('accounting_data.view') || user?.role === 'ADMIN',
    operations: hasPermission('dispatch.view') || user?.role === 'ADMIN',
    fuel: hasPermission('fuel.view') || user?.role === 'ADMIN',
  };

  const visibleTabs = TAB_KEYS.filter((k) => tabPermissions[k]);

  const tabParam = params.get('tab') as TabKey | null;
  const tab: TabKey = tabParam && visibleTabs.includes(tabParam) ? tabParam : visibleTabs[0] ?? 'overview';

  const setTab = (nextTab: TabKey) => {
    const next = new URLSearchParams(params);
    next.set('tab', nextTab);
    setParams(next);
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
          {t('dashboard.title')}
        </h1>
        <p className="text-neutral-500 dark:text-neutral-400 mt-1">
          {t('dashboard.subtitle', { name: user?.full_name || 'User' })}
        </p>
      </div>

      <div className="flex gap-1 border-b border-neutral-200 dark:border-neutral-700 mb-6 overflow-x-auto">
        {visibleTabs.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
              tab === k
                ? 'border-neutral-900 dark:border-neutral-100 text-neutral-900 dark:text-neutral-100'
                : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            {t(`dashboard.tabs.${k}`)}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab />}
      {tab === 'vehicles' && <VehicleMaintenanceTab />}
      {tab === 'accounting' && <AccountingTab />}
      {tab === 'operations' && <OperationsTab />}
      {tab === 'fuel' && <FuelTab />}
    </div>
  );
}
