import { dispatchScheduleService, normalizePlateNumber } from '../services/dispatchScheduleService';
import { pool } from './__mocks__/database';

const mockPool = pool as jest.Mocked<typeof pool>;

beforeEach(() => {
  jest.clearAllMocks();
});

const mockScheduleRow = {
  id: 1,
  ngay: '2026-04-07',
  loai_tuyen: 'Tuyến cố định',
  loai_xe: 'Xe nhỏ',
  xe_type: 'Xe nhà',
  bien_so: '51H12345',
  tai_xe: 'Nguyễn Văn A',
  vehicle_id: 1,
  driver_id: 84,
  diem_nhan: 'Kho A',
  tan: '5.5',
  can: 'CAN-001',
  ghi_chu: null,
  created_by: 1,
  created_at: '2026-04-07T01:00:00Z',
  updated_at: '2026-04-07T01:00:00Z',
};

describe('normalizePlateNumber', () => {
  it('normalizes plate numbers to xxyxxxxx format without spaces or special characters', () => {
    expect(normalizePlateNumber('51C 81056')).toBe('51C81056');
    expect(normalizePlateNumber('50H-55116')).toBe('50H55116');
    expect(normalizePlateNumber('50F.088.17')).toBe('50F08817');
    expect(normalizePlateNumber('50H 63174\u00a0')).toBe('50H63174');
    expect(normalizePlateNumber('PPH-50H 44024')).toBe('50H44024');
    expect(normalizePlateNumber('Xe 51D 38021')).toBe('51D38021');
    expect(normalizePlateNumber('50E-164.61')).toBe('50E16461');
  });

  it('handles empty or blank plate numbers', () => {
    expect(normalizePlateNumber('')).toBe('');
  });
});

describe('dispatchScheduleService.listByDate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns xe_nho and xe_lon split by loai_xe for Tuyến cố định, and tuyen_ngoai for Tuyến ngoài', async () => {
    const mockRows = [
      { ...mockScheduleRow, loai_tuyen: 'Tuyến cố định', loai_xe: 'Xe nhỏ', id: 1 },
      { ...mockScheduleRow, loai_tuyen: 'Tuyến cố định', loai_xe: 'Xe lớn', id: 2 },
      { ...mockScheduleRow, loai_tuyen: 'Tuyến ngoài', loai_xe: 'Xe nhỏ', id: 3 },
    ];
    mockPool.query.mockResolvedValueOnce({ rows: mockRows } as never);

    const result = await dispatchScheduleService.listByDate('2026-04-07');

    expect(result.xe_nho).toHaveLength(1);
    expect(result.xe_lon).toHaveLength(1);
    expect(result.tuyen_ngoai).toHaveLength(1);
    expect(result.xe_nho[0].loai_xe).toBe('Xe nhỏ');
    expect(result.xe_lon[0].loai_xe).toBe('Xe lớn');
    expect(result.tuyen_ngoai[0].loai_tuyen).toBe('Tuyến ngoài');
  });

  it('returns empty arrays when no records for date', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] } as never);

    const result = await dispatchScheduleService.listByDate('2026-01-01');

    expect(result.xe_nho).toEqual([]);
    expect(result.xe_lon).toEqual([]);
    expect(result.tuyen_ngoai).toEqual([]);
    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE ngay = $1'),
      ['2026-01-01'],
    );
  });
});

