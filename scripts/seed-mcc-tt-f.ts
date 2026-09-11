/**
 * Migrate sheet "MCC (tt) (f)" → route pricing (absolute @ 2026-01-01).
 *
 * Source: reference/xu_ly_du_lieu_ke_toan/BẢNG GIÁ - 2026 - 1.8.2026.xlsx
 * Layout (cleaned, lệch CLF): STT | Tuyến mới | Tuyến cũ | Tỉnh | Phường | Địa điểm | Note | tiers | pallet
 *
 * Hai khối trên cùng sheet, hai bảng giá (bậc khác nhau — không gắn note giả):
 *   1) MCC (tt) — ≤2.5 / >8–16 / Xe pallet (không seed cột >2.5–8)
 *   2) MCC (tt) GHÉP ND — ≤2.5 / >8–16 / >16–23 / >23 / Pallet
 *     (Excel title khối 2: "MCC GHÉP ND")
 * Note Excel (vd. Đường nhỏ) giữ nguyên.
 *
 * Prerequisites:
 *   - provinces imported
 *   - bảng giá MCC (tt) / MCC (tt) GHÉP ND (tạo tự động nếu chưa có, match exact name)
 *   - npm run seed:adjustment-periods
 *
 * After (optional): npm run cascade:route-pricing
 *
 * Run from repo root:
 *   npx tsx scripts/seed-mcc-tt-f.ts --dry-run
 *   npx tsx scripts/seed-mcc-tt-f.ts
 *   # or: npm run seed:mcc-tt-f
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import type { PoolClient } from '../backend/node_modules/@types/pg/index';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const require = createRequire(path.join(root, 'backend/package.json'));
const XLSX = require('xlsx') as typeof import('xlsx');
const { config: loadEnv } = require('dotenv') as typeof import('dotenv');
const { Pool } = require('pg') as typeof import('pg');

loadEnv({ path: path.join(root, 'backend/.env') });

const USER_ID = 19;
const PERIOD = '2026-01-01';
const PRICE_BOOK_DIRECT = 'MCC (tt)';
const PRICE_BOOK_GHEP = 'MCC (tt) GHÉP ND';
const SHEET_NAME = 'MCC (tt) (f)';
const XLSX_PATH = path.join(root, 'reference/xu_ly_du_lieu_ke_toan/BẢNG GIÁ - 2026 - 1.8.2026.xlsx');

type PricingUnit = 'tan' | 'chuyen';
type PricingMode = 'by_weight' | 'by_trips';

interface Tier {
  from: number;
  to: number | null;
  unit: PricingUnit;
  price: number;
  min: number | null;
}

interface MccTtRecord {
  excelRow: number;
  priceBookName: string;
  groupName: string;
  province: string;
  /** Cột Phường — lookup wards.ward_code */
  wardNames: string[];
  /** Cột Địa điểm — free-text location_text (không trộn với wardNames) */
  locationText: string | null;
  residual: boolean;
  note: string | null;
  pricing_mode: PricingMode;
  pallet: number;
  tiers: Tier[];
}

interface RouteDestination {
  ward_code: string | null;
  location_text: string | null;
  phuong: string;
}

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

function sanitizeText(s: unknown): string {
  return String(s ?? '')
    .normalize('NFC')
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF\u061C]/g, '')
    .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
    .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, '-')
    .replace(/ {2,}/g, ' ')
    .trim();
}

/**
 * Chuẩn hóa về chính tả DB (dấu trên o/u khi không có âm cuối): Hoà→Hòa, Thuỵ→Thụy.
 * Không đụng Hoàn/Hoàng/Hoài (có phụ âm / vần ba).
 */
