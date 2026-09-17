import { priceSetService, priceSetFingerprint, priceSetsConflict, materializePricedTiers, normalizePallet } from '../services/priceSetService';
import type { PriceSet, PriceSetTier } from '../types/routePricing';

function tier(partial: Partial<PriceSetTier> & Pick<PriceSetTier, 'id' | 'sort_order'>): PriceSetTier {
  return {
    price_set_id: 1,
    range_from: 0,
    range_to: null,
    pricing_unit: 'tan',
    min_billable_ton: null,
    label: null,
    ...partial,
  };
}

function setOf(tiers: PriceSetTier[], has_pallet = false): PriceSet {
  return {
    id: 1,
    name: 'Set',
    pricing_mode: 'by_weight',
    has_pallet,
    status: 'active',
    tiers,
    group_count: 0,
    created_at: '',
    updated_at: '',
  };
}

describe('price set catalog rules', () => {
  const standard = [
    tier({ id: 1, sort_order: 0, range_from: 0, range_to: 2.5, pricing_unit: 'chuyen' }),
    tier({ id: 2, sort_order: 1, range_from: 2.5, range_to: 8, min_billable_ton: 5 }),
    tier({ id: 3, sort_order: 2, range_from: 8, range_to: null }),
  ];

  it('blocks a set whose tiers are a subset of another active set', () => {
    const subset = [standard[1], standard[2]];
    expect(priceSetsConflict({ has_pallet: true, tiers: subset }, { has_pallet: true, tiers: standard })).toBe(true);
    expect(priceSetsConflict({ has_pallet: true, tiers: standard }, { has_pallet: true, tiers: subset })).toBe(true);
  });

  it('treats a pallet-less copy of the same tiers as a subset of the pallet set', () => {
    expect(priceSetsConflict({ has_pallet: false, tiers: standard }, { has_pallet: true, tiers: standard })).toBe(true);
    const other = [
      tier({ id: 9, sort_order: 0, range_from: 3, range_to: 7, pricing_unit: 'tan' }),
    ];
    expect(priceSetsConflict({ has_pallet: false, tiers: other }, { has_pallet: true, tiers: standard })).toBe(false);
  });

  it('fingerprint matches the stored catalog style', () => {
    expect(
      priceSetFingerprint({
        pricing_mode: 'by_weight',
        has_pallet: true,
        tiers: [standard[0], standard[1]],
      }),
    ).toBe('by_weight|pallet:1|w:0-2.5:chuyen|w:2.5-8:tan:min5');
  });

  it('rejects a non-positive tier price and an unknown tier id', () => {
    const set = setOf(standard);
    expect(() => materializePricedTiers(set, [{ price_set_tier_id: 1, price: 0 }])).toThrow(
      expect.objectContaining({ code: 'PRICE_NOT_POSITIVE' }),
    );
    expect(() => materializePricedTiers(set, [{ price_set_tier_id: 99, price: 10 }])).toThrow(
      expect.objectContaining({ code: 'TIER_NOT_IN_SET' }),
    );
  });

  it('omits blank tiers and copies range from the set', () => {
    const priced = materializePricedTiers(setOf(standard), [{ price_set_tier_id: 2, price: 90_000 }]);
    expect(priced).toHaveLength(1);
    expect(priced[0].range_from).toBe(2.5);
    expect(priced[0].min_billable_ton).toBe(5);
  });

  it('rejects pallet on a set that has no pallet slot, and rejects 0', () => {
    expect(() => normalizePallet(setOf(standard, false), 100)).toThrow(
      expect.objectContaining({ code: 'PALLET_NOT_IN_SET' }),
    );
    expect(() => normalizePallet(setOf(standard, true), 0)).toThrow(
      expect.objectContaining({ code: 'PRICE_NOT_POSITIVE' }),
    );
    expect(normalizePallet(setOf(standard, true), null)).toBeNull();
  });

  it('create rejects overlapping ranges before touching the database', async () => {
    await expect(
      priceSetService.create(
        {
          name: 'Overlap',
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

  it('create rejects a blank truck label', async () => {
    await expect(
      priceSetService.create(
        {
          name: 'Truck',
          pricing_mode: 'by_truck',
          has_pallet: false,
          tiers: [{ label: '   ', pricing_unit: 'chuyen' }],
        },
        1,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_TIERS' });
  });
});
