import { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  LogOut,
  Calculator,
  Users,
  Truck,
  ChevronLeft,
  ChevronRight,
  Car,
  ChevronDown,
  ChevronUp,
  Shield,
  Lock,
  Settings,
  CalendarRange,
  BookOpen,
  Scale,
  FileSpreadsheet,
  ReceiptText,
  Upload,
  FileSearch,
  FolderOpen,
  Building2,
  FileText,
  RefreshCw,
  Gift,
  ClipboardCheck,
  Beaker,
  MapPinned,
  Droplets,
  ShieldCheck,
  Wrench,
  Building,
  BarChart3,
} from 'lucide-react';
import { cn } from '../utils/cn';
import { useAuth } from '../hooks/useAuth';
import { useI18n } from '../i18n/useI18n';
import { ThemeToggle } from '../components/ui/ThemeToggle';

const USER_SETTINGS_ROUTES = ['/users', '/roles', '/permissions', '/logs'];
const DISPATCH_ROUTES = ['/dispatch'];
const ACCOUNTING_DATA_ROUTES = ['/accounting-data'];
const DELIVERY_DATA_ROUTES = ['/delivery-data'];
const CATALOG_ROUTES = ['/catalog'];
const JOBS_ROUTES = ['/jobs'];

export function MainLayout() {
  const { user, logout, hasPermission, hasAnyPermission } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [vehicleDataOpen, setVehicleDataOpen] = useState(
    location.pathname.startsWith('/vehicle-data'),
  );
  const [dispatchOpen, setDispatchOpen] = useState(
    DISPATCH_ROUTES.some((p) => location.pathname.startsWith(p)),
  );
  const [accountingDataOpen, setAccountingDataOpen] = useState(
    ACCOUNTING_DATA_ROUTES.some((p) => location.pathname.startsWith(p)),
  );
  const [deliveryDataOpen, setDeliveryDataOpen] = useState(
    DELIVERY_DATA_ROUTES.some((p) => location.pathname.startsWith(p)),
  );
  const [catalogOpen, setCatalogOpen] = useState(
    CATALOG_ROUTES.some((p) => location.pathname.startsWith(p)),
  );
  const [userSettingsOpen, setUserSettingsOpen] = useState(
    USER_SETTINGS_ROUTES.some((p) => location.pathname.startsWith(p)),
  );
  const [jobsOpen, setJobsOpen] = useState(
    JOBS_ROUTES.some((p) => location.pathname.startsWith(p)),
  );

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const baseNavItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  ];

  const deliveryDataSubItems = [
    { to: '/delivery-data/5-houses', icon: Truck, label: t('deliveryData.process5Houses' as never) },
    { to: '/delivery-data/rice', icon: FileSpreadsheet, label: t('deliveryData.processRice' as never) },
  ];

  const vehicleDataSubItems = [
    { to: '/vehicle-data/delivery-schedule', icon: FileSpreadsheet, label: t('vehicleData.deliverySchedule' as never) },
    { to: '/vehicle-data/driver-invoices', icon: ReceiptText, label: t('vehicleData.driverInvoices' as never) },
    { to: '/vehicle-data/inspections', icon: ClipboardCheck, label: 'Quản lý đăng kiểm' },
    { to: '/vehicle-data/oil-changes', icon: Beaker, label: 'Quản lý thay nhớt' },
    { to: '/vehicle-data/insurances', icon: ShieldCheck, label: 'Quản lý bảo hiểm' },
    { to: '/vehicle-data/repairs', icon: Wrench, label: 'Lịch sử sửa xe' },
    { to: '/fuel-data', icon: Droplets, label: 'Quản lý dữ liệu dầu' },
    { to: '/fuel-data/statistics', icon: BarChart3, label: 'Thống kê dầu' },
  ];

  const dispatchSubItems = [
    { to: '/dispatch/schedule', icon: CalendarRange, label: t('dispatch.schedule.title' as never) },
  ];

  const showUserSettings = hasAnyPermission(['users.view', 'roles.view', 'permissions.manage'])
    || user?.role === 'ADMIN';

  const showCatalog = hasAnyPermission(['catalog.view', 'catalog.manage'])
    || user?.role === 'ADMIN';

  const showVehicleData = hasAnyPermission(['transport.view', 'transport.manage'])
    || hasAnyPermission(['fuel.view', 'fuel.manage'])
    || hasAnyPermission(['vehicle_data.view', 'vehicle_data.manage'])
    || user?.role === 'ADMIN';

  const showDispatch = hasAnyPermission(['dispatch.view', 'dispatch.manage'])
    || user?.role === 'ADMIN';

  const showAccountingData = hasAnyPermission(['accounting_data.view', 'accounting_data.manage'])
    || user?.role === 'ADMIN';

  const showJobs = hasAnyPermission(['jobs.view', 'jobs.manage'])
    || user?.role === 'ADMIN';

  const showDeliveryData = hasAnyPermission(['delivery_data.view', 'delivery_data.manage'])
    || user?.role === 'ADMIN';

  const showRoutePricing = hasAnyPermission(['route_pricing.view', 'route_pricing.manage'])
    || user?.role === 'ADMIN';

  if (showRoutePricing) {
    baseNavItems.push({ to: '/route-pricing', icon: MapPinned, label: 'Giá theo tuyến' });
  }

  const userSettingsSubItems = [
    hasPermission('users.view') || user?.role === 'ADMIN'
      ? { to: '/users', icon: Users, label: t('sidebar.userManagement') }
      : null,
    hasPermission('roles.view') || user?.role === 'ADMIN'
      ? { to: '/roles', icon: Shield, label: t('sidebar.roleManagement') }
      : null,
    hasPermission('permissions.manage') || user?.role === 'ADMIN'
      ? { to: '/permissions', icon: Lock, label: t('sidebar.permissionManagement') }
      : null,
    hasPermission('logs.view') || user?.role === 'ADMIN'
      ? { to: '/logs', icon: FileText, label: 'Nhật ký hệ thống' }
      : null,
  ].filter(Boolean) as { to: string; icon: typeof Users; label: string }[];

  const isUserSettingsActive = USER_SETTINGS_ROUTES.some((p) =>
    location.pathname.startsWith(p),
  );
  const isDispatchActive = DISPATCH_ROUTES.some((p) => location.pathname.startsWith(p));
  const isAccountingDataActive = ACCOUNTING_DATA_ROUTES.some((p) => location.pathname.startsWith(p));
  const isDeliveryDataActive = DELIVERY_DATA_ROUTES.some((p) => location.pathname.startsWith(p));
  const isCatalogActive = CATALOG_ROUTES.some((p) => location.pathname.startsWith(p));
  const isJobsActive = JOBS_ROUTES.some((p) => location.pathname.startsWith(p));

  const accountingDataSubItems = [
    { to: '/accounting-data/weight-adjustments', icon: Scale, label: t('accountingData.weightAdjustment' as never) },
    { to: '/accounting-data/customers', icon: Users, label: t('customers.title' as never) },
    { to: '/accounting-data/delivery-import', icon: Upload, label: 'Import 5 nhà' },
    { to: '/accounting-data/invoice-matching', icon: FileSearch, label: 'Đối chiếu HĐ' },
  ];

  const catalogSubItems = [
    { to: '/catalog/vehicles', icon: Car, label: t('catalog.vehicles') },
    { to: '/catalog/inner-city-customers', icon: Building2, label: t('catalog.innerCityCustomers') },
    { to: '/catalog/suppliers', icon: Truck, label: t('catalog.suppliers') },
    { to: '/catalog/promo-items', icon: Gift, label: t('catalog.promoItems') },
  ];

  const jobsSubItems = [
    { to: '/jobs/reconcile', icon: RefreshCw, label: 'Cấu hình Job' },
  ];

  const renderSubGroup = (
    label: string,
    icon: React.ElementType,
    subItems: { to: string; icon: React.ElementType; label: string }[],
    isOpen: boolean,
    onToggle: () => void,
    isActive: boolean,
  ) => {
    const Icon = icon;
    if (!isCollapsed) {
      return (
        <div>
          <button
            onClick={onToggle}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              isActive
                ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100'
                : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-100',
            )}
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            <span className="flex-1 text-left">{label}</span>
            {isOpen ? (
              <ChevronUp className="w-4 h-4 flex-shrink-0" />
            ) : (
              <ChevronDown className="w-4 h-4 flex-shrink-0" />
            )}
          </button>
          {isOpen && (
            <div className="ml-4 mt-1 space-y-0.5 border-l border-neutral-200 dark:border-neutral-700 pl-3">
              {subItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive: a }) =>
                    cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                      a
                        ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100'
                        : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-100',
                    )
                  }
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          )}
        </div>
      );
    }

    // Collapsed: show subItems as icon-only links
    return subItems.map((item) => (
      <NavLink
        key={item.to}
        to={item.to}
        title={item.label}
        className={({ isActive: a }) =>
          cn(
            'flex items-center justify-center px-2 py-2.5 rounded-lg text-sm font-medium transition-colors',
            a
              ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100'
              : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-100',
          )
        }
      >
        <item.icon className="w-5 h-5 flex-shrink-0" />
      </NavLink>
    ));
  };

  return (
    <div className="flex h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Sidebar */}
      <aside
        className={cn(
          'bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 flex flex-col transition-all duration-200 ease-in-out',
          isCollapsed ? 'w-16' : 'w-64',
        )}
      >
        {/* Logo + toggle */}
        <div
          className={cn(
            'flex items-center border-b border-neutral-200 dark:border-neutral-800 px-3 py-5',
            isCollapsed ? 'justify-center' : 'justify-between px-6',
          )}
        >
          <div className={cn('flex items-center gap-3', isCollapsed && 'justify-center')}>
            <div className="w-8 h-8 bg-neutral-800 dark:bg-neutral-200 rounded-lg flex items-center justify-center flex-shrink-0">
              <Calculator className="w-5 h-5 text-white dark:text-neutral-900" />
            </div>
            {!isCollapsed && (
              <span className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 whitespace-nowrap">
                PhuPhatCorp
              </span>
            )}
          </div>
          {!isCollapsed && (
            <button
              onClick={() => setIsCollapsed(true)}
              className="p-1 text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
              title={t('sidebar.collapse')}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Expand button when collapsed */}
        {isCollapsed && (
          <div className="flex justify-center px-3 py-2 border-b border-neutral-200 dark:border-neutral-800">
            <button
              onClick={() => setIsCollapsed(false)}
              className="p-1 text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
              title={t('sidebar.expand')}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Nav */}
        <nav className={cn('flex-1 py-4 space-y-1 overflow-y-auto', isCollapsed ? 'px-2' : 'px-3')}>
          {baseNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              title={isCollapsed ? item.label : undefined}
              className={({ isActive }) =>
                cn(
                  'flex items-center rounded-lg text-sm font-medium transition-colors',
                  isCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5',
                  isActive
                    ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100'
                    : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-100',
                )
              }
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!isCollapsed && item.label}
            </NavLink>
          ))}

          {/* Delivery Data collapsible group */}
          {showDeliveryData &&
            renderSubGroup(
            t('deliveryData.menuTitle' as never),
            Truck,
            deliveryDataSubItems,
            deliveryDataOpen,
            () => setDeliveryDataOpen((o) => !o),
            isDeliveryDataActive,
          )}

          {/* Vehicle Data collapsible group */}
          {showVehicleData && renderSubGroup(
            t('vehicleData.menuTitle'),
            Car,
            vehicleDataSubItems,
            vehicleDataOpen,
            () => setVehicleDataOpen((o) => !o),
            location.pathname.startsWith('/vehicle-data') || location.pathname.startsWith('/fuel-data'),
          )}

          {/* Điều hành vận tải collapsible group */}
          {showDispatch && renderSubGroup(
            t('dispatch.menuTitle' as never),
            Truck,
            dispatchSubItems,
            dispatchOpen,
            () => setDispatchOpen((o) => !o),
            isDispatchActive,
          )}

          {/* Quản lý dữ liệu kế toán collapsible group */}
          {showAccountingData && renderSubGroup(
            t('accountingData.menuTitle' as never),
            BookOpen,
            accountingDataSubItems,
            accountingDataOpen,
            () => setAccountingDataOpen((o) => !o),
            isAccountingDataActive,
          )}

          {/* Thiết lập người dùng collapsible group */}
          {showUserSettings &&
            renderSubGroup(
              t('sidebar.userSettings'),
              Settings,
              userSettingsSubItems,
              userSettingsOpen,
              () => setUserSettingsOpen((o) => !o),
              isUserSettingsActive,
            )}

          {/* Quản lý danh mục collapsible group */}
          {showCatalog &&
            renderSubGroup(
            t('catalog.menuTitle'),
            FolderOpen,
            catalogSubItems,
            catalogOpen,
            () => setCatalogOpen((o) => !o),
            isCatalogActive,
          )}

          {/* Quản lý Job collapsible group */}
          {showJobs &&
            renderSubGroup(
            'Quản lý Job',
            RefreshCw,
            jobsSubItems,
            jobsOpen,
            () => setJobsOpen((o) => !o),
            isJobsActive,
          )}
        </nav>

        {/* User */}
        <div
          className={cn(
            'py-4 border-t border-neutral-200 dark:border-neutral-800',
            isCollapsed ? 'px-2' : 'px-4',
          )}
        >
          {isCollapsed ? (
            <div className="flex flex-col items-center gap-2">
              <ThemeToggle />
              <div
                className="w-8 h-8 bg-neutral-200 dark:bg-neutral-700 rounded-full flex items-center justify-center text-sm font-medium text-neutral-600 dark:text-neutral-300"
                title={user?.full_name || 'User'}
              >
                {user?.full_name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <button
                onClick={handleLogout}
                className="p-1.5 text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                title={t('sidebar.logout')}
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 bg-neutral-200 dark:bg-neutral-700 rounded-full flex items-center justify-center text-sm font-medium text-neutral-600 dark:text-neutral-300 flex-shrink-0">
                  {user?.full_name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                    {user?.full_name || 'User'}
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-500 truncate">{user?.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <ThemeToggle />
                <button
                  onClick={handleLogout}
                  className="p-1.5 text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                  title={t('sidebar.logout')}
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
