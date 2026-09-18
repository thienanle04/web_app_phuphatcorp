import type { FeeType, PricingUnit, SurchargeZone, VehicleClass } from '../../api/customerSurchargeApi';

export const FEE_TYPES: FeeType[] = ['boc_xep', 'phu_phi_giao_hang', 'chuyen_tai'];
export const ZONES: SurchargeZone[] = ['noi_thanh', 'tinh'];
export const VEHICLE_CLASSES: VehicleClass[] = ['le_2_5', 'gt_8_16', 'gt_16_23', 'pallet'];

export function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function formatMoney(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount);
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Intl.DateTimeFormat('vi-VN').format(new Date(y, m - 1, d));
}

export function supplierToken(name?: string | null, code?: string | null): string | null {
  const trimmedName = name?.trim();
  if (trimmedName) return trimmedName;
  const trimmedCode = code?.trim();
  return trimmedCode || null;
}

export function pointOptionLabel(point: {
  diem_tra_hang: string;
  dia_chi_giao_hang: string;
  supplier_name?: string | null;
  supplier_code?: string | null;
}): string {
  const token = supplierToken(point.supplier_name, point.supplier_code);
  const body = point.dia_chi_giao_hang
    ? `${point.diem_tra_hang} (${point.dia_chi_giao_hang})`
    : point.diem_tra_hang;
  return token ? `${token} - ${body}` : body;
}

export function matchedPointLabel(point: {
  diem_tra_hang: string;
  supplier_name?: string | null;
  supplier_code?: string | null;
}): string {
  const token = supplierToken(point.supplier_name, point.supplier_code);
  return token ? `${token} - ${point.diem_tra_hang}` : point.diem_tra_hang;
}

export function unitFor(feeType: FeeType): PricingUnit {
  return feeType === 'boc_xep' ? 'tan' : 'chuyen';
}

export function apiMessage(err: unknown, fallback: string): string {
  const ax = err as { response?: { data?: { message?: string } } };
  return ax?.response?.data?.message || fallback;
}

export function apiFailures(err: unknown): { ten_khach_hang: string; code: string }[] {
  const data = (err as { response?: { data?: { data?: { failures?: { ten_khach_hang: string; code: string }[] } } } })
    ?.response?.data?.data;
  return Array.isArray(data?.failures) ? data.failures : [];
}
