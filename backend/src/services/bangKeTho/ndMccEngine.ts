import ExcelJS from 'exceljs';
import { bangKeThoPricingLookup, resolveTargetBook } from './pricingLookup';
import { generateProcessedV2Sheet } from './processedV2';

export interface NdMccStats {
  mcc_rows: number;
  ndfc_rows: number;
  mcc_invoices: number;
  ndfc_invoices: number;
}

export interface ProcessNdMccResult {
  buffer: Buffer;
  stats: NdMccStats;
}

interface ProcessedRow {
  rowIdx: number;
  supplierCode: string;
  invoiceNo: string;
  invoiceDate: any; // Date | number | string
  invoiceDateIso: string;
  truckNo: string;
  customerCode: string;
  customerName: string;
  address: string;
  khungGia: string;
  dvt: string;
  itemCode: string;
  itemNameVie: string;
  itemNameEn: string;
  contactCode: string;
  dvtCode: string;
  qty: number;
  spNetWeight: number;
  hdNetWeight: number;
  roundMt: number;
  clf: number | null;
  vfm: number | null;
  mcc: number | null;
  clv: number | null;
  ndfc: number | null;
  gao: number | null;
  driver: string;
  extraInfo: string;
  slot: string;
  description: string;
  channel: string;
  subChannel: string;
  slotNo: string;
  userHd: string;
  userPxk: string;
  poNumber: string;
  whNo: string;
  whName: string;
  pxk: string;
  journal: string;
  serialNo: string;
  itemType: string;
  oldRoute: string;
  newRoute: string;
  invoiceRoute: string;
  // Lookups
  dealer: string;
  actualDest: string;
  feeDest: string;
  customerId: number | null;
  transportRate: number | null;
  feeBocXep: number | null;
  feeChuyenTai: number | null;
  feeGhepDiem: number | null;
  site: string;
  khuVuc: string;
  isPartialMatch?: boolean;
  matchedAddress?: string;
  tripSummary?: TripFiveHousesSummary;
}

export interface TripFiveHousesSummary {
  clf: number | null;
  vfm: number | null;
  mcc: number | null;
  clv: number | null;
  ndfc: number | null;
  gao: number | null;
  total5Nha: number | null;
}

function excelSerialToIso(serial: number): string {
  // Excel epoch begins Dec 30 1899 due to 1900 leap year bug
  const utcDays = Math.floor(serial - 25569);
  const date = new Date(utcDays * 86400 * 1000);
  return date.toISOString().slice(0, 10);
}

function parseDateIso(val: any): string {
  if (val instanceof Date) {
    return val.toISOString().slice(0, 10);
  }
  if (typeof val === 'number') {
    return excelSerialToIso(val);
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      return trimmed.slice(0, 10);
    }
    const parts = trimmed.split(/[/.-]/);
    if (parts.length === 3) {
      if (parts[2].length === 4) {
        // DD/MM/YYYY
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
  }
  return new Date().toISOString().slice(0, 10);
}

function determineKhuVuc(channel: string, subChannel: string, customerName: string): string {
  const combined = `${channel} ${subChannel} ${customerName}`.toUpperCase();
  if (
    combined.includes('MT') ||
    combined.includes('SIÊU THỊ') ||
    combined.includes('SUPERMARKET') ||
    combined.includes('COOP') ||
    combined.includes('LOTTE') ||
    combined.includes('BIG C') ||
    combined.includes('GO!') ||
    combined.includes('WINCOMMERCE') ||
    combined.includes('VINCOMMERCE') ||
    combined.includes('AEON') ||
    combined.includes('BHX') ||
    combined.includes('BÁCH HÓA XANH')
  ) {
    return 'ST';
  }
  return 'TINH';
}

function determineSite(supplierCode: string, slot: string): string {
  const sUpper = (slot || '').toUpperCase();
  if (supplierCode === '2000000007') {
    if (sUpper === 'WH UNIDEPOT') return 'UNI-MCC';
    return 'MCC';
  }
  if (supplierCode === '2000000008') {
    if (sUpper === 'UNI 3') return 'UNI-NDFC';
    return 'NDFC';
  }
  return '';
}

export const ORDERED_SHEET_NAMES = [
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
] as const;

export const PARTIAL_MATCH_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFFEB9C' }, // Soft warning yellow
};

export const PARTIAL_MATCH_NOTE = 'Không khớp hoàn toàn với cơ sở dữ liệu';

function setSheetNameSafely(ws: ExcelJS.Worksheet, targetName: string): void {
  if (ws.name === targetName) return;
  if (ws.name.toLowerCase() === targetName.toLowerCase()) {
    (ws as any)._name = targetName;
  } else {
    ws.name = targetName;
  }
}

