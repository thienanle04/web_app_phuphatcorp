import { noteKey, normalizeLocation, roundToThousands } from '../types/routePricing';
import { routePricingService, tierSchemaKey, weightTierColumnKey, isTierKeySubset, mergeCompatibleWeightBuckets, tierColumnKeys, truckSchemaKey, truckTierColumnKey, buildUnionTruckColumns, truckClassMt } from '../services/routePricingService';
import { priceSetService } from '../services/priceSetService';
import { pool } from './__mocks__/database';

const mockPool = pool as jest.Mocked<typeof pool>;

const mockClient = {
  query: jest.fn(),
  release: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPool.connect.mockResolvedValue(mockClient as never);
});

describe('Price matrix schema helpers', () => {
  const schemaA = [
    { range_from: 0, range_to: 2.5, pricing_unit: 'chuyen' as const, price: 1 },
    { range_from: 2.5, range_to: 8, pricing_unit: 'tan' as const, price: 1, min_billable_ton: 5 },
    { range_from: 8, range_to: null, pricing_unit: 'tan' as const, price: 1 },
  ];
  const schemaB = [
    { range_from: 0, range_to: 3, pricing_unit: 'chuyen' as const, price: 1 },
    { range_from: 3, range_to: 7, pricing_unit: 'tan' as const, price: 1 },
    { range_from: 7, range_to: 10, pricing_unit: 'tan' as const, price: 1 },
    { range_from: 10, range_to: null, pricing_unit: 'tan' as const, price: 1 },
  ];

  it('weightTierColumnKey is stable and includes min billable', () => {
    expect(weightTierColumnKey(schemaA[1])).toBe('w:2.5-8:tan:min5');
    expect(weightTierColumnKey(schemaA[2])).toBe('w:8-inf:tan');
  });

  it('tierSchemaKey groups identical schemas and separates different ones', () => {
    const shuffled = [schemaA[2], schemaA[0], schemaA[1]];
    expect(tierSchemaKey(shuffled)).toBe(tierSchemaKey(schemaA));
    expect(tierSchemaKey(schemaA)).not.toBe(tierSchemaKey(schemaB));
  });

  it('pallet is not part of schema key', () => {
    expect(tierSchemaKey(schemaA).includes('pallet')).toBe(false);
  });

  it('subset schemas merge; unrelated schemas stay separate', () => {
    const full251623 = [
      { range_from: 0, range_to: 2.5, pricing_unit: 'chuyen' as const, price: 1 },
      { range_from: 8, range_to: 16, pricing_unit: 'tan' as const, price: 1 },
      { range_from: 16, range_to: 23, pricing_unit: 'tan' as const, price: 1 },
      { range_from: 23, range_to: null, pricing_unit: 'tan' as const, price: 1 },
    ];
    const withoutLow = [
      { range_from: 8, range_to: 16, pricing_unit: 'tan' as const, price: 1 },
      { range_from: 16, range_to: 23, pricing_unit: 'tan' as const, price: 1 },
      { range_from: 23, range_to: null, pricing_unit: 'tan' as const, price: 1 },
    ];
    const fullKeys = tierColumnKeys(full251623);
    const withoutKeys = tierColumnKeys(withoutLow);
    expect(isTierKeySubset(withoutKeys, fullKeys)).toBe(true);
    expect(isTierKeySubset(fullKeys, withoutKeys)).toBe(false);
    expect(isTierKeySubset(tierColumnKeys(schemaA), tierColumnKeys(schemaB))).toBe(false);

    const clusters = mergeCompatibleWeightBuckets([
      { columnKeys: withoutKeys, groups: [1] },
      { columnKeys: fullKeys, groups: [2] },
      { columnKeys: tierColumnKeys(schemaB), groups: [3] },
    ]);
    expect(clusters).toHaveLength(2);
    const merged = clusters.find((c) => c.length === 2);
    const alone = clusters.find((c) => c.length === 1);
    expect(merged?.flatMap((b) => b.groups).sort()).toEqual([1, 2]);
    expect(alone?.[0].groups).toEqual([3]);
  });
});

describe('roundToThousands', () => {
  it('rounds to nearest thousand', () => {
    expect(roundToThousands(108400)).toBe(108000);
    expect(roundToThousands(108500)).toBe(109000);
    expect(roundToThousands(1000)).toBe(1000);
  });
});

