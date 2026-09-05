/**
 * processDeliveryData.ts
 *
 * Browser-side utility to process delivery data from ERP Excel files.
 * Ported from scripts/process-delivery-data.cjs to TypeScript for browser use.
 *
 * Logic:
 * 0. Read XLSX file (ArrayBuffer) using xlsx library
 * 1. Skip first 4 rows (company name, address, title, header) — row 5+ = data
 * 2. Pre-sort all rows by Số tàu/xe ASC → Ngày hóa đơn ASC (ensures consistent group order downstream)
 * 3. Group rows by (Số tàu/xe + Ngày hóa đơn + Tên khách hàng)
 *    - Nếu SUM(HĐ Trọng lượng)/1000 < 13: giữ nguyên group key
 *    - Nếu SUM(HĐ Trọng lượng)/1000 >= 13 và Thông tin bổ sung có từ 2 giá trị trở lên:
 *      thêm Thông tin bổ sung vào group key
 * 4. Sort each group by Số hóa đơn ascending (numeric-aware)
 * 5. Sort groups by Ngày HĐ ASC then Số tàu/xe ASC
 * 6. Calculate Round(MT) per group = SUM(HĐ-Trọng lượng Net) / 1000 (3 decimal places)
 * 7. Write output Excel with output columns, blank row separator between groups
 */

import * as XLSX from 'xlsx';
import { Workbook } from 'exceljs';
import type { Customer } from '../api/customersApi';
import type { WeightAdjustment } from '../api/weightAdjustmentApi';
import type { PromoItem } from '../api/promoItemApi';

// ─── Excel number format patterns ─────────────────────────────────────────────
const NUM_FMT_THOUSAND = '#,##0';         // Integer với thousand separator
const NUM_FMT_DECIMAL = '#,##0.000';      // Decimal 3 chữ số với thousand separator

// ─── Column index mapping from source file ────────────────────────────────────
export const COL = {
  CHANNEL: 0,
  SUB_CHANNEL: 1,
  DIEN_GIAI_CT: 2,
  DIEN_GIAI: 3,
  SLOT: 4,
  WAYBILL_NO: 5,
  SLOT_NO: 6,
  USER_TAO_HD: 7,
  USER_TAO_PXK: 8,
  PO_NUMBER: 9,
  WAREHOUSE_NO: 10,
  WAREHOUSE_NAME: 11,
  MA_PXK: 12,
  SO_CHUNG_TU: 13,
  SO_SERI: 14,
  DIA_CHI: 15,
  TEN_HANG_HOA: 16,
  MA_DVT: 17,
  SP_TRONG_LUONG: 18,
  HD_TRONG_LUONG: 19, // ← used for Round(MT)
  MA_NCC: 20,
  MA_KH: 21,
  TEN_KH: 22,
  MA_HANG: 23,
  TEN_HANG_EN: 24,
  LOAI_HANG: 25,
  MA_LH_GIAO: 26,
  SO_LUONG: 27,
  SO_TAU_XE: 28, // ← group key
  TAI_XE: 29,
  SO_CONT: 30,
  NGAY_HD: 31,   // ← group key
  SO_HD: 32,     // ← sort key
  THONG_TIN_BS: 33,
} as const;

// ─── Factory column mapping ────────────────────────────────────────────────────
const FACTORY_BY_NCC: Record<string, string> = {
  '2000000001': 'CLF',
  '2100000002': 'VFM',
  '2000000007': 'MCC',
  '2000000008': 'NDFC',
};

function getFactory(maNcc: string): string {
  return FACTORY_BY_NCC[maNcc] ?? 'CLV';
}

// ─── Helper: Strip " /L2" suffix from vehicle number ──────────────────────────
function normalizeVehicle(soTauXe: string): string {
  if (soTauXe.length >= 4 && soTauXe.slice(-4) === ' /L2') {
    return soTauXe.slice(0, -4);
  }
  return soTauXe;
}

// ─── Helper: Compare vehicle numbers with natural sorting ──────────────────────
/**
 * Compare two vehicle numbers using natural sorting rules.
 * Vehicle format: "[PREFIX][SPACES][NUMBER]" (e.g. "50H 55116", "85H 01932")
 * Sort by: PREFIX (alphabetically) → NUMBER (numerically)
 */
function compareVehicleNumbers(a: string, b: string): number {
  // Extract prefix and number from each vehicle string
  const vehicleRegex = /^([A-Z0-9]+)[\s]*(\d+)$/i;

  const matchA = a.match(vehicleRegex);
  const matchB = b.match(vehicleRegex);

  // If either doesn't match the pattern, fall back to string comparison
  if (!matchA || !matchB) {
    return a.localeCompare(b, undefined, { numeric: true });
  }

  const [, prefixA, numA] = matchA;
  const [, prefixB, numB] = matchB;

  // Compare prefix first (alphabetically)
  const prefixCompare = prefixA.localeCompare(prefixB, undefined, { numeric: true });
  if (prefixCompare !== 0) return prefixCompare;

  // If same prefix, compare numbers (numerically)
  return Number(numA) - Number(numB);
}

// ─── Output column headers ─────────────────────────────────────────────────────
const OUTPUT_HEADERS = [
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
  'Thông tin bổ sung',
  'Slot',
  'Diễn giải',
  'Channel',
  'SubChannel',
  'SlotNo',
  'user tạo HĐ',
  'User tạo PXK',
  'PO number',
  'Warehouse No',
  'Warehouse Name',
  'Phiếu XK',
  'Chứng từ ghi sổ',
  'Số seri',
  'Loại hàng',
  'Tuyến cũ',
  'Tuyến mới',
  'Tuyến lên hóa đơn',
];

