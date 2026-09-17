import type { PoolClient } from 'pg';
import { pool } from '../config/database';
import { materializePricedTiers, normalizePallet, priceSetService } from './priceSetService';
import {
  AdjustmentPeriod, DeliveryRoute, LookupResult, PriceBook, PricingMode, Province, RouteGroup, RouteGroupMember,
  RoutePriceConfigSummary, RoutePriceTier, RoutePriceVersion, Ward,
  PriceMatrixResponse, PriceMatrixTripsRow, PriceMatrixWeightColumn, PriceMatrixWeightTable, PriceMatrixCell, PriceMatrixPeriod,
  noteKey, normalizeLocation, roundToThousands,
} from '../types/routePricing';

type ServiceError = { code: string; message?: string };
type Destination = { ward_code: string | null; location_text: string | null; phuong: string };

const VERSION_SELECT = `SELECT v.*, p.start_date AS period_start_date, p.end_date AS period_end_date, p.percent AS period_percent`;
const VERSION_JOIN = `FROM route_price_versions v
  JOIN route_pricing_adjustment_periods p ON p.id = v.adjustment_period_id`;

function err(code: string, message?: string): ServiceError { return { code, message }; }
function num(value: unknown): number { return typeof value === 'number' ? value : Number(value); }
function nullableNumber(value: unknown): number | null {
  return value == null ? null : num(value);
}
function toDateOnly(value: unknown): string {
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  return String(value).match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? String(value).slice(0, 10);
}
function toDateOnlyOrNull(value: unknown): string | null { return value == null ? null : toDateOnly(value); }
function isPgUniqueViolation(error: unknown): boolean { return (error as { code?: string })?.code === '23505'; }
function uniqueConstraintName(error: unknown): string { return String((error as { constraint?: string })?.constraint ?? ''); }
function cleanNote(note?: string | null): string | null { return noteKey(note) || null; }
function buildGroupName(tinh: string, destNames: string[], note?: string | null): string {
  const base = destNames.length ? `${tinh} - ${destNames.join('/ ')}` : tinh;
  const key = noteKey(note);
  return key ? `${base} (${key})` : base;
}

function parsePricingMode(value: unknown): PricingMode {
  if (value === 'by_weight' || value === 'by_trips' || value === 'by_truck') return value;
  throw err('INVALID_TIERS', 'pricing_mode không hợp lệ');
}

function truckLabel(tier: { label?: string | null }): string {
  return String(tier.label ?? '').trim();
}

/** Ton intervals `(from, to]` — left-open, right-closed. */
function openClosedOverlap(aFrom: number, aTo: number | null, bFrom: number, bTo: number | null): boolean {
  return (aTo == null || bFrom < aTo) && (bTo == null || aFrom < bTo);
}

/** Trips intervals `[from, to]` / `[from, ∞)` — closed; null upper = ∞. */
function closedRangesOverlap(aFrom: number, aTo: number | null, bFrom: number, bTo: number | null): boolean {
  const aEnd = aTo ?? Number.POSITIVE_INFINITY;
  const bEnd = bTo ?? Number.POSITIVE_INFINITY;
  return aFrom <= bEnd && bFrom <= aEnd;
}

function validateTiers(mode: PricingMode, tiers: RoutePriceTier[]): void {
  if (mode === 'by_truck') {
    if (!tiers.length) throw err('INVALID_TIERS', 'Cần ít nhất 1 bậc');
    const seen = new Set<string>();
    for (const tier of tiers) {
      if (tier.pricing_unit !== 'chuyen' && tier.pricing_unit !== 'tan') {
        throw err('INVALID_TIERS', 'pricing_unit không hợp lệ');
      }
      if (!(num(tier.price) >= 0) || Number.isNaN(num(tier.price))) {
        throw err('INVALID_TIERS', 'Giá phải ≥ 0');
      }
      const label = truckLabel(tier);
      if (!label) throw err('INVALID_TIERS', 'Nhãn loại xe không được trống');
      if (label.length > 255) throw err('INVALID_TIERS', 'Nhãn loại xe tối đa 255 ký tự');
      if (seen.has(label)) throw err('INVALID_TIERS', 'Các bậc trùng nhãn');
      seen.add(label);
      if (tier.min_billable_ton != null && num(tier.min_billable_ton) !== 0) {
        throw err('INVALID_TIERS', 'Min tính không dùng ở chế độ loại xe');
      }
    }
    return;
  }

  if (mode === 'by_trips') {
    if (tiers.length < 1) throw err('INVALID_TIERS', 'Chế độ chuyến/xe/ngày cần ít nhất 1 bậc');
  } else if (!tiers.length) {
    throw err('INVALID_TIERS', 'Cần ít nhất 1 bậc');
  }

  for (const tier of tiers) {
    if (tier.pricing_unit !== 'chuyen' && tier.pricing_unit !== 'tan') {
      throw err('INVALID_TIERS', 'pricing_unit không hợp lệ');
    }
    if (!(num(tier.price) >= 0) || Number.isNaN(num(tier.price))) {
      throw err('INVALID_TIERS', 'Giá phải ≥ 0');
    }
    const from = num(tier.range_from);
    const to = nullableNumber(tier.range_to);

    if (mode === 'by_weight') {
      if (!(from >= 0)) throw err('INVALID_TIERS', 'range_from không hợp lệ');
      if (to != null && !(from < to)) throw err('INVALID_TIERS', 'range_from phải < range_to');
      if (tier.pricing_unit === 'chuyen') {
        if (tier.min_billable_ton != null && num(tier.min_billable_ton) !== 0) {
          throw err('INVALID_TIERS', 'Min tính chỉ dùng khi đơn vị Tấn');
        }
      } else if (tier.min_billable_ton != null && num(tier.min_billable_ton) !== 0 && !(num(tier.min_billable_ton) > 0)) {
        throw err('INVALID_TIERS', 'min_billable_ton phải > 0');
      }
    } else {
      if (tier.pricing_unit !== 'chuyen') throw err('INVALID_TIERS', 'Chế độ chuyến chỉ dùng đơn vị Chuyến');
      if (tier.min_billable_ton != null && num(tier.min_billable_ton) !== 0) {
        throw err('INVALID_TIERS', 'Min tính không dùng ở chế độ chuyến/xe/ngày');
      }
      if (!(from >= 1)) throw err('INVALID_TIERS', 'from trips phải ≥ 1');
      if (to != null && !(from <= to)) throw err('INVALID_TIERS', 'from trips phải ≤ to trips ([from, to])');
    }
  }

  if (mode === 'by_weight') {
    for (let left = 0; left < tiers.length; left++) {
      for (let right = left + 1; right < tiers.length; right++) {
        const a = tiers[left];
        const b = tiers[right];
        if (!openClosedOverlap(num(a.range_from), nullableNumber(a.range_to), num(b.range_from), nullableNumber(b.range_to))) {
          continue;
        }
        throw err('INVALID_TIERS', 'Các bậc chồng nhau');
      }
    }
    return;
  }

  const sorted = [...tiers].sort((a, b) => num(a.range_from) - num(b.range_from));
  if (num(sorted[0].range_from) !== 1) throw err('INVALID_TIERS', 'Bậc đầu phải từ 1 chuyến/xe/ngày');
  if (nullableNumber(sorted[sorted.length - 1].range_to) != null) {
    throw err('INVALID_TIERS', 'Bậc cuối phải mở đến ∞');
  }
  for (let i = 0; i < sorted.length - 1; i++) {
    const curTo = nullableNumber(sorted[i].range_to);
    if (curTo == null) throw err('INVALID_TIERS', 'Chỉ bậc cuối được mở ∞');
    const nextFrom = num(sorted[i + 1].range_from);
    if (nextFrom !== curTo + 1) {
      throw err('INVALID_TIERS', 'Các bậc chuyến phải liền mạch (n → n+1)');
    }
  }
  for (let left = 0; left < sorted.length; left++) {
    for (let right = left + 1; right < sorted.length; right++) {
      if (
        closedRangesOverlap(
          num(sorted[left].range_from),
          nullableNumber(sorted[left].range_to),
          num(sorted[right].range_from),
          nullableNumber(sorted[right].range_to),
        )
      ) {
        throw err('INVALID_TIERS', 'Các bậc chồng nhau');
      }
    }
  }
}

function matchTier(
  mode: PricingMode,
  tiers: RoutePriceTier[],
  weight: number,
  tripsPerVehicleDay?: number | null,
): RoutePriceTier {
  const matches = tiers.filter((tier) => {
    if (mode === 'by_trips') {
      if (tripsPerVehicleDay == null) return false;
      const from = num(tier.range_from);
      const to = nullableNumber(tier.range_to);
      return tripsPerVehicleDay >= from && (to == null || tripsPerVehicleDay <= to);
    }
    return weight > num(tier.range_from) && (tier.range_to == null || weight <= num(tier.range_to));
  });
  if (!matches.length) {
    if (mode === 'by_trips' && tripsPerVehicleDay == null) {
      throw err('INVALID_TIERS', 'Thiếu trips_per_vehicle_day');
    }
    throw err('NOT_FOUND', 'Không khớp bậc điều kiện');
  }
  if (matches.length > 1) throw err('INVALID_TIERS', 'Các bậc điều kiện không rõ ràng');
  return matches[0];
}

function khungLabel(mode: PricingMode, tier: RoutePriceTier): string {
  if (mode === 'by_truck') {
    return truckLabel(tier) || 'Truck';
  }
  if (mode === 'by_trips') {
    const from = num(tier.range_from);
    return tier.range_to == null
      ? `từ ${from} chuyến/xe/ngày trở lên`
      : `${from}–${num(tier.range_to)} chuyến/xe/ngày`;
  }
  return tier.range_to == null
    ? `>${num(tier.range_from)} tấn`
    : `(${num(tier.range_from)}, ${num(tier.range_to)}] tấn`;
}

