export interface OverviewKpis {
  delivered_tons: number;
  invoice_count: number;
  trip_count: number;
  fuel_cost: number;
}

export interface MonthlyTons {
  month: string;
  tons: number;
  invoices: number;
}

export interface ExpiryAlert {
  vehicle_id: number;
  plate_number: string;
  expiry_date: string;
  days_left: number;
}

export interface OverviewAlerts {
  expired_inspections: number;
  due_inspections: ExpiryAlert[];
  expired_insurances: number;
  due_insurances: ExpiryAlert[];
  oil_overdue: number;
  oil_due_soon: number;
  unmatched_invoices: number;
}

export interface OverviewData {
  period: string;
  kpis: OverviewKpis;
  monthly_tons: MonthlyTons[];
  alerts: OverviewAlerts;
  dispatch_today: { xe_nho: number; xe_lon: number; tuyen_ngoai: number };
  last_reconcile: {
    status: string;
    started_at: string | null;
    scanned_count: number;
    matched_count: number;
  } | null;
}

export type ExpiryBucket = 'expired' | 'd30' | 'd60' | 'd90' | 'ok' | 'none';

export interface VehicleExpiryRow {
  vehicle_id: number;
  plate_number: string;
  driver_name: string;
  expiry_date: string | null;
  days_left: number | null;
  bucket: ExpiryBucket;
}

export interface OilChangeDueVehicle {
  vehicle_id: number;
  plate_number: string;
  driver_name: string;
  last_oil_change_date: string | null;
  last_oil_change_km: number | null;
  current_km: number | null;
  interval_km: number;
  km_since_change: number | null;
  km_overdue: number | null;
  status: 'overdue' | 'due_soon' | 'ok' | 'no_data';
}

export interface RepairCostRow {
  vehicle_id: number;
  plate_number: string;
  driver_name: string;
  repair_count: number;
  total_cost: number;
  last_repair_date: string | null;
}

export interface VehicleMaintenanceData {
  inspections: VehicleExpiryRow[];
  insurances: VehicleExpiryRow[];
  oil_changes: OilChangeDueVehicle[];
  repairs: RepairCostRow[];
}

export interface AccountingMonthRow {
  month: string;
  matched: number;
  unmatched: number;
}

export interface BatchInfo {
  batch_id: string;
  original_filename: string;
  total_rows: number;
  total_invoices: number;
  matched_count: number;
  unmatched_count: number;
  min_date: string;
  max_date: string;
  uploaded_by_name: string;
  uploaded_at: string;
}

export interface ReconcileLogRow {
  id: number;
  trigger_type: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  scanned_count: number;
  matched_count: number;
  error_message: string | null;
}

export interface AccountingData {
  totals: { matched: number; unmatched: number; total: number };
  by_month: AccountingMonthRow[];
  recent_batches: BatchInfo[];
  job_logs: ReconcileLogRow[];
}

export interface OperationsDailyRow {
  date: string;
  trips: number;
  tons: number;
}

export interface OperationsVehicleRow {
  so_xe: string;
  trips: number;
  tons: number;
}

export interface OperationsData {
  date_from: string;
  date_to: string;
  summary: { total_trips: number; total_tons: number; vehicle_count: number };
  daily: OperationsDailyRow[];
  by_vehicle: OperationsVehicleRow[];
  driver_invoices: { record_count: number; invoice_count: number };
}

export interface FuelMonthRow {
  month: string;
  liters: number;
  cost: number;
  distance: number;
  avg_fuel_rate: number | null;
}

export interface FuelVehicleRow {
  vehicle_id: number;
  plate_number: string;
  driver_name: string;
  liters: number;
  cost: number;
  distance: number;
  avg_fuel_rate: number | null;
  record_count: number;
}

export interface FuelDeviationRow {
  vehicle_id: number;
  plate_number: string;
  odometer_distance: number;
  gps_distance: number;
  diff: number;
  diff_pct: number | null;
  record_count: number;
}

export interface FuelDashboardData {
  summary: { liters: number; cost: number; distance: number; avg_fuel_rate: number | null };
  by_month: FuelMonthRow[];
  by_vehicle: FuelVehicleRow[];
  deviations: FuelDeviationRow[];
}