// ─── Factory sheet headers (45 cols) ──────────────────────────────────────────
const FACTORY_OUTPUT_HEADERS = [
  'Mã nhà cung cấp',       // 0
  'Số hóa đơn',            // 1
  'Ngày hóa đơn',          // 2
  'Số tàu',                // 3
  'Mã khách hàng',         // 4
  'Tên khách hàng',        // 5
  'Địa chỉ giao hàng',     // 6
  'Khung giá',             // 7
  'Đơn vị tính',           // 8
  'Mã hàng hóa',           // 9
  'Tên hàng hóa (Vie)',    // 10
  'Tên hàng hóa (En)',     // 11
  'Mã liên hệ giao hàng',  // 12
  'Mã DVT',                // 13
  'Số lượng (DVT bán hàng)', // 14
  'SP Trọng lượng net',    // 15
  'HĐ Trọng lượng (Net)',  // 16
  'Round(MT)',              // 17
  'Tấn/ Hóa đơn',          // 18
  'Tấn/ Chuyến',           // 19
  'CLF',                   // 20
  'VFM',                   // 21
  'MCC',                   // 22
  'CLV',                   // 23
  'NDFC',                  // 24
  '',                      // 25
  '',                      // 26
  'Tài xế',                // 27
  'Thông tin bổ sung',     // 28
  'Slot',                  // 29
  'Diễn giải',             // 30
  'Channel',               // 31
  'SubChannel',            // 32
  'SlotNo',                // 33
  'user tạo HĐ',           // 34
  'User tạo PXK',          // 35
  'PO number',             // 36
  'Warehouse No',          // 37
  'Warehouse Name',        // 38
  'Phiếu XK',              // 39
  'Chứng từ ghi sổ',       // 40
  'Số seri',               // 41
  'Loại hàng',             // 42
  'Tuyến cũ',              // 43
  'Tuyến mới',             // 44
  'Tuyến lên hóa đơn',     // 45
];

// ─── Column widths for output Excel ───────────────────────────────────────────
const COL_WIDTHS_FACTORY: { wch: number }[] = [
  { wch: 15 },  // 0  Mã nhà cung cấp
  { wch: 12 },  // 1  Số hóa đơn
  { wch: 12 },  // 2  Ngày hóa đơn
  { wch: 18 },  // 3  Số tàu
  { wch: 15 },  // 4  Mã khách hàng
  { wch: 35 },  // 5  Tên khách hàng
  { wch: 50 },  // 6  Địa chỉ giao hàng
  { wch: 15 },  // 7  Khung giá
  { wch: 12 },  // 8  Đơn vị tính
  { wch: 15 },  // 9  Mã hàng hóa
  { wch: 35 },  // 10 Tên hàng hóa (Vie)
  { wch: 35 },  // 11 Tên hàng hóa (En)
  { wch: 20 },  // 12 Mã liên hệ giao hàng
  { wch: 10 },  // 13 Mã DVT
  { wch: 22 },  // 14 Số lượng (DVT bán hàng)
  { wch: 18 },  // 15 SP Trọng lượng net
  { wch: 20 },  // 16 HĐ Trọng lượng (Net)
  { wch: 10 },  // 17 Round(MT)
  { wch: 14 },  // 18 Tấn/ Hóa đơn
  { wch: 14 },  // 19 Tấn/ Chuyến
  { wch: 10 },  // 20 CLF
  { wch: 10 },  // 21 VFM
  { wch: 10 },  // 22 MCC
  { wch: 10 },  // 23 CLV
  { wch: 10 },  // 24 NDFC
  { wch: 12 },  // 25 Col1 (tổng đầu khối)
  { wch: 12 },  // 26 Col2 (tổng tất cả dòng)
  { wch: 20 },  // 27 Tài xế
  { wch: 20 },  // 28 Thông tin bổ sung
  { wch: 15 },  // 29 Slot
  { wch: 35 },  // 30 Diễn giải
  { wch: 12 },  // 31 Channel
  { wch: 12 },  // 32 SubChannel
  { wch: 10 },  // 33 SlotNo
  { wch: 12 },  // 34 user tạo HĐ
  { wch: 12 },  // 35 User tạo PXK
  { wch: 20 },  // 36 PO number
  { wch: 12 },  // 37 Warehouse No
  { wch: 25 },  // 38 Warehouse Name
  { wch: 18 },  // 39 Phiếu XK
  { wch: 18 },  // 40 Chứng từ ghi sổ
  { wch: 12 },  // 41 Số seri
  { wch: 12 },  // 42 Loại hàng
  { wch: 20 },  // 43 Tuyến cũ
  { wch: 20 },  // 44 Tuyến mới
  { wch: 30 },  // 45 Tuyến lên hóa đơn
];

const COL_WIDTHS = [
  { wch: 15 },  // Mã nhà cung cấp
  { wch: 12 },  // Số hóa đơn
  { wch: 12 },  // Ngày hóa đơn
  { wch: 18 },  // Số tàu
  { wch: 15 },  // Mã khách hàng
  { wch: 35 },  // Tên khách hàng
  { wch: 50 },  // Địa chỉ giao hàng
  { wch: 15 },  // Khung giá
  { wch: 12 },  // Đơn vị tính
  { wch: 15 },  // Mã hàng hóa
  { wch: 35 },  // Tên hàng hóa (Vie)
  { wch: 35 },  // Tên hàng hóa (En)
  { wch: 20 },  // Mã liên hệ giao hàng
  { wch: 10 },  // Mã DVT
  { wch: 22 },  // Số lượng (DVT bán hàng)
  { wch: 18 },  // SP Trọng lượng net
  { wch: 20 },  // HĐ Trọng lượng (Net)
  { wch: 10 },  // Round(MT)
  { wch: 10 },  // CLF
  { wch: 10 },  // VFM
  { wch: 10 },  // MCC
  { wch: 10 },  // CLV
  { wch: 10 },  // NDFC
  { wch: 12 },  // Col1 (tổng đầu khối)
  { wch: 12 },  // Col2 (tổng tất cả dòng)
  { wch: 20 },  // Tài xế
  { wch: 20 },  // Thông tin bổ sung
  { wch: 15 },  // Slot
  { wch: 35 },  // Diễn giải
  { wch: 12 },  // Channel
  { wch: 12 },  // SubChannel
  { wch: 10 },  // SlotNo
  { wch: 12 },  // user tạo HĐ
  { wch: 12 },  // User tạo PXK
  { wch: 20 },  // PO number
  { wch: 12 },  // Warehouse No
  { wch: 25 },  // Warehouse Name
  { wch: 18 },  // Phiếu XK
  { wch: 18 },  // Chứng từ ghi sổ
  { wch: 12 },  // Số seri
  { wch: 12 },  // Loại hàng
  { wch: 15 },  // Khung giá
  { wch: 20 },  // Tuyến cũ
  { wch: 20 },  // Tuyến mới
  { wch: 30 },  // Tuyến lên hóa đơn
];

