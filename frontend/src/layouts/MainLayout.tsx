import { useState, useEffect } from 'react';
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
  Receipt,
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
  BarChart3,
  FileCheck,
  Menu,
  X,
  GitMerge,
  HelpCircle,
} from 'lucide-react';
import { cn } from '../utils/cn';
import { useAuth } from '../hooks/useAuth';
import { useI18n } from '../i18n/useI18n';
import { ThemeToggle } from '../components/ui/ThemeToggle';

const USER_SETTINGS_ROUTES = ['/users', '/roles', '/permissions', '/settings/data-scopes', '/settings/workflows', '/logs'];
const DISPATCH_ROUTES = ['/dispatch', '/invoice-tracking'];
const ACCOUNTING_DATA_ROUTES = ['/accounting-data'];
const DELIVERY_DATA_ROUTES = ['/delivery-data'];
const CATALOG_ROUTES = ['/catalog'];
const JOBS_ROUTES = ['/jobs'];
const ROUTE_PRICING_ROUTES = ['/route-pricing'];

export function MainLayout() {
  const { user, logout, hasPermission, hasAnyPermission } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
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
  const [routePricingOpen, setRoutePricingOpen] = useState(
    ROUTE_PRICING_ROUTES.some((p) => location.pathname.startsWith(p)),
  );

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [location.pathname]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileDrawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileDrawerOpen]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const baseNavItems = [
    hasPermission('dashboard.view') || user?.role === 'ADMIN'
      ? { to: '/', icon: LayoutDashboard, label: 'Dashboard' }
      : null,
  ].filter(Boolean) as { to: string; icon: typeof LayoutDashboard; label: string }[];

  const deliveryDataSubItems = [
    { to: '/delivery-data/5-houses', icon: Truck, label: t('deliveryData.process5Houses' as never) },
    { to: '/delivery-data/rice', icon: FileSpreadsheet, label: t('deliveryData.processRice' as never) },
  ];

  const vehicleDataSubItems = [
    { to: '/vehicle-data/driver-invoices', icon: ReceiptText, label: t('vehicleData.driverInvoices' as never) },
    { to: '/vehicle-data/inspections', icon: ClipboardCheck, label: 'Quản lý đăng kiểm' },
    { to: '/vehicle-data/oil-changes', icon: Beaker, label: 'Quản lý thay nhớt' },
    { to: '/vehicle-data/insurances', icon: ShieldCheck, label: 'Quản lý bảo hiểm' },
    { to: '/vehicle-data/repairs', icon: Wrench, label: 'Lịch sử sửa xe' },
    { to: '/fuel-data', icon: Droplets, label: 'Quản lý dữ liệu dầu' },
    { to: '/fuel-data/statistics', icon: BarChart3, label: 'Thống kê dầu' },
  ];

  const dispatchSubItems = [
    hasPermission('dispatch.view') || user?.role === 'ADMIN'
      ? { to: '/dispatch/schedule', icon: CalendarRange, label: t('dispatch.schedule.title' as never) }
      : null,
    hasPermission('invoice_tracking.view') || user?.role === 'ADMIN'
      ? { to: '/invoice-tracking', icon: FileCheck, label: t('invoice_tracking.page.title' as never) }
      : null,
  ].filter(Boolean) as { to: string; icon: typeof CalendarRange; label: string }[];

  const showUserSettings = hasAnyPermission(['users.view', 'roles.view', 'permissions.manage', 'data_scopes.view', 'workflows.view', 'logs.view'])
    || user?.role === 'ADMIN';

  const showCatalog = hasAnyPermission(['catalog.view', 'catalog.manage'])
    || user?.role === 'ADMIN';

  const showVehicleData = hasAnyPermission(['fuel.view', 'fuel.manage'])
    || hasAnyPermission(['vehicle_data.view', 'vehicle_data.manage'])
    || user?.role === 'ADMIN';

  const showDispatch = hasAnyPermission(['dispatch.view', 'dispatch.manage', 'invoice_tracking.view', 'invoice_tracking.manage'])
    || user?.role === 'ADMIN';

  const showAccountingData = hasAnyPermission(['accounting_data.view', 'accounting_data.manage'])
    || user?.role === 'ADMIN';

  const showJobs = hasAnyPermission(['jobs.view', 'jobs.manage'])
    || user?.role === 'ADMIN';

  const showDeliveryData = hasAnyPermission(['delivery_data.view', 'delivery_data.manage'])
    || user?.role === 'ADMIN';

  const showRoutePricing = hasAnyPermission(['route_pricing.view', 'route_pricing.manage'])
    || user?.role === 'ADMIN';

  const priceBookId = new URLSearchParams(location.search).get('priceBookId');
  const priceBookQuery = priceBookId ? `?priceBookId=${encodeURIComponent(priceBookId)}` : '';
  const routePricingSubItems = [
    { to: `/route-pricing/periods${priceBookQuery}`, icon: CalendarRange, label: t('routePricing.nav.periods') },
    { to: `/route-pricing/sets${priceBookQuery}`, icon: BookOpen, label: t('routePricing.nav.sets') },
    { to: `/route-pricing/routes${priceBookQuery}`, icon: MapPinned, label: t('routePricing.nav.routes') },
    { to: `/route-pricing/matrix${priceBookQuery}`, icon: FileSpreadsheet, label: t('routePricing.nav.matrix') },
    { to: '/route-pricing/surcharges', icon: Receipt, label: t('routePricing.nav.surcharges') },
  ];

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
    hasPermission('data_scopes.view') || user?.role === 'ADMIN'
      ? { to: '/settings/data-scopes', icon: Shield, label: t('sidebar.dataScopeManagement' as never) || 'Phạm vi dữ liệu' }
      : null,
    hasPermission('workflows.view') || user?.role === 'ADMIN'
      ? { to: '/settings/workflows', icon: GitMerge, label: t('sidebar.workflowManagement' as never) || 'Cấu hình quy trình' }
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
    { to: '/accounting-data/bang-ke-tho', icon: FileSpreadsheet, label: t('bangKeTho.nav' as never) },
    { to: '/accounting-data/invoice-matching', icon: FileSearch, label: 'Đối chiếu HĐ' },
  ];

  const catalogSubItems = [
    { to: '/catalog/vehicles', icon: Car, label: t('catalog.vehicles') },
    { to: '/catalog/drivers', icon: Users, label: t('catalog.drivers') },
    { to: '/catalog/inner-city-customers', icon: Building2, label: t('catalog.innerCityCustomers') },
    { to: '/catalog/suppliers', icon: Truck, label: t('catalog.suppliers') },
    { to: '/catalog/promo-items', icon: Gift, label: t('catalog.promoItems') },
    { to: '/catalog/delivery-points', icon: MapPinned, label: t('catalog.deliveryPoints') },
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
    if (!isCollapsed || mobileDrawerOpen) {
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
    <div className="flex h-screen bg-neutral-50 dark:bg-neutral-950 overflow-hidden">
      {/* Mobile Top App Header (< md) */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 z-30 px-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setMobileDrawerOpen(true)}
            className="p-2 -ml-1 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
            aria-label="Mở menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-neutral-900 dark:bg-neutral-100 rounded-lg flex items-center justify-center">
              <Calculator className="w-4 h-4 text-white dark:text-neutral-900" />
            </div>
            <span className="font-bold text-base text-neutral-900 dark:text-neutral-100">
              PhuPhatCorp
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <div
            className="w-7 h-7 bg-neutral-200 dark:bg-neutral-700 rounded-full flex items-center justify-center text-xs font-semibold text-neutral-700 dark:text-neutral-200"
            title={user?.full_name || 'User'}
          >
            {user?.full_name?.charAt(0).toUpperCase() || 'U'}
          </div>
        </div>
      </header>

      {/* Backdrop for Mobile Drawer */}
      {mobileDrawerOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden transition-opacity backdrop-blur-xs"
          onClick={() => setMobileDrawerOpen(false)}
        />
      )}

      {/* Sidebar (Desktop static / Mobile slide-over drawer) */}
      <aside
        className={cn(
          'fixed md:static inset-y-0 left-0 z-50 bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 flex flex-col transition-all duration-200 ease-in-out',
          mobileDrawerOpen
            ? 'translate-x-0 w-72 max-w-[85vw] shadow-2xl'
            : '-translate-x-full md:translate-x-0',
          isCollapsed ? 'md:w-16' : 'md:w-64',
        )}
      >
        {/* Logo + toggle */}
        <div
          className={cn(
            'flex items-center border-b border-neutral-200 dark:border-neutral-800 px-3 py-4 sm:py-5',
            isCollapsed && !mobileDrawerOpen ? 'justify-center' : 'justify-between px-5 sm:px-6',
          )}
        >
          <div className={cn('flex items-center gap-3', isCollapsed && !mobileDrawerOpen && 'justify-center')}>
            <div className="w-8 h-8 bg-neutral-800 dark:bg-neutral-200 rounded-lg flex items-center justify-center flex-shrink-0">
              <Calculator className="w-5 h-5 text-white dark:text-neutral-900" />
            </div>
            {(!isCollapsed || mobileDrawerOpen) && (
              <span className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 whitespace-nowrap">
                PhuPhatCorp
              </span>
            )}
          </div>

          {/* Close button for Mobile / Collapse button for Desktop */}
          <div className="flex items-center">
            {mobileDrawerOpen ? (
              <button
                onClick={() => setMobileDrawerOpen(false)}
                className="p-1.5 md:hidden text-neutral-400 dark:text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <X className="w-5 h-5" />
              </button>
            ) : (
              !isCollapsed && (
                <button
                  onClick={() => setIsCollapsed(true)}
                  className="hidden md:block p-1 text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                  title={t('sidebar.collapse')}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )
            )}
          </div>
        </div>

        {/* Expand button when collapsed (Desktop only) */}
        {isCollapsed && !mobileDrawerOpen && (
          <div className="hidden md:flex justify-center px-3 py-2 border-b border-neutral-200 dark:border-neutral-800">
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
        <nav className={cn('flex-1 py-4 space-y-1 overflow-y-auto overscroll-contain', isCollapsed && !mobileDrawerOpen ? 'px-2' : 'px-3')}>
          {baseNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              title={isCollapsed && !mobileDrawerOpen ? item.label : undefined}
              className={({ isActive }) =>
                cn(
                  'flex items-center rounded-lg text-sm font-medium transition-colors',
                  isCollapsed && !mobileDrawerOpen ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5',
                  isActive
                    ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100'
                    : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-100',
                )
              }
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {(!isCollapsed || mobileDrawerOpen) && item.label}
            </NavLink>
          ))}

          {showRoutePricing &&
            renderSubGroup(
              t('routePricing.nav.title'),
              MapPinned,
              routePricingSubItems,
              routePricingOpen,
              () => setRoutePricingOpen((o) => !o),
              location.pathname.startsWith('/route-pricing'),
            )}

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

        {/* User profile footer */}
        <div
          className={cn(
            'py-3.5 sm:py-4 border-t border-neutral-200 dark:border-neutral-800',
            isCollapsed && !mobileDrawerOpen ? 'px-2' : 'px-4',
          )}
        >
          {isCollapsed && !mobileDrawerOpen ? (
            <div className="flex flex-col items-center gap-2">
              <ThemeToggle />
              <NavLink
                to="/support"
                target="_blank"
                rel="noreferrer"
                className="p-1.5 text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                title="Hỗ trợ & Liên hệ"
              >
                <HelpCircle className="w-4 h-4" />
              </NavLink>
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
                <NavLink
                  to="/support"
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                  title="Hỗ trợ & Liên hệ"
                >
                  <HelpCircle className="w-4 h-4" />
                </NavLink>
                <div className="hidden sm:block">
                  <ThemeToggle />
                </div>
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
      <main className="flex-1 overflow-auto pt-14 md:pt-0">
        <Outlet />
      </main>
    </div>
  );
}
