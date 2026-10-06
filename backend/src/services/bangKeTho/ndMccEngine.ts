import ExcelJS from 'exceljs';
import { bangKeThoPricingLookup, resolveTargetBook } from './pricingLookup';

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
  showHouseTotals: boolean;
  hasNdfcInTrip: boolean;
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

export const OUTPUT_SHEET_NAMES = [
  'MCC (goc)',
  'MCC-clv',
  'MCC (uni)',
  'MCC (tt)',
  'NDFC (goc)',
  'NDFC-clv',
  'NDFC (uni)',
  'NDFC (tt)',
] as const;

export const ORDERED_SHEET_NAMES = OUTPUT_SHEET_NAMES;

const SHEETS_TO_REMOVE = new Set([
  'VFM',
  'VFM (2)',
  'CLV',
  'STHI',
  'STHI (uni)',
  'NPP',
  'TINH',
]);

export const PARTIAL_MATCH_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFFEB9C' }, // Soft warning yellow
};

export const PARTIAL_MATCH_NOTE = 'Không khớp hoàn toàn với cơ sở dữ liệu';

function findSheet(workbook: ExcelJS.Workbook, name: string): ExcelJS.Worksheet | undefined {
  const target = name.trim().toLowerCase();
  return workbook.worksheets.find((ws) => ws.name.trim().toLowerCase() === target);
}

function headerKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

interface FactoryColumns {
  headerRowIdx: number;
  cols: Map<string, number>;
  fiveNhaCol: number;
}

function detectFactoryColumns(ws: ExcelJS.Worksheet): FactoryColumns {
  let headerRowIdx = 1;
  const cols = new Map<string, number>();
  for (let r = 1; r <= 3; r++) {
    const row = ws.getRow(r);
    let found = 0;
    row.eachCell((cell) => {
      if (String(cell.value || '').trim()) found++;
    });
    if (found > 10) {
      headerRowIdx = r;
      row.eachCell((cell, colNumber) => {
        const txt = String(cell.value || '').trim();
        if (txt) cols.set(headerKey(txt), colNumber);
      });
      break;
    }
  }
  const gaoCol = cols.get('gạo') ?? cols.get('gao') ?? 26;
  return { headerRowIdx, cols, fiveNhaCol: gaoCol + 1 };
}

function cellRaw(row: ExcelJS.Row, col: number | undefined): unknown {
  if (!col) return null;
  const cell = row.getCell(col);
  if (cell.value && typeof cell.value === 'object' && 'result' in (cell.value as object)) {
    return (cell.value as { result: unknown }).result;
  }
  return cell.value;
}

function cellStr(row: ExcelJS.Row, cols: Map<string, number>, header: string): string {
  const val = cellRaw(row, cols.get(headerKey(header)));
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

function cellNum(row: ExcelJS.Row, cols: Map<string, number>, header: string): number {
  const val = cellRaw(row, cols.get(headerKey(header)));
  if (val === null || val === undefined || val === '') return 0;
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/,/g, ''));
  return Number.isFinite(num) ? num : 0;
}

function cellNumOrNull(row: ExcelJS.Row, col: number | undefined): number | null {
  const val = cellRaw(row, col);
  if (val === null || val === undefined || val === '') return null;
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/,/g, ''));
  if (!Number.isFinite(num)) return null;
  return num;
}

function readHouseSummary(row: ExcelJS.Row, layout: FactoryColumns): TripFiveHousesSummary {
  const { cols, fiveNhaCol } = layout;
  const clf = cellNumOrNull(row, cols.get('clf'));
  const vfm = cellNumOrNull(row, cols.get('vfm'));
  const mcc = cellNumOrNull(row, cols.get('mcc'));
  const clv = cellNumOrNull(row, cols.get('clv'));
  const ndfc = cellNumOrNull(row, cols.get('ndfc'));
  const gao = cellNumOrNull(row, cols.get('gạo') ?? cols.get('gao'));
  const stated = cellNumOrNull(row, fiveNhaCol);
  const summed =
    (clf || 0) + (vfm || 0) + (mcc || 0) + (clv || 0) + (ndfc || 0) + (gao || 0);
  const total = stated !== null ? stated : summed;
  return {
    clf,
    vfm,
    mcc,
    clv,
    ndfc,
    gao,
    total5Nha: total > 0 ? Math.round(total * 1000) / 1000 : null,
  };
}

