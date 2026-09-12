/**
 * Migrate sheet "NDFC -naic (f)" → route pricing (absolute @ 2026-01-01).
 *
 * Source: reference/xu_ly_du_lieu_ke_toan/BẢNG GIÁ - 2026 - 1.8.2026.xlsx
 * Layout: STT | Nơi nhận | Nơi giao | Tỉnh | Phường | >16–23 tấn | Pallet
 *   Chỉ parse Tỉnh + Phường. Bỏ Nơi nhận / Nơi giao. Không location_text, không residual, không note.
 *
 * Một bảng giá "NDFC-naic":
 *   - 1 bậc by_weight 16–23 tấn (Excel không có bậc khác)
 *   - Pallet → pallet_trip_price (cột Pallet ghi nhầm "vnđ/tấn")
 *
 * Prerequisites:
 *   - provinces imported
 *   - bảng giá NDFC-naic (tạo tự động nếu chưa có, match exact name)
 *   - npm run seed:adjustment-periods
 *
 * After (optional, tự chạy): npm run cascade:route-pricing
 *
 * Run from repo root:
 *   npx tsx scripts/seed-ndfc-naic-f.ts --dry-run
 *   npx tsx scripts/seed-ndfc-naic-f.ts
 *   # or: npm run seed:ndfc-naic-f
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
const PRICE_BOOK_NAME = 'NDFC-naic';
const SHEET_NAME = 'NDFC -naic (f)';
const XLSX_PATH = path.join(root, 'reference/xu_ly_du_lieu_ke_toan/BẢNG GIÁ - 2026 - 1.8.2026.xlsx');

type PricingUnit = 'tan';
type PricingMode = 'by_weight';

interface Tier {
  from: number;
  to: number | null;
  unit: PricingUnit;
  price: number;
  min: number | null;
}

interface NdfcNaicRecord {
  excelRow: number;
  groupName: string;
  province: string;
  wardNames: string[];
  pricing_mode: PricingMode;
  pallet: number;
  tiers: Tier[];
}

interface RouteDestination {
  ward_code: string;
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

function normalizeProvince(raw: string): string {
  let p = sanitizeText(raw);
  p = p.replace(/^TP,?\s*/i, '').replace(/^Thành phố\s+/i, '').replace(/^Tỉnh\s+/i, '');
  if (/^(HCM|Hồ Chí Minh)$/i.test(p)) return 'Hồ Chí Minh';
  if (/^Quãng Ngãi$/i.test(p)) return 'Quảng Ngãi';
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

function isHeaderRow(row: unknown[]): boolean {
  const c3 = sanitizeText(row[3]);
  const c4 = sanitizeText(row[4]);
  return /^Tỉnh$/i.test(c3) && /Phường/i.test(c4);
}

