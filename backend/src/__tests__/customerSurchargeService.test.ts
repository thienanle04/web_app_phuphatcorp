import { customerSurchargeService, conditionsConflict, pickFee, uniqueNames } from '../services/customerSurchargeService';
import { pool } from './__mocks__/database';
import type { FeeType } from '../types/customerSurcharge';

const mockPool = pool as jest.Mocked<typeof pool>;

const base = {
  id: 1,
  ten_khach_hang: 'BHX',
  customer_id: null as number | null,
  amount: 200000,
  pricing_unit: 'tan' as const,
  start_date: '2026-08-01',
  end_date: null as string | null,
};

describe('customer surcharge matching', () => {
  it('blocks a zone-only rule against a vehicle-only rule when dates overlap', () => {
    expect(conditionsConflict(
      { zone: 'noi_thanh', vehicle_class: null, start_date: '2026-08-01', end_date: null },
      { zone: null, vehicle_class: 'le_2_5', start_date: '2026-09-01', end_date: null },
    )).toBe(true);
  });

  it('allows a more specific rule beside a wildcard', () => {
    expect(conditionsConflict(
      { zone: null, vehicle_class: null, start_date: '2026-08-01', end_date: null },
      { zone: 'noi_thanh', vehicle_class: 'le_2_5', start_date: '2026-08-01', end_date: null },
    )).toBe(false);
  });

  it('picks the more specific rate and does not treat 0 as missing', () => {
    const hit = pickFee([
      { ...base, id: 1, fee_type: 'boc_xep', zone: null, vehicle_class: null, amount: 100000 },
      { ...base, id: 2, fee_type: 'boc_xep', zone: 'noi_thanh', vehicle_class: 'le_2_5', amount: 0 },
    ], 'noi_thanh', 'le_2_5', 'dai_ly');
    expect(hit).toEqual({ rate: 0, unit: 'tan', reason: 'MATCHED', scope: 'dai_ly' });
  });

  it('returns NO_RULE instead of zero when nothing matches', () => {
    const hit = pickFee([
      { ...base, fee_type: 'phu_phi_giao_hang', zone: 'tinh', vehicle_class: null, amount: 270000, pricing_unit: 'chuyen' },
    ], 'noi_thanh', 'le_2_5', 'dai_ly');
    expect(hit.reason).toBe('NO_RULE');
    expect(hit.rate).toBeNull();
  });
});