function readFactorySheet(ws: ExcelJS.Worksheet, supplierCode: string): ProcessedRow[] {
  const layout = detectFactoryColumns(ws);
  const { cols } = layout;
  const out: ProcessedRow[] = [];
  let block: ExcelJS.Row[] = [];
  let blockTruck = '';

  const flush = () => {
    if (block.length === 0) return;
    const summary = readHouseSummary(block[0], layout);
    const hasNdfcInTrip = (summary.ndfc ?? 0) > 0;
    let shown = false;
    for (const row of block) {
      const code = cellStr(row, cols, 'Mã nhà cung cấp');
      if (code !== supplierCode) continue;
      const invoiceDate = cellRaw(row, cols.get(headerKey('Ngày hóa đơn')));
      const hdNetWeight = cellNum(row, cols, 'HĐ Trọng lượng (Net)');
      const slot = cellStr(row, cols, 'Slot');
      const channel = cellStr(row, cols, 'Channel');
      const subChannel = cellStr(row, cols, 'SubChannel');
      const customerName = cellStr(row, cols, 'Tên khách hàng');
      const parsed: ProcessedRow = {
        rowIdx: row.number,
        supplierCode: code,
        invoiceNo: cellStr(row, cols, 'Số hóa đơn'),
        invoiceDate,
        invoiceDateIso: parseDateIso(invoiceDate),
        truckNo: cellStr(row, cols, 'Số tàu'),
        customerCode: cellStr(row, cols, 'Mã khách hàng'),
        customerName,
        address: cellStr(row, cols, 'Địa chỉ giao hàng'),
        khungGia: cellStr(row, cols, 'Khung giá'),
        dvt: cellStr(row, cols, 'Đơn vị tính'),
        itemCode: cellStr(row, cols, 'Mã hàng hóa'),
        itemNameVie: cellStr(row, cols, 'Tên hàng hóa (Vie)'),
        itemNameEn: cellStr(row, cols, 'Tên hàng hóa (En)'),
        contactCode: cellStr(row, cols, 'Mã liên hệ giao hàng'),
        dvtCode: cellStr(row, cols, 'Mã DVT'),
        qty: cellNum(row, cols, 'Số lượng (DVT bán hàng)'),
        spNetWeight: cellNum(row, cols, 'SP Trọng lượng net'),
        hdNetWeight,
        roundMt: hdNetWeight ? Math.round((hdNetWeight / 1000) * 1000) / 1000 : 0,
        clf: summary.clf,
        vfm: summary.vfm,
        mcc: summary.mcc,
        clv: summary.clv,
        ndfc: summary.ndfc,
        gao: summary.gao,
        driver: cellStr(row, cols, 'Tài xế'),
        extraInfo: cellStr(row, cols, 'Thông tin bổ sung'),
        slot,
        description: cellStr(row, cols, 'Diễn giải'),
        channel,
        subChannel,
        slotNo: cellStr(row, cols, 'SlotNo'),
        userHd: cellStr(row, cols, 'user tạo HĐ'),
        userPxk: cellStr(row, cols, 'User tạo PXK'),
        poNumber: cellStr(row, cols, 'PO number'),
        whNo: cellStr(row, cols, 'Warehouse No'),
        whName: cellStr(row, cols, 'Warehouse Name'),
        pxk: cellStr(row, cols, 'Phiếu XK'),
        journal: cellStr(row, cols, 'Chứng từ ghi sổ'),
        serialNo: cellStr(row, cols, 'Số seri'),
        itemType: cellStr(row, cols, 'Loại hàng'),
        oldRoute: cellStr(row, cols, 'Tuyến cũ'),
        newRoute: cellStr(row, cols, 'Tuyến mới'),
        invoiceRoute: cellStr(row, cols, 'Tuyến lên hóa đơn'),
        dealer: '',
        actualDest: '',
        feeDest: '',
        customerId: null,
        transportRate: null,
        feeBocXep: null,
        feeChuyenTai: null,
        feeGhepDiem: null,
        site: determineSite(code, slot),
        khuVuc: determineKhuVuc(channel, subChannel, customerName),
        tripSummary: summary,
        showHouseTotals: !shown,
        hasNdfcInTrip,
      };
      shown = true;
      out.push(parsed);
    }
    block = [];
    blockTruck = '';
  };

  for (let r = layout.headerRowIdx + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const supplier = cellStr(row, cols, 'Mã nhà cung cấp');
    const invoice = cellStr(row, cols, 'Số hóa đơn');
    const truck = cellStr(row, cols, 'Số tàu');
    if (!supplier && !invoice && !truck) continue;
    if (block.length > 0 && truck !== blockTruck) flush();
    if (block.length === 0) blockTruck = truck;
    block.push(row);
  }
  flush();
  return out;
}

