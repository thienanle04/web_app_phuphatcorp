/**
 * Bind F-sheet seeds to price_sets (migration 055).
 *
 * Seeds choose an existing full catalog set. They never insert a per-row subset
 * set. A missing canonical set is created only when it does not conflict with an
 * active set. Empty Excel cells stay unwritten. Pallet 0 is stored as NULL.
 *
 * Fingerprint / token rules must match backend/src/services/priceSetService.ts.
 */
import type { PoolClient } from '../backend/node_modules/@types/pg/index';

export type PricingMode = 'by_weight' | 'by_trips' | 'by_truck';
export type PricingUnit = 'tan' | 'chuyen';

export interface SpecTier {
  range_from: number;
  range_to: number | null;
  pricing_unit: PricingUnit;
  min_billable_ton?: number | null;
  label?: string | null;
}

export interface PriceSetSpec {
  name: string;
  pricing_mode: PricingMode;
  has_pallet: boolean;
  tiers: SpecTier[];
}

export interface SeedPricedTier {
  from: number;
  to: number | null;
  unit: PricingUnit;
  price: number;
  min: number | null;
  label?: string | null;
}

export interface BoundPriceSet {
  id: number;
  name: string;
  pricing_mode: PricingMode;
  has_pallet: boolean;
  fingerprint: string;
  tiers: Array<SpecTier & { id: number; sort_order: number }>;
}

export interface PriceSetCatalog {
  get(spec: PriceSetSpec): BoundPriceSet;
}

const STANDARD_WEIGHT_TIERS: SpecTier[] = [
  { range_from: 0, range_to: 2.5, pricing_unit: 'chuyen' },
  { range_from: 2.5, range_to: 8, pricing_unit: 'tan', min_billable_ton: 5 },
  { range_from: 8, range_to: 16, pricing_unit: 'tan' },
  { range_from: 16, range_to: 23, pricing_unit: 'tan' },
  { range_from: 23, range_to: null, pricing_unit: 'tan' },
];

/** Full weight frame. Sheets that omit a band still bind this set and leave that band empty. */
export const STANDARD_WEIGHT_PALLET: PriceSetSpec = {
  name: 'Tấn chuẩn + Pallet',
  pricing_mode: 'by_weight',
  has_pallet: true,
  tiers: STANDARD_WEIGHT_TIERS,
};

export const IBC_WEIGHT: PriceSetSpec = {
  name: 'IBC 3–7 / 7–10 / 10+',
  pricing_mode: 'by_weight',
  has_pallet: false,
  tiers: [
    { range_from: 3, range_to: 7, pricing_unit: 'tan' },
    { range_from: 7, range_to: 10, pricing_unit: 'tan' },
    { range_from: 10, range_to: null, pricing_unit: 'tan' },
  ],
};

export const TRIPS_CLF_1_12: PriceSetSpec = {
  name: 'Chuyến CLF 1–12 / 13+',
  pricing_mode: 'by_trips',
  has_pallet: false,
  tiers: [
    { range_from: 1, range_to: 12, pricing_unit: 'chuyen' },
    { range_from: 13, range_to: null, pricing_unit: 'chuyen' },
  ],
};

export const TRIPS_1_3: PriceSetSpec = {
  name: 'Chuyến 1–3 / >3',
  pricing_mode: 'by_trips',
  has_pallet: false,
  tiers: [
    { range_from: 1, range_to: 3, pricing_unit: 'chuyen' },
    { range_from: 4, range_to: null, pricing_unit: 'chuyen' },
  ],
};

export const TRIPS_1_PLUS: PriceSetSpec = {
  name: 'Chuyến 1+',
  pricing_mode: 'by_trips',
  has_pallet: false,
  tiers: [{ range_from: 1, range_to: null, pricing_unit: 'chuyen' }],
};

export const TRIPS_MCC_GH: PriceSetSpec = {
  name: 'Chuyến MCC GH 1–2 / 3 / 4–5 / 6+',
  pricing_mode: 'by_trips',
  has_pallet: false,
  tiers: [
    { range_from: 1, range_to: 2, pricing_unit: 'chuyen' },
    { range_from: 3, range_to: 3, pricing_unit: 'chuyen' },
    { range_from: 4, range_to: 5, pricing_unit: 'chuyen' },
    { range_from: 6, range_to: null, pricing_unit: 'chuyen' },
  ],
};