export async function processNdMccWorkbook(
  inputBuffer: Buffer
): Promise<ProcessNdMccResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(inputBuffer as any);

  const processedSheet =
    workbook.worksheets.find(
      (ws) => ws.name.trim().toLowerCase() === 'processed'
    ) || workbook.getWorksheet('Processed');
  if (!processedSheet) {
    throw new Error('MISSING_PROCESSED_SHEET');
  }

  // Generate Processed v2 sheet early so that all data reading uses the clean, standardized sheet
  const processedV2Sheet = generateProcessedV2Sheet(workbook);

  // Find column mapping from header row (row 1 or 2) in Processed v2
  let headerRowIdx = 1;
  const colMap = new Map<string, number>();

  for (let r = 1; r <= 3; r++) {
    const row = processedV2Sheet.getRow(r);
    let foundHeaders = 0;
    row.eachCell((cell, colNumber) => {
      const txt = String(cell.value || '').trim();
      if (txt) foundHeaders++;
    });
    if (foundHeaders > 10) {
      headerRowIdx = r;
      row.eachCell((cell, colNumber) => {
        const txt = String(cell.value || '').trim();
        if (txt) colMap.set(txt, colNumber);
      });
      break;
    }
  }

  const getCellVal = (row: ExcelJS.Row, headerName: string, fallbackIdx?: number): any => {
    const colIdx = colMap.get(headerName) ?? fallbackIdx;
    if (!colIdx) return null;
    const cell = row.getCell(colIdx);
    if (cell.value && typeof cell.value === 'object' && 'result' in cell.value) {
      return (cell.value as any).result;
    }
    return cell.value;
  };

  const getCellNum = (row: ExcelJS.Row, headerName: string, fallbackIdx?: number): number => {
    const val = getCellVal(row, headerName, fallbackIdx);
    if (val === null || val === undefined || val === '') return 0;
    const num = parseFloat(val);
    return isNaN(num) ? 0 : num;
  };

  const getCellStr = (row: ExcelJS.Row, headerName: string, fallbackIdx?: number): string => {
    const val = getCellVal(row, headerName, fallbackIdx);
    if (val === null || val === undefined) return '';
    return String(val).trim();
  };

  await bangKeThoPricingLookup.initCache();

  const allRows: ProcessedRow[] = [];

  const parseProcessedRow = (
    r: number,
    row: ExcelJS.Row,
    tripSummary: TripFiveHousesSummary
  ): ProcessedRow | null => {
    const supplierCode = getCellStr(row, 'Mã nhà cung cấp', 1);
    if (!supplierCode || (supplierCode !== '2000000007' && supplierCode !== '2000000008')) {
      return null;
    }

    const invoiceNo = getCellStr(row, 'Số hóa đơn', 2);
    const invoiceDate = getCellVal(row, 'Ngày hóa đơn', 3);
    const invoiceDateIso = parseDateIso(invoiceDate);
    const truckNo = getCellStr(row, 'Số tàu', 4);
    const customerCode = getCellStr(row, 'Mã khách hàng', 5);
    const customerName = getCellStr(row, 'Tên khách hàng', 6);
    const address = getCellStr(row, 'Địa chỉ giao hàng', 7);
    const khungGia = getCellStr(row, 'Khung giá', 8);
    const dvt = getCellStr(row, 'Đơn vị tính', 9);
    const itemCode = getCellStr(row, 'Mã hàng hóa', 10);
    const itemNameVie = getCellStr(row, 'Tên hàng hóa (Vie)', 11);
    const itemNameEn = getCellStr(row, 'Tên hàng hóa (En)', 12);
    const contactCode = getCellStr(row, 'Mã liên hệ giao hàng', 13);
    const dvtCode = getCellStr(row, 'Mã DVT', 14);
    const qty = getCellNum(row, 'Số lượng (DVT bán hàng)', 15);
    const spNetWeight = getCellNum(row, 'SP Trọng lượng net', 16);
    const hdNetWeight = getCellNum(row, 'HĐ Trọng lượng (Net)', 17);
    const roundMt = hdNetWeight ? Math.round((hdNetWeight / 1000) * 1000) / 1000 : 0;

    const clf = tripSummary.clf;
    const vfm = tripSummary.vfm;
    const mcc = tripSummary.mcc;
    const clv = tripSummary.clv;
    const ndfc = tripSummary.ndfc;
    const gao = tripSummary.gao;

    const driver = getCellStr(row, 'Tài xế', 26);
    const extraInfo = getCellStr(row, 'Thông tin bổ sung', 27);
    const slot = getCellStr(row, 'Slot', 28);
    const description = getCellStr(row, 'Diễn giải', 29);
    const channel = getCellStr(row, 'Channel', 30);
    const subChannel = getCellStr(row, 'SubChannel', 31);
    const slotNo = getCellStr(row, 'SlotNo', 32);
    const userHd = getCellStr(row, 'user tạo HĐ', 33);
    const userPxk = getCellStr(row, 'User tạo PXK', 34);
    const poNumber = getCellStr(row, 'PO number', 35);
    const whNo = getCellStr(row, 'Warehouse No', 36);
    const whName = getCellStr(row, 'Warehouse Name', 37);
    const pxk = getCellStr(row, 'Phiếu XK', 38);
    const journal = getCellStr(row, 'Chứng từ ghi sổ', 39);
    const serialNo = getCellStr(row, 'Số seri', 40);
    const itemType = getCellStr(row, 'Loại hàng', 41);
    const oldRoute = getCellStr(row, 'Tuyến cũ', 42);
    const newRoute = getCellStr(row, 'Tuyến mới', 43);
    const invoiceRoute = getCellStr(row, 'Tuyến lên hóa đơn', 44);

    return {
      rowIdx: r,
      supplierCode,
      invoiceNo,
      invoiceDate,
      invoiceDateIso,
      truckNo,
      customerCode,
      customerName,
      address,
      khungGia,
      dvt,
      itemCode,
      itemNameVie,
      itemNameEn,
      contactCode,
      dvtCode,
      qty,
      spNetWeight,
      hdNetWeight,
      roundMt,
      clf,
      vfm,
      mcc,
      clv,
      ndfc,
      gao,
      driver,
      extraInfo,
      slot,
      description,
      channel,
      subChannel,
      slotNo,
      userHd,
      userPxk,
      poNumber,
      whNo,
      whName,
      pxk,
      journal,
      serialNo,
      itemType,
      oldRoute,
      newRoute,
      invoiceRoute,
      dealer: '',
      actualDest: '',
      feeDest: '',
      customerId: null,
      transportRate: null,
      feeBocXep: null,
      feeChuyenTai: null,
      feeGhepDiem: null,
      site: determineSite(supplierCode, slot),
      khuVuc: determineKhuVuc(channel, subChannel, customerName),
      tripSummary,
    };
  };

  interface BlockItem {
    r: number;
    row: ExcelJS.Row;
  }
  let currentBlock: BlockItem[] = [];

  const flushBlock = (
    items: BlockItem[],
    sepSummary: TripFiveHousesSummary | null
  ) => {
    if (items.length === 0) return;

    let finalSummary: TripFiveHousesSummary;
    if (
      sepSummary &&
      (sepSummary.clf !== null ||
        sepSummary.vfm !== null ||
        sepSummary.mcc !== null ||
        sepSummary.clv !== null ||
        sepSummary.ndfc !== null ||
        sepSummary.gao !== null ||
        sepSummary.total5Nha !== null)
    ) {
      const computedTotal =
        sepSummary.total5Nha !== null && sepSummary.total5Nha > 0
          ? sepSummary.total5Nha
          : (sepSummary.clf || 0) +
            (sepSummary.vfm || 0) +
            (sepSummary.mcc || 0) +
            (sepSummary.clv || 0) +
            (sepSummary.ndfc || 0) +
            (sepSummary.gao || 0);

      finalSummary = {
        ...sepSummary,
        total5Nha: computedTotal > 0 ? Math.round(computedTotal * 1000) / 1000 : null,
      };
    } else {
      // Fallback: calculate trip total and houses from data rows in this block
      let fClf = 0;
      let fVfm = 0;
      let fMcc = 0;
      let fClv = 0;
      let fNdfc = 0;
      let fGao = 0;

      for (const item of items) {
        const sCode = getCellStr(item.row, 'Mã nhà cung cấp', 1);
        const wVal =
          (getCellNum(item.row, 'HĐ Trọng lượng (Net)', 17) || 0) / 1000 ||
          getCellNum(item.row, 'ROUND (MT)', 18) ||
          getCellNum(item.row, 'Round(MT)', 18) ||
          0;
        const w = Math.round(wVal * 1000) / 1000;

        const rowClf = getCellNum(item.row, 'CLF', 20);
        const rowVfm = getCellNum(item.row, 'VFM', 21);
        const rowMcc = getCellNum(item.row, 'MCC', 22);
        const rowClv = getCellNum(item.row, 'CLV', 23);
        const rowNdfc = getCellNum(item.row, 'NDFC', 24);
        const rowGao = getCellNum(item.row, 'Gạo', 25) || getCellNum(item.row, 'GẠO', 25);

        if (rowClf) fClf += rowClf;
        else if (sCode === '2000000001' || sCode.toUpperCase().includes('CLF')) fClf += w;

        if (rowVfm) fVfm += rowVfm;
        else if (sCode === '2000000002' || sCode.toUpperCase().includes('VFM')) fVfm += w;

        if (rowMcc) fMcc += rowMcc;
        else if (sCode === '2000000007' || sCode.toUpperCase().includes('MCC')) fMcc += w;

        if (rowClv) fClv += rowClv;
        else if (sCode === '2000000004' || sCode.toUpperCase().includes('CLV')) fClv += w;

        if (rowNdfc) fNdfc += rowNdfc;
        else if (sCode === '2000000008' || sCode.toUpperCase().includes('NDFC')) fNdfc += w;

        if (rowGao) fGao += rowGao;
      }

      const total = fClf + fVfm + fMcc + fClv + fNdfc + fGao;
      finalSummary = {
        clf: fClf > 0 ? Math.round(fClf * 1000) / 1000 : null,
        vfm: fVfm > 0 ? Math.round(fVfm * 1000) / 1000 : null,
        mcc: fMcc > 0 ? Math.round(fMcc * 1000) / 1000 : null,
        clv: fClv > 0 ? Math.round(fClv * 1000) / 1000 : null,
        ndfc: fNdfc > 0 ? Math.round(fNdfc * 1000) / 1000 : null,
        gao: fGao > 0 ? Math.round(fGao * 1000) / 1000 : null,
        total5Nha: total > 0 ? Math.round(total * 1000) / 1000 : null,
      };
    }

    for (const item of items) {
      const parsed = parseProcessedRow(item.r, item.row, finalSummary);
      if (parsed) {
        allRows.push(parsed);
      }
    }
  };

  // Check if sheet uses separator rows
  let hasSeparatorRows = false;
  for (let r = headerRowIdx + 1; r <= processedV2Sheet.rowCount; r++) {
    const row = processedV2Sheet.getRow(r);
    const supplierCode = getCellStr(row, 'Mã nhà cung cấp', 1);
    const invoiceNo = getCellStr(row, 'Số hóa đơn', 2);
    const truckNo = getCellStr(row, 'Số tàu', 4);
    const cell5NhaNum = getCellNum(row, '5 nhà', 19);
    const roundMtNum = getCellNum(row, 'ROUND (MT)', 18) || getCellNum(row, 'Round(MT)', 18);
    if (!supplierCode && !invoiceNo && !truckNo && ((cell5NhaNum !== null && cell5NhaNum > 0) || (roundMtNum !== null && roundMtNum > 0))) {
      hasSeparatorRows = true;
      break;
    }
  }

  for (let r = headerRowIdx + 1; r <= processedV2Sheet.rowCount; r++) {
    const row = processedV2Sheet.getRow(r);
    const supplierCode = getCellStr(row, 'Mã nhà cung cấp', 1);
    const invoiceNo = getCellStr(row, 'Số hóa đơn', 2);
    const truckNo = getCellStr(row, 'Số tàu', 4);
    const cell5NhaNum = getCellNum(row, '5 nhà', 19);
    const roundMtNum = getCellNum(row, 'ROUND (MT)', 18) || getCellNum(row, 'Round(MT)', 18);

    let hasAnyCell = false;
    row.eachCell({ includeEmpty: false }, (cell) => {
      if (cell.value !== null && cell.value !== undefined && cell.value !== '') {
        hasAnyCell = true;
      }
    });
    if (!hasAnyCell) {
      continue;
    }

    const isSeparatorRow =
      !supplierCode &&
      !invoiceNo &&
      !truckNo &&
      ((cell5NhaNum !== null && cell5NhaNum > 0) || (roundMtNum !== null && roundMtNum > 0));

    if (isSeparatorRow) {
      const sepClf = getCellNum(row, 'CLF', 20) || null;
      const sepVfm = getCellNum(row, 'VFM', 21) || null;
      const sepMcc = getCellNum(row, 'MCC', 22) || null;
      const sepClv = getCellNum(row, 'CLV', 23) || null;
      const sepNdfc = getCellNum(row, 'NDFC', 24) || null;
      const sepGao = getCellNum(row, 'Gạo', 25) || getCellNum(row, 'GẠO', 25) || null;
      const sumH = (sepClf || 0) + (sepVfm || 0) + (sepMcc || 0) + (sepClv || 0) + (sepNdfc || 0) + (sepGao || 0);

      const sep5Nha = Math.round(Math.max(sumH, cell5NhaNum || 0, roundMtNum || 0) * 1000) / 1000;

      flushBlock(currentBlock, {
        clf: sepClf,
        vfm: sepVfm,
        mcc: sepMcc,
        clv: sepClv,
        ndfc: sepNdfc,
        gao: sepGao,
        total5Nha: sep5Nha,
      });
      currentBlock = [];
    } else {
      // Only split by truck change if the sheet does NOT use separator rows
      if (!hasSeparatorRows && currentBlock.length > 0 && truckNo) {
        const prevTruck = getCellStr(currentBlock[currentBlock.length - 1].row, 'Số tàu', 4);
        if (prevTruck && truckNo !== prevTruck) {
          flushBlock(currentBlock, null);
          currentBlock = [];
        }
      }
      currentBlock.push({ r, row });
    }
  }

  if (currentBlock.length > 0) {
    flushBlock(currentBlock, null);
  }

  // Batch customer lookups & rate lookups
  // Cache by (tenKhachHang, diaChi, supplierCode)
  const custMap = new Map<string, Awaited<ReturnType<typeof bangKeThoPricingLookup.lookupCustomer>>>();

  for (const r of allRows) {
    const key = `${r.customerName}___${r.address}___${r.supplierCode}`;
    if (!custMap.has(key)) {
      const res = await bangKeThoPricingLookup.lookupCustomer({
        tenKhachHang: r.customerName,
        diaChiGiaoHang: r.address,
        supplierCode: r.supplierCode,
        slot: r.slot,
      });
      custMap.set(key, res);
    }
    const cRes = custMap.get(key);
    if (cRes) {
      r.dealer = cRes.diem_tra_hang;
      r.actualDest = cRes.tuyen_phuong;
      r.feeDest = cRes.diem_giao_hang_tinh_phi || cRes.tuyen_phuong || '';
      r.customerId = cRes.customer_id;
      r.isPartialMatch = cRes.is_partial_match;
      r.matchedAddress = cRes.matched_address;
    }
  }

  // Detect trips with NDFC weight (by truckNo + invoiceDateIso)
  const tripsWithNdfc = new Set<string>();

  for (let r = headerRowIdx + 1; r <= processedV2Sheet.rowCount; r++) {
    const row = processedV2Sheet.getRow(r);
    const truck = getCellStr(row, 'Số tàu', 4).trim();
    const invoiceDate = getCellVal(row, 'Ngày hóa đơn', 3);
    const invoiceDateIso = parseDateIso(invoiceDate);
    const tKey = `${truck}___${invoiceDateIso}`;

    const suppCode = getCellStr(row, 'Mã nhà cung cấp', 1);
    const ndfcCol = getCellNum(row, 'NDFC', 24);
    const hdWeight = getCellNum(row, 'HĐ Trọng lượng (Net)', 17);
    const spWeight = getCellNum(row, 'SP Trọng lượng net', 16);

    if (truck && invoiceDateIso) {
      if (suppCode === '2000000008' && (hdWeight > 0 || spWeight > 0 || ndfcCol > 0)) {
        tripsWithNdfc.add(tKey);
      } else if (ndfcCol > 0) {
        tripsWithNdfc.add(tKey);
      }
    }
  }

  for (const r of allRows) {
    const tKey = `${r.truckNo.trim()}___${r.invoiceDateIso}`;
    if (r.supplierCode === '2000000008' && (r.roundMt > 0 || (r.ndfc && r.ndfc > 0))) {
      tripsWithNdfc.add(tKey);
    } else if (r.ndfc && r.ndfc > 0) {
      tripsWithNdfc.add(tKey);
    }
  }

  // Cache rate lookups by (feeDest, khungGia, invoiceDateIso, targetBook, hasNdfcInTrip)
  const rateMap = new Map<string, number | null>();
  const surchargeMap = new Map<string, Awaited<ReturnType<typeof bangKeThoPricingLookup.lookupSurcharges>>>();

  for (const r of allRows) {
    const tKey = `${r.truckNo.trim()}___${r.invoiceDateIso}`;
    const hasNdfcInTrip = tripsWithNdfc.has(tKey);

    // Standardized targetBook resolution
    const targetBook = resolveTargetBook({
      supplierCode: r.supplierCode,
      slot: r.slot,
      hasNdfcInTrip,
    });

    const rateKey = `${r.feeDest}___${r.khungGia}___${r.invoiceDateIso}___${targetBook || r.supplierCode}___${hasNdfcInTrip}`;
    if (!rateMap.has(rateKey)) {
      let rate = await bangKeThoPricingLookup.lookupTransportRate({
        diemTinhPhi: r.feeDest,
        khungGia: r.khungGia,
        invoiceDateIso: r.invoiceDateIso,
        supplierCode: r.supplierCode,
        slot: r.slot,
        targetBook,
        hasNdfcInTrip,
      });

      if (rate === null && r.actualDest && r.actualDest.trim() !== (r.feeDest || '').trim()) {
        rate = await bangKeThoPricingLookup.lookupTransportRate({
          diemTinhPhi: r.actualDest,
          khungGia: r.khungGia,
          invoiceDateIso: r.invoiceDateIso,
          supplierCode: r.supplierCode,
          slot: r.slot,
          targetBook,
          hasNdfcInTrip,
        });
      }

      rateMap.set(rateKey, rate);
    }
    r.transportRate = rateMap.get(rateKey) ?? null;

    const surKey = `${r.customerName}___${r.customerId}___${r.khuVuc}___${r.khungGia}___${r.invoiceDateIso}`;
    if (!surchargeMap.has(surKey)) {
      const sur = await bangKeThoPricingLookup.lookupSurcharges({
        tenKhachHang: r.customerName,
        customerId: r.customerId,
        khuVuc: r.khuVuc,
        khungGia: r.khungGia,
        invoiceDateIso: r.invoiceDateIso,
      });
      surchargeMap.set(surKey, sur);
    }
    const surRes = surchargeMap.get(surKey);
    if (surRes) {
      r.feeBocXep = surRes.phi_boc_xep;
      r.feeChuyenTai = surRes.phi_chuyen_tai;
      r.feeGhepDiem = surRes.phi_ghep_diem;
    }
  }

  const mccRows = allRows.filter((r) => r.supplierCode === '2000000007');
  const ndfcRows = allRows.filter((r) => r.supplierCode === '2000000008');

  // Base sheets: NCC, Sheet1, Processed
  let nccSheet = workbook.worksheets.find(
    (ws) => ws.name.trim().toLowerCase() === 'ncc'
  );
  if (nccSheet) {
    setSheetNameSafely(nccSheet, 'NCC');
  } else {
    nccSheet = workbook.addWorksheet('NCC');
  }

  let sheet1 = workbook.worksheets.find((ws) => {
    const n = ws.name.trim().toLowerCase();
    return n === 'sheet1' || n === 'sheet 1';
  });
  if (sheet1) {
    setSheetNameSafely(sheet1, 'Sheet1');
  } else {
    sheet1 = workbook.addWorksheet('Sheet1');
  }

  setSheetNameSafely(processedSheet, 'Processed');

  // Highlight partial match cells in processedSheet before generating Processed v2
  let processedAddrCol = 7;
  for (let c = 1; c <= 45; c++) {
    const hVal = String(processedSheet.getRow(headerRowIdx).getCell(c).value || '').trim().toLowerCase();
    if (hVal.includes('địa chỉ') || hVal.includes('dia chi')) {
      processedAddrCol = c;
      break;
    }
  }

  for (const r of allRows) {
    if (r.isPartialMatch && r.rowIdx) {
      const pCell = processedSheet.getRow(r.rowIdx).getCell(processedAddrCol);
      pCell.fill = PARTIAL_MATCH_FILL;
      if (r.matchedAddress) {
        pCell.note = r.matchedAddress;
      }

      const p2Cell = processedV2Sheet.getRow(r.rowIdx).getCell(processedAddrCol);
      p2Cell.fill = PARTIAL_MATCH_FILL;
      if (r.matchedAddress) {
        p2Cell.note = r.matchedAddress;
      }
    }
  }

  // Remove other sheets from the input workbook that are not one of the base sheets
  const baseSheetIds = new Set([nccSheet.id, sheet1.id, processedSheet.id, processedV2Sheet.id]);
  for (const ws of [...workbook.worksheets]) {
    if (!baseSheetIds.has(ws.id)) {
      workbook.removeWorksheet(ws.id);
    }
  }

  // Helper to safely add sheet
  const safeAddSheet = (name: string): ExcelJS.Worksheet => {
    const existing = workbook.getWorksheet(name);
    if (existing) {
      workbook.removeWorksheet(existing.id);
    }
    return workbook.addWorksheet(name);
  };

  // 1. Build MCC sheets in exact order: MCC (goc), MCC-clv, MCC (uni), MCC (tt)
  const mccClvRows = mccRows.filter((r) => (r.slot || '').toUpperCase().includes('CALOFIC HP') || (r.slot || '').toUpperCase() === 'CLV');
  const mccUniRows = mccRows.filter((r) => (r.slot || '').toUpperCase().includes('WH UNIDEPOT') || (r.slot || '').toUpperCase() === 'UNI');
  const mccTtRows = mccRows.filter((r) => (r.slot || '').toUpperCase().includes('UNI 1') || (r.slot || '').toUpperCase() === 'TT');

  buildGocSheet(safeAddSheet('MCC (goc)'), mccRows);
  buildSummarySheet(safeAddSheet('MCC-clv'), mccClvRows);
  buildSummarySheet(safeAddSheet('MCC (uni)'), mccUniRows);
  buildSummarySheet(safeAddSheet('MCC (tt)'), mccTtRows);

  // 2. Build NDFC sheets in exact order: NDFC (goc), NDFC-clv, NDFC (uni), NDFC (tt)
  const ndfcClvRows = ndfcRows.filter((r) => (r.slot || '').toUpperCase().includes('CALOFIC HP') || (r.slot || '').toUpperCase() === 'CLV');
  const ndfcUniRows = ndfcRows.filter((r) => (r.slot || '').toUpperCase().includes('UNI 3') || (r.slot || '').toUpperCase() === 'UNI');
  const ndfcTtRows = ndfcRows.filter((r) => (r.slot || '').toUpperCase().includes('UNI 1') || (r.slot || '').toUpperCase() === 'TT');

  buildGocSheet(safeAddSheet('NDFC (goc)'), ndfcRows);
  buildSummarySheet(safeAddSheet('NDFC-clv'), ndfcClvRows);
  buildSummarySheet(safeAddSheet('NDFC (uni)'), ndfcUniRows);
  buildSummarySheet(safeAddSheet('NDFC (tt)'), ndfcTtRows);

  // Enforce exact sheet order:
  // NCC, Sheet1, Processed, MCC (goc), MCC-clv, MCC (uni), MCC (tt), NDFC (goc), NDFC-clv, NDFC (uni), NDFC (tt)
  ORDERED_SHEET_NAMES.forEach((name, idx) => {
    const ws = workbook.getWorksheet(name);
    if (ws) {
      (ws as any).orderNo = idx + 1;
    }
  });

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

  const mccInvoices = new Set(mccRows.map((r) => r.invoiceNo)).size;
  const ndfcInvoices = new Set(ndfcRows.map((r) => r.invoiceNo)).size;

  return {
    buffer,
    stats: {
      mcc_rows: mccRows.length,
      ndfc_rows: ndfcRows.length,
      mcc_invoices: mccInvoices,
      ndfc_invoices: ndfcInvoices,
    },
  };
}

