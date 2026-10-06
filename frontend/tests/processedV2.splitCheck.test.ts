import assert from 'node:assert/strict';
import test from 'node:test';
import ExcelJS from 'exceljs';
import { generateProcessedV2Sheet } from '../src/utils/processedV2.ts';

const HEADERS = [
  'Mã nhà cung cấp',
  'Số hóa đơn',
  'Ngày hóa đơn',
  'Số tàu',
  'Mã khách hàng',
  'Tên khách hàng',
  'Địa chỉ giao hàng',
  'Khung giá',
  'Đơn vị tính',
  'Mã hàng hóa',
  'Tên hàng hóa (Vie)',
  'Tên hàng hóa (En)',
  'Mã liên hệ giao hàng',
  'Mã DVT',
  'Số lượng (DVT bán hàng)',
  'SP Trọng lượng net',
  'HĐ Trọng lượng (Net)',
  'Round(MT)',
  'CLF',
  'VFM',
  'MCC',
  'CLV',
  'NDFC',
  '',
  '',
  'Tài xế',
];

function noteText(note: ExcelJS.Cell['note']): string {
  if (!note) return '';
  if (typeof note === 'string') return note;
  return (note.texts || []).map((part) => part.text || '').join('');
}

function fillArgb(cell: ExcelJS.Cell): string {
  const fill = cell.fill;
  if (!fill || fill.type !== 'pattern') return '';
  return fill.fgColor?.argb || '';
}

function addProcessed(wb: ExcelJS.Workbook, rows: (string | number | null)[][]): ExcelJS.Worksheet {
  const sheet = wb.addWorksheet('Processed');
  sheet.addRow(HEADERS);
  for (const row of rows) {
    const excelRow = sheet.addRow([]);
    row.forEach((value, index) => {
      if (value !== null && value !== undefined && value !== '') {
        excelRow.getCell(index + 1).value = value;
      }
    });
  }
  return sheet;
}

function dataRow(partial: {
  ncc?: string;
  hd?: string;
  ngay?: string;
  xe?: string;
  khung?: string;
  dvt?: string;
  round?: number;
  trip?: number;
}): (string | number | null)[] {
  const row: (string | number | null)[] = Array(26).fill(null);
  row[0] = partial.ncc ?? '2000000007';
  row[1] = partial.hd ?? '';
  row[2] = partial.ngay ?? '';
  row[3] = partial.xe ?? '';
  row[7] = partial.khung ?? '';
  row[8] = partial.dvt ?? '';
  row[17] = partial.round ?? null;
  if (partial.trip !== undefined) row[23] = partial.trip;
  return row;
}

function separator(weight: number): (string | number | null)[] {
  const row: (string | number | null)[] = Array(26).fill(null);
  row[17] = weight;
  row[23] = weight;
  row[24] = weight;
  return row;
}

test('keeps the 2.5-8 band and flags a light trip beside a heavier same-day truck', async () => {
  const wb = new ExcelJS.Workbook();
  addProcessed(wb, [
    dataRow({ hd: '00112086', ngay: '08/07/2026', xe: '50E 40746', khung: '>8-16 tấn', dvt: 'Tấn', round: 3.681, trip: 3.981 }),
    dataRow({ hd: '00112087', ngay: '08/07/2026', xe: '50E 40746', khung: '>8-16 tấn', dvt: 'Tấn', round: 0.3 }),
    separator(3.981),
    dataRow({ hd: '00112221', ngay: '08/07/2026', xe: '50E 40746', khung: '≤2.5 tấn', dvt: 'Chuyến', round: 0.3, trip: 0.3 }),
    separator(0.3),
    dataRow({ hd: '2606300054', ngay: '01/07/2026', xe: '50E 40746', khung: '>8-16 tấn', dvt: 'Tấn', round: 13.5, trip: 13.5 }),
    separator(13.5),
  ]);
  wb.getWorksheet('Processed')!.views = [{
    state: 'frozen',
    ySplit: 1,
    topLeftCell: 'A2',
    activeCell: 'A2',
    rightToLeft: false,
    showRuler: true,
    showRowColHeaders: true,
    showGridLines: true,
    zoomScale: 100,
    zoomScaleNormal: 100,
  }];

  const v2 = generateProcessedV2Sheet(wb);

  assert.equal(v2.getRow(1).getCell(1).value, 'Cần kiểm tra tách chuyến: 00112221');
  assert.equal(v2.getRow(1).getCell(1).font?.bold, true);
  assert.equal(fillArgb(v2.getRow(1).getCell(1)), 'FFF8CBAD');
  assert.equal(v2.getRow(2).getCell(19).value, '5 nhà');
  assert.equal(v2.views[0]?.state, 'frozen');
  if (v2.views[0]?.state === 'frozen') {
    assert.equal(v2.views[0].ySplit, 2);
    assert.equal(v2.views[0].topLeftCell, 'A3');
  }

  const heavy = v2.getRow(3).getCell(8);
  assert.equal(heavy.value, '>8-16 tấn');
  assert.notEqual(fillArgb(heavy), 'FFFFE599');
  assert.equal(noteText(heavy.note), '');

  const light = v2.getRow(6).getCell(8);
  assert.equal(light.value, '≤2.5 tấn');
  assert.equal(v2.getRow(6).getCell(9).value, 'Chuyến');
  assert.equal(fillArgb(light), 'FFF8CBAD');
  assert.equal(
    noteText(light.note),
    'Cần kiểm tra tách chuyến. Xe 50E 40746 ngày 08/07/2026, phía trên 3,981 tấn, khung >8-16 tấn.',
  );
});