export const TRIPS_NDFC_TT: PriceSetSpec = {
  name: 'Chuyến NDFC 1–2 / 3–5 / 6+',
  pricing_mode: 'by_trips',
  has_pallet: false,
  tiers: [
    { range_from: 1, range_to: 2, pricing_unit: 'chuyen' },
    { range_from: 3, range_to: 5, pricing_unit: 'chuyen' },
    { range_from: 6, range_to: null, pricing_unit: 'chuyen' },
  ],
};

export const TRUCK_VP_HP: PriceSetSpec = {
  name: 'Truck VP Hiệp Phước',
  pricing_mode: 'by_truck',
  has_pallet: false,
  tiers: [
    { range_from: 0, range_to: null, pricing_unit: 'chuyen', label: 'Truck ≤2.5' },
    { range_from: 0, range_to: null, pricing_unit: 'tan', label: 'Truck <9' },
    { range_from: 0, range_to: null, pricing_unit: 'tan', label: 'Truck ≥15' },
    { range_from: 0, range_to: null, pricing_unit: 'tan', label: '8< Truck ≤16' },
    { range_from: 0, range_to: null, pricing_unit: 'tan', label: '16< Truck ≤23' },
    { range_from: 0, range_to: null, pricing_unit: 'tan', label: 'Truck >23' },
  ],
};

export const TRUCK_CLV: PriceSetSpec = {
  name: 'Truck CLV nguyên chuyến',
  pricing_mode: 'by_truck',
  has_pallet: false,
  tiers: [
    { range_from: 0, range_to: null, pricing_unit: 'chuyen', label: 'Truck 0,5mt' },
    { range_from: 0, range_to: null, pricing_unit: 'chuyen', label: 'Truck 1,25mt' },
    { range_from: 0, range_to: null, pricing_unit: 'chuyen', label: 'Truck 1,5mt' },
    { range_from: 0, range_to: null, pricing_unit: 'chuyen', label: 'Truck 2,5mt' },
    { range_from: 0, range_to: null, pricing_unit: 'tan', label: 'Truck 15mt' },
  ],
};

function num(value: unknown): number {
  return typeof value === 'number' ? value : Number(value);
}

function nullableNumber(value: unknown): number | null {
  return value == null ? null : num(value);
}

/** Token used for subset checks — same as priceSetTierToken. */
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
  tiers: SpecTier[];
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
      return `${prefix}:${Number(tier.range_from)}-${to}${
        set.pricing_mode === 'by_trips' ? '' : `:${tier.pricing_unit}${min}`
      }`;
    })
    .join('|');
  return `${set.pricing_mode}|pallet:${set.has_pallet ? 1 : 0}|${body}`;
}

function specTokens(spec: { has_pallet: boolean; tiers: SpecTier[] }): string[] {
  const tokens = spec.tiers.map((tier) => priceSetTierToken(tier));
  if (spec.has_pallet) tokens.push('pallet');
  return tokens;
}

function isTokenSubset(left: string[], right: string[]): boolean {
  if (left.length > right.length) return false;
  const bag = new Map<string, number>();
  for (const token of right) bag.set(token, (bag.get(token) ?? 0) + 1);
  for (const token of left) {
    const count = bag.get(token) ?? 0;
    if (count <= 0) return false;
    bag.set(token, count - 1);
  }
  return true;
}

function sameBag(left: string[], right: string[]): boolean {
  return left.length === right.length && isTokenSubset(left, right);
}

function pricedToken(tier: SeedPricedTier): string {
  return priceSetTierToken({
    range_from: tier.from,
    range_to: tier.to,
    pricing_unit: tier.unit,
    min_billable_ton: tier.min,
    label: tier.label,
  });
}

export function uniquePriceSetSpecs(specs: PriceSetSpec[]): PriceSetSpec[] {
  const seen = new Set<string>();
  const out: PriceSetSpec[] = [];
  for (const spec of specs) {
    const key = priceSetFingerprint(spec);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(spec);
  }
  return out;
}

export function assertTiersBelongToSpec(
  spec: PriceSetSpec,
  tiers: SeedPricedTier[],
  context: string,
): void {
  const tokens = new Set(spec.tiers.map((tier) => priceSetTierToken(tier)));
  for (const tier of tiers) {
    if (!(tier.price > 0)) continue;
    const token = priceSetTierToken({
      range_from: tier.from,
      range_to: tier.to,
      pricing_unit: tier.unit,
      min_billable_ton: tier.min,
      label: tier.label,
    });
    if (!tokens.has(token)) {
      throw new Error(`${context}: bậc ${token} không thuộc bộ "${spec.name}". Không tạo bộ tập con.`);
    }
  }
}