function canonicalGeoName(s: string): string {
  const end = '(?!\\p{L})';
  return sanitizeText(s)
    .replace(new RegExp(`oà${end}`, 'gu'), 'òa')
    .replace(new RegExp(`Oà${end}`, 'gu'), 'Òa')
    .replace(new RegExp(`OÀ${end}`, 'gu'), 'ÒA')
    .replace(new RegExp(`oá${end}`, 'gu'), 'óa')
    .replace(new RegExp(`Oá${end}`, 'gu'), 'Óa')
    .replace(new RegExp(`OÁ${end}`, 'gu'), 'ÓA')
    .replace(new RegExp(`oả${end}`, 'gu'), 'ỏa')
    .replace(new RegExp(`Oả${end}`, 'gu'), 'Ỏa')
    .replace(new RegExp(`OẢ${end}`, 'gu'), 'ỎA')
    .replace(new RegExp(`oã${end}`, 'gu'), 'õa')
    .replace(new RegExp(`Oã${end}`, 'gu'), 'Õa')
    .replace(new RegExp(`OÃ${end}`, 'gu'), 'ÕA')
    .replace(new RegExp(`oạ${end}`, 'gu'), 'ọa')
    .replace(new RegExp(`Oạ${end}`, 'gu'), 'Ọa')
    .replace(new RegExp(`OẠ${end}`, 'gu'), 'ỌA')
    .replace(new RegExp(`oè${end}`, 'gu'), 'òe')
    .replace(new RegExp(`oé${end}`, 'gu'), 'óe')
    .replace(new RegExp(`oẻ${end}`, 'gu'), 'ỏe')
    .replace(new RegExp(`oẽ${end}`, 'gu'), 'õe')
    .replace(new RegExp(`oẹ${end}`, 'gu'), 'ọe')
    .replace(new RegExp(`(?<![qQ])uỳ${end}`, 'gu'), 'ùy')
    .replace(new RegExp(`(?<![qQ])uý${end}`, 'gu'), 'úy')
    .replace(new RegExp(`(?<![qQ])uỷ${end}`, 'gu'), 'ủy')
    .replace(new RegExp(`(?<![qQ])uỹ${end}`, 'gu'), 'ũy')
    .replace(new RegExp(`(?<![qQ])uỵ${end}`, 'gu'), 'ụy');
}