function loadNdfcNaicRecords(): NdfcNaicRecord[] {
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

  const records: NdfcNaicRecord[] = [];
  const seenKeys = new Set<string>();
  let inTable = false;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    if (isHeaderRow(row)) {
      inTable = true;
      continue;
    }
    if (!inTable) continue;
    if (/^STT$/i.test(sanitizeText(row[0]))) continue;

    const provinceRaw = sanitizeText(row[3]);
    if (!provinceRaw || /^vnđ/i.test(provinceRaw)) continue;

    const province = normalizeProvince(provinceRaw);
    const phuongRaw = sanitizeText(row[4]);
    const wardNames = phuongRaw ? splitDestinations(phuongRaw) : [];
    if (!wardNames.length) {
      throw new Error(`Row ${i + 1}: thiếu Phường (không residual) — tỉnh="${province}"`);
    }

    const price16 = parseMoney(row[5]);
    if (price16 == null || !(price16 > 0)) {
      throw new Error(`Row ${i + 1}: thiếu giá >16–23 tấn — tỉnh="${province}"`);
    }
    const pallet = parseMoney(row[6]) ?? 0;
    const groupName = buildGroupName(province, wardNames, null);
    const key = `n:${province}\0${groupName}`;
    if (seenKeys.has(key)) {
      console.log(`SKIP dup: ${groupName}`);
      continue;
    }
    seenKeys.add(key);
    records.push({
      excelRow: i + 1,
      groupName,
      province,
      wardNames,
      pricing_mode: 'by_weight',
      pallet: pallet > 0 ? pallet : 0,
      tiers: [{ from: 16, to: 23, unit: 'tan', price: price16, min: null }],
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
  rec: NdfcNaicRecord,
): Promise<RouteDestination[]> {
  const out: RouteDestination[] = [];
  for (const wName of rec.wardNames) {
    const ward = await resolveWard(client, provinceCode, wName);
    out.push({ ward_code: ward.code, phuong: ward.name });
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
  rec: NdfcNaicRecord,
): Promise<number | null> {
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
  },
): Promise<void> {
  const { groupId, priceBookId, provinceCode, tinh, destinations } = opts;

  for (const dest of destinations) {
    const existingRoute = await client.query<{ id: number }>(
      `SELECT id FROM delivery_routes
       WHERE price_book_id=$1 AND province_code=$2 AND status='active'
         AND COALESCE(ward_code,'') = COALESCE($3,'')
         AND COALESCE(location_text,'') = ''
         AND COALESCE(NULLIF(TRIM(note),''),'') = ''
       LIMIT 1`,
      [priceBookId, provinceCode, dest.ward_code],
    );
    let routeId = existingRoute.rows[0]?.id;
    if (routeId == null) {
      const routeRes = await client.query<{ id: number }>(
        `INSERT INTO delivery_routes
           (price_book_id, province_code, ward_code, location_text, note, tinh, phuong, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)
         RETURNING id`,
        [priceBookId, provinceCode, dest.ward_code, null, null, tinh, dest.phuong, USER_ID],
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

async function insertGroupWithPricing(
  client: PoolClient,
  opts: {
    priceBookId: number;
    periodId: number;
    provinceCode: string;
    tinh: string;
    rec: NdfcNaicRecord;
    destinations: RouteDestination[];
  },
): Promise<void> {
  const { priceBookId, periodId, provinceCode, tinh, rec, destinations } = opts;
  const groupRes = await client.query<{ id: number }>(
    `INSERT INTO route_groups
       (price_book_id, name, province_code, tinh, is_residual, note, created_by, updated_by)
     VALUES ($1,$2,$3,$4,FALSE,NULL,$5,$5)
     RETURNING id`,
    [priceBookId, rec.groupName, provinceCode, tinh, USER_ID],
  );
  const groupId = groupRes.rows[0].id;
  await ensureGroupMembers(client, {
    groupId,
    priceBookId,
    provinceCode,
    tinh,
    destinations,
  });

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
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const records = loadNdfcNaicRecords();
  console.log(`Parsed ${records.length} NDFC-naic (f) groups from Excel`);
  console.log(
    `  ${PRICE_BOOK_NAME}` +
      ` by_weight=${records.length}` +
      ` withPallet=${records.filter((r) => r.pallet > 0).length}` +
      ` wards=${records.filter((r) => r.wardNames.length > 0).length}`,
  );
  if (dryRun) {
    for (const r of records) {
      console.log(
        `#${r.excelRow} [${r.pricing_mode}] ${r.groupName} | wards=${r.wardNames.join(', ')}` +
          ` pallet=${r.pallet} 16-23=${r.tiers[0]?.price}`,
      );
    }
    console.log('Dry-run only — no DB writes.');
    return;
  }

  const client = await pool.connect();
  let inserted = 0;
  let skipped = 0;

  try {
    await client.query('BEGIN');

    const priceBookId = await ensurePriceBook(client, PRICE_BOOK_NAME);
    console.log(`Using price book id=${priceBookId} (${PRICE_BOOK_NAME})`);

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
      const province = await resolveProvince(client, rec.province);
      const destinations = await resolveRecordDestinations(client, province.code, rec);
      rec.groupName = buildGroupName(
        province.name,
        destinations.map((d) => d.phuong),
        null,
      );

      const existingId = await findExistingGroup(client, priceBookId, province.code, rec);
      if (existingId != null) {
        console.log(`Skip existing: ${rec.groupName.slice(0, 80)}`);
        skipped += 1;
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
      `✅ NDFC-naic (f) done — inserted ${inserted}, skipped ${skipped}, total ${records.length}`,
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
  console.error('NDFC-naic (f) seed failed:', err);
  process.exitCode = 1;
});