export function logRequiredPriceSets(specs: PriceSetSpec[]): void {
  console.log('Price sets required (full catalog, not per-row subsets):');
  for (const spec of uniquePriceSetSpecs(specs)) {
    console.log(`  - ${spec.name} [${priceSetFingerprint(spec)}]`);
  }
}

function mapBound(row: Record<string, unknown>, tiers: BoundPriceSet['tiers']): BoundPriceSet {
  return {
    id: num(row.id),
    name: String(row.name),
    pricing_mode: row.pricing_mode as PricingMode,
    has_pallet: Boolean(row.has_pallet),
    fingerprint: String(row.fingerprint),
    tiers,
  };
}

async function loadActiveSets(client: PoolClient): Promise<BoundPriceSet[]> {
  const sets = await client.query<Record<string, unknown>>(
    `SELECT id, name, pricing_mode, has_pallet, fingerprint
     FROM price_sets WHERE status = 'active' ORDER BY id`,
  );
  const out: BoundPriceSet[] = [];
  for (const row of sets.rows) {
    const tiers = await client.query<Record<string, unknown>>(
      `SELECT id, sort_order, range_from, range_to, pricing_unit, min_billable_ton, label
       FROM price_set_tiers WHERE price_set_id = $1 ORDER BY sort_order, id`,
      [num(row.id)],
    );
    out.push(
      mapBound(
        row,
        tiers.rows.map((tier) => ({
          id: num(tier.id),
          sort_order: num(tier.sort_order),
          range_from: num(tier.range_from),
          range_to: nullableNumber(tier.range_to),
          pricing_unit: tier.pricing_unit as PricingUnit,
          min_billable_ton: nullableNumber(tier.min_billable_ton),
          label: tier.label == null ? null : String(tier.label),
        })),
      ),
    );
  }
  return out;
}

function describeSet(set: { name: string; fingerprint?: string; id?: number }): string {
  const id = set.id == null ? '' : ` id=${set.id}`;
  const fp = set.fingerprint ? ` [${set.fingerprint}]` : '';
  return `"${set.name}"${id}${fp}`;
}

function assertNoCreateConflict(spec: PriceSetSpec, active: BoundPriceSet[]): void {
  const incoming = specTokens(spec);
  for (const set of active) {
    const tokens = specTokens(set);
    if (isTokenSubset(incoming, tokens) || isTokenSubset(tokens, incoming)) {
      throw new Error(
        `Không tạo bộ ${describeSet(spec)}: khung trùng hoặc là tập con của bộ đang active ${describeSet(set)}. ` +
          'Seed chỉ gắn bộ đầy đủ đã có, không tạo bộ tập con. Deactive bộ trùng hoặc sửa bộ đó cho đúng khung rồi chạy lại.',
      );
    }
  }
}

function pickBindTarget(spec: PriceSetSpec, active: BoundPriceSet[]): BoundPriceSet | null {
  const wanted = specTokens(spec);
  const exact = active.filter(
    (set) =>
      set.pricing_mode === spec.pricing_mode &&
      set.has_pallet === spec.has_pallet &&
      sameBag(specTokens(set), wanted),
  );
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) {
    throw new Error(
      `Nhiều bộ active cùng khung ${describeSet(spec)}: ${exact.map(describeSet).join(', ')}`,
    );
  }

  const containers = active.filter(
    (set) =>
      set.pricing_mode === spec.pricing_mode &&
      isTokenSubset(wanted, specTokens(set)) &&
      specTokens(set).length > wanted.length,
  );
  if (containers.length === 0) return null;
  containers.sort((a, b) => specTokens(a).length - specTokens(b).length);
  if (
    containers.length > 1 &&
    specTokens(containers[0]).length === specTokens(containers[1]).length
  ) {
    throw new Error(
      `Không chọn được bộ cho ${describeSet(spec)}: ${containers.map(describeSet).join(', ')} cùng độ rộng`,
    );
  }
  return containers[0];
}

