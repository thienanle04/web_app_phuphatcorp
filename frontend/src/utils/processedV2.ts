import ExcelJS from 'exceljs';

export const PROCESSED_SHEET_NAME = 'Processed';
export const PROCESSED_V2_SHEET_NAME = 'Processed v2';

export const NUM_FMT_QTY = '#,##0';
export const NUM_FMT_WEIGHT = '#,##0.000';

/**
 * Normalizes string or any cell value to a number.
 * Handles commas, dots, spaces, etc.
 * Returns null if the value is empty, null, undefined, or not a valid number.
 */
export function parseCellToNumber(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') {
    return isNaN(val) ? null : val;
  }
  if (typeof val === 'object' && val !== null) {
    if ('result' in val) {
      return parseCellToNumber((val as any).result);
    }
    if ('sharedFormula' in val || 'formula' in val) {
      return null;
    }
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed === '') return null;

    // Remove whitespace
    let cleaned = trimmed.replace(/\s+/g, '');

    // Handle thousand separators & decimal points
    if (cleaned.includes(',') && cleaned.includes('.')) {
      if (cleaned.indexOf('.') < cleaned.indexOf(',')) {
        // e.g. "1.234,56" -> remove dots, replace comma with dot
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
      } else {
        // e.g. "1,234.56" -> remove commas
        cleaned = cleaned.replace(/,/g, '');
      }
    } else if (cleaned.includes(',')) {
      // Only comma:
      if (/^\d{1,3}(,\d{3})+$/.test(cleaned)) {
        // e.g. "1,234" or "1,234,567"
        cleaned = cleaned.replace(/,/g, '');
      } else if (/^\d+,\d{1,2}$/.test(cleaned)) {
        // Decimal comma e.g. "12,5"
        cleaned = cleaned.replace(',', '.');
      } else {
        // Standard comma removal
        cleaned = cleaned.replace(/,/g, '');
      }
    }

    const num = Number(cleaned);
    return isNaN(num) ? null : num;
  }
  return null;
}

/**
 * Extracts raw primitive value from an ExcelJS cell value.
 * If the cell contains a formula or shared formula object, extracts the pre-calculated `result`
 * (or null if no result exists), avoiding orphan sharedFormula clones when columns/rows are moved.
 */
export function extractCellValue(val: any): any {
  if (val === null || val === undefined) return null;
  if (typeof val === 'object') {
    if ('result' in val) {
      return val.result !== undefined ? val.result : null;
    }
    if ('sharedFormula' in val || 'formula' in val) {
      return null;
    }
    if ('richText' in val && Array.isArray(val.richText)) {
      return val.richText.map((t: any) => t.text || '').join('');
    }
    if ('text' in val) {
      return val.text;
    }
  }
  return val;
}

export interface ProcessedV2ColIndices {
  colO: number; // Số lượng (DVT bán hàng)
  colP: number; // SP Trọng lượng net
  colQ: number; // HĐ Trọng lượng (Net)
  headerRowIdx: number;
}

/**
 * Finds column indices for Quantity (O), SP Net Weight (P), and HD Net Weight (Q)
 * by inspecting header rows 1-3. Fallbacks to columns 15, 16, 17.
 */
export function detectProcessedV2Columns(sheet: ExcelJS.Worksheet): ProcessedV2ColIndices {
  let headerRowIdx = 1;
  let colO = 15; // Col O
  let colP = 16; // Col P
  let colQ = 17; // Col Q

  for (let r = 1; r <= 3; r++) {
    const row = sheet.getRow(r);
    let foundCount = 0;
    row.eachCell((cell, colNumber) => {
      const txt = String(cell.value || '').trim().toLowerCase();
      if (txt) foundCount++;
      if (txt.includes('số lượng') || txt.includes('so luong') || txt.includes('dvt bán hàng')) {
        colO = colNumber;
      } else if (txt.includes('sp trọng lượng') || txt.includes('sp trong luong')) {
        colP = colNumber;
      } else if (txt.includes('hđ trọng lượng') || txt.includes('hd trọng lượng') || txt.includes('hd trong luong')) {
        colQ = colNumber;
      }
    });
    if (foundCount > 10) {
      headerRowIdx = r;
      break;
    }
  }

  return { colO, colP, colQ, headerRowIdx };
}

