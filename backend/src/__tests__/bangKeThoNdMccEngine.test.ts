import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import { pool } from '../config/database';
import { storageService } from '../services/storageService';
import { bangKeThoService } from '../services/bangKeTho';
import { bangKeThoPricingLookup, resolveTargetBook } from '../services/bangKeTho/pricingLookup';
import { processNdMccWorkbook } from '../services/bangKeTho/ndMccEngine';

jest.mock('../services/storageService', () => ({
  storageService: {
    upload: jest.fn().mockResolvedValue({ filename: 'out.xlsx', objectKey: 'phuphatcorp-bang-ke-tho/batches/x/outputs/nd_mcc.xlsx' }),
    delete: jest.fn().mockResolvedValue(undefined),
    getStream: jest.fn(),
  },
}));

const mockPool = pool as jest.Mocked<typeof pool>;
const mockStorage = storageService as jest.Mocked<typeof storageService>;

beforeEach(() => {
  jest.clearAllMocks();
  bangKeThoPricingLookup.clearCache();
  mockPool.query.mockReset();
});

describe('bangKeThoPricingLookup helpers', () => {
  it('maps khungGia to vehicle class correctly', () => {
    expect(bangKeThoPricingLookup.mapKhungGiaToVehicleClass('≤2.5 tấn')).toBe('le_2_5');
    expect(bangKeThoPricingLookup.mapKhungGiaToVehicleClass('<=2.5 tấn')).toBe('le_2_5');
    expect(bangKeThoPricingLookup.mapKhungGiaToVehicleClass('≤2.5 tấn + Pallet')).toBe('le_2_5');
    expect(bangKeThoPricingLookup.mapKhungGiaToVehicleClass('>2.5-8 tấn')).toBe('gt_8_16');
    expect(bangKeThoPricingLookup.mapKhungGiaToVehicleClass('>2.5-8 tấn + Pallet')).toBe('gt_8_16');
    expect(bangKeThoPricingLookup.mapKhungGiaToVehicleClass('>8-16 tấn')).toBe('gt_8_16');
    expect(bangKeThoPricingLookup.mapKhungGiaToVehicleClass('>8-16 tấn + Pallet')).toBe('gt_8_16');
    expect(bangKeThoPricingLookup.mapKhungGiaToVehicleClass('>16-23 tấn')).toBe('gt_16_23');
    expect(bangKeThoPricingLookup.mapKhungGiaToVehicleClass('>16-23 tấn + Pallet')).toBe('gt_16_23');
    expect(bangKeThoPricingLookup.mapKhungGiaToVehicleClass('>23 tấn')).toBe('gt_16_23');
    expect(bangKeThoPricingLookup.mapKhungGiaToVehicleClass('Pallet')).toBe('pallet');
  });

  it('maps khuVuc to surcharge zone correctly', () => {
    expect(bangKeThoPricingLookup.mapKhuVucToZone('ST')).toBe('noi_thanh');
    expect(bangKeThoPricingLookup.mapKhuVucToZone('NOI_THANH')).toBe('noi_thanh');
    expect(bangKeThoPricingLookup.mapKhuVucToZone('TINH')).toBe('tinh');
  });

  describe('resolveTargetBook', () => {
    it('resolves MCC books correctly by slot and trip composition', () => {
      expect(resolveTargetBook({ supplierCode: '2000000007', slot: 'CALOFIC HP' })).toBe('CLV');
      expect(resolveTargetBook({ supplierCode: '2000000007', slot: 'CLV' })).toBe('CLV');
      expect(resolveTargetBook({ supplierCode: '2000000007', slot: 'WH UNIDEPOT' })).toBe('MCC GH');
      expect(resolveTargetBook({ supplierCode: '2000000007', slot: 'UNI' })).toBe('MCC GH');
      expect(resolveTargetBook({ supplierCode: '2000000007', slot: 'UNI 1', hasNdfcInTrip: false })).toBe('MCC (tt)');
      expect(resolveTargetBook({ supplierCode: '2000000007', slot: 'TT', hasNdfcInTrip: false })).toBe('MCC (tt)');
      expect(resolveTargetBook({ supplierCode: '2000000007', slot: 'UNI 1', hasNdfcInTrip: true })).toBe('MCC (tt) GHÉP ND');
      expect(resolveTargetBook({ supplierCode: '2000000007', slot: 'TT', hasNdfcInTrip: true })).toBe('MCC (tt) GHÉP ND');
      expect(resolveTargetBook({ supplierCode: '2000000007', slot: 'OTHER' })).toBe('CLV');
    });

    it('resolves NDFC books correctly by slot', () => {
      expect(resolveTargetBook({ supplierCode: '2000000008', slot: 'UNI 1' })).toBe('NDFC (TT)');
      expect(resolveTargetBook({ supplierCode: '2000000008', slot: 'TT' })).toBe('NDFC (TT)');
      expect(resolveTargetBook({ supplierCode: '2000000008', slot: 'UNI 3' })).toBe('NDFC-naic');
      expect(resolveTargetBook({ supplierCode: '2000000008', slot: 'WH UNIDEPOT' })).toBe('NDFC-naic');
    });

    it('returns undefined for non-MCC and non-NDFC supplier codes', () => {
      expect(resolveTargetBook({ supplierCode: '2000000001', slot: 'CLV' })).toBeUndefined();
      expect(resolveTargetBook({ supplierCode: undefined, slot: 'TT' })).toBeUndefined();
    });
  });
});