const GOC_HEADERS = [
  'Mã nhà cung cấp', 'Số hóa đơn', 'Ngày hóa đơn', 'SỐ XE', 'Mã khách hàng',
  'ĐẠI LÝ', 'ĐIỂM GIAO HÀNG THỰC TẾ', 'ĐIỂM GIAO HÀNG TÍNH PHÍ', 'Hóa đơn',
  'Tên khách hàng', 'Địa chỉ giao hàng', 'Khung giá', 'Đơn vị tính',
  'Mã hàng hóa', 'Tên hàng hóa (Vie)', 'Tên hàng hóa (En)', 'Mã liên hệ giao hàng',
  'Mã DVT', 'Số lượng (DVT bán hàng)', 'SP Trọng lượng net', 'HĐ Trọng lượng (Net)',
  'ROUND (MT)', 'Trọng lượng (Tấn/Hóa đơn)', 'Trọng lượng (Tấn/Chuyến)', 'Tổng trọng lượng chuyến',
  'Đơn giá vận chuyển (Đồng)', 'Phí bốc xếp (Đồng)', 'Phí chuyển tải (Đồng)', 'Phí ghép điểm (Đồng)',
  'Thành tiền check (Đồng)', 'Thành tiền hóa đơn (Đồng)', '', '',
  'SITE', 'KHU VỰC', 'Số dòng trên HĐ', 'Điều chỉnh Hóa đơn', '5 nhà',
  'CLF', 'VFM', 'MCC', 'CLV', 'NDFC', 'GẠO',
  'Tài xế', 'Thông tin bổ sung', 'Slot', 'Diễn giải', 'Channel', 'SubChannel',
  'SlotNo', 'user tạo HĐ', 'User tạo PXK', 'PO number', 'Warehouse No',
  'Warehouse Name', 'Phiếu XK', 'Chứng từ ghi sổ', 'Số seri', 'Loại hàng',
  'Tuyến cũ', 'Tuyến mới', 'Tuyến lên hóa đơn'
];

