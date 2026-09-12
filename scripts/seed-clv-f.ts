/**
 * Migrate sheet "CLV (f)" → 3 price books (absolute @ 2026-01-01).
 *
 * Source: reference/xu_ly_du_lieu_ke_toan/BẢNG GIÁ - 2026 - 1.8.2026.xlsx
 *
 * Ba khối, ba bảng giá (tên phải có sẵn trong DB — fail-fast, không INSERT book):
 *   1) Excel "MCC ĐÍNH KÈM" → book "CLV" — by_weight
 *      STT | Tuyến cũ | Tuyến mới | Tỉnh | Phường | Địa điểm | Note | 5 bậc | pallet
 *      ≤2.5 chuyến / >2.5–8 min 5t / >8–16 / >16–23 / >23 / pallet — skip giá ≤ 0
 *   2) "CLV - KHO" → book "CLV - KHO" — by_trips, pallet=0
 *      Unidepot: một group, 1–3 và ≥4 chuyến/xe/ngày
 *      Tây Ninh – Cần Giuộc → Hiệp Phước: group riêng (ghi note Excel)
 *   3) "CLV - NGUYÊN CHUYẾN" → book "CLV - NGUYÊN CHUYẾN" — by_truck, pallet=0
 *      Nhãn Excel: Truck 0,5mt / 1,25mt / 1,5mt / 2,5mt (chuyen) + Truck 15mt (tan)
 *      Dup dest + note trống → note "Truck 15mt (phụ)"
 *
 * Prerequisites:
 *   - provinces imported
 *   - 3 bảng giá đúng tên (tạo tay)
 *   - npm run seed:adjustment-periods
 *
 * After (optional): npm run cascade:route-pricing
 *
 * Run from repo root:
 *   npx tsx scripts/seed-clv-f.ts --dry-run
 *   npx tsx scripts/seed-clv-f.ts
 *   # or: npm run seed:clv-f
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
const PRICE_BOOK_WEIGHT = 'CLV';
const PRICE_BOOK_KHO = 'CLV - KHO';
const PRICE_BOOK_TRUCK = 'CLV - NGUYÊN CHUYẾN';
const SHEET_NAME = 'CLV (f)';
const XLSX_PATH = path.join(root, 'reference/xu_ly_du_lieu_ke_toan/BẢNG GIÁ - 2026 - 1.8.2026.xlsx');
const DUP_NOTE = 'Truck 15mt (phụ)';

type PricingUnit = 'tan' | 'chuyen';
type PricingMode = 'by_weight' | 'by_trips' | 'by_truck';
type Section = 'weight' | 'trips' | 'truck' | 'skip';

interface Tier {
  from: number;
  to: number | null;
  unit: PricingUnit;
  price: number;
  min: number | null;
  label?: string;
}

interface ClvRecord {
  excelRow: number;
  priceBookName: string;
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
  { col: 7, label: 'Truck 0,5mt', unit: 'chuyen' },
  { col: 8, label: 'Truck 1,25mt', unit: 'chuyen' },
  { col: 9, label: 'Truck 1,5mt', unit: 'chuyen' },
  { col: 10, label: 'Truck 2,5mt', unit: 'chuyen' },
  { col: 11, label: 'Truck 15mt', unit: 'tan' },
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
  p = p.replace(/^TP\.?\s*/i, '').replace(/^Thành phố\s+/i, '').replace(/^Tỉnh\s+/i, '');
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

