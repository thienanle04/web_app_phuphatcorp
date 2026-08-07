/**
 * Migrate sheet "CLF (f)" → route pricing (absolute @ 2026-01-01).
 *
 * Source: reference/xu_ly_du_lieu_ke_toan/BẢNG GIÁ - 2026 - 1.8.2026.xlsx
 * (cleaned: Tỉnh | Phường→wards | Địa điểm→location_text | Note | tiers | Giá pallet)
 *
 * Prerequisites:
 *   - provinces imported
 *   - suppliers CLF (supplier_code=2000000001)
 *   - npm run seed:adjustment-periods
 *
 * After (optional): npm run cascade:route-pricing
 *
 * Run from repo root:
 *   npx tsx scripts/seed-clf-f.ts --dry-run
 *   npx tsx scripts/seed-clf-f.ts
 *   # or: npm run seed:clf-f / cd backend && npm run seed:clf-f
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
const SUPPLIER_CODE = '2000000001';
const SHEET_NAME = 'CLF (f)';
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

interface ClfRecord {
  excelRow: number;
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

/** Excel often types Hòa; VN provinces DB uses Hoà (o + à). */
function foldVietnameseOa(s: string): string {
  return s
    .replace(/òa/g, 'oà')
    .replace(/Òa/g, 'Oà')
    .replace(/ÒA/g, 'OÀ')
    .replace(/óa/g, 'oá')
    .replace(/Óa/g, 'Oá')
    .replace(/ÓA/g, 'OÁ')
    .replace(/ỏa/g, 'oả')
    .replace(/Ỏa/g, 'Oả')
    .replace(/ỎA/g, 'OẢ')
    .replace(/õa/g, 'oã')
    .replace(/Õa/g, 'Oã')
    .replace(/ÕA/g, 'OÃ')
    .replace(/ọa/g, 'oạ')
    .replace(/Ọa/g, 'Oạ')
    .replace(/ỌA/g, 'OẠ');
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
  return foldVietnameseOa(p);
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

function weightTiersFromCols(row: unknown[]): Tier[] {
  const p0 = parseMoney(row[5]);
  const p1 = parseMoney(row[6]);
  const p2 = parseMoney(row[7]);
  const p3 = parseMoney(row[8]);
  const p4 = parseMoney(row[9]);
  const tiers: Tier[] = [];
  if (p0 != null && p0 > 0) tiers.push({ from: 0, to: 2.5, unit: 'chuyen', price: p0, min: null });
  if (p1 != null && p1 > 0) tiers.push({ from: 2.5, to: 8, unit: 'tan', price: p1, min: 5 });
  if (p2 != null && p2 > 0) tiers.push({ from: 8, to: 16, unit: 'tan', price: p2, min: null });
  if (p3 != null && p3 > 0) tiers.push({ from: 16, to: 23, unit: 'tan', price: p3, min: null });
  if (p4 != null && p4 > 0) tiers.push({ from: 23, to: null, unit: 'tan', price: p4, min: null });
  return tiers;
}

function parseTripsNote(noteRaw: string): { from: number; to: number | null } | null {
  const n = sanitizeText(noteRaw);
  if (/từ 1 đến 12 chuyến/i.test(n)) return { from: 1, to: 12 };
  if (/chuyến thứ 13/i.test(n)) return { from: 13, to: null };
  if (/1-3 chuyến/i.test(n)) return { from: 1, to: 3 };
  if (/>\s*3\s*chuyến/i.test(n) || /Áp dụng\s*>\s*3/i.test(n)) return { from: 4, to: null };
  return null;
}

type Section = 'weight' | 'trips' | 'ibc' | 'skip';

function detectSection(row: unknown[]): Section | null {
  const c1 = sanitizeText(row[1]);
  const c2 = sanitizeText(row[2]);
  const c3 = sanitizeText(row[3]);
  const c4 = sanitizeText(row[4]);
  const joined = [c1, c2, c3, c4, sanitizeText(row[5]), sanitizeText(row[10])].join('|');
  if (/^Tỉnh$/i.test(c1) && /Phường|Địa điểm/i.test(c2 + c3) && /Giá pallet|≤\s*2/i.test(joined)) {
    return 'weight';
  }
  if (/^Tỉnh$/i.test(c1) && /^Địa điểm$/i.test(c2) && /Chuyến/i.test(c3 + c4)) {
    return 'trips';
  }
  if (/^STT$/i.test(sanitizeText(row[0])) && />\s*3/i.test(joined) && /(MT|tấn)/i.test(joined)) {
    return 'ibc';
  }
  if (/>3\s*-?\s*≤?\s*7\s*(MT|tấn)/i.test(joined) || (/IBC/i.test(joined) && /≤7/i.test(joined))) {
    return 'ibc';
  }
  return null;
}

function loadClfRecords(): ClfRecord[] {
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

  const records: ClfRecord[] = [];
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

    // unit / blank rows
    const c1 = sanitizeText(row[1]);
    if (!c1 || /^vnđ/i.test(c1) || /^96\.2$/i.test(c1)) continue;
    if (/^STT$/i.test(sanitizeText(row[0]))) continue;

    if (section === 'weight') {
      const province = normalizeProvince(c1);
      const phuongRaw = sanitizeText(row[2]);
      const diaDiem = sanitizeText(row[3]) || null;
      const note = cleanNote(sanitizeText(row[4]) || null);
      const wardNames = phuongRaw ? splitDestinations(phuongRaw) : [];
      const locationText = wardNames.length ? null : diaDiem;
      if (phuongRaw && diaDiem) {
        console.log(
          `WARN row ${i + 1}: có cả Phường và Địa điểm — dùng Phường (wards), bỏ Địa điểm="${diaDiem}"`,
        );
      }
      const residual = wardNames.length === 0 && !locationText;
      const tiers = weightTiersFromCols(row);
      const pallet = parseMoney(row[10]) ?? 0;
      if (!tiers.length) {
        console.log(`SKIP (no weight price): row ${i + 1} ${province}`);
        continue;
      }
      const labels = wardNames.length ? wardNames : locationText ? [locationText] : [];
      const groupName = buildGroupName(province, labels, note);
      const key = residual
        ? `r:${province}\0${note || ''}`
        : `n:${province}\0${groupName}`;
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
        locationText,
        residual,
        note,
        pricing_mode: 'by_weight',
        pallet: pallet > 0 ? pallet : 0,
        tiers,
      });
      continue;
    }

    if (section === 'trips') {
      const province = normalizeProvince(c1);
      const diaDiem = sanitizeText(row[2]);
      const tripNote = sanitizeText(row[3]);
      const price = parseMoney(row[4]);
      if (!diaDiem || price == null || !(price > 0)) {
        console.log(`SKIP trips (no price): row ${i + 1}`);
        continue;
      }
      const note = cleanNote(tripNote || null);
      const range = parseTripsNote(tripNote);
      const tiers: Tier[] = range
        ? [{ from: range.from, to: range.to, unit: 'chuyen', price, min: null }]
        : [{ from: 1, to: null, unit: 'chuyen', price, min: null }];
      const groupName = buildGroupName(province, [diaDiem], note);
      const key = `n:${province}\0${groupName}`;
      if (seenKeys.has(key)) {
        console.log(`SKIP dup trips: ${groupName}`);
        continue;
      }
      seenKeys.add(key);
      records.push({
        excelRow: i + 1,
        groupName,
        province,
        wardNames: [],
        locationText: diaDiem,
        residual: false,
        note,
        pricing_mode: 'by_trips',
        pallet: 0,
        tiers,
      });
      continue;
    }

    if (section === 'ibc') {
      // Data: col1=Tỉnh, col2=điểm (location_text), col3=note, col4..6=tiers
      const province = normalizeProvince(c1);
      const location = sanitizeText(row[2]);
      const note = cleanNote(sanitizeText(row[3]) || null);
      const p0 = parseMoney(row[4]);
      const p1 = parseMoney(row[5]);
      const p2 = parseMoney(row[6]);
      if (!location) continue;
      const tiers: Tier[] = [];
      if (p0) tiers.push({ from: 3, to: 7, unit: 'tan', price: p0, min: null });
      if (p1) tiers.push({ from: 7, to: 10, unit: 'tan', price: p1, min: null });
      if (p2) tiers.push({ from: 10, to: null, unit: 'tan', price: p2, min: null });
      if (!tiers.length) {
        console.log(`SKIP IBC (no price): row ${i + 1}`);
        continue;
      }
      const groupName = buildGroupName(province, [location], note);
      const key = `n:${province}\0${groupName}`;
      if (seenKeys.has(key)) {
        console.log(`SKIP dup IBC: ${groupName}`);
        continue;
      }
      seenKeys.add(key);
      records.push({
        excelRow: i + 1,
        groupName,
        province,
        wardNames: [],
        locationText: location,
        residual: false,
        note,
        pricing_mode: 'by_weight',
        pallet: 0,
        tiers,
      });
    }
  }

  return records;
}