// ─── Number format column mappings ────────────────────────────────────────────
// Processed sheet (40 cols)
const PROCESSED_NUMBER_COLS: Record<number, string> = {
  14: NUM_FMT_THOUSAND,  // Số lượng
  15: NUM_FMT_DECIMAL,   // SP Trọng lượng
  16: NUM_FMT_DECIMAL,   // HĐ Trọng lượng
  17: NUM_FMT_DECIMAL,   // Round(MT)
  // 7:  Khung giá — text, không format số
  // 8:  Đơn vị tính — text, không format số
  18: NUM_FMT_DECIMAL,   // CLF
  19: NUM_FMT_DECIMAL,   // VFM
  20: NUM_FMT_DECIMAL,   // MCC
  21: NUM_FMT_DECIMAL,   // CLV
  22: NUM_FMT_DECIMAL,   // NDFC
  23: NUM_FMT_DECIMAL,   // Col1
  24: NUM_FMT_DECIMAL,   // Col2
};

// Factory sheets (45 cols)
const FACTORY_NUMBER_COLS: Record<number, string> = {
  14: NUM_FMT_THOUSAND,  // Số lượng
  15: NUM_FMT_DECIMAL,   // SP Trọng lượng
  16: NUM_FMT_DECIMAL,   // HĐ Trọng lượng
  17: NUM_FMT_DECIMAL,   // Round(MT)
  // 7:  Khung giá — text, không format số
  // 8:  Đơn vị tính — text, không format số
  18: NUM_FMT_DECIMAL,   // Tấn/ Hóa đơn
  19: NUM_FMT_DECIMAL,   // Tấn/ Chuyến
  20: NUM_FMT_DECIMAL,   // CLF
  21: NUM_FMT_DECIMAL,   // VFM
  22: NUM_FMT_DECIMAL,   // MCC
  23: NUM_FMT_DECIMAL,   // CLV
  24: NUM_FMT_DECIMAL,   // NDFC
  25: NUM_FMT_DECIMAL,   // Col1
  26: NUM_FMT_DECIMAL,   // Col2
};

// ─── Types ────────────────────────────────────────────────────────────────────
export type RawRow = (string | number | boolean | null | undefined)[];

interface GroupData {
  vehicle: string;
  date: string | number;
  rows: RawRow[];
}

export interface ParsedFileData {
  rawRows: RawRow[];
  sourceRowNums: number[];
}

export interface ProcessResult {
  processedRows: number;
  groupCount: number;
  dateRange: { from: string; to: string };
  warnings: string[];
  outputBlob: Blob;
  outputFilename: string;
}

export interface AdjustmentRow {
  rawRowIndex: number;
  sourceRowNum: number;
  maHang: string;
  tenHangFile: string;
  tenHangMaster: string;
  spTrongLuongGoc: number;
  giaTriApDung: number;
  lyDo: 'gia_tri_cu' | 'gia_tri_dieu_chinh';
}

// ─── Customer lookup ─────────────────────────────────────────────────────────

type CustomerLookup = Map<string, { tuyenCu: string; tuyenPhuong: string }>;

function buildCustomerLookup(customers: Customer[]): CustomerLookup {
  const map: CustomerLookup = new Map();
  for (const c of customers) {
    const defaultValue = {
      tuyenCu: c.tuyen_cu ?? '',
      tuyenPhuong: c.tuyen_phuong ?? '',
    };
    const key = `${(c.ten_khach_hang ?? '').trim().toLowerCase()}|||${(c.dia_chi_giao_hang ?? '').trim().toLowerCase()}`;
    map.set(key, defaultValue);
    // Also index by supplier_code for priority lookup
    if (c.supplier_code) {
      const supplierKey = `${key}|||${c.supplier_code.trim()}`;
      map.set(supplierKey, defaultValue);
    }
  }
  return map;
}

function lookupCustomer(lookup: CustomerLookup, tenKH: string, diaChi: string, maNcc?: string, slot?: string): { tuyenCu: string; tuyenPhuong: string } {
  const key = `${tenKH.trim().toLowerCase()}|||${diaChi.trim().toLowerCase()}`;
  // Priority: if MCC/NDFC factory with Slot = "UNI 1", try supplier-specific lookup first
  if (maNcc && slot && (maNcc === '2000000007' || maNcc === '2000000008') && slot.trim() === 'UNI 1') {
    const supplierKey = `${key}|||${maNcc}`;
    const found = lookup.get(supplierKey);
    if (found) return found;
  }
  return lookup.get(key) ?? { tuyenCu: '', tuyenPhuong: '' };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Convert Excel serial date number to DD/MM/YYYY string.
 * If already a string, return as-is.
 */
function excelDateToString(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'number') {
    try {
      const parsed = XLSX.SSF.parse_date_code(value);
      if (parsed) {
        const d = String(parsed.d).padStart(2, '0');
        const m = String(parsed.m).padStart(2, '0');
        return `${d}/${m}/${parsed.y}`;
      }
    } catch {
      // fallback
    }
    return String(value);
  }
  // Already a string — return as-is
  return String(value);
}

/**
 * Get a cell value safely from a row array.
 */
export function cell(row: RawRow, index: number): string {
  const val = row[index];
  if (val === null || val === undefined) return '';
  return String(val);
}

/**
 * Map a source row to an output row array.
 * factoryVals: { CLF, VFM, MCC, CLV, NDFC } — value for the row's factory col,
 *   '' for inactive factory cols.
 */
function getKhungGia(groupRoundMTTotal: number, soTauXe: string): string {
  const normalizedSoTauXe = soTauXe.trim();
  if (normalizedSoTauXe.startsWith('PPH-P')) return 'Pallet';

  if (groupRoundMTTotal <= 2.5) return '≤2.5 tấn';
  if (groupRoundMTTotal > 16) return '>16-23 tấn';
  return '>8-16 tấn';
}

