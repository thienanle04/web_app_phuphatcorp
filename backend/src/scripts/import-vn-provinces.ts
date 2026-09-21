/**
 * Import VN provinces + wards from vietnamese-provinces-database JSON.
 * Run after migration 039: npx tsx src/scripts/import-vn-provinces.ts
 * Source: https://github.com/thanglequoc/vietnamese-provinces-database
 */
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

const backendEnv = path.resolve(__dirname, '../../.env');
if (fs.existsSync(backendEnv)) {
  dotenv.config({ path: backendEnv });
} else {
  dotenv.config();
}

import { pool } from '../config/database';

interface WardJson {
  Code: string;
  FullName: string;
  ProvinceCode: string;
}

interface ProvinceJson {
  Code: string;
  FullName: string;
  Wards: WardJson[];
}

function shortName(fullName: string, kind: 'province' | 'ward'): string {
  if (kind === 'province') {
    return fullName.replace(/^(Thành phố|Tỉnh)\s+/i, '').trim() || fullName;
  }
  return fullName.replace(/^(Phường|Xã|Thị trấn|Đặc khu)\s+/i, '').trim() || fullName;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const dataPath = path.join(__dirname, '../data/vn_provinces_wards.json');
  if (!fs.existsSync(dataPath)) {
    throw new Error(`Missing data file: ${dataPath}`);
  }

  const raw = JSON.parse(fs.readFileSync(dataPath, 'utf8')) as ProvinceJson[];
  const provinceCount = raw.length;
  let wardCount = 0;
  for (const p of raw) {
    wardCount += (p.Wards || []).length;
  }

  if (dryRun) {
      let currentProvinces = 'N/A (no DB connection)';
      let currentWards = 'N/A (no DB connection)';
      try {
        const client = await pool.connect();
        try {
          const { rows: pRows } = await client.query<{ cnt: string }>(
            'SELECT COUNT(*)::text AS cnt FROM provinces',
          );
          const { rows: wRows } = await client.query<{ cnt: string }>(
            'SELECT COUNT(*)::text AS cnt FROM wards',
          );
          currentProvinces = pRows[0]?.cnt || '0';
          currentWards = wRows[0]?.cnt || '0';
        } finally {
          client.release();
          await pool.end();
        }
      } catch {
        // Table or connection may not exist yet
      }

      // eslint-disable-next-line no-console
      console.log('=== DRY-RUN: import-vn-provinces ===');
      // eslint-disable-next-line no-console
      console.log(`Source JSON: ${provinceCount} provinces, ${wardCount} wards.`);
      // eslint-disable-next-line no-console
      console.log(`Current DB: ${currentProvinces} provinces, ${currentWards} wards.`);
      // eslint-disable-next-line no-console
      console.log('Dry-run only — no DB writes.');
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

    for (const p of raw) {
      const name = shortName(p.FullName, 'province');
      await client.query(
        `INSERT INTO provinces (code, name, full_name)
         VALUES ($1, $2, $3)
         ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, full_name = EXCLUDED.full_name`,
        [p.Code, name, p.FullName],
      );

      for (const w of p.Wards || []) {
        const wName = shortName(w.FullName, 'ward');
        await client.query(
          `INSERT INTO wards (code, name, full_name, province_code)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (code) DO UPDATE SET
             name = EXCLUDED.name,
             full_name = EXCLUDED.full_name,
             province_code = EXCLUDED.province_code`,
          [w.Code, wName, w.FullName, w.ProvinceCode || p.Code],
        );
      }
    }

    await client.query('COMMIT');
    // eslint-disable-next-line no-console
    console.log(`✅ Imported ${provinceCount} provinces, ${wardCount} wards`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Import failed:', err);
  process.exitCode = 1;
});