async function resolveProvince(
  client: PoolClient,
  provinceName: string,
): Promise<{ code: string; name: string }> {
  const { rows } = await client.query<{ code: string; name: string }>(
    `SELECT code, name FROM provinces
     WHERE name ILIKE $1 OR full_name ILIKE $2
     ORDER BY CASE WHEN name ILIKE $1 THEN 0 ELSE 1 END, code
     LIMIT 1`,
    [provinceName, `%${provinceName}%`],
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
  const name = foldVietnameseOa(sanitizeText(wardName));
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
  rec: ClfRecord,
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

async function findExistingGroup(
  client: PoolClient,
  supplierId: number,
  provinceCode: string,
  rec: ClfRecord,
): Promise<number | null> {
  if (rec.residual) {
    const { rows } = await client.query<{ id: number }>(
      `SELECT id FROM route_groups
       WHERE supplier_id=$1 AND province_code=$2 AND status='active'
         AND is_residual=TRUE
         AND COALESCE(NULLIF(TRIM(note),''),'') = $3
       LIMIT 1`,
      [supplierId, provinceCode, noteKey(rec.note)],
    );
    return rows[0]?.id ?? null;
  }
  const { rows } = await client.query<{ id: number }>(
    `SELECT id FROM route_groups
     WHERE supplier_id=$1 AND province_code=$2 AND status='active' AND name=$3
     LIMIT 1`,
    [supplierId, provinceCode, rec.groupName],
  );
  return rows[0]?.id ?? null;
}

async function ensureGroupMembers(
  client: PoolClient,
  opts: {
    groupId: number;
    supplierId: number;
    provinceCode: string;
    tinh: string;
    destinations: RouteDestination[];
    note: string | null;
  },
): Promise<void> {
  const { groupId, supplierId, provinceCode, tinh, destinations, note } = opts;

  for (const dest of destinations) {
    const existingRoute = await client.query<{ id: number }>(
      `SELECT id FROM delivery_routes
       WHERE supplier_id=$1 AND province_code=$2 AND status='active'
         AND COALESCE(ward_code,'') = COALESCE($3,'')
         AND COALESCE(location_text,'') = COALESCE($4,'')
         AND COALESCE(NULLIF(TRIM(note),''),'') = $5
       LIMIT 1`,
      [supplierId, provinceCode, dest.ward_code, dest.location_text, noteKey(note)],
    );
    let routeId = existingRoute.rows[0]?.id;
    if (routeId == null) {
      const routeRes = await client.query<{ id: number }>(
        `INSERT INTO delivery_routes
           (supplier_id, province_code, ward_code, location_text, note, tinh, phuong, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)
         RETURNING id`,
        [
          supplierId,
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
  opts: { groupId: number; periodId: number; rec: ClfRecord },
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
    supplierId: number;
    periodId: number;
    provinceCode: string;
    tinh: string;
    rec: ClfRecord;
    destinations: RouteDestination[];
  },
): Promise<void> {
  const { supplierId, periodId, provinceCode, tinh, rec, destinations } = opts;
  const groupRes = await client.query<{ id: number }>(
    `INSERT INTO route_groups
       (supplier_id, name, province_code, tinh, is_residual, note, created_by, updated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$7)
     RETURNING id`,
    [supplierId, rec.groupName, provinceCode, tinh, rec.residual, rec.note, USER_ID],
  );
  const groupId = groupRes.rows[0].id;
  await ensureGroupMembers(client, {
    groupId,
    supplierId,
    provinceCode,
    tinh,
    destinations,
    note: rec.note,
  });
  await ensureGroupPricing(client, { groupId, periodId, rec });
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const records = loadClfRecords();
  console.log(`Parsed ${records.length} CLF (f) groups from Excel`);
  console.log(
    `  by_weight=${records.filter((r) => r.pricing_mode === 'by_weight').length}` +
      ` by_trips=${records.filter((r) => r.pricing_mode === 'by_trips').length}` +
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
        `#${r.excelRow} [${r.pricing_mode}] ${r.groupName} | ${kind} pallet=${r.pallet} tiers=${r.tiers.length}`,
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

    const supplierRes = await client.query<{ id: number }>(
      `SELECT id FROM suppliers
       WHERE status='active' AND (supplier_code = $1 OR name ILIKE 'CLF')
       ORDER BY id LIMIT 1`,
      [SUPPLIER_CODE],
    );
    if (!supplierRes.rows[0]) {
      throw new Error(`CLF supplier not found (supplier_code=${SUPPLIER_CODE})`);
    }
    const supplierId = supplierRes.rows[0].id;

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

      const existingId = await findExistingGroup(client, supplierId, province.code, rec);
      if (existingId != null) {
        await ensureGroupMembers(client, {
          groupId: existingId,
          supplierId,
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
        supplierId,
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
      `✅ CLF (f) done — inserted ${inserted}, repaired ${repaired}, palletSynced ${palletSynced}, skipped ${skipped}, total ${records.length}`,
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
  console.error('CLF (f) seed failed:', err);
  process.exitCode = 1;
});