describe('customerSurchargeService.lookup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses the dealer rate and still returns the matched point', async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [{
        id: 9,
        diem_tra_hang: 'BHX G16',
        tuyen_phuong: 'Bình Chánh',
        diem_giao_hang_tinh_phi: 'HCM',
      }],
    } as never);
    mockPool.query.mockResolvedValueOnce({
      rows: [
        { ...base, id: 1, fee_type: 'boc_xep', zone: 'noi_thanh', vehicle_class: 'le_2_5' },
        { ...base, id: 2, fee_type: 'phu_phi_giao_hang', zone: 'tinh', vehicle_class: null, amount: 270000, pricing_unit: 'chuyen' },
      ],
    } as never);

    const result = await customerSurchargeService.lookup({
      ten_khach_hang: ' bhx ',
      dia_chi_giao_hang: 'G16/108A',
      zone: 'noi_thanh',
      vehicle_class: 'le_2_5',
      on_date: '2026-09-17',
    });

    expect(result.point_status).toBe('MATCHED');
    expect(result.point).toEqual({
      diem_tra_hang: 'BHX G16',
      tuyen_phuong: 'Bình Chánh',
      diem_giao_hang_tinh_phi: 'HCM',
      supplier_name: null,
      supplier_code: null,
    });
    expect(result.fees.boc_xep).toMatchObject({ rate: 200000, scope: 'dai_ly', reason: 'MATCHED' });
    expect(result.fees.phu_phi_giao_hang.reason).toBe('NO_RULE');
    expect(result.fees.chuyen_tai.reason).toBe('NO_RULE');
    expect(result.point).not.toHaveProperty('customer_id');
  });

  it('does not fall through to the dealer when the point has another zone rule', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: 9, diem_tra_hang: 'A', tuyen_phuong: null, diem_giao_hang_tinh_phi: null }] } as never);
    mockPool.query.mockResolvedValueOnce({
      rows: [
        { ...base, id: 1, customer_id: 9, fee_type: 'boc_xep' as FeeType, zone: 'tinh', vehicle_class: null, amount: 180000 },
        { ...base, id: 2, fee_type: 'boc_xep' as FeeType, zone: 'noi_thanh', vehicle_class: 'le_2_5', amount: 200000 },
      ],
    } as never);

    const result = await customerSurchargeService.lookup({
      ten_khach_hang: 'BHX',
      dia_chi_giao_hang: 'G16',
      zone: 'noi_thanh',
      vehicle_class: 'le_2_5',
      on_date: '2026-09-17',
    });

    expect(result.fees.boc_xep).toMatchObject({ rate: null, reason: 'NO_RULE', scope: null });
  });

  it('marks both a duplicate point and every fee as AMBIGUOUS', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] } as never);
    const result = await customerSurchargeService.lookup({
      ten_khach_hang: 'BHX',
      dia_chi_giao_hang: 'same',
      zone: 'tinh',
      vehicle_class: 'pallet',
      on_date: '2026-09-17',
    });
    expect(result.point_status).toBe('AMBIGUOUS');
    expect(result.point).toBeNull();
    expect(result.fees.boc_xep.reason).toBe('AMBIGUOUS');
    expect(mockPool.query).toHaveBeenCalledTimes(1);
  });

  it('keeps a single point when no supplier code is sent, even if another address is not in the rows', async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [{
        id: 9,
        diem_tra_hang: 'BHX G16',
        tuyen_phuong: null,
        diem_giao_hang_tinh_phi: null,
        supplier_code: '2000000007',
        supplier_name: 'Acecook',
      }],
    } as never);
    mockPool.query.mockResolvedValueOnce({ rows: [] } as never);

    const result = await customerSurchargeService.lookup({
      ten_khach_hang: 'BHX',
      dia_chi_giao_hang: 'G16',
      zone: 'tinh',
      vehicle_class: 'pallet',
      on_date: '2026-09-17',
      supplier_code: '   ',
    });

    expect(result.point_status).toBe('MATCHED');
    expect(result.point).toMatchObject({ diem_tra_hang: 'BHX G16', supplier_name: 'Acecook', supplier_code: '2000000007' });
  });

  it('matches the point whose supplier code was sent when addresses collide', async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [
        { id: 1, diem_tra_hang: 'A', tuyen_phuong: null, diem_giao_hang_tinh_phi: null, supplier_code: '2000000001', supplier_name: 'Acecook' },
        { id: 2, diem_tra_hang: 'B', tuyen_phuong: 'P1', diem_giao_hang_tinh_phi: 'HCM', supplier_code: '2000000007', supplier_name: 'Calofic' },
      ],
    } as never);
    mockPool.query.mockResolvedValueOnce({
      rows: [{ ...base, id: 3, customer_id: 2, fee_type: 'boc_xep' as FeeType, zone: 'tinh', vehicle_class: 'pallet', amount: 180000 }],
    } as never);

    const result = await customerSurchargeService.lookup({
      ten_khach_hang: 'BHX',
      dia_chi_giao_hang: 'same',
      zone: 'tinh',
      vehicle_class: 'pallet',
      on_date: '2026-09-17',
      supplier_code: ' 2000000007 ',
    });

    expect(result.point_status).toBe('MATCHED');
    expect(result.point).toMatchObject({
      diem_tra_hang: 'B',
      supplier_name: 'Calofic',
      supplier_code: '2000000007',
    });
    expect(result.fees.boc_xep).toMatchObject({ rate: 180000, scope: 'diem', reason: 'MATCHED' });
  });

  it('falls back to dealer rates when the supplier code matches no point', async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [
        { id: 1, diem_tra_hang: 'A', supplier_code: '2000000001', supplier_name: 'Acecook' },
        { id: 2, diem_tra_hang: 'B', supplier_code: '2000000007', supplier_name: 'Calofic' },
      ],
    } as never);
    mockPool.query.mockResolvedValueOnce({
      rows: [{ ...base, fee_type: 'boc_xep' as FeeType, zone: 'tinh', vehicle_class: 'pallet', amount: 1000 }],
    } as never);

    const result = await customerSurchargeService.lookup({
      ten_khach_hang: 'BHX',
      dia_chi_giao_hang: 'same',
      zone: 'tinh',
      vehicle_class: 'pallet',
      on_date: '2026-09-17',
      supplier_code: '2000000009',
    });

    expect(result.point_status).toBe('NO_POINT');
    expect(result.point).toBeNull();
    expect(result.fees.boc_xep).toMatchObject({ rate: 1000, scope: 'dai_ly', reason: 'MATCHED' });
  });

  it('stays AMBIGUOUS when two points share the address and the sent code', async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [
        { id: 1, supplier_code: '2000000007' },
        { id: 2, supplier_code: '2000000007' },
      ],
    } as never);

    const result = await customerSurchargeService.lookup({
      ten_khach_hang: 'BHX',
      dia_chi_giao_hang: 'same',
      zone: 'tinh',
      vehicle_class: 'pallet',
      on_date: '2026-09-17',
      supplier_code: '2000000007',
    });

    expect(result.point_status).toBe('AMBIGUOUS');
    expect(result.fees.boc_xep.reason).toBe('AMBIGUOUS');
    expect(mockPool.query).toHaveBeenCalledTimes(1);
  });
});