function parseMoney(v: unknown): number | null {
  if (v == null || v === '') return null;
  const s = sanitizeText(v).replace(/[\s]/g, '').replace(/,/g, '');
  if (!s || s === '-' || /^vnđ/i.test(s) || /mt/i.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function noteKey(note?: string | null): string {
  return (note ?? '').trim();
}

function cleanNote(note?: string | null): string | null {
  return noteKey(note) || null;
}

function normalizeProvince(raw: string): string {
  let p = sanitizeText(raw);
  p = p.replace(/^TP,?\s*/i, '').replace(/^Thành phố\s+/i, '').replace(/^Tỉnh\s+/i, '');
  if (/^(HCM|Hồ Chí Minh)$/i.test(p)) return 'Hồ Chí Minh';
  return canonicalGeoName(p);
}

function buildGroupName(tinh: string, destNames: string[], note?: string | null): string {
  const base = destNames.length ? `${tinh} - ${destNames.join('/ ')}` : tinh;
  const key = noteKey(note);
  return key ? `${base} (${key})` : base;
}

function splitDestinations(raw: string): string[] {
  return sanitizeText(raw)
    .split(/[,/]/)
    .map((s) => sanitizeText(s))
    .filter(Boolean);
}

/** Khối trực tiếp: col7 ≤2.5, col9 >8–16, col10 Xe pallet. Bỏ col8 (>2.5–8). */
function weightTiersDirect(row: unknown[]): { tiers: Tier[]; pallet: number } {
  const p0 = parseMoney(row[7]);
  const p2 = parseMoney(row[9]);
  const tiers: Tier[] = [];
  if (p0 != null && p0 > 0) tiers.push({ from: 0, to: 2.5, unit: 'chuyen', price: p0, min: null });
  if (p2 != null && p2 > 0) tiers.push({ from: 8, to: 16, unit: 'tan', price: p2, min: null });
  return { tiers, pallet: parseMoney(row[10]) ?? 0 };
}

/** Khối GHÉP ND: col7 ≤2.5, col8 >8–16, col9 >16–23, col10 >23, col11 Pallet (không có khung 2.5–8). */
function weightTiersGhep(row: unknown[]): { tiers: Tier[]; pallet: number } {
  const p0 = parseMoney(row[7]);
  const p1 = parseMoney(row[8]);
  const p2 = parseMoney(row[9]);
  const p3 = parseMoney(row[10]);
  const tiers: Tier[] = [];
  if (p0 != null && p0 > 0) tiers.push({ from: 0, to: 2.5, unit: 'chuyen', price: p0, min: null });
  if (p1 != null && p1 > 0) tiers.push({ from: 8, to: 16, unit: 'tan', price: p1, min: null });
  if (p2 != null && p2 > 0) tiers.push({ from: 16, to: 23, unit: 'tan', price: p2, min: null });
  if (p3 != null && p3 > 0) tiers.push({ from: 23, to: null, unit: 'tan', price: p3, min: null });
  return { tiers, pallet: parseMoney(row[11]) ?? 0 };
}

/** Phường trùng tên tỉnh (vd. "Hồ Chí Minh") → residual, không lookup ward. */
function wardNamesFromPhuong(province: string, phuongRaw: string): string[] {
  const names = phuongRaw ? splitDestinations(phuongRaw) : [];
  const p = canonicalGeoName(province);
  if (names.length === 1 && canonicalGeoName(names[0]) === p) return [];
  return names;
}

type Section = 'direct' | 'ghep' | 'skip';

function detectSection(row: unknown[]): Section | null {
  const joined = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
    .map((i) => sanitizeText(row[i]))
    .join('|');
  if (/GHÉP\s*ND/i.test(joined) && !/^Tỉnh$/i.test(sanitizeText(row[3]))) {
    return 'ghep';
  }
  const c3 = sanitizeText(row[3]);
  const c4 = sanitizeText(row[4]);
  const c5 = sanitizeText(row[5]);
  if (!/^Tỉnh$/i.test(c3) || !/Phường|Địa điểm/i.test(c4 + c5)) return null;
  if (/>\s*16/i.test(joined) || /^Pallet$/i.test(sanitizeText(row[11]))) {
    return 'ghep';
  }
  return 'direct';
}

function loadMccTtRecords(): MccTtRecord[] {
  if (!fs.existsSync(XLSX_PATH)) {
    throw new Error(`Missing Excel: ${XLSX_PATH}`);
  }
  const wb = XLSX.readFile(XLSX_PATH, { raw: false });
  const sheet = wb.Sheets[SHEET_NAME];
  if (!sheet) throw new Error(`Sheet "${SHEET_NAME}" not found`);

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    raw: false,
  });

  const records: MccTtRecord[] = [];
  const seenKeys = new Set<string>();
  let section: Section = 'skip';

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    const headerSection = detectSection(row);
    if (headerSection) {
      section = headerSection;
      continue;
    }
    if (section === 'skip') continue;

    const c1 = sanitizeText(row[1]);
    const provinceRaw = sanitizeText(row[3]);
    if (!provinceRaw || /^vnđ/i.test(provinceRaw) || /^96\.2$/i.test(c1) || /^96\.2$/i.test(provinceRaw)) {
      continue;
    }
    if (/^STT$/i.test(sanitizeText(row[0]))) continue;

    const province = normalizeProvince(provinceRaw);
    const phuongRaw = sanitizeText(row[4]);
    const diaDiem = sanitizeText(row[5]) || null;
    const note = cleanNote(sanitizeText(row[6]) || null);
    const priceBookName = section === 'ghep' ? PRICE_BOOK_GHEP : PRICE_BOOK_DIRECT;

    const wardNames = wardNamesFromPhuong(province, phuongRaw);
    const locationText = wardNames.length ? null : diaDiem;
    if (phuongRaw && diaDiem && wardNames.length) {
      console.log(
        `WARN row ${i + 1}: có cả Phường và Địa điểm — dùng Phường (wards), bỏ Địa điểm="${diaDiem}"`,
      );
    }
    const residual = wardNames.length === 0 && !locationText;
    const priced = section === 'ghep' ? weightTiersGhep(row) : weightTiersDirect(row);
    if (!priced.tiers.length) {
      console.log(`SKIP (no weight price): row ${i + 1} ${province}`);
      continue;
    }
    const labels = wardNames.length ? wardNames : locationText ? [locationText] : [];
    const groupName = buildGroupName(province, labels, note);
    const key = residual
      ? `${priceBookName}\0r:${province}\0${note || ''}`
      : `${priceBookName}\0n:${province}\0${groupName}`;
    if (seenKeys.has(key)) {
      console.log(`SKIP dup: ${groupName}`);
      continue;
    }
    seenKeys.add(key);
    records.push({
      excelRow: i + 1,
      priceBookName,
      groupName,
      province,
      wardNames,
      locationText,
      residual,
      note,
      pricing_mode: 'by_weight',
      pallet: priced.pallet > 0 ? priced.pallet : 0,
      tiers: priced.tiers,
    });
  }

  return records;
}

