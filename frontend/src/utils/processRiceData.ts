/**
 * processRiceData.ts
 * Parse & filter data_gao.xlsx theo master data hóa đơn tài xế (driver_invoices DB).
 *
 * Logic chính:
 * 1. Parse file data_gao.xlsx (sheet "Data xuất")
 * 2. Với mỗi dòng: normalize biển số + lấy ngày
 * 3. Kiểm tra (ngày, biển số) có nằm trong master data không
 * 4. Tách thành 2 nhóm: matched / unmatched
 * 5. Export Excel kết quả
 */

import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RiceDataRow {
  /** Row number in source file (1-based) */
  sourceRowNum: number;
  /** Raw date string YYYY-MM-DD */
  ngay: string;
  /** Raw biển số from file (original) */
  soXeRaw: string;
  /** Normalized biển số (uppercase, no spaces/dashes) */
  soXeNorm: string;
  /** Tên sản phẩm */
  tenSanPham: string;
  /** Mã sản phẩm */
  maSanPham: string;
  /** Đại lý */
  daiLy: string;
  /** Số tấn */
  soTan: number | null;
  /** Xuất đại lý (kg) */
  xuatDaiLy: number | null;
  /** Số kg */
  soKg: number | null;
  /** Quy đổi */
  quyDoi: number | null;
  /** Đơn vị */
  unit: string;
  /** Tất cả raw cells (để export nguyên gốc) */
  raw: (string | number | null)[];
}

export interface ParseResult {
  rows: RiceDataRow[];
  headers: string[];
  totalRows: number;
  dateRange: { from: string; to: string } | null;
}

export interface FilterResult {
  matched: RiceDataRow[];
  unmatched: RiceDataRow[];
  totalMatched: number;
  totalUnmatched: number;
  /** Biển số có trong file nhưng không tìm thấy trong bất kỳ ngày nào */
  unknownPlates: string[];
  /** Tổng số tấn của các dòng matched */
  totalTonMatched: number;
  /** Tổng số tấn của các dòng unmatched */
  totalTonUnmatched: number;
}

export interface ExportResult {
  blob: Blob;
  filename: string;
}

// ─── Master Data Types ────────────────────────────────────────────────────────

/** Map: ngay (YYYY-MM-DD) → Set of normalized plates */
export type MasterPlateMap = Map<string, Set<string>>;

// ─── Column indices for "Data xuất" sheet ────────────────────────────────────

const COL = {
  DATE: 0,       // A - Ngày
  SO_XE: 1,      // B - Số xe
  GATE_PATE: 2,  // C
  CODE: 3,       // D - Mã SP
  SAP_CODE: 4,   // E
  DESC_V: 5,     // F - Tên sản phẩm
  UNIT: 6,       // G - Đơn vị
  DAI_LY: 7,     // H - Đại lý
  CO: 8,         // I
  XUAT_CLF: 9,   // J
  XUAT_DAI_LY: 10, // K
  XUAT_TRA: 11,  // L
  XUAT_KHAC: 12, // M
  BOC_XEP: 13,   // N
  SO_KG: 14,     // O
  PALLET: 15,    // P
  SPOT_CHECK: 16,// Q
  QUY_DOI: 17,   // R
  SO_TAN: 18,    // S
  QUY_CACH: 19,  // T
  CB: 20,        // U
  MT_CHAN: 21,   // V
  MT_LE: 22,     // W
} as const;

// ─── Normalize biển số ────────────────────────────────────────────────────────

/**
 * Normalize biển số xe để so khớp giữa các nguồn dữ liệu khác nhau.
 * - "61C 35718"  → "61C35718"
 * - "50H-69717"  → "50H69717"
 * - " 50H-92136" → "50H92136"
 * - "50E-565,21" → "50E56521"
 */
export function normalizePlate(plate: string | null | undefined): string {
  if (!plate) return '';
  return plate
    .toString()
    .trim()
    .toUpperCase()
    .replace(/[\s\-.,]/g, ''); // remove spaces, dashes, dots, commas
}

// ─── Parse Excel date cell ────────────────────────────────────────────────────

