/**
 * Seed customers from sheet "TONG HOP cap nhat T5-26"
 * (tên tuyến T7. 2026.xlsx).
 *
 * Match key (exact after NFC/trim/invisible-char sanitize — keep TP. vs TP, vs Thành phố):
 *   supplier_code + diem_tra_hang (Đại lý) + tuyen_phuong (điểm thực tế)
 *
 * Existing active:
 *   - fill diem_giao_hang_tinh_phi only when DB is blank
 *   - never overwrite ten / địa chỉ / điểm thực tế / tính phí đã có
 *   - report mismatches
 * Deactive match → skip. Null supplier_code same Đại lý+điểm → ambiguous, no insert.
 * MCC/NDFC missing tên KH → copy from CLV same Đại lý (else skip).
 *
 * Run from repo root:
 *   npx tsx scripts/seed-customers-t7.ts --dry-run
 *   npx tsx scripts/seed-customers-t7.ts
 */
import path from 'node:path';
import { createRequire } from 'node:module';
import type { PoolClient } from '../backend/node_modules/@types/pg/index';
import { pool, root } from './pgPool';

const require = createRequire(path.join(root, 'backend/package.json'));
const XLSX = require('xlsx') as typeof import('xlsx');

const SHEET_NAME = 'TONG HOP cap nhat T5-26';
const XLSX_PATH = path.join(
  root,
  'reference/xu_ly_du_lieu_ke_toan/tên tuyến T7. 2026.xlsx',
);

/** Section label → suppliers.supplier_code (SAP / catalog, not factory short name). */
const SECTION_TO_SUPPLIER: Record<string, string> = {
  'MCC trực tiếp': '2000000007',
  'NDFC trực tiếp': '2000000008',
  CLV: 'default',
};

const REQUIRED_SUPPLIER_CODES = ['2000000007', '2000000008', 'default'] as const;

type CustomerRow = {
  id: number;
  diem_tra_hang: string;
  ten_khach_hang: string;
  tuyen_phuong: string | null;
  tuyen_cu: string | null;
  dia_chi_giao_hang: string | null;
  diem_giao_hang_tinh_phi: string | null;
  boc_xep: boolean;
  supplier_code: string | null;
  status: 'active' | 'deactive';
};

type SheetRow = {
  excelRow: number;
  section: string;
  supplierCode: string;
  daiLy: string;
  thucTe: string;
  tinhPhi: string;
  tuyenCu: string | null;
  tenKhachHang: string | null;
  diaChi: string | null;
  note: string | null;
  bocXep: boolean;
  copiedTenFromClv: boolean;
};

type Action =
  | 'insert'
  | 'update_tinh_phi'
  | 'unchanged'
  | 'mismatch'
  | 'deactive_skip'
  | 'ambiguous'
  | 'skip_no_ten';

type Decision = {
  action: Action;
  rec: SheetRow;
  dbId?: number;
  mismatchFields?: string[];
  alsoUpdateTinhPhi?: boolean;
  note?: string;
};

function supplierLabel(code: string): string {
  if (code === '2000000007') return 'MCC';
  if (code === '2000000008') return 'NDFC';
  if (code === 'default') return 'CLV';
  return code;
}

function sanitizeText(s: unknown): string {
  return String(s ?? '')
    .normalize('NFC')
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF\u061C]/g, '')
    .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim();
}

function optionalText(s: unknown): string | null {
  const t = sanitizeText(s);
  return t === '' ? null : t;
}

function sameText(a: unknown, b: unknown): boolean {
  return sanitizeText(a) === sanitizeText(b);
}

function isHeader(daiLy: string): boolean {
  return daiLy.toUpperCase() === 'ĐẠI LÝ' || daiLy.toUpperCase() === 'DAI LY';
}