async function resolveProvince(
  client: PoolClient,
  provinceName: string,
): Promise<{ code: string; name: string }> {
  const name = canonicalGeoName(provinceName);
  const { rows } = await client.query<{ code: string; name: string }>(
    `SELECT code, name FROM provinces
     WHERE name ILIKE $1 OR full_name ILIKE $2
     ORDER BY CASE WHEN name ILIKE $1 THEN 0 ELSE 1 END, code
     LIMIT 1`,
    [name, `%${name}%`],
  );
  if (!rows[0]) throw new Error(`Province not found: ${provinceName}`);
  return rows[0];
}

/** Lookup ward by name within province (Excel Phường → wards). */
async function resolveWard(
  client: PoolClient,
  provinceCode: string,
  wardName: string,
): Promise<{ code: string; name: string }> {
  const name = canonicalGeoName(wardName);
  const { rows } = await client.query<{ code: string; name: string }>(
    `SELECT code, name FROM wards
     WHERE province_code = $1
       AND (
         name ILIKE $2
         OR full_name ILIKE $2
         OR full_name ILIKE $3
         OR name ILIKE $4
       )
     ORDER BY
       CASE
         WHEN name ILIKE $2 THEN 0
         WHEN full_name ILIKE $2 THEN 1
         ELSE 2
       END,
       code
     LIMIT 1`,
    [provinceCode, name, `%${name}%`, `${name}%`],
  );
  if (!rows[0]) {
    throw new Error(`Ward not found: "${wardName}" in province_code=${provinceCode}`);
  }
  return rows[0];
}

async function resolveRecordDestinations(
  client: PoolClient,
  provinceCode: string,
  rec: MccTtRecord,
): Promise<RouteDestination[]> {
  if (rec.residual) return [];
  if (rec.wardNames.length && rec.locationText) {
    throw new Error(
      `Row ${rec.excelRow}: không trộn Phường và Địa điểm (${rec.groupName})`,
    );
  }
  const out: RouteDestination[] = [];
  for (const wName of rec.wardNames) {
    const ward = await resolveWard(client, provinceCode, wName);
    out.push({ ward_code: ward.code, location_text: null, phuong: ward.name });
  }
  if (rec.locationText) {
    out.push({
      ward_code: null,
      location_text: rec.locationText,
      phuong: rec.locationText,
    });
  }
  return out;
}