async function insertSpec(client: PoolClient, spec: PriceSetSpec, userId: number): Promise<BoundPriceSet> {
  const fingerprint = priceSetFingerprint(spec);
  const inserted = await client.query<Record<string, unknown>>(
    `INSERT INTO price_sets (name, pricing_mode, has_pallet, fingerprint, status, created_by, updated_by)
     VALUES ($1,$2,$3,$4,'active',$5,$5)
     RETURNING id, name, pricing_mode, has_pallet, fingerprint`,
    [spec.name, spec.pricing_mode, spec.has_pallet, fingerprint, userId],
  );
  const setId = num(inserted.rows[0].id);
  const tiers: BoundPriceSet['tiers'] = [];
  for (let sort = 0; sort < spec.tiers.length; sort++) {
    const tier = spec.tiers[sort];
    const isTruck = spec.pricing_mode === 'by_truck';
    const label = isTruck ? (tier.label ?? '').trim() : null;
    const row = await client.query<{ id: number }>(
      `INSERT INTO price_set_tiers
         (price_set_id, sort_order, range_from, range_to, pricing_unit, min_billable_ton, label)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id`,
      [
        setId,
        sort,
        isTruck ? 0 : tier.range_from,
        isTruck ? null : tier.range_to,
        tier.pricing_unit,
        !isTruck &&
        spec.pricing_mode === 'by_weight' &&
        tier.pricing_unit === 'tan' &&
        tier.min_billable_ton != null &&
        tier.min_billable_ton > 0
          ? tier.min_billable_ton
          : null,
        label || null,
      ],
    );
    tiers.push({
      id: row.rows[0].id,
      sort_order: sort,
      range_from: isTruck ? 0 : tier.range_from,
      range_to: isTruck ? null : tier.range_to,
      pricing_unit: tier.pricing_unit,
      min_billable_ton:
        spec.pricing_mode === 'by_weight' && tier.pricing_unit === 'tan' && (tier.min_billable_ton ?? 0) > 0
          ? tier.min_billable_ton ?? null
          : null,
      label: label || null,
    });
  }
  return mapBound(inserted.rows[0], tiers);
}

export async function ensureCanonicalPriceSets(
  client: PoolClient,
  specs: PriceSetSpec[],
  userId: number,
): Promise<PriceSetCatalog> {
  const unique = uniquePriceSetSpecs(specs);
  const active = await loadActiveSets(client);
  const byFingerprint = new Map<string, BoundPriceSet>();

  for (const spec of unique) {
    const key = priceSetFingerprint(spec);
    const existing = pickBindTarget(spec, active);
    if (existing) {
      if (existing.name !== spec.name || priceSetFingerprint(existing) !== key) {
        console.log(`Price set: dùng bộ đã có ${describeSet(existing)} cho spec "${spec.name}"`);
      } else {
        console.log(`Price set: ${describeSet(existing)}`);
      }
      byFingerprint.set(key, existing);
      continue;
    }
    assertNoCreateConflict(spec, active);
    try {
      const created = await insertSpec(client, spec, userId);
      active.push(created);
      byFingerprint.set(key, created);
      console.log(`Price set: created ${describeSet(created)}`);
    } catch (error) {
      const pg = error as { code?: string; constraint?: string };
      if (pg.code === '23505') {
        throw new Error(
          `Không tạo bộ "${spec.name}": tên hoặc fingerprint đã có bộ active khác. ${pg.constraint ?? ''}`.trim(),
        );
      }
      throw error;
    }
  }

  return {
    get(spec: PriceSetSpec): BoundPriceSet {
      const set = byFingerprint.get(priceSetFingerprint(spec));
      if (!set) {
        throw new Error(`Chưa resolve bộ "${spec.name}". Gọi ensureCanonicalPriceSets trước.`);
      }
      return set;
    },
  };
}

function matchSetTier(set: BoundPriceSet, tier: SeedPricedTier): BoundPriceSet['tiers'][number] {
  const token = pricedToken(tier);
  const match = set.tiers.find((item) => priceSetTierToken(item) === token);
  if (!match) {
    throw new Error(
      `Bậc ${token} không thuộc bộ ${describeSet(set)}. Không tạo bộ tập con cho dòng này.`,
    );
  }
  return match;
}

function palletValue(set: BoundPriceSet, pallet: number, context: string): number | null {
  if (pallet > 0 && !set.has_pallet) {
    throw new Error(`${context}: bộ ${describeSet(set)} không có slot pallet`);
  }
  return pallet > 0 ? pallet : null;
}