/** node-pg parses DATE as local midnight, same as `new Date(y, m-1, d)`. */
function pgDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function storedRule(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    ten_khach_hang: 'BHX',
    customer_id: null,
    fee_type: 'phu_phi_giao_hang',
    zone: 'tinh',
    vehicle_class: null,
    amount: 270000,
    pricing_unit: 'chuyen',
    start_date: pgDate('2026-08-01'),
    end_date: pgDate('2026-09-17'),
    created_at: '2026-09-17T03:00:00.000Z',
    updated_at: '2026-09-17T03:00:00.000Z',
    diem_tra_hang: null,
    dia_chi_giao_hang: null,
    customer_status: null,
    ...overrides,
  };
}

describe('customer surcharge calendar dates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the Postgres calendar date, not the previous UTC day', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ total: 1 }] } as never);
    mockPool.query.mockResolvedValueOnce({
      rows: [storedRule({ start_date: pgDate('2026-09-17'), end_date: null })],
    } as never);

    const result = await customerSurchargeService.list({ status: 'all' });

    expect(result.items[0].start_date).toBe('2026-09-17');
  });

  it.each(['bách', 'bach', 'ba'])('finds Bách Hóa Xanh from "%s"', async (term) => {
    mockPool.query.mockResolvedValue({ rows: [{ total: 0 }], rowCount: 0 } as never);

    await customerSurchargeService.list({ ten_khach_hang: term, status: 'all' });

    const params = mockPool.query.mock.calls[0][1] as string[];
    expect(params[0]).toBe(`%${term === 'bách' ? 'bach' : term}%`);
    expect(String(mockPool.query.mock.calls[0][0])).toContain('LIKE');
  });

  it('rejects a start date that lands on a rule whose calendar end is that same day', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ ten_khach_hang: 'BHX' }] } as never)
      .mockResolvedValueOnce({ rows: [storedRule()] } as never);

    await expect(customerSurchargeService.create({
      ten_khach_hang: 'BHX',
      fee_type: 'phu_phi_giao_hang',
      zone: 'tinh',
      vehicle_class: null,
      amount: 100000,
      start_date: '2026-09-17',
    }, 1)).rejects.toMatchObject({ code: 'RULE_OVERLAP' });
  });

  it('keeps the picked start date when the previous rule ended the day before', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ ten_khach_hang: 'BHX' }] } as never)
      .mockResolvedValueOnce({ rows: [storedRule()] } as never)
      .mockResolvedValueOnce({ rows: [{ id: 9 }] } as never)
      .mockResolvedValueOnce({
        rows: [storedRule({ id: 9, start_date: pgDate('2026-09-18'), end_date: null })],
      } as never);

    const created = await customerSurchargeService.create({
      ten_khach_hang: 'BHX',
      fee_type: 'phu_phi_giao_hang',
      zone: 'tinh',
      vehicle_class: null,
      amount: 100000,
      start_date: '2026-09-18',
    }, 1);

    expect(created.start_date).toBe('2026-09-18');
    expect(mockPool.query.mock.calls[2][1]).toContain('2026-09-18');
  });
});

