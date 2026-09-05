import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthLayout } from './layouts/AuthLayout';
import { MainLayout } from './layouts/MainLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { UserManagementPage } from './pages/admin/UserManagementPage';
import { DeliveryDataPage } from './pages/admin/DeliveryDataPage';
import { RoleManagementPage } from './pages/admin/RoleManagementPage';
import { PermissionManagementPage } from './pages/admin/PermissionManagementPage';
import { SchedulePage } from './pages/dispatch/SchedulePage';
import { WeightAdjustmentPage } from './pages/admin/accounting-data/WeightAdjustmentPage';
import { CustomersPage } from './pages/admin/accounting-data/CustomersPage';
import { DriverInvoicesPage } from './pages/admin/accounting-data/DriverInvoicesPage';
import { DeliverySchedulePage } from './pages/admin/vehicle-data/DeliverySchedulePage';
import { RiceDeliveryDataPage } from './pages/admin/RiceDeliveryDataPage';
import { DeliveryImportPage } from './pages/admin/accounting-data/DeliveryImportPage';
import { InvoiceMatchingPage } from './pages/admin/accounting-data/InvoiceMatchingPage';
import { VehicleCatalogPage } from './pages/admin/catalog/VehicleCatalogPage';
import { VehicleDetailPage } from './pages/admin/catalog/VehicleDetailPage';
import { InnerCityCustomerPage } from './pages/admin/catalog/InnerCityCustomerPage';
import { PromoItemCatalogPage } from './pages/admin/catalog/PromoItemCatalogPage';
import { SupplierCatalogPage } from './pages/admin/catalog/SupplierCatalogPage';
import { ReconcileJobPage } from './pages/admin/jobs/ReconcileJobPage';
import { AuditLogPage } from './pages/admin/AuditLogPage';
import { FuelDataPage } from './pages/admin/fuel-data/FuelDataPage';
import { FuelStatisticsPage } from './pages/admin/fuel-data/FuelStatisticsPage';
import { InspectionPage } from './pages/admin/vehicle-data/InspectionPage';
import { OilChangePage } from './pages/admin/vehicle-data/OilChangePage';
import { InsurancePage } from './pages/admin/vehicle-data/InsurancePage';
import { RepairPage } from './pages/admin/vehicle-data/RepairPage';
import { RoutePricingPage } from './pages/route-pricing/RoutePricingPage';

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold text-neutral-900">{title}</h1>
      <p className="text-neutral-500 mt-2">Trang đang được phát triển.</p>
    </div>
  );
}

export function Router() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        {/* Protected routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/accounting" element={<PlaceholderPage title="Sổ kế toán" />} />
            <Route path="/reports" element={<PlaceholderPage title="Báo cáo" />} />
            <Route path="/settings" element={<PlaceholderPage title="Cài đặt" />} />
            <Route path="/users" element={<UserManagementPage />} />
            <Route path="/roles" element={<RoleManagementPage />} />
            <Route path="/permissions" element={<PermissionManagementPage />} />
            <Route path="/logs" element={<AuditLogPage />} />
            {/* Delivery Data */}
            <Route path="/delivery-data/5-houses" element={<DeliveryDataPage />} />
            <Route path="/delivery-data/rice" element={<RiceDeliveryDataPage />} />
            {/* Vehicle Data */}
            <Route path="/vehicle-data/delivery-schedule" element={<DeliverySchedulePage />} />
            <Route path="/vehicle-data/driver-invoices" element={<DriverInvoicesPage />} />
            <Route path="/vehicle-data/inspections" element={<InspectionPage />} />
            <Route path="/vehicle-data/oil-changes" element={<OilChangePage />} />
            <Route path="/vehicle-data/insurances" element={<InsurancePage />} />
            <Route path="/vehicle-data/repairs" element={<RepairPage />} />
            {/* Dispatch */}
            <Route path="/dispatch/schedule" element={<SchedulePage />} />
            {/* Accounting Data */}
            <Route path="/accounting-data/weight-adjustments" element={<WeightAdjustmentPage />} />
            <Route path="/accounting-data/customers" element={<CustomersPage />} />
            <Route path="/accounting-data/delivery-import" element={<DeliveryImportPage />} />
            <Route path="/accounting-data/invoice-matching" element={<InvoiceMatchingPage />} />
            {/* Jobs */}
            <Route path="/accounting-data/reconcile-jobs" element={<Navigate to="/jobs/reconcile" replace />} />
            <Route path="/jobs/reconcile" element={<ReconcileJobPage />} />
            {/* Fuel Data */}
            <Route path="/fuel-data" element={<FuelDataPage />} />
            <Route path="/fuel-data/statistics" element={<FuelStatisticsPage />} />
            {/* Catalog */}
            <Route path="/catalog/vehicles" element={<VehicleCatalogPage />} />
            <Route path="/catalog/vehicles/:id" element={<VehicleDetailPage />} />
            <Route path="/catalog/inner-city-customers" element={<InnerCityCustomerPage />} />
            <Route path="/catalog/suppliers" element={<SupplierCatalogPage />} />
            <Route path="/catalog/promo-items" element={<PromoItemCatalogPage />} />
            <Route path="/route-pricing" element={<RoutePricingPage />} />
          </Route>
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
