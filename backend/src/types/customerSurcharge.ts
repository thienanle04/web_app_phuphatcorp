export const FEE_TYPES = ['boc_xep', 'phu_phi_giao_hang', 'chuyen_tai'] as const;
export const ZONES = ['noi_thanh', 'tinh'] as const;
export const VEHICLE_CLASSES = ['le_2_5', 'gt_8_16', 'gt_16_23', 'pallet'] as const;

export type FeeType = (typeof FEE_TYPES)[number];
export type SurchargeZone = (typeof ZONES)[number];
export type VehicleClass = (typeof VEHICLE_CLASSES)[number];
export type PricingUnit = 'tan' | 'chuyen';
export type PointStatus = 'MATCHED' | 'NO_POINT' | 'AMBIGUOUS';
export type FeeReason = 'MATCHED' | 'NO_RULE' | 'AMBIGUOUS';
export type FeeScope = 'diem' | 'dai_ly';

export interface CustomerSurchargeRule {
  id: number;
  ten_khach_hang: string;
  customer_id: number | null;
  fee_type: FeeType;
  zone: SurchargeZone | null;
  vehicle_class: VehicleClass | null;
  amount: number;
  pricing_unit: PricingUnit;
  start_date: string;
  end_date: string | null;
  diem_tra_hang: string | null;
  dia_chi_giao_hang: string | null;
  supplier_name: string | null;
  supplier_code: string | null;
  customer_status: string | null;
  has_closed_prior?: boolean;
  created_at: string;
  updated_at: string;
}

export interface SurchargeNameFailure {
  ten_khach_hang: string;
  code: string;
}

export interface SurchargeListResult {
  items: CustomerSurchargeRule[];
  page: number;
  page_size: number;
  total: number;
}

export interface CustomerOptionPoint {
  id: number;
  ten_khach_hang: string;
  diem_tra_hang: string;
  dia_chi_giao_hang: string;
  supplier_name: string | null;
  supplier_code: string | null;
}

export interface CustomerOptions {
  names: string[];
  points: CustomerOptionPoint[];
}

export interface FeeHit {
  rate: number | null;
  unit: PricingUnit | null;
  reason: FeeReason;
  scope: FeeScope | null;
}

export interface SurchargeLookupResult {
  point_status: PointStatus;
  point: {
    diem_tra_hang: string;
    tuyen_phuong: string | null;
    diem_giao_hang_tinh_phi: string | null;
    supplier_name: string | null;
    supplier_code: string | null;
  } | null;
  fees: Record<FeeType, FeeHit>;
}

export function unitForFee(feeType: FeeType): PricingUnit {
  return feeType === 'boc_xep' ? 'tan' : 'chuyen';
}

const FOLD_FROM = 'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ';
const FOLD_TO = 'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd';

export function nameKey(value: string): string {
  return value.trim().toLowerCase();
}

export function foldName(value: string): string {
  let folded = '';
  for (const ch of nameKey(value)) {
    const at = FOLD_FROM.indexOf(ch);
    folded += at >= 0 ? FOLD_TO[at] : ch;
  }
  return folded;
}

export function foldedExpr(expr: string): string {
  return `translate(lower(trim(${expr})), '${FOLD_FROM}', '${FOLD_TO}')`;
}

export function nameContainsPattern(value: string): string {
  const escaped = foldName(value).replace(/[\\%_]/g, (ch) => `\\${ch}`);
  return `%${escaped}%`;
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function todayIso(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
