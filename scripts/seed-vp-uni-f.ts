/**
 * Migrate sheet "VP-uni (f)" → route pricing (absolute @ 2026-01-01).
 *
 * Source: reference/xu_ly_du_lieu_ke_toan/BẢNG GIÁ - 2026 - 1.8.2026.xlsx
 * Layout: STT | Tỉnh | Phường | ≤2.5 | >2.5–8 (min 5) | >8–16 | >16–23 | >23
 *   Phường → wards (RAISE nếu thiếu). "-" / trống → residual.
 *   Không Địa điểm, note, pallet, trips, IBC.
 *   Hai dòng cùng tỉnh+phường (vd. Hiệp Phước) gộp bậc giá.
 *
 * Prerequisites:
 *   - provinces imported
 *   - bảng giá VP-uni (tạo tự động nếu chưa có)
 *   - npm run seed:adjustment-periods
 *
 * After (optional): npm run cascade:route-pricing
 *
 * Run from repo root:
 *   npx tsx scripts/seed-vp-uni-f.ts --dry-run
 *   npx tsx scripts/seed-vp-uni-f.ts
 *   # or: npm run seed:vp-uni-f
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
const PRICE_BOOK_NAME = 'VP-uni';
const SHEET_NAME = 'VP-uni (f)';
const XLSX_PATH = path.join(root, 'reference/xu_ly_du_lieu_ke_toan/BẢNG GIÁ - 2026 - 1.8.2026.xlsx');

type PricingUnit = 'tan' | 'chuyen';
type PricingMode = 'by_weight';

interface Tier {
  from: number;
  to: number | null;
  unit: PricingUnit;
  price: number;
  min: number | null;
}

interface VpUniRecord {
  excelRow: number;
  groupName: string;
  province: string;
  wardNames: string[];
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

function normalizeProvince(raw: string): string {
  let p = sanitizeText(raw);
  p = p.replace(/^TP,?\s*/i, '').replace(/^Thành phố\s+/i, '').replace(/^Tỉnh\s+/i, '');
  if (/^(HCM|Hồ Chí Minh)$/i.test(p)) return 'Hồ Chí Minh';
  if (/^Dak\s*Lak$/i.test(p)) return 'Đắk Lắk';
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

/** Excel "Bảo Lộc" = 3 phường DB: 1/2/3 Bảo Lộc. */
function expandWardAliases(names: string[]): string[] {
  const out: string[] = [];
  for (const name of names) {
    if (/^Bảo Lộc$/i.test(canonicalGeoName(name))) {
      out.push('1 Bảo Lộc', '2 Bảo Lộc', '3 Bảo Lộc');
      continue;
    }
    out.push(name);
  }
  return out;
}

function weightTiersFromCols(row: unknown[]): Tier[] {
  const p0 = parseMoney(row[3]);
  const p1 = parseMoney(row[4]);
  const p2 = parseMoney(row[5]);
  const p3 = parseMoney(row[6]);
  const p4 = parseMoney(row[7]);
  const tiers: Tier[] = [];
  if (p0 != null && p0 > 0) tiers.push({ from: 0, to: 2.5, unit: 'chuyen', price: p0, min: null });
  if (p1 != null && p1 > 0) tiers.push({ from: 2.5, to: 8, unit: 'tan', price: p1, min: 5 });
  if (p2 != null && p2 > 0) tiers.push({ from: 8, to: 16, unit: 'tan', price: p2, min: null });
  if (p3 != null && p3 > 0) tiers.push({ from: 16, to: 23, unit: 'tan', price: p3, min: null });
  if (p4 != null && p4 > 0) tiers.push({ from: 23, to: null, unit: 'tan', price: p4, min: null });
  return tiers;
}

function tierKey(t: Tier): string {
  return `${t.from}|${t.to ?? ''}|${t.unit}`;
}

function mergeTiers(existing: Tier[], incoming: Tier[], excelRow: number, groupName: string): Tier[] {
  const byKey = new Map(existing.map((t) => [tierKey(t), t]));
  for (const t of incoming) {
    const prev = byKey.get(tierKey(t));
    if (!prev) {
      byKey.set(tierKey(t), t);
      continue;
    }
    if (prev.price !== t.price || prev.min !== t.min) {
      throw new Error(
        `Row ${excelRow}: conflict merge "${groupName}" tier ${tierKey(t)} ` +
          `(${prev.price} vs ${t.price})`,
      );
    }
  }
  const order = ['0|2.5|chuyen', '2.5|8|tan', '8|16|tan', '16|23|tan', '23||tan'];
  return order.map((k) => byKey.get(k)).filter((t): t is Tier => t != null);
}

function recDedupeKey(province: string, residual: boolean, wardNames: string[]): string {
  if (residual) return `r:${province}`;
  return `w:${province}\0${wardNames.map((n) => canonicalGeoName(n).toLowerCase()).join('|')}`;
}

function isHeaderRow(row: unknown[]): boolean {
  return /^Tỉnh$/i.test(sanitizeText(row[1])) && /Phường/i.test(sanitizeText(row[2]));
}