async function insertPricedTiers(
  client: PoolClient,
  versionId: number,
  set: BoundPriceSet,
  tiers: SeedPricedTier[],
  context: string,
): Promise<void> {
  const priced = tiers.filter((tier) => tier.price > 0);
  if (!priced.length) {
    throw new Error(`${context}: không có bậc giá > 0`);
  }
  for (const tier of priced) {
    const setTier = matchSetTier(set, tier);
    const isTruck = set.pricing_mode === 'by_truck';
    await client.query(
      `INSERT INTO route_price_tiers
         (price_version_id, price_set_tier_id, range_from, range_to, pricing_unit, price,
          min_billable_ton, sort_order, label)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        versionId,
        setTier.id,
        isTruck ? 0 : setTier.range_from,
        isTruck ? null : setTier.range_to,
        set.pricing_mode === 'by_trips' ? 'chuyen' : setTier.pricing_unit,
        tier.price,
        set.pricing_mode === 'by_weight' &&
        setTier.pricing_unit === 'tan' &&
        (setTier.min_billable_ton ?? 0) > 0
          ? setTier.min_billable_ton
          : null,
        setTier.sort_order,
        isTruck ? setTier.label : null,
      ],
    );
  }
}

export async function writeSeedAbsolutePrice(
  client: PoolClient,
  opts: {
    groupId: number;
    periodId: number;
    userId: number;
    set: BoundPriceSet;
    tiers: SeedPricedTier[];
    pallet: number;
    context?: string;
  },
): Promise<'created' | 'updated' | 'exists'> {
  const context = opts.context ?? `group ${opts.groupId}`;
  const pallet = palletValue(opts.set, opts.pallet, context);
  const priced = opts.tiers.filter((tier) => tier.price > 0);
  if (!priced.length && pallet == null) {
    throw new Error(`${context}: cần ít nhất một bậc > 0 hoặc pallet > 0`);
  }

  const configRes = await client.query<{ id: number; price_set_id: number | null }>(
    `SELECT id, price_set_id FROM route_price_configs
     WHERE route_group_id = $1 AND status = 'active' LIMIT 1`,
    [opts.groupId],
  );

  const assertSameSet = (boundId: number | null) => {
    if (boundId != null && boundId !== opts.set.id) {
      throw new Error(
        `${context}: nhóm đã gắn bộ id=${boundId}, không đổi sang ${describeSet(opts.set)}. Xóa giá nhóm trước.`,
      );
    }
  };

  if (!configRes.rows[0]) {
    const created = await client.query<{ id: number }>(
      `INSERT INTO route_price_configs (route_group_id, price_set_id, created_by)
       VALUES ($1,$2,$3) RETURNING id`,
      [opts.groupId, opts.set.id, opts.userId],
    );
    const versionRes = await client.query<{ id: number }>(
      `INSERT INTO route_price_versions
         (price_config_id, pricing_mode, pallet_trip_price, adjustment_period_id, created_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [created.rows[0].id, opts.set.pricing_mode, pallet, opts.periodId, opts.userId],
    );
    if (priced.length) await insertPricedTiers(client, versionRes.rows[0].id, opts.set, priced, context);
    return 'created';
  }

  const configId = configRes.rows[0].id;
  assertSameSet(configRes.rows[0].price_set_id);

  const versionRes = await client.query<{ id: number; pallet_trip_price: string | null }>(
    `SELECT id, pallet_trip_price FROM route_price_versions
     WHERE price_config_id = $1 AND adjustment_period_id = $2
     ORDER BY CASE WHEN base_version_id IS NULL THEN 0 ELSE 1 END, id
     LIMIT 1`,
    [configId, opts.periodId],
  );

  if (!versionRes.rows[0]) {
    if (configRes.rows[0].price_set_id == null) {
      await client.query(`UPDATE route_price_configs SET price_set_id = $1 WHERE id = $2`, [
        opts.set.id,
        configId,
      ]);
    }
    const created = await client.query<{ id: number }>(
      `INSERT INTO route_price_versions
         (price_config_id, pricing_mode, pallet_trip_price, adjustment_period_id, created_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [configId, opts.set.pricing_mode, pallet, opts.periodId, opts.userId],
    );
    if (priced.length) await insertPricedTiers(client, created.rows[0].id, opts.set, priced, context);
    return 'created';
  }

  if (pallet != null && Number(versionRes.rows[0].pallet_trip_price) !== pallet) {
    await client.query(`UPDATE route_price_versions SET pallet_trip_price = $1 WHERE id = $2`, [
      pallet,
      versionRes.rows[0].id,
    ]);
    return 'updated';
  }
  return 'exists';
}

const fingerprintProbe = priceSetFingerprint({
  pricing_mode: 'by_weight',
  has_pallet: true,
  tiers: [
    { range_from: 0, range_to: 2.5, pricing_unit: 'chuyen' },
    { range_from: 2.5, range_to: 8, pricing_unit: 'tan', min_billable_ton: 5 },
  ],
});
if (fingerprintProbe !== 'by_weight|pallet:1|w:0-2.5:chuyen|w:2.5-8:tan:min5') {
  throw new Error(`priceSetFingerprint drift: ${fingerprintProbe}`);
}