describe('tier interval (from, to]', () => {
  function match(
    tiers: { range_from: number; range_to: number | null }[],
    weight: number,
  ) {
    return tiers.find(
      (t) => weight > t.range_from && (t.range_to == null || weight <= t.range_to),
    );
  }

  const tiers = [
    { range_from: 0, range_to: 2.5 },
    { range_from: 2.5, range_to: 8 },
    { range_from: 8, range_to: null },
  ];

  it('includes upper bound', () => {
    expect(match(tiers, 2.5)?.range_from).toBe(0);
    expect(match(tiers, 2.5001)?.range_from).toBe(2.5);
  });

  it('matches open upper', () => {
    expect(match(tiers, 100)?.range_from).toBe(8);
  });
});

describe('CR: pricing modes', () => {
  it('noteKey trims and empty → ""', () => {
    expect(noteKey('  Đường nhỏ  ')).toBe('Đường nhỏ');
    expect(noteKey('')).toBe('');
    expect(noteKey(null)).toBe('');
    expect(normalizeLocation('  KCN Hiệp Phước ')).toBe('KCN Hiệp Phước');
  });

  it('frame overlap is validated on the price set, not when saving a group price', async () => {
    await expect(
      priceSetService.create(
        {
          name: 'Overlap group',
          pricing_mode: 'by_weight',
          has_pallet: false,
          tiers: [
            { range_from: 0, range_to: 5, pricing_unit: 'chuyen' },
            { range_from: 4, range_to: null, pricing_unit: 'tan' },
          ],
        },
        1,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_TIERS' });
  });

  it('trips chain gaps are not rejected as INVALID_TIERS at price-set create', async () => {
    await expect(
      priceSetService.create(
        {
          name: 'Gap',
          pricing_mode: 'by_trips',
          has_pallet: false,
          tiers: [
            { range_from: 1, range_to: 2, pricing_unit: 'chuyen' },
            { range_from: 4, range_to: null, pricing_unit: 'chuyen' },
          ],
        },
        1,
      ),
    ).rejects.not.toMatchObject({ code: 'INVALID_TIERS' });
  });
});

describe('CR: by_truck', () => {
  const truckMix = [
    { range_from: 0, range_to: null, label: 'Truck 0,5mt', pricing_unit: 'chuyen' as const, price: 1_500_000 },
    { range_from: 0, range_to: null, label: '8 < Truck ≤16', pricing_unit: 'tan' as const, price: 200_000 },
  ];

  it('truckTierColumnKey / truckSchemaKey keep form order and do not merge subset', () => {
    expect(truckTierColumnKey(truckMix[0])).toBe('t:Truck 0,5mt:chuyen');
    expect(truckSchemaKey(truckMix)).toBe('t:Truck 0,5mt:chuyen|t:8 < Truck ≤16:tan');
    expect(truckSchemaKey([...truckMix].reverse())).not.toBe(truckSchemaKey(truckMix));
    expect(truckSchemaKey(truckMix)).not.toBe(
      truckSchemaKey([{ ...truckMix[0], label: 'Truck 0.5mt' }, truckMix[1]]),
    );
  });

  it('buildUnionTruckColumns unions first-seen keys and keeps Pallet last', () => {
    const schemaA = [
      { range_from: 0, range_to: null, label: 'Truck 0,5mt', pricing_unit: 'chuyen' as const, price: 1, sort_order: 0 },
      { range_from: 0, range_to: null, label: 'Truck 15mt', pricing_unit: 'tan' as const, price: 2, sort_order: 1 },
    ];
    const schemaB = [
      { range_from: 0, range_to: null, label: 'Truck 15mt', pricing_unit: 'tan' as const, price: 3, sort_order: 0 },
      { range_from: 0, range_to: null, label: '8 < Truck ≤16', pricing_unit: 'tan' as const, price: 4, sort_order: 1 },
    ];
    const cols = buildUnionTruckColumns([schemaA, schemaB]);
    expect(cols.map((c) => c.key)).toEqual([
      't:Truck 0,5mt:chuyen',
      't:Truck 15mt:tan',
      't:8 < Truck ≤16:tan',
      'pallet',
    ]);
    expect(cols.filter((c) => c.kind === 'truck')).toHaveLength(3);
  });

  it('buildUnionTruckColumns orders class tải 0,5 → 15 even if first group lacks 0,5mt', () => {
    expect(truckClassMt('Truck 0,5mt')).toBe(0.5);
    expect(truckClassMt('Truck 1,25mt')).toBe(1.25);
    expect(truckClassMt('8 < Truck ≤16')).toBeNull();
    const firstSeen = [
      { range_from: 0, range_to: null, label: 'Truck 1,25mt', pricing_unit: 'chuyen' as const, price: 1, sort_order: 0 },
      { range_from: 0, range_to: null, label: 'Truck 2,5mt', pricing_unit: 'chuyen' as const, price: 2, sort_order: 1 },
    ];
    const laterHas05 = [
      { range_from: 0, range_to: null, label: 'Truck 0,5mt', pricing_unit: 'chuyen' as const, price: 3, sort_order: 0 },
      { range_from: 0, range_to: null, label: 'Truck 1,25mt', pricing_unit: 'chuyen' as const, price: 4, sort_order: 1 },
      { range_from: 0, range_to: null, label: 'Truck 1,5mt', pricing_unit: 'chuyen' as const, price: 5, sort_order: 2 },
      { range_from: 0, range_to: null, label: 'Truck 15mt', pricing_unit: 'tan' as const, price: 6, sort_order: 3 },
    ];
    const cols = buildUnionTruckColumns([firstSeen, laterHas05]);
    expect(cols.filter((c) => c.kind === 'truck').map((c) => c.label)).toEqual([
      'Truck 0,5mt',
      'Truck 1,25mt',
      'Truck 1,5mt',
      'Truck 2,5mt',
      'Truck 15mt',
    ]);
  });

  it('rejects blank and duplicate truck labels on the set, not on price save', async () => {
    await expect(
      priceSetService.create(
        {
          name: 'Blank',
          pricing_mode: 'by_truck',
          has_pallet: false,
          tiers: [{ label: '   ', pricing_unit: 'chuyen' }],
        },
        1,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_TIERS' });
    await expect(
      priceSetService.create(
        {
          name: 'Dup',
          pricing_mode: 'by_truck',
          has_pallet: false,
          tiers: [
            { label: 'Truck 0,5mt', pricing_unit: 'chuyen' },
            { label: '  Truck 0,5mt  ', pricing_unit: 'tan' },
          ],
        },
        1,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_TIERS' });
  });
});

describe('Manual adjust cascade math', () => {
  it('scales with roundToThousands like service cascade', () => {
    const next = roundToThousands(2_000_000 * (1 + 5 / 100));
    expect(next).toBe(2_100_000);
    expect(roundToThousands(1_084_500)).toBe(1_085_000);
  });
});

describe('Regression: price version race guards (2026-07-12)', () => {
  function mockActiveWeightSet() {
    mockPool.query
      .mockResolvedValueOnce({
        rows: [{
          id: 1,
          name: 'Set',
          pricing_mode: 'by_weight',
          has_pallet: true,
          status: 'active',
          created_at: 'x',
          updated_at: 'x',
        }],
      } as never)
      .mockResolvedValueOnce({
        rows: [
          {
            id: 11,
            price_set_id: 1,
            sort_order: 0,
            range_from: 0,
            range_to: 2.5,
            pricing_unit: 'chuyen',
            min_billable_ton: null,
            label: null,
          },
          {
            id: 12,
            price_set_id: 1,
            sort_order: 1,
            range_from: 2.5,
            range_to: null,
            pricing_unit: 'tan',
            min_billable_ton: 5,
            label: null,
          },
        ],
      } as never)
      .mockResolvedValueOnce({ rows: [{ n: 0 }] } as never);
  }

  const pricedTiers = [
    { price_set_tier_id: 11, price: 1_500_000, range_from: 0, range_to: 2.5, pricing_unit: 'chuyen' as const },
    { price_set_tier_id: 12, price: 90_000, range_from: 2.5, range_to: null, pricing_unit: 'tan' as const },
  ];

  it('createAbsolutePrice throws ABSOLUTE_UPDATE_FORBIDDEN when version already exists (in-TX check)', async () => {
    mockActiveWeightSet();
    mockClient.query
      .mockResolvedValueOnce({ rows: [] } as never) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 1, start_date: '2026-07-12' }] } as never) // period
      .mockResolvedValueOnce({ rows: [] } as never) // later periods
      .mockResolvedValueOnce({ rows: [{ id: 10 }] } as never) // group FOR UPDATE
      .mockResolvedValueOnce({ rows: [{ id: 20 }] } as never) // config FOR UPDATE
      .mockResolvedValueOnce({ rows: [{ id: 1 }] } as never) // existing version
      .mockResolvedValueOnce({ rows: [] } as never); // ROLLBACK

    await expect(
      routePricingService.createAbsolutePrice(
        {
          route_group_id: 10,
          adjustment_period_id: 1,
          price_set_id: 1,
          pallet_trip_price: 800000,
          tiers: pricedTiers,
        },
        1,
      ),
    ).rejects.toMatchObject({ code: 'ABSOLUTE_UPDATE_FORBIDDEN' });

    const sqlCalls = mockClient.query.mock.calls.map((c) => String(c[0]));
    expect(sqlCalls.some((s) => s.includes('FOR UPDATE'))).toBe(true);
  });

  it('createAbsolutePrice maps unique violation to ABSOLUTE_UPDATE_FORBIDDEN', async () => {
    mockActiveWeightSet();
    const uniqueErr = Object.assign(new Error('duplicate key'), {
      code: '23505',
      constraint: 'idx_rpv_config_period',
    });

    mockClient.query
      .mockResolvedValueOnce({ rows: [] } as never) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 1, start_date: '2026-07-12' }] } as never) // period
      .mockResolvedValueOnce({ rows: [] } as never) // later periods
      .mockResolvedValueOnce({ rows: [{ id: 10 }] } as never) // group
      .mockResolvedValueOnce({ rows: [{ id: 20 }] } as never) // config
      .mockResolvedValueOnce({ rows: [] } as never) // no existing version
      .mockRejectedValueOnce(uniqueErr) // INSERT version
      .mockResolvedValueOnce({ rows: [] } as never); // ROLLBACK

    await expect(
      routePricingService.createAbsolutePrice(
        {
          route_group_id: 10,
          adjustment_period_id: 1,
          price_set_id: 1,
          pallet_trip_price: 800000,
          tiers: pricedTiers,
        },
        1,
      ),
    ).rejects.toMatchObject({ code: 'ABSOLUTE_UPDATE_FORBIDDEN' });
  });

  it('createAdjustmentPeriod rejects start not after latest', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] } as never) // BEGIN
      .mockResolvedValueOnce({
        rows: [{ id: 1, start_date: '2026-07-01', end_date: null }],
      } as never) // open period
      .mockResolvedValueOnce({ rows: [] } as never); // ROLLBACK

    await expect(
      routePricingService.createAdjustmentPeriod(
        { start_date: '2026-06-01', percent: 8 },
        1,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_PERIOD' });
  });

  it('deleteAdjustmentPeriod rejects non-latest period', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] } as never) // BEGIN
      .mockResolvedValueOnce({
        rows: [{ id: 2, start_date: '2026-08-01' }],
      } as never) // latest
      .mockResolvedValueOnce({ rows: [] } as never); // ROLLBACK

    await expect(
      routePricingService.deleteAdjustmentPeriod(1),
    ).rejects.toMatchObject({ code: 'PERIOD_NOT_LATEST' });
  });

  it('deleteAdjustmentPeriod rollbacks versions of latest period', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] } as never) // BEGIN
      .mockResolvedValueOnce({
        rows: [{ id: 3, start_date: '2026-03-01' }],
      } as never) // latest
      .mockResolvedValueOnce({ rows: [{ id: 30 }, { id: 31 }] } as never) // linked versions
      .mockResolvedValueOnce({ rows: [], rowCount: 2 } as never) // null base_version_id
      .mockResolvedValueOnce({ rows: [], rowCount: 2 } as never) // delete tiers
      .mockResolvedValueOnce({ rows: [], rowCount: 2 } as never) // delete versions
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as never) // delete period
      .mockResolvedValueOnce({ rows: [{ id: 2 }] } as never) // prev period
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as never) // reopen prev
      .mockResolvedValueOnce({ rows: [] } as never); // COMMIT

    await expect(routePricingService.deleteAdjustmentPeriod(3)).resolves.toEqual({
      deleted_versions: 2,
    });
  });
});