test('lists both invoices and both neighboring trips', async () => {
  const wb = new ExcelJS.Workbook();
  addProcessed(wb, [
    dataRow({ hd: '00110921', ngay: '07/07/2026', xe: '50E 32401', khung: '>8-16 tấn', dvt: 'Tấn', round: 9.399, trip: 9.399 }),
    separator(9.399),
    dataRow({ hd: '00110910', ngay: '07/07/2026', xe: '50E 32401', khung: '≤2.5 tấn', dvt: 'Chuyến', round: 0.2, trip: 0.45 }),
    dataRow({ hd: '00110913', ngay: '07/07/2026', xe: '50E 32401', khung: '≤2.5 tấn', dvt: 'Chuyến', round: 0.25 }),
    separator(0.45),
    dataRow({ hd: '00014502', ngay: '07/07/2026', xe: '50E 32401', khung: 'Pallet', dvt: 'Tấn', round: 11.552, trip: 11.552 }),
    separator(11.552),
  ]);

  const v2 = generateProcessedV2Sheet(wb);
  assert.equal(v2.getRow(1).getCell(1).value, 'Cần kiểm tra tách chuyến: 00110910, 00110913');
  const note = noteText(v2.getRow(5).getCell(8).note);
  assert.match(note, /phía trên 9,399 tấn, khung >8-16 tấn/);
  assert.match(note, /phía dưới 11,552 tấn, khung Pallet/);
  assert.equal(fillArgb(v2.getRow(6).getCell(8)), 'FFF8CBAD');
  assert.equal(v2.getRow(8).getCell(8).value, 'Pallet');
  assert.notEqual(fillArgb(v2.getRow(8).getCell(8)), 'FFF8CBAD');
});

test('does not flag a pallet trip or a different day, and still rewrites other bands', async () => {
  const wb = new ExcelJS.Workbook();
  addProcessed(wb, [
    dataRow({ hd: 'P1', ngay: '02/07/2026', xe: '51D 11111', khung: 'Pallet', dvt: 'Tấn', round: 0.4, trip: 0.4 }),
    separator(0.4),
    dataRow({ hd: 'H1', ngay: '02/07/2026', xe: '51D 11111', khung: '>8-16 tấn', dvt: 'Tấn', round: 9, trip: 9 }),
    separator(9),
    dataRow({ hd: 'L1', ngay: '03/07/2026', xe: '51D 11111', khung: '≤2.5 tấn', dvt: 'Chuyến', round: 1, trip: 1 }),
    separator(1),
    dataRow({ hd: 'B1', ngay: '04/07/2026', xe: '60A 22222', khung: '>8-16 tấn', dvt: 'Tấn', round: 20, trip: 20 }),
    separator(20),
  ]);

  const v2 = generateProcessedV2Sheet(wb);
  assert.equal(v2.getRow(1).getCell(1).value, 'Cần kiểm tra tách chuyến: không có');
  assert.equal(v2.getRow(3).getCell(8).value, 'Pallet');
  assert.notEqual(fillArgb(v2.getRow(3).getCell(8)), 'FFF8CBAD');
  assert.equal(v2.getRow(7).getCell(8).value, '≤2.5 tấn');
  assert.notEqual(fillArgb(v2.getRow(7).getCell(8)), 'FFF8CBAD');
  assert.equal(v2.getRow(9).getCell(8).value, '>16-23 tấn');
  assert.equal(fillArgb(v2.getRow(9).getCell(8)), 'FFFFE599');
  assert.equal(noteText(v2.getRow(9).getCell(8).note), '>8-16 tấn');
});

test('keeps the source khung on a warned block even when its weight is in another band', async () => {
  const wb = new ExcelJS.Workbook();
  addProcessed(wb, [
    dataRow({ hd: 'A1', ngay: '05/07/2026', xe: '29H 33333', khung: '>8-16 tấn', dvt: 'Tấn', round: 4, trip: 4 }),
    separator(4),
    dataRow({ hd: 'B2', ngay: '05/07/2026', xe: '29H 33333', khung: '≤2.5 tấn', dvt: 'Chuyến', round: 10, trip: 10 }),
    separator(10),
  ]);

  const v2 = generateProcessedV2Sheet(wb);
  assert.equal(v2.getRow(1).getCell(1).value, 'Cần kiểm tra tách chuyến: B2');
  assert.equal(v2.getRow(5).getCell(8).value, '≤2.5 tấn');
  assert.equal(fillArgb(v2.getRow(5).getCell(8)), 'FFF8CBAD');
});
