import type { PriceTierInput, PricingMode } from '../../api/routePricingApi';

export function formatPriceDisplay(value: number | null | undefined): string {
  if (value == null) return '';
  if (Number(value) === 0) return '-';
  return Number(value).toLocaleString('vi-VN');
}

function formatTonNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : String(n);
}

function formatTonRange(fromTon: number, toTon: number | null | undefined): string {
  const from = Number(fromTon);
  if (toTon == null) {
    return from <= 0 ? 'Mọi trọng lượng' : `>${formatTonNumber(from)}`;
  }
  const to = Number(toTon);
  if (from <= 0) return `≤ ${formatTonNumber(to)} tấn`;
  return `>${formatTonNumber(from)}-${formatTonNumber(to)}`;
}

function formatTripsRange(fromTrips: number, toTrips: number | null | undefined): string {
  const from = Number(fromTrips);
  if (toTrips == null) return `Áp dụng từ ${formatTonNumber(from)} chuyến trở lên`;
  const to = Number(toTrips);
  if (from === to) return `Áp dụng cho ${formatTonNumber(from)} chuyến`;
  return `Áp dụng từ ${formatTonNumber(from)} đến ${formatTonNumber(to)} chuyến`;
}

export function formatTierRangeLabel(mode: PricingMode, t: PriceTierInput): string {
  if (mode === 'by_truck') {
    return (t.label ?? '').trim();
  }
  if (mode === 'by_trips') {
    return formatTripsRange(t.range_from ?? 0, t.range_to ?? null);
  }
  let line = formatTonRange(t.range_from ?? 0, t.range_to ?? null);
  if (
    t.pricing_unit === 'tan' &&
    t.min_billable_ton != null &&
    Number(t.min_billable_ton) > 0
  ) {
    line += ` (cước tối thiểu ${formatTonNumber(Number(t.min_billable_ton))} tấn)`;
  }
  return line;
}