function addGocHeaderRow(ws: ExcelJS.Worksheet): ExcelJS.Row {
  const headerRow = ws.addRow(GOC_HEADERS);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, size: 10 };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2EFDA' },
    };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
  });
  return headerRow;
}

function setGocColWidths(ws: ExcelJS.Worksheet): void {
  ws.columns.forEach((col, idx) => {
    if (idx === 0) col.width = 15;
    else if (idx === 1) col.width = 12;
    else if (idx === 6 || idx === 7 || idx === 8) col.width = 28;
    else if (idx === 9 || idx === 10) col.width = 30;
    else col.width = 14;
  });
}

function buildGocSheet(ws: ExcelJS.Worksheet, rows: ProcessedRow[]): void {
  const rowsA = rows.filter((r) => (r.khungGia || '').trim() !== '≤2.5 tấn');
  const rowsB = rows.filter((r) => (r.khungGia || '').trim() === '≤2.5 tấn');

  const hasA = rowsA.length > 0;
  const hasB = rowsB.length > 0;

  if (!hasA && !hasB) {
    ws.addRow([]);
    addGocHeaderRow(ws);
    setGocColWidths(ws);
    return;
  }

  let prevInvoiceNo = '';

  const renderGocRow = (r: ProcessedRow) => {
    const rowNum = ws.rowCount + 1;
    const prevRowNum = rowNum - 1;

    const isFirstRowOfInvoice = r.invoiceNo !== prevInvoiceNo;
    prevInvoiceNo = r.invoiceNo;

    const formulaHoaDon = { formula: `G${rowNum}&", ("&L${rowNum}&"), xe "&D${rowNum}` };
    const formulaRoundMt = { formula: `ROUND(U${rowNum}/1000,3)` };
    const formulaTanHd = { formula: `IF($B${rowNum}=$B${prevRowNum},0,SUMIF($B:$B,$B${rowNum},$V:$V))` };
    const formulaTanChuyen = { formula: `IF(AND(D${rowNum}=D${prevRowNum},C${rowNum}=C${prevRowNum}),0,SUMIFS($V:$V,$C:$C,$C${rowNum},$D:$D,$D${rowNum}))` };
    const formulaTongChuyen = isFirstRowOfInvoice ? { formula: `AL${rowNum}` } : '';
    const formulaThanhTienCheck = { formula: `ROUND(X${rowNum}*SUM(Z${rowNum}:AB${rowNum}),0)` };
    const formulaThanhTienHd = { formula: `ROUND(X${rowNum}*Z${rowNum},0)` };
    const formula5Nha = isFirstRowOfInvoice ? { formula: `SUBTOTAL(9,AM${rowNum}:AR${rowNum})` } : '';

    const summary = r.tripSummary;
    const clfVal = isFirstRowOfInvoice ? (summary?.clf ?? '') : '';
    const vfmVal = isFirstRowOfInvoice ? (summary?.vfm ?? '') : '';
    const mccVal = isFirstRowOfInvoice ? (summary?.mcc ?? '') : '';
    const clvVal = isFirstRowOfInvoice ? (summary?.clv ?? '') : '';
    const ndfcVal = isFirstRowOfInvoice ? (summary?.ndfc ?? '') : '';
    const gaoVal = isFirstRowOfInvoice ? (summary?.gao ?? '') : '';

    const data = [
      r.supplierCode,                   // A (1)
      r.invoiceNo,                      // B (2)
      r.invoiceDate,                    // C (3)
      r.truckNo,                        // D (4)
      r.customerCode,                   // E (5)
      r.dealer,                         // F (6)
      r.actualDest,                     // G (7)
      r.feeDest,                        // H (8)
      formulaHoaDon,                    // I (9)
      r.customerName,                   // J (10)
      r.address,                        // K (11)
      r.khungGia,                       // L (12)
      r.dvt || 'Tấn',                   // M (13)
      r.itemCode,                       // N (14)
      r.itemNameVie,                    // O (15)
      r.itemNameEn,                     // P (16)
      r.contactCode,                    // Q (17)
      r.dvtCode,                        // R (18)
      r.qty,                            // S (19)
      r.spNetWeight,                    // T (20)
      r.hdNetWeight,                    // U (21)
      formulaRoundMt,                   // V (22)
      formulaTanHd,                     // W (23)
      formulaTanChuyen,                 // X (24)
      formulaTongChuyen,                // Y (25)
      r.transportRate ?? '',            // Z (26)
      r.feeBocXep ?? '',                // AA (27)
      r.feeChuyenTai ?? '',             // AB (28)
      r.feeGhepDiem ?? '',              // AC (29)
      formulaThanhTienCheck,            // AD (30)
      formulaThanhTienHd,               // AE (31)
      '',                               // AF (32)
      '',                               // AG (33)
      r.site,                           // AH (34)
      r.khuVuc,                         // AI (35)
      '',                               // AJ (36)
      '',                               // AK (37)
      formula5Nha,                      // AL (38)
      clfVal,                           // AM (39)
      vfmVal,                           // AN (40)
      mccVal,                           // AO (41)
      clvVal,                           // AP (42)
      ndfcVal,                          // AQ (43)
      gaoVal,                           // AR (44)
      r.driver,                         // AS (45)
      r.extraInfo,                      // AT (46)
      r.slot,                           // AU (47)
      r.description,                    // AV (48)
      r.channel,                        // AW (49)
      r.subChannel,                     // AX (50)
      r.slotNo,                         // AY (51)
      r.userHd,                         // AZ (52)
      r.userPxk,                        // BA (53)
      r.poNumber,                       // BB (54)
      r.whNo,                           // BC (55)
      r.whName,                         // BD (56)
      r.pxk,                            // BE (57)
      r.journal,                        // BF (58)
      r.serialNo,                       // BG (59)
      r.itemType,                       // BH (60)
      r.oldRoute,                       // BI (61)
      r.newRoute,                       // BJ (62)
      r.invoiceRoute,                   // BK (63)
    ];

    const row = ws.addRow(data);
    row.height = 20;

    row.getCell(22).numFmt = '#,##0.000'; // V
    row.getCell(23).numFmt = '#,##0.000'; // W
    row.getCell(24).numFmt = '#,##0.000'; // X
    row.getCell(25).numFmt = '#,##0.000'; // Y
    row.getCell(26).numFmt = '#,##0';     // Z
    row.getCell(27).numFmt = '#,##0';     // AA
    row.getCell(28).numFmt = '#,##0';     // AB
    row.getCell(29).numFmt = '#,##0';     // AC
    row.getCell(30).numFmt = '#,##0';     // AD
    row.getCell(31).numFmt = '#,##0';     // AE
    row.getCell(38).numFmt = '#,##0.000'; // AL
    row.getCell(39).numFmt = '#,##0.000'; // AM
    row.getCell(40).numFmt = '#,##0.000'; // AN
    row.getCell(41).numFmt = '#,##0.000'; // AO
    row.getCell(42).numFmt = '#,##0.000'; // AP
    row.getCell(43).numFmt = '#,##0.000'; // AQ
    row.getCell(44).numFmt = '#,##0.000'; // AR

    if (r.isPartialMatch) {
      [6, 7, 8].forEach((colIdx) => {
        const c = row.getCell(colIdx);
        c.fill = PARTIAL_MATCH_FILL;
      });
      const addrCell = row.getCell(11);
      addrCell.fill = PARTIAL_MATCH_FILL;
      if (r.matchedAddress) {
        addrCell.note = r.matchedAddress;
      }
    }
  };

  // 1. RENDER TABLE A
  if (hasA) {
    ws.addRow([]); // Row 1 empty
    addGocHeaderRow(ws); // Row 2 header
    const tableAStartRow = 3;

    // Group rowsA by contiguous trips
    const tripsA: ProcessedRow[][] = [];
    let currentTrip: ProcessedRow[] = [];
    let currentTripKey = '';
    for (const r of rowsA) {
      const tKey = `${r.truckNo.trim()}___${r.invoiceDateIso}`;
      if (tKey !== currentTripKey) {
        if (currentTrip.length > 0) tripsA.push(currentTrip);
        currentTrip = [r];
        currentTripKey = tKey;
      } else {
        currentTrip.push(r);
      }
    }
    if (currentTrip.length > 0) tripsA.push(currentTrip);

    for (const tripRows of tripsA) {
      const tripStartRow = ws.rowCount + 1;
      for (const r of tripRows) {
        renderGocRow(r);
      }
      const tripEndRow = ws.rowCount;

      // Add Trip Total row
      const tripTotalRow = ws.addRow([]);
      tripTotalRow.height = 20;
      tripTotalRow.getCell(3).value = 'Tổng cộng';
      tripTotalRow.getCell(4).value = { formula: `D${tripEndRow}` };
      tripTotalRow.getCell(6).value = { formula: `I${tripEndRow}` };
      tripTotalRow.getCell(22).value = { formula: `SUM(V${tripStartRow}:V${tripEndRow})` };
      tripTotalRow.getCell(23).value = { formula: `SUM(W${tripStartRow}:W${tripEndRow})` };
      tripTotalRow.getCell(24).value = { formula: `SUM(X${tripStartRow}:X${tripEndRow})` };
      tripTotalRow.getCell(30).value = { formula: `SUM(AD${tripStartRow}:AD${tripEndRow})` };
      tripTotalRow.getCell(31).value = { formula: `SUM(AE${tripStartRow}:AE${tripEndRow})` };

      tripTotalRow.getCell(22).numFmt = '#,##0.000';
      tripTotalRow.getCell(23).numFmt = '#,##0.000';
      tripTotalRow.getCell(24).numFmt = '#,##0.000';
      tripTotalRow.getCell(30).numFmt = '#,##0';
      tripTotalRow.getCell(31).numFmt = '#,##0';
    }

    const tableAEndRow = ws.rowCount;
    // Add TỔNG CỘNG A row
    const totalRowA = ws.addRow([]);
    totalRowA.height = 20;
    totalRowA.getCell(5).value = 'TỔNG CỘNG A';
    totalRowA.getCell(23).value = { formula: `SUM(W${tableAStartRow}:W${tableAEndRow})/2` };
    totalRowA.getCell(24).value = { formula: `SUM(X${tableAStartRow}:X${tableAEndRow})/2` };
    totalRowA.getCell(30).value = { formula: `SUM(AD${tableAStartRow}:AD${tableAEndRow})/2` };
    totalRowA.getCell(31).value = { formula: `SUM(AE${tableAStartRow}:AE${tableAEndRow})/2` };

    totalRowA.getCell(23).numFmt = '#,##0.000';
    totalRowA.getCell(24).numFmt = '#,##0.000';
    totalRowA.getCell(30).numFmt = '#,##0';
    totalRowA.getCell(31).numFmt = '#,##0';
  }

  // Gap between tables if both exist
  if (hasA && hasB) {
    for (let i = 0; i < 6; i++) {
      ws.addRow([]);
    }
  }

  // 2. RENDER TABLE B
  if (hasB) {
    if (!hasA) {
      ws.addRow([]); // Row 1 is empty if only Table B
    }
    addGocHeaderRow(ws);
    const tableBStartRow = ws.rowCount + 1;

    for (const r of rowsB) {
      renderGocRow(r);
    }
    const tableBEndRow = ws.rowCount;

    // Add TỔNG CỘNG B row
    const totalRowB = ws.addRow([]);
    totalRowB.height = 20;
    totalRowB.getCell(5).value = 'TỔNG CỘNG B';
    totalRowB.getCell(22).value = { formula: `SUM(V${tableBStartRow}:V${tableBEndRow})` };
    totalRowB.getCell(23).value = { formula: `SUM(W${tableBStartRow}:W${tableBEndRow})` };
    totalRowB.getCell(24).value = { formula: `SUM(X${tableBStartRow}:X${tableBEndRow})` };
    totalRowB.getCell(30).value = { formula: `SUM(AD${tableBStartRow}:AD${tableBEndRow})` };
    totalRowB.getCell(31).value = { formula: `SUM(AE${tableBStartRow}:AE${tableBEndRow})` };

    totalRowB.getCell(22).numFmt = '#,##0.000';
    totalRowB.getCell(23).numFmt = '#,##0.000';
    totalRowB.getCell(24).numFmt = '#,##0.000';
    totalRowB.getCell(30).numFmt = '#,##0';
    totalRowB.getCell(31).numFmt = '#,##0';
  }

  setGocColWidths(ws);
}

