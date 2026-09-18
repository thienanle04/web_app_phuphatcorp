import { pool } from '../config/database';
import {
  FEE_TYPES,
  type CustomerOptions,
  type CustomerSurchargeRule,
  type FeeHit,
  type FeeScope,
  type FeeType,
  type PricingUnit,
  type SurchargeListResult,
  type SurchargeLookupResult,
  type SurchargeZone,
  type VehicleClass,
  addDays,
  isIsoDate,
  foldedExpr,
  nameContainsPattern,
  nameKey,
  todayIso,
  unitForFee,
} from '../types/customerSurcharge';

type ServiceError = { code: string; message?: string };

function fail(code: string, message?: string): never {
  const err: ServiceError = { code, message };
  throw err;
}

interface RuleRow {
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
}

export interface ConditionRule {
  zone: SurchargeZone | null;
  vehicle_class: VehicleClass | null;
  start_date: string;
  end_date: string | null;
}

const FAR = '9999-12-31';

export function specificity(rule: Pick<ConditionRule, 'zone' | 'vehicle_class'>): number {
  return (rule.zone ? 1 : 0) + (rule.vehicle_class ? 1 : 0);
}

export function datesOverlap(a: ConditionRule, b: ConditionRule): boolean {
  const aEnd = a.end_date ?? FAR;
  const bEnd = b.end_date ?? FAR;
  return a.start_date <= bEnd && b.start_date <= aEnd;
}

export function conditionsConflict(a: ConditionRule, b: ConditionRule): boolean {
  if (!datesOverlap(a, b)) return false;
  const sameKey = a.zone === b.zone && a.vehicle_class === b.vehicle_class;
  if (sameKey) return true;
  const aScore = specificity(a);
  const bScore = specificity(b);
  if (aScore !== 1 || bScore !== 1) return false;
  const aZoneOnly = Boolean(a.zone) && !a.vehicle_class;
  const bZoneOnly = Boolean(b.zone) && !b.vehicle_class;
  const aVehicleOnly = !a.zone && Boolean(a.vehicle_class);
  const bVehicleOnly = !b.zone && Boolean(b.vehicle_class);
  return (aZoneOnly && bVehicleOnly) || (aVehicleOnly && bZoneOnly);
}

export function ruleMatches(
  rule: Pick<ConditionRule, 'zone' | 'vehicle_class'>,
  zone: SurchargeZone,
  vehicleClass: VehicleClass,
): boolean {
  if (rule.zone && rule.zone !== zone) return false;
  if (rule.vehicle_class && rule.vehicle_class !== vehicleClass) return false;
  return true;
}

export function pickFee(
  rules: RuleRow[],
  zone: SurchargeZone,
  vehicleClass: VehicleClass,
  scope: FeeScope,
): FeeHit {
  const matching = rules.filter((rule) => ruleMatches(rule, zone, vehicleClass));
  if (matching.length === 0) {
    return { rate: null, unit: null, reason: 'NO_RULE', scope: null };
  }
  const best = Math.max(...matching.map(specificity));
  const winners = matching.filter((rule) => specificity(rule) === best);
  if (winners.length > 1) {
    return { rate: null, unit: null, reason: 'AMBIGUOUS', scope: null };
  }
  const hit = winners[0];
  return { rate: Number(hit.amount), unit: hit.pricing_unit, reason: 'MATCHED', scope };
}

function ambiguousFees(): Record<FeeType, FeeHit> {
  const hit: FeeHit = { rate: null, unit: null, reason: 'AMBIGUOUS', scope: null };
  return { boc_xep: hit, phu_phi_giao_hang: { ...hit }, chuyen_tai: { ...hit } };
}

function textOrNull(value: unknown): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed;
}