export interface SourceColMapping {
  headerRowIdx: number;
  colMaNcc: number;
  colSoHd: number;
  colNgayHd: number;
  colSoTau: number;
  colKhungGia: number;
  colO: number;
  colP: number;
  colQ: number;
  col5Nha: number;
  colClf: number;
  colVfm: number;
  colMcc: number;
  colClv: number;
  colNdfc: number;
  colGao: number | null;
  colTaiXe: number;
}

export function detectAllSourceColumns(sheet: ExcelJS.Worksheet): SourceColMapping {
  let headerRowIdx = 1;
  let colMaNcc = 1;
  let colSoHd = 2;
  let colNgayHd = 3;
  let colSoTau = 4;
  let colKhungGia = 8;
  let colO = 15;
  let colP = 16;
  let colQ = 17;
  let col5Nha = 24; // Cột X cũ
  let colClf = 19;
  let colVfm = 20;
  let colMcc = 21;
  let colClv = 22;
  let colNdfc = 23;
  let colGao: number | null = null;
  let colTaiXe = 26;

  for (let r = 1; r <= 3; r++) {
    const row = sheet.getRow(r);
    let foundCount = 0;
    row.eachCell((cell, colNumber) => {
      const txt = String(cell.value || '').trim().toLowerCase();
      if (txt) foundCount++;
      if (txt.includes('mã nhà cung cấp') || txt.includes('ma nha cung cap') || txt.includes('mã ncc') || txt.includes('ma ncc')) {
        colMaNcc = colNumber;
      } else if (txt.includes('số hóa đơn') || txt.includes('so hoa don') || txt.includes('số hđ') || txt.includes('so hd')) {
        colSoHd = colNumber;
      } else if (txt.includes('ngày hóa đơn') || txt.includes('ngay hoa don') || txt.includes('ngày hđ') || txt.includes('ngay hd')) {
        colNgayHd = colNumber;
      } else if (txt.includes('số tàu') || txt.includes('so tau') || txt.includes('số xe') || txt.includes('so xe')) {
        colSoTau = colNumber;
      } else if (txt.includes('khung giá') || txt.includes('khung gia')) {
        colKhungGia = colNumber;
      } else if (txt.includes('số lượng') || txt.includes('so luong') || txt.includes('dvt bán hàng')) {
        colO = colNumber;
      } else if (txt.includes('sp trọng lượng') || txt.includes('sp trong luong')) {
        colP = colNumber;
      } else if (txt.includes('hđ trọng lượng') || txt.includes('hd trọng lượng') || txt.includes('hd trong luong')) {
        colQ = colNumber;
      } else if (txt.includes('clf')) {
        colClf = colNumber;
      } else if (txt.includes('vfm')) {
        colVfm = colNumber;
      } else if (txt.includes('mcc')) {
        colMcc = colNumber;
      } else if (txt.includes('clv')) {
        colClv = colNumber;
      } else if (txt.includes('ndfc')) {
        colNdfc = colNumber;
      } else if (txt.includes('gạo') || txt.includes('gao')) {
        colGao = colNumber;
      } else if (txt.includes('tài xế') || txt.includes('tai xe')) {
        colTaiXe = colNumber;
      } else if (txt.includes('5 nhà') || txt.includes('5 nha')) {
        col5Nha = colNumber;
      }
    });
    if (foundCount > 10) {
      headerRowIdx = r;
      break;
    }
  }

  return {
    headerRowIdx,
    colMaNcc,
    colSoHd,
    colNgayHd,
    colSoTau,
    colKhungGia,
    colO,
    colP,
    colQ,
    col5Nha,
    colClf,
    colVfm,
    colMcc,
    colClv,
    colNdfc,
    colGao,
    colTaiXe,
  };
}

/**
 * Determines Khung giá based on trip weight (from 5 nhà total) and pallet flag.
 * Brackets:
 * - <= 2.5: '≤2.5 tấn'
 * - 2.5 < weight <= 8: '>2.5-8 tấn' (label only; the sheet keeps the source khung)
 * - 8 < weight <= 16: '>8-16 tấn'
 * - 16 < weight <= 23: '>16-23 tấn'
 * - > 23: '>23 tấn'
 * If isPallet: the word 'Pallet' only.
 */
