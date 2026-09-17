import { PoolClient } from 'pg';
import { pool } from '../config/database';
import {
  PriceSet,
  PriceSetTier,
  PriceSetTierInput,
  PricingMode,
  PricingUnit,
  RoutePriceTier,
} from '../types/routePricing';

type ServiceError = Error & { code: string };

function err(code: string, message?: string): ServiceError {
  return Object.assign(new Error(message ?? code), { code });
}

function num(value: unknown): number {
  return typeof value === 'number' ? value : Number(value);
}

function nullableNumber(value: unknown): number | null {
  return value == null ? null : num(value);
}

export function priceSetTierToken(tier: {
  range_from?: number | null;
  range_to?: number | null;
  pricing_unit: string;
  min_billable_ton?: number | null;
  label?: string | null;
}): string {
  const label = (tier.label ?? '').trim();
  if (label) return `truck:${label}|${tier.pricing_unit}`;
  const to = tier.range_to == null ? 'inf' : String(Number(tier.range_to));
  const min =
    tier.min_billable_ton != null && Number(tier.min_billable_ton) > 0
      ? `:min${Number(tier.min_billable_ton)}`
      : '';
  return `${tier.pricing_unit}:${Number(tier.range_from)}-${to}${min}`;
}

export function priceSetFingerprint(set: {
  pricing_mode: PricingMode;
  has_pallet: boolean;
  tiers: Array<Parameters<typeof priceSetTierToken>[0]>;
}): string {
  const body = set.tiers
    .map((tier) => {
      const label = (tier.label ?? '').trim();
      if (label) return `t:${label}:${tier.pricing_unit}`;
      const to = tier.range_to == null ? 'inf' : String(Number(tier.range_to));
      const min =
        tier.min_billable_ton != null && Number(tier.min_billable_ton) > 0
          ? `:min${Number(tier.min_billable_ton)}`
          : '';
      const prefix = set.pricing_mode === 'by_trips' ? 'trips' : 'w';
      return `${prefix}:${Number(tier.range_from)}-${to}${set.pricing_mode === 'by_trips' ? '' : `:${tier.pricing_unit}${min}`}`;
    })
    .join('|');
  return `${set.pricing_mode}|pallet:${set.has_pallet ? 1 : 0}|${body}`;
}

export function priceSetTokens(set: {
  has_pallet: boolean;
  tiers: Array<Parameters<typeof priceSetTierToken>[0]>;
}): string[] {
  const tokens = set.tiers.map(priceSetTierToken);
  if (set.has_pallet) tokens.push('pallet');
  return tokens;
}

function uniqueSetError(error: unknown): never {
  const constraint = (error as { constraint?: string }).constraint ?? '';
  if (constraint.includes('fingerprint')) {
    throw err('PRICE_SET_SUBSET', 'Khung này đã nằm trong bộ giá khác');
  }
  throw err('PRICE_SET_NAME_DUPLICATE');
}

function isTokenSubset(left: string[], right: string[]): boolean {
  if (left.length > right.length) return false;
  const bag = new Map<string, number>();
  for (const token of right) bag.set(token, (bag.get(token) ?? 0) + 1);
  for (const token of left) {
    const leftCount = bag.get(token) ?? 0;
    if (leftCount <= 0) return false;
    bag.set(token, leftCount - 1);
  }
  return true;
}

export function priceSetsConflict(
  left: { has_pallet: boolean; tiers: Array<Parameters<typeof priceSetTierToken>[0]> },
  right: { has_pallet: boolean; tiers: Array<Parameters<typeof priceSetTierToken>[0]> },
): boolean {
  const a = priceSetTokens(left);
  const b = priceSetTokens(right);
  return isTokenSubset(a, b) || isTokenSubset(b, a);
}