function iso(value: string | Date): string {
  // pg parses DATE as local midnight. toISOString() shifts that to the previous UTC day in UTC+7.
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${value.getFullYear()}-${month}-${day}`;
  }
  return String(value).slice(0, 10);
}

function mapRule(row: Record<string, unknown>): CustomerSurchargeRule {
  return {
    id: Number(row.id),
    ten_khach_hang: String(row.ten_khach_hang),
    customer_id: row.customer_id == null ? null : Number(row.customer_id),
    fee_type: row.fee_type as FeeType,
    zone: (row.zone as SurchargeZone | null) ?? null,
    vehicle_class: (row.vehicle_class as VehicleClass | null) ?? null,
    amount: Number(row.amount),
    pricing_unit: row.pricing_unit as PricingUnit,
    start_date: iso(row.start_date as string),
    end_date: row.end_date == null ? null : iso(row.end_date as string),
    diem_tra_hang: row.diem_tra_hang == null ? null : String(row.diem_tra_hang),
    dia_chi_giao_hang: row.dia_chi_giao_hang == null ? null : String(row.dia_chi_giao_hang),
    supplier_name: textOrNull(row.supplier_name),
    supplier_code: textOrNull(row.supplier_code),
    customer_status: row.customer_status == null ? null : String(row.customer_status),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    has_closed_prior: Boolean(row.has_closed_prior),
  };
}

function mapStored(row: Record<string, unknown>): RuleRow {
  return {
    id: Number(row.id),
    ten_khach_hang: String(row.ten_khach_hang),
    customer_id: row.customer_id == null ? null : Number(row.customer_id),
    fee_type: row.fee_type as FeeType,
    zone: (row.zone as SurchargeZone | null) ?? null,
    vehicle_class: (row.vehicle_class as VehicleClass | null) ?? null,
    amount: Number(row.amount),
    pricing_unit: row.pricing_unit as PricingUnit,
    start_date: iso(row.start_date as string),
    end_date: row.end_date == null ? null : iso(row.end_date as string),
  };
}

function assertDate(value: string, code = 'INVALID_FEE_CONDITION'): string {
  if (!isIsoDate(value)) fail(code, 'Ngày không hợp lệ');
  return value;
}

function nullableZone(value: string | null | undefined): SurchargeZone | null {
  if (value == null || value === '') return null;
  if (value !== 'noi_thanh' && value !== 'tinh') fail('INVALID_FEE_CONDITION', 'Vùng không hợp lệ');
  return value;
}

function nullableVehicle(value: string | null | undefined): VehicleClass | null {
  if (value == null || value === '') return null;
  if (!['le_2_5', 'gt_8_16', 'gt_16_23', 'pallet'].includes(value)) {
    fail('INVALID_FEE_CONDITION', 'Khung xe không hợp lệ');
  }
  return value as VehicleClass;
}

function assertFeeType(value: string): FeeType {
  if (!FEE_TYPES.includes(value as FeeType)) fail('INVALID_FEE_CONDITION', 'Loại phí không hợp lệ');
  return value as FeeType;
}

function assertAmount(value: number): number {
  if (!Number.isInteger(value) || value < 0) fail('INVALID_AMOUNT', 'Đơn giá phải là số nguyên từ 0');
  return value;
}

async function assertDealerName(tenKhachHang: string): Promise<string> {
  const trimmed = tenKhachHang.trim();
  if (!trimmed) fail('CUSTOMER_NAME_UNKNOWN', 'Không có khách đang hoạt động với tên này');
  const found = await pool.query(
    `SELECT ten_khach_hang
     FROM customers
     WHERE status = 'active' AND lower(trim(ten_khach_hang)) = $1
     LIMIT 1`,
    [nameKey(trimmed)],
  );
  if (!found.rows[0]) fail('CUSTOMER_NAME_UNKNOWN', 'Không có khách đang hoạt động với tên này');
  return trimmed;
}

async function assertPoint(customerId: number, dealerName: string): Promise<{ id: number; ten_khach_hang: string }> {
  const found = await pool.query(
    `SELECT id, ten_khach_hang, dia_chi_giao_hang, status
     FROM customers WHERE id = $1`,
    [customerId],
  );
  const row = found.rows[0] as { id: number; ten_khach_hang: string; dia_chi_giao_hang: string | null; status: string } | undefined;
  if (!row || row.status !== 'active') fail('POINT_NOT_FOUND', 'Không tìm thấy điểm trả');
  if (nameKey(row.ten_khach_hang) !== nameKey(dealerName)) {
    fail('POINT_NAME_MISMATCH', 'Điểm trả không thuộc khách đã chọn');
  }
  if (!row.dia_chi_giao_hang || row.dia_chi_giao_hang.trim() === '') {
    fail('POINT_WITHOUT_ADDRESS', 'Điểm này không có địa chỉ giao hàng');
  }
  return { id: row.id, ten_khach_hang: row.ten_khach_hang };
}

async function loadScopeRules(feeType: FeeType, dealerName: string, customerId: number | null): Promise<RuleRow[]> {
  const result = await pool.query(
    `SELECT id, ten_khach_hang, customer_id, fee_type, zone, vehicle_class, amount, pricing_unit,
            start_date::text AS start_date, end_date::text AS end_date
     FROM customer_surcharge_rules
     WHERE fee_type = $1
       AND (
         ($2::int IS NULL AND customer_id IS NULL AND lower(trim(ten_khach_hang)) = $3)
         OR customer_id = $2
       )`,
    [feeType, customerId, nameKey(dealerName)],
  );
  return result.rows.map((row) => mapStored(row));
}

const NAME_FAILURE_CODES = new Set(['CUSTOMER_NAME_UNKNOWN', 'RULE_OPEN_EXISTS', 'RULE_OVERLAP', 'RULE_AMBIGUOUS']);

export function uniqueNames(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of names) {
    const trimmed = String(raw ?? '').trim();
    if (!trimmed) continue;
    const key = nameKey(trimmed);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

export function conflictCode(existing: RuleRow[], candidate: ConditionRule, ignoreId?: number): string | null {
  for (const row of existing) {
    if (ignoreId != null && row.id === ignoreId) continue;
    if (!conditionsConflict(row, candidate)) continue;
    const sameKey = row.zone === candidate.zone && row.vehicle_class === candidate.vehicle_class;
    if (sameKey) {
      if (row.end_date == null && candidate.end_date == null) return 'RULE_OPEN_EXISTS';
      return 'RULE_OVERLAP';
    }
    return 'RULE_AMBIGUOUS';
  }
  return null;
}

function assertNoConflict(existing: RuleRow[], candidate: ConditionRule, ignoreId?: number): void {
  const code = conflictCode(existing, candidate, ignoreId);
  if (code === 'RULE_OPEN_EXISTS') fail(code, 'Combo này đang mở');
  if (code === 'RULE_OVERLAP') fail(code, 'Khoảng ngày chồng với rule cùng combo');
  if (code === 'RULE_AMBIGUOUS') fail(code, 'Rule này trùng độ khớp với rule đang mở');
}

const RETURNING = `
  r.id, r.ten_khach_hang, r.customer_id, r.fee_type, r.zone, r.vehicle_class,
  r.amount, r.pricing_unit, r.start_date::text AS start_date, r.end_date::text AS end_date,
  r.created_at, r.updated_at,
  c.diem_tra_hang, c.dia_chi_giao_hang, c.status AS customer_status,
  NULLIF(trim(c.supplier_code), '') AS supplier_code,
  NULLIF(trim(sup.name), '') AS supplier_name
`;

const SUPPLIER_JOIN = `
  LEFT JOIN LATERAL (
    SELECT s.name
    FROM suppliers s
    WHERE c.supplier_code IS NOT NULL
      AND trim(c.supplier_code) <> ''
      AND s.supplier_code = c.supplier_code
    ORDER BY CASE WHEN s.status = 'active' THEN 0 ELSE 1 END, s.id DESC
    LIMIT 1
  ) sup ON TRUE
`;

export const customerSurchargeService = {
  async list(query: {
    ten_khach_hang?: string;
    fee_type?: string;
    zone?: string;
    vehicle_class?: string;
    status?: string;
    page?: number;
    page_size?: number;
  }): Promise<SurchargeListResult> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.page_size ?? 50));
    const where: string[] = [];
    const params: unknown[] = [];

    if (query.ten_khach_hang?.trim()) {
      params.push(nameContainsPattern(query.ten_khach_hang));
      where.push(`(${foldedExpr('r.ten_khach_hang')} LIKE $${params.length} ESCAPE '\\' OR ${foldedExpr("COALESCE(c.ten_khach_hang, '')")} LIKE $${params.length} ESCAPE '\\')`);
    }
    if (query.fee_type) {
      params.push(query.fee_type);
      where.push(`r.fee_type = $${params.length}`);
    }
    if (query.zone) {
      params.push(query.zone);
      where.push(`r.zone = $${params.length}`);
    }
    if (query.vehicle_class) {
      params.push(query.vehicle_class);
      where.push(`r.vehicle_class = $${params.length}`);
    }
    const status = query.status || 'open';
    if (status === 'open') where.push('r.end_date IS NULL');
    else if (status === 'closed') where.push('r.end_date IS NOT NULL');

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const count = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM customer_surcharge_rules r
       LEFT JOIN customers c ON c.id = r.customer_id
       ${whereSql}`,
      params,
    );
    const offset = (page - 1) * pageSize;
    const rows = await pool.query(
      `SELECT ${RETURNING},
              EXISTS (
                SELECT 1 FROM customer_surcharge_rules p
                WHERE p.id <> r.id
                  AND p.fee_type = r.fee_type
                  AND p.zone IS NOT DISTINCT FROM r.zone
                  AND p.vehicle_class IS NOT DISTINCT FROM r.vehicle_class
                  AND p.end_date IS NOT NULL
                  AND (
                    (r.customer_id IS NULL AND p.customer_id IS NULL AND lower(trim(p.ten_khach_hang)) = lower(trim(r.ten_khach_hang)))
                    OR (r.customer_id IS NOT NULL AND p.customer_id = r.customer_id)
                  )
              ) AS has_closed_prior
       FROM customer_surcharge_rules r
       LEFT JOIN customers c ON c.id = r.customer_id
       ${SUPPLIER_JOIN}
       ${whereSql}
       ORDER BY lower(trim(r.ten_khach_hang)) ASC, r.ten_khach_hang ASC, c.diem_tra_hang ASC NULLS FIRST, r.start_date DESC, r.id DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, offset],
    );
    return {
      items: rows.rows.map((row) => mapRule(row)),
      page,
      page_size: pageSize,
      total: Number(count.rows[0]?.total ?? 0),
    };
  },

  async customerOptions(): Promise<CustomerOptions> {
    const names = await pool.query(
      `SELECT DISTINCT ten_khach_hang
       FROM customers
       WHERE status = 'active'
       ORDER BY ten_khach_hang ASC`,
    );
    const points = await pool.query(
      `SELECT c.id, c.ten_khach_hang, c.diem_tra_hang, c.dia_chi_giao_hang,
              NULLIF(trim(c.supplier_code), '') AS supplier_code,
              NULLIF(trim(sup.name), '') AS supplier_name
       FROM customers c
       ${SUPPLIER_JOIN}
       WHERE c.status = 'active'
         AND c.dia_chi_giao_hang IS NOT NULL
         AND trim(c.dia_chi_giao_hang) <> ''
       ORDER BY c.diem_tra_hang ASC`,
    );
    return {
      names: names.rows.map((row) => String(row.ten_khach_hang)),
      points: points.rows.map((row) => ({
        id: Number(row.id),
        ten_khach_hang: String(row.ten_khach_hang),
        diem_tra_hang: String(row.diem_tra_hang),
        dia_chi_giao_hang: String(row.dia_chi_giao_hang),
        supplier_name: textOrNull(row.supplier_name),
        supplier_code: textOrNull(row.supplier_code),
      })),
    };
  },

  async create(input: {
    ten_khach_hang: string;
    customer_id?: number | null;
    fee_type: string;
    zone?: string | null;
    vehicle_class?: string | null;
    amount: number;
    start_date: string;
  }, userId: number): Promise<CustomerSurchargeRule> {
    const dealerName = await assertDealerName(input.ten_khach_hang);
    const feeType = assertFeeType(input.fee_type);
    const zone = nullableZone(input.zone);
    const vehicleClass = nullableVehicle(input.vehicle_class);
    const amount = assertAmount(input.amount);
    const startDate = assertDate(input.start_date);
    const customerId = input.customer_id ?? null;
    let snapshot = dealerName;
    if (customerId != null) {
      const point = await assertPoint(customerId, dealerName);
      snapshot = point.ten_khach_hang;
    }

    const existing = await loadScopeRules(feeType, dealerName, customerId);
    assertNoConflict(existing, { zone, vehicle_class: vehicleClass, start_date: startDate, end_date: null });

    const inserted = await pool.query(
      `INSERT INTO customer_surcharge_rules
         (ten_khach_hang, customer_id, fee_type, zone, vehicle_class, amount, pricing_unit, start_date, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
       RETURNING id`,
      [snapshot, customerId, feeType, zone, vehicleClass, amount, unitForFee(feeType), startDate, userId],
    );
    return this.getById(Number(inserted.rows[0].id));
  },

  async getById(id: number): Promise<CustomerSurchargeRule> {
    const result = await pool.query(
      `SELECT ${RETURNING}
       FROM customer_surcharge_rules r
       LEFT JOIN customers c ON c.id = r.customer_id
       ${SUPPLIER_JOIN}
       WHERE r.id = $1`,
      [id],
    );
    if (!result.rows[0]) fail('SURCHARGE_NOT_FOUND', 'Không tìm thấy phụ phí');
    return mapRule(result.rows[0]);
  },

  async replace(id: number, input: { amount: number; start_date: string }, userId: number): Promise<CustomerSurchargeRule> {
    const current = await this.getById(id);
    if (current.end_date != null) fail('CLOSED_RULE_IMMUTABLE', 'Rule đã đóng, không đổi được');
    const amount = assertAmount(input.amount);
    const startDate = assertDate(input.start_date);
    if (startDate <= current.start_date) fail('START_NOT_AFTER_OPEN', 'Ngày mới phải sau ngày bắt đầu hiện tại');

    const existing = await loadScopeRules(current.fee_type, current.ten_khach_hang, current.customer_id);
    const candidate: ConditionRule = {
      zone: current.zone,
      vehicle_class: current.vehicle_class,
      start_date: startDate,
      end_date: null,
    };
    assertNoConflict(existing, candidate, current.id);

    const closedEnd = addDays(startDate, -1);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE customer_surcharge_rules
         SET end_date = $2, updated_by = $3
         WHERE id = $1 AND end_date IS NULL`,
        [id, closedEnd, userId],
      );
      const inserted = await client.query(
        `INSERT INTO customer_surcharge_rules
           (ten_khach_hang, customer_id, fee_type, zone, vehicle_class, amount, pricing_unit, start_date, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
         RETURNING id`,
        [
          current.ten_khach_hang,
          current.customer_id,
          current.fee_type,
          current.zone,
          current.vehicle_class,
          amount,
          current.pricing_unit,
          startDate,
          userId,
        ],
      );
      await client.query('COMMIT');
      return this.getById(Number(inserted.rows[0].id));
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async stop(id: number, endDate: string | undefined, userId: number): Promise<CustomerSurchargeRule> {
    const current = await this.getById(id);
    if (current.end_date != null) fail('CLOSED_RULE_IMMUTABLE', 'Rule đã đóng, không đổi được');
    const end = assertDate(endDate ?? todayIso());
    if (end < current.start_date) fail('INVALID_FEE_CONDITION', 'Ngày ngừng không được trước ngày bắt đầu');
    await pool.query(
      `UPDATE customer_surcharge_rules SET end_date = $2, updated_by = $3 WHERE id = $1`,
      [id, end, userId],
    );
    return this.getById(id);
  },

  async createBatch(input: {
    names: string[];
    customer_id?: number | null;
    fee_type: string;
    zone?: string | null;
    vehicle_class?: string | null;
    amount: number;
    start_date: string;
  }, userId: number): Promise<CustomerSurchargeRule[]> {
    const names = uniqueNames(input.names);
    if (names.length === 0) fail('CUSTOMER_NAME_UNKNOWN', 'Không có khách đang hoạt động với tên này');
    if (names.length > 1 && input.customer_id != null) {
      fail('POINT_NOT_ALLOWED_FOR_BATCH', 'Không gắn điểm trả khi tạo cho nhiều khách');
    }
    if (names.length === 1) {
      try {
        const rule = await this.create({
          ten_khach_hang: names[0],
          customer_id: input.customer_id,
          fee_type: input.fee_type,
          zone: input.zone,
          vehicle_class: input.vehicle_class,
          amount: input.amount,
          start_date: input.start_date,
        }, userId);
        return [rule];
      } catch (err) {
        const code = (err as { code?: string }).code;
        if (code && NAME_FAILURE_CODES.has(code)) {
          throw { code: 'BATCH_REJECTED', failures: [{ ten_khach_hang: names[0], code }] };
        }
        throw err;
      }
    }
    return this.createMany(input, names, userId);
  },

  async createMany(input: {
    fee_type: string;
    zone?: string | null;
    vehicle_class?: string | null;
    amount: number;
    start_date: string;
  }, names: string[], userId: number): Promise<CustomerSurchargeRule[]> {
    const feeType = assertFeeType(input.fee_type);
    const zone = nullableZone(input.zone);
    const vehicleClass = nullableVehicle(input.vehicle_class);
    const amount = assertAmount(input.amount);
    const startDate = assertDate(input.start_date);
    const candidate: ConditionRule = { zone, vehicle_class: vehicleClass, start_date: startDate, end_date: null };

    const client = await pool.connect();
    let open = true;
    try {
      await client.query('BEGIN');
      const failures: { ten_khach_hang: string; code: string }[] = [];
      const ready: string[] = [];
      for (const name of names) {
        const found = await client.query(
          `SELECT 1 FROM customers
           WHERE status = 'active' AND lower(trim(ten_khach_hang)) = $1
           LIMIT 1`,
          [nameKey(name)],
        );
        if (!found.rows[0]) {
          failures.push({ ten_khach_hang: name, code: 'CUSTOMER_NAME_UNKNOWN' });
          continue;
        }
        const existing = await client.query(
          `SELECT id, ten_khach_hang, customer_id, fee_type, zone, vehicle_class, amount, pricing_unit,
                  start_date::text AS start_date, end_date::text AS end_date
           FROM customer_surcharge_rules
           WHERE fee_type = $1 AND customer_id IS NULL AND lower(trim(ten_khach_hang)) = $2`,
          [feeType, nameKey(name)],
        );
        const code = conflictCode(existing.rows.map((row) => mapStored(row)), candidate);
        if (code) failures.push({ ten_khach_hang: name, code });
        else ready.push(name);
      }
      if (failures.length) {
        await client.query('ROLLBACK');
        open = false;
        throw { code: 'BATCH_REJECTED', failures };
      }
      const ids: number[] = [];
      for (const name of ready) {
        const inserted = await client.query(
          `INSERT INTO customer_surcharge_rules
             (ten_khach_hang, customer_id, fee_type, zone, vehicle_class, amount, pricing_unit, start_date, created_by, updated_by)
           VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8, $8)
           RETURNING id`,
          [name, feeType, zone, vehicleClass, amount, unitForFee(feeType), startDate, userId],
        );
        ids.push(Number(inserted.rows[0].id));
      }
      await client.query('COMMIT');
      open = false;
      const items: CustomerSurchargeRule[] = [];
      for (const id of ids) items.push(await this.getById(id));
      return items;
    } catch (err) {
      if (open) await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  },

  async remove(id: number): Promise<CustomerSurchargeRule> {
    const current = await this.getById(id);
    const deleted = await pool.query('DELETE FROM customer_surcharge_rules WHERE id = $1', [id]);
    if (deleted.rowCount === 0) fail('SURCHARGE_NOT_FOUND', 'Không tìm thấy phụ phí');
    return current;
  },

  async lookup(input: {
    ten_khach_hang: string;
    dia_chi_giao_hang: string;
    zone: string;
    vehicle_class: string;
    on_date: string;
    supplier_code?: string | null;
  }): Promise<SurchargeLookupResult> {
    const zone = nullableZone(input.zone);
    const vehicleClass = nullableVehicle(input.vehicle_class);
    if (!zone || !vehicleClass) fail('INVALID_FEE_CONDITION', 'Vùng và khung xe là bắt buộc khi tra cứu');
    const onDate = assertDate(input.on_date);
    const customerName = nameKey(input.ten_khach_hang ?? '');
    const address = nameKey(input.dia_chi_giao_hang ?? '');

    if (!customerName || !address) {
      return {
        point_status: 'NO_POINT',
        point: null,
        fees: await this.resolveFees(customerName, null, zone, vehicleClass, onDate),
      };
    }

    const sentCode = nameKey(input.supplier_code ?? '');
    const points = await pool.query(
      `SELECT c.id, c.diem_tra_hang, c.tuyen_phuong, c.diem_giao_hang_tinh_phi,
              NULLIF(trim(c.supplier_code), '') AS supplier_code,
              NULLIF(trim(sup.name), '') AS supplier_name
       FROM customers c
       ${SUPPLIER_JOIN}
       WHERE c.status = 'active'
         AND lower(trim(c.ten_khach_hang)) = $1
         AND lower(trim(c.dia_chi_giao_hang)) = $2`,
      [customerName, address],
    );
    const rows = sentCode
      ? points.rows.filter((row) => nameKey(String(row.supplier_code ?? '')) === sentCode)
      : points.rows;
    if (rows.length > 1) {
      return { point_status: 'AMBIGUOUS', point: null, fees: ambiguousFees() };
    }
    if (rows.length === 0) {
      return {
        point_status: 'NO_POINT',
        point: null,
        fees: await this.resolveFees(customerName, null, zone, vehicleClass, onDate),
      };
    }
    const point = rows[0];
    return {
      point_status: 'MATCHED',
      point: {
        diem_tra_hang: String(point.diem_tra_hang),
        tuyen_phuong: point.tuyen_phuong == null ? null : String(point.tuyen_phuong),
        diem_giao_hang_tinh_phi: point.diem_giao_hang_tinh_phi == null ? null : String(point.diem_giao_hang_tinh_phi),
        supplier_name: textOrNull(point.supplier_name),
        supplier_code: textOrNull(point.supplier_code),
      },
      fees: await this.resolveFees(customerName, Number(point.id), zone, vehicleClass, onDate),
    };
  },

  async resolveFees(
    customerName: string,
    customerId: number | null,
    zone: SurchargeZone,
    vehicleClass: VehicleClass,
    onDate: string,
  ): Promise<Record<FeeType, FeeHit>> {
    const params: unknown[] = [onDate, customerName];
    let pointClause = 'FALSE';
    if (customerId != null) {
      params.push(customerId);
      pointClause = `customer_id = $${params.length}`;
    }
    const rows = await pool.query(
      `SELECT id, ten_khach_hang, customer_id, fee_type, zone, vehicle_class, amount, pricing_unit,
              start_date::text AS start_date, end_date::text AS end_date
       FROM customer_surcharge_rules
       WHERE start_date <= $1
         AND (end_date IS NULL OR end_date >= $1)
         AND (
           (customer_id IS NULL AND lower(trim(ten_khach_hang)) = $2)
           OR ${pointClause}
         )`,
      params,
    );
    const effective = rows.rows.map((row) => mapStored(row));
    const fees = {} as Record<FeeType, FeeHit>;
    for (const feeType of FEE_TYPES) {
      const pointRules = customerId == null
        ? []
        : effective.filter((rule) => rule.customer_id === customerId && rule.fee_type === feeType);
      if (pointRules.length > 0) {
        fees[feeType] = pickFee(pointRules, zone, vehicleClass, 'diem');
      } else {
        const dealerRules = effective.filter(
          (rule) => rule.customer_id == null && rule.fee_type === feeType,
        );
        fees[feeType] = pickFee(dealerRules, zone, vehicleClass, 'dai_ly');
      }
    }
    return fees;
  },
};