function parseBocXep(note: string | null): { bocXep: boolean; logChuyenTai: boolean } {
  if (!note) return { bocXep: true, logChuyenTai: false };
  const n = note.toLowerCase();
  const logChuyenTai = n.includes('chuyển tải') || n.includes('chuyen tai');
  const koBx = /ko\s*bx/.test(n) || n.includes('không bốc') || n.includes('khong boc');
  return { bocXep: !koBx, logChuyenTai };
}

function loadSheetRows(): SheetRow[] {
  const buf = require('fs').readFileSync(XLSX_PATH) as Buffer;
  const wb = XLSX.read(buf, { type: 'buffer', cellDates: false });
  const ws = wb.Sheets[SHEET_NAME];
  if (!ws) {
    throw new Error(`Sheet "${SHEET_NAME}" not found. Have: ${wb.SheetNames.join(', ')}`);
  }
  const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, {
    header: 1,
    defval: null,
    raw: false,
  });

  const rows: SheetRow[] = [];
  let section: string | null = null;
  let supplierCode: string | null = null;

  for (let i = 0; i < matrix.length; i++) {
    const excelRow = i + 1;
    const r = matrix[i] ?? [];
    const daiLyRaw = optionalText(r[0]);
    const thucTe = optionalText(r[1]);
    const tinhPhi = optionalText(r[2]);
    const tuyenCu = optionalText(r[4]);
    const tenKhachHang = optionalText(r[5]);
    const diaChi = optionalText(r[6]);
    const note = optionalText(r[7]);

    if (!daiLyRaw && !thucTe && !tinhPhi && !tenKhachHang && !diaChi) continue;
    if (daiLyRaw && isHeader(daiLyRaw)) continue;

    const isSection =
      !!daiLyRaw && !thucTe && !tinhPhi && !tenKhachHang && !diaChi && !tuyenCu;
    if (isSection) {
      const mapped = SECTION_TO_SUPPLIER[daiLyRaw];
      if (!mapped) {
        throw new Error(`Unknown NCC section at row ${excelRow}: "${daiLyRaw}"`);
      }
      section = daiLyRaw;
      supplierCode = mapped;
      continue;
    }

    if (!daiLyRaw || !thucTe) {
      throw new Error(
        `Row ${excelRow}: missing Đại lý or Điểm giao hàng thực tế (section=${section ?? '?'})`,
      );
    }
    if (!section || !supplierCode) {
      throw new Error(`Row ${excelRow}: data before any NCC section header`);
    }
    if (!tinhPhi) {
      throw new Error(`Row ${excelRow}: missing Điểm giao hàng tính phí`);
    }

    const { bocXep } = parseBocXep(note);
    rows.push({
      excelRow,
      section,
      supplierCode,
      daiLy: daiLyRaw,
      thucTe,
      tinhPhi,
      tuyenCu,
      tenKhachHang,
      diaChi,
      note,
      bocXep,
      copiedTenFromClv: false,
    });
  }

  return rows;
}

function fillTenFromClv(rows: SheetRow[]): void {
  const clvTenByDaiLy = new Map<string, string>();
  const clvDiaChiByDaiLy = new Map<string, string>();
  for (const rec of rows) {
    if (rec.supplierCode !== 'default') continue;
    if (rec.tenKhachHang && !clvTenByDaiLy.has(rec.daiLy)) {
      clvTenByDaiLy.set(rec.daiLy, rec.tenKhachHang);
    }
    if (rec.diaChi && !clvDiaChiByDaiLy.has(rec.daiLy)) {
      clvDiaChiByDaiLy.set(rec.daiLy, rec.diaChi);
    }
  }
  for (const rec of rows) {
    if (rec.supplierCode === 'default') continue;
    if (!rec.tenKhachHang) {
      const copied = clvTenByDaiLy.get(rec.daiLy);
      if (copied) {
        rec.tenKhachHang = copied;
        rec.copiedTenFromClv = true;
      }
    }
    if (!rec.diaChi) {
      const copied = clvDiaChiByDaiLy.get(rec.daiLy);
      if (copied) rec.diaChi = copied;
    }
  }
}