function weightTiersFromCols(row: unknown[]): { tiers: Tier[]; pallet: number } {
  const p0 = parseMoney(row[7]);
  const p1 = parseMoney(row[8]);
  const p2 = parseMoney(row[9]);
  const p3 = parseMoney(row[10]);
  const p4 = parseMoney(row[11]);
  const tiers: Tier[] = [];
  if (p0 != null && p0 > 0) tiers.push({ from: 0, to: 2.5, unit: 'chuyen', price: p0, min: null });
  if (p1 != null && p1 > 0) tiers.push({ from: 2.5, to: 8, unit: 'tan', price: p1, min: 5 });
  if (p2 != null && p2 > 0) tiers.push({ from: 8, to: 16, unit: 'tan', price: p2, min: null });
  if (p3 != null && p3 > 0) tiers.push({ from: 16, to: 23, unit: 'tan', price: p3, min: null });
  if (p4 != null && p4 > 0) tiers.push({ from: 23, to: null, unit: 'tan', price: p4, min: null });
  return { tiers, pallet: parseMoney(row[12]) ?? 0 };
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

function parseTripRange(raw: string): { from: number; to: number | null } | null {
  const n = sanitizeText(raw);
  if (/tổng/i.test(n)) return null;
  if (!n) return { from: 1, to: null };
  if (/1\s*-\s*3\s*chuyến/i.test(n)) return { from: 1, to: 3 };
  if (/từ\s*4\s*chuyến|4\s*chuyến\s*(trở lên|\/)/i.test(n)) return { from: 4, to: null };
  return null;
}

function destDedupeKey(
  rec: Pick<ClvRecord, 'province' | 'residual' | 'wardNames' | 'locationText' | 'note'>,
): string {
  const note = noteKey(rec.note);
  if (rec.residual) return `r:${rec.province}\0${note}`;
  if (rec.locationText) return `l:${rec.province}\0${rec.locationText}\0${note}`;
  return `w:${rec.province}\0${[...rec.wardNames].map((n) => canonicalGeoName(n).toLowerCase()).sort().join('|')}\0${note}`;
}

function detectSection(row: unknown[]): Section | null {
  const joined = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    .map((i) => sanitizeText(row[i]))
    .join('|');
  const c0 = sanitizeText(row[0]);
  const c3 = sanitizeText(row[3]);
  const c4 = sanitizeText(row[4]);
  const c5 = sanitizeText(row[5]);

  if (/CLV\s*-\s*KHO/i.test(joined) && !/^Tỉnh$/i.test(c3)) return 'trips';
  if (/NGUYÊN\s*CHUYẾN/i.test(joined) && !/^Tỉnh$/i.test(c3)) return 'truck';

  if (/^STT$/i.test(c0) && /^Tỉnh$/i.test(c3) && /Truck/i.test(joined)) return 'truck';
  if (
    /^STT$/i.test(c0) &&
    /^Tỉnh$/i.test(c3) &&
    /Địa điểm/i.test(c4) &&
    /vnđ\/chuyến/i.test(joined) &&
    !/Pallet/i.test(joined)
  ) {
    return 'trips';
  }
  if (!/^Tỉnh$/i.test(c3) || !/Phường|Địa điểm/i.test(c4 + c5)) return null;
  if (/≤\s*2/i.test(joined) || /Pallet/i.test(joined) || />\s*23/i.test(joined) || />\s*25-8/i.test(joined)) {
    return 'weight';
  }
  return null;
}

function loadClvRecords(): ClvRecord[] {
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

  const records: ClvRecord[] = [];
  const seenKeys = new Set<string>();
  const tripGroups = new Map<string, ClvRecord>();
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

    const provinceRaw = sanitizeText(row[3]);
    if (
      !provinceRaw ||
      /^vnđ/i.test(provinceRaw) ||
      /^STT$/i.test(sanitizeText(row[0])) ||
      /^96\.2$/i.test(provinceRaw)
    ) {
      continue;
    }

    const province = normalizeProvince(provinceRaw);

    if (section === 'trips') {
      const locationText = sanitizeText(row[4]);
      const note = cleanNote(sanitizeText(row[5]) || null);
      const tripLabel = sanitizeText(row[6]);
      const price = parseMoney(row[7]);
      if (/tổng/i.test(note ?? '') || /tổng/i.test(tripLabel) || /tổng/i.test(locationText)) {
        console.log(`TỔNG excel=${price ?? ''} row ${i + 1} — parse only, no INSERT`);
        continue;
      }
      if (!locationText || price == null || !(price > 0)) {
        console.log(`SKIP trips (no price): row ${i + 1}`);
        continue;
      }
      const range = parseTripRange(tripLabel);
      if (!range) {
        console.log(`SKIP trips (unparsed range "${tripLabel}"): row ${i + 1}`);
        continue;
      }
      const groupName = buildGroupName(province, [locationText], note);
      const key = `t:${province}\0${locationText}\0${noteKey(note)}`;
      let rec = tripGroups.get(key);
      if (!rec) {
        rec = {
          excelRow: i + 1,
          priceBookName: PRICE_BOOK_KHO,
          groupName,
          province,
          wardNames: [],
          locationText,
          residual: false,
          note,
          pricing_mode: 'by_trips',
          pallet: 0,
          tiers: [],
        };
        tripGroups.set(key, rec);
      }
      if (rec.tiers.some((t) => t.from === range.from && t.to === range.to)) {
        console.log(`SKIP dup trip tier ${range.from}-${range.to}: row ${i + 1}`);
        continue;
      }
      rec.tiers.push({ from: range.from, to: range.to, unit: 'chuyen', price, min: null });
      rec.tiers.sort((a, b) => a.from - b.from);
      continue;
    }

    if (section === 'truck') {
      const phuongRaw = sanitizeText(row[4]);
      const note = cleanNote(sanitizeText(row[6]) || null);
      const wardNames = wardNamesFromPhuong(province, phuongRaw);
      const locationText = wardNames.length ? null : phuongRaw || null;
      const residual = wardNames.length === 0 && !locationText;
      const tiers = truckTiersFromCols(row);
      if (!tiers.length) {
        console.log(`SKIP (no truck price): row ${i + 1} ${province}`);
        continue;
      }
      const labels = wardNames.length ? wardNames : locationText ? [locationText] : [];
      const draft: ClvRecord = {
        excelRow: i + 1,
        priceBookName: PRICE_BOOK_TRUCK,
        groupName: buildGroupName(province, labels, note),
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
          console.log(`SKIP dup: ${draft.groupName}`);
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
      continue;
    }

    const phuongRaw = sanitizeText(row[4]);
    const diaDiem = sanitizeText(row[5]) || null;
    const note = cleanNote(sanitizeText(row[6]) || null);
    const wardNames = wardNamesFromPhuong(province, phuongRaw);
    const locationText = wardNames.length ? null : diaDiem;
    if (phuongRaw && diaDiem && wardNames.length) {
      console.log(
        `WARN row ${i + 1}: có cả Phường và Địa điểm — dùng Phường (wards), bỏ Địa điểm="${diaDiem}"`,
      );
    }
    const residual = wardNames.length === 0 && !locationText;
    const priced = weightTiersFromCols(row);
    if (!priced.tiers.length) {
      console.log(`SKIP (no weight price): row ${i + 1} ${province}`);
      continue;
    }
    const labels = wardNames.length ? wardNames : locationText ? [locationText] : [];
    const groupName = buildGroupName(province, labels, note);
    const key = residual ? `r:${province}\0${note || ''}` : `n:${province}\0${groupName}`;
    if (seenKeys.has(key)) {
      console.log(`SKIP dup: ${groupName}`);
      continue;
    }
    seenKeys.add(key);
    records.push({
      excelRow: i + 1,
      priceBookName: PRICE_BOOK_WEIGHT,
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

  for (const rec of Array.from(tripGroups.values())) {
    if (!rec.tiers.length) continue;
    records.push(rec);
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
  rec: ClvRecord,
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

async function requirePriceBook(client: PoolClient, name: string): Promise<number> {
  const found = await client.query<{ id: number }>(
    `SELECT id FROM price_books
     WHERE status='active' AND lower(trim(name)) = lower($1)
     ORDER BY id
     LIMIT 1`,
    [name],
  );
  if (found.rows[0]) return found.rows[0].id;
  const nearby = await client.query<{ name: string }>(
    `SELECT name FROM price_books WHERE status='active' AND name ILIKE '%CLV%' ORDER BY name`,
  );
  const hint = nearby.rows.length
    ? nearby.rows.map((r) => r.name).join(', ')
    : '(no CLV-like names)';
  throw new Error(`Price book "${name}" not found (fail-fast, not creating). Nearby: ${hint}`);
}

async function findExistingGroup(
  client: PoolClient,
  priceBookId: number,
  provinceCode: string,
  rec: ClvRecord,
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

async function insertTiers(client: PoolClient, versionId: number, rec: ClvRecord): Promise<void> {
  for (let sort = 0; sort < rec.tiers.length; sort++) {
    const t = rec.tiers[sort];
    if (rec.pricing_mode === 'by_truck') {
      await client.query(
        `INSERT INTO route_price_tiers
           (price_version_id, range_from, range_to, pricing_unit, price, min_billable_ton, sort_order, label)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [versionId, 0, null, t.unit, t.price, null, sort, t.label ?? null],
      );
    } else {
      await client.query(
        `INSERT INTO route_price_tiers
           (price_version_id, range_from, range_to, pricing_unit, price, min_billable_ton, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [versionId, t.from, t.to, t.unit, t.price, t.min, sort],
      );
    }
  }
}

async function ensureGroupPricing(
  client: PoolClient,
  opts: { groupId: number; periodId: number; rec: ClvRecord },
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
    await insertTiers(client, versionRes.rows[0].id, rec);
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
    await insertTiers(client, created.rows[0].id, rec);
    return 'created';
  }

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
    rec: ClvRecord;
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

function logRecord(r: ClvRecord): void {
  const kind = r.residual
    ? 'residual'
    : r.wardNames.length
      ? `wards=${r.wardNames.length}`
      : `location="${r.locationText}"`;
  let tierHint: string;
  if (r.pricing_mode === 'by_trips') {
    tierHint = r.tiers.map((t) => `${t.from}-${t.to ?? '∞'}=${t.price}`).join(',');
  } else if (r.pricing_mode === 'by_truck') {
    tierHint = r.tiers.map((t) => `${t.label}(${t.unit})=${t.price}`).join(',');
  } else {
    tierHint = `tiers=${r.tiers.length}`;
  }
  console.log(
    `#${r.excelRow} [${r.priceBookName}|${r.pricing_mode}] ${r.groupName} | ${kind} pallet=${r.pallet} ${tierHint} note=${r.note ?? ''}`,
  );
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const records = loadClvRecords();
  const byBook = (name: string) => records.filter((r) => r.priceBookName === name);
  console.log(`Parsed ${records.length} CLV (f) groups from Excel`);
  for (const name of [PRICE_BOOK_WEIGHT, PRICE_BOOK_KHO, PRICE_BOOK_TRUCK]) {
    const subset = byBook(name);
    console.log(
      `  ${name}: ${subset.length}` +
        ` by_weight=${subset.filter((r) => r.pricing_mode === 'by_weight').length}` +
        ` by_trips=${subset.filter((r) => r.pricing_mode === 'by_trips').length}` +
        ` by_truck=${subset.filter((r) => r.pricing_mode === 'by_truck').length}` +
        ` withPallet=${subset.filter((r) => r.pallet > 0).length}` +
        ` residual=${subset.filter((r) => r.residual).length}` +
        ` wards=${subset.filter((r) => r.wardNames.length > 0).length}` +
        ` locationText=${subset.filter((r) => !!r.locationText).length}`,
    );
  }

  if (dryRun) {
    for (const r of records) logRecord(r);
    console.log('Dry-run only — no DB writes.');
    await pool.end();
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
    bookIds.set(PRICE_BOOK_WEIGHT, await requirePriceBook(client, PRICE_BOOK_WEIGHT));
    bookIds.set(PRICE_BOOK_KHO, await requirePriceBook(client, PRICE_BOOK_KHO));
    bookIds.set(PRICE_BOOK_TRUCK, await requirePriceBook(client, PRICE_BOOK_TRUCK));
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
      `✅ CLV (f) done — inserted ${inserted}, repaired ${repaired}, palletSynced ${palletSynced}, skipped ${skipped}, total ${records.length}`,
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
  console.error('CLV (f) seed failed:', err);
  process.exitCode = 1;
});