describe('bangKeThoPricingLookup.lookupTransportRate', () => {
  const sampleTiers = [
    {
      route_name: 'Lâm Đồng - Lâm Viên - Đà Lạt/ Xuân Hương - Đà Lạt/ Đơn Dương',
      book_name: 'CLV',
      price: '660000',
      pricing_unit: 'tan',
      range_from: '8.000',
      range_to: '16.000',
      tier_label: null,
      set_label: null,
    },
    {
      route_name: 'Lâm Đồng - Lâm Viên - Đà Lạt/ Xuân Hương - Đà Lạt/ Đơn Dương',
      book_name: 'MCC GH',
      price: '861000',
      pricing_unit: 'tan',
      range_from: '8.000',
      range_to: '16.000',
      tier_label: null,
      set_label: null,
    },
    {
      route_name: 'Lâm Đồng - Lâm Viên - Đà Lạt/ Xuân Hương - Đà Lạt/ Đơn Dương',
      book_name: 'MCC (tt) GHÉP ND',
      price: '861000',
      pricing_unit: 'tan',
      range_from: '8.000',
      range_to: '16.000',
      tier_label: null,
      set_label: null,
    },
    {
      route_name: 'Hồ Chí Minh',
      book_name: 'MCC (tt)',
      price: '382000',
      pricing_unit: 'tan',
      range_from: '8.000',
      range_to: '16.000',
      tier_label: null,
      set_label: null,
    },
    {
      route_name: 'Hồ Chí Minh',
      book_name: 'MCC GH',
      price: '392000',
      pricing_unit: 'tan',
      range_from: '8.000',
      range_to: '16.000',
      tier_label: null,
      set_label: null,
    },
    {
      route_name: 'Hồ Chí Minh',
      book_name: 'MCC (tt) GHÉP ND',
      price: '400000',
      pricing_unit: 'tan',
      range_from: '8.000',
      range_to: '16.000',
      tier_label: null,
      set_label: null,
    },
  ];

  it('MCC-clv picks price from CLV book', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: sampleTiers } as never);
    const rate = await bangKeThoPricingLookup.lookupTransportRate({
      diemTinhPhi: 'Lâm Đồng - Lâm Viên-Đà Lạt/ Xuân Hương-Đà Lạt/ Đơn Dương',
      khungGia: '>8-16 tấn',
      invoiceDateIso: '2026-07-01',
      supplierCode: '2000000007',
      slot: 'CALOFIC HP',
    });
    expect(rate).toBe(660000);
  });

  it('MCC-clv picks price from CLV book when diemTinhPhi is sub-route Xuan Huong-Da Lat', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: sampleTiers } as never);
    const rate = await bangKeThoPricingLookup.lookupTransportRate({
      diemTinhPhi: 'Xuân Hương-Đà Lạt',
      khungGia: '>8-16 tấn',
      invoiceDateIso: '2026-07-01',
      supplierCode: '2000000007',
      slot: 'CALOFIC HP',
    });
    expect(rate).toBe(660000);
  });

  it('MCC-clv picks price from CLV book when diemTinhPhi is Don Duong', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: sampleTiers } as never);
    const rate = await bangKeThoPricingLookup.lookupTransportRate({
      diemTinhPhi: 'Đơn Dương',
      khungGia: '>8-16 tấn',
      invoiceDateIso: '2026-07-01',
      supplierCode: '2000000007',
      slot: 'CALOFIC HP',
    });
    expect(rate).toBe(660000);
  });

  it('MCC (uni) picks price from MCC GH book', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: sampleTiers } as never);
    const rate = await bangKeThoPricingLookup.lookupTransportRate({
      diemTinhPhi: 'Hồ Chí Minh',
      khungGia: '>8-16 tấn',
      invoiceDateIso: '2026-07-01',
      supplierCode: '2000000007',
      slot: 'WH Unidepot',
    });
    expect(rate).toBe(392000);
  });

  it('MCC (tt) without NDFC in trip picks price from MCC (tt) book', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: sampleTiers } as never);
    const rate = await bangKeThoPricingLookup.lookupTransportRate({
      diemTinhPhi: 'Hồ Chí Minh',
      khungGia: '>8-16 tấn',
      invoiceDateIso: '2026-07-01',
      supplierCode: '2000000007',
      slot: 'UNI 1',
      hasNdfcInTrip: false,
    });
    expect(rate).toBe(382000);
  });

  it('MCC (tt) with NDFC in trip picks price from MCC (tt) GHÉP ND book', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: sampleTiers } as never);
    const rate = await bangKeThoPricingLookup.lookupTransportRate({
      diemTinhPhi: 'Hồ Chí Minh',
      khungGia: '>8-16 tấn',
      invoiceDateIso: '2026-07-01',
      supplierCode: '2000000007',
      slot: 'UNI 1',
      hasNdfcInTrip: true,
    });
    expect(rate).toBe(400000);
  });

  it('returns null if route not found in target book', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: sampleTiers } as never);
    const rate = await bangKeThoPricingLookup.lookupTransportRate({
      diemTinhPhi: 'Hồ Chí Minh',
      khungGia: '>8-16 tấn',
      invoiceDateIso: '2026-07-01',
      supplierCode: '2000000007',
      slot: 'CALOFIC HP',
      targetBook: 'CLV',
    });
    expect(rate).toBeNull();
  });
});