describe('price books', () => {
  it('createPriceBook rejects blank name', async () => {
    await expect(routePricingService.createPriceBook('   ', 1)).rejects.toMatchObject({
      code: 'INVALID_PRICE_BOOK_NAME',
    });
  });

  it('createPriceBook maps unique violation', async () => {
    mockPool.query.mockRejectedValueOnce({ code: '23505' } as never);
    await expect(routePricingService.createPriceBook('CLF', 1)).rejects.toMatchObject({
      code: 'DUPLICATE_PRICE_BOOK',
    });
  });

  it('deletePriceBook throws when missing', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] } as never);
    await expect(routePricingService.deletePriceBook(9, 1)).rejects.toMatchObject({
      code: 'PRICE_BOOK_NOT_FOUND',
    });
  });

  it('manualAdjustVersion rejects an added tier that is already on the period', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] } as never) // BEGIN
      .mockResolvedValueOnce({
        rows: [{
          id: 7,
          price_config_id: 3,
          pricing_mode: 'by_weight',
          pallet_trip_price: null,
          pallet_manual_adjusted: false,
          period_start_date: '2026-08-01',
          adjustment_period_id: 2,
        }],
      } as never)
      .mockResolvedValueOnce({
        rows: [{
          id: 50,
          price_set_tier_id: 12,
          range_from: 2.5,
          range_to: null,
          pricing_unit: 'tan',
          price: 90_000,
          min_billable_ton: 5,
          sort_order: 1,
          label: null,
          is_manual_adjusted: false,
        }],
      } as never)
      .mockResolvedValueOnce({ rows: [{ price_set_id: 1 }] } as never)
      .mockResolvedValueOnce({
        rows: [{
          id: 1, name: 'Set', pricing_mode: 'by_weight', has_pallet: false,
          status: 'active', created_at: 'x', updated_at: 'x',
        }],
      } as never)
      .mockResolvedValueOnce({
        rows: [{
          id: 12, price_set_id: 1, sort_order: 1, range_from: 2.5, range_to: null,
          pricing_unit: 'tan', min_billable_ton: 5, label: null,
        }],
      } as never)
      .mockResolvedValueOnce({ rows: [{ n: 1 }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never); // ROLLBACK

    await expect(
      routePricingService.manualAdjustVersion(
        7,
        {
          pallet_trip_price: null,
          tiers: [{ id: 50, price: 90_000 }],
          added_tiers: [{ price_set_tier_id: 12, price: 100_000 }],
        },
        1,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_TIERS' });
  });

  it('manualAdjustVersion inserts an unused tier and scales later periods', async () => {
    const versionRow = {
      id: 7,
      price_config_id: 3,
      pricing_mode: 'by_weight',
      pallet_trip_price: null,
      pallet_manual_adjusted: false,
      base_version_id: 1,
      period_percent: 0,
      period_start_date: '2026-08-01',
      period_end_date: '2026-09-01',
      adjustment_period_id: 2,
      created_at: 'x',
    };
    mockClient.query
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [versionRow] } as never)
      .mockResolvedValueOnce({
        rows: [{
          id: 50,
          price_set_tier_id: 11,
          range_from: 0,
          range_to: 2.5,
          pricing_unit: 'chuyen',
          price: 1_500_000,
          min_billable_ton: null,
          sort_order: 0,
          label: null,
          is_manual_adjusted: false,
        }],
      } as never)
      .mockResolvedValueOnce({ rows: [{ price_set_id: 1 }] } as never)
      .mockResolvedValueOnce({
        rows: [{
          id: 1, name: 'Set', pricing_mode: 'by_weight', has_pallet: false,
          status: 'active', created_at: 'x', updated_at: 'x',
        }],
      } as never)
      .mockResolvedValueOnce({
        rows: [
          {
            id: 11, price_set_id: 1, sort_order: 0, range_from: 0, range_to: 2.5,
            pricing_unit: 'chuyen', min_billable_ton: null, label: null,
          },
          {
            id: 12, price_set_id: 1, sort_order: 1, range_from: 2.5, range_to: null,
            pricing_unit: 'tan', min_billable_ton: 5, label: null,
          },
        ],
      } as never)
      .mockResolvedValueOnce({ rows: [{ n: 1 }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never) // pallet update
      .mockResolvedValueOnce({ rows: [] } as never) // existing tier update
      .mockResolvedValueOnce({ rows: [] } as never) // insert current
      .mockResolvedValueOnce({ rows: [{ id: 9, percent: 10, start_date: '2026-09-01' }] } as never)
      .mockResolvedValueOnce({ rows: [{ id: 8, pallet_trip_price: null }] } as never)
      .mockResolvedValueOnce({
        rows: [{
          id: 60,
          price_set_tier_id: 11,
          range_from: 0,
          range_to: 2.5,
          pricing_unit: 'chuyen',
          price: 1_500_000,
          min_billable_ton: null,
          sort_order: 0,
          label: null,
          is_manual_adjusted: false,
        }],
      } as never)
      .mockResolvedValueOnce({ rows: [] } as never) // insert later
      .mockResolvedValueOnce({ rows: [] } as never); // COMMIT
    mockPool.query
      .mockResolvedValueOnce({ rows: [versionRow] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);

    await routePricingService.manualAdjustVersion(
      7,
      {
        pallet_trip_price: null,
        tiers: [{ id: 50, price: 1_500_000 }],
        added_tiers: [{ price_set_tier_id: 12, price: 90_000 }],
      },
      1,
    );

    const inserts = mockClient.query.mock.calls.filter((call) =>
      String(call[0]).includes('INSERT INTO route_price_tiers'),
    );
    expect(inserts).toHaveLength(2);
    expect(inserts[0][1]).toEqual(expect.arrayContaining([12, 90_000, true]));
    expect(inserts[1][1]).toEqual(expect.arrayContaining([12, roundToThousands(90_000 * 1.1), false]));
  });

  it('manualAdjustVersion rejects pallet when the price set has no pallet slot', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({
        rows: [{
          id: 7,
          price_config_id: 3,
          pricing_mode: 'by_weight',
          pallet_trip_price: null,
          period_start_date: '2026-08-01',
        }],
      } as never)
      .mockResolvedValueOnce({
        rows: [{
          id: 50, price_set_tier_id: 11, range_from: 0, range_to: 2.5,
          pricing_unit: 'chuyen', price: 1_500_000, min_billable_ton: null,
          sort_order: 0, label: null, is_manual_adjusted: false,
        }],
      } as never)
      .mockResolvedValueOnce({ rows: [{ price_set_id: 1 }] } as never)
      .mockResolvedValueOnce({
        rows: [{
          id: 1, name: 'Set', pricing_mode: 'by_weight', has_pallet: false,
          status: 'active', created_at: 'x', updated_at: 'x',
        }],
      } as never)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [{ n: 1 }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);

    await expect(
      routePricingService.manualAdjustVersion(
        7,
        { pallet_trip_price: 800_000, tiers: [{ id: 50, price: 1_500_000 }] },
        1,
      ),
    ).rejects.toMatchObject({ code: 'PALLET_NOT_IN_SET' });
  });

  it('manualAdjustVersion adds pallet and scales later periods', async () => {
    const versionRow = {
      id: 7,
      price_config_id: 3,
      pricing_mode: 'by_weight',
      pallet_trip_price: null,
      pallet_manual_adjusted: false,
      base_version_id: 1,
      period_percent: 0,
      period_start_date: '2026-08-01',
      period_end_date: '2026-09-01',
      adjustment_period_id: 2,
      created_at: 'x',
    };
    mockClient.query
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [versionRow] } as never)
      .mockResolvedValueOnce({
        rows: [{
          id: 50, price_set_tier_id: 11, range_from: 0, range_to: 2.5,
          pricing_unit: 'chuyen', price: 1_500_000, min_billable_ton: null,
          sort_order: 0, label: null, is_manual_adjusted: false,
        }],
      } as never)
      .mockResolvedValueOnce({ rows: [{ price_set_id: 1 }] } as never)
      .mockResolvedValueOnce({
        rows: [{
          id: 1, name: 'Set', pricing_mode: 'by_weight', has_pallet: true,
          status: 'active', created_at: 'x', updated_at: 'x',
        }],
      } as never)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [{ n: 1 }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never) // current pallet update
      .mockResolvedValueOnce({ rows: [] } as never) // existing tier update
      .mockResolvedValueOnce({ rows: [{ id: 9, percent: 10, start_date: '2026-09-01' }] } as never)
      .mockResolvedValueOnce({ rows: [{ id: 8, pallet_trip_price: null }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never) // later tiers
      .mockResolvedValueOnce({ rows: [] } as never) // later pallet update
      .mockResolvedValueOnce({ rows: [] } as never); // COMMIT
    mockPool.query
      .mockResolvedValueOnce({ rows: [versionRow] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);

    await routePricingService.manualAdjustVersion(
      7,
      { pallet_trip_price: 800_000, tiers: [{ id: 50, price: 1_500_000 }] },
      1,
    );

    const laterPallet = mockClient.query.mock.calls.find((call) =>
      String(call[0]).includes('SET pallet_trip_price=$1, pallet_manual_adjusted=FALSE'),
    );
    expect(laterPallet?.[1]?.[0]).toBe(roundToThousands(800_000 * 1.1));
  });

  it('lookup is deferred', async () => {
    await expect(routePricingService.lookup({ supplier_id: 1 })).rejects.toMatchObject({
      code: 'LOOKUP_DEFERRED',
    });
  });
});