function loadVpUniRecords(): VpUniRecord[] {
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

  const byKey = new Map<string, VpUniRecord>();
  let inTable = false;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    if (isHeaderRow(row)) {
      inTable = true;
      continue;
    }
    if (!inTable) continue;

    const c1 = sanitizeText(row[1]);
    if (!c1 || /^vnđ/i.test(c1) || /^STT$/i.test(sanitizeText(row[0]))) continue;

    const province = normalizeProvince(c1);
    const phuongRaw = sanitizeText(row[2]);
    const residual = !phuongRaw || phuongRaw === '-';
    const wardNames = residual ? [] : expandWardAliases(splitDestinations(phuongRaw));
    const tiers = weightTiersFromCols(row);
    if (!tiers.length) {
      throw new Error(`Row ${i + 1}: no weight price for ${province} / ${phuongRaw || '-'}`);
    }
    const labels = wardNames.length ? wardNames : [];
    const groupName = buildGroupName(province, labels, null);
    const key = recDedupeKey(province, residual, wardNames);
    const existing = byKey.get(key);
    if (existing) {
      existing.tiers = mergeTiers(existing.tiers, tiers, i + 1, groupName);
      continue;
    }
    byKey.set(key, {
      excelRow: i + 1,
      groupName,
      province,
      wardNames,
      residual,
      note: null,
      pricing_mode: 'by_weight',
      pallet: 0,
      tiers,
    });
  }

  return [...byKey.values()];
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
  rec: VpUniRecord,
): Promise<RouteDestination[]> {
  if (rec.residual) return [];
  const out: RouteDestination[] = [];
  for (const wName of rec.wardNames) {
    const ward = await resolveWard(client, provinceCode, wName);
    out.push({ ward_code: ward.code, location_text: null, phuong: ward.name });
  }
  return out;
}

async function ensurePriceBook(client: PoolClient): Promise<number> {
  const found = await client.query<{ id: number }>(
    `SELECT id FROM price_books
     WHERE status='active'
       AND (
         lower(trim(name)) = lower($1)
         OR name ILIKE $1 || ' — %'
       )
     ORDER BY CASE WHEN lower(trim(name)) = lower($1) THEN 0 ELSE 1 END, id
     LIMIT 1`,
    [PRICE_BOOK_NAME],
  );
  if (found.rows[0]) return found.rows[0].id;
  const created = await client.query<{ id: number }>(
    `INSERT INTO price_books (name, created_by, updated_by) VALUES ($1,$2,$2) RETURNING id`,
    [PRICE_BOOK_NAME, USER_ID],
  );
  console.log(`Created price book "${PRICE_BOOK_NAME}" id=${created.rows[0].id}`);
  return created.rows[0].id;
}

async function findExistingGroup(
  client: PoolClient,
  priceBookId: number,
  provinceCode: string,
  rec: VpUniRecord,
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
  opts: { groupId: number; periodId: number; rec: VpUniRecord },
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

  return 'exists';
}

async function insertGroupWithPricing(
  client: PoolClient,
  opts: {
    priceBookId: number;
    periodId: number;
    provinceCode: string;
    tinh: string;
    rec: VpUniRecord;
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

async function resolveAll(
  client: PoolClient,
  records: VpUniRecord[],
): Promise<void> {
  for (const rec of records) {
    const province = await resolveProvince(client, rec.province);
    const destinations = await resolveRecordDestinations(client, province.code, rec);
    if (!rec.residual) {
      rec.groupName = buildGroupName(
        province.name,
        destinations.map((d) => d.phuong),
        rec.note,
      );
    } else {
      rec.groupName = buildGroupName(province.name, [], rec.note);
    }
    const kind = rec.residual ? 'residual' : `wards=${destinations.length}`;
    console.log(
      `#${rec.excelRow} [${rec.pricing_mode}] ${rec.groupName} | ${kind} pallet=${rec.pallet} tiers=${rec.tiers.length}`,
    );
  }
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const records = loadVpUniRecords();
  console.log(`Parsed ${records.length} VP-uni (f) groups from Excel`);
  console.log(
    `  by_weight=${records.filter((r) => r.pricing_mode === 'by_weight').length}` +
      ` residual=${records.filter((r) => r.residual).length}` +
      ` wards=${records.filter((r) => r.wardNames.length > 0).length}` +
      ` locationText=0`,
  );

  const client = await pool.connect();
  try {
    await resolveAll(client, records);

    if (dryRun) {
      console.log('Dry-run only — no DB writes.');
      return;
    }

    await client.query('BEGIN');

    const priceBookId = await ensurePriceBook(client);
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

    let inserted = 0;
    let repaired = 0;
    let skipped = 0;

    for (const rec of records) {
      const province = await resolveProvince(client, rec.province);
      const destinations = await resolveRecordDestinations(client, province.code, rec);

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
      `✅ VP-uni (f) done — inserted ${inserted}, repaired ${repaired}, skipped ${skipped}, total ${records.length}`,
    );
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* dry-run / no txn */
    }
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('VP-uni (f) seed failed:', err);
  process.exitCode = 1;
});