function mapVersionRow(row: Record<string, unknown>, tiers: RoutePriceTier[]): RoutePriceVersion {
  const baseVersionId = row.base_version_id == null ? null : num(row.base_version_id);
  return {
    id: num(row.id),
    price_config_id: num(row.price_config_id),
    effective_from: toDateOnly(row.period_start_date),
    effective_to: toDateOnlyOrNull(row.period_end_date),
    pricing_mode: parsePricingMode(row.pricing_mode ?? 'by_weight'),
    pallet_trip_price: nullableNumber(row.pallet_trip_price),
    pallet_manual_adjusted: Boolean(row.pallet_manual_adjusted),
    adjustment_percent: baseVersionId == null ? null : num(row.period_percent),
    base_version_id: baseVersionId,
    adjustment_period_id: num(row.adjustment_period_id),
    tiers,
    created_at: String(row.created_at),
  };
}

function mapPeriodRow(row: Record<string, unknown>): AdjustmentPeriod {
  return {
    id: num(row.id),
    start_date: toDateOnly(row.start_date),
    end_date: toDateOnlyOrNull(row.end_date),
    percent: num(row.percent),
    note: (row.note as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

async function insertCopiedTier(
  client: PoolClient,
  versionId: number,
  mode: PricingMode,
  tier: RoutePriceTier,
  price: number,
  manual: boolean,
): Promise<void> {
  const isTruck = mode === 'by_truck';
  await client.query(
    `INSERT INTO route_price_tiers
      (price_version_id,price_set_tier_id,range_from,range_to,pricing_unit,price,min_billable_ton,sort_order,label,is_manual_adjusted)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      versionId,
      tier.price_set_tier_id ?? null,
      isTruck ? 0 : tier.range_from,
      isTruck ? null : tier.range_to ?? null,
      mode === 'by_trips' ? 'chuyen' : tier.pricing_unit,
      price,
      mode === 'by_weight' && tier.pricing_unit === 'tan' && num(tier.min_billable_ton ?? 0) > 0
        ? tier.min_billable_ton
        : null,
      tier.sort_order ?? 0,
      isTruck ? truckLabel(tier) : null,
      manual,
    ],
  );
}

async function insertTiers(
  client: PoolClient,
  versionId: number,
  mode: PricingMode,
  tiers: RoutePriceTier[],
): Promise<void> {
  for (const [sort, tier] of tiers.entries()) {
    const isTruck = mode === 'by_truck';
    await client.query(
      `INSERT INTO route_price_tiers
        (price_version_id,price_set_tier_id,range_from,range_to,pricing_unit,price,min_billable_ton,sort_order,label,is_manual_adjusted)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        versionId,
        tier.price_set_tier_id ?? null,
        isTruck ? 0 : tier.range_from,
        isTruck ? null : tier.range_to ?? null,
        mode === 'by_trips' ? 'chuyen' : tier.pricing_unit,
        tier.price,
        mode === 'by_weight' && tier.pricing_unit === 'tan' && num(tier.min_billable_ton ?? 0) > 0
          ? tier.min_billable_ton
          : null,
        sort,
        isTruck ? truckLabel(tier) : null,
        Boolean(tier.is_manual_adjusted),
      ],
    );
  }
}

function matrixCell(value: number | null, manualAdjusted = false): PriceMatrixCell {
  return { value, manual_adjusted: value == null ? false : Boolean(manualAdjusted) };
}

function tierFingerprint(mode: PricingMode, tier: RoutePriceTier): string {
  if (mode === 'by_truck') return truckTierColumnKey(tier);
  if (mode === 'by_trips') {
    const to = nullableNumber(tier.range_to);
    return `trips:${num(tier.range_from)}-${to == null ? 'inf' : String(to)}`;
  }
  return weightTierColumnKey({
    range_from: num(tier.range_from),
    range_to: nullableNumber(tier.range_to),
    pricing_unit: tier.pricing_unit,
    min_billable_ton: nullableNumber(tier.min_billable_ton),
  });
}

function scaleNullablePallet(value: number | null, percent: number): number | null {
  if (value == null) return null;
  return roundToThousands(value * (1 + percent / 100));
}

function scaleTiers(tiers: RoutePriceTier[], percent: number): RoutePriceTier[] {
  const factor = 1 + percent / 100;
  return tiers.map((tier) => ({
    ...tier,
    price: roundToThousands(num(tier.price) * factor),
  }));
}

function formatTonNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : String(n);
}

/** Exported for unit tests — stable column/schema fingerprint for weight tiers. */
export function weightTierColumnKey(tier: {
  range_from: number;
  range_to: number | null;
  pricing_unit: string;
  min_billable_ton?: number | null;
}): string {
  const min =
    tier.min_billable_ton != null && Number(tier.min_billable_ton) > 0
      ? `:min${Number(tier.min_billable_ton)}`
      : '';
  const to = tier.range_to == null ? 'inf' : String(Number(tier.range_to));
  return `w:${Number(tier.range_from)}-${to}:${tier.pricing_unit}${min}`;
}

export function tierSchemaKey(tiers: RoutePriceTier[]): string {
  return [...tiers]
    .sort((a, b) => num(a.range_from) - num(b.range_from))
    .map((t) =>
      weightTierColumnKey({
        range_from: num(t.range_from),
        range_to: nullableNumber(t.range_to),
        pricing_unit: t.pricing_unit,
        min_billable_ton: nullableNumber(t.min_billable_ton),
      }),
    )
    .join('|');
}

export function tierColumnKeys(tiers: RoutePriceTier[]): string[] {
  const key = tierSchemaKey(tiers);
  return key ? key.split('|') : [];
}

/** True when every key in `subset` appears in `superset` (order ignored). */
export function isTierKeySubset(subset: string[], superset: string[]): boolean {
  if (subset.length === 0) return true;
  const set = new Set(superset);
  return subset.every((k) => set.has(k));
}

/**
 * Merge exact-match weight buckets when one schema's column keys are a subset of another's
 * (e.g. missing ≤2.5 still shares a table with the full 2.5–8–16–23 set).
 * Unrelated schemas (neither ⊆ the other) stay separate.
 */
export function mergeCompatibleWeightBuckets<T extends { columnKeys: string[]; groups: unknown[] }>(
  buckets: T[],
): T[][] {
  const n = buckets.length;
  if (n === 0) return [];
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const unite = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = buckets[i].columnKeys;
      const b = buckets[j].columnKeys;
      if (isTierKeySubset(a, b) || isTierKeySubset(b, a)) unite(i, j);
    }
  }
  const clusters = new Map<number, T[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    const list = clusters.get(root) ?? [];
    list.push(buckets[i]);
    clusters.set(root, list);
  }
  return [...clusters.values()];
}

function buildWeightColumnsFromTierLists(tierLists: RoutePriceTier[][]): PriceMatrixWeightColumn[] {
  const byKey = new Map<string, RoutePriceTier>();
  for (const tiers of tierLists) {
    for (const tier of tiers) {
      const key = weightTierColumnKey({
        range_from: num(tier.range_from),
        range_to: nullableNumber(tier.range_to),
        pricing_unit: tier.pricing_unit,
        min_billable_ton: nullableNumber(tier.min_billable_ton),
      });
      if (!byKey.has(key)) byKey.set(key, tier);
    }
  }
  return buildWeightColumns([...byKey.values()]);
}

function formatWeightTierLabel(tier: RoutePriceTier): { label: string; hint: string | null; unit_label: string } {
  const from = num(tier.range_from);
  const to = nullableNumber(tier.range_to);
  let label: string;
  if (to == null) label = from <= 0 ? 'Mọi trọng lượng' : `>${formatTonNumber(from)}`;
  else if (from <= 0) label = `≤ ${formatTonNumber(to)} tấn`;
  else label = `>${formatTonNumber(from)}-${formatTonNumber(to)}`;
  const hint =
    tier.pricing_unit === 'tan' &&
    tier.min_billable_ton != null &&
    num(tier.min_billable_ton) > 0
      ? `Cước tính min ${formatTonNumber(num(tier.min_billable_ton))} tấn`
      : null;
  const unit_label = tier.pricing_unit === 'chuyen' ? 'vnđ/chuyến' : 'vnđ/tấn';
  return { label, hint, unit_label };
}

function formatTripsTierLabel(tier: RoutePriceTier): string {
  const from = num(tier.range_from);
  const to = nullableNumber(tier.range_to);
  if (to == null) return `từ ${formatTonNumber(from)} chuyến/xe/ngày đi trở lên`;
  if (from === to) return `${formatTonNumber(from)} chuyến/xe/ngày đi`;
  return `${formatTonNumber(from)} - ${formatTonNumber(to)} chuyến/xe/ngày đi`;
}

function buildWeightColumns(tiers: RoutePriceTier[]): PriceMatrixWeightColumn[] {
  const sorted = [...tiers].sort((a, b) => num(a.range_from) - num(b.range_from));
  const columns: PriceMatrixWeightColumn[] = sorted.map((tier) => {
    const meta = formatWeightTierLabel(tier);
    return {
      key: weightTierColumnKey({
        range_from: num(tier.range_from),
        range_to: nullableNumber(tier.range_to),
        pricing_unit: tier.pricing_unit,
        min_billable_ton: nullableNumber(tier.min_billable_ton),
      }),
      kind: 'weight',
      label: meta.label,
      unit_label: meta.unit_label,
      hint: meta.hint,
      range_from: num(tier.range_from),
      range_to: nullableNumber(tier.range_to),
      pricing_unit: tier.pricing_unit,
      min_billable_ton: nullableNumber(tier.min_billable_ton),
    };
  });
  columns.push({
    key: 'pallet',
    kind: 'pallet',
    label: 'Pallet',
    unit_label: 'vnđ/pallet',
    hint: null,
  });
  return columns;
}

function schemaLabelFromColumns(columns: PriceMatrixWeightColumn[]): string {
  return columns.map((c) => c.label).join(' · ');
}

