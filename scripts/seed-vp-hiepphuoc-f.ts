/**
 * Migrate sheet "VP-hiep phuoc (f)" → route pricing (absolute @ 2026-01-01).
 *
 * Source: reference/xu_ly_du_lieu_ke_toan/BẢNG GIÁ - 2026 - 1.8.2026.xlsx
 * Layout: STT | Tỉnh | Phường | Địa điểm | Note | Truck ≤2.5 (chuyến) | Truck <9 |
 *   Truck ≥15 | 8< Truck ≤16 | 16< Truck ≤23 | Truck >23  (còn lại: tấn)
 *   pricing_mode = by_truck; nhãn Excel; bỏ cột giá 0.
 *   Phường → wards (RAISE nếu thiếu). "-" / trống + không Địa điểm → residual.
 *   Địa điểm → location_text (không trộn với Phường).
 *   Note "Skip - Giống …" → không seed.
 *   Dòng trùng dest + note trống → gắn note "Truck >23 (phụ)".
 *
 * Prerequisites:
 *   - provinces imported
 *   - bảng giá VP-hiep phuoc (tạo tự động nếu chưa có)
 *   - npm run seed:adjustment-periods
 *
 * After (optional): npm run cascade:route-pricing
 *
 * Run from repo root:
 *   npx tsx scripts/seed-vp-hiepphuoc-f.ts --dry-run
 *   npx tsx scripts/seed-vp-hiepphuoc-f.ts
 *   # or: npm run seed:vp-hiepphuoc-f
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
const PRICE_BOOK_NAME = 'VP-hiep phuoc';
const SHEET_NAME = 'VP-hiep phuoc (f)';
const DUP_NOTE = 'Truck >23 (phụ)';
const XLSX_PATH = path.join(root, 'reference/xu_ly_du_lieu_ke_toan/BẢNG GIÁ - 2026 - 1.8.2026.xlsx');

type PricingUnit = 'tan' | 'chuyen';
type PricingMode = 'by_truck';

interface Tier {
  from: number;
  to: number | null;
  unit: PricingUnit;
  price: number;
  min: number | null;
  label: string;
}

interface VpHpRecord {
  excelRow: number;
  groupName: string;
  province: string;
  wardNames: string[];
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

const TRUCK_COLS: { col: number; label: string; unit: PricingUnit }[] = [
  { col: 5, label: 'Truck ≤2.5', unit: 'chuyen' },
  { col: 6, label: 'Truck <9', unit: 'tan' },
  { col: 7, label: 'Truck ≥15', unit: 'tan' },
  { col: 8, label: '8< Truck ≤16', unit: 'tan' },
  { col: 9, label: '16< Truck ≤23', unit: 'tan' },
  { col: 10, label: 'Truck >23', unit: 'tan' },
];

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

function expandWardAliases(names: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (n: string) => {
    const k = canonicalGeoName(n).toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push(n);
  };
  for (const name of names) {
    const canon = canonicalGeoName(name);
    if (/^Bảo Lộc$/i.test(canon)) {
      push('1 Bảo Lộc');
      push('2 Bảo Lộc');
      push('3 Bảo Lộc');
      continue;
    }
    if (/^B['’]?\s*Lao$/i.test(canon)) {
      push("B'Lao");
      continue;
    }
    if (/^Đắk\s*Cấm$/i.test(canon) || /^Dak\s*Cấm$/i.test(canon) || /^Đăk\s*Cấm$/i.test(canon)) {
      push('Đăk Cấm');
      continue;
    }
    push(name);
  }
  return out;
}

function wardNamesFromPhuong(province: string, phuongRaw: string): string[] {
  if (!phuongRaw || phuongRaw === '-') return [];
  const names = splitDestinations(phuongRaw);
  const p = canonicalGeoName(province);
  if (names.length === 1 && canonicalGeoName(names[0]) === p) return [];
  return expandWardAliases(names);
}

function truckTiersFromCols(row: unknown[]): Tier[] {
  const tiers: Tier[] = [];
  for (const col of TRUCK_COLS) {
    const price = parseMoney(row[col.col]);
    if (price == null || !(price > 0)) continue;
    tiers.push({
      from: 0,
      to: null,
      unit: col.unit,
      price,
      min: null,
      label: col.label,
    });
  }
  return tiers;
}

function destDedupeKey(rec: Pick<VpHpRecord, 'province' | 'residual' | 'wardNames' | 'locationText' | 'note'>): string {
  const note = noteKey(rec.note);
  if (rec.residual) return `r:${rec.province}\0${note}`;
  if (rec.locationText) return `l:${rec.province}\0${rec.locationText}\0${note}`;
  return `w:${rec.province}\0${[...rec.wardNames].map((n) => canonicalGeoName(n).toLowerCase()).sort().join('|')}\0${note}`;
}

function isHeaderRow(row: unknown[]): boolean {
  const c1 = sanitizeText(row[1]);
  const c2 = sanitizeText(row[2]);
  const joined = [c1, c2, sanitizeText(row[3]), sanitizeText(row[5]), sanitizeText(row[10])].join('|');
  return /^Tỉnh$/i.test(c1) && /Phường|Địa điểm/i.test(c2 + sanitizeText(row[3])) && /Truck/i.test(joined);
}

function isSkipNote(note: string | null): boolean {
  return !!note && /^skip\b/i.test(note);
}

function loadVpHpRecords(): VpHpRecord[] {
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

  const records: VpHpRecord[] = [];
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

    const provinceRaw = sanitizeText(row[1]);
    if (!provinceRaw || /^vnđ/i.test(provinceRaw) || /^STT$/i.test(sanitizeText(row[0]))) continue;

    const province = normalizeProvince(provinceRaw);
    const phuongRaw = sanitizeText(row[2]);
    const diaDiem = sanitizeText(row[3]) || null;
    let note = cleanNote(sanitizeText(row[4]) || null);

    if (isSkipNote(note)) {
      console.log(`SKIP: row ${i + 1} ${province} ${phuongRaw || '-'} | ${note}`);
      continue;
    }

    const wardNames = wardNamesFromPhuong(province, phuongRaw);
    const locationText = wardNames.length ? null : diaDiem;
    if (phuongRaw && phuongRaw !== '-' && diaDiem && wardNames.length) {
      console.log(
        `WARN row ${i + 1}: có cả Phường và Địa điểm — dùng Phường (wards), bỏ Địa điểm="${diaDiem}"`,
      );
    }
    const residual = wardNames.length === 0 && !locationText;
    const tiers = truckTiersFromCols(row);
    if (!tiers.length) {
      console.log(`SKIP (no truck price): row ${i + 1} ${province}`);
      continue;
    }

    const labels = wardNames.length ? wardNames : locationText ? [locationText] : [];
    let groupName = buildGroupName(province, labels, note);
    const draft: VpHpRecord = {
      excelRow: i + 1,
      groupName,
      province,
      wardNames,
      locationText,
      residual,
      note,
      pricing_mode: 'by_truck',
      pallet: 0,
      tiers,
    };

    let key = destDedupeKey(draft);
    if (seenKeys.has(key)) {
      if (note) {
        console.log(`SKIP dup: ${groupName}`);
        continue;
      }
      draft.note = DUP_NOTE;
      draft.groupName = buildGroupName(province, labels, DUP_NOTE);
      key = destDedupeKey(draft);
      if (seenKeys.has(key)) {
        throw new Error(`Row ${i + 1}: still duplicate after ${DUP_NOTE}: ${draft.groupName}`);
      }
      console.log(`NOTE phụ: row ${i + 1} → ${draft.groupName}`);
    }
    seenKeys.add(key);
    records.push(draft);
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
  rec: VpHpRecord,
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
  rec: VpHpRecord,
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

async function insertTruckTiers(
  client: PoolClient,
  versionId: number,
  tiers: Tier[],
): Promise<void> {
  for (let sort = 0; sort < tiers.length; sort++) {
    const t = tiers[sort];
    await client.query(
      `INSERT INTO route_price_tiers
         (price_version_id, range_from, range_to, pricing_unit, price, min_billable_ton, sort_order, label)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [versionId, 0, null, t.unit, t.price, null, sort, t.label],
    );
  }
}

async function ensureGroupPricing(
  client: PoolClient,
  opts: { groupId: number; periodId: number; rec: VpHpRecord },
): Promise<'created' | 'exists'> {
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
    await insertTruckTiers(client, versionRes.rows[0].id, rec.tiers);
    return 'created';
  }

  const configId = configRes.rows[0].id;
  const versionRes = await client.query<{ id: number }>(
    `SELECT id FROM route_price_versions
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
    await insertTruckTiers(client, created.rows[0].id, rec.tiers);
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
    rec: VpHpRecord;
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

function logRecord(rec: VpHpRecord, kind: string): void {
  const labels = rec.tiers.map((t) => `${t.label}=${t.price}`).join(', ');
  console.log(`#${rec.excelRow} [by_truck] ${rec.groupName} | ${kind} tiers=${rec.tiers.length} [${labels}]`);
}

async function resolveAll(client: PoolClient, records: VpHpRecord[]): Promise<void> {
  const missing: string[] = [];
  for (const rec of records) {
    let province: { code: string; name: string };
    try {
      province = await resolveProvince(client, rec.province);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      missing.push(`#${rec.excelRow} ${rec.province} / ${rec.wardNames.join(', ') || rec.locationText || '-'} — ${msg}`);
      continue;
    }
    let destinations: RouteDestination[];
    try {
      destinations = await resolveRecordDestinations(client, province.code, rec);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      missing.push(`#${rec.excelRow} ${rec.province} / ${rec.wardNames.join(', ') || rec.locationText || '-'} — ${msg}`);
      continue;
    }
    if (!rec.residual) {
      rec.groupName = buildGroupName(
        province.name,
        destinations.map((d) => d.phuong),
        rec.note,
      );
    } else {
      rec.groupName = buildGroupName(province.name, [], rec.note);
    }
    const kind = rec.residual
      ? 'residual'
      : rec.wardNames.length
        ? `wards=${destinations.length}`
        : `location="${rec.locationText}"`;
    logRecord(rec, kind);
  }
  if (missing.length) {
    throw new Error(`Ward/province resolve failed (${missing.length}):\n${missing.join('\n')}`);
  }
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const records = loadVpHpRecords();
  console.log(`Parsed ${records.length} VP-hiep phuoc (f) groups from Excel`);
  console.log(
    `  by_truck=${records.filter((r) => r.pricing_mode === 'by_truck').length}` +
      ` residual=${records.filter((r) => r.residual).length}` +
      ` wards=${records.filter((r) => r.wardNames.length > 0).length}` +
      ` locationText=${records.filter((r) => !!r.locationText).length}` +
      ` notePhu=${records.filter((r) => r.note === DUP_NOTE).length}`,
  );

  const client = await pool.connect();
  let began = false;
  try {
    await resolveAll(client, records);

    if (dryRun) {
      console.log('Dry-run only — no DB writes.');
      return;
    }

    await client.query('BEGIN');
    began = true;

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
      `✅ VP-hiep phuoc (f) done — inserted ${inserted}, repaired ${repaired}, skipped ${skipped}, total ${records.length}`,
    );
  } catch (err) {
    if (began) await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('VP-hiep phuoc (f) seed failed:', err);
  process.exitCode = 1;
});