describe('dispatchScheduleService.create', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('inserts record with normalized plate number and auto-resolved driver', async () => {
    // 1. Vehicle lookup returns vehicle_id: 1
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: 1, driver_name: 'Nguyễn Văn A' }] } as never);
    // 2. Driver lookup returns driver user_id: 84
    mockPool.query.mockResolvedValueOnce({ rows: [{ user_id: 84, full_name: 'Nguyễn Văn A' }] } as never);
    // 3. Insert query
    mockPool.query.mockResolvedValueOnce({ rows: [mockScheduleRow] } as never);

    const result = await dispatchScheduleService.create(
      {
        ngay: '2026-04-07',
        loai_tuyen: 'Tuyến cố định',
        loai_xe: 'Xe nhỏ',
        xe_type: 'Xe nhà',
        bien_so: '51H-123.45',
        diem_nhan: 'Kho A',
        tan: '5.5',
        can: 'CAN-001',
      },
      1,
    );

    expect(result).toEqual(mockScheduleRow);
    expect(mockPool.query).toHaveBeenCalledTimes(3);
    // Assert bien_so was normalized to '51H12345'
    expect(mockPool.query.mock.calls[2][1][4]).toBe('51H12345');
  });

  it('auto-resolves vehicle_id and driver_id when plate matches active vehicle', async () => {
    // 1. Vehicle lookup returns vehicle_id: 10
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: 10, driver_name: 'Tài xế A' }] } as never);
    // 2. Driver lookup returns driver user_id: 78
    mockPool.query.mockResolvedValueOnce({ rows: [{ user_id: 78, full_name: 'Xe 50E-164.61' }] } as never);
    // 3. Insert query
    mockPool.query.mockResolvedValueOnce({ rows: [{ ...mockScheduleRow, vehicle_id: 10, driver_id: 78 }] } as never);

    const result = await dispatchScheduleService.create(
      {
        ngay: '2026-04-07',
        loai_tuyen: 'Tuyến cố định',
        loai_xe: 'Xe nhỏ',
        xe_type: 'Xe nhà',
        bien_so: '50E 16461',
        diem_nhan: 'Kho A',
      },
      1,
    );

    expect(result.vehicle_id).toBe(10);
    expect(result.driver_id).toBe(78);
    expect(mockPool.query.mock.calls[2][1][6]).toBe(10); // vehicle_id
    expect(mockPool.query.mock.calls[2][1][7]).toBe(78); // driver_id
  });

  it('throws error when no driver_id can be found for the plate', async () => {
    // 1. Vehicle lookup returns no vehicle
    mockPool.query.mockResolvedValueOnce({ rows: [] } as never);

    await expect(
      dispatchScheduleService.create(
        {
          ngay: '2026-04-07',
          loai_tuyen: 'Tuyến ngoài',
          loai_xe: 'Xe lớn',
          xe_type: 'Xe ngoài',
          bien_so: '99Z-999.99',
          diem_nhan: 'X',
        },
        null,
      ),
    ).rejects.toThrow('Không tìm thấy tài xế (driver_id) cho biển số: 99Z99999');
  });
});