function matchKey(supplier: string | null, daiLy: string, thucTe: string | null): string {
  return `${sanitizeText(supplier)}|${sanitizeText(daiLy)}|${sanitizeText(thucTe)}`;
}

function classify(rec: SheetRow, db: CustomerRow[]): Decision {
  if (!rec.tenKhachHang) {
    return { action: 'skip_no_ten', rec, note: 'no ten_khach_hang after CLV copy' };
  }

  const key = matchKey(rec.supplierCode, rec.daiLy, rec.thucTe);
  const exact = db.filter(
    (c) => matchKey(c.supplier_code, c.diem_tra_hang, c.tuyen_phuong) === key,
  );

  if (exact.length > 1) {
    return {
      action: 'ambiguous',
      rec,
      note: `multiple DB rows for key (${exact.map((c) => c.id).join(',')})`,
    };
  }

  if (exact.length === 1) {
    const row = exact[0];
    if (row.status === 'deactive') {
      return { action: 'deactive_skip', rec, dbId: row.id };
    }

    const mismatchFields: string[] = [];
    if (!sameText(row.tuyen_phuong, rec.thucTe)) mismatchFields.push('diem_thuc_te');
    if (!sameText(row.ten_khach_hang, rec.tenKhachHang)) mismatchFields.push('ten_khach_hang');
    if (!sameText(row.dia_chi_giao_hang, rec.diaChi)) mismatchFields.push('dia_chi_giao_hang');

    const dbTinhPhiBlank = optionalText(row.diem_giao_hang_tinh_phi) == null;
    if (!dbTinhPhiBlank && !sameText(row.diem_giao_hang_tinh_phi, rec.tinhPhi)) {
      mismatchFields.push('diem_giao_hang_tinh_phi');
    }

    const alsoUpdateTinhPhi = dbTinhPhiBlank && optionalText(rec.tinhPhi) != null;
    if (alsoUpdateTinhPhi && mismatchFields.length > 0) {
      return { action: 'mismatch', rec, dbId: row.id, mismatchFields, alsoUpdateTinhPhi: true };
    }
    if (alsoUpdateTinhPhi) {
      return { action: 'update_tinh_phi', rec, dbId: row.id };
    }
    if (mismatchFields.length > 0) {
      return { action: 'mismatch', rec, dbId: row.id, mismatchFields };
    }
    return { action: 'unchanged', rec, dbId: row.id };
  }

  const nullSupplierSamePoint = db.filter(
    (c) =>
      optionalText(c.supplier_code) == null &&
      sameText(c.diem_tra_hang, rec.daiLy) &&
      sameText(c.tuyen_phuong, rec.thucTe),
  );
  if (nullSupplierSamePoint.length > 0) {
    return {
      action: 'ambiguous',
      rec,
      note: `null supplier_code ids=${nullSupplierSamePoint.map((c) => c.id).join(',')}`,
    };
  }

  return { action: 'insert', rec };
}

async function loadDb(client: PoolClient): Promise<{
  suppliers: Set<string>;
  customers: CustomerRow[];
}> {
  const suppliers = await client.query<{ supplier_code: string }>(
    `SELECT supplier_code FROM suppliers WHERE status = 'active'`,
  );
  const customers = await client.query<CustomerRow>(
    `SELECT id, diem_tra_hang, ten_khach_hang, tuyen_phuong, tuyen_cu,
            dia_chi_giao_hang, diem_giao_hang_tinh_phi, boc_xep, supplier_code, status
     FROM customers`,
  );
  return {
    suppliers: new Set(suppliers.rows.map((r) => r.supplier_code)),
    customers: customers.rows,
  };
}