function excelSerialToDate(serial: number): string {
  // Excel serial: days since 1900-01-01 (with Lotus 1-2-3 bug for day 60)
  const utc = new Date(Date.UTC(1899, 11, 30 + serial));
  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const d = String(utc.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseRawDate(val: unknown): string | null {
  if (!val) return null;

  // Already a Date object — fallback nếu vẫn nhận được Date từ nguồn khác
  // Không xảy ra khi cellDates: false, nhưng giữ lại để an toàn
  if (val instanceof Date) {
    // xlsx tạo Date với time component không phải midnight → không thể tin getDate()/getUTCDate()
    // Convert về serial bằng getTime() rồi dùng excelSerialToDate
    const serial = (val.getTime() / 86400000) + 25569;
    return excelSerialToDate(Math.round(serial));
  }

  // Numeric serial date
  if (typeof val === 'number') {
    return excelSerialToDate(val);
  }

  // String date
  if (typeof val === 'string') {
    const s = val.trim();
    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    // DD/MM/YYYY
    const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m1) {
      const [, p1, p2, yr] = m1;
      const n1 = parseInt(p1), n2 = parseInt(p2);
      let day: number, mon: number;
      if (n1 > 12) { day = n1; mon = n2; }
      else if (n2 > 12) { mon = n1; day = n2; }
      else { mon = n1; day = n2; } // default MM/DD
      return `${yr}-${String(mon).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  return null;
}

// ─── Parse file data_gao.xlsx ─────────────────────────────────────────────────

export async function parseRiceFile(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        // cellDates: false — giữ nguyên serial number để excelSerialToDate xử lý đúng
        // cellDates: true tạo Date object với giờ ~23:59:30 local (không phải midnight)
        // dẫn đến getDate() và getUTCDate() đều có thể trả sai ngày
        const workbook = XLSX.read(data, { type: 'array', cellDates: false });

        // Tìm sheet "Data xuất" (case-insensitive, hoặc sheet đầu tiên)
        const sheetName =
          workbook.SheetNames.find((n) =>
            n.toLowerCase().includes('data') || n.toLowerCase().includes('xuất')
          ) ?? workbook.SheetNames[0];

        const sheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
          header: 1,
          defval: null,
          raw: true,
        }) as (string | number | null)[][];

        if (rawData.length < 2) {
          reject(new Error('File không có dữ liệu'));
          return;
        }

        // Row 0 là header
        const headers = (rawData[0] ?? []).map((h) =>
          h !== null ? String(h) : ''
        );

        const rows: RiceDataRow[] = [];
        let minDate = '';
        let maxDate = '';

        for (let i = 1; i < rawData.length; i++) {
          const row = rawData[i] ?? [];

          // Skip empty rows
          const dateVal = row[COL.DATE];
          const soXeVal = row[COL.SO_XE];
          if (!dateVal && !soXeVal) continue;

          const ngay = parseRawDate(dateVal);
          if (!ngay) continue; // bỏ qua dòng không có ngày

          const soXeRaw = soXeVal !== null ? String(soXeVal) : '';
          if (!soXeRaw.trim()) continue; // bỏ qua dòng không có biển số

          const soXeNorm = normalizePlate(soXeRaw);

          const tenSanPham = row[COL.DESC_V] !== null ? String(row[COL.DESC_V] ?? '') : '';
          const maSanPham = row[COL.CODE] !== null ? String(row[COL.CODE] ?? '') : '';
          const daiLy = row[COL.DAI_LY] !== null ? String(row[COL.DAI_LY] ?? '') : '';
          const unit = row[COL.UNIT] !== null ? String(row[COL.UNIT] ?? '') : '';

          const toNum = (v: unknown) => {
            if (v === null || v === undefined || v === '') return null;
            const n = Number(v);
            return isNaN(n) ? null : n;
          };

          const soTan = toNum(row[COL.SO_TAN]);
          const xuatDaiLy = toNum(row[COL.XUAT_DAI_LY]);
          const soKg = toNum(row[COL.SO_KG]);
          const quyDoi = toNum(row[COL.QUY_DOI]);

          if (!minDate || ngay < minDate) minDate = ngay;
          if (!maxDate || ngay > maxDate) maxDate = ngay;

          rows.push({
            sourceRowNum: i + 1,
            ngay,
            soXeRaw,
            soXeNorm,
            tenSanPham,
            maSanPham,
            daiLy,
            soTan,
            xuatDaiLy,
            soKg,
            quyDoi,
            unit,
            raw: row.slice(0, 23) as (string | number | null)[],
          });
        }

        resolve({
          rows,
          headers,
          totalRows: rows.length,
          dateRange: minDate ? { from: minDate, to: maxDate } : null,
        });
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Lỗi đọc file Excel'));
      }
    };
    reader.onerror = () => reject(new Error('Không thể đọc file'));
    reader.readAsArrayBuffer(file);
  });
}

// ─── Build master plate map from driver_invoices ──────────────────────────────

/**
 * Xây dựng map: ngay → Set<normalizedPlate>
 * từ danh sách driver_invoices lấy từ API.
 */
export function buildMasterPlateMap(
  schedules: Array<{ ngay: string; so_xe: string | null }>
): MasterPlateMap {
  const map: MasterPlateMap = new Map();

  for (const s of schedules) {
    if (!s.so_xe) continue;
    const norm = normalizePlate(s.so_xe);
    if (!norm) continue;

    if (!map.has(s.ngay)) {
      map.set(s.ngay, new Set());
    }
    map.get(s.ngay)!.add(norm);
  }

  return map;
}

// ─── Filter ───────────────────────────────────────────────────────────────────

export function filterRiceData(
  rows: RiceDataRow[],
  masterMap: MasterPlateMap
): FilterResult {
  const matched: RiceDataRow[] = [];
  const unmatched: RiceDataRow[] = [];
  const allPlatesInFile = new Set(rows.map((r) => r.soXeNorm));
  const platesFoundInMaster = new Set<string>();

  for (const row of rows) {
    const platesForDay = masterMap.get(row.ngay);
    if (platesForDay && platesForDay.has(row.soXeNorm)) {
      matched.push(row);
      platesFoundInMaster.add(row.soXeNorm);
    } else {
      unmatched.push(row);
    }
  }

  // Biển số có trong file nhưng chưa từng match
  const unknownPlates = [...allPlatesInFile].filter(
    (p) => !platesFoundInMaster.has(p)
  );

  const sumTon = (arr: RiceDataRow[]) =>
    arr.reduce((s, r) => s + (r.soTan ?? 0), 0);

  return {
    matched,
    unmatched,
    totalMatched: matched.length,
    totalUnmatched: unmatched.length,
    unknownPlates,
    totalTonMatched: sumTon(matched),
    totalTonUnmatched: sumTon(unmatched),
  };
}

// ─── Export Excel ─────────────────────────────────────────────────────────────

// ─── Output headers (sau khi lọc cột và thêm cột mới) ───────────────────────
// Các cột bị xoá: GATE PATE, CODE, SAP Code, Unit, CO, XUẤT CLF
// Cột mới: TRỌNG LƯỢNG (TẤN/ HÓA ĐƠN) = XUẤT ĐẠI LÝ / 1000, nằm sau XUẤT ĐẠI LÝ
const OUTPUT_HEADERS = [
  'DATE', 'SO XE', 'Description V', 'DAI LY',
  'XUẤT ĐẠI LÝ', 'TRỌNG LƯỢNG (TẤN/ HÓA ĐƠN)',
  'XUẤT TRẢ VINH PHAT', 'XUẤT KHÁC',
  'BỐC XẾP', 'SỐ KG', 'PALLET', 'SPOT CHECK',
  'QUY ĐỔI ĐVT (BAO/THÙNG/CÁI)', 'SỐ TẤN', 'QUY CÁCH',
  'CB chẳn/lẻ', 'Mt Chẳn', 'Mt Lẻ',
];

function rowsToSheetData(rows: RiceDataRow[]): (string | number | null)[][] {
  return rows.map((r) => {
    const cells = [...r.raw] as (string | number | null)[];
    // Trả lại biển số raw
    cells[COL.SO_XE] = r.soXeRaw;

    // Format ngày thành DD/MM/YYYY
    const [yr, mo, dy] = r.ngay.split('-');
    const ngayFormatted = `${dy}/${mo}/${yr}`;

    // Cột "Trọng lượng (tấn/ hóa đơn)" = Xuất đại lý / 1000, làm tròn 3 chữ số
    const troNgLuong = r.xuatDaiLy != null ? +(r.xuatDaiLy / 1000).toFixed(3) : null;

    // Trả về chỉ các cột cần thiết (đã lọc + cột mới)
    return [
      ngayFormatted,             // DATE (DD/MM/YYYY)
      cells[COL.SO_XE],          // SO XE
      cells[COL.DESC_V],         // Description V
      cells[COL.DAI_LY],         // DAI LY
      cells[COL.XUAT_DAI_LY],    // XUẤT ĐẠI LÝ
      troNgLuong,                // TRỌNG LƯỢNG (TẤN/ HÓA ĐƠN) — cột mới
      cells[COL.XUAT_TRA],       // XUẤT TRẢ VINH PHAT
      cells[COL.XUAT_KHAC],      // XUẤT KHÁC
      cells[COL.BOC_XEP],        // BỐC XẾP
      cells[COL.SO_KG],          // SỐ KG
      cells[COL.PALLET],         // PALLET
      cells[COL.SPOT_CHECK],     // SPOT CHECK
      cells[COL.QUY_DOI],        // QUY ĐỔI ĐVT
      cells[COL.SO_TAN],         // SỐ TẤN
      cells[COL.QUY_CACH],       // QUY CÁCH
      cells[COL.CB],             // CB chẳn/lẻ
      cells[COL.MT_CHAN],        // Mt Chẳn
      cells[COL.MT_LE],          // Mt Lẻ
    ];
  });
}

// ─── Màu header cho từng sheet ───────────────────────────────────────────────
const HEADER_STYLE: Record<string, { bgColor: string; fontColor: string }> = {
  'Khớp lịch':  { bgColor: '1E7E34', fontColor: 'FFFFFF' }, // xanh lá
  'Không khớp': { bgColor: 'E65C00', fontColor: 'FFFFFF' }, // cam
  'Thống kê':   { bgColor: '1565C0', fontColor: 'FFFFFF' }, // xanh dương
};

function applyHeaderStyle(
  ws: ExcelJS.Worksheet,
  sheetName: string,
  numCols: number
) {
  const style = HEADER_STYLE[sheetName] ?? { bgColor: '37474F', fontColor: 'FFFFFF' };
  const headerRow = ws.getRow(1);
  headerRow.height = 22;
  for (let c = 1; c <= numCols; c++) {
    const cell = headerRow.getCell(c);
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: `FF${style.bgColor}` },
    };
    cell.font = { bold: true, color: { argb: `FF${style.fontColor}` }, size: 11 };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
    };
  }
}

export async function exportRiceResult(
  filterResult: FilterResult,
  originalHeaders: string[],
  allRows: RiceDataRow[]
): Promise<ExportResult> {
  const today = new Date();
  const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
  const filename = `data_gao_filtered_${dateStr}.xlsx`;

  const wb = new ExcelJS.Workbook();

  const sortRows = (rows: RiceDataRow[]) =>
    [...rows].sort((a, b) => {
      if (a.ngay < b.ngay) return -1;
      if (a.ngay > b.ngay) return 1;
      return a.soXeNorm.localeCompare(b.soXeNorm, 'vi');
    });

  const addDataSheet = (sheetName: string, rows: RiceDataRow[]) => {
    const ws = wb.addWorksheet(sheetName);
    ws.addRow(OUTPUT_HEADERS);
    for (const rowArr of rowsToSheetData(sortRows(rows))) {
      ws.addRow(rowArr);
    }
    ws.columns.forEach((col, i) => {
      col.width = Math.max((OUTPUT_HEADERS[i] ?? '').length + 2, 12);
    });
    applyHeaderStyle(ws, sheetName, OUTPUT_HEADERS.length);
  };

  addDataSheet('Khớp lịch', filterResult.matched);
  addDataSheet('Không khớp', filterResult.unmatched);

  // ─ Sheet "Raw": toàn bộ dữ liệu gốc, các row khớp lịch tô vàng
  const matchedSourceRows = new Set(filterResult.matched.map((r) => r.sourceRowNum));
  const wsRaw = wb.addWorksheet('Raw');
  const numRawCols = Math.max(originalHeaders.length, 23);

  // Header row
  wsRaw.addRow(originalHeaders);
  applyHeaderStyle(wsRaw, 'Raw', numRawCols);

  // Data rows — giữ nguyên raw cells từ file gốc
  for (const row of allRows) {
    const cells = row.raw.slice(0, numRawCols) as (string | number | null)[];
    const excelRow = wsRaw.addRow(cells);

    if (matchedSourceRows.has(row.sourceRowNum)) {
      // Tô vàng các row xuất hiện trong sheet "Khớp lịch"
      for (let c = 1; c <= numRawCols; c++) {
        excelRow.getCell(c).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFFF00' }, // vàng
        };
      }
    }
  }

  // Apply date format to column A cells with numeric (serial) values
  for (let r = 2; r <= wsRaw.rowCount; r++) {
    const cell = wsRaw.getCell(r, 1);
    if (typeof cell.value === 'number') {
      cell.numFmt = 'dd/mm/yyyy';
    }
  }

  wsRaw.columns.forEach((col, i) => {
    col.width = Math.max((originalHeaders[i] ?? '').length + 2, 12);
  });

  // ─ Sheet 3: Thống kê
  const wsStats = wb.addWorksheet('Thống kê');
  const statsRows: (string | number)[][] = [
    ['Chỉ số', 'Giá trị'],
    ['Tổng dòng khớp lịch', filterResult.totalMatched],
    ['Tổng dòng không khớp', filterResult.totalUnmatched],
    ['Tổng tấn (khớp lịch)', +filterResult.totalTonMatched.toFixed(3)],
    ['Tổng tấn (không khớp)', +filterResult.totalTonUnmatched.toFixed(3)],
    ['Biển số không tìm thấy', filterResult.unknownPlates.length],
    [],
    ['Biển số không tìm thấy trong lịch'],
    ...filterResult.unknownPlates.map((p) => [p]),
  ];
  for (const r of statsRows) wsStats.addRow(r);
  wsStats.columns = [{ width: 36 }, { width: 16 }];
  applyHeaderStyle(wsStats, 'Thống kê', 2);

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  return { blob, filename };
}