async function ensurePriceBook(client: PoolClient, name: string): Promise<number> {
  const found = await client.query<{ id: number }>(
    `SELECT id FROM price_books
     WHERE status='active' AND lower(trim(name)) = lower($1)
     ORDER BY id
     LIMIT 1`,
    [name],
  );
  if (found.rows[0]) return found.rows[0].id;
  const created = await client.query<{ id: number }>(
    `INSERT INTO price_books (name, created_by, updated_by) VALUES ($1,$2,$2) RETURNING id`,
    [name, USER_ID],
  );
  console.log(`Created price book "${name}" id=${created.rows[0].id}`);
  return created.rows[0].id;
}

async function findExistingGroup(
  client: PoolClient,
  priceBookId: number,
  provinceCode: string,
  rec: MccTtRecord,
): Promise<number | null> {
  if (rec.residual) {
    const { rows } = await client.query<{ id: number }>(
      `SELECT id FROM route_groups
       WHERE price_book_id=$1 AND province_code=$2 AND status='active'
         AND is_residual=TRUE
         AND COALESCE(NULLIF(TRIM(note),''),'') = $3
       LIMIT 1`,
      [priceBookId, provinceCode, noteKey(rec.note)],
    );
    return rows[0]?.id ?? null;
  }
  const { rows } = await client.query<{ id: number }>(
    `SELECT id FROM route_groups
     WHERE price_book_id=$1 AND province_code=$2 AND status='active' AND name=$3
     LIMIT 1`,
    [priceBookId, provinceCode, rec.groupName],
  );
  return rows[0]?.id ?? null;
}

async function ensureGroupMembers(
  client: PoolClient,
  opts: {
    groupId: number;
    priceBookId: number;
    provinceCode: string;
    tinh: string;
    destinations: RouteDestination[];
    note: string | null;
  },
): Promise<void> {
  const { groupId, priceBookId, provinceCode, tinh, destinations, note } = opts;

  for (const dest of destinations) {
    const existingRoute = await client.query<{ id: number }>(
      `SELECT id FROM delivery_routes
       WHERE price_book_id=$1 AND province_code=$2 AND status='active'
         AND COALESCE(ward_code,'') = COALESCE($3,'')
         AND COALESCE(location_text,'') = COALESCE($4,'')
         AND COALESCE(NULLIF(TRIM(note),''),'') = $5
       LIMIT 1`,
      [priceBookId, provinceCode, dest.ward_code, dest.location_text, noteKey(note)],
    );
    let routeId = existingRoute.rows[0]?.id;
    if (routeId == null) {
      const routeRes = await client.query<{ id: number }>(
        `INSERT INTO delivery_routes
           (price_book_id, province_code, ward_code, location_text, note, tinh, phuong, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)
         RETURNING id`,
        [
          priceBookId,
          provinceCode,
          dest.ward_code,
          dest.location_text,
          note,
          tinh,
          dest.phuong,
          USER_ID,
        ],
      );
      routeId = routeRes.rows[0].id;
    } else {
      const owned = await client.query<{ route_group_id: number }>(
        `SELECT route_group_id FROM route_group_members WHERE route_id=$1 LIMIT 1`,
        [routeId],
      );
      if (owned.rows[0] && owned.rows[0].route_group_id !== groupId) {
        console.log(`  reuse skip (route in other group): ${dest.phuong}`);
        continue;
      }
    }
    await client.query(
      `INSERT INTO route_group_members (route_group_id, route_id) VALUES ($1,$2)
       ON CONFLICT (route_group_id, route_id) DO NOTHING`,
      [groupId, routeId],
    );
  }
}