const SUMMARY_HEADERS = [
  'Mã nhà cung cấp', 'Số hóa đơn', 'Ngày hóa đơn', 'SỐ XE', 'ĐẠI LÝ',
  'ĐIỂM GIAO HÀNG THỰC TẾ', 'ĐIỂM GIAO HÀNG TÍNH PHÍ', 'Hóa đơn',
  'Tên khách hàng', 'Địa chỉ giao hàng', 'Khung giá', 'Đơn vị tính',
  'Trọng lượng (Tấn/Hóa đơn)', 'Trọng lượng (Tấn/Chuyến)', 'Tổng trọng lượng chuyến',
  'Đơn giá vận chuyển (Đồng)', 'Phí bốc xếp (Đồng)', 'Phí chuyển tải (Đồng)', 'Phí ghép điểm (Đồng)',
  'Thành tiền check (Đồng)', 'Thành tiền hóa đơn (Đồng)', '', '',
  'SITE', 'KHU VỰC', 'Số dòng trên HĐ', 'Điều chỉnh Hóa đơn', '5 nhà',
  'CLF', 'VFM', 'MCC', 'CLV', 'NDFC', 'GẠO',
  'Tài xế', 'Thông tin bổ sung', 'Slot'
];

function addSummaryHeaderRow(ws: ExcelJS.Worksheet): ExcelJS.Row {
  const headerRow = ws.addRow(SUMMARY_HEADERS);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, size: 10 };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9E1F2' },
    };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
  });
  return headerRow;
}