export async function processNdMccWorkbook(
  inputBuffer: Buffer
): Promise<ProcessNdMccResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(inputBuffer as any);

  const mccSheet = findSheet(workbook, 'MCC');
  const ndfcSheet = findSheet(workbook, 'NDFC');
  if (!mccSheet && !ndfcSheet) throw new Error('MISSING_MCC_NDFC_SHEETS');
  if (!mccSheet) throw new Error('MISSING_MCC_SHEET');
  if (!ndfcSheet) throw new Error('MISSING_NDFC_SHEET');

  await bangKeThoPricingLookup.initCache();

  const mccRows = readFactorySheet(mccSheet, '2000000007');
  const ndfcRows = readFactorySheet(ndfcSheet, '2000000008');
  const allRows = [...mccRows, ...ndfcRows];

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

  const rateMap = new Map<string, number | null>();
  const surchargeMap = new Map<string, Awaited<ReturnType<typeof bangKeThoPricingLookup.lookupSurcharges>>>();

  for (const r of allRows) {
    const targetBook = resolveTargetBook({
      supplierCode: r.supplierCode,
      slot: r.slot,
      hasNdfcInTrip: r.hasNdfcInTrip,
    });

    const rateKey = `${r.feeDest}___${r.khungGia}___${r.invoiceDateIso}___${targetBook || r.supplierCode}___${r.hasNdfcInTrip}`;
    if (!rateMap.has(rateKey)) {
      let rate = await bangKeThoPricingLookup.lookupTransportRate({
        diemTinhPhi: r.feeDest,
        khungGia: r.khungGia,
        invoiceDateIso: r.invoiceDateIso,
        supplierCode: r.supplierCode,
        slot: r.slot,
        targetBook,
        hasNdfcInTrip: r.hasNdfcInTrip,
      });

      if (rate === null && r.actualDest && r.actualDest.trim() !== (r.feeDest || '').trim()) {
        rate = await bangKeThoPricingLookup.lookupTransportRate({
          diemTinhPhi: r.actualDest,
          khungGia: r.khungGia,
          invoiceDateIso: r.invoiceDateIso,
          supplierCode: r.supplierCode,
          slot: r.slot,
          targetBook,
          hasNdfcInTrip: r.hasNdfcInTrip,
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

  for (const ws of [...workbook.worksheets]) {
    if (SHEETS_TO_REMOVE.has(ws.name.trim())) {
      workbook.removeWorksheet(ws.id);
    }
  }

  const safeAddSheet = (name: string): ExcelJS.Worksheet => {
    const existing = workbook.getWorksheet(name);
    if (existing) workbook.removeWorksheet(existing.id);
    return workbook.addWorksheet(name);
  };

  const mccClvRows = mccRows.filter((r) => (r.slot || '').toUpperCase().includes('CALOFIC HP') || (r.slot || '').toUpperCase() === 'CLV');
  const mccUniRows = mccRows.filter((r) => (r.slot || '').toUpperCase().includes('WH UNIDEPOT') || (r.slot || '').toUpperCase() === 'UNI');
  const mccTtRows = mccRows.filter((r) => (r.slot || '').toUpperCase().includes('UNI 1') || (r.slot || '').toUpperCase() === 'TT');

  buildGocSheet(safeAddSheet('MCC (goc)'), mccRows);
  buildSummarySheet(safeAddSheet('MCC-clv'), mccClvRows);
  buildSummarySheet(safeAddSheet('MCC (uni)'), mccUniRows);
  buildSummarySheet(safeAddSheet('MCC (tt)'), mccTtRows);

  const ndfcClvRows = ndfcRows.filter((r) => (r.slot || '').toUpperCase().includes('CALOFIC HP') || (r.slot || '').toUpperCase() === 'CLV');
  const ndfcUniRows = ndfcRows.filter((r) => (r.slot || '').toUpperCase().includes('UNI 3') || (r.slot || '').toUpperCase() === 'UNI');
  const ndfcTtRows = ndfcRows.filter((r) => (r.slot || '').toUpperCase().includes('UNI 1') || (r.slot || '').toUpperCase() === 'TT');

  buildGocSheet(safeAddSheet('NDFC (goc)'), ndfcRows);
  buildSummarySheet(safeAddSheet('NDFC-clv'), ndfcClvRows);
  buildSummarySheet(safeAddSheet('NDFC (uni)'), ndfcUniRows);
  buildSummarySheet(safeAddSheet('NDFC (tt)'), ndfcTtRows);

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

  const renderGocRow = (r: ProcessedRow) => {
    const rowNum = ws.rowCount + 1;
    const prevRowNum = rowNum - 1;

    const formulaHoaDon = { formula: `G${rowNum}&", ("&L${rowNum}&"), xe "&D${rowNum}` };
    const formulaRoundMt = { formula: `ROUND(U${rowNum}/1000,3)` };
    const formulaTanHd = { formula: `IF($B${rowNum}=$B${prevRowNum},0,SUMIF($B:$B,$B${rowNum},$V:$V))` };
    const formulaTanChuyen = { formula: `IF(AND(D${rowNum}=D${prevRowNum},C${rowNum}=C${prevRowNum}),0,SUMIFS($V:$V,$C:$C,$C${rowNum},$D:$D,$D${rowNum}))` };
    const formulaTongChuyen = r.showHouseTotals ? { formula: `AL${rowNum}` } : '';
    const formulaThanhTienCheck = { formula: `ROUND(X${rowNum}*SUM(Z${rowNum}:AB${rowNum}),0)` };
    const formulaThanhTienHd = { formula: `ROUND(X${rowNum}*Z${rowNum},0)` };
    const formula5Nha = r.showHouseTotals ? { formula: `SUBTOTAL(9,AM${rowNum}:AR${rowNum})` } : '';

    const summary = r.tripSummary;
    const clfVal = r.showHouseTotals ? (summary?.clf ?? '') : '';
    const vfmVal = r.showHouseTotals ? (summary?.vfm ?? '') : '';
    const mccVal = r.showHouseTotals ? (summary?.mcc ?? '') : '';
    const clvVal = r.showHouseTotals ? (summary?.clv ?? '') : '';
    const ndfcVal = r.showHouseTotals ? (summary?.ndfc ?? '') : '';
    const gaoVal = r.showHouseTotals ? (summary?.gao ?? '') : '';

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
    const showHouseTotals = invRows.some((item) => item.showHouseTotals);
    const clfVal = showHouseTotals ? (summary?.clf ?? '') : '';
    const vfmVal = showHouseTotals ? (summary?.vfm ?? '') : '';
    const mccVal = showHouseTotals ? (summary?.mcc ?? '') : '';
    const clvVal = showHouseTotals ? (summary?.clv ?? '') : '';
    const ndfcVal = showHouseTotals ? (summary?.ndfc ?? '') : '';
    const gaoVal = showHouseTotals ? (summary?.gao ?? '') : '';

    const formulaHoaDon = { formula: `F${rowIdx}&", ("&K${rowIdx}&"), xe "&D${rowIdx}` };
    const formulaTongChuyen = showHouseTotals ? { formula: `AB${rowIdx}` } : '';
    const formulaThanhTienCheck = { formula: `ROUND(N${rowIdx}*SUM(P${rowIdx}:R${rowIdx}),0)` };
    const formulaThanhTienHd = { formula: `ROUND(N${rowIdx}*P${rowIdx},0)` };
    const formula5Nha = showHouseTotals ? { formula: `SUBTOTAL(9,AC${rowIdx}:AH${rowIdx})` } : '';

    const displayKhungGia = first.khungGia;

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
