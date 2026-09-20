import ExcelJS from 'exceljs';
import {
  parseCellToNumber,
  detectProcessedV2Columns,
  generateProcessedV2Sheet,
  determineKhungGia,
  NUM_FMT_QTY,
  NUM_FMT_WEIGHT,
  PROCESSED_SHEET_NAME,
  PROCESSED_V2_SHEET_NAME,
} from '../services/bangKeTho/processedV2';

describe('bangKeThoProcessedV2', () => {
  describe('parseCellToNumber', () => {
    it('returns numbers as-is', () => {
      expect(parseCellToNumber(1234)).toBe(1234);
      expect(parseCellToNumber(0)).toBe(0);
      expect(parseCellToNumber(45.678)).toBe(45.678);
    });

    it('returns null for empty, null, or undefined', () => {
      expect(parseCellToNumber(null)).toBeNull();
      expect(parseCellToNumber(undefined)).toBeNull();
      expect(parseCellToNumber('')).toBeNull();
      expect(parseCellToNumber('   ')).toBeNull();
    });

    it('parses formatted string numbers', () => {
      expect(parseCellToNumber('1,200')).toBe(1200);
      expect(parseCellToNumber('  500  ')).toBe(500);
      expect(parseCellToNumber('1,234,567')).toBe(1234567);
      expect(parseCellToNumber('12.345')).toBe(12.345);
      expect(parseCellToNumber('1,234.567')).toBe(1234.567);
      expect(parseCellToNumber('1.234,567')).toBe(1234.567);
      expect(parseCellToNumber('12,5')).toBe(12.5);
    });

    it('handles formula result objects', () => {
      expect(parseCellToNumber({ formula: 'A1*2', result: '3500' })).toBe(3500);
      expect(parseCellToNumber({ formula: 'A1*2', result: 4200 })).toBe(4200);
    });

    it('returns null for non-numeric strings', () => {
      expect(parseCellToNumber('chưa có')).toBeNull();
      expect(parseCellToNumber('N/A')).toBeNull();
    });
  });

  describe('detectProcessedV2Columns', () => {
    it('detects columns from header text', () => {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Processed');
      ws.addRow([
        'Cột 1', 'Cột 2', 'Cột 3', 'Cột 4', 'Cột 5',
        'Cột 6', 'Cột 7', 'Cột 8', 'Cột 9', 'Cột 10',
        'Cột 11', 'Cột 12', 'Cột 13', 'Cột 14',
        'Số lượng (DVT bán hàng)', 'SP Trọng lượng net', 'HĐ Trọng lượng (Net)', 'Cột 18'
      ]);

      const cols = detectProcessedV2Columns(ws);
      expect(cols.colO).toBe(15);
      expect(cols.colP).toBe(16);
      expect(cols.colQ).toBe(17);
      expect(cols.headerRowIdx).toBe(1);
    });

    it('falls back to columns 15, 16, 17 if headers are different', () => {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Processed');
      const cols = detectProcessedV2Columns(ws);
      expect(cols.colO).toBe(15);
      expect(cols.colP).toBe(16);
      expect(cols.colQ).toBe(17);
    });
  });

  describe('generateProcessedV2Sheet', () => {
    it('throws error if Processed sheet is missing', () => {
      const wb = new ExcelJS.Workbook();
      expect(() => generateProcessedV2Sheet(wb)).toThrow('MISSING_PROCESSED_SHEET');
    });

    it('duplicates Processed to Processed v2 and converts text numbers in O, P, Q', () => {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet(PROCESSED_SHEET_NAME);
      ws.getColumn(15).width = 18;
      ws.getColumn(16).width = 20;
      ws.getColumn(17).width = 22;

      // Header row
      ws.addRow([
        'Mã NCC', 'Số HĐ', 'Ngày HĐ', 'Số tàu', 'Mã KH',
        'Tên KH', 'Địa chỉ', 'Khung giá', 'ĐVT', 'Mã HH',
        'Tên HH Vie', 'Tên HH En', 'Mã LH', 'Mã DVT',
        'Số lượng (DVT bán hàng)', 'SP Trọng lượng net', 'HĐ Trọng lượng (Net)', 'Round(MT)',
      ]);

      // Data row with text formatted numbers in O, P, Q
      ws.addRow([
        '2000000007', 'HD001', '2026-07-01', '51C 12345', 'KH01',
        'ABC', 'HCM', '>8-16 tấn', 'Tấn', 'SP01',
        'Bột', 'Flour', '', 'CAR',
        '1,200', '12,500.25', '12,500.25', '12.5'
      ]);

      // Second data row with empty cells in O, P, Q
      ws.addRow([
        '2000000008', 'HD002', '2026-07-02', '51C 67890', 'KH02',
        'XYZ', 'HN', '>8-16 tấn', 'Tấn', 'SP02',
        'Gạo', 'Rice', '', 'BAG',
        '', '', '', ''
      ]);

      const v2Ws = generateProcessedV2Sheet(wb);

      expect(v2Ws.name).toBe(PROCESSED_V2_SHEET_NAME);
      expect(wb.getWorksheet(PROCESSED_V2_SHEET_NAME)).toBeDefined();

      // Check column widths copied
      expect(v2Ws.getColumn(15).width).toBe(18);
      expect(v2Ws.getColumn(16).width).toBe(20);
      expect(v2Ws.getColumn(17).width).toBe(22);

      // Check header values untouched
      expect(v2Ws.getRow(1).getCell(15).value).toBe('Số lượng (DVT bán hàng)');
      expect(v2Ws.getRow(1).getCell(16).value).toBe('SP Trọng lượng net');
      expect(v2Ws.getRow(1).getCell(17).value).toBe('HĐ Trọng lượng (Net)');

      // Check row 2 converted to numeric types
      const row2 = v2Ws.getRow(2);
      expect(row2.getCell(15).value).toBe(1200);
      expect(typeof row2.getCell(15).value).toBe('number');
      expect(row2.getCell(15).numFmt).toBe(NUM_FMT_QTY);

      expect(row2.getCell(16).value).toBe(12500.25);
      expect(typeof row2.getCell(16).value).toBe('number');
      expect(row2.getCell(16).numFmt).toBe(NUM_FMT_WEIGHT);

      expect(row2.getCell(17).value).toBe(12500.25);
      expect(typeof row2.getCell(17).value).toBe('number');
      expect(row2.getCell(17).numFmt).toBe(NUM_FMT_WEIGHT);

      // Check non-target columns in row 2
      expect(row2.getCell(1).value).toBe('2000000007');
      expect(row2.getCell(2).value).toBe('HD001');

      // Check row 3 with empty cells stays empty
      const row3 = v2Ws.getRow(3);
      expect(row3.getCell(15).value).toBeFalsy();
      expect(row3.getCell(16).value).toBeFalsy();
      expect(row3.getCell(17).value).toBeFalsy();
    });

    it('rearranges columns with 5 nhà before CLF, inserts Gạo after NDFC, and formats them', () => {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet(PROCESSED_SHEET_NAME);

      // Header row (simulating raw Processed sheet with 44 columns)
      const headers = [
        'Mã NCC', 'Số HĐ', 'Ngày HĐ', 'Số tàu', 'Mã KH',
        'Tên KH', 'Địa chỉ', 'Khung giá', 'ĐVT', 'Mã HH',
        'Tên HH Vie', 'Tên HH En', 'Mã LH', 'Mã DVT',
        'Số lượng (DVT bán hàng)', 'SP Trọng lượng net', 'HĐ Trọng lượng (Net)', 'Round(MT)',
        'CLF', 'VFM', 'MCC', 'CLV', 'NDFC',
        '', '', // Col 24 (cũ X), Col 25 (cũ Y)
        'Tài xế', 'Thông tin bổ sung', 'Slot',
      ];
      ws.addRow(headers);

      // Data row 2
      const dataRow = [
        '2000000007', '00117186', '15/07/2026', '49H 01936', 'KH01',
        'Ngọc Trương', 'Đà Lạt', '≤2.5 tấn', 'Chuyến', 'SP01',
        'Bột', 'Flour', '', 'CAR',
        '18', '7.2', '129.6', '0.130',
        '10.5', '', '2.5', '', '0.789', // CLF, VFM, MCC, CLV, NDFC (col 19..23)
        '13.789', '13.789', // Col 24 (cũ X - 5 nhà), Col 25 (cũ Y)
        'PPH-G', 'UN1857', 'UNI 1', // Tài xế (26), Thông tin bổ sung (27), Slot (28)
      ];
      ws.addRow(dataRow);

      const v2Ws = generateProcessedV2Sheet(wb);

      // Check header names in Processed v2
      expect(v2Ws.getRow(1).getCell(18).value).toBe('Round(MT)');
      expect(v2Ws.getRow(1).getCell(19).value).toBe('5 nhà');
      expect(v2Ws.getRow(1).getCell(20).value).toBe('CLF');
      expect(v2Ws.getRow(1).getCell(21).value).toBe('VFM');
      expect(v2Ws.getRow(1).getCell(22).value).toBe('MCC');
      expect(v2Ws.getRow(1).getCell(23).value).toBe('CLV');
      expect(v2Ws.getRow(1).getCell(24).value).toBe('NDFC');
      expect(v2Ws.getRow(1).getCell(25).value).toBe('Gạo');
      expect(v2Ws.getRow(1).getCell(26).value).toBe('Tài xế');
      expect(v2Ws.getRow(1).getCell(27).value).toBe('Thông tin bổ sung');
      expect(v2Ws.getRow(1).getCell(28).value).toBe('Slot');

      // Check data row values and format in Processed v2
      const row2 = v2Ws.getRow(2);

      // Col 18: Round(MT)
      expect(row2.getCell(18).value).toBe(0.13);
      expect(row2.getCell(18).numFmt).toBe(NUM_FMT_WEIGHT);

      // Col 19: 5 nhà (from old col 24 = 13.789)
      expect(row2.getCell(19).value).toBe(13.789);
      expect(row2.getCell(19).numFmt).toBe(NUM_FMT_WEIGHT);

      // Col 20: CLF (from old col 19 = 10.5)
      expect(row2.getCell(20).value).toBe(10.5);
      expect(row2.getCell(20).numFmt).toBe(NUM_FMT_WEIGHT);

      // Col 21: VFM (empty)
      expect(row2.getCell(21).value).toBe('');
      expect(row2.getCell(21).numFmt).toBe(NUM_FMT_WEIGHT);

      // Col 22: MCC (from old col 21 = 2.5)
      expect(row2.getCell(22).value).toBe(2.5);
      expect(row2.getCell(22).numFmt).toBe(NUM_FMT_WEIGHT);

      // Col 23: CLV (empty)
      expect(row2.getCell(23).value).toBe('');
      expect(row2.getCell(23).numFmt).toBe(NUM_FMT_WEIGHT);

      // Col 24: NDFC (from old col 23 = 0.789)
      expect(row2.getCell(24).value).toBe(0.789);
      expect(row2.getCell(24).numFmt).toBe(NUM_FMT_WEIGHT);

      // Col 25: Gạo (new, empty, formatted)
      expect(row2.getCell(25).value).toBe('');
      expect(row2.getCell(25).numFmt).toBe(NUM_FMT_WEIGHT);

      // Col 26: Tài xế (from old col 26 = PPH-G)
      expect(row2.getCell(26).value).toBe('PPH-G');

      // Col 27: Thông tin bổ sung
      expect(row2.getCell(27).value).toBe('UN1857');

      // Col 28: Slot
      expect(row2.getCell(28).value).toBe('UNI 1');

      // Check header "5 nhà" (col 19) is green with white bold text
      const header5Nha = v2Ws.getRow(1).getCell(19);
      expect(header5Nha.value).toBe('5 nhà');
      expect((header5Nha.fill as any).fgColor?.argb).toBe('FF00B050');
      expect(header5Nha.font?.bold).toBe(true);
      expect((header5Nha.font?.color as any)?.argb).toBe('FFFFFFFF');
    });

    it('sets green header style matching CLF on "5 nhà" header', () => {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet(PROCESSED_SHEET_NAME);
      const headerRow = ws.addRow([
        'Mã NCC', 'Số HĐ', 'Ngày HĐ', 'Số tàu', 'Mã KH',
        'Tên KH', 'Địa chỉ', 'Khung giá', 'ĐVT', 'Mã HH',
        'Tên HH Vie', 'Tên HH En', 'Mã LH', 'Mã DVT',
        'Số lượng', 'SP Net', 'HD Net', 'Round(MT)',
        'CLF', 'VFM', 'MCC', 'CLV', 'NDFC',
        'Col1', 'Col2', 'Tài xế'
      ]);

      // Set CLF header style
      const clfCell = headerRow.getCell(19);
      clfCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF00B050' },
      };
      clfCell.font = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
      clfCell.alignment = { horizontal: 'center', vertical: 'middle' };

      // Set Col1 (old 5 nhà) to yellow style
      const col1Cell = headerRow.getCell(24);
      col1Cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFFF00' },
      };

      const v2Ws = generateProcessedV2Sheet(wb);
      const v2Header5Nha = v2Ws.getRow(1).getCell(19);
      const v2HeaderClf = v2Ws.getRow(1).getCell(20);

      expect(v2Header5Nha.value).toBe('5 nhà');
      expect((v2Header5Nha.fill as any).fgColor?.argb).toBe('FF00B050');
      expect(v2Header5Nha.font?.bold).toBe(true);
      expect((v2Header5Nha.font?.color as any)?.argb).toBe('FFFFFFFF');
      expect(v2Header5Nha.alignment?.horizontal).toBe('center');
      expect(v2Header5Nha.alignment?.vertical).toBe('middle');
      expect(v2Header5Nha.style).toEqual(v2HeaderClf.style);
    });

    it('updates Khung giá based on trip subtotal in column 5 nhà, highlights changed cells and sets notes with original value', () => {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet(PROCESSED_SHEET_NAME);

      // Header row
      ws.addRow([
        'Mã NCC', 'Số HĐ', 'Ngày HĐ', 'Số tàu', 'Mã KH',
        'Tên KH', 'Địa chỉ', 'Khung giá', 'ĐVT', 'Mã HH',
        'Tên HH Vie', 'Tên HH En', 'Mã LH', 'Mã DVT',
        'Số lượng', 'SP Net', 'HD Net', 'Round(MT)',
        'CLF', 'VFM', 'MCC', 'CLV', 'NDFC',
        'Col1', 'Col2', 'Tài xế'
      ]);

      // Trip 1 (rows 2, 3): Truck 51C-12345, weight total in separator row is 12.5 (>8-16 tấn).
      // Row 2 has old Khung giá '≤2.5 tấn' (changed -> should highlight & note)
      // Row 3 has old Khung giá '>8-16 tấn' (unchanged -> no highlight, no note)
      ws.addRow([
        '2000000007', 'HD001', '2026-07-01', '51C-12345', 'KH01',
        'Khách A', 'HCM', '≤2.5 tấn', 'Tấn', 'SP01',
        'Bột', 'Flour', '', 'CAR',
        '100', '5000', '5000', '5.0',
        '5.0', '', '', '', '',
        '', '', 'Tài Xế 1'
      ]);
      ws.addRow([
        '2000000007', 'HD002', '2026-07-01', '51C-12345', 'KH01',
        'Khách A', 'HCM', '>8-16 tấn', 'Tấn', 'SP02',
        'Bột 2', 'Flour 2', '', 'CAR',
        '150', '7500', '7500', '7.5',
        '7.5', '', '', '', '',
        '', '', 'Tài Xế 1'
      ]);
      // Separator row for Trip 1 (row 4): empty NCC/HD/truck, Col 24 (5 nhà) = 12.5
      ws.addRow([
        '', '', '', '', '',
        '', '', '', '', '',
        '', '', '', '',
        '', '', '', '12.5',
        '12.5', '', '', '', '',
        '12.5', '12.5', ''
      ]);

      // Trip 2 (row 5): Pallet Truck PPH-P 099, weight total in separator row is 18.0 (>16-23 tấn + Pallet).
      // Old Khung giá was 'Pallet' -> changed to '>16-23 tấn + Pallet'
      ws.addRow([
        '2000000008', 'HD003', '2026-07-02', 'PPH-P 099', 'KH02',
        'Khách B', 'Bình Dương', 'Pallet', 'Tấn', 'SP03',
        'Gạo', 'Rice', '', 'BAG',
        '360', '18000', '18000', '18.0',
        '', '', '', '', '18.0',
        '', '', 'Tài Xế 2'
      ]);
      // Separator row for Trip 2 (row 6):
      ws.addRow([
        '', '', '', '', '',
        '', '', '', '', '',
        '', '', '', '',
        '', '', '', '18.0',
        '', '', '', '', '18.0',
        '18.0', '18.0', ''
      ]);

      // Trip 3 (row 7): Truck 51D-99999, without separator row (e.g. last group), Col 24 (Col1) = 5.0 (>2.5-8 tấn)
      // Old Khung giá was '>8-16 tấn' -> changed to '>2.5-8 tấn'
      ws.addRow([
        '2000000007', 'HD004', '2026-07-03', '51D-99999', 'KH03',
        'Khách C', 'Đồng Nai', '>8-16 tấn', 'Tấn', 'SP04',
        'Bột', 'Flour', '', 'CAR',
        '100', '5000', '5000', '5.0',
        '5.0', '', '', '', '',
        '5.0', '5.0', 'Tài Xế 3'
      ]);

      const v2Ws = generateProcessedV2Sheet(wb);

      // Verify Trip 1 (Rows 2, 3)
      const r2KhungGia = v2Ws.getRow(2).getCell(8);
      expect(r2KhungGia.value).toBe('>8-16 tấn');
      expect((r2KhungGia.fill as any)?.fgColor?.argb).toBe('FFFFE599');
      expect(r2KhungGia.note).toBe('≤2.5 tấn');

      const r3KhungGia = v2Ws.getRow(3).getCell(8);
      expect(r3KhungGia.value).toBe('>8-16 tấn');
      // Did not change from original '>8-16 tấn', so no yellow highlight
      expect((r3KhungGia.fill as any)?.fgColor?.argb).not.toBe('FFFFE599');
      expect(r3KhungGia.note).toBeFalsy();

      // Separator row 4 should not have Khung giá
      expect(v2Ws.getRow(4).getCell(8).value).toBeFalsy();

      // Verify Trip 2 (Row 5 - Pallet)
      const r5KhungGia = v2Ws.getRow(5).getCell(8);
      expect(r5KhungGia.value).toBe('>16-23 tấn + Pallet');
      expect((r5KhungGia.fill as any)?.fgColor?.argb).toBe('FFFFE599');
      expect(r5KhungGia.note).toBe('Pallet');

      // Verify Trip 3 (Row 7 - Fallback without separator row)
      const r7KhungGia = v2Ws.getRow(7).getCell(8);
      expect(r7KhungGia.value).toBe('>2.5-8 tấn');
      expect((r7KhungGia.fill as any)?.fgColor?.argb).toBe('FFFFE599');
      expect(r7KhungGia.note).toBe('>8-16 tấn');
    });

    it('updates Khung giá correctly for multi-truck combined trips under common separator row', () => {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet(PROCESSED_SHEET_NAME);
      ws.addRow([
        'Mã NCC', 'Số HĐ', 'Ngày HĐ', 'Số tàu', 'Mã KH',
        'Tên KH', 'Địa chỉ', 'Khung giá', 'ĐVT', 'Mã HH',
        'Tên HH Vie', 'Tên HH En', 'Mã LH', 'Mã DVT',
        'Số lượng', 'SP Net', 'HD Net', 'Round(MT)',
        'CLF', 'VFM', 'MCC', 'CLV', 'NDFC',
        'Col1', 'Col2', 'Tài xế'
      ]);

      // Row 2: Truck 79C 06181 (invoice 00113175), old Khung giá '>8-16 tấn'
      ws.addRow([
        '2000000008', '00113175', '2026-07-09', '79C 06181', 'KH01',
        'Khách A', 'Nha Trang', '>8-16 tấn', 'Tấn', 'SP01',
        'Tương ớt', 'Chili', '', 'CAR',
        '100', '12483', '12483', '12.483',
        '', '', '', '', '12.483',
        '12.483', '16.231', 'Tài Xế A'
      ]);

      // Row 3: Truck PPH-G-ND (transshipment truck in same trip), old Khung giá '>8-16 tấn'
      ws.addRow([
        '2000000007', '00113288', '2026-07-09', 'PPH-G-ND', 'KH02',
        'Khách B', 'Cam Ranh', '>8-16 tấn', 'Tấn', 'SP02',
        'Bột', 'Flour', '', 'CAR',
        '50', '3748', '3748', '3.748',
        '', '', '3.748', '', '',
        '3.748', '16.231', 'Tài Xế B'
      ]);

      // Row 4: Separator row for the whole trip (12.483 + 3.748 = 16.231)
      ws.addRow([
        '', '', '', '', '',
        '', '', '', '', '',
        '', '', '', '',
        '', '', '', '16.231',
        '', '', '3.748', '', '12.483',
        '16.231', '16.231', ''
      ]);

      const v2Ws = generateProcessedV2Sheet(wb);

      // Both Row 2 and Row 3 must be updated to '>16-23 tấn' based on separator row 16.231
      const r2Kg = v2Ws.getRow(2).getCell(8);
      expect(r2Kg.value).toBe('>16-23 tấn');
      expect((r2Kg.fill as any)?.fgColor?.argb).toBe('FFFFE599');
      expect(r2Kg.note).toBe('>8-16 tấn');

      const r3Kg = v2Ws.getRow(3).getCell(8);
      expect(r3Kg.value).toBe('>16-23 tấn');
      expect((r3Kg.fill as any)?.fgColor?.argb).toBe('FFFFE599');
      expect(r3Kg.note).toBe('>8-16 tấn');
    });

    it('corrects undercounted 5 nhà column at separator row using sum of houses and roundMt (case 00115657)', () => {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet(PROCESSED_SHEET_NAME);
      ws.addRow([
        'Mã NCC', 'Số HĐ', 'Ngày HĐ', 'Số tàu', 'Mã KH',
        'Tên KH', 'Địa chỉ', 'Khung giá', 'ĐVT', 'Mã HH',
        'Tên HH Vie', 'Tên HH En', 'Mã LH', 'Mã DVT',
        'Số lượng', 'SP Net', 'HD Net', 'Round(MT)',
        'CLF', 'VFM', 'MCC', 'CLV', 'NDFC',
        'Col1', 'Col2', 'Tài xế'
      ]);

      // Row 2: NDFC invoice 00115657, original KG '>8-16 tấn'
      ws.addRow([
        '2000000008', '00115657', '2026-07-14', '50E 40746', 'KH01',
        'Khách NDFC', 'HCM', '>8-16 tấn', 'Tấn', 'SP01',
        'Hàng 1', 'Item 1', '', 'CAR',
        '100', '13467', '13467', '13.467',
        '', '', '', '', '13.467',
        '13.467', '17.461', 'Tài Xế A'
      ]);

      // Row 3: MCC invoice 00115733, original KG '>8-16 tấn'
      ws.addRow([
        '2000000007', '00115733', '2026-07-14', '50E 40746', 'KH02',
        'Khách MCC', 'HCM', '>8-16 tấn', 'Tấn', 'SP02',
        'Hàng 2', 'Item 2', '', 'CAR',
        '50', '3994', '3994', '3.994',
        '', '', '3.994', '', '',
        '3.994', '17.461', 'Tài Xế A'
      ]);

      // Row 4: Separator row where Col 24 in raw file only had 3.994 (undercounted), but Round(MT)=17.461, MCC=3.994, NDFC=13.467
      ws.addRow([
        '', '', '', '', '',
        '', '', '', '', '',
        '', '', '', '',
        '', '', '', '17.461',
        '', '', '3.994', '', '13.467',
        '3.994', '17.461', ''
      ]);

      const v2Ws = generateProcessedV2Sheet(wb);

      // Separator row (Row 4): Col 19 (5 nhà) must be corrected to 17.461
      const sep5Nha = v2Ws.getRow(4).getCell(19);
      expect(sep5Nha.value).toBe(17.461);

      // Row 2 and Row 3 Khung giá must be updated to '>16-23 tấn' based on true 17.461
      const r2Kg = v2Ws.getRow(2).getCell(8);
      expect(r2Kg.value).toBe('>16-23 tấn');
      expect((r2Kg.fill as any)?.fgColor?.argb).toBe('FFFFE599');
      expect(r2Kg.note).toBe('>8-16 tấn');

      const r3Kg = v2Ws.getRow(3).getCell(8);
      expect(r3Kg.value).toBe('>16-23 tấn');
      expect((r3Kg.fill as any)?.fgColor?.argb).toBe('FFFFE599');
      expect(r3Kg.note).toBe('>8-16 tấn');
    });

    it('safely handles shared formulas when saving workbook (regression U508)', async () => {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet(PROCESSED_SHEET_NAME);
      ws.addRow([
        'Mã NCC', 'Số HĐ', 'Ngày HĐ', 'Số tàu', 'Mã KH',
        'Tên KH', 'Địa chỉ', 'Khung giá', 'ĐVT', 'Mã HH',
        'Tên HH Vie', 'Tên HH En', 'Mã LH', 'Mã DVT',
        'Số lượng', 'SP Net', 'HĐ Net', 'Round(MT)',
        'CLF', 'VFM', 'MCC', 'CLV', 'NDFC', '5 nhà'
      ]);
      ws.addRow([
        '2000000007', 'HD1', '2026-07-01', '51C', 'KH1',
        'A', 'B', '1', 'Tấn', 'H1',
        'V', 'E', 'L', 'D',
        '10', '1', '1', '1',
        1, 0, 0, 0, 0, 1
      ]);
      ws.addRow([
        '', '', '', '', '',
        '', '', '', '', '',
        '', '', '', '',
        '', '', '', 1,
        '', '', '', '', '', 1
      ]);
      ws.getCell('S3').value = { formula: 'SUM(S2:S2)', result: 1, shareType: 'shared', ref: 'S3:W3' } as any;
      ws.getCell('T3').value = { sharedFormula: 'S3' } as any;
      ws.getCell('U3').value = { sharedFormula: 'S3', result: 0 } as any;
      ws.getCell('V3').value = { sharedFormula: 'S3' } as any;
      ws.getCell('W3').value = { sharedFormula: 'S3' } as any;

      const v2Ws = generateProcessedV2Sheet(wb);
      expect(v2Ws).toBeDefined();

      // Serialization to buffer must not throw "Shared Formula master must exist above and or left of clone"
      await expect(wb.xlsx.writeBuffer()).resolves.toBeDefined();
    });
  });

  describe('determineKhungGia', () => {
    it('returns correct bracket for non-pallet weights', () => {
      expect(determineKhungGia(1.5, false)).toBe('≤2.5 tấn');
      expect(determineKhungGia(2.5, false)).toBe('≤2.5 tấn');
      expect(determineKhungGia(2.51, false)).toBe('>2.5-8 tấn');
      expect(determineKhungGia(8.0, false)).toBe('>2.5-8 tấn');
      expect(determineKhungGia(8.01, false)).toBe('>8-16 tấn');
      expect(determineKhungGia(16.0, false)).toBe('>8-16 tấn');
      expect(determineKhungGia(16.01, false)).toBe('>16-23 tấn');
      expect(determineKhungGia(23.0, false)).toBe('>16-23 tấn');
      expect(determineKhungGia(23.5, false)).toBe('>23 tấn');
    });

    it('suffixes + Pallet for pallet trips', () => {
      expect(determineKhungGia(2.0, true)).toBe('≤2.5 tấn + Pallet');
      expect(determineKhungGia(5.0, true)).toBe('>2.5-8 tấn + Pallet');
      expect(determineKhungGia(12.0, true)).toBe('>8-16 tấn + Pallet');
      expect(determineKhungGia(20.0, true)).toBe('>16-23 tấn + Pallet');
      expect(determineKhungGia(25.0, true)).toBe('>23 tấn + Pallet');
    });
  });
});