describe('customer surcharge batch and delete', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('collapses duplicate names before create', () => {
    expect(uniqueNames([' BHX ', 'bhx', 'CLV'])).toEqual(['BHX', 'CLV']);
  });

  it('refuses a drop point when more than one name remains', async () => {
    await expect(customerSurchargeService.createBatch({
      names: ['BHX', 'CLV'],
      customer_id: 4,
      fee_type: 'boc_xep',
      amount: 1000,
      start_date: '2026-09-17',
    }, 1)).rejects.toMatchObject({ code: 'POINT_NOT_ALLOWED_FOR_BATCH' });
    expect(mockPool.connect).not.toHaveBeenCalled();
  });

  it('rolls back the batch when one name already has the same open surcharge', async () => {
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ rows: [{ ok: 1 }] })
        .mockResolvedValueOnce({
          rows: [storedRule({ end_date: null, start_date: pgDate('2026-09-01'), zone: 'tinh', vehicle_class: null })],
        })
        .mockResolvedValueOnce({ rows: [{ ok: 1 }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({}),
      release: jest.fn(),
    };
    mockPool.connect.mockResolvedValue(client as never);

    await expect(customerSurchargeService.createMany({
      fee_type: 'phu_phi_giao_hang',
      zone: 'tinh',
      vehicle_class: null,
      amount: 1000,
      start_date: '2026-09-17',
    }, ['BHX', 'CLV'], 1)).rejects.toMatchObject({
      code: 'BATCH_REJECTED',
      failures: [{ ten_khach_hang: 'BHX', code: 'RULE_OPEN_EXISTS' }],
    });
    expect(client.query.mock.calls.some((call) => String(call[0]).includes('INSERT'))).toBe(false);
    expect(String(client.query.mock.calls.at(-1)?.[0])).toContain('ROLLBACK');
  });

  it('inserts one dealer surcharge per name in one transaction', async () => {
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ rows: [{ ok: 1 }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ ok: 1 }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 11 }] })
        .mockResolvedValueOnce({ rows: [{ id: 12 }] })
        .mockResolvedValueOnce({}),
      release: jest.fn(),
    };
    mockPool.connect.mockResolvedValue(client as never);
    mockPool.query
      .mockResolvedValueOnce({ rows: [storedRule({ id: 11, ten_khach_hang: 'BHX', end_date: null, start_date: pgDate('2026-09-17') })] })
      .mockResolvedValueOnce({ rows: [storedRule({ id: 12, ten_khach_hang: 'CLV', end_date: null, start_date: pgDate('2026-09-17') })] });

    const items = await customerSurchargeService.createMany({
      fee_type: 'phu_phi_giao_hang',
      zone: 'tinh',
      vehicle_class: null,
      amount: 1000,
      start_date: '2026-09-17',
    }, ['BHX', 'CLV'], 1);

    expect(items.map((item) => item.id)).toEqual([11, 12]);
    expect(client.query.mock.calls.filter((call) => String(call[0]).includes('INSERT'))).toHaveLength(2);
    expect(String(client.query.mock.calls.at(-1)?.[0])).toContain('COMMIT');
  });

  it('deletes one surcharge and does not update a closed predecessor', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [storedRule({ id: 3, end_date: null })] })
      .mockResolvedValueOnce({ rowCount: 1 });

    const removed = await customerSurchargeService.remove(3);

    expect(removed.id).toBe(3);
    expect(String(mockPool.query.mock.calls[1][0])).toContain('DELETE FROM customer_surcharge_rules');
    expect(mockPool.query.mock.calls.some((call) => String(call[0]).includes('UPDATE'))).toBe(false);
  });
});

describe('customerService ignores boc_xep writes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not persist boc_xep on create', async () => {
    const { customerService } = await import('../services/customerService');
    mockPool.query.mockResolvedValueOnce({ rows: [] } as never);
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: 1, boc_xep: true }] } as never);
    await customerService.create({
      diem_tra_hang: 'A',
      ten_khach_hang: 'A',
      boc_xep: false,
    });
    const sql = String(mockPool.query.mock.calls[1][0]);
    const params = mockPool.query.mock.calls[1][1] as unknown[];
    expect(sql.split('RETURNING')[0]).not.toContain('boc_xep');
    expect(params).not.toContain(false);
  });
});