describe('dispatchScheduleService.createBatch', () => {
  const mockClient = {
    query: jest.fn(),
    release: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (pool.connect as jest.Mock) = jest.fn().mockResolvedValue(mockClient);
  });

  it('creates multiple trips in a transaction when all drivers are found', async () => {
    mockClient.query.mockResolvedValueOnce(undefined); // 1. BEGIN
    // Item 1: driver lookup for vehicle_id 1
    mockClient.query.mockResolvedValueOnce({ rows: [{ user_id: 84, full_name: 'Tài xế 1' }] }); // 2. driver lookup
    // Item 1: INSERT
    mockClient.query.mockResolvedValueOnce({ rows: [{ ...mockScheduleRow, id: 1, vehicle_id: 1, driver_id: 84 }] }); // 3. INSERT item 1
    // Item 2: vehicle lookup for 51H-678.90
    mockClient.query.mockResolvedValueOnce({ rows: [{ id: 2, driver_name: 'Tài xế 2' }] }); // 4. vehicle lookup item 2
    // Item 2: driver lookup for vehicle_id 2
    mockClient.query.mockResolvedValueOnce({ rows: [{ user_id: 85, full_name: 'Tài xế 2' }] }); // 5. driver lookup item 2
    // Item 2: INSERT
    mockClient.query.mockResolvedValueOnce({ rows: [{ ...mockScheduleRow, id: 2, vehicle_id: 2, driver_id: 85 }] }); // 6. INSERT item 2
    // COMMIT
    mockClient.query.mockResolvedValueOnce(undefined); // 7. COMMIT

    const items = [
      {
        ngay: '2026-04-07',
        loai_tuyen: 'Tuyến cố định' as const,
        loai_xe: 'Xe nhỏ' as const,
        bien_so: '51H-123.45',
        tai_xe: 'Nguyễn Văn A',
        vehicle_id: 1,
        diem_nhan: 'Kho A',
      },
      {
        ngay: '2026-04-07',
        loai_tuyen: 'Tuyến cố định' as const,
        loai_xe: 'Xe lớn' as const,
        bien_so: '51H-678.90',
        diem_nhan: 'Kho B',
      },
    ];

    const result = await dispatchScheduleService.createBatch(items, 1);

    expect(result).toHaveLength(2);
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('throws error and lists unassigned plate numbers when driver_id is missing', async () => {
    mockClient.query.mockResolvedValueOnce(undefined); // 1. BEGIN
    // Item 1: vehicle lookup for 99Z-111.11 -> none
    mockClient.query.mockResolvedValueOnce({ rows: [] }); // 2. vehicle lookup item 1
    // Item 2: vehicle lookup for 99Z-222.22 -> none
    mockClient.query.mockResolvedValueOnce({ rows: [] }); // 3. vehicle lookup item 2
    // ROLLBACK
    mockClient.query.mockResolvedValueOnce(undefined); // 4. ROLLBACK

    const items = [
      {
        ngay: '2026-04-07',
        loai_tuyen: 'Tuyến cố định' as const,
        loai_xe: 'Xe nhỏ' as const,
        bien_so: '99Z-111.11',
        diem_nhan: 'Kho A',
      },
      {
        ngay: '2026-04-07',
        loai_tuyen: 'Tuyến cố định' as const,
        loai_xe: 'Xe nhỏ' as const,
        bien_so: '99Z-222.22',
        diem_nhan: 'Kho B',
      },
    ];

    await expect(dispatchScheduleService.createBatch(items, 1)).rejects.toThrow(
      'Không tìm thấy tài xế (driver_id) cho các biển số: 99Z11111, 99Z22222. Các chuyến xe này không thể insert vào database. Vui lòng phân công tài xế trong Danh mục tài xế.',
    );
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('rolls back on DB error', async () => {
    mockClient.query.mockResolvedValueOnce(undefined); // 1. BEGIN
    // Item 1: vehicle lookup for 51H-123.45 fails
    mockClient.query.mockRejectedValueOnce(new Error('DB error')); // 2. vehicle lookup throws
    mockClient.query.mockResolvedValueOnce(undefined); // 3. ROLLBACK

    const items = [
      {
        ngay: '2026-04-07',
        loai_tuyen: 'Tuyến cố định' as const,
        loai_xe: 'Xe nhỏ' as const,
        bien_so: '51H-123.45',
        diem_nhan: 'Kho A',
      },
    ];

    await expect(dispatchScheduleService.createBatch(items, 1)).rejects.toThrow('DB error');
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(mockClient.release).toHaveBeenCalled();
  });
});

describe('dispatchScheduleService.update', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('updates editable fields and returns updated schedule', async () => {
    const updatedRow = { ...mockScheduleRow, diem_nhan: 'Kho C' };
    mockPool.query.mockResolvedValueOnce({ rows: [updatedRow] } as never);

    const result = await dispatchScheduleService.update(1, {
      diem_nhan: 'Kho C',
      tan: '6.0',
      can: 'CAN-002',
    });

    expect(result).toEqual(updatedRow);
    expect(mockPool.query).toHaveBeenCalledTimes(1);
    expect(mockPool.query.mock.calls[0][0]).toContain('UPDATE dispatch_schedules');
  });

  it('returns null when record does not exist', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] } as never);

    const result = await dispatchScheduleService.update(999, {
      diem_nhan: 'A',
    });

    expect(result).toBeNull();
  });

  it('does not update ngay/loai_tuyen/loai_xe/xe_type (structural fields)', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [mockScheduleRow] } as never);

    await dispatchScheduleService.update(1, {
      diem_nhan: 'A',
    });

    const sql = mockPool.query.mock.calls[0][0] as string;
    expect(sql).not.toContain('ngay =');
    expect(sql).not.toContain('loai_tuyen =');
    expect(sql).not.toContain('loai_xe =');
    expect(sql).not.toContain('xe_type =');
  });
});

describe('dispatchScheduleService.remove', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns true when record exists and is deleted', async () => {
    mockPool.query.mockResolvedValueOnce({ rowCount: 1 } as never);

    const result = await dispatchScheduleService.remove(1);
    expect(result).toBe(true);
  });

  it('returns false when record does not exist', async () => {
    mockPool.query.mockResolvedValueOnce({ rowCount: 0 } as never);

    const result = await dispatchScheduleService.remove(999);
    expect(result).toBe(false);
  });
});