function setSummaryColWidths(ws: ExcelJS.Worksheet): void {
  ws.columns.forEach((col, idx) => {
    if (idx === 1) col.width = 12;
    else if (idx === 5 || idx === 6 || idx === 7) col.width = 28;
    else if (idx === 8 || idx === 9) col.width = 30;
    else col.width = 14;
  });
}

function buildSummarySheet(ws: ExcelJS.Worksheet, rows: ProcessedRow[]): void {
  const rowsA = rows.filter((r) => (r.khungGia || '').trim() !== '≤2.5 tấn');
  const rowsB = rows.filter((r) => (r.khungGia || '').trim() === '≤2.5 tấn');

  const hasA = rowsA.length > 0;
  const hasB = rowsB.length > 0;

  if (!hasA && !hasB) {
    ws.addRow([]);
    addSummaryHeaderRow(ws);
    setSummaryColWidths(ws);
    return;
  }

  // Calculate trip weight map across all rows
  const tripSumMap = new Map<string, number>();
  for (const r of rows) {
    const tripKey = `${r.truckNo.trim()}___${r.invoiceDateIso}`;
    tripSumMap.set(tripKey, (tripSumMap.get(tripKey) || 0) + r.roundMt);
  }

  const seenTrips = new Set<string>();

  const renderSummaryInvoiceRow = (invoiceNo: string, invRows: ProcessedRow[]) => {
    const rowIdx = ws.rowCount + 1;
    const first = invRows[0];
    const totalHdWeight = Math.round(invRows.reduce((sum, item) => sum + item.roundMt, 0) * 1000) / 1000;

    const tripKey = `${first.truckNo.trim()}___${first.invoiceDateIso}`;
    const isFirstInTrip = !seenTrips.has(tripKey);
    seenTrips.add(tripKey);

    const tripWeight = isFirstInTrip ? (tripSumMap.get(tripKey) || totalHdWeight) : 0;

    const summary = first.tripSummary;
    const clfVal = summary?.clf ?? '';
    const vfmVal = summary?.vfm ?? '';
    const mccVal = summary?.mcc ?? '';
    const clvVal = summary?.clv ?? '';
    const ndfcVal = summary?.ndfc ?? '';
    const gaoVal = summary?.gao ?? '';

    const formulaHoaDon = { formula: `F${rowIdx}&", ("&K${rowIdx}&"), xe "&D${rowIdx}` };
    const formulaTongChuyen = { formula: `AB${rowIdx}` };
    const formulaThanhTienCheck = { formula: `ROUND(N${rowIdx}*SUM(P${rowIdx}:R${rowIdx}),0)` };
    const formulaThanhTienHd = { formula: `ROUND(N${rowIdx}*P${rowIdx},0)` };
    const formula5Nha = { formula: `SUBTOTAL(9,AC${rowIdx}:AH${rowIdx})` };

    const isPalletKhungGia = (first.khungGia || '').toLowerCase().includes('pallet');
    const displayKhungGia = isPalletKhungGia ? 'Pallet' : first.khungGia;

    const data = [
      first.supplierCode,           // A (1)
      invoiceNo,                    // B (2)
      first.invoiceDate,            // C (3)
      first.truckNo,                // D (4)
      first.dealer,                 // E (5)
      first.actualDest,             // F (6)
      first.feeDest,                // G (7)
      formulaHoaDon,                // H (8)
      first.customerName,           // I (9)
      first.address,                // J (10)
      displayKhungGia,              // K (11)
      first.dvt || 'Tấn',           // L (12)
      totalHdWeight,                // M (13)
      tripWeight,                   // N (14)
      formulaTongChuyen,            // O (15)
      first.transportRate ?? '',    // P (16)
      first.feeBocXep ?? '',        // Q (17)
      first.feeChuyenTai ?? '',     // R (18)
      first.feeGhepDiem ?? '',      // S (19)
      formulaThanhTienCheck,        // T (20)
      formulaThanhTienHd,           // U (21)
      '',                           // V (22)
      '',                           // W (23)
      first.site,                   // X (24)
      first.khuVuc,                 // Y (25)
      invRows.length,               // Z (26)
      '',                           // AA (27)
      formula5Nha,                  // AB (28)
      clfVal,                       // AC (29)
      vfmVal,                       // AD (30)
      mccVal,                       // AE (31)
      clvVal,                       // AF (32)
      ndfcVal,                      // AG (33)
      gaoVal,                       // AH (34)
      first.driver,                 // AI (35)
      first.extraInfo,              // AJ (36)
      first.slot,                   // AK (37)
    ];

    const row = ws.addRow(data);
    row.height = 20;

    if (isPalletKhungGia && first.khungGia) {
      row.getCell(11).note = first.khungGia;
    }

    row.getCell(13).numFmt = '#,##0.000'; // M
    row.getCell(14).numFmt = '#,##0.000'; // N
    row.getCell(15).numFmt = '#,##0.000'; // O
    row.getCell(16).numFmt = '#,##0';     // P
    row.getCell(17).numFmt = '#,##0';     // Q
    row.getCell(18).numFmt = '#,##0';     // R
    row.getCell(19).numFmt = '#,##0';     // S
    row.getCell(20).numFmt = '#,##0';     // T
    row.getCell(21).numFmt = '#,##0';     // U
    row.getCell(28).numFmt = '#,##0.000'; // AB
    row.getCell(29).numFmt = '#,##0.000'; // AC
    row.getCell(30).numFmt = '#,##0.000'; // AD
    row.getCell(31).numFmt = '#,##0.000'; // AE
    row.getCell(32).numFmt = '#,##0.000'; // AF
    row.getCell(33).numFmt = '#,##0.000'; // AG
    row.getCell(34).numFmt = '#,##0.000'; // AH

    const partialMatchRows = invRows.filter((item) => item.isPartialMatch);
    if (partialMatchRows.length > 0) {
      [5, 6, 7].forEach((colIdx) => {
        const c = row.getCell(colIdx);
        c.fill = PARTIAL_MATCH_FILL;
      });
      const addrCell = row.getCell(10);
      addrCell.fill = PARTIAL_MATCH_FILL;
      const uniqueMatchedAddrs = Array.from(
        new Set(partialMatchRows.map((item) => item.matchedAddress).filter(Boolean))
      );
      if (uniqueMatchedAddrs.length > 0) {
        addrCell.note = uniqueMatchedAddrs.join('\n');
      }
    }
  };

  // 1. RENDER TABLE A
  if (hasA) {
    ws.addRow([]); // Row 1 is empty
    addSummaryHeaderRow(ws); // Row 2 header
    const tableAStartRow = 3;

    // Group rowsA by invoice
    const byInvoiceA = new Map<string, ProcessedRow[]>();
    for (const r of rowsA) {
      const list = byInvoiceA.get(r.invoiceNo) || [];
      list.push(r);
      byInvoiceA.set(r.invoiceNo, list);
    }

    // Group invoices of rowsA by trip
    const tripsA = new Map<string, Array<{ invoiceNo: string; invRows: ProcessedRow[] }>>();
    for (const [invoiceNo, invRows] of byInvoiceA.entries()) {
      const first = invRows[0];
      const tripKey = `${first.truckNo.trim()}___${first.invoiceDateIso}`;
      const list = tripsA.get(tripKey) || [];
      list.push({ invoiceNo, invRows });
      tripsA.set(tripKey, list);
    }

    for (const invList of tripsA.values()) {
      const tripStartRow = ws.rowCount + 1;
      for (const { invoiceNo, invRows } of invList) {
        renderSummaryInvoiceRow(invoiceNo, invRows);
      }
      const tripEndRow = ws.rowCount;

      // Add Trip Total row
      const tripTotalRow = ws.addRow([]);
      tripTotalRow.height = 20;
      tripTotalRow.getCell(3).value = 'Tổng cộng';
      tripTotalRow.getCell(4).value = { formula: `D${tripEndRow}` };
      tripTotalRow.getCell(5).value = { formula: `H${tripEndRow}` };
      tripTotalRow.getCell(13).value = { formula: `SUM(M${tripStartRow}:M${tripEndRow})` };
      tripTotalRow.getCell(14).value = { formula: `SUM(N${tripStartRow}:N${tripEndRow})` };
      tripTotalRow.getCell(20).value = { formula: `SUM(T${tripStartRow}:T${tripEndRow})` };
      tripTotalRow.getCell(21).value = { formula: `SUM(U${tripStartRow}:U${tripEndRow})` };

      tripTotalRow.getCell(13).numFmt = '#,##0.000';
      tripTotalRow.getCell(14).numFmt = '#,##0.000';
      tripTotalRow.getCell(20).numFmt = '#,##0';
      tripTotalRow.getCell(21).numFmt = '#,##0';
    }

    const tableAEndRow = ws.rowCount;
    // Add TỔNG CỘNG A row
    const totalRowA = ws.addRow([]);
    totalRowA.height = 20;
    totalRowA.getCell(5).value = 'TỔNG CỘNG A';
    totalRowA.getCell(13).value = { formula: `SUM(M${tableAStartRow}:M${tableAEndRow})/2` };
    totalRowA.getCell(14).value = { formula: `SUM(N${tableAStartRow}:N${tableAEndRow})/2` };
    totalRowA.getCell(20).value = { formula: `SUM(T${tableAStartRow}:T${tableAEndRow})/2` };
    totalRowA.getCell(21).value = { formula: `SUM(U${tableAStartRow}:U${tableAEndRow})/2` };

    totalRowA.getCell(13).numFmt = '#,##0.000';
    totalRowA.getCell(14).numFmt = '#,##0.000';
    totalRowA.getCell(20).numFmt = '#,##0';
    totalRowA.getCell(21).numFmt = '#,##0';
  }

  // Gap between tables if both exist
  if (hasA && hasB) {
    for (let i = 0; i < 6; i++) {
      ws.addRow([]);
    }
  }

  // 2. RENDER TABLE B
  if (hasB) {
    if (!hasA) {
      ws.addRow([]); // Row 1 is empty if only Table B
    }
    addSummaryHeaderRow(ws);
    const tableBStartRow = ws.rowCount + 1;

    // Group rowsB by invoice
    const byInvoiceB = new Map<string, ProcessedRow[]>();
    for (const r of rowsB) {
      const list = byInvoiceB.get(r.invoiceNo) || [];
      list.push(r);
      byInvoiceB.set(r.invoiceNo, list);
    }

    for (const [invoiceNo, invRows] of byInvoiceB.entries()) {
      renderSummaryInvoiceRow(invoiceNo, invRows);
    }
    const tableBEndRow = ws.rowCount;

    // Add TỔNG CỘNG B row
    const totalRowB = ws.addRow([]);
    totalRowB.height = 20;
    totalRowB.getCell(5).value = 'TỔNG CỘNG B';
    totalRowB.getCell(13).value = { formula: `SUM(M${tableBStartRow}:M${tableBEndRow})` };
    totalRowB.getCell(14).value = { formula: `SUM(N${tableBStartRow}:N${tableBEndRow})` };
    totalRowB.getCell(20).value = { formula: `SUM(T${tableBStartRow}:T${tableBEndRow})` };
    totalRowB.getCell(21).value = { formula: `SUM(U${tableBStartRow}:U${tableBEndRow})` };

    totalRowB.getCell(13).numFmt = '#,##0.000';
    totalRowB.getCell(14).numFmt = '#,##0.000';
    totalRowB.getCell(20).numFmt = '#,##0';
    totalRowB.getCell(21).numFmt = '#,##0';
  }

  setSummaryColWidths(ws);
}