function mapRowToOutput(row: RawRow, factoryVals: Record<string, string | number>, isFirstInGroup: boolean, groupRoundMTTotal: number, customerLookup: CustomerLookup): (string | number)[] {
  const roundMT = Math.round((Number(row[COL.HD_TRONG_LUONG]) || 0) / 1000 * 1000) / 1000;
  const khungGia = getKhungGia(groupRoundMTTotal, cell(row, COL.SO_TAU_XE));
  const soXe = cell(row, COL.SO_TAU_XE).slice(-9);
  const { tuyenCu, tuyenPhuong } = lookupCustomer(customerLookup, cell(row, COL.TEN_KH), cell(row, COL.DIA_CHI), cell(row, COL.MA_NCC), cell(row, COL.SLOT));
  const tuyenLenHD = tuyenPhuong ? `${tuyenPhuong} ${khungGia} (${soXe})` : '';
  const donViTinh = khungGia === '≤2.5 tấn' ? 'Chuyến' : 'Tấn';
  return [
    cell(row, COL.MA_NCC) || 'CLV',
    cell(row, COL.SO_HD),
    excelDateToString(row[COL.NGAY_HD] as string | number | null | undefined),
    soXe,
    cell(row, COL.MA_KH),
    cell(row, COL.TEN_KH),
    cell(row, COL.DIA_CHI),
    khungGia,
    donViTinh,
    cell(row, COL.MA_HANG),
    cell(row, COL.TEN_HANG_HOA),
    cell(row, COL.TEN_HANG_EN),
    cell(row, COL.MA_LH_GIAO),
    cell(row, COL.MA_DVT),
    cell(row, COL.SO_LUONG),
    cell(row, COL.SP_TRONG_LUONG),
    cell(row, COL.HD_TRONG_LUONG),
    roundMT,
    factoryVals['CLF'],
    factoryVals['VFM'],
    factoryVals['MCC'],
    factoryVals['CLV'],
    factoryVals['NDFC'],
    isFirstInGroup ? groupRoundMTTotal : 0,
    groupRoundMTTotal,
    cell(row, COL.TAI_XE),
    cell(row, COL.THONG_TIN_BS),
    cell(row, COL.SLOT),
    cell(row, COL.DIEN_GIAI),
    cell(row, COL.CHANNEL),
    cell(row, COL.SUB_CHANNEL),
    cell(row, COL.SLOT_NO),
    cell(row, COL.USER_TAO_HD),
    cell(row, COL.USER_TAO_PXK),
    cell(row, COL.PO_NUMBER),
    cell(row, COL.WAREHOUSE_NO),
    cell(row, COL.WAREHOUSE_NAME),
    cell(row, COL.MA_PXK),
    cell(row, COL.SO_CHUNG_TU),
    cell(row, COL.SO_SERI),
    cell(row, COL.LOAI_HANG),
    tuyenCu,
    tuyenPhuong,
    tuyenLenHD,
  ];
}

// ─── Weight adjustment & exclude helpers ─────────────────────────────────────

export const DIEN_GIAI_EXCLUDE_KEYWORDS = ['thay thế', 'điều chỉnh'];

export function buildAdjustments(
  rawRows: RawRow[],
  sourceRowNums: number[],
  masterMap: Map<string, WeightAdjustment>
): AdjustmentRow[] {
  const result: AdjustmentRow[] = [];
  rawRows.forEach((row, idx) => {
    const maHang = cell(row, COL.MA_HANG);
    const master = masterMap.get(maHang);
    if (!master) return;

    const tenHangFile = cell(row, COL.TEN_HANG_HOA);
    const spTrongLuongGoc = Number(row[COL.SP_TRONG_LUONG]) || 0;

    const nameMatches = tenHangFile.trim() === master.ten_hang.trim();
    if (nameMatches) {
      if (master.gia_tri_cu === null || master.gia_tri_cu === undefined) return;
      result.push({
        rawRowIndex: idx,
        sourceRowNum: sourceRowNums[idx],
        maHang,
        tenHangFile,
        tenHangMaster: master.ten_hang,
        spTrongLuongGoc,
        giaTriApDung: master.gia_tri_cu,
        lyDo: 'gia_tri_cu',
      });
    } else {
      result.push({
        rawRowIndex: idx,
        sourceRowNum: sourceRowNums[idx],
        maHang,
        tenHangFile,
        tenHangMaster: master.ten_hang,
        spTrongLuongGoc,
        giaTriApDung: master.gia_tri_dieu_chinh,
        lyDo: 'gia_tri_dieu_chinh',
      });
    }
  });
  return result;
}

export function filterExcludedRows(rawRows: RawRow[], sourceRowNums: number[]): {
  filteredRows: RawRow[];
  filteredSourceRowNums: number[];
  excludedCount: number;
} {
  const filteredRows: RawRow[] = [];
  const filteredSourceRowNums: number[] = [];
  let excludedCount = 0;

  rawRows.forEach((row, idx) => {
    const dienGiai = cell(row, COL.DIEN_GIAI).toLowerCase();
    const shouldExclude = DIEN_GIAI_EXCLUDE_KEYWORDS.some((kw) => dienGiai.includes(kw));
    if (shouldExclude) {
      excludedCount++;
    } else {
      filteredRows.push(row);
      filteredSourceRowNums.push(sourceRowNums[idx]);
    }
  });

  return { filteredRows, filteredSourceRowNums, excludedCount };
}

export function applyAdjustments(rawRows: RawRow[], adjustments: AdjustmentRow[]): RawRow[] {
  const modified = rawRows.map((row) => [...row] as RawRow);
  for (const adj of adjustments) {
    modified[adj.rawRowIndex][COL.SP_TRONG_LUONG] = adj.giaTriApDung;
    const soLuong = Number(modified[adj.rawRowIndex][COL.SO_LUONG]) || 0;
    modified[adj.rawRowIndex][COL.HD_TRONG_LUONG] = soLuong * adj.giaTriApDung;
  }
  return modified;
}

// ─── File parsing ─────────────────────────────────────────────────────────────

/**
 * Read a File object as ArrayBuffer via FileReader.
 */
function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target!.result as ArrayBuffer);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Parse a delivery XLSX file into raw rows + source row numbers.
 * Skips the first 4 metadata rows and the header row (row 5).
 * Filters out empty rows.
 * Use this when you need to inspect or modify rows before processing.
 */
export async function parseDeliveryFile(file: File): Promise<ParsedFileData> {
  const buffer = await readFileAsArrayBuffer(file);

  const wb = XLSX.read(buffer, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];

  const rawData = XLSX.utils.sheet_to_json<RawRow>(ws, { header: 1 });

  if (rawData.length < 5) {
    throw new Error('File không đủ dữ liệu. Cần ít nhất 5 dòng (4 dòng header + 1 dòng data).');
  }

  const rawRows: RawRow[] = [];
  const sourceRowNums: number[] = [];

  rawData.slice(4).forEach((row, i) => {
    if (row && row.length > 0 && row.some((c) => c !== null && c !== undefined && c !== '')) {
      rawRows.push(row);
      sourceRowNums.push(i + 5);
    }
  });

  if (rawRows.length === 0) {
    throw new Error('File không chứa dữ liệu. Vui lòng kiểm tra lại file Excel.');
  }

  return { rawRows, sourceRowNums };
}