function normalizeTierInput(mode: PricingMode, input: PriceSetTierInput, sort: number): PriceSetTier {
  if (mode === 'by_truck') {
    const label = (input.label ?? '').trim();
    if (!label) throw err('INVALID_TIERS', 'Nhãn bậc không được trống');
    if (input.pricing_unit !== 'chuyen' && input.pricing_unit !== 'tan') {
      throw err('INVALID_TIERS', 'Đơn vị bậc không hợp lệ');
    }
    return {
      id: 0,
      price_set_id: 0,
      sort_order: sort,
      range_from: 0,
      range_to: null,
      pricing_unit: input.pricing_unit,
      min_billable_ton: null,
      label,
    };
  }
  const from = num(input.range_from);
  const to = input.range_to == null || input.range_to === ('' as never) ? null : num(input.range_to);
  if (Number.isNaN(from) || from < 0) throw err('INVALID_TIERS', 'Khoảng bậc không hợp lệ');
  if (to != null && (Number.isNaN(to) || from > to)) throw err('INVALID_TIERS', 'Khoảng bậc không hợp lệ');
  const min =
    mode === 'by_weight' && input.pricing_unit === 'tan' && num(input.min_billable_ton ?? 0) > 0
      ? num(input.min_billable_ton)
      : null;
  return {
    id: 0,
    price_set_id: 0,
    sort_order: sort,
    range_from: from,
    range_to: to,
    pricing_unit: input.pricing_unit,
    min_billable_ton: min,
    label: null,
  };
}

function assertStructure(mode: PricingMode, tiers: PriceSetTier[]): void {
  if (tiers.length < 1) throw err('INVALID_TIERS', 'Bộ giá cần ít nhất một bậc');
  if (mode === 'by_truck') {
    const labels = new Set<string>();
    for (const tier of tiers) {
      if (!tier.label) throw err('INVALID_TIERS', 'Nhãn bậc không được trống');
      if (labels.has(tier.label)) throw err('INVALID_TIERS', 'Nhãn bậc bị trùng');
      labels.add(tier.label);
    }
    return;
  }
  const ordered = [...tiers].sort((a, b) => num(a.range_from) - num(b.range_from));
  for (let i = 0; i < ordered.length; i++) {
    for (let j = i + 1; j < ordered.length; j++) {
      const a = ordered[i];
      const b = ordered[j];
      const aTo = a.range_to;
      const bTo = b.range_to;
      const overlap =
        num(a.range_from) < (bTo ?? Number.POSITIVE_INFINITY) &&
        num(b.range_from) < (aTo ?? Number.POSITIVE_INFINITY);
      if (overlap) throw err('INVALID_TIERS', 'Các bậc bị chồng khoảng');
    }
  }
}

function mapTier(row: Record<string, unknown>): PriceSetTier {
  return {
    id: num(row.id),
    price_set_id: num(row.price_set_id),
    sort_order: num(row.sort_order),
    range_from: nullableNumber(row.range_from),
    range_to: nullableNumber(row.range_to),
    pricing_unit: row.pricing_unit as PricingUnit,
    min_billable_ton: nullableNumber(row.min_billable_ton),
    label: row.label == null ? null : String(row.label),
  };
}

async function loadTiers(setId: number, client?: PoolClient): Promise<PriceSetTier[]> {
  const q = client ?? pool;
  const result = await q.query(
    `SELECT * FROM price_set_tiers WHERE price_set_id=$1 ORDER BY sort_order`,
    [setId],
  );
  return result.rows.map(mapTier);
}

async function groupCount(setId: number, client?: PoolClient): Promise<number> {
  const q = client ?? pool;
  const result = await q.query(
    `SELECT count(*)::int AS n
     FROM route_price_configs c
     WHERE c.price_set_id=$1
       AND EXISTS (SELECT 1 FROM route_price_versions v WHERE v.price_config_id=c.id)`,
    [setId],
  );
  return num(result.rows[0].n);
}

function mapSet(row: Record<string, unknown>, tiers: PriceSetTier[], groups: number): PriceSet {
  return {
    id: num(row.id),
    name: String(row.name),
    pricing_mode: row.pricing_mode as PricingMode,
    has_pallet: Boolean(row.has_pallet),
    status: row.status as 'active' | 'deactive',
    tiers,
    group_count: groups,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

async function assertNoConflict(
  candidate: { has_pallet: boolean; tiers: PriceSetTier[] },
  ignoreId: number | null,
  client: PoolClient,
): Promise<void> {
  const existing = await client.query(
    `SELECT id, has_pallet FROM price_sets WHERE status='active' AND ($1::int IS NULL OR id<>$1)`,
    [ignoreId],
  );
  for (const row of existing.rows) {
    const tiers = await loadTiers(num(row.id), client);
    if (priceSetsConflict(candidate, { has_pallet: Boolean(row.has_pallet), tiers })) {
      throw err('PRICE_SET_SUBSET', 'Khung này đã nằm trong bộ giá khác');
    }
  }
}

async function insertTierRows(client: PoolClient, setId: number, tiers: PriceSetTier[]): Promise<void> {
  for (const tier of tiers) {
    await client.query(
      `INSERT INTO price_set_tiers
        (price_set_id, sort_order, range_from, range_to, pricing_unit, min_billable_ton, label)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        setId,
        tier.sort_order,
        tier.range_from,
        tier.range_to,
        tier.pricing_unit,
        tier.min_billable_ton,
        tier.label,
      ],
    );
  }
}

export const priceSetService = {
  async list(): Promise<PriceSet[]> {
    const rows = await pool.query(
      `SELECT * FROM price_sets WHERE status='active' ORDER BY name`,
    );
    const sets: PriceSet[] = [];
    for (const row of rows.rows) {
      const tiers = await loadTiers(num(row.id));
      sets.push(mapSet(row, tiers, await groupCount(num(row.id))));
    }
    return sets;
  },

  async getActive(id: number, client?: PoolClient): Promise<PriceSet> {
    const q = client ?? pool;
    const row = await q.query(`SELECT * FROM price_sets WHERE id=$1 AND status='active'`, [id]);
    if (!row.rows[0]) throw err('NOT_FOUND', 'Không tìm thấy bộ giá');
    const tiers = await loadTiers(id, client);
    return mapSet(row.rows[0], tiers, await groupCount(id, client));
  },

  async create(
    data: {
      name: string;
      pricing_mode: PricingMode;
      has_pallet: boolean;
      tiers: PriceSetTierInput[];
    },
    userId: number,
  ): Promise<PriceSet> {
    const name = data.name.trim();
    if (!name) throw err('INVALID_PRICE_SET_NAME', 'Nhập tên bộ giá');
    const tiers = data.tiers.map((tier, index) => normalizeTierInput(data.pricing_mode, tier, index));
    assertStructure(data.pricing_mode, tiers);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await assertNoConflict({ has_pallet: data.has_pallet, tiers }, null, client);
      const inserted = await client.query(
        `INSERT INTO price_sets (name, pricing_mode, has_pallet, fingerprint, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$5) RETURNING *`,
        [
          name,
          data.pricing_mode,
          data.has_pallet,
          priceSetFingerprint({ pricing_mode: data.pricing_mode, has_pallet: data.has_pallet, tiers }),
          userId,
        ],
      );
      await insertTierRows(client, num(inserted.rows[0].id), tiers);
      await client.query('COMMIT');
      return mapSet(inserted.rows[0], await loadTiers(num(inserted.rows[0].id)), 0);
    } catch (error) {
      await client.query('ROLLBACK');
      if ((error as { code?: string }).code === '23505') throw uniqueSetError(error);
      throw error;
    } finally {
      client.release();
    }
  },

  async rename(id: number, name: string, userId: number): Promise<PriceSet> {
    const trimmed = name.trim();
    if (!trimmed) throw err('INVALID_PRICE_SET_NAME', 'Nhập tên bộ giá');
    try {
      const updated = await pool.query(
        `UPDATE price_sets SET name=$1, updated_by=$2 WHERE id=$3 AND status='active' RETURNING *`,
        [trimmed, userId, id],
      );
      if (!updated.rows[0]) throw err('NOT_FOUND', 'Không tìm thấy bộ giá');
      return mapSet(updated.rows[0], await loadTiers(id), await groupCount(id));
    } catch (error) {
      if ((error as { code?: string }).code === '23505') throw uniqueSetError(error);
      throw error;
    }
  },

  async addTier(id: number, input: PriceSetTierInput, userId: number): Promise<PriceSet> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const set = await this.getActive(id, client);
      const next = normalizeTierInput(set.pricing_mode, input, set.tiers.length);
      const tiers = [...set.tiers, next];
      assertStructure(set.pricing_mode, tiers);
      await assertNoConflict({ has_pallet: set.has_pallet, tiers }, id, client);
      await client.query(
        `INSERT INTO price_set_tiers
          (price_set_id, sort_order, range_from, range_to, pricing_unit, min_billable_ton, label)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [id, next.sort_order, next.range_from, next.range_to, next.pricing_unit, next.min_billable_ton, next.label],
      );
      await client.query(
        `UPDATE price_sets SET fingerprint=$1, updated_by=$2 WHERE id=$3`,
        [
          priceSetFingerprint({ pricing_mode: set.pricing_mode, has_pallet: set.has_pallet, tiers }),
          userId,
          id,
        ],
      );
      await client.query('COMMIT');
      return this.getActive(id);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async replaceStructure(
    id: number,
    data: { has_pallet: boolean; tiers: PriceSetTierInput[] },
    userId: number,
  ): Promise<PriceSet> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const set = await this.getActive(id, client);
      if ((await groupCount(id, client)) > 0) throw err('PRICE_SET_IN_USE');
      const tiers = data.tiers.map((tier, index) => normalizeTierInput(set.pricing_mode, tier, index));
      assertStructure(set.pricing_mode, tiers);
      await assertNoConflict({ has_pallet: data.has_pallet, tiers }, id, client);
      await client.query(`DELETE FROM price_set_tiers WHERE price_set_id=$1`, [id]);
      await insertTierRows(client, id, tiers);
      await client.query(
        `UPDATE price_sets SET has_pallet=$1, fingerprint=$2, updated_by=$3 WHERE id=$4`,
        [
          data.has_pallet,
          priceSetFingerprint({ pricing_mode: set.pricing_mode, has_pallet: data.has_pallet, tiers }),
          userId,
          id,
        ],
      );
      await client.query('COMMIT');
      return this.getActive(id);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async deactivate(id: number, userId: number): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const set = await client.query(`SELECT id FROM price_sets WHERE id=$1 AND status='active' FOR UPDATE`, [id]);
      if (!set.rows[0]) throw err('NOT_FOUND', 'Không tìm thấy bộ giá');
      if ((await groupCount(id, client)) > 0) throw err('PRICE_SET_IN_USE');
      await client.query(
        `UPDATE price_sets SET status='deactive', updated_by=$1 WHERE id=$2`,
        [userId, id],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },
};

export function materializePricedTiers(
  set: PriceSet,
  incoming: Array<{ price_set_tier_id?: number; price: number }>,
): RoutePriceTier[] {
  const byId = new Map(set.tiers.map((tier) => [tier.id, tier]));
  const seen = new Set<number>();
  const priced: RoutePriceTier[] = [];
  for (const row of incoming) {
    if (row.price_set_tier_id == null) throw err('TIER_NOT_IN_SET', 'Bậc không thuộc bộ giá');
    const tier = byId.get(num(row.price_set_tier_id));
    if (!tier) throw err('TIER_NOT_IN_SET', 'Bậc không thuộc bộ giá');
    if (seen.has(tier.id)) throw err('TIER_NOT_IN_SET', 'Bậc bị trùng');
    seen.add(tier.id);
    if (!(num(row.price) > 0) || Number.isNaN(num(row.price))) {
      throw err('PRICE_NOT_POSITIVE', 'Giá phải lớn hơn 0');
    }
    priced.push({
      price_set_tier_id: tier.id,
      range_from: num(tier.range_from ?? 0),
      range_to: tier.range_to,
      pricing_unit: tier.pricing_unit,
      price: num(row.price),
      min_billable_ton: tier.min_billable_ton,
      sort_order: tier.sort_order,
      label: tier.label,
    });
  }
  return priced;
}

export function normalizePallet(set: PriceSet, pallet: number | null | undefined): number | null {
  if (!set.has_pallet) {
    if (pallet != null) throw err('PALLET_NOT_IN_SET', 'Bộ giá không có pallet');
    return null;
  }
  if (pallet == null) return null;
  if (!(num(pallet) > 0) || Number.isNaN(num(pallet))) {
    throw err('PRICE_NOT_POSITIVE', 'Giá phải lớn hơn 0');
  }
  return num(pallet);
}