function printSummary(decisions: Decision[], dryRun: boolean): void {
  const counts = new Map<string, number>();
  for (const d of decisions) {
    const k = d.alsoUpdateTinhPhi ? 'mismatch+update_tinh_phi' : d.action;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }

  console.log('');
  console.log(dryRun ? '=== DRY-RUN SUMMARY (no writes) ===' : '=== APPLY SUMMARY ===');
  console.log(`rows=${decisions.length}`);
  for (const [k, n] of [...counts.entries()].sort()) {
    console.log(`  ${k}: ${n}`);
  }

  const show: Action[] = [
    'insert',
    'update_tinh_phi',
    'unchanged',
    'mismatch',
    'deactive_skip',
    'ambiguous',
    'skip_no_ten',
  ];
  for (const action of show) {
    const items = decisions.filter((d) => d.action === action);
    if (items.length === 0) continue;
    console.log('');
    console.log(`-- ${action} (${items.length}) --`);
    for (const d of items) {
      const r = d.rec;
      const extra = [
        d.dbId != null ? `id=${d.dbId}` : null,
        d.mismatchFields?.length ? `fields=${d.mismatchFields.join(',')}` : null,
        d.alsoUpdateTinhPhi ? 'also_fill_tinh_phi' : null,
        d.note ?? null,
        r.copiedTenFromClv ? 'ten_copied_from_clv' : null,
      ]
        .filter(Boolean)
        .join(' | ');
      console.log(
        `  #${r.excelRow} [${supplierLabel(r.supplierCode)}] ${r.daiLy} | ${r.thucTe}${extra ? ` || ${extra}` : ''}`,
      );
    }
  }
}

async function applyInserts(client: PoolClient, decisions: Decision[]): Promise<void> {
  for (const d of decisions) {
    if (d.action !== 'insert') continue;
    const r = d.rec;
    await client.query(
      `INSERT INTO customers
         (diem_tra_hang, ten_khach_hang, tuyen_phuong, tuyen_cu, dia_chi_giao_hang,
          diem_giao_hang_tinh_phi, boc_xep, supplier_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        r.daiLy,
        r.tenKhachHang,
        r.thucTe,
        r.tuyenCu,
        r.diaChi,
        r.tinhPhi,
        r.bocXep,
        r.supplierCode,
      ],
    );
  }

  for (const d of decisions) {
    const shouldUpdate =
      d.action === 'update_tinh_phi' || (d.action === 'mismatch' && d.alsoUpdateTinhPhi);
    if (!shouldUpdate || d.dbId == null) continue;
    await client.query(
      `UPDATE customers
       SET diem_giao_hang_tinh_phi = $1
       WHERE id = $2
         AND (diem_giao_hang_tinh_phi IS NULL OR btrim(diem_giao_hang_tinh_phi) = '')`,
      [d.rec.tinhPhi, d.dbId],
    );
  }
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const rows = loadSheetRows();
  fillTenFromClv(rows);

  const chuyenTai = rows.filter((r) => {
    const n = (r.note ?? '').toLowerCase();
    return n.includes('chuyển tải') || n.includes('chuyen tai');
  });
  for (const r of chuyenTai) {
    console.log(`Note (not stored): #${r.excelRow} [${supplierLabel(r.supplierCode)}] ${r.daiLy} — ${r.note}`);
  }

  const client = await pool.connect();
  try {
    const { suppliers, customers } = await loadDb(client);
    for (const code of REQUIRED_SUPPLIER_CODES) {
      if (!suppliers.has(code)) {
        throw new Error(`Active supplier_code "${code}" not found in suppliers`);
      }
    }

    const decisions = rows.map((rec) => classify(rec, customers));
    printSummary(decisions, dryRun);

    if (dryRun) {
      console.log('\nApply yourself: npx tsx scripts/seed-customers-t7.ts');
      return;
    }

    await client.query('BEGIN');
    await applyInserts(client, decisions);
    await client.query('COMMIT');
    console.log('\nWrites committed.');
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('seed-customers-t7 failed:', err);
  process.exitCode = 1;
});
