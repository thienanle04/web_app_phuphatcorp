export type PricingUnit = 'chuyen' | 'tan';
export type PricingMode = 'by_weight' | 'by_trips';

export interface Province {
  code: string;
  name: string;
  full_name: string | null;
}

export interface Ward {
  code: string;
  name: string;
  full_name: string | null;
  province_code: string;
}

export interface PriceBook {
  id: number;
  name: string;
  status: 'active' | 'deactive';
  created_at: string;
  updated_at: string;
}

export interface DeliveryRoute {
  id: number;
  price_book_id: number;
  province_code: string;
  ward_code: string | null;
  location_text: string | null;
  note: string | null;
  tinh: string;
  phuong: string;
  status: 'active' | 'deactive';
  group_id?: number | null;
  group_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RouteGroupMember {
  route_id: number;
  province_code: string;
  ward_code: string | null;
  location_text: string | null;
  note: string | null;
  tinh: string;
  phuong: string;
}

export interface RouteGroup {
  id: number;
  price_book_id: number;
  name: string;
  province_code: string;
  tinh: string;
  is_residual: boolean;
  note: string | null;
  status: 'active' | 'deactive';
  members: RouteGroupMember[];
  created_at: string;
  updated_at: string;
}

export interface RoutePriceTier {
  id?: number;
  range_from: number;
  range_to: number | null;
  pricing_unit: PricingUnit;
  price: number;
  min_billable_ton?: number | null;
  sort_order?: number;
}

export interface AdjustmentPeriod {
  id: number;
  start_date: string;
  end_date: string | null;
  percent: number;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface RoutePriceVersion {
  id: number;
  price_config_id: number;
  /** Derived from adjustment period.start_date */
  effective_from: string;
  /** Derived from adjustment period.end_date */
  effective_to: string | null;
  pricing_mode: PricingMode;
  pallet_trip_price: number;
  /** Derived: period.percent when base_version_id set; else null */
  adjustment_percent: number | null;
  base_version_id: number | null;
  adjustment_period_id: number;
  tiers: RoutePriceTier[];
  created_at: string;
}

export interface RoutePriceConfigSummary {
  id: number;
  route_group_id: number;
  group_name: string;
  is_residual: boolean;
  province_code: string;
  tinh: string;
  current_version: RoutePriceVersion | null;
  version_count: number;
}

export interface LookupResult {
  route_group_id: number;
  group_name: string;
  is_residual: boolean;
  price_version_id: number;
  effective_from: string;
  is_pallet: boolean;
  khung_label: string;
  don_vi: 'Chuyến' | 'Tấn';
  pricing_unit: PricingUnit | null;
  price: number;
  billable_ton: number | null;
  pallet_trip_price: number;
}

export interface PriceMatrixPeriod {
  id: number;
  start_date: string;
  end_date: string | null;
  percent: number;
  note: string | null;
}

export interface PriceMatrixWeightColumn {
  key: string;
  kind: 'pallet' | 'weight';
  label: string;
  unit_label: string;
  hint?: string | null;
  range_from?: number;
  range_to?: number | null;
  pricing_unit?: PricingUnit;
  min_billable_ton?: number | null;
}

export interface PriceMatrixWeightRow {
  stt: number;
  route_group_id: number;
  group_name: string;
  is_residual: boolean;
  province_code: string;
  tinh: string;
  cells: Record<string, Record<string, number | null>>;
}

export interface PriceMatrixWeightTable {
  schema_key: string;
  schema_label: string;
  columns: PriceMatrixWeightColumn[];
  rows: PriceMatrixWeightRow[];
}

export interface PriceMatrixTripsRow {
  stt: number;
  route_group_id: number;
  group_name: string;
  is_residual: boolean;
  province_code: string;
  tinh: string;
  row_kind: 'pallet' | 'trips';
  trips_label: string;
  range_from: number | null;
  range_to: number | null;
  cells: Record<string, number | null>;
}

export interface PriceMatrixResponse {
  periods: PriceMatrixPeriod[];
  weight_tables: PriceMatrixWeightTable[];
  trips: { rows: PriceMatrixTripsRow[] };
}

export function roundToThousands(value: number): number {
  return Math.round(value / 1000) * 1000;
}

export function noteKey(note?: string | null): string {
  return (note ?? '').trim();
}

export function normalizeLocation(text: string): string {
  return text.trim();
}
