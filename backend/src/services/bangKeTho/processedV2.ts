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
 * - 2.5 < weight <= 8: '>2.5-8 tấn'
 * - 8 < weight <= 16: '>8-16 tấn'
 * - 16 < weight <= 23: '>16-23 tấn'
 * - > 23: '>23 tấn'
 * If isPallet: suffix ' + Pallet'
 */
export function determineKhungGia(weight: number, isPallet: boolean): string {
  let baseKhung = '>8-16 tấn';
  if (weight <= 2.5) {
    baseKhung = '≤2.5 tấn';
  } else if (weight <= 8) {
    baseKhung = '>2.5-8 tấn';
  } else if (weight <= 16) {
    baseKhung = '>8-16 tấn';
  } else if (weight <= 23) {
    baseKhung = '>16-23 tấn';
  } else {
    baseKhung = '>23 tấn';
  }

  return isPallet ? `${baseKhung} + Pallet` : baseKhung;
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

  // Update Khung giá based on trip subtotal in column '5 nhà' (col 19)
  const col5NhaDst = 19;
  const colKhungGiaDst = srcMapping.colKhungGia;
  const colSoTauDst = srcMapping.colSoTau;
  const colSoHdDst = srcMapping.colSoHd;
  const colMaNccDst = srcMapping.colMaNcc;

  let currentBlockRows: number[] = [];

  const flushBlock = (blockRows: number[], sepWeight5Nha: number | null) => {
    if (blockRows.length === 0) return;

    // Check if any row in this block is pallet
    let isBlockPallet = false;
    for (const rIdx of blockRows) {
      const row = v2Ws.getRow(rIdx);
      const soTauVal = String(row.getCell(colSoTauDst).value || '').trim();
      const oldKg = String(row.getCell(colKhungGiaDst).value || '').trim();
      if (/pph-p|-p/i.test(soTauVal) || /pallet/i.test(oldKg)) {
        isBlockPallet = true;
        break;
      }
    }

    // Determine weight for this block
    let finalWeight = sepWeight5Nha;
    if (finalWeight === null || finalWeight === 0) {
      // Fallback 1: check if first row in block has a 5 nhà total (e.g. from Col1)
      const firstRow5Nha = parseCellToNumber(v2Ws.getRow(blockRows[0]).getCell(col5NhaDst).value);
      if (firstRow5Nha !== null && firstRow5Nha > 0) {
        finalWeight = firstRow5Nha;
      } else {
        // Fallback 2: sum weights across all data rows in block
        let sumW = 0;
        for (const rIdx of blockRows) {
          const r = v2Ws.getRow(rIdx);
          const w = parseCellToNumber(r.getCell(col5NhaDst).value) || parseCellToNumber(r.getCell(18).value) || 0;
          sumW += w;
        }
        finalWeight = Math.round(sumW * 1000) / 1000;
      }
    }

    const calculatedKhungGia = determineKhungGia(finalWeight, isBlockPallet);

    // Update Khung giá on each row in the block
    for (const rIdx of blockRows) {
      const row = v2Ws.getRow(rIdx);
      const kgCell = row.getCell(colKhungGiaDst);
      const originalKg = String(kgCell.value || '').trim();

      if (originalKg !== calculatedKhungGia) {
        kgCell.value = calculatedKhungGia;
        kgCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFE599' },
        };
        kgCell.note = originalKg;
      }
    }
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
      flushBlock(currentBlockRows, sepWeight);
      currentBlockRows = [];
    } else {
      // Only split by truck change if the sheet does NOT use separator rows
      if (!hasSeparatorRows && currentBlockRows.length > 0 && soTauVal) {
        const prevRow = v2Ws.getRow(currentBlockRows[currentBlockRows.length - 1]);
        const prevSoTau = String(prevRow.getCell(colSoTauDst).value || '').trim();
        if (prevSoTau && soTauVal !== prevSoTau) {
          flushBlock(currentBlockRows, null);
          currentBlockRows = [];
        }
      }
      currentBlockRows.push(r);
    }
  }

  // Flush remaining block (e.g. last group without separator row)
  if (currentBlockRows.length > 0) {
    flushBlock(currentBlockRows, null);
  }

  return v2Ws;
}