describe('bangKeThoNdMccEngine', () => {
  async function createTestWorkbook(rows: any[][]): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('Sheet1');
    wb.addWorksheet('VFM');
    wb.addWorksheet('CLV');
    wb.addWorksheet('STHI');
    const ws = wb.addWorksheet('Processed');

    const headers = [
      'Mã nhà cung cấp', 'Số hóa đơn', 'Ngày hóa đơn', 'Số tàu', 'Mã khách hàng',
      'Tên khách hàng', 'Địa chỉ giao hàng', 'Khung giá', 'Đơn vị tính', 'Mã hàng hóa',
      'Tên hàng hóa (Vie)', 'Tên hàng hóa (En)', 'Mã liên hệ giao hàng', 'Mã DVT',
      'Số lượng (DVT bán hàng)', 'SP Trọng lượng net', 'HĐ Trọng lượng (Net)', 'Round(MT)',
      'CLF', 'VFM', 'MCC', 'CLV', 'NDFC', '', '',
      'Tài xế', 'Thông tin bổ sung', 'Slot', 'Diễn giải', 'Channel',
      'SubChannel', 'SlotNo', 'user tạo HĐ', 'User tạo PXK', 'PO number',
      'Warehouse No', 'Warehouse Name', 'Phiếu XK', 'Chứng từ ghi sổ', 'Số seri',
      'Loại hàng', 'Tuyến cũ', 'Tuyến mới', 'Tuyến lên hóa đơn'
    ];

    ws.addRow(headers);
    for (const r of rows) {
      ws.addRow(r);
    }
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  it('throws MISSING_PROCESSED_SHEET if Processed sheet is absent', async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('Sheet1');
    const buf = Buffer.from(await wb.xlsx.writeBuffer());

    await expect(processNdMccWorkbook(buf)).rejects.toThrow('MISSING_PROCESSED_SHEET');
  });

  it('generates 8 sheets with formulas and aggregates invoices correctly', async () => {
    mockPool.query.mockResolvedValue({ rows: [] } as never);

    const testRows = [
      // MCC Row 1 (CALOFIC HP)
      [
        '2000000007', 'HD001', '2026-07-01', '51C 12345', 'KH01',
        'CÔNG TY TNHH ABC', '123 ĐƯỜNG ABC, TP.HCM', '>8-16 tấn', 'Tấn', 'SP01',
        'Bột chiên giòn', 'Frying mix', '', 'CAR',
        10, 10, 100, 0.1,
        0, 0, 0.1, 0, 0, '', '',
        'Tài xế A', '', 'CALOFIC HP', '', 'RETAIL',
        'PDS', '', '', '', '',
        '', '', '', '', '',
        '', '', '', ''
      ],
      // MCC Row 2 (CALOFIC HP, same invoice HD001)
      [
        '2000000007', 'HD001', '2026-07-01', '51C 12345', 'KH01',
        'CÔNG TY TNHH ABC', '123 ĐƯỜNG ABC, TP.HCM', '>8-16 tấn', 'Tấn', 'SP02',
        'Bột mì', 'Flour', '', 'CAR',
        20, 10, 200, 0.2,
        0, 0, 0.2, 0, 0, '', '',
        'Tài xế A', '', 'CALOFIC HP', '', 'RETAIL',
        'PDS', '', '', '', '',
        '', '', '', '', '',
        '', '', '', ''
      ],
      // MCC Row 3 (WH Unidepot)
      [
        '2000000007', 'HD002', '2026-07-02', '51C 67890', 'KH02',
        'CÔNG TY TNHH XYZ', '456 ĐƯỜNG XYZ, BÌNH DƯƠNG', '>8-16 tấn', 'Tấn', 'SP03',
        'Dầu ăn', 'Cooking oil', '', 'CAR',
        50, 10, 500, 0.5,
        0, 0, 0.5, 0, 0, '', '',
        'Tài xế B', '', 'WH Unidepot', '', 'SUPERMARKET',
        'MT', '', '', '', '',
        '', '', '', '', '',
        '', '', '', ''
      ],
      // NDFC Row 4 (UNI 1)
      [
        '2000000008', 'HD003', '2026-07-03', '51C 99999', 'KH03',
        'CÔNG TY CỔ PHẦN DEF', '789 ĐƯỜNG DEF, ĐỒNG NAI', '>8-16 tấn', 'Tấn', 'SP04',
        'Bột gạo', 'Rice powder', '', 'CAR',
        30, 10, 300, 0.3,
        0, 0, 0, 0, 0.3, '', '',
        'Tài xế C', '', 'UNI 1', '', 'GENERAL',
        'GT', '', '', '', '',
        '', '', '', '', '',
        '', '', '', ''
      ],
      // Other supplier row (should be ignored)
      [
        '2000000099', 'HD999', '2026-07-01', '51C 00000', 'KH99',
        'OTHER', 'OTHER', '>8-16 tấn', 'Tấn', 'SP99',
        'Other', 'Other', '', 'CAR',
        10, 10, 100, 0.1,
        0.1, 0, 0, 0, 0, '', '',
        '', '', 'CALOFIC HP', '', '',
        '', '', '', '', '',
        '', '', '', '', '',
        '', '', '', ''
      ]
    ];

    const inputBuf = await createTestWorkbook(testRows);
    const res = await processNdMccWorkbook(inputBuf);

    expect(res.stats.mcc_rows).toBe(3);
    expect(res.stats.ndfc_rows).toBe(1);
    expect(res.stats.mcc_invoices).toBe(2);
    expect(res.stats.ndfc_invoices).toBe(1);

    const outWb = new ExcelJS.Workbook();
    await outWb.xlsx.load(res.buffer as any);

    const expectedSheets = [
      'NCC',
      'Sheet1',
      'Processed',
      'Processed v2',
      'MCC (goc)',
      'MCC-clv',
      'MCC (uni)',
      'MCC (tt)',
      'NDFC (goc)',
      'NDFC-clv',
      'NDFC (uni)',
      'NDFC (tt)',
    ];
    expect(outWb.worksheets.map((w) => w.name)).toEqual(expectedSheets);

    // Verify Processed v2 exists and has numeric format on O, P, Q
    const outV2 = outWb.getWorksheet('Processed v2')!;
    expect(outV2).toBeDefined();
    expect(outV2.getRow(2).getCell(15).numFmt).toBe('#,##0');
    expect(outV2.getRow(2).getCell(16).numFmt).toBe('#,##0.000');
    expect(outV2.getRow(2).getCell(17).numFmt).toBe('#,##0.000');

    // Verify non-scope sheets (VFM, CLV, STHI) are stripped out
    expect(outWb.getWorksheet('VFM')).toBeUndefined();
    expect(outWb.getWorksheet('CLV')).toBeUndefined();
    expect(outWb.getWorksheet('STHI')).toBeUndefined();

    // Verify MCC (goc) has 3 data rows + 2 header rows + 1 TỔNG CỘNG B row = 6 rows (all <=2.5t)
    const mccGoc = outWb.getWorksheet('MCC (goc)')!;
    expect(mccGoc.rowCount).toBe(6);
    expect(mccGoc.getRow(6).getCell(5).value).toBe('TỔNG CỘNG B');

    // Row 3 should have formula for Hóa đơn and Round MT
    const row3 = mccGoc.getRow(3);
    expect((row3.getCell(9).value as any)?.formula).toBe('G3&", ("&L3&"), xe "&D3');
    expect((row3.getCell(22).value as any)?.formula).toBe('ROUND(U3/1000,3)');

    // Verify MCC-clv summary sheet has 1 invoice (HD001) + 1 TỔNG CỘNG B row = 4 rows
    const mccClv = outWb.getWorksheet('MCC-clv')!;
    // Row 1 empty, Row 2 header, Row 3 invoice HD001, Row 4 TỔNG CỘNG B
    expect(mccClv.rowCount).toBe(4);
    const clvRow3 = mccClv.getRow(3);
    expect(clvRow3.getCell(2).value).toBe('HD001');
    // Total weight for HD001 = 0.1 + 0.2 = 0.3
    expect(clvRow3.getCell(13).value).toBe(0.3);
    expect(mccClv.getRow(4).getCell(5).value).toBe('TỔNG CỘNG B');
  });

  it('preserves existing NCC sheet content and keeps exact sheet order', async () => {
    mockPool.query.mockResolvedValue({ rows: [] } as never);

    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('Sheet1');
    const nccWs = wb.addWorksheet('ncc');
    nccWs.addRow(['Mã NCC', 'Tên NCC', 'Ghi chú']);
    nccWs.addRow(['2000000007', 'MCC', 'Chi nhánh miền Nam']);
    nccWs.addRow(['2000000008', 'NDFC', 'Chi nhánh miền Bắc']);

    const ws = wb.addWorksheet('Processed');
    const headers = [
      'Mã nhà cung cấp', 'Số hóa đơn', 'Ngày hóa đơn', 'Số tàu', 'Mã khách hàng',
      'Tên khách hàng', 'Địa chỉ giao hàng', 'Khung giá', 'Đơn vị tính', 'Mã hàng hóa',
      'Tên hàng hóa (Vie)', 'Tên hàng hóa (En)', 'Mã liên hệ giao hàng', 'Mã DVT',
      'Số lượng (DVT bán hàng)', 'SP Trọng lượng net', 'HĐ Trọng lượng (Net)', 'Round(MT)',
      'CLF', 'VFM', 'MCC', 'CLV', 'NDFC', '', '',
      'Tài xế', 'Thông tin bổ sung', 'Slot', 'Diễn giải', 'Channel',
      'SubChannel', 'SlotNo', 'user tạo HĐ', 'User tạo PXK', 'PO number',
      'Warehouse No', 'Warehouse Name', 'Phiếu XK', 'Chứng từ ghi sổ', 'Số seri',
      'Loại hàng', 'Tuyến cũ', 'Tuyến mới', 'Tuyến lên hóa đơn'
    ];
    ws.addRow(headers);
    ws.addRow([
      '2000000007', 'HD001', '2026-07-01', '51C 12345', 'KH01',
      'CÔNG TY TNHH ABC', '123 ĐƯỜNG ABC, TP.HCM', '>8-16 tấn', 'Tấn', 'SP01',
      'Bột chiên giòn', 'Frying mix', '', 'CAR',
      10, 10, 100, 0.1,
      0, 0, 0.1, 0, 0, '', '',
      'Tài xế A', '', 'CALOFIC HP', '', 'RETAIL',
      'PDS', '', '', '', '',
      '', '', '', '', '',
      '', '', '', ''
    ]);

    const inputBuf = Buffer.from(await wb.xlsx.writeBuffer());
    const res = await processNdMccWorkbook(inputBuf);

    const outWb = new ExcelJS.Workbook();
    await outWb.xlsx.load(res.buffer as any);

    const expectedSheets = [
      'NCC',
      'Sheet1',
      'Processed',
      'Processed v2',
      'MCC (goc)',
      'MCC-clv',
      'MCC (uni)',
      'MCC (tt)',
      'NDFC (goc)',
      'NDFC-clv',
      'NDFC (uni)',
      'NDFC (tt)',
    ];
    expect(outWb.worksheets.map((w) => w.name)).toEqual(expectedSheets);

    const outNcc = outWb.getWorksheet('NCC')!;
    expect(outNcc.getRow(1).getCell(1).value).toBe('Mã NCC');
    expect(outNcc.getRow(2).getCell(1).value).toBe('2000000007');
    expect(outNcc.getRow(2).getCell(2).value).toBe('MCC');
    expect(outNcc.getRow(3).getCell(1).value).toBe('2000000008');
  });
});