export function determineKhungGia(weight: number, isPallet: boolean): string {
  if (isPallet) return 'Pallet';

  if (weight <= 2.5) return '≤2.5 tấn';
  if (weight <= 8) return '>2.5-8 tấn';
  if (weight <= 16) return '>8-16 tấn';
  if (weight <= 23) return '>16-23 tấn';
  return '>23 tấn';
}

const KHUNG_CHANGED_FILL = 'FFFFE599';
const SPLIT_CHECK_FILL = 'FFF8CBAD';

interface TripBlock {
  rows: number[];
  weight: number;
  isPallet: boolean;
  originalKhung: string;
  vehicle: string;
  vehicleKey: string;
  date: string;
  invoices: string[];
}

interface BlockCols {
  col5Nha: number;
  colKhungGia: number;
  colSoTau: number;
  colSoHd: number;
  colNgay: number;
}

function normalizeVehicleKey(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toUpperCase();
}

function formatTripTons(weight: number): string {
  const rounded = Math.round(weight * 1000) / 1000;
  const text = rounded.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
  return text.replace('.', ',');
}

function isLightSplitKhung(khung: string): boolean {
  const text = khung.trim();
  return text === '≤2.5 tấn' || text === '<=2.5 tấn';
}

function sheetCellText(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const day = String(value.getDate()).padStart(2, '0');
    const month = String(value.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}/${value.getFullYear()}`;
  }
  return String(value ?? '').trim();
}

function resolveBlockWeight(
  sheet: ExcelJS.Worksheet,
  rows: number[],
  sepWeight: number | null,
  col5Nha: number,
): number {
  let finalWeight = sepWeight;
  if (finalWeight === null || finalWeight === 0) {
    const firstRow5Nha = parseCellToNumber(sheet.getRow(rows[0]).getCell(col5Nha).value);
    if (firstRow5Nha !== null && firstRow5Nha > 0) {
      finalWeight = firstRow5Nha;
    } else {
      let sumW = 0;
      for (const rIdx of rows) {
        const row = sheet.getRow(rIdx);
        const weight = parseCellToNumber(row.getCell(col5Nha).value) || parseCellToNumber(row.getCell(18).value) || 0;
        sumW += weight;
      }
      finalWeight = Math.round(sumW * 1000) / 1000;
    }
  }
  return finalWeight ?? 0;
}

function describeTripBlock(
  sheet: ExcelJS.Worksheet,
  rows: number[],
  sepWeight: number | null,
  cols: BlockCols,
): TripBlock {
  let isPallet = false;
  const invoices: string[] = [];
  const seenInvoices = new Set<string>();
  let vehicle = '';
  let date = '';

  for (const rIdx of rows) {
    const row = sheet.getRow(rIdx);
    const soTau = sheetCellText(row.getCell(cols.colSoTau).value);
    const khung = sheetCellText(row.getCell(cols.colKhungGia).value);
    if (/pph-p|-p/i.test(soTau) || /pallet/i.test(khung)) {
      isPallet = true;
    }
    if (!vehicle && soTau) vehicle = soTau;
    if (!date) {
      const ngay = sheetCellText(row.getCell(cols.colNgay).value);
      if (ngay) date = ngay;
    }
    const invoice = sheetCellText(row.getCell(cols.colSoHd).value);
    if (invoice && !seenInvoices.has(invoice)) {
      seenInvoices.add(invoice);
      invoices.push(invoice);
    }
  }

  return {
    rows,
    weight: resolveBlockWeight(sheet, rows, sepWeight, cols.col5Nha),
    isPallet,
    originalKhung: sheetCellText(sheet.getRow(rows[0]).getCell(cols.colKhungGia).value),
    vehicle,
    vehicleKey: normalizeVehicleKey(vehicle),
    date,
    invoices,
  };
}

function isSameDayHeavyNeighbor(block: TripBlock, neighbor: TripBlock | undefined): boolean {
  if (!neighbor) return false;
  if (!block.vehicleKey || !block.date) return false;
  if (neighbor.vehicleKey !== block.vehicleKey) return false;
  if (neighbor.date !== block.date) return false;
  return neighbor.weight > 2.5;
}

function keepsSourceKhung(block: TripBlock, warned: boolean): boolean {
  if (warned) return true;
  return !block.isPallet && block.weight > 2.5 && block.weight <= 8;
}

function displayedKhung(block: TripBlock, warned: boolean): string {
  if (keepsSourceKhung(block, warned)) return block.originalKhung;
  return determineKhungGia(block.weight, block.isPallet);
}

function splitCheckNote(
  block: TripBlock,
  above: TripBlock | undefined,
  below: TripBlock | undefined,
  aboveWarned: boolean,
  belowWarned: boolean,
): string {
  const parts: string[] = [];
  if (above && isSameDayHeavyNeighbor(block, above)) {
    parts.push(`phía trên ${formatTripTons(above.weight)} tấn, khung ${displayedKhung(above, aboveWarned)}`);
  }
  if (below && isSameDayHeavyNeighbor(block, below)) {
    parts.push(`phía dưới ${formatTripTons(below.weight)} tấn, khung ${displayedKhung(below, belowWarned)}`);
  }
  return `Cần kiểm tra tách chuyến. Xe ${block.vehicle} ngày ${block.date}, ${parts.join('; ')}.`;
}

function applyKhungGia(
  sheet: ExcelJS.Worksheet,
  block: TripBlock,
  colKhungGia: number,
  notes: { row: number; text: string }[],
): void {
  const calculated = determineKhungGia(block.weight, block.isPallet);
  for (const rIdx of block.rows) {
    const cell = sheet.getRow(rIdx).getCell(colKhungGia);
    const originalKg = sheetCellText(cell.value);
    if (originalKg !== calculated) {
      cell.value = calculated;
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: KHUNG_CHANGED_FILL },
      };
      notes.push({ row: rIdx, text: originalKg });
    }
  }
}

function markSplitCheck(
  sheet: ExcelJS.Worksheet,
  block: TripBlock,
  note: string,
  colKhungGia: number,
  notes: { row: number; text: string }[],
): void {
  for (const rIdx of block.rows) {
    const cell = sheet.getRow(rIdx).getCell(colKhungGia);
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: SPLIT_CHECK_FILL },
    };
    notes.push({ row: rIdx, text: note });
  }
}

function bumpCellRow(ref: string): string {
  const match = /^([A-Z]+)(\d+)$/i.exec(ref.trim());
  if (!match) return ref;
  return `${match[1]}${Number(match[2]) + 1}`;
}

function followHeaderFreeze(sheet: ExcelJS.Worksheet): void {
  const views = sheet.views;
  if (!Array.isArray(views) || views.length === 0) return;
  sheet.views = views.map((view) => {
    if (view.state !== 'frozen' && view.state !== 'split') return view;
    const next = { ...view };
    if (typeof next.ySplit === 'number' && next.ySplit > 0) {
      next.ySplit += 1;
    }
    if (typeof next.topLeftCell === 'string') {
      next.topLeftCell = bumpCellRow(next.topLeftCell);
    }
    if (typeof next.activeCell === 'string' && next.activeCell) {
      next.activeCell = bumpCellRow(next.activeCell);
    }
    return next;
  });
}

function insertSplitCheckBanner(sheet: ExcelJS.Worksheet, invoices: string[]): void {
  const text = invoices.length > 0
    ? `Cần kiểm tra tách chuyến: ${invoices.join(', ')}`
    : 'Cần kiểm tra tách chuyến: không có';
  sheet.insertRow(1, [text]);
  const cell = sheet.getRow(1).getCell(1);
  cell.value = text;
  cell.font = { bold: true };
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: SPLIT_CHECK_FILL },
  };
  followHeaderFreeze(sheet);
}

/**
 * Duplicates the 'Processed' sheet into 'Processed v2' with:
 * - Columns 1..18 preserved
 * - Col 19: '5 nhà' (from old column X)
 * - Col 20: 'CLF' (from old CLF)
 * - Col 21: 'VFM' (from old VFM)
 * - Col 22: 'MCC' (from old MCC)
 * - Col 23: 'CLV' (from old CLV)
 * - Col 24: 'NDFC' (from old NDFC)
 * - Col 25: 'Gạo' (formatted as #,##0.000, empty)
 * - Col 26: 'Tài xế' (from old Tài xế)
 * - Col 27..: remaining columns after Tài xế
 * - Columns O (Qty), P/Q (Weights), and 19..25 (5 nhà, suppliers, Gạo) formatted as numeric.
 */
export function generateProcessedV2Sheet(workbook: ExcelJS.Workbook): ExcelJS.Worksheet {
  const sourceSheet =
    workbook.worksheets.find(
      (ws) => ws.name.trim().toLowerCase() === PROCESSED_SHEET_NAME.toLowerCase()
    ) || workbook.getWorksheet(PROCESSED_SHEET_NAME);

  if (!sourceSheet) {
    throw new Error('MISSING_PROCESSED_SHEET');
  }

  // If Processed v2 already exists, remove it
  const existingV2 = workbook.getWorksheet(PROCESSED_V2_SHEET_NAME);
  if (existingV2) {
    workbook.removeWorksheet(existingV2.id);
  }

  const v2Ws = workbook.addWorksheet(PROCESSED_V2_SHEET_NAME);

  const srcMapping = detectAllSourceColumns(sourceSheet);
  const headerRowIdx = srcMapping.headerRowIdx;

  // Build column mapping: dstCol -> srcCol (or null for new columns)
  // Total columns:
  // dst 1..18 -> src 1..18
  // dst 19 -> srcMapping.col5Nha (src 24)
  // dst 20 -> srcMapping.colClf (src 19)
  // dst 21 -> srcMapping.colVfm (src 20)
  // dst 22 -> srcMapping.colMcc (src 21)
  // dst 23 -> srcMapping.colClv (src 22)
  // dst 24 -> srcMapping.colNdfc (src 23)
  // dst 25 -> srcMapping.colGao (src null or gao)
  // dst 26 -> srcMapping.colTaiXe (src 26)
  // dst 27.. -> src 27..
  const maxSrcCols = Math.max(sourceSheet.columnCount, sourceSheet.columns?.length || 0, 44);
  const dstToSrcMap = new Map<number, number | null>();

  for (let c = 1; c <= 18; c++) {
    dstToSrcMap.set(c, c);
  }
  dstToSrcMap.set(19, srcMapping.col5Nha);
  dstToSrcMap.set(20, srcMapping.colClf);
  dstToSrcMap.set(21, srcMapping.colVfm);
  dstToSrcMap.set(22, srcMapping.colMcc);
  dstToSrcMap.set(23, srcMapping.colClv);
  dstToSrcMap.set(24, srcMapping.colNdfc);
  dstToSrcMap.set(25, srcMapping.colGao);
  dstToSrcMap.set(26, srcMapping.colTaiXe);

  // Map remaining columns starting from after Tài xế in sourceSheet
  let dstIdx = 27;
  for (let c = srcMapping.colTaiXe + 1; c <= maxSrcCols; c++) {
    dstToSrcMap.set(dstIdx, c);
    dstIdx++;
  }

  // Copy column widths
  for (const [dCol, sCol] of dstToSrcMap.entries()) {
    if (sCol) {
      const srcCol = sourceSheet.getColumn(sCol);
      if (srcCol && srcCol.width) {
        v2Ws.getColumn(dCol).width = srcCol.width;
      }
    } else {
      v2Ws.getColumn(dCol).width = 12;
    }
  }

  // Copy views if available
  if (sourceSheet.views) {
    try {
      v2Ws.views = JSON.parse(JSON.stringify(sourceSheet.views));
    } catch {
      // ignore
    }
  }

  // Helper for deep copying cell style
  const cloneStyle = (style: any) => {
    if (!style) return {};
    try {
      return JSON.parse(JSON.stringify(style));
    } catch {
      return { ...style };
    }
  };

  // Copy and transform rows
  for (let r = 1; r <= sourceSheet.rowCount; r++) {
    const srcRow = sourceSheet.getRow(r);
    const dstRow = v2Ws.getRow(r);
    if (srcRow.height) {
      dstRow.height = srcRow.height;
    }

    if (r < headerRowIdx) {
      // Rows before header (e.g. title or empty): direct copy
      srcRow.eachCell({ includeEmpty: true }, (cell, c) => {
        const dstCell = dstRow.getCell(c);
        dstCell.value = extractCellValue(cell.value);
        if (cell.style) dstCell.style = cloneStyle(cell.style);
      });
      continue;
    }

    if (r === headerRowIdx) {
      // Header row: apply mapped headers and standard names for 19..26
      for (const [dCol, sCol] of dstToSrcMap.entries()) {
        const dstCell = dstRow.getCell(dCol);
        if (sCol) {
          const srcCell = srcRow.getCell(sCol);
          if (srcCell.style) dstCell.style = cloneStyle(srcCell.style);
          dstCell.value = extractCellValue(srcCell.value);
        }

        // Standardize headers
        if (dCol === 19) {
          dstCell.value = '5 nhà';
          // Format giống CLF: lấy style từ cột CLF
          const refCell = srcRow.getCell(srcMapping.colClf);
          if (refCell && refCell.style) {
            dstCell.style = cloneStyle(refCell.style);
          }
          // Đảm bảo header màu xanh lá chuẩn (FF00B050) và chữ trắng bold giống CLF
          if (!dstCell.fill || (dstCell.fill as any).type !== 'pattern') {
            dstCell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FF00B050' },
            };
          } else if ((dstCell.fill as any).fgColor?.argb !== 'FF00B050') {
            (dstCell.fill as any).fgColor = { argb: 'FF00B050' };
          }
          if (!dstCell.font) {
            dstCell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
          } else {
            dstCell.font = {
              ...dstCell.font,
              bold: true,
              color: { argb: 'FFFFFFFF' },
            };
          }
        } else if (dCol === 20) {
          dstCell.value = 'CLF';
        } else if (dCol === 21) {
          dstCell.value = 'VFM';
        } else if (dCol === 22) {
          dstCell.value = 'MCC';
        } else if (dCol === 23) {
          dstCell.value = 'CLV';
        } else if (dCol === 24) {
          dstCell.value = 'NDFC';
        } else if (dCol === 25) {
          dstCell.value = 'Gạo';
          // Style like NDFC / CLV
          const refCell = srcRow.getCell(srcMapping.colNdfc);
          if (refCell.style) dstCell.style = cloneStyle(refCell.style);
        } else if (dCol === 26) {
          dstCell.value = 'Tài xế';
        }
      }
      continue;
    }

    // Data rows (r > headerRowIdx)
    for (const [dCol, sCol] of dstToSrcMap.entries()) {
      const dstCell = dstRow.getCell(dCol);

      let srcVal: any = null;
      if (sCol) {
        const srcCell = srcRow.getCell(sCol);
        srcVal = extractCellValue(srcCell.value);
        if (srcCell.style) dstCell.style = cloneStyle(srcCell.style);
        if (srcCell.note) dstCell.note = srcCell.note;
      } else {
        // Gạo column (new column, style like NDFC)
        const refCell = srcRow.getCell(srcMapping.colNdfc);
        if (refCell.style) dstCell.style = cloneStyle(refCell.style);
      }

      // Formatting logic:
      if (dCol === 15) {
        // Col O: Số lượng (DVT bán hàng)
        const numVal = parseCellToNumber(srcVal);
        if (numVal !== null) {
          dstCell.value = numVal;
          dstCell.numFmt = NUM_FMT_QTY;
        } else {
          dstCell.value = srcVal !== null && srcVal !== undefined ? srcVal : '';
        }
      } else if (dCol === 16 || dCol === 17 || dCol === 18) {
        // Col P (SP Net), Col Q (HD Net), Col R (Round MT)
        const numVal = parseCellToNumber(srcVal);
        if (numVal !== null) {
          dstCell.value = numVal;
          dstCell.numFmt = NUM_FMT_WEIGHT;
        } else {
          dstCell.value = srcVal !== null && srcVal !== undefined ? srcVal : '';
        }
      } else if (dCol >= 19 && dCol <= 25) {
        // 5 nhà, CLF, VFM, MCC, CLV, NDFC, Gạo
        const numVal = parseCellToNumber(srcVal);
        if (numVal !== null) {
          dstCell.value = numVal;
          dstCell.numFmt = NUM_FMT_WEIGHT;
        } else {
          dstCell.value = '';
          dstCell.numFmt = NUM_FMT_WEIGHT;
        }
      } else {
        // Other columns: direct value
        dstCell.value = srcVal !== null && srcVal !== undefined ? srcVal : '';
      }
    }

    // Standardize '5 nhà' column on separator rows to prevent undercounted col 24 in raw input
    const maNccVal = String(dstRow.getCell(srcMapping.colMaNcc).value || '').trim();
    const soHdVal = String(dstRow.getCell(srcMapping.colSoHd).value || '').trim();
    const soTauVal = String(dstRow.getCell(srcMapping.colSoTau).value || '').trim();
    const numRoundMt = parseCellToNumber(dstRow.getCell(18).value);
    const num5Nha = parseCellToNumber(dstRow.getCell(19).value);

    const isSep = !maNccVal && !soHdVal && !soTauVal && ((num5Nha !== null && num5Nha > 0) || (numRoundMt !== null && numRoundMt > 0));
    if (isSep) {
      const cClf = parseCellToNumber(dstRow.getCell(20).value) || 0;
      const cVfm = parseCellToNumber(dstRow.getCell(21).value) || 0;
      const cMcc = parseCellToNumber(dstRow.getCell(22).value) || 0;
      const cClv = parseCellToNumber(dstRow.getCell(23).value) || 0;
      const cNdfc = parseCellToNumber(dstRow.getCell(24).value) || 0;
      const cGao = parseCellToNumber(dstRow.getCell(25).value) || 0;
      const sumH = Math.round((cClf + cVfm + cMcc + cClv + cNdfc + cGao) * 1000) / 1000;
      const col25SrcNum = parseCellToNumber(srcRow.getCell(25).value);

      const true5Nha = Math.round(Math.max(sumH, numRoundMt || 0, num5Nha || 0, col25SrcNum || 0) * 1000) / 1000;
      if (true5Nha > 0) {
        dstRow.getCell(19).value = true5Nha;
        dstRow.getCell(19).numFmt = NUM_FMT_WEIGHT;
      }
    }
  }

  // Update Khung giá based on trip subtotal in column '5 nhà' (col 19).
  // Weight in (2.5, 8] keeps the source khung. A ≤2.5 block beside a heavier
  // same-day trip of the same truck is flagged for the accountant.
  const col5NhaDst = 19;
  const colKhungGiaDst = srcMapping.colKhungGia;
  const colSoTauDst = srcMapping.colSoTau;
  const colSoHdDst = srcMapping.colSoHd;
  const colMaNccDst = srcMapping.colMaNcc;
  const colNgayDst = srcMapping.colNgayHd;
  const blockCols: BlockCols = {
    col5Nha: col5NhaDst,
    colKhungGia: colKhungGiaDst,
    colSoTau: colSoTauDst,
    colSoHd: colSoHdDst,
    colNgay: colNgayDst,
  };

  const blocks: TripBlock[] = [];
  let currentBlockRows: number[] = [];

  const pushBlock = (blockRows: number[], sepWeight5Nha: number | null) => {
    if (blockRows.length === 0) return;
    blocks.push(describeTripBlock(v2Ws, blockRows, sepWeight5Nha, blockCols));
  };

  // Check if sheet uses separator rows
  let hasSeparatorRows = false;
  for (let r = headerRowIdx + 1; r <= v2Ws.rowCount; r++) {
    const row = v2Ws.getRow(r);
    const maNccVal = String(row.getCell(colMaNccDst).value || '').trim();
    const soHdVal = String(row.getCell(colSoHdDst).value || '').trim();
    const soTauVal = String(row.getCell(colSoTauDst).value || '').trim();
    const cell5NhaNum = parseCellToNumber(row.getCell(col5NhaDst).value);
    const roundMtNum = parseCellToNumber(row.getCell(18).value);
    if (!maNccVal && !soHdVal && !soTauVal && ((cell5NhaNum !== null && cell5NhaNum > 0) || (roundMtNum !== null && roundMtNum > 0))) {
      hasSeparatorRows = true;
      break;
    }
  }

  for (let r = headerRowIdx + 1; r <= v2Ws.rowCount; r++) {
    const row = v2Ws.getRow(r);
    const maNccVal = String(row.getCell(colMaNccDst).value || '').trim();
    const soHdVal = String(row.getCell(colSoHdDst).value || '').trim();
    const soTauVal = String(row.getCell(colSoTauDst).value || '').trim();
    const cell5NhaNum = parseCellToNumber(row.getCell(col5NhaDst).value);
    const roundMtNum = parseCellToNumber(row.getCell(18).value);

    // Check if row has any non-empty cell
    let hasAnyCell = false;
    row.eachCell({ includeEmpty: false }, (cell) => {
      if (cell.value !== null && cell.value !== undefined && cell.value !== '') {
        hasAnyCell = true;
      }
    });
    if (!hasAnyCell) {
      continue;
    }

    // Check if separator row:
    const isSeparatorRow = !maNccVal && !soHdVal && !soTauVal && ((cell5NhaNum !== null && cell5NhaNum > 0) || (roundMtNum !== null && roundMtNum > 0));

    if (isSeparatorRow) {
      const cClf = parseCellToNumber(row.getCell(20).value) || 0;
      const cVfm = parseCellToNumber(row.getCell(21).value) || 0;
      const cMcc = parseCellToNumber(row.getCell(22).value) || 0;
      const cClv = parseCellToNumber(row.getCell(23).value) || 0;
      const cNdfc = parseCellToNumber(row.getCell(24).value) || 0;
      const cGao = parseCellToNumber(row.getCell(25).value) || 0;
      const sumH = Math.round((cClf + cVfm + cMcc + cClv + cNdfc + cGao) * 1000) / 1000;

      const sepWeight = Math.round(Math.max(sumH, cell5NhaNum || 0, roundMtNum || 0) * 1000) / 1000;
      pushBlock(currentBlockRows, sepWeight);
      currentBlockRows = [];
    } else {
      // Only split by truck change if the sheet does NOT use separator rows
      if (!hasSeparatorRows && currentBlockRows.length > 0 && soTauVal) {
        const prevRow = v2Ws.getRow(currentBlockRows[currentBlockRows.length - 1]);
        const prevSoTau = String(prevRow.getCell(colSoTauDst).value || '').trim();
        if (prevSoTau && soTauVal !== prevSoTau) {
          pushBlock(currentBlockRows, null);
          currentBlockRows = [];
        }
      }
      currentBlockRows.push(r);
    }
  }

  if (currentBlockRows.length > 0) {
    pushBlock(currentBlockRows, null);
  }

  const warnedFlags = blocks.map((block, index) => {
    if (block.isPallet || !isLightSplitKhung(block.originalKhung)) return false;
    return isSameDayHeavyNeighbor(block, blocks[index - 1]) || isSameDayHeavyNeighbor(block, blocks[index + 1]);
  });

  const pendingNotes: { row: number; text: string }[] = [];

  blocks.forEach((block, index) => {
    if (keepsSourceKhung(block, warnedFlags[index])) return;
    applyKhungGia(v2Ws, block, colKhungGiaDst, pendingNotes);
  });

  const bannerInvoices: string[] = [];
  const seenBannerInvoices = new Set<string>();
  blocks.forEach((block, index) => {
    if (!warnedFlags[index]) return;
    const above = blocks[index - 1];
    const below = blocks[index + 1];
    const note = splitCheckNote(
      block,
      above,
      below,
      above ? warnedFlags[index - 1] : false,
      below ? warnedFlags[index + 1] : false,
    );
    markSplitCheck(v2Ws, block, note, colKhungGiaDst, pendingNotes);
    for (const invoice of block.invoices) {
      if (seenBannerInvoices.has(invoice)) continue;
      seenBannerInvoices.add(invoice);
      bannerInvoices.push(invoice);
    }
  });

  insertSplitCheckBanner(v2Ws, bannerInvoices);
  for (const item of pendingNotes) {
    v2Ws.getRow(item.row + 1).getCell(colKhungGiaDst).note = item.text;
  }

  return v2Ws;
}