async function ensureGroupPricing(
  client: PoolClient,
  opts: { groupId: number; periodId: number; rec: MccTtRecord },
): Promise<'created' | 'updated' | 'exists'> {
  const { groupId, periodId, rec } = opts;
  const configRes = await client.query<{ id: number }>(
    `SELECT id FROM route_price_configs WHERE route_group_id=$1 AND status='active' LIMIT 1`,
    [groupId],
  );

  if (!configRes.rows[0]) {
    const created = await client.query<{ id: number }>(
      `INSERT INTO route_price_configs (route_group_id, created_by)
       VALUES ($1,$2) RETURNING id`,
      [groupId, USER_ID],
    );
    const versionRes = await client.query<{ id: number }>(
      `INSERT INTO route_price_versions
         (price_config_id, pricing_mode, pallet_trip_price, adjustment_period_id, created_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [created.rows[0].id, rec.pricing_mode, rec.pallet, periodId, USER_ID],
    );
    for (let sort = 0; sort < rec.tiers.length; sort++) {
      const t = rec.tiers[sort];
      await client.query(
        `INSERT INTO route_price_tiers
           (price_version_id, range_from, range_to, pricing_unit, price, min_billable_ton, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [versionRes.rows[0].id, t.from, t.to, t.unit, t.price, t.min, sort],
      );
    }
    return 'created';
  }

  const configId = configRes.rows[0].id;
  const versionRes = await client.query<{ id: number; pallet_trip_price: string }>(
    `SELECT id, pallet_trip_price FROM route_price_versions
     WHERE price_config_id=$1 AND adjustment_period_id=$2
     ORDER BY CASE WHEN base_version_id IS NULL THEN 0 ELSE 1 END, id
     LIMIT 1`,
    [configId, periodId],
  );
  if (!versionRes.rows[0]) {
    const created = await client.query<{ id: number }>(
      `INSERT INTO route_price_versions
         (price_config_id, pricing_mode, pallet_trip_price, adjustment_period_id, created_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [configId, rec.pricing_mode, rec.pallet, periodId, USER_ID],
    );
    for (let sort = 0; sort < rec.tiers.length; sort++) {
      const t = rec.tiers[sort];
      await client.query(
        `INSERT INTO route_price_tiers
           (price_version_id, range_from, range_to, pricing_unit, price, min_billable_ton, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [created.rows[0].id, t.from, t.to, t.unit, t.price, t.min, sort],
      );
    }
    return 'created';
  }

  // Sync pallet from Excel onto existing period version when changed
  if (rec.pallet > 0 && Number(versionRes.rows[0].pallet_trip_price) !== rec.pallet) {
    await client.query(`UPDATE route_price_versions SET pallet_trip_price=$1 WHERE id=$2`, [
      rec.pallet,
      versionRes.rows[0].id,
    ]);
    return 'updated';
  }
  return 'exists';
}