describe('bangKeThoService.processNdMcc', () => {
  it('updates outputs to ready and saves to storage', async () => {
    const batchId = '11111111-1111-1111-1111-111111111111';

    // 1. Batch lookup mock
    mockPool.query
      .mockResolvedValueOnce({
        rows: [{
          id: batchId,
          original_filename: '1-8.7.xlsx',
          input_object_key: 'batches/11111111-1111-1111-1111-111111111111/input.xlsx'
        }],
      } as never)
      // Customers cache init
      .mockResolvedValueOnce({ rows: [] } as never)
      // Rate lookups
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [] } as never)
      // Update bang_ke_tho_outputs
      .mockResolvedValueOnce({
        rows: [{
          generated_at: '2026-09-19T00:00:00.000Z',
          download_filename: 'ND-MCC 1-8.7.xlsx'
        }]
      } as never);

    // Create minimal valid input buffer with Processed sheet
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Processed');
    ws.addRow([
      'Mã nhà cung cấp', 'Số hóa đơn', 'Ngày hóa đơn', 'Số tàu', 'Mã khách hàng',
      'Tên khách hàng', 'Địa chỉ giao hàng', 'Khung giá', 'Đơn vị tính', 'Mã hàng hóa',
      'Tên hàng hóa (Vie)', 'Tên hàng hóa (En)', 'Mã liên hệ giao hàng', 'Mã DVT',
      'Số lượng (DVT bán hàng)', 'SP Trọng lượng net', 'HĐ Trọng lượng (Net)', 'Round(MT)',
      'CLF', 'VFM', 'MCC', 'CLV', 'NDFC', '', '',
      'Tài xế', 'Thông tin bổ sung', 'Slot', 'Diễn giải', 'Channel'
    ]);
    ws.addRow([
      '2000000007', 'HD001', '2026-07-01', '51C 12345', 'KH01',
      'ABC', 'HCM', '>8-16 tấn', 'Tấn', 'SP01',
      'Bột', 'Flour', '', 'CAR',
      10, 10, 100, 0.1,
      0, 0, 0.1, 0, 0, '', '',
      '', '', 'CALOFIC HP', '', 'RETAIL'
    ]);
    const inputBuf = Buffer.from(await wb.xlsx.writeBuffer());

    // Readable stream mock
    const { Readable } = await import('stream');
    const stream = Readable.from(inputBuf);
    mockStorage.getStream.mockResolvedValue({
      stream: stream as any,
      stat: { size: inputBuf.length } as any,
    });

    const result = await bangKeThoService.processNdMcc(batchId, 1);

    expect(result.batch_id).toBe(batchId);
    expect(result.house_code).toBe('nd_mcc');
    expect(result.status).toBe('ready');
    expect(result.download_filename).toBe('ND-MCC 1-8.7.xlsx');
    expect(result.stats.mcc_rows).toBe(1);
    expect(mockStorage.upload).toHaveBeenCalledWith(
      expect.any(Buffer),
      'ND-MCC 1-8.7.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'phuphatcorp-bang-ke-tho',
      'batches/11111111-1111-1111-1111-111111111111/outputs/nd_mcc.xlsx',
    );
  });

  it('matches address missing THUA DAT SO 2132 as partial match and highlights with note', async () => {
    const tuanHanCust = {
      id: 1401,
      ten_khach_hang: 'CÔNG TY TNHH MTV TUẤN HÂN',
      dia_chi_giao_hang: 'TỜ BẢN ĐỒ SỐ 9, ĐƯỜNG CÙ CHÍNH LAN, PHƯỜNG LÂM VIÊN-ĐÀ LẠT, TỈNH LÂM ĐỒNG, VIỆT NAM',
      diem_tra_hang: 'Tuấn Hân',
      tuyen_phuong: 'Lâm Đồng - Lâm Viên-Đà Lạt',
      diem_giao_hang_tinh_phi: 'Lâm Đồng - Lâm Viên-Đà Lạt/ Xuân Hương-Đà Lạt/ Đơn Dương',
      supplier_code: 'default',
    };

    mockPool.query.mockImplementation(async (queryOrConfig: any) => {
      const sql = typeof queryOrConfig === 'string' ? queryOrConfig : queryOrConfig?.text || '';
      if (sql.includes('FROM customers')) {
        return { rows: [tuanHanCust] } as any;
      }
      return { rows: [] } as any;
    });

    await bangKeThoPricingLookup.initCache();

    const lookupRes = await bangKeThoPricingLookup.lookupCustomer({
      tenKhachHang: 'CÔNG TY TNHH MTV TUẤN HÂN',
      diaChiGiaoHang: 'THỬA ĐẤT SỐ 2132, TỜ BẢN ĐỒ SỐ 9, ĐƯỜNG CÙ CHÍNH LAN, PHƯỜNG LÂM VIÊN-ĐÀ LẠT, TỈNH LÂM ĐỒNG, VIỆT NAM',
    });

    expect(lookupRes).not.toBeNull();
    expect(lookupRes!.diem_tra_hang).toBe('Tuấn Hân');
    expect(lookupRes!.is_partial_match).toBe(true);

    // 2. Test workbook processing with partial match row
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Processed');
    ws.addRow([
      'Mã nhà cung cấp', 'Số hóa đơn', 'Ngày hóa đơn', 'Số tàu', 'Mã khách hàng',
      'Tên khách hàng', 'Địa chỉ giao hàng', 'Khung giá', 'Đơn vị tính', 'Mã hàng hóa',
      'Tên hàng hóa (Vie)', 'Tên hàng hóa (En)', 'Mã liên hệ giao hàng', 'Mã DVT',
      'Số lượng (DVT bán hàng)', 'SP Trọng lượng net', 'HĐ Trọng lượng (Net)', 'Round(MT)',
      'CLF', 'VFM', 'MCC', 'CLV', 'NDFC', '', '',
      'Tài xế', 'Thông tin bổ sung', 'Slot', 'Diễn giải', 'Channel'
    ]);
    ws.addRow([
      '2000000007', 'HD_TUANHAN', '2026-07-01', '49C 99999', 'TH01',
      'CÔNG TY TNHH MTV TUẤN HÂN',
      'THỬA ĐẤT SỐ 2132, TỜ BẢN ĐỒ SỐ 9, ĐƯỜNG CÙ CHÍNH LAN, PHƯỜNG LÂM VIÊN-ĐÀ LẠT, TỈNH LÂM ĐỒNG, VIỆT NAM',
      '>8-16 tấn', 'Tấn', 'SP01',
      'Dầu ăn', 'Cooking Oil', '', 'CAR',
      10, 10, 500, 0.5,
      0, 0, 0.5, 0, 0, '', '',
      '', '', 'CLV', '', 'RETAIL'
    ]);

    const inBuf = Buffer.from(await wb.xlsx.writeBuffer());
    const { buffer } = await processNdMccWorkbook(inBuf);
    const outWb = new ExcelJS.Workbook();
    await outWb.xlsx.load(buffer as any);

    // Check Processed sheet
    const procSheet = outWb.getWorksheet('Processed')!;
    const addrCellProc = procSheet.getRow(2).getCell(7);
    expect(addrCellProc.fill).toMatchObject({
      fgColor: { argb: 'FFFFEB9C' },
    });
    expect(addrCellProc.note).toBe(tuanHanCust.dia_chi_giao_hang);

    // Check Processed v2 sheet
    const procV2Sheet = outWb.getWorksheet('Processed v2')!;
    const addrCellV2 = procV2Sheet.getRow(2).getCell(7);
    expect(addrCellV2.fill).toMatchObject({
      fgColor: { argb: 'FFFFEB9C' },
    });
    expect(addrCellV2.note).toBe(tuanHanCust.dia_chi_giao_hang);

    // Check MCC (goc) sheet
    const gocSheet = outWb.getWorksheet('MCC (goc)')!;
    const gocRow = gocSheet.getRow(3);
    expect(gocRow.getCell(6).value).toBe('Tuấn Hân'); // ĐẠI LÝ
    expect(gocRow.getCell(6).fill).toMatchObject({ fgColor: { argb: 'FFFFEB9C' } });
    expect(gocRow.getCell(6).note).toBeUndefined();
    expect(gocRow.getCell(7).fill).toMatchObject({ fgColor: { argb: 'FFFFEB9C' } }); // ĐIỂM GIAO HÀNG THỰC TẾ
    expect(gocRow.getCell(7).note).toBeUndefined();
    expect(gocRow.getCell(8).fill).toMatchObject({ fgColor: { argb: 'FFFFEB9C' } }); // ĐIỂM GIAO HÀNG TÍNH PHÍ
    expect(gocRow.getCell(8).note).toBeUndefined();
    expect(gocRow.getCell(11).fill).toMatchObject({ fgColor: { argb: 'FFFFEB9C' } }); // Địa chỉ giao hàng
    expect(gocRow.getCell(11).note).toBe(tuanHanCust.dia_chi_giao_hang);

    // Check MCC-clv summary sheet
    const summarySheet = outWb.getWorksheet('MCC-clv')!;
    const sumRow = summarySheet.getRow(3);
    expect(sumRow.getCell(5).value).toBe('Tuấn Hân'); // ĐẠI LÝ
    expect(sumRow.getCell(5).fill).toMatchObject({ fgColor: { argb: 'FFFFEB9C' } });
    expect(sumRow.getCell(5).note).toBeUndefined();
    expect(sumRow.getCell(10).fill).toMatchObject({ fgColor: { argb: 'FFFFEB9C' } }); // Địa chỉ giao hàng
    expect(sumRow.getCell(10).note).toBe(tuanHanCust.dia_chi_giao_hang);
  });

  it('applies 5 nhà trip totals onto every invoice and formats correctly in all 8 sheets', async () => {
    mockPool.query.mockResolvedValue({ rows: [] } as never);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Processed');
    const headers = [
      'Mã nhà cung cấp', 'Số hóa đơn', 'Ngày hóa đơn', 'Số tàu', 'Mã khách hàng',
      'Tên khách hàng', 'Địa chỉ giao hàng', 'Khung giá', 'Đơn vị tính', 'Mã hàng hóa',
      'Tên hàng hóa (Vie)', 'Tên hàng hóa (En)', 'Mã liên hệ giao hàng', 'Mã DVT',
      'Số lượng (DVT bán hàng)', 'SP Trọng lượng net', 'HĐ Trọng lượng (Net)', 'ROUND (MT)',
      'CLF', 'VFM', 'MCC', 'CLV', 'NDFC', 'Col1', 'Col2',
      'Tài xế', 'Thông tin bổ sung', 'Slot', 'Diễn giải', 'Channel',
      'SubChannel', 'SlotNo', 'user tạo HĐ', 'User tạo PXK', 'PO number',
      'Warehouse No', 'Warehouse Name', 'Phiếu XK', 'Chứng từ ghi sổ', 'Số seri',
      'Loại hàng', 'Tuyến cũ', 'Tuyến mới', 'Tuyến lên hóa đơn'
    ];
    ws.addRow(headers);

    // Trip 1: Truck 50E 11111 (CALOFIC HP -> MCC-clv)
    // HD01 - Row 1
    ws.addRow([
      '2000000007', 'HD01', '2026-07-01', '50E 11111', 'KH01',
      'Khách 1', 'Địa chỉ 1', '>8-16 tấn', 'Tấn', 'SP01',
      'Bột', 'Flour', '', 'CAR',
      10, 10, 1000, 1.0,
      '', '', '', '', '', '', '',
      'Tài xế 1', '', 'CALOFIC HP', '', 'RETAIL'
    ]);
    // HD01 - Row 2 (same invoice HD01)
    ws.addRow([
      '2000000007', 'HD01', '2026-07-01', '50E 11111', 'KH01',
      'Khách 1', 'Địa chỉ 1', '>8-16 tấn', 'Tấn', 'SP02',
      'Bột 2', 'Flour 2', '', 'CAR',
      20, 10, 2000, 2.0,
      '', '', '', '', '', '', '',
      'Tài xế 1', '', 'CALOFIC HP', '', 'RETAIL'
    ]);
    // HD02 - Row 1 (different invoice in same trip)
    ws.addRow([
      '2000000007', 'HD02', '2026-07-01', '50E 11111', 'KH02',
      'Khách 2', 'Địa chỉ 2', '>8-16 tấn', 'Tấn', 'SP03',
      'Dầu', 'Oil', '', 'CAR',
      5, 10, 500, 0.5,
      '', '', '', '', '', '', '',
      'Tài xế 1', '', 'CALOFIC HP', '', 'RETAIL'
    ]);
    // Separator row for Trip 1: Col 19 (5 nhà in v2) = 15.0, CLF = 8.0, MCC = 3.5, NDFC = 3.5
    // In original Processed: col 19 is CLF, col 21 is MCC, col 23 is NDFC, col 24 is 5 nhà
    ws.addRow([
      '', '', '', '', '',
      '', '', '', '', '',
      '', '', '', '',
      '', '', '', 15.0,
      8.0, '', 3.5, '', 3.5, 15.0, 15.0,
      'Tài xế 1'
    ]);

    const inputBuf = Buffer.from(await wb.xlsx.writeBuffer());
    const res = await processNdMccWorkbook(inputBuf);

    const outWb = new ExcelJS.Workbook();
    await outWb.xlsx.load(res.buffer as any);

    // 1. Verify MCC (goc)
    const mccGoc = outWb.getWorksheet('MCC (goc)')!;
    expect(mccGoc).toBeDefined();
    // Row 1 empty, Row 2 header, Row 3 (HD01 row 1), Row 4 (HD01 row 2), Row 5 (HD02 row 1), Row 6 (Tổng cộng xe), Row 7 (TỔNG CỘNG A)
    expect(mccGoc.rowCount).toBe(7);
    expect(mccGoc.getRow(6).getCell(3).value).toBe('Tổng cộng');
    expect(mccGoc.getRow(7).getCell(5).value).toBe('TỔNG CỘNG A');

    // Row 3: First row of HD01 -> must have formulas and 5 nhà trip values
    const r3 = mccGoc.getRow(3);
    expect((r3.getCell(25).value as any)?.formula).toBe('AL3');
    expect((r3.getCell(38).value as any)?.formula).toBe('SUBTOTAL(9,AM3:AR3)');
    expect(r3.getCell(39).value).toBe(8.0); // CLF
    expect(r3.getCell(41).value).toBe(3.5); // MCC
    expect(r3.getCell(43).value).toBe(3.5); // NDFC

    // Row 4: Second row of HD01 -> must be empty in Col 25, 38..44
    const r4 = mccGoc.getRow(4);
    expect(r4.getCell(25).value).toBe('');
    expect(r4.getCell(38).value).toBe('');
    expect(r4.getCell(39).value).toBe('');
    expect(r4.getCell(41).value).toBe('');
    expect(r4.getCell(43).value).toBe('');

    // Row 5: First row of HD02 -> must ALSO have formulas and 5 nhà trip values!
    const r5 = mccGoc.getRow(5);
    expect((r5.getCell(25).value as any)?.formula).toBe('AL5');
    expect((r5.getCell(38).value as any)?.formula).toBe('SUBTOTAL(9,AM5:AR5)');
    expect(r5.getCell(39).value).toBe(8.0); // CLF
    expect(r5.getCell(41).value).toBe(3.5); // MCC
    expect(r5.getCell(43).value).toBe(3.5); // NDFC

    // 2. Verify MCC-clv summary sheet
    const mccClv = outWb.getWorksheet('MCC-clv')!;
    expect(mccClv).toBeDefined();
    // Row 1 empty, Row 2 header, Row 3 (HD01), Row 4 (HD02), Row 5 (Tổng cộng xe), Row 6 (TỔNG CỘNG A)
    expect(mccClv.rowCount).toBe(6);
    expect(mccClv.getRow(5).getCell(3).value).toBe('Tổng cộng');
    expect(mccClv.getRow(6).getCell(5).value).toBe('TỔNG CỘNG A');

    // Invoice HD01 in MCC-clv (Row 3)
    const sumR3 = mccClv.getRow(3);
    expect(sumR3.getCell(2).value).toBe('HD01');
    expect((sumR3.getCell(15).value as any)?.formula).toBe('AB3');
    expect((sumR3.getCell(28).value as any)?.formula).toBe('SUBTOTAL(9,AC3:AH3)');
    expect(sumR3.getCell(29).value).toBe(8.0); // CLF
    expect(sumR3.getCell(31).value).toBe(3.5); // MCC
    expect(sumR3.getCell(33).value).toBe(3.5); // NDFC

    // Invoice HD02 in MCC-clv (Row 4) -> must ALSO have full 5 nhà info!
    const sumR4 = mccClv.getRow(4);
    expect(sumR4.getCell(2).value).toBe('HD02');
    expect((sumR4.getCell(15).value as any)?.formula).toBe('AB4');
    expect((sumR4.getCell(28).value as any)?.formula).toBe('SUBTOTAL(9,AC4:AH4)');
    expect(sumR4.getCell(29).value).toBe(8.0); // CLF
    expect(sumR4.getCell(31).value).toBe(3.5); // MCC
    expect(sumR4.getCell(33).value).toBe(3.5); // NDFC
  });

  it('verifies real-world reference file ND-MCC 30.6.xlsx applies 5 nhà to multiple invoices in same trip', async () => {
    mockPool.query.mockResolvedValue({ rows: [] } as never);

    const refPath = path.resolve(__dirname, '../../../reference/xu_ly_du_lieu_ke_toan/ND-MCC 30.6.xlsx');
    if (!fs.existsSync(refPath)) return; // Skip if ref file not present

    const buf = fs.readFileSync(refPath);
    const res = await processNdMccWorkbook(buf);

    expect(res.stats.mcc_rows).toBeGreaterThan(0);
    expect(res.stats.ndfc_rows).toBeGreaterThan(0);

    const outWb = new ExcelJS.Workbook();
    await outWb.xlsx.load(res.buffer as any);

    const goc = outWb.getWorksheet('MCC (goc)')!;
    expect(goc).toBeDefined();

    // In 30.6.xlsx, truck 50E 65434 has two invoices: 00106522 (row 3..9) and 00106524 (row 10)
    // Row 3: First row of invoice 00106522
    const r3 = goc.getRow(3);
    expect(r3.getCell(2).value).toBe('00106522');
    expect((r3.getCell(25).value as any)?.formula).toBe('AL3');
    expect((r3.getCell(38).value as any)?.formula).toBe('SUBTOTAL(9,AM3:AR3)');
    expect(r3.getCell(39).value).toBe(2.673); // CLF
    expect(r3.getCell(41).value).toBe(2.232); // MCC
    expect(r3.getCell(43).value).toBe(3.492); // NDFC

    // Row 4: Second row of invoice 00106522 -> empty
    const r4 = goc.getRow(4);
    expect(r4.getCell(2).value).toBe('00106522');
    expect(r4.getCell(25).value).toBe('');
    expect(r4.getCell(38).value).toBe('');

    // Row 10: First row of invoice 00106524 (second invoice in same trip!)
    const r10 = goc.getRow(10);
    expect(r10.getCell(2).value).toBe('00106524');
    expect((r10.getCell(25).value as any)?.formula).toBe('AL10');
    expect((r10.getCell(38).value as any)?.formula).toBe('SUBTOTAL(9,AM10:AR10)');
    expect(r10.getCell(39).value).toBe(2.673); // CLF
    expect(r10.getCell(41).value).toBe(2.232); // MCC
    expect(r10.getCell(43).value).toBe(3.492); // NDFC

    // Verify summary sheet MCC (tt)
    const tt = outWb.getWorksheet('MCC (tt)')!;
    expect(tt).toBeDefined();
    // In MCC (tt), row 3 is 00106522, row 4 is 00106524
    const ttR3 = tt.getRow(3);
    expect(ttR3.getCell(2).value).toBe('00106522');
    expect((ttR3.getCell(15).value as any)?.formula).toBe('AB3');
    expect((ttR3.getCell(28).value as any)?.formula).toBe('SUBTOTAL(9,AC3:AH3)');
    expect(ttR3.getCell(29).value).toBe(2.673); // CLF
    expect(ttR3.getCell(31).value).toBe(2.232); // MCC
    expect(ttR3.getCell(33).value).toBe(3.492); // NDFC

    const ttR4 = tt.getRow(4);
    expect(ttR4.getCell(2).value).toBe('00106524');
    expect((ttR4.getCell(15).value as any)?.formula).toBe('AB4');
    expect((ttR4.getCell(28).value as any)?.formula).toBe('SUBTOTAL(9,AC4:AH4)');
    expect(ttR4.getCell(29).value).toBe(2.673); // CLF
    expect(ttR4.getCell(31).value).toBe(2.232); // MCC
    expect(ttR4.getCell(33).value).toBe(3.492); // NDFC
  });

  it('converts Khung giá containing Pallet to Pallet with original note on summary sheets (clv, uni, tt) while preserving full bracket on goc sheet', async () => {
    mockPool.query.mockResolvedValue({ rows: [] } as never);

    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('Sheet1');
    const ws = wb.addWorksheet('Processed');
    const headers = [
      'Mã nhà cung cấp', 'Số hóa đơn', 'Ngày hóa đơn', 'Số tàu', 'Mã khách hàng',
      'Tên khách hàng', 'Địa chỉ giao hàng', 'Khung giá', 'Đơn vị tính', 'Mã hàng hóa',
      'Tên hàng hóa (Vie)', 'Tên hàng hóa (En)', 'Mã liên hệ giao hàng', 'Mã DVT',
      'Số lượng (DVT bán hàng)', 'SP Trọng lượng net', 'HĐ Trọng lượng (Net)', 'Round(MT)',
      'CLF', 'VFM', 'MCC', 'CLV', 'NDFC', '', '',
      'Tài xế', 'Thông tin bổ sung', 'Slot', 'Diễn giải', 'Channel',
      'SubChannel', 'SlotNo', 'user tạo HĐ', 'User tạo PXK', 'PO number',
      'Warehouse No', 'Warehouse Name', 'Phiếu XK', 'Chứng từ ghi sổ', 'Số seri',
      'Loại hàng', 'Tuyến cũ', 'Tuyến mới', 'Tuyến lên hóa đơn'
    ];
    ws.addRow(headers);

    // Invoice 1: MCC truck with pallet -> 10.0 tons -> '>8-16 tấn + Pallet'
    ws.addRow([
      '2000000007', 'HD_PALLET_MCC', '2026-07-01', '50E 12345', 'KH01',
      'CÔNG TY PALLET 1', 'ĐỊA CHỈ 1, TP.HCM', 'Pallet', 'Tấn', 'SP01',
      'Hàng A', 'Item A', '', 'CAR',
      10, 10, 10000, 10.0,
      0, 0, 10.0, 0, 0, '', '',
      'Tài xế A', '', 'CALOFIC HP', '', 'RETAIL',
      'PDS', '', '', '', '',
      '', '', '', '', '',
      '', '', '', ''
    ]);

    // Invoice 2: MCC truck non-pallet -> 12.0 tons -> '>8-16 tấn'
    ws.addRow([
      '2000000007', 'HD_NORMAL_MCC', '2026-07-01', '50E 99999', 'KH02',
      'CÔNG TY NORMAL', 'ĐỊA CHỈ 2, BÌNH DƯƠNG', '>8-16 tấn', 'Tấn', 'SP02',
      'Hàng B', 'Item B', '', 'CAR',
      20, 20, 12000, 12.0,
      0, 0, 12.0, 0, 0, '', '',
      'Tài xế B', '', 'CALOFIC HP', '', 'RETAIL',
      'PDS', '', '', '', '',
      '', '', '', '', '',
      '', '', '', ''
    ]);

    // Invoice 3: NDFC truck with pallet -> 18.0 tons -> '>16-23 tấn + Pallet'
    ws.addRow([
      '2000000008', 'HD_PALLET_NDFC', '2026-07-01', '50E 88888', 'KH03',
      'CÔNG TY PALLET 2', 'ĐỊA CHỈ 3, ĐỒNG NAI', 'Pallet', 'Tấn', 'SP03',
      'Hàng C', 'Item C', '', 'CAR',
      30, 30, 18000, 18.0,
      0, 0, 0, 0, 18.0, '', '',
      'Tài xế C', '', 'UNI 1', '', 'RETAIL',
      'PDS', '', '', '', '',
      '', '', '', '', '',
      '', '', '', ''
    ]);

    const inputBuf = Buffer.from(await wb.xlsx.writeBuffer());
    const res = await processNdMccWorkbook(inputBuf);

    const outWb = new ExcelJS.Workbook();
    await outWb.xlsx.load(res.buffer as any);

    // 1. Verify MCC (goc) maintains full bracket
    const mccGoc = outWb.getWorksheet('MCC (goc)')!;
    expect(mccGoc).toBeDefined();
    const gocR3 = mccGoc.getRow(3); // HD_PALLET_MCC (Truck 50E 77777)
    expect(gocR3.getCell(12).value).toBe('>8-16 tấn + Pallet'); // Col L (12)
    // Row 4 is trip total for 50E 77777
    expect(mccGoc.getRow(4).getCell(3).value).toBe('Tổng cộng');
    const gocR5 = mccGoc.getRow(5); // HD_NORMAL_MCC (Truck 50E 99999)
    expect(gocR5.getCell(12).value).toBe('>8-16 tấn');

    // 2. Verify MCC-clv summary sheet converts Pallet to 'Pallet' with note
    const mccClv = outWb.getWorksheet('MCC-clv')!;
    expect(mccClv).toBeDefined();
    const clvR3 = mccClv.getRow(3); // HD_PALLET_MCC
    expect(clvR3.getCell(2).value).toBe('HD_PALLET_MCC');
    expect(clvR3.getCell(11).value).toBe('Pallet'); // Col K (11)
    expect(clvR3.getCell(11).note).toBe('>8-16 tấn + Pallet');
    expect((clvR3.getCell(8).value as any)?.formula).toBe('F3&", ("&K3&"), xe "&D3');
    // Row 4 is trip total for 50E 77777
    expect(mccClv.getRow(4).getCell(3).value).toBe('Tổng cộng');

    const clvR5 = mccClv.getRow(5); // HD_NORMAL_MCC
    expect(clvR5.getCell(2).value).toBe('HD_NORMAL_MCC');
    expect(clvR5.getCell(11).value).toBe('>8-16 tấn');
    expect(clvR5.getCell(11).note).toBeUndefined();

    // 3. Verify NDFC (goc) maintains full bracket
    const ndfcGoc = outWb.getWorksheet('NDFC (goc)')!;
    expect(ndfcGoc).toBeDefined();
    const ndfcGocR3 = ndfcGoc.getRow(3);
    expect(ndfcGocR3.getCell(12).value).toBe('>16-23 tấn + Pallet');

    // 4. Verify NDFC (tt) summary sheet converts Pallet to 'Pallet' with note
    const ndfcTt = outWb.getWorksheet('NDFC (tt)')!;
    expect(ndfcTt).toBeDefined();
    const ttR3 = ndfcTt.getRow(3);
    expect(ttR3.getCell(2).value).toBe('HD_PALLET_NDFC');
    expect(ttR3.getCell(11).value).toBe('Pallet');
    expect(ttR3.getCell(11).note).toBe('>16-23 tấn + Pallet');
    expect((ttR3.getCell(8).value as any)?.formula).toBe('F3&", ("&K3&"), xe "&D3');
  });

  it('separates brackets <= 2.5 tons into Table B and > 2.5 tons into Table A on same sheet with 6 blank rows and correct totals', async () => {
    mockPool.query.mockResolvedValue({ rows: [] } as never);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Processed');
    const headers = [
      'Mã nhà cung cấp', 'Số hóa đơn', 'Ngày hóa đơn', 'Số tàu', 'Mã khách hàng',
      'Tên khách hàng', 'Địa chỉ giao hàng', 'Khung giá', 'Đơn vị tính', 'Mã hàng hóa',
      'Tên hàng hóa (Vie)', 'Tên hàng hóa (En)', 'Mã liên hệ giao hàng', 'Mã DVT',
      'Số lượng (DVT bán hàng)', 'SP Trọng lượng net', 'HĐ Trọng lượng (Net)', 'ROUND (MT)',
      'CLF', 'VFM', 'MCC', 'CLV', 'NDFC', 'Col1', 'Col2',
      'Tài xế', 'Thông tin bổ sung', 'Slot', 'Diễn giải', 'Channel',
      'SubChannel', 'SlotNo', 'user tạo HĐ', 'User tạo PXK', 'PO number',
      'Warehouse No', 'Warehouse Name', 'Phiếu XK', 'Chứng từ ghi sổ', 'Số seri',
      'Loại hàng', 'Tuyến cũ', 'Tuyến mới', 'Tuyến lên hóa đơn'
    ];
    ws.addRow(headers);

    // Trip 1 (Table A: >8-16 tấn): Truck 50E 11111 (CALOFIC HP -> MCC-clv)
    // Weight = 10.0 tons
    ws.addRow([
      '2000000007', 'HD_TRIP1', '2026-07-01', '50E 11111', 'KH01',
      'Khách A', 'Địa chỉ A', '>8-16 tấn', 'Tấn', 'SP01',
      'Bột', 'Flour', '', 'CAR',
      10, 10, 10000, 10.0,
      '', '', 10.0, '', '', 10.0, 10.0,
      'Tài xế 1', '', 'CALOFIC HP', '', 'RETAIL'
    ]);
    // Separator row for Trip 1
    ws.addRow([
      '', '', '', '', '',
      '', '', '', '', '',
      '', '', '', '',
      '', '', '', 10.0,
      '', '', 10.0, '', '', 10.0, 10.0,
      'Tài xế 1'
    ]);

    // Trip 2 (Table B: <= 2.5 tấn): Truck 50H 22222 (CALOFIC HP -> MCC-clv)
    // Weight = 1.5 tons
    ws.addRow([
      '2000000007', 'HD_TRIP2', '2026-07-02', '50H 22222', 'KH02',
      'Khách B', 'Địa chỉ B', '≤2.5 tấn', 'Chuyến', 'SP02',
      'Dầu', 'Oil', '', 'CAR',
      5, 10, 1500, 1.5,
      '', '', 1.5, '', '', 1.5, 1.5,
      'Tài xế 2', '', 'CALOFIC HP', '', 'ST'
    ]);
    // Separator row for Trip 2
    ws.addRow([
      '', '', '', '', '',
      '', '', '', '', '',
      '', '', '', '',
      '', '', '', 1.5,
      '', '', 1.5, '', '', 1.5, 1.5,
      'Tài xế 2'
    ]);

    const inputBuf = Buffer.from(await wb.xlsx.writeBuffer());
    const res = await processNdMccWorkbook(inputBuf);

    const outWb = new ExcelJS.Workbook();
    await outWb.xlsx.load(res.buffer as any);

    const mccClv = outWb.getWorksheet('MCC-clv')!;
    expect(mccClv).toBeDefined();

    // Table A:
    // Row 1: empty
    // Row 2: Header
    // Row 3: HD_TRIP1
    // Row 4: Trip total for 50E 11111 (C='Tổng cộng')
    // Row 5: TỔNG CỘNG A (E='TỔNG CỘNG A', M='=SUM(M3:M4)/2', N='=SUM(N3:N4)/2')
    expect(mccClv.getRow(3).getCell(2).value).toBe('HD_TRIP1');
    expect(mccClv.getRow(3).getCell(11).value).toBe('>8-16 tấn');
    expect(mccClv.getRow(4).getCell(3).value).toBe('Tổng cộng');
    expect(mccClv.getRow(5).getCell(5).value).toBe('TỔNG CỘNG A');
    expect((mccClv.getRow(5).getCell(13).value as any)?.formula).toBe('SUM(M3:M4)/2');

    // Gap: Rows 6..11 are empty (6 rows)
    for (let r = 6; r <= 11; r++) {
      expect(mccClv.getRow(r).getCell(1).value).toBeNull();
      expect(mccClv.getRow(r).getCell(5).value).toBeNull();
    }

    // Table B:
    // Row 12: Repeated Header
    expect(mccClv.getRow(12).getCell(1).value).toBe('Mã nhà cung cấp');
    expect(mccClv.getRow(12).getCell(11).value).toBe('Khung giá');

    // Row 13: HD_TRIP2 (≤2.5 tấn)
    expect(mccClv.getRow(13).getCell(2).value).toBe('HD_TRIP2');
    expect(mccClv.getRow(13).getCell(11).value).toBe('≤2.5 tấn');

    // Row 14: TỔNG CỘNG B (no intermediate truck total row, direct SUM)
    expect(mccClv.getRow(14).getCell(5).value).toBe('TỔNG CỘNG B');
    expect((mccClv.getRow(14).getCell(13).value as any)?.formula).toBe('SUM(M13:M13)');
    expect((mccClv.getRow(14).getCell(20).value as any)?.formula).toBe('SUM(T13:T13)');

    // Also verify MCC (goc) has the same two-table layout
    const mccGoc = outWb.getWorksheet('MCC (goc)')!;
    expect(mccGoc).toBeDefined();
    expect(mccGoc.getRow(3).getCell(2).value).toBe('HD_TRIP1');
    expect(mccGoc.getRow(4).getCell(3).value).toBe('Tổng cộng');
    expect(mccGoc.getRow(5).getCell(5).value).toBe('TỔNG CỘNG A');
    expect((mccGoc.getRow(5).getCell(23).value as any)?.formula).toBe('SUM(W3:W4)/2');

    // Repeated Header at Row 12
    expect(mccGoc.getRow(12).getCell(1).value).toBe('Mã nhà cung cấp');
    expect(mccGoc.getRow(13).getCell(2).value).toBe('HD_TRIP2');
    expect(mccGoc.getRow(14).getCell(5).value).toBe('TỔNG CỘNG B');
    expect((mccGoc.getRow(14).getCell(23).value as any)?.formula).toBe('SUM(W13:W13)');
  });
});