/** Exported for unit tests — ordered fingerprint for by_truck tiers. */
export function truckTierColumnKey(tier: { label?: string | null; pricing_unit: string }): string {
  return `t:${truckLabel(tier)}:${tier.pricing_unit}`;
}

export function truckSchemaKey(tiers: RoutePriceTier[]): string {
  const ordered = tiers.some((t) => t.sort_order != null)
    ? [...tiers].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    : tiers;
  return ordered.map((t) => truckTierColumnKey(t)).join('|');
}

/** Parse class tải từ nhãn Excel `Truck 0,5mt` / `Truck 15mt`. Nhãn khoảng → null. */
export function truckClassMt(label: string): number | null {
  const m = String(label ?? '')
    .trim()
    .match(/(\d+(?:[.,]\d+)?)\s*mt\b/i);
  if (!m) return null;
  const n = Number(m[1].replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function compareTruckColumns(a: PriceMatrixWeightColumn, b: PriceMatrixWeightColumn): number {
  const ma = truckClassMt(a.label);
  const mb = truckClassMt(b.label);
  if (ma != null && mb != null && ma !== mb) return ma - mb;
  if (ma != null && mb == null) return -1;
  if (ma == null && mb != null) return 1;
  return a.label.localeCompare(b.label, 'vi');
}

function truckColumnFromTier(tier: RoutePriceTier): PriceMatrixWeightColumn {
  return {
    key: truckTierColumnKey(tier),
    kind: 'truck',
    label: truckLabel(tier),
    unit_label: tier.pricing_unit === 'chuyen' ? 'vnđ/chuyến' : 'vnđ/tấn',
    hint: null,
    pricing_unit: tier.pricing_unit,
  };
}

function palletTruckColumn(): PriceMatrixWeightColumn {
  return {
    key: 'pallet',
    kind: 'pallet',
    label: 'Pallet',
    unit_label: 'vnđ/chuyến',
    hint: null,
  };
}

/** Union truck columns across groups, ordered by class tải (0,5 → 15), Pallet last. */
export function buildUnionTruckColumns(tierLists: RoutePriceTier[][]): PriceMatrixWeightColumn[] {
  const seen = new Set<string>();
  const columns: PriceMatrixWeightColumn[] = [];
  for (const tiers of tierLists) {
    const ordered = [...tiers].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    for (const tier of ordered) {
      const key = truckTierColumnKey(tier);
      if (seen.has(key)) continue;
      seen.add(key);
      columns.push(truckColumnFromTier(tier));
    }
  }
  columns.sort(compareTruckColumns);
  columns.push(palletTruckColumn());
  return columns;
}

async function insertScaledVersionsFromBases(
  client: PoolClient,
  bases: Record<string, unknown>[],
  data: {
    percent: number;
    adjustment_period_id: number;
  },
  userId: number,
): Promise<number> {
  if (data.percent === 0 || Number.isNaN(data.percent)) throw err('INVALID_TIERS', 'Phần trăm không hợp lệ');
  for (const old of bases) {
    if (
      (
        await client.query(
          `SELECT id FROM route_price_versions WHERE price_config_id=$1 AND adjustment_period_id=$2`,
          [old.price_config_id, data.adjustment_period_id],
        )
      ).rows[0]
    ) {
      throw err('OVERLAPPING_VERSION');
    }
    const mode = parsePricingMode(old.pricing_mode ?? 'by_weight');
    const version = await client.query(
      `INSERT INTO route_price_versions
        (price_config_id,pricing_mode,pallet_trip_price,base_version_id,adjustment_period_id,created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [
        old.price_config_id,
        mode,
        old.pallet_trip_price == null
          ? null
          : roundToThousands(num(old.pallet_trip_price) * (1 + data.percent / 100)),
        old.id,
        data.adjustment_period_id,
        userId,
      ],
    );
    const tiers = await client.query(
      `SELECT * FROM route_price_tiers WHERE price_version_id=$1 ORDER BY sort_order`,
      [old.id],
    );
    await insertTiers(
      client,
      version.rows[0].id,
      mode,
      scaleTiers(
        tiers.rows.map((tier) => ({
          price_set_tier_id: tier.price_set_tier_id == null ? undefined : num(tier.price_set_tier_id),
          range_from: num(tier.range_from),
          range_to: nullableNumber(tier.range_to),
          pricing_unit: tier.pricing_unit,
          price: num(tier.price),
          min_billable_ton: nullableNumber(tier.min_billable_ton),
          label: tier.label,
        })),
        data.percent,
      ),
    );
  }
  return bases.length;
}

async function deleteVersionsByIds(client: PoolClient, ids: number[]): Promise<void> {
  if (!ids.length) return;
  await client.query(
    `UPDATE route_price_versions SET base_version_id=NULL WHERE base_version_id = ANY($1::int[])`,
    [ids],
  );
  await client.query(`DELETE FROM route_price_tiers WHERE price_version_id = ANY($1::int[])`, [ids]);
  await client.query(`DELETE FROM route_price_versions WHERE id = ANY($1::int[])`, [ids]);
}

async function loadVersionRow(versionId: number): Promise<Record<string, unknown>> {
  const result = await pool.query(
    `${VERSION_SELECT} ${VERSION_JOIN} WHERE v.id=$1`,
    [versionId],
  );
  if (!result.rows[0]) throw err('NOT_FOUND');
  return result.rows[0];
}

async function getProvince(code: string): Promise<Province | null> {
  const result = await pool.query<Province>('SELECT code, name, full_name FROM provinces WHERE code = $1', [code]);
  return result.rows[0] ?? null;
}
async function getWard(code: string): Promise<Ward | null> {
  const result = await pool.query<Ward>('SELECT code, name, full_name, province_code FROM wards WHERE code = $1', [code]);
  return result.rows[0] ?? null;
}
async function loadTiers(versionId: number, client?: PoolClient): Promise<RoutePriceTier[]> {
  const q = client ?? pool;
  const result = await q.query(
    `SELECT id, price_set_tier_id, range_from, range_to, pricing_unit, price, min_billable_ton, sort_order, label, is_manual_adjusted
     FROM route_price_tiers WHERE price_version_id = $1 ORDER BY sort_order, range_from`,
    [versionId],
  );
  return result.rows.map((tier) => ({
    id: num(tier.id),
    price_set_tier_id: tier.price_set_tier_id == null ? undefined : num(tier.price_set_tier_id),
    range_from: num(tier.range_from),
    range_to: nullableNumber(tier.range_to),
    pricing_unit: tier.pricing_unit,
    price: num(tier.price),
    min_billable_ton: nullableNumber(tier.min_billable_ton),
    sort_order: num(tier.sort_order),
    label: tier.label == null || String(tier.label).trim() === '' ? null : String(tier.label),
    is_manual_adjusted: Boolean(tier.is_manual_adjusted),
  }));
}
async function loadMembers(groupId: number): Promise<RouteGroupMember[]> {
  const result = await pool.query<RouteGroupMember>(
    `SELECT r.id AS route_id, r.province_code, r.ward_code, r.location_text, r.note, r.tinh, r.phuong
     FROM route_group_members m JOIN delivery_routes r ON r.id = m.route_id
     WHERE m.route_group_id = $1 ORDER BY r.phuong`,
    [groupId],
  );
  return result.rows;
}
async function mapGroup(row: Record<string, unknown>): Promise<RouteGroup> {
  return {
    id: num(row.id), price_book_id: num(row.price_book_id), name: String(row.name), province_code: String(row.province_code),
    tinh: String(row.tinh), is_residual: Boolean(row.is_residual), note: (row.note as string | null) ?? null,
    status: row.status as 'active' | 'deactive', members: await loadMembers(num(row.id)),
    created_at: String(row.created_at), updated_at: String(row.updated_at),
  };
}
function destinationInput(wardCode?: string | null, locationText?: string | null): Destination {
  const ward = wardCode?.trim() || null;
  const location = locationText ? normalizeLocation(locationText) : null;
  if ((ward == null) === (location == null)) throw err('INVALID_DESTINATION', 'Chọn một phường hoặc một địa điểm');
  return { ward_code: ward, location_text: location, phuong: location ?? '' };
}
async function resolveDestinations(
  provinceCode: string,
  wardCodes?: string[],
  locationText?: string | null,
): Promise<Destination[]> {
  const wards = wardCodes ?? [];
  const location =
    locationText != null && String(locationText).trim() !== ''
      ? normalizeLocation(String(locationText))
      : null;
  if (wards.length && location) throw err('INVALID_DESTINATION', 'Không thể trộn phường và địa điểm');
  if (new Set(wards).size !== wards.length) throw err('INVALID_DESTINATION', 'Điểm đến bị lặp');
  const result: Destination[] = [];
  for (const code of wards) {
    const ward = await getWard(code);
    if (!ward || ward.province_code !== provinceCode) throw err('INVALID_WARD');
    result.push({ ward_code: ward.code, location_text: null, phuong: ward.name });
  }
  if (location) {
    result.push({ ward_code: null, location_text: location, phuong: location });
  }
  return result;
}
function destinationNames(destinations: Destination[]): string[] { return destinations.map((destination) => destination.phuong); }

function normalizeBookName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw err('INVALID_PRICE_BOOK_NAME', 'Nhập tên bảng giá');
  return trimmed.slice(0, 255);
}

function mapPriceBook(row: Record<string, unknown>): PriceBook {
  return {
    id: num(row.id),
    name: String(row.name),
    status: row.status as 'active' | 'deactive',
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

async function buildSetTables(
  bundles: Array<{
    id: number;
    name: string;
    is_residual: boolean;
    province_code: string;
    tinh: string;
    price_set_id: number | null;
    price_set_name: string | null;
    set_mode: PricingMode | null;
    has_pallet: boolean;
    byPeriod: Map<number, { pallet_trip_price: number | null; pallet_manual_adjusted: boolean; tiers: RoutePriceTier[] }>;
  }>,
  periods: PriceMatrixPeriod[],
): Promise<PriceMatrixWeightTable[]> {
  const grouped = new Map<number, typeof bundles>();
  for (const bundle of bundles) {
    if (bundle.price_set_id == null || bundle.byPeriod.size === 0) continue;
    const list = grouped.get(bundle.price_set_id) ?? [];
    list.push(bundle);
    grouped.set(bundle.price_set_id, list);
  }
  const tables: PriceMatrixWeightTable[] = [];
  for (const [setId, groups] of grouped) {
    const set = await priceSetService.getActive(setId);
    const pricedIds = new Set<number>();
    let anyPallet = false;
    for (const group of groups) {
      for (const version of group.byPeriod.values()) {
        if (version.pallet_trip_price != null) anyPallet = true;
        for (const tier of version.tiers) {
          if (tier.price_set_tier_id != null) pricedIds.add(tier.price_set_tier_id);
        }
      }
    }
    const columns: PriceMatrixWeightColumn[] = set.tiers
      .filter((tier) => pricedIds.has(tier.id))
      .map((tier) => {
        if (set.pricing_mode === 'by_truck') {
          const col = truckColumnFromTier({ ...tier, range_from: 0, price: 0 });
          return { ...col, key: `set:${tier.id}` };
        }
        if (set.pricing_mode === 'by_trips') {
          return {
            key: `set:${tier.id}`,
            kind: 'weight' as const,
            label: formatTripsTierLabel({ ...tier, range_from: num(tier.range_from), price: 0 }),
            unit_label: 'vnđ/chuyến',
          };
        }
        const formatted = formatWeightTierLabel({ ...tier, range_from: num(tier.range_from), price: 0 });
        return {
          key: `set:${tier.id}`,
          kind: 'weight' as const,
          label: formatted.label,
          hint: formatted.hint,
          unit_label: formatted.unit_label,
          range_from: num(tier.range_from),
          range_to: tier.range_to,
          pricing_unit: tier.pricing_unit,
          min_billable_ton: tier.min_billable_ton,
        };
      });
    if (anyPallet) columns.push(palletTruckColumn());
    if (columns.length === 0) continue;
    const rows = [...groups]
      .sort((a, b) => (a.tinh === b.tinh ? a.name.localeCompare(b.name, 'vi') : a.tinh.localeCompare(b.tinh, 'vi')))
      .map((group, index) => {
        const cells: Record<string, Record<string, PriceMatrixCell>> = {};
        for (const period of periods) {
          const version = group.byPeriod.get(period.id);
          const periodCells: Record<string, PriceMatrixCell> = {};
          for (const col of columns) {
            if (col.kind === 'pallet') {
              periodCells[col.key] = version
                ? matrixCell(version.pallet_trip_price, version.pallet_manual_adjusted)
                : matrixCell(null);
              continue;
            }
            const tierId = Number(col.key.replace('set:', ''));
            const tier = version?.tiers.find((item) => item.price_set_tier_id === tierId);
            periodCells[col.key] = tier
              ? matrixCell(num(tier.price), Boolean(tier.is_manual_adjusted))
              : matrixCell(null);
          }
          cells[String(period.id)] = periodCells;
        }
        return {
          stt: index + 1,
          route_group_id: group.id,
          group_name: group.name,
          is_residual: group.is_residual,
          province_code: group.province_code,
          tinh: group.tinh,
          cells,
        };
      });
    tables.push({
      schema_key: `set:${setId}`,
      schema_label: set.name,
      price_set_id: setId,
      pricing_mode: set.pricing_mode,
      columns,
      rows,
    });
  }
  const modeOrder: Record<PricingMode, number> = { by_weight: 0, by_truck: 1, by_trips: 2 };
  return tables.sort((a, b) => {
    const modeDelta = modeOrder[a.pricing_mode ?? 'by_weight'] - modeOrder[b.pricing_mode ?? 'by_weight'];
    return modeDelta || a.schema_label.localeCompare(b.schema_label, 'vi');
  });
}

export const routePricingService = {
  async listProvinces(): Promise<Province[]> {
    return (await pool.query<Province>('SELECT code, name, full_name FROM provinces ORDER BY name')).rows;
  },
  async listWards(provinceCode: string): Promise<Ward[]> {
    if (!provinceCode) throw err('MISSING_PROVINCE', 'Thiếu province_code');
    return (await pool.query<Ward>('SELECT code, name, full_name, province_code FROM wards WHERE province_code = $1 ORDER BY name', [provinceCode])).rows;
  },

  async listPriceBooks(): Promise<PriceBook[]> {
    const result = await pool.query(
      `SELECT * FROM price_books WHERE status='active' ORDER BY lower(name), id`,
    );
    return result.rows.map(mapPriceBook);
  },
  async createPriceBook(name: string, userId: number): Promise<PriceBook> {
    const bookName = normalizeBookName(name);
    try {
      const result = await pool.query(
        `INSERT INTO price_books (name, created_by, updated_by) VALUES ($1,$2,$2) RETURNING *`,
        [bookName, userId],
      );
      return mapPriceBook(result.rows[0]);
    } catch (error) {
      if (isPgUniqueViolation(error)) throw err('DUPLICATE_PRICE_BOOK', 'Tên bảng giá đã tồn tại');
      throw error;
    }
  },
  async updatePriceBook(id: number, name: string, userId: number): Promise<PriceBook> {
    const existing = await pool.query(`SELECT id FROM price_books WHERE id=$1 AND status='active'`, [id]);
    if (!existing.rows[0]) throw err('PRICE_BOOK_NOT_FOUND');
    const bookName = normalizeBookName(name);
    try {
      const result = await pool.query(
        `UPDATE price_books SET name=$1, updated_by=$2 WHERE id=$3 RETURNING *`,
        [bookName, userId, id],
      );
      return mapPriceBook(result.rows[0]);
    } catch (error) {
      if (isPgUniqueViolation(error)) throw err('DUPLICATE_PRICE_BOOK', 'Tên bảng giá đã tồn tại');
      throw error;
    }
  },
  async deletePriceBook(id: number, userId: number): Promise<void> {
    const existing = await pool.query(`SELECT id FROM price_books WHERE id=$1 AND status='active'`, [id]);
    if (!existing.rows[0]) throw err('PRICE_BOOK_NOT_FOUND');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const groups = await client.query<{ id: number }>(
        `SELECT id FROM route_groups WHERE price_book_id=$1 AND status='active'`,
        [id],
      );
      for (const group of groups.rows) {
        const members = await client.query<{ route_id: number }>(
          `SELECT route_id FROM route_group_members WHERE route_group_id=$1`,
          [group.id],
        );
        await client.query(`DELETE FROM route_group_members WHERE route_group_id=$1`, [group.id]);
        for (const member of members.rows) {
          await client.query(`UPDATE delivery_routes SET status='deactive', updated_by=$1 WHERE id=$2`, [userId, member.route_id]);
        }
        await client.query(`UPDATE route_groups SET status='deactive', updated_by=$1 WHERE id=$2`, [userId, group.id]);
        await client.query(`UPDATE route_price_configs SET status='deactive' WHERE route_group_id=$1`, [group.id]);
      }
      await client.query(
        `UPDATE delivery_routes SET status='deactive', updated_by=$1 WHERE price_book_id=$2 AND status='active'`,
        [userId, id],
      );
      await client.query(`UPDATE price_books SET status='deactive', updated_by=$1 WHERE id=$2`, [userId, id]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async listAdjustmentPeriods(): Promise<AdjustmentPeriod[]> {
    const result = await pool.query(
      `SELECT * FROM route_pricing_adjustment_periods ORDER BY start_date DESC`,
    );
    return result.rows.map(mapPeriodRow);
  },

  async createAdjustmentPeriod(
    data: { start_date: string; percent: number; note?: string | null },
    userId: number,
  ): Promise<{ period: AdjustmentPeriod; adjusted: number }> {
    const start = toDateOnly(data.start_date);
    if (data.percent === 0 || Number.isNaN(data.percent)) throw err('INVALID_TIERS', 'Phần trăm phải khác 0');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const openPeriod = await client.query(
        `SELECT * FROM route_pricing_adjustment_periods WHERE end_date IS NULL ORDER BY start_date DESC FOR UPDATE`,
      );
      let sourceVersions: Record<string, unknown>[] = [];
      if (openPeriod.rows[0]) {
        const prevStart = toDateOnly(openPeriod.rows[0].start_date);
        if (!(start > prevStart)) {
          throw err('INVALID_PERIOD', 'Ngày bắt đầu phải sau kỳ gần nhất');
        }
        sourceVersions = (
          await client.query(
            `SELECT v.* FROM route_price_versions v
             JOIN route_price_configs c ON c.id=v.price_config_id AND c.status='active'
             WHERE v.adjustment_period_id=$1
             ORDER BY v.id
             FOR UPDATE OF v`,
            [openPeriod.rows[0].id],
          )
        ).rows;
        await client.query(
          `UPDATE route_pricing_adjustment_periods SET end_date=$1, updated_by=$2 WHERE id=$3 AND end_date IS NULL`,
          [start, userId, openPeriod.rows[0].id],
        );
      }
      let inserted;
      try {
        inserted = await client.query(
          `INSERT INTO route_pricing_adjustment_periods (start_date,end_date,percent,note,created_by,updated_by)
           VALUES ($1,NULL,$2,$3,$4,$4) RETURNING *`,
          [start, data.percent, cleanNote(data.note), userId],
        );
      } catch (error) {
        if (isPgUniqueViolation(error)) throw err('DUPLICATE_PERIOD', 'Kỳ với ngày bắt đầu này đã tồn tại');
        throw error;
      }
      const adjusted = await insertScaledVersionsFromBases(
        client,
        sourceVersions,
        {
          percent: data.percent,
          adjustment_period_id: inserted.rows[0].id,
        },
        userId,
      );
      await client.query('COMMIT');
      return {
        period: mapPeriodRow(inserted.rows[0]),
        adjusted,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      if (isPgUniqueViolation(error)) {
        throw err('OVERLAPPING_VERSION');
      }
      throw error;
    } finally {
      client.release();
    }
  },

  async deleteAdjustmentPeriod(id: number): Promise<{ deleted_versions: number }> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const latest = await client.query(
        `SELECT * FROM route_pricing_adjustment_periods ORDER BY start_date DESC LIMIT 1 FOR UPDATE`,
      );
      if (!latest.rows[0] || num(latest.rows[0].id) !== id) {
        throw err('PERIOD_NOT_LATEST', 'Chỉ được xóa kỳ gần nhất');
      }
      const linked = await client.query(
        `SELECT id FROM route_price_versions WHERE adjustment_period_id=$1 ORDER BY id DESC FOR UPDATE`,
        [id],
      );
      const versionIds = linked.rows.map((row) => num(row.id));
      await deleteVersionsByIds(client, versionIds);
      await client.query(`DELETE FROM route_pricing_adjustment_periods WHERE id=$1`, [id]);
      const prev = await client.query(
        `SELECT id FROM route_pricing_adjustment_periods ORDER BY start_date DESC LIMIT 1 FOR UPDATE`,
      );
      if (prev.rows[0]) {
        await client.query(
          `UPDATE route_pricing_adjustment_periods SET end_date=NULL, updated_by=NULL WHERE id=$1`,
          [prev.rows[0].id],
        );
      }
      await client.query('COMMIT');
      return { deleted_versions: versionIds.length };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async listRoutes(priceBookId: number, filters: { search?: string; province_code?: string; status?: string } = {}): Promise<DeliveryRoute[]> {
    if (!priceBookId) throw err('MISSING_PRICE_BOOK');
    const params: unknown[] = [priceBookId, filters.status || 'active'];
    let where = 'WHERE r.price_book_id = $1 AND r.status = $2';
    if (filters.province_code) { params.push(filters.province_code); where += ` AND r.province_code = $${params.length}`; }
    if (filters.search) {
      params.push(`%${filters.search}%`);
      where += ` AND (r.tinh ILIKE $${params.length} OR r.phuong ILIKE $${params.length} OR r.location_text ILIKE $${params.length})`;
    }
    return (await pool.query<DeliveryRoute>(
      `SELECT r.*, g.id AS group_id, g.name AS group_name FROM delivery_routes r
       LEFT JOIN route_group_members m ON m.route_id = r.id
       LEFT JOIN route_groups g ON g.id = m.route_group_id AND g.status = 'active'
       ${where} ORDER BY r.tinh, r.phuong`, params,
    )).rows;
  },
  async createRoute(data: { price_book_id: number; province_code: string; ward_code?: string | null; location_text?: string | null; note?: string | null }, userId: number): Promise<DeliveryRoute> {
    const supplier = await pool.query('SELECT id FROM price_books WHERE id = $1 AND status = $2', [data.price_book_id, 'active']);
    if (!supplier.rows[0]) throw err('PRICE_BOOK_NOT_FOUND');
    const province = await getProvince(data.province_code);
    const destination = destinationInput(data.ward_code, data.location_text);
    if (!province) throw err('INVALID_WARD', 'Tỉnh không hợp lệ');
    if (destination.ward_code) {
      const ward = await getWard(destination.ward_code);
      if (!ward || ward.province_code !== data.province_code) throw err('INVALID_WARD');
      destination.phuong = ward.name;
    }
    const note = cleanNote(data.note);
    const duplicate = await pool.query(
      `SELECT id FROM delivery_routes
       WHERE price_book_id=$1 AND province_code=$2
         AND COALESCE(ward_code,'')=COALESCE($3,'')
         AND COALESCE(location_text,'')=COALESCE($4,'')
         AND COALESCE(NULLIF(TRIM(note),''),'')=$5
         AND status='active'`,
      [data.price_book_id, data.province_code, destination.ward_code, destination.location_text, noteKey(note)],
    );
    if (duplicate.rows[0]) throw err('DUPLICATE_ROUTE');
    try {
      const result = await pool.query<DeliveryRoute>(
        `INSERT INTO delivery_routes (price_book_id, province_code, ward_code, location_text, note, tinh, phuong, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8) RETURNING *`,
        [data.price_book_id, data.province_code, destination.ward_code, destination.location_text, note, province.name, destination.phuong, userId],
      );
      return result.rows[0];
    } catch (error) {
      if (isPgUniqueViolation(error)) throw err('DUPLICATE_ROUTE');
      throw error;
    }
  },
  async updateRoute(id: number, data: { province_code: string; ward_code?: string | null; location_text?: string | null; note?: string | null }, userId: number): Promise<DeliveryRoute> {
    const existing = await pool.query<DeliveryRoute>('SELECT * FROM delivery_routes WHERE id = $1 AND status = $2', [id, 'active']);
    if (!existing.rows[0]) throw err('NOT_FOUND');
    const province = await getProvince(data.province_code);
    const destination = destinationInput(data.ward_code, data.location_text);
    if (!province) throw err('INVALID_WARD');
    if (destination.ward_code) {
      const ward = await getWard(destination.ward_code);
      if (!ward || ward.province_code !== data.province_code) throw err('INVALID_WARD');
      destination.phuong = ward.name;
    }
    const note = cleanNote(data.note);
    const duplicate = await pool.query(
      `SELECT id FROM delivery_routes
       WHERE price_book_id=$1 AND province_code=$2
         AND COALESCE(ward_code,'')=COALESCE($3,'')
         AND COALESCE(location_text,'')=COALESCE($4,'')
         AND COALESCE(NULLIF(TRIM(note),''),'')=$5
         AND status='active' AND id != $6`,
      [existing.rows[0].price_book_id, data.province_code, destination.ward_code, destination.location_text, noteKey(note), id],
    );
    if (duplicate.rows[0]) throw err('DUPLICATE_ROUTE');
    try {
      const result = await pool.query<DeliveryRoute>(
        `UPDATE delivery_routes SET province_code=$1, ward_code=$2, location_text=$3, note=$4, tinh=$5, phuong=$6, updated_by=$7
         WHERE id=$8 RETURNING *`,
        [data.province_code, destination.ward_code, destination.location_text, note, province.name, destination.phuong, userId, id],
      );
      return result.rows[0];
    } catch (error) {
      if (isPgUniqueViolation(error)) throw err('DUPLICATE_ROUTE');
      throw error;
    }
  },
  async softDeleteRoute(id: number): Promise<void> {
    const existing = await pool.query('SELECT id FROM delivery_routes WHERE id=$1 AND status=$2', [id, 'active']);
    if (!existing.rows[0]) throw err('NOT_FOUND');
    const grouped = await pool.query(`SELECT m.id FROM route_group_members m JOIN route_groups g ON g.id=m.route_group_id AND g.status='active' WHERE m.route_id=$1`, [id]);
    if (grouped.rows[0]) throw err('ROUTE_IN_ACTIVE_GROUP');
    await pool.query(`UPDATE delivery_routes SET status='deactive' WHERE id=$1`, [id]);
  },
  async listGroups(priceBookId: number, filters: { province_code?: string; search?: string } = {}): Promise<RouteGroup[]> {
    if (!priceBookId) throw err('MISSING_PRICE_BOOK');
    const params: unknown[] = [priceBookId];
    let where = `WHERE g.price_book_id=$1 AND g.status='active'`;
    if (filters.province_code) { params.push(filters.province_code); where += ` AND g.province_code=$${params.length}`; }
    if (filters.search) { params.push(`%${filters.search}%`); where += ` AND g.name ILIKE $${params.length}`; }
    const groups = await pool.query(`SELECT * FROM route_groups g ${where} ORDER BY g.tinh,g.name`, params);
    return Promise.all(groups.rows.map(mapGroup));
  },
  async createGroup(data: { price_book_id: number; province_code: string; ward_codes?: string[]; location_text?: string | null; note?: string | null }, userId: number): Promise<RouteGroup> {
    const supplier = await pool.query(`SELECT id FROM price_books WHERE id=$1 AND status='active'`, [data.price_book_id]);
    if (!supplier.rows[0]) throw err('PRICE_BOOK_NOT_FOUND');
    const province = await getProvince(data.province_code);
    if (!province) throw err('INVALID_WARD', 'Tỉnh không hợp lệ');
    const destinations = await resolveDestinations(data.province_code, data.ward_codes, data.location_text);
    const residual = !destinations.length;
    const note = cleanNote(data.note);
    const name = buildGroupName(province.name, destinationNames(destinations), note);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (residual) {
        const duplicate = await client.query(
          `SELECT id FROM route_groups WHERE price_book_id=$1 AND province_code=$2 AND is_residual=TRUE AND status='active'
           AND COALESCE(NULLIF(TRIM(note),''),'')=$3 FOR UPDATE`, [data.price_book_id, data.province_code, noteKey(note)],
        );
        if (duplicate.rows[0]) throw err('DUPLICATE_RESIDUAL_GROUP');
      }
      const group = await client.query(
        `INSERT INTO route_groups (price_book_id,name,province_code,tinh,is_residual,note,created_by,updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$7) RETURNING *`,
        [data.price_book_id, name, data.province_code, province.name, residual, note, userId],
      );
      for (const destination of destinations) {
        const route = await client.query(
          `INSERT INTO delivery_routes (price_book_id,province_code,ward_code,location_text,note,tinh,phuong,created_by,updated_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8) RETURNING id`,
          [data.price_book_id, data.province_code, destination.ward_code, destination.location_text, note, province.name, destination.phuong, userId],
        );
        await client.query(`INSERT INTO route_group_members (route_group_id,route_id) VALUES ($1,$2)`, [group.rows[0].id, route.rows[0].id]);
      }
      await client.query('COMMIT');
      return await mapGroup(group.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      if (isPgUniqueViolation(error)) {
        const constraint = uniqueConstraintName(error);
        if (constraint.includes('route_groups_name')) throw err('DUPLICATE_GROUP_NAME');
        if (constraint.includes('residual')) throw err('DUPLICATE_RESIDUAL_GROUP');
        throw err('DUPLICATE_ROUTE');
      }
      throw error;
    } finally { client.release(); }
  },
  async updateGroup(id: number, data: { note?: string | null; ward_codes?: string[]; location_text?: string | null }, userId: number): Promise<RouteGroup> {
    const current = await pool.query(`SELECT * FROM route_groups WHERE id=$1 AND status='active'`, [id]);
    if (!current.rows[0]) throw err('NOT_FOUND');
    const existing = current.rows[0];
    const province = await getProvince(existing.province_code);
    if (!province) throw err('INVALID_WARD');
    const hasDestinations = data.ward_codes !== undefined || data.location_text !== undefined;
    const note = data.note === undefined ? cleanNote(existing.note) : cleanNote(data.note);
    const destinations = hasDestinations
      ? await resolveDestinations(existing.province_code, data.ward_codes, data.location_text)
      : (await loadMembers(id)).map((member) => ({ ward_code: member.ward_code, location_text: member.location_text, phuong: member.phuong }));
    const residual = !destinations.length;
    const name = buildGroupName(province.name, destinationNames(destinations), note);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (residual) {
        const duplicate = await client.query(
          `SELECT id FROM route_groups WHERE price_book_id=$1 AND province_code=$2 AND is_residual=TRUE AND status='active'
           AND id != $3 AND COALESCE(NULLIF(TRIM(note),''),'')=$4 FOR UPDATE`,
          [existing.price_book_id, existing.province_code, id, noteKey(note)],
        );
        if (duplicate.rows[0]) throw err('DUPLICATE_RESIDUAL_GROUP');
      }
      if (hasDestinations) {
        const old = await client.query<{ route_id: number; ward_code: string | null; location_text: string | null }>(
          `SELECT m.route_id,r.ward_code,r.location_text FROM route_group_members m JOIN delivery_routes r ON r.id=m.route_id WHERE m.route_group_id=$1 FOR UPDATE`, [id],
        );
        const key = (destination: { ward_code: string | null; location_text: string | null }) => destination.ward_code ? `w:${destination.ward_code}` : `l:${normalizeLocation(destination.location_text ?? '').toLowerCase()}`;
        const wanted = new Set(destinations.map(key));
        const oldKeys = new Set(old.rows.map(key));
        for (const member of old.rows) {
          if (!wanted.has(key(member))) {
            await client.query(`DELETE FROM route_group_members WHERE route_group_id=$1 AND route_id=$2`, [id, member.route_id]);
            await client.query(`UPDATE delivery_routes SET status='deactive',updated_by=$1 WHERE id=$2`, [userId, member.route_id]);
          }
        }
        for (const destination of destinations) {
          if (oldKeys.has(key(destination))) continue;
          const route = await client.query(
            `INSERT INTO delivery_routes (price_book_id,province_code,ward_code,location_text,note,tinh,phuong,created_by,updated_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8) RETURNING id`,
            [existing.price_book_id, existing.province_code, destination.ward_code, destination.location_text, note, province.name, destination.phuong, userId],
          );
          await client.query(`INSERT INTO route_group_members (route_group_id,route_id) VALUES ($1,$2)`, [id, route.rows[0].id]);
        }
      }
      await client.query(`UPDATE delivery_routes SET note=$1,updated_by=$2 WHERE id IN (SELECT route_id FROM route_group_members WHERE route_group_id=$3)`, [note, userId, id]);
      const updated = await client.query(
        `UPDATE route_groups SET name=$1,is_residual=$2,note=$3,updated_by=$4 WHERE id=$5 RETURNING *`,
        [name, residual, note, userId, id],
      );
      await client.query('COMMIT');
      return await mapGroup(updated.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      if (isPgUniqueViolation(error)) {
        const constraint = uniqueConstraintName(error);
        if (constraint.includes('route_groups_name')) throw err('DUPLICATE_GROUP_NAME');
        if (constraint.includes('residual')) throw err('DUPLICATE_RESIDUAL_GROUP');
        throw err('DUPLICATE_ROUTE');
      }
      throw error;
    } finally { client.release(); }
  },
  async softDeleteGroup(id: number, userId: number): Promise<void> {
    const existing = await pool.query(`SELECT id FROM route_groups WHERE id=$1 AND status='active'`, [id]);
    if (!existing.rows[0]) throw err('NOT_FOUND');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const members = await client.query<{ route_id: number }>(`SELECT route_id FROM route_group_members WHERE route_group_id=$1`, [id]);
      await client.query(`DELETE FROM route_group_members WHERE route_group_id=$1`, [id]);
      for (const member of members.rows) await client.query(`UPDATE delivery_routes SET status='deactive',updated_by=$1 WHERE id=$2`, [userId, member.route_id]);
      await client.query(`UPDATE route_groups SET status='deactive',updated_by=$1 WHERE id=$2`, [userId, id]);
      await client.query(`UPDATE route_price_configs SET status='deactive' WHERE route_group_id=$1`, [id]);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  },
  async listPrices(priceBookId: number, routeGroupId?: number): Promise<RoutePriceConfigSummary[]> {
    if (!priceBookId) throw err('MISSING_PRICE_BOOK');
    const params: unknown[] = [priceBookId];
    let where = `WHERE g.price_book_id=$1 AND g.status='active'`;
    if (routeGroupId) { params.push(routeGroupId); where += ` AND g.id=$${params.length}`; }
    const groups = await pool.query(`SELECT g.id,g.name,g.is_residual,g.province_code,g.tinh,c.id AS config_id,c.price_set_id,ps.name AS price_set_name FROM route_groups g LEFT JOIN route_price_configs c ON c.route_group_id=g.id AND c.status='active' LEFT JOIN price_sets ps ON ps.id=c.price_set_id ${where} ORDER BY g.tinh,g.name`, params);
    return Promise.all(groups.rows.map(async (group) => {
      const versions = group.config_id
        ? await pool.query(
          `${VERSION_SELECT} ${VERSION_JOIN} WHERE v.price_config_id=$1 ORDER BY p.start_date DESC`,
          [group.config_id],
        )
        : { rows: [] as Record<string, unknown>[] };
      const open = versions.rows.find((version) => version.period_end_date == null) ?? versions.rows[0];
      const current: RoutePriceVersion | null = open
        ? mapVersionRow(open, await loadTiers(num(open.id)))
        : null;
      return { id: group.config_id ?? 0, route_group_id: group.id, group_name: group.name, is_residual: group.is_residual, province_code: group.province_code, tinh: group.tinh, price_set_id: group.price_set_id == null ? null : num(group.price_set_id), price_set_name: (group.price_set_name as string | null) ?? null, current_version: current, version_count: versions.rows.length };
    }));
  },
  async listVersions(configId: number): Promise<RoutePriceVersion[]> {
    const versions = await pool.query(
      `${VERSION_SELECT} ${VERSION_JOIN} WHERE v.price_config_id=$1 ORDER BY p.start_date DESC`,
      [configId],
    );
    return Promise.all(versions.rows.map(async (version) => mapVersionRow(version, await loadTiers(version.id))));
  },

  async getPriceMatrix(priceBookId: number): Promise<PriceMatrixResponse> {
    if (!priceBookId) throw err('MISSING_PRICE_BOOK');

    const periodsResult = await pool.query(
      `SELECT id, start_date, end_date, percent, note
       FROM route_pricing_adjustment_periods
       ORDER BY start_date ASC`,
    );
    const periods = periodsResult.rows.map((row) => ({
      id: num(row.id),
      start_date: toDateOnly(row.start_date),
      end_date: toDateOnlyOrNull(row.end_date),
      percent: num(row.percent),
      note: (row.note as string | null) ?? null,
    }));

    const groups = await pool.query(
      `SELECT g.id, g.name, g.is_residual, g.province_code, g.tinh, c.id AS config_id,
              c.price_set_id, ps.name AS price_set_name, ps.pricing_mode AS set_mode, ps.has_pallet
       FROM route_groups g
       LEFT JOIN route_price_configs c ON c.route_group_id = g.id AND c.status = 'active'
       LEFT JOIN price_sets ps ON ps.id = c.price_set_id AND ps.status = 'active'
       WHERE g.price_book_id = $1 AND g.status = 'active'
       ORDER BY g.tinh, g.name`,
      [priceBookId],
    );

    type GroupBundle = {
      id: number;
      name: string;
      is_residual: boolean;
      province_code: string;
      tinh: string;
      price_set_id: number | null;
      price_set_name: string | null;
      set_mode: PricingMode | null;
      has_pallet: boolean;
      absolute: {
        id: number;
        pricing_mode: PricingMode;
        pallet_trip_price: number | null;
        pallet_manual_adjusted: boolean;
        tiers: RoutePriceTier[];
      } | null;
      byPeriod: Map<
        number,
        { pallet_trip_price: number | null; pallet_manual_adjusted: boolean; tiers: RoutePriceTier[] }
      >;
    };

    const bundles: GroupBundle[] = [];
    for (const group of groups.rows) {
      const configId = group.config_id == null ? null : num(group.config_id);
      const bundle: GroupBundle = {
        id: num(group.id),
        name: String(group.name),
        is_residual: Boolean(group.is_residual),
        province_code: String(group.province_code),
        tinh: String(group.tinh),
        price_set_id: group.price_set_id == null ? null : num(group.price_set_id),
        price_set_name: group.price_set_name == null ? null : String(group.price_set_name),
        set_mode: group.set_mode == null ? null : parsePricingMode(group.set_mode),
        has_pallet: Boolean(group.has_pallet),
        absolute: null,
        byPeriod: new Map(),
      };
      if (configId != null) {
        const versions = await pool.query(
          `${VERSION_SELECT} ${VERSION_JOIN} WHERE v.price_config_id=$1 ORDER BY p.start_date ASC`,
          [configId],
        );
        for (const version of versions.rows) {
          const tiers = await loadTiers(num(version.id));
          const periodId = num(version.adjustment_period_id);
          const pallet = nullableNumber(version.pallet_trip_price);
          const palletManual = Boolean(version.pallet_manual_adjusted);
          bundle.byPeriod.set(periodId, {
            pallet_trip_price: pallet,
            pallet_manual_adjusted: palletManual,
            tiers,
          });
          if (version.base_version_id == null) {
            bundle.absolute = {
              id: num(version.id),
              pricing_mode: parsePricingMode(version.pricing_mode ?? 'by_weight'),
              pallet_trip_price: pallet,
              pallet_manual_adjusted: palletManual,
              tiers,
            };
          }
        }
      }
      bundles.push(bundle);
    }

    const set_tables = await buildSetTables(bundles, periods);
    return {
      periods,
      set_tables,
      weight_tables: set_tables.filter((table) => table.pricing_mode === 'by_weight'),
      truck_tables: set_tables.filter((table) => table.pricing_mode === 'by_truck'),
      trips: { rows: [] },
    };
  },

  async createAbsolutePrice(data: {
    route_group_id: number;
    adjustment_period_id: number;
    price_set_id: number;
    pallet_trip_price?: number | null;
    tiers: RoutePriceTier[];
  }, userId: number): Promise<RoutePriceVersion> {
    const set = await priceSetService.getActive(data.price_set_id);
    const priced = materializePricedTiers(set, data.tiers);
    const pallet = normalizePallet(set, data.pallet_trip_price ?? null);
    if (priced.length === 0 && pallet == null) throw err('PRICE_NOT_POSITIVE', 'Nhập ít nhất một bậc');
    const mode = set.pricing_mode;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const basePeriod = await client.query(
        `SELECT * FROM route_pricing_adjustment_periods WHERE id=$1 FOR UPDATE`,
        [data.adjustment_period_id],
      );
      if (!basePeriod.rows[0]) throw err('PERIOD_REQUIRED', 'Không tìm thấy kỳ điều chỉnh');
      const baseStart = toDateOnly(basePeriod.rows[0].start_date);

      const laterPeriods = await client.query(
        `SELECT * FROM route_pricing_adjustment_periods WHERE start_date > $1::date ORDER BY start_date ASC`,
        [baseStart],
      );

      const group = await client.query(`SELECT id FROM route_groups WHERE id=$1 AND status='active' FOR UPDATE`, [data.route_group_id]);
      if (!group.rows[0]) throw err('NOT_FOUND');
      let config = await client.query(`SELECT id, price_set_id FROM route_price_configs WHERE route_group_id=$1 FOR UPDATE`, [data.route_group_id]);
      if (!config.rows[0]) {
        try { config = await client.query(`INSERT INTO route_price_configs (route_group_id,price_set_id,created_by) VALUES ($1,$2,$3) RETURNING id, price_set_id`, [data.route_group_id, set.id, userId]); }
        catch (error) {
          if (!isPgUniqueViolation(error)) throw error;
          config = await client.query(`SELECT id, price_set_id FROM route_price_configs WHERE route_group_id=$1 FOR UPDATE`, [data.route_group_id]);
          if (!config.rows[0]) throw error;
        }
      }
      const configId = config.rows[0].id;
      const existing = await client.query(`SELECT id FROM route_price_versions WHERE price_config_id=$1 LIMIT 1 FOR UPDATE`, [configId]);
      if (existing.rows[0]) throw err('ABSOLUTE_UPDATE_FORBIDDEN');
      await client.query(`UPDATE route_price_configs SET price_set_id=$1 WHERE id=$2`, [set.id, configId]);

      const absolute = await client.query(
        `INSERT INTO route_price_versions
          (price_config_id,pricing_mode,pallet_trip_price,adjustment_period_id,created_by)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [configId, mode, pallet, data.adjustment_period_id, userId],
      );
      await insertTiers(client, absolute.rows[0].id, mode, priced);

      let prevId = absolute.rows[0].id;
      let prevPallet = pallet;
      let prevTiers = priced.map((t) => ({ ...t }));

      for (const period of laterPeriods.rows) {
        const percent = num(period.percent);
        const scaledTiers = scaleTiers(prevTiers, percent);
        const scaledPallet = scaleNullablePallet(prevPallet, percent);
        const version = await client.query(
          `INSERT INTO route_price_versions
            (price_config_id,pricing_mode,pallet_trip_price,base_version_id,adjustment_period_id,created_by)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
          [configId, mode, scaledPallet, prevId, period.id, userId],
        );
        await insertTiers(client, version.rows[0].id, mode, scaledTiers);
        prevId = version.rows[0].id;
        prevPallet = scaledPallet;
        prevTiers = scaledTiers;
      }

      await client.query('COMMIT');
      return mapVersionRow(await loadVersionRow(absolute.rows[0].id), await loadTiers(absolute.rows[0].id));
    } catch (error) {
      await client.query('ROLLBACK');
      if (isPgUniqueViolation(error)) throw err('ABSOLUTE_UPDATE_FORBIDDEN');
      throw error;
    } finally { client.release(); }
  },

  async updateAbsolutePrice(
    routeGroupId: number,
    data: {
      price_set_id?: number;
      pallet_trip_price?: number | null;
      tiers: RoutePriceTier[];
    },
    userId: number,
  ): Promise<RoutePriceVersion> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const config = await client.query(
        `SELECT id, price_set_id FROM route_price_configs WHERE route_group_id=$1 AND status='active' FOR UPDATE`,
        [routeGroupId],
      );
      if (!config.rows[0]) throw err('NOT_FOUND');
      const boundSetId = config.rows[0].price_set_id == null ? null : num(config.rows[0].price_set_id);
      if (boundSetId == null) throw err('NOT_FOUND', 'Nhóm chưa gắn bộ giá');
      if (data.price_set_id != null && num(data.price_set_id) !== boundSetId) {
        throw err('PRICE_SET_LOCKED', 'Muốn đổi bộ giá, xóa giá rồi nhập lại');
      }
      const set = await priceSetService.getActive(boundSetId, client);
      const priced = materializePricedTiers(set, data.tiers);
      const pallet = normalizePallet(set, data.pallet_trip_price ?? null);
      if (priced.length === 0 && pallet == null) throw err('PRICE_NOT_POSITIVE', 'Nhập ít nhất một bậc');
      const mode = set.pricing_mode;
      const absolute = await client.query(
        `${VERSION_SELECT} ${VERSION_JOIN}
         WHERE v.price_config_id=$1 AND v.base_version_id IS NULL
         ORDER BY p.start_date ASC LIMIT 1 FOR UPDATE OF v`,
        [config.rows[0].id],
      );
      if (!absolute.rows[0]) throw err('NOT_FOUND', 'Không tìm thấy bảng giá gốc');
      const absoluteId = absolute.rows[0].id;
      const basePeriodId = absolute.rows[0].adjustment_period_id;
      const baseStart = toDateOnly(absolute.rows[0].period_start_date);
      const oldMode = parsePricingMode(absolute.rows[0].pricing_mode ?? 'by_weight');
      const oldPallet = num(absolute.rows[0].pallet_trip_price);
      const oldPalletManual = Boolean(absolute.rows[0].pallet_manual_adjusted);
      const oldTiers = await loadTiers(absoluteId, client);
      const oldByKey = new Map(
        oldTiers.map((t) => [
          tierFingerprint(oldMode, t),
          { price: num(t.price), is_manual_adjusted: Boolean(t.is_manual_adjusted) },
        ]),
      );

      await client.query(
        `UPDATE route_price_versions
         SET pricing_mode=$1, pallet_trip_price=$2,
             pallet_manual_adjusted=$3
         WHERE id=$4`,
        [
          mode,
          pallet,
          pallet != null && oldPallet === pallet ? oldPalletManual : false,
          absoluteId,
        ],
      );
      await client.query(`DELETE FROM route_price_tiers WHERE price_version_id=$1`, [absoluteId]);
      await insertTiers(client, absoluteId, mode, priced);

      const insertedTiers = await loadTiers(absoluteId, client);
      for (const tier of insertedTiers) {
        const prev = oldByKey.get(tierFingerprint(mode, tier));
        const keep =
          prev != null && num(prev.price) === num(tier.price) && Boolean(prev.is_manual_adjusted);
        if (keep) {
          await client.query(`UPDATE route_price_tiers SET is_manual_adjusted=TRUE WHERE id=$1`, [
            tier.id,
          ]);
        }
      }

      const later = await client.query(
        `SELECT v.id FROM route_price_versions v
         JOIN route_pricing_adjustment_periods p ON p.id = v.adjustment_period_id
         WHERE v.price_config_id=$1 AND v.id<>$2 AND p.start_date > $3::date
         ORDER BY p.start_date DESC`,
        [config.rows[0].id, absoluteId, baseStart],
      );
      await deleteVersionsByIds(client, later.rows.map((row) => num(row.id)));

      if (basePeriodId != null) {
        const laterPeriods = await client.query(
          `SELECT p.* FROM route_pricing_adjustment_periods p
           WHERE p.start_date > $1::date
           ORDER BY p.start_date ASC`,
          [baseStart],
        );
        let prevId = absoluteId;
        let prevPallet = pallet;
        let prevTiers = priced.map((t) => ({ ...t, is_manual_adjusted: false }));
        for (const period of laterPeriods.rows) {
          const percent = num(period.percent);
          const scaledTiers = scaleTiers(prevTiers, percent).map((t) => ({
            ...t,
            is_manual_adjusted: false,
          }));
          const scaledPallet = scaleNullablePallet(prevPallet, percent);
          const version = await client.query(
            `INSERT INTO route_price_versions
              (price_config_id,pricing_mode,pallet_trip_price,base_version_id,adjustment_period_id,created_by,pallet_manual_adjusted)
             VALUES ($1,$2,$3,$4,$5,$6,FALSE) RETURNING id`,
            [
              config.rows[0].id,
              mode,
              scaledPallet,
              prevId,
              period.id,
              userId,
            ],
          );
          await insertTiers(client, version.rows[0].id, mode, scaledTiers);
          prevId = version.rows[0].id;
          prevPallet = scaledPallet;
          prevTiers = scaledTiers;
        }
      }

      await client.query('COMMIT');
      return mapVersionRow(await loadVersionRow(absoluteId), await loadTiers(absoluteId));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async deleteGroupPrices(routeGroupId: number): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const config = await client.query(
        `SELECT id FROM route_price_configs WHERE route_group_id=$1 FOR UPDATE`,
        [routeGroupId],
      );
      if (!config.rows[0]) throw err('NOT_FOUND', 'Nhóm chưa có giá');
      const versions = await client.query(
        `SELECT id FROM route_price_versions WHERE price_config_id=$1`,
        [config.rows[0].id],
      );
      await deleteVersionsByIds(client, versions.rows.map((row) => num(row.id)));
      await client.query(`UPDATE route_price_configs SET price_set_id=NULL WHERE id=$1`, [config.rows[0].id]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async manualAdjustVersion(
    versionId: number,
    data: {
      pallet_trip_price: number | null;
      tiers: { id: number; price: number }[];
      added_tiers?: { price_set_tier_id: number; price: number }[];
    },
    _userId: number,
  ): Promise<RoutePriceVersion> {
    for (const tier of data.tiers) {
      if (!(num(tier.price) > 0) || Number.isNaN(num(tier.price))) {
        throw err('PRICE_NOT_POSITIVE', 'Giá phải lớn hơn 0');
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const versionRes = await client.query(
        `${VERSION_SELECT} ${VERSION_JOIN} WHERE v.id=$1 FOR UPDATE OF v`,
        [versionId],
      );
      if (!versionRes.rows[0]) throw err('NOT_FOUND');
      const row = versionRes.rows[0];
      const mode = parsePricingMode(row.pricing_mode ?? 'by_weight');
      const oldPallet = nullableNumber(row.pallet_trip_price);
      const incomingPallet = data.pallet_trip_price == null ? null : num(data.pallet_trip_price);
      const addingPallet = oldPallet == null && incomingPallet != null;
      if (oldPallet != null && !(incomingPallet != null && incomingPallet > 0)) {
        throw err('PRICE_NOT_POSITIVE', 'Giá phải lớn hơn 0');
      }
      if (addingPallet && !(incomingPallet != null && incomingPallet > 0)) {
        throw err('PRICE_NOT_POSITIVE', 'Giá phải lớn hơn 0');
      }
      const configId = num(row.price_config_id);
      const baseStart = toDateOnly(row.period_start_date);
      const existingTiers = await loadTiers(versionId, client);

      if (data.tiers.length !== existingTiers.length) {
        throw err('INVALID_TIERS', 'Danh sách bậc không khớp');
      }
      const addedIncoming = data.added_tiers ?? [];
      let addedPriced: RoutePriceTier[] = [];
      if (addedIncoming.length > 0 || addingPallet) {
        const configSet = await client.query(
          `SELECT price_set_id FROM route_price_configs WHERE id=$1`,
          [configId],
        );
        const setId = configSet.rows[0]?.price_set_id;
        if (setId == null) throw err('NOT_FOUND', 'Nhóm chưa gắn bộ giá');
        const set = await priceSetService.getActive(num(setId), client);
        if (addingPallet && !set.has_pallet) {
          throw err('PALLET_NOT_IN_SET', 'Bộ giá không có pallet');
        }
        if (addedIncoming.length > 0) {
          addedPriced = materializePricedTiers(set, addedIncoming);
          const existingSetIds = new Set(
            existingTiers
              .map((t) => (t.price_set_tier_id == null ? null : num(t.price_set_tier_id)))
              .filter((id): id is number => id != null),
          );
          for (const tier of addedPriced) {
            if (tier.price_set_tier_id == null || existingSetIds.has(num(tier.price_set_tier_id))) {
              throw err('INVALID_TIERS', 'Bậc đã có trên kỳ này');
            }
          }
        }
      }
      const byId = new Map(existingTiers.map((t) => [num(t.id), t]));
      const seen = new Set<number>();
      for (const incoming of data.tiers) {
        const id = num(incoming.id);
        if (!byId.has(id)) throw err('INVALID_TIERS', 'Bậc không thuộc phiên bản này');
        if (seen.has(id)) throw err('INVALID_TIERS', 'Bậc trùng id');
        seen.add(id);
      }

      const palletChanged = oldPallet !== incomingPallet;
      const changedKeys = new Set<string>();
      if (palletChanged) changedKeys.add('pallet');

      const nextTierPrices = new Map<number, number>();
      for (const incoming of data.tiers) {
        const id = num(incoming.id);
        const old = byId.get(id)!;
        nextTierPrices.set(id, num(incoming.price));
        if (num(old.price) !== num(incoming.price)) {
          changedKeys.add(tierFingerprint(mode, old));
        }
      }

      await client.query(
        `UPDATE route_price_versions
         SET pallet_trip_price=$1,
             pallet_manual_adjusted = CASE WHEN $2 THEN TRUE ELSE pallet_manual_adjusted END
         WHERE id=$3`,
        [incomingPallet, palletChanged, versionId],
      );

      for (const incoming of data.tiers) {
        const id = num(incoming.id);
        const old = byId.get(id)!;
        const priceChanged = num(old.price) !== num(incoming.price);
        await client.query(
          `UPDATE route_price_tiers
           SET price=$1,
               is_manual_adjusted = CASE WHEN $2 THEN TRUE ELSE is_manual_adjusted END
           WHERE id=$3`,
          [incoming.price, priceChanged, id],
        );
      }

      for (const tier of addedPriced) {
        await insertCopiedTier(client, versionId, mode, tier, num(tier.price), true);
        changedKeys.add(tierFingerprint(mode, tier));
      }

      if (changedKeys.size > 0 || addedPriced.length > 0) {
        const laterPeriods = await client.query(
          `SELECT p.* FROM route_pricing_adjustment_periods p
           WHERE p.start_date > $1::date
           ORDER BY p.start_date ASC`,
          [baseStart],
        );

        let prevPallet: number | null = incomingPallet;
        let prevTierByKey = new Map(
          existingTiers.map((t) => {
            const key = tierFingerprint(mode, t);
            const price = nextTierPrices.get(num(t.id)) ?? num(t.price);
            return [key, price] as const;
          }),
        );
        for (const added of addedPriced) {
          prevTierByKey.set(tierFingerprint(mode, added), num(added.price));
        }

        for (const period of laterPeriods.rows) {
          const percent = num(period.percent);
          const laterVersion = await client.query(
            `SELECT v.* FROM route_price_versions v
             WHERE v.price_config_id=$1 AND v.adjustment_period_id=$2
             FOR UPDATE`,
            [configId, period.id],
          );
          if (!laterVersion.rows[0]) continue;
          const laterId = num(laterVersion.rows[0].id);
          const laterTiers = await loadTiers(laterId, client);
          const nextPrevTier = new Map(prevTierByKey);

          if (changedKeys.has('pallet') && prevPallet != null) {
            const scaledPallet = scaleNullablePallet(prevPallet, percent);
            await client.query(
              `UPDATE route_price_versions
               SET pallet_trip_price=$1, pallet_manual_adjusted=FALSE
               WHERE id=$2`,
              [scaledPallet, laterId],
            );
            prevPallet = scaledPallet;
          } else {
            prevPallet = nullableNumber(laterVersion.rows[0].pallet_trip_price);
          }

          const laterBySetId = new Map(
            laterTiers
              .filter((t) => t.price_set_tier_id != null)
              .map((t) => [num(t.price_set_tier_id), t] as const),
          );
          for (const added of addedPriced) {
            const setTierId = num(added.price_set_tier_id);
            const key = tierFingerprint(mode, added);
            const prevPrice = prevTierByKey.get(key);
            if (prevPrice == null) continue;
            const scaled = roundToThousands(prevPrice * (1 + percent / 100));
            const existingLater = laterBySetId.get(setTierId);
            if (existingLater?.id != null) {
              await client.query(
                `UPDATE route_price_tiers SET price=$1, is_manual_adjusted=FALSE WHERE id=$2`,
                [scaled, existingLater.id],
              );
            } else {
              await insertCopiedTier(client, laterId, mode, added, scaled, false);
            }
            nextPrevTier.set(key, scaled);
          }

          for (const laterTier of laterTiers) {
            const key = tierFingerprint(mode, laterTier);
            if (!changedKeys.has(key)) {
              nextPrevTier.set(key, num(laterTier.price));
              continue;
            }
            const prevPrice = prevTierByKey.get(key);
            if (prevPrice == null) continue;
            const scaled = roundToThousands(prevPrice * (1 + percent / 100));
            await client.query(
              `UPDATE route_price_tiers
               SET price=$1, is_manual_adjusted=FALSE
               WHERE id=$2`,
              [scaled, laterTier.id],
            );
            nextPrevTier.set(key, scaled);
          }
          prevTierByKey = nextPrevTier;
        }
      }

      await client.query('COMMIT');
      return mapVersionRow(await loadVersionRow(versionId), await loadTiers(versionId));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  listPriceSets: () => priceSetService.list(),
  createPriceSet: priceSetService.create.bind(priceSetService),
  renamePriceSet: priceSetService.rename.bind(priceSetService),
  addPriceSetTier: priceSetService.addTier.bind(priceSetService),
  replacePriceSetStructure: priceSetService.replaceStructure.bind(priceSetService),
  deactivatePriceSet: priceSetService.deactivate.bind(priceSetService),

  async lookup(_params?: unknown): Promise<LookupResult> {
    throw err('LOOKUP_DEFERRED', 'Lookup sẽ được cập nhật sau khi chuyển sang bảng giá');
  },
};