async function insertGroupWithPricing(
  client: PoolClient,
  opts: {
    priceBookId: number;
    periodId: number;
    provinceCode: string;
    tinh: string;
    rec: MccTtRecord;
    destinations: RouteDestination[];
  },
): Promise<void> {
  const { priceBookId, periodId, provinceCode, tinh, rec, destinations } = opts;
  const groupRes = await client.query<{ id: number }>(
    `INSERT INTO route_groups
       (price_book_id, name, province_code, tinh, is_residual, note, created_by, updated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$7)
     RETURNING id`,
    [priceBookId, rec.groupName, provinceCode, tinh, rec.residual, rec.note, USER_ID],
  );
  const groupId = groupRes.rows[0].id;
  await ensureGroupMembers(client, {
    groupId,
    priceBookId,
    provinceCode,
    tinh,
    destinations,
    note: rec.note,
  });
  await ensureGroupPricing(client, { groupId, periodId, rec });
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const records = loadMccTtRecords();
  const direct = records.filter((r) => r.priceBookName === PRICE_BOOK_DIRECT);
  const ghep = records.filter((r) => r.priceBookName === PRICE_BOOK_GHEP);
  console.log(`Parsed ${records.length} MCC (tt) (f) groups from Excel`);
  console.log(
    `  ${PRICE_BOOK_DIRECT}=${direct.length}` +
      ` ${PRICE_BOOK_GHEP}=${ghep.length}` +
      ` withPallet=${records.filter((r) => r.pallet > 0).length}` +
      ` residual=${records.filter((r) => r.residual).length}` +
      ` wards=${records.filter((r) => r.wardNames.length > 0).length}` +
      ` locationText=${records.filter((r) => !!r.locationText).length}`,
  );
  if (dryRun) {
    for (const r of records) {
      const kind = r.residual
        ? 'residual'
        : r.wardNames.length
          ? `wards=${r.wardNames.length}`
          : `location="${r.locationText}"`;
      console.log(
        `#${r.excelRow} [${r.priceBookName}] ${r.groupName} | ${kind} pallet=${r.pallet} tiers=${r.tiers.length} note=${r.note ?? ''}`,
      );
    }
    console.log('Dry-run only — no DB writes.');
    return;
  }

  const client = await pool.connect();
  let inserted = 0;
  let repaired = 0;
  let skipped = 0;
  let palletSynced = 0;

  try {
    await client.query('BEGIN');

    const bookIds = new Map<string, number>();
    bookIds.set(PRICE_BOOK_DIRECT, await ensurePriceBook(client, PRICE_BOOK_DIRECT));
    bookIds.set(PRICE_BOOK_GHEP, await ensurePriceBook(client, PRICE_BOOK_GHEP));
    for (const [name, id] of bookIds) {
      console.log(`Using price book id=${id} (${name})`);
    }

    const periodRes = await client.query<{ id: number }>(
      `SELECT id FROM route_pricing_adjustment_periods WHERE start_date = $1::date`,
      [PERIOD],
    );
    if (!periodRes.rows[0]) {
      throw new Error(
        `Adjustment period ${PERIOD} not found — run npm run seed:adjustment-periods first`,
      );
    }
    const periodId = periodRes.rows[0].id;

    for (const rec of records) {
      const priceBookId = bookIds.get(rec.priceBookName);
      if (priceBookId == null) {
        throw new Error(`Missing price book id for "${rec.priceBookName}"`);
      }
      const province = await resolveProvince(client, rec.province);
      const destinations = await resolveRecordDestinations(client, province.code, rec);
      // Group name theo tên ward trong DB (giống createGroup FE)
      if (!rec.residual) {
        rec.groupName = buildGroupName(
          province.name,
          destinations.map((d) => d.phuong),
          rec.note,
        );
      } else {
        rec.groupName = buildGroupName(province.name, [], rec.note);
      }

      const existingId = await findExistingGroup(client, priceBookId, province.code, rec);
      if (existingId != null) {
        await ensureGroupMembers(client, {
          groupId: existingId,
          priceBookId,
          provinceCode: province.code,
          tinh: province.name,
          destinations,
          note: rec.note,
        });
        const pricing = await ensureGroupPricing(client, {
          groupId: existingId,
          periodId,
          rec,
        });
        if (pricing === 'created') {
          console.log(`Repaired: ${rec.groupName.slice(0, 80)}`);
          repaired += 1;
        } else if (pricing === 'updated') {
          console.log(`Pallet sync: ${rec.groupName.slice(0, 80)}`);
          palletSynced += 1;
        } else {
          console.log(`Skip existing: ${rec.groupName.slice(0, 80)}`);
          skipped += 1;
        }
        continue;
      }

      await insertGroupWithPricing(client, {
        priceBookId,
        periodId,
        provinceCode: province.code,
        tinh: province.name,
        rec,
        destinations,
      });
      console.log(`Inserted: ${rec.groupName.slice(0, 80)}`);
      inserted += 1;
    }

    await client.query('COMMIT');
    console.log(
      `✅ MCC (tt) (f) done — inserted ${inserted}, repaired ${repaired}, palletSynced ${palletSynced}, skipped ${skipped}, total ${records.length}`,
    );
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('MCC (tt) (f) seed failed:', err);
  process.exitCode = 1;
});