// ─── Core processing from raw rows ───────────────────────────────────────────

/**
 * Process delivery data from pre-parsed raw rows.
 * Use this when you've already called parseDeliveryFile() and optionally
 * modified the rows (e.g. weight adjustments).
 */
export async function processDeliveryDataFromRows(
  dataRows: RawRow[],
  sourceRowNums: number[],
  customers?: Customer[],
  innerCityCustomerNames?: Set<string>,
  promoItems?: PromoItem[]
): Promise<ProcessResult> {
  const warnings: string[] = [];
  const customerLookup = buildCustomerLookup(customers ?? []);

  // ── Validate rows — generate specific warnings ────────────────────────────
  dataRows.forEach((row, idx) => {
    const soHD    = cell(row, COL.SO_HD);
    const soTauXe = cell(row, COL.SO_TAU_XE);
    const ngayHD  = excelDateToString(row[COL.NGAY_HD] as string | number | null | undefined);
    const tenKH   = cell(row, COL.TEN_KH);
    const rowRef  = `[Dòng ${sourceRowNums[idx]}]`;

    if (!soTauXe) {
      const detail = [soHD && `HĐ: ${soHD}`, ngayHD && `Ngày: ${ngayHD}`, tenKH && `KH: ${tenKH}`]
        .filter(Boolean).join(' | ');
      warnings.push(`${rowRef} Thiếu Số tàu/xe${detail ? ` — ${detail}` : ''}`);
    }
    if (!row[COL.NGAY_HD] && row[COL.NGAY_HD] !== 0) {
      const detail = [soHD && `HĐ: ${soHD}`, soTauXe && `Số tàu: ${soTauXe}`, tenKH && `KH: ${tenKH}`]
        .filter(Boolean).join(' | ');
      warnings.push(`${rowRef} Thiếu Ngày hóa đơn${detail ? ` — ${detail}` : ''}`);
    }
    if (!soHD) {
      const detail = [soTauXe && `Số tàu: ${soTauXe}`, ngayHD && `Ngày: ${ngayHD}`, tenKH && `KH: ${tenKH}`]
        .filter(Boolean).join(' | ');
      warnings.push(`${rowRef} Thiếu Số hóa đơn${detail ? ` — ${detail}` : ''}`);
    }
  });

  // Normalize vehicle numbers — strip " /L2" suffix for consistent group key + display
  for (const row of dataRows) {
    const raw = cell(row, COL.SO_TAU_XE);
    if (raw) {
      row[COL.SO_TAU_XE] = normalizeVehicle(raw);
    }
  }

  // ── Promo item weight override ─────────────────────────────────────────────
  if (promoItems && promoItems.length > 0) {
    const promoMap = new Map<string, number>();
    for (const p of promoItems) {
      promoMap.set(p.code.trim(), p.unit_weight_kg);
    }
    for (const row of dataRows) {
      const unitWeight = promoMap.get(cell(row, COL.MA_HANG).trim());
      if (unitWeight !== undefined) {
        row[COL.SP_TRONG_LUONG] = unitWeight;
        const soLuong = Number(row[COL.SO_LUONG]) || 0;
        row[COL.HD_TRONG_LUONG] = unitWeight * soLuong;
      }
    }
  }

  // ── Step 1: Group by (Số tàu/xe + Ngày hóa đơn + Tên khách hàng) ──────────
  // Bước 1a: Group sơ bộ — nếu có Thông tin bổ sung thì key = Xe + Ngày + Thông tin BS,
  //           nếu không thì key = Xe + Ngày + Tên KH
  const preliminaryGroupMap = new Map<string, RawRow[]>();

  dataRows.forEach((row) => {
    const vehicle = cell(row, COL.SO_TAU_XE);
    const date = row[COL.NGAY_HD] ?? '';
    const thongTinBS = cell(row, COL.THONG_TIN_BS).trim();
    const customerName = cell(row, COL.TEN_KH);
    const key = thongTinBS
      ? `${vehicle}|||${date}|||${thongTinBS}`
      : `${vehicle}|||${date}|||${customerName}`;

    if (!preliminaryGroupMap.has(key)) {
      preliminaryGroupMap.set(key, []);
    }
    preliminaryGroupMap.get(key)!.push(row);
  });

  // Bước 1b: Kiểm tra SUM(HĐ Trọng lượng)/1000 >= 13 và điều chỉnh group key nếu cần
  const groupMap = new Map<string, GroupData>();

  preliminaryGroupMap.forEach((rows, prelimKey) => {
    const [vehicle, date, customerName] = prelimKey.split('|||');

    // Tính tổng HĐ Trọng lượng / 1000 của group này
    const totalHDTrongLuong = rows.reduce((sum, row) => {
      return sum + (Number(row[COL.HD_TRONG_LUONG]) || 0);
    }, 0);
    const totalMT = totalHDTrongLuong / 1000;

    // Nếu tổng trọng lượng >= 13 và KH là inner-city → kiểm tra "Thông tin bổ sung"
    // Nếu KH không thuộc inner-city → bypass, giữ nguyên group key
    const isInnerCity = innerCityCustomerNames?.has(customerName.trim().toLowerCase());
    if (totalMT >= 13 && isInnerCity) {
      // Nhóm lại theo "Thông tin bổ sung" nếu có từ 2 giá trị trở lên
      const subGroups = new Map<string, RawRow[]>();

      rows.forEach((row) => {
        const thongTinBS = cell(row, COL.THONG_TIN_BS);

        // Đếm số giá trị trong "Thông tin bổ sung" (phân tách bằng dấu phẩy hoặc xuống dòng)
        const values = thongTinBS
          .split(/[,\n\r]+/)
          .map(v => v.trim())
          .filter(v => v.length > 0);

        const hasMultipleValues = values.length >= 2;

        // Nếu có từ 2 giá trị → dùng group key mới (có Thông tin bổ sung)
        // Nếu không → dùng group key cũ (không có Thông tin bổ sung)
        const finalKey = hasMultipleValues
          ? `${vehicle}|||${date}|||${customerName}|||${thongTinBS}`
          : `${vehicle}|||${date}|||${customerName}`;

        if (!subGroups.has(finalKey)) {
          subGroups.set(finalKey, []);
        }
        subGroups.get(finalKey)!.push(row);
      });

      // Add tất cả sub-groups vào groupMap chính
      subGroups.forEach((subRows, finalKey) => {
        if (!groupMap.has(finalKey)) {
          groupMap.set(finalKey, {
            vehicle,
            date: date as string | number,
            rows: []
          });
        }
        groupMap.get(finalKey)!.rows.push(...subRows);
      });
    } else {
      // SUM(HĐ Trọng lượng)/1000 < 13 → giữ nguyên group key (Số tàu/xe + Ngày HĐ + Tên KH)
      const finalKey = prelimKey;
      if (!groupMap.has(finalKey)) {
        groupMap.set(finalKey, {
          vehicle,
          date: date as string | number,
          rows: []
        });
      }
      groupMap.get(finalKey)!.rows.push(...rows);
    }
  });

  // ── Step 2: Sort each group by Số hóa đơn ASC, then Mã NCC ASC ───────────
  for (const group of groupMap.values()) {
    group.rows.sort((a, b) => {
      const invoiceA = cell(a, COL.SO_HD);
      const invoiceB = cell(b, COL.SO_HD);
      const invoiceCompare = invoiceA.localeCompare(invoiceB, undefined, { numeric: true });
      if (invoiceCompare !== 0) return invoiceCompare;

      // Secondary sort: Mã nhà cung cấp ASC
      const nccA = cell(a, COL.MA_NCC);
      const nccB = cell(b, COL.MA_NCC);
      return nccA.localeCompare(nccB, undefined, { numeric: true });
    });
  }

  // ── Step 3: Final sort groups by Số tàu/xe ASC (natural numeric order) ────
  // Sort groups by vehicle using compareVehicleNumbers for proper [PREFIX][NUMBER] handling
  const sortedGroups = Array.from(groupMap.values()).sort((a, b) => {
    return compareVehicleNumbers(a.vehicle.slice(-9), b.vehicle.slice(-9));
  });

  // ── Step 4: Build output rows ─────────────────────────────────────────────
  const outputRows: (string | number)[][] = [OUTPUT_HEADERS];
  const separatorRowIndices = new Set<number>();

  // Per-factory sheet data: header + data rows + separator row tracking
  const FACTORY_NAMES = ['CLF', 'VFM', 'MCC', 'CLV', 'NDFC'] as const;
  type FactoryName = typeof FACTORY_NAMES[number];
  const factorySheetRows: Record<FactoryName, (string | number)[][]> = {
    CLF: [FACTORY_OUTPUT_HEADERS], VFM: [FACTORY_OUTPUT_HEADERS], MCC: [FACTORY_OUTPUT_HEADERS],
    CLV: [FACTORY_OUTPUT_HEADERS], NDFC: [FACTORY_OUTPUT_HEADERS],
  };
  const factorySeparatorRowIndices: Record<FactoryName, Set<number>> = {
    CLF: new Set(), VFM: new Set(), MCC: new Set(), CLV: new Set(), NDFC: new Set(),
  };

  const allDates: string[] = [];

  sortedGroups.forEach((group, groupIndex) => {
    const dateStr = excelDateToString(group.date as string | number | null | undefined);
    if (dateStr) allDates.push(dateStr);

    const invoiceFactorySums = new Map<string, number>();
    group.rows.forEach((row) => {
      const invoiceNo = cell(row, COL.SO_HD);
      const factory = getFactory(cell(row, COL.MA_NCC));
      const roundMT = Math.round((Number(row[COL.HD_TRONG_LUONG]) || 0) / 1000 * 1000) / 1000;
      const key = `${invoiceNo}|||${factory}`;
      invoiceFactorySums.set(key, Math.round(((invoiceFactorySums.get(key) ?? 0) + roundMT) * 1000) / 1000);
    });

    const invoiceFactorySeen = new Set<string>();

    let groupRoundMTSum = 0;
    const groupFactorySums: Record<string, number> = { CLF: 0, VFM: 0, MCC: 0, CLV: 0, NDFC: 0 };

    const groupRoundMTTotal = group.rows.reduce((sum, row) => {
      const roundMT = Math.round((Number(row[COL.HD_TRONG_LUONG]) || 0) / 1000 * 1000) / 1000;
      return Math.round((sum + roundMT) * 1000) / 1000;
    }, 0);

    // Track per-factory group sums and row counts for sheet con separator rows
    const factoryGroupRoundMTSums: Record<FactoryName, number> = {
      CLF: 0, VFM: 0, MCC: 0, CLV: 0, NDFC: 0,
    };
    const factoryGroupFactorySums: Record<FactoryName, Record<string, number>> = {
      CLF: { CLF: 0, VFM: 0, MCC: 0, CLV: 0, NDFC: 0 },
      VFM: { CLF: 0, VFM: 0, MCC: 0, CLV: 0, NDFC: 0 },
      MCC: { CLF: 0, VFM: 0, MCC: 0, CLV: 0, NDFC: 0 },
      CLV: { CLF: 0, VFM: 0, MCC: 0, CLV: 0, NDFC: 0 },
      NDFC: { CLF: 0, VFM: 0, MCC: 0, CLV: 0, NDFC: 0 },
    };
    // Track if each factory sheet has any data row in this group (for conditional separator)
    const factoryGroupHasRows: Record<FactoryName, boolean> = {
      CLF: false, VFM: false, MCC: false, CLV: false, NDFC: false,
    };
    // Track row index within each factory's group (to detect first row of group in factory sheet)
    const factoryGroupRowIndex: Record<FactoryName, number> = {
      CLF: 0, VFM: 0, MCC: 0, CLV: 0, NDFC: 0,
    };

    group.rows.forEach((row, groupRowIndex) => {
      const invoiceNo = cell(row, COL.SO_HD);
      const currentFactory = getFactory(cell(row, COL.MA_NCC)) as FactoryName;
      const seenKey = `${invoiceNo}|||${currentFactory}`;
      const isFirstForFactory = !invoiceFactorySeen.has(seenKey);
      if (isFirstForFactory) invoiceFactorySeen.add(seenKey);

      const factoryVals: Record<string, string | number> = {
        CLF: '', VFM: '', MCC: '', CLV: '', NDFC: '',
      };
      const factorySum = invoiceFactorySums.get(seenKey)!;
      factoryVals[currentFactory] = isFirstForFactory ? factorySum : 0;

      const rowRoundMT = Math.round((Number(row[COL.HD_TRONG_LUONG]) || 0) / 1000 * 1000) / 1000;
      groupRoundMTSum = Math.round((groupRoundMTSum + rowRoundMT) * 1000) / 1000;
      if (isFirstForFactory) {
        groupFactorySums[currentFactory] = Math.round((groupFactorySums[currentFactory] + factorySum) * 1000) / 1000;
      }

      const outputRow = mapRowToOutput(row, factoryVals, groupRowIndex === 0, groupRoundMTTotal, customerLookup);
      outputRows.push(outputRow);

      // ── Build factory sheet row (41 cols = 39 base + Tấn/Chuyến + Tấn/Hóa đơn) ──
      factoryGroupHasRows[currentFactory] = true;
      factoryGroupRoundMTSums[currentFactory] = Math.round(
        (factoryGroupRoundMTSums[currentFactory] + rowRoundMT) * 1000
      ) / 1000;
      if (isFirstForFactory) {
        factoryGroupFactorySums[currentFactory][currentFactory] = Math.round(
          (factoryGroupFactorySums[currentFactory][currentFactory] + factorySum) * 1000
        ) / 1000;
      }

      // We'll push to factory sheet after we have factoryGroupRoundMTSums finalised —
      // but we need a deferred approach since we know totals only after full group scan.
      // Solution: push now with placeholder, then overwrite dòng đầu khối after group loop.
      // Instead, track rows and patch after the group.rows.forEach loop.
      factoryGroupRowIndex[currentFactory] += 1;
      factorySheetRows[currentFactory].push(outputRow);
    });

    // ── Build factory sheet rows (41 cols, layout theo FACTORY_OUTPUT_HEADERS) ─
    // Thực hiện sau khi scan xong toàn bộ group để biết đủ factoryGroupRoundMTSums.
    // Factory row layout (41 cols):
    //   0-15: giống Process (Mã NCC → Round(MT))
    //   16: Tấn/ Chuyến  ← chỉ dòng đầu khối
    //   17: Tấn/ Hóa đơn ← chỉ dòng đầu invoice
    //   18-22: CLF/VFM/MCC/CLV/NDFC  ← dòng đầu khối = group sums; còn lại = invoice-level
    //   23-24: Col1/Col2 (tổng đầu khối / tổng tất cả dòng)
    //   25-40: metadata (Tài xế, Thông tin BS, ...)
    FACTORY_NAMES.forEach((factory) => {
      if (!factoryGroupHasRows[factory]) return;

      const groupRowCount = factoryGroupRowIndex[factory];
      const sheetLen = factorySheetRows[factory].length;
      const groupStartIdx = sheetLen - groupRowCount;

      const invoiceSeenForFactory = new Set<string>();

      for (let i = groupStartIdx; i < sheetLen; i++) {
        // processRow = outputRow được push trước đó (39 cols, layout Process)
        const processRow = factorySheetRows[factory][i] as (string | number)[];

        const isFirstRowOfGroup = (i === groupStartIdx);

        // Tấn/ Hóa đơn (col 17): dòng đầu mỗi invoice+factory
        const invoiceNo = String(processRow[1]); // col 1 = Số hóa đơn
        const invoiceKey = `${invoiceNo}|||${factory}`;
        const isFirstForInvoice = !invoiceSeenForFactory.has(invoiceKey);
        if (isFirstForInvoice) invoiceSeenForFactory.add(invoiceKey);
        const tanHoaDon: string | number = isFirstForInvoice
          ? (invoiceFactorySums.get(invoiceKey) ?? '')
          : '';

        // Tấn/ Chuyến (col 18): chỉ dòng đầu khối
        const tanChuyen: string | number = isFirstRowOfGroup
          ? factoryGroupRoundMTSums[factory]
          : '';

        // CLF/VFM/MCC/CLV/NDFC: chỉ hiển thị ở dòng đầu khối, các dòng khác để trống
        const clf  = isFirstRowOfGroup ? (groupFactorySums['CLF']  || '') : '';
        const vfm  = isFirstRowOfGroup ? (groupFactorySums['VFM']  || '') : '';
        const mcc  = isFirstRowOfGroup ? (groupFactorySums['MCC']  || '') : '';
        const clv  = isFirstRowOfGroup ? (groupFactorySums['CLV']  || '') : '';
        const ndfc = isFirstRowOfGroup ? (groupFactorySums['NDFC'] || '') : '';

        // Build factory row: cols 0-6 (giống Process), 7-8 (Khung giá, Đơn vị tính), 9-17 (Mã HH → Round(MT)), 18-45
        const factoryRow: (string | number)[] = [
          // 0-6: giống Process
          processRow[0],  // Mã nhà cung cấp
          processRow[1],  // Số hóa đơn
          processRow[2],  // Ngày hóa đơn
          processRow[3],  // Số tàu
          processRow[4],  // Mã khách hàng
          processRow[5],  // Tên khách hàng
          processRow[6],  // Địa chỉ giao hàng
          // 7-8: Khung giá, Đơn vị tính
          processRow[7],  // Khung giá
          processRow[8],  // Đơn vị tính
          // 9-17: Mã hàng hóa → Round(MT)
          processRow[9],  // Mã hàng hóa
          processRow[10], // Tên hàng hóa (Vie)
          processRow[11], // Tên hàng hóa (En)
          processRow[12], // Mã liên hệ giao hàng
          processRow[13], // Mã DVT
          processRow[14], // Số lượng (DVT bán hàng)
          processRow[15], // SP Trọng lượng net
          processRow[16], // HĐ Trọng lượng (Net)
          processRow[17], // Round(MT)
          // 18-19: Tấn/ Hóa đơn, Tấn/ Chuyến
          tanHoaDon,      // Tấn/ Hóa đơn
          tanChuyen,      // Tấn/ Chuyến
          // 20-24: CLF/VFM/MCC/CLV/NDFC
          clf,
          vfm,
          mcc,
          clv,
          ndfc,
          // 25-26: Col1/Col2 (từ processRow[23-24])
          isFirstRowOfGroup ? processRow[23] : '', // Col1 (tổng đầu khối — blank trên non-first rows)
          isFirstRowOfGroup ? processRow[24] : '', // Col2 (blank trên non-first rows)
          // 27-42: metadata (từ processRow[25-40])
          processRow[25], // Tài xế
          processRow[26], // Thông tin bổ sung
          processRow[27], // Slot
          processRow[28], // Diễn giải
          processRow[29], // Channel
          processRow[30], // SubChannel
          processRow[31], // SlotNo
          processRow[32], // user tạo HĐ
          processRow[33], // User tạo PXK
          processRow[34], // PO number
          processRow[35], // Warehouse No
          processRow[36], // Warehouse Name
          processRow[37], // Phiếu XK
          processRow[38], // Chứng từ ghi sổ
          processRow[39], // Số seri
          processRow[40], // Loại hàng
          processRow[41], // Tuyến cũ
          processRow[42], // Tuyến mới
          processRow[43], // Tuyến lên hóa đơn
        ];

        factorySheetRows[factory][i] = factoryRow;
      }
    });

    if (groupIndex < sortedGroups.length - 1) {
      const separatorRow: (string | number)[] = new Array(OUTPUT_HEADERS.length).fill('');
      separatorRow[17] = groupRoundMTSum;
      // col 7:  Khung giá — để trống trên separator row
      // col 8:  Đơn vị tính — để trống trên separator row
      separatorRow[18] = groupFactorySums['CLF'] || '';
      separatorRow[19] = groupFactorySums['VFM'] || '';
      separatorRow[20] = groupFactorySums['MCC'] || '';
      separatorRow[21] = groupFactorySums['CLV'] || '';
      separatorRow[22] = groupFactorySums['NDFC'] || '';
      separatorRow[23] = groupRoundMTSum;
      separatorRow[24] = groupRoundMTSum;
      separatorRowIndices.add(outputRows.length);
      outputRows.push(separatorRow);

      // Add separator rows to each factory sheet that had data rows in this group
      // Factory separator rows: 46 cols, indices theo FACTORY_OUTPUT_HEADERS
      // col 17: Round(MT) sum, col 7-8: empty (Khung giá & Đơn vị tính blank on separator)
      // col 18-19: empty (Tấn/ Hóa đơn & Tấn/ Chuyến blank on separator)
      // col 20-24: CLF/VFM/MCC/CLV/NDFC empty, col 25-26: Col1/Col2
      FACTORY_NAMES.forEach((factory) => {
        if (factoryGroupHasRows[factory]) {
          const fSeparatorRow: (string | number)[] = new Array(FACTORY_OUTPUT_HEADERS.length).fill('');
          const fRoundMTSum = factoryGroupRoundMTSums[factory];
          fSeparatorRow[17] = fRoundMTSum;
          // col 7 (Khung giá): để trống trên separator row
          // col 8 (Đơn vị tính): để trống trên separator row
          // col 18-19 (Tấn/ Hóa đơn, Tấn/ Chuyến): để trống trên separator row
          // Các cột CLF/VFM/MCC/CLV/NDFC: để trống trên separator row
          fSeparatorRow[25] = fRoundMTSum;
          fSeparatorRow[26] = fRoundMTSum;
          factorySeparatorRowIndices[factory].add(factorySheetRows[factory].length);
          factorySheetRows[factory].push(fSeparatorRow);
        }
      });
    }
  });

  // ── Step 5: Build output workbook ─────────────────────────────────────────
  const outWb = new Workbook();

  // Column indices (0-based) for CLF/VFM/MCC/CLV/NDFC headers in each sheet type
  const PROCESSED_GREEN_HEADER_COLS = new Set([18, 19, 20, 21, 22]); // CLF=18, VFM=19, MCC=20, CLV=21, NDFC=22
  const FACTORY_GREEN_HEADER_COLS   = new Set([20, 21, 22, 23, 24]); // CLF=20, VFM=21, MCC=22, CLV=23, NDFC=24

  /** Helper: write rows into a worksheet with header + separator styling */
  function writeSheetRows(
    ws: ReturnType<typeof outWb.addWorksheet>,
    rows: (string | number)[][],
    sepIndices: Set<number>,
    colWidths: { wch: number }[] = COL_WIDTHS,
    isFactorySheet: boolean = false
  ) {
    ws.columns = colWidths.map((w) => ({ width: w.wch }));

    const numberColsMap = isFactorySheet ? FACTORY_NUMBER_COLS : PROCESSED_NUMBER_COLS;
    const greenHeaderCols = isFactorySheet ? FACTORY_GREEN_HEADER_COLS : PROCESSED_GREEN_HEADER_COLS;

    rows.forEach((row, rowIndex) => {
      const excelRow = ws.addRow(row);

      // Apply styling (existing code)
      if (rowIndex === 0) {
        excelRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          const colIndex = colNumber - 1; // 0-based
          const isGreenCol = greenHeaderCols.has(colIndex);
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: isGreenCol ? 'FF00B050' : 'FFFFFF00' },
          };
          cell.font = { bold: true, color: isGreenCol ? { argb: 'FFFFFFFF' } : undefined };
        });
      } else if (sepIndices.has(rowIndex)) {
        excelRow.eachCell({ includeEmpty: true }, (cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
        });
      }

      // Apply number format
      excelRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const colIndex = colNumber - 1; // exceljs uses 1-based index
        const numFmt = numberColsMap[colIndex];
        if (numFmt && typeof cell.value === 'number') {
          cell.numFmt = numFmt;
        }
      });
    });
  }

  const outWs = outWb.addWorksheet('Processed');
  writeSheetRows(outWs, outputRows, separatorRowIndices, COL_WIDTHS, false);

  // Add per-factory sheets (CLF, VFM, MCC, CLV, NDFC) with factory-specific col widths
  FACTORY_NAMES.forEach((factory) => {
    const factoryWs = outWb.addWorksheet(factory);
    writeSheetRows(factoryWs, factorySheetRows[factory], factorySeparatorRowIndices[factory], COL_WIDTHS_FACTORY, true);
  });

  const outBuffer = await outWb.xlsx.writeBuffer();
  const outputBlob = new Blob([outBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const now = new Date();
  const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const outputFilename = `delivery_processed_${ts}.xlsx`;

  const dateRange =
    allDates.length > 0
      ? { from: allDates[0], to: allDates[allDates.length - 1] }
      : { from: '—', to: '—' };

  return {
    processedRows: dataRows.length,
    groupCount: sortedGroups.length,
    dateRange,
    warnings,
    outputBlob,
    outputFilename,
  };
}

// ─── Convenience wrapper ──────────────────────────────────────────────────────

/**
 * Main entry point: process a delivery data XLSX file end-to-end.
 * Returns a ProcessResult with the output Blob ready for download.
 * For pre-parsed rows (e.g. after weight adjustments), use processDeliveryDataFromRows().
 */
export async function processDeliveryData(file: File): Promise<ProcessResult> {
  const { rawRows, sourceRowNums } = await parseDeliveryFile(file);
  return processDeliveryDataFromRows(rawRows, sourceRowNums);
}