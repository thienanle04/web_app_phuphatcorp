import { randomUUID } from 'crypto';
import * as XLSX from 'xlsx';
import { pool } from '../config/database';
import { env } from '../config/env';
import { storageService } from './storageService';
import {
  HOUSE_CODES,
  MAX_FILE_BYTES,
  PROCESSED_SHEET,
  downloadFilename,
  inputObjectKey,
  isHouseCode,
  normalizeFilenameKey,
  outputObjectKey,
  truncateFilename,
  type HouseCode,
} from '../constants/bangKeTho';

export class BangKeError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string,
    public data?: unknown,
  ) {
    super(message);
    this.name = 'BangKeError';
  }
}

export interface BangKeHouse {
  house_code: HouseCode;
  status: 'pending' | 'ready' | 'failed';
  download_filename: string;
  error_message: string | null;
}

export interface BangKeBatch {
  id: string;
  original_filename: string;
  filename_key: string;
  input_size_bytes: number;
  uploaded_by_name: string;
  uploaded_at: string;
  houses: BangKeHouse[];
}

function assertXlsx(originalFilename: string, size: number): void {
  if (size > MAX_FILE_BYTES) {
    throw new BangKeError('File quá lớn (tối đa 10 MB)', 400, 'FILE_TOO_LARGE');
  }
  const key = normalizeFilenameKey(originalFilename);
  if (!key.endsWith('.xlsx')) {
    throw new BangKeError('Chỉ chấp nhận file .xlsx', 400, 'INVALID_TYPE');
  }
}

function assertProcessedSheet(buffer: Buffer): void {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: 'buffer' });
  } catch {
    throw new BangKeError('Không đọc được file Excel', 400, 'INVALID_XLSX');
  }
  if (!workbook.SheetNames.includes(PROCESSED_SHEET)) {
    throw new BangKeError(
      'File phải có sheet “Processed”',
      400,
      'MISSING_PROCESSED_SHEET',
    );
  }
}

function mapHouses(rows: BangKeHouse[]): BangKeHouse[] {
  const byCode = new Map(rows.map((h) => [h.house_code, h]));
  return HOUSE_CODES.map((code) => {
    const row = byCode.get(code);
    if (row) return row;
    return {
      house_code: code,
      status: 'pending',
      download_filename: '',
      error_message: null,
    };
  });
}

async function fetchBatch(id: string): Promise<BangKeBatch | null> {
  const { rows } = await pool.query<{
    id: string;
    original_filename: string;
    filename_key: string;
    input_size_bytes: number;
    uploaded_by_name: string;
    uploaded_at: string;
    houses: BangKeHouse[] | string;
  }>(
    `
    SELECT
      b.id,
      b.original_filename,
      b.filename_key,
      b.input_size_bytes,
      COALESCE(u.full_name, u.username, '') AS uploaded_by_name,
      b.uploaded_at,
      COALESCE(
        json_agg(
          json_build_object(
            'house_code', o.house_code,
            'status', o.status,
            'download_filename', o.download_filename,
            'error_message', o.error_message
          )
          ORDER BY CASE o.house_code
            WHEN 'nd_mcc' THEN 1
            WHEN 'clv' THEN 2
            WHEN 'calofic' THEN 3
            ELSE 9
          END
        ) FILTER (WHERE o.id IS NOT NULL),
        '[]'::json
      ) AS houses
    FROM bang_ke_tho_batches b
    JOIN users u ON u.id = b.uploaded_by
    LEFT JOIN bang_ke_tho_outputs o ON o.batch_id = b.id
    WHERE b.id = $1
    GROUP BY b.id, u.full_name, u.username
    `,
    [id],
  );
  const row = rows[0];
  if (!row) return null;
  const houses = typeof row.houses === 'string' ? JSON.parse(row.houses) : row.houses;
  return { ...row, houses: mapHouses(houses) };
}

async function insertBatchWithOutputs(params: {
  id: string;
  originalFilename: string;
  filenameKey: string;
  objectKey: string;
  size: number;
  userId: number;
}): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `
      INSERT INTO bang_ke_tho_batches (
        id, original_filename, filename_key, input_object_key, input_size_bytes, uploaded_by
      ) VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [
        params.id,
        params.originalFilename,
        params.filenameKey,
        params.objectKey,
        params.size,
        params.userId,
      ],
    );
    for (const code of HOUSE_CODES) {
      await client.query(
        `
        INSERT INTO bang_ke_tho_outputs (batch_id, house_code, status, download_filename)
        VALUES ($1, $2, 'pending', $3)
        `,
        [params.id, code, downloadFilename(code, params.originalFilename)],
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function removeMinioKeys(keys: string[]): Promise<void> {
  await Promise.all(
    keys.map((key) => storageService.deleteObject(env.minio.bangKeBucket, key)),
  );
}

export const bangKeThoService = {
  async createBatch(params: {
    buffer: Buffer;
    originalFilename: string;
    mimetype: string;
    userId: number;
    overwrite: boolean;
  }): Promise<BangKeBatch> {
    const originalFilename = truncateFilename(params.originalFilename);
    assertXlsx(originalFilename, params.buffer.length);
    assertProcessedSheet(params.buffer);

    const filenameKey = truncateFilename(normalizeFilenameKey(originalFilename));
    const existing = await pool.query<{
      id: string;
      original_filename: string;
      input_object_key: string;
    }>(
      `SELECT b.id, b.original_filename, b.input_object_key
       FROM bang_ke_tho_batches b
       WHERE b.filename_key = $1`,
      [filenameKey],
    );

    if (existing.rows[0] && !params.overwrite) {
      throw new BangKeError(
        'Đã có đợt với tên file này. Ghi đè sẽ xóa file cũ và mọi bảng kê nhà.',
        409,
        'BANG_KE_DUPLICATE',
        {
          code: 'BANG_KE_DUPLICATE',
          batch_id: existing.rows[0].id,
          original_filename: existing.rows[0].original_filename,
        },
      );
    }

    if (existing.rows[0] && params.overwrite) {
      const oldId = existing.rows[0].id;
      const outputKeys = HOUSE_CODES.map((code) => outputObjectKey(oldId, code));
      const keys = [existing.rows[0].input_object_key, ...outputKeys];
      await pool.query('DELETE FROM bang_ke_tho_batches WHERE id = $1', [oldId]);
      await removeMinioKeys(keys);
    }

    const id = randomUUID();
    const objectKey = inputObjectKey(id);
    const mimetype =
      params.mimetype ||
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    await storageService.putObject({
      bucket: env.minio.bangKeBucket,
      objectKey,
      buffer: params.buffer,
      mimetype,
    });

    try {
      await insertBatchWithOutputs({
        id,
        originalFilename,
        filenameKey,
        objectKey,
        size: params.buffer.length,
        userId: params.userId,
      });
    } catch (err) {
      await storageService.deleteObject(env.minio.bangKeBucket, objectKey);
      const pg = err as { code?: string };
      if (pg.code === '23505') {
        throw new BangKeError(
          'Đã có đợt với tên file này. Ghi đè sẽ xóa file cũ và mọi bảng kê nhà.',
          409,
          'BANG_KE_DUPLICATE',
          { code: 'BANG_KE_DUPLICATE', original_filename: originalFilename },
        );
      }
      throw err;
    }

    const batch = await fetchBatch(id);
    if (!batch) {
      throw new BangKeError('Không tạo được đợt', 500, 'CREATE_FAILED');
    }
    return batch;
  },

  async listBatches(params: {
    page: number;
    limit: number;
    q?: string;
  }): Promise<{
    data: BangKeBatch[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const page = Math.max(1, params.page);
    const limit = Math.min(100, Math.max(1, params.limit));
    const offset = (page - 1) * limit;
    const q = params.q?.trim() || null;

    const countResult = await pool.query<{ total: string }>(
      `
      SELECT COUNT(*)::text AS total
      FROM bang_ke_tho_batches b
      WHERE ($1::text IS NULL OR b.original_filename ILIKE '%' || $1 || '%')
      `,
      [q],
    );
    const total = parseInt(countResult.rows[0]?.total ?? '0', 10);

    const { rows } = await pool.query<{
      id: string;
      original_filename: string;
      filename_key: string;
      input_size_bytes: number;
      uploaded_by_name: string;
      uploaded_at: string;
      houses: BangKeHouse[] | string;
    }>(
      `
      SELECT
        b.id,
        b.original_filename,
        b.filename_key,
        b.input_size_bytes,
        COALESCE(u.full_name, u.username, '') AS uploaded_by_name,
        b.uploaded_at,
        COALESCE(
          json_agg(
            json_build_object(
              'house_code', o.house_code,
              'status', o.status,
              'download_filename', o.download_filename,
              'error_message', o.error_message
            )
            ORDER BY CASE o.house_code
              WHEN 'nd_mcc' THEN 1
              WHEN 'clv' THEN 2
              WHEN 'calofic' THEN 3
              ELSE 9
            END
          ) FILTER (WHERE o.id IS NOT NULL),
          '[]'::json
        ) AS houses
      FROM bang_ke_tho_batches b
      JOIN users u ON u.id = b.uploaded_by
      LEFT JOIN bang_ke_tho_outputs o ON o.batch_id = b.id
      WHERE ($1::text IS NULL OR b.original_filename ILIKE '%' || $1 || '%')
      GROUP BY b.id, u.full_name, u.username
      ORDER BY b.uploaded_at DESC
      LIMIT $2 OFFSET $3
      `,
      [q, limit, offset],
    );

    const data: BangKeBatch[] = rows.map((row) => {
      const houses = typeof row.houses === 'string' ? JSON.parse(row.houses) : row.houses;
      return { ...row, houses: mapHouses(houses) };
    });

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit) || 1),
      },
    };
  },

  async deleteBatch(id: string): Promise<{ id: string }> {
    const { rows } = await pool.query<{ id: string; input_object_key: string }>(
      `SELECT id, input_object_key FROM bang_ke_tho_batches WHERE id = $1`,
      [id],
    );
    if (!rows[0]) {
      throw new BangKeError('Không tìm thấy đợt', 404, 'NOT_FOUND');
    }
    const keys = [rows[0].input_object_key, ...HOUSE_CODES.map((c) => outputObjectKey(id, c))];
    await pool.query('DELETE FROM bang_ke_tho_batches WHERE id = $1', [id]);
    await removeMinioKeys(keys);
    return { id };
  },

  async getInputStream(id: string): Promise<{
    stream: NodeJS.ReadableStream;
    stat: { size: number };
    downloadFilename: string;
  }> {
    const { rows } = await pool.query<{
      original_filename: string;
      input_object_key: string;
    }>(
      `SELECT original_filename, input_object_key FROM bang_ke_tho_batches WHERE id = $1`,
      [id],
    );
    if (!rows[0]) {
      throw new BangKeError('Không tìm thấy đợt', 404, 'NOT_FOUND');
    }
    const { stream, stat } = await storageService.getObjectStream(
      env.minio.bangKeBucket,
      rows[0].input_object_key,
    );
    return {
      stream,
      stat,
      downloadFilename: rows[0].original_filename,
    };
  },

  async getOutputStream(
    id: string,
    houseCode: string,
  ): Promise<{
    stream: NodeJS.ReadableStream;
    stat: { size: number };
    downloadFilename: string;
  }> {
    if (!isHouseCode(houseCode)) {
      throw new BangKeError('Mã nhà không hợp lệ', 400, 'INVALID_HOUSE');
    }
    const { rows } = await pool.query<{
      status: string;
      download_filename: string;
      object_key: string | null;
      error_message: string | null;
    }>(
      `SELECT status, download_filename, object_key, error_message
       FROM bang_ke_tho_outputs
       WHERE batch_id = $1 AND house_code = $2`,
      [id, houseCode],
    );
    if (!rows[0]) {
      const batch = await pool.query(`SELECT id FROM bang_ke_tho_batches WHERE id = $1`, [id]);
      if (!batch.rows[0]) {
        throw new BangKeError('Không tìm thấy đợt', 404, 'NOT_FOUND');
      }
      throw new BangKeError('Không tìm thấy output nhà', 404, 'NOT_FOUND');
    }
    if (rows[0].status === 'pending') {
      throw new BangKeError('Bảng kê nhà chưa được xử lý', 409, 'BANG_KE_OUTPUT_PENDING', {
        code: 'BANG_KE_OUTPUT_PENDING',
      });
    }
    if (rows[0].status === 'failed') {
      throw new BangKeError(
        rows[0].error_message || 'Xử lý bảng kê nhà thất bại',
        409,
        'BANG_KE_OUTPUT_FAILED',
        { code: 'BANG_KE_OUTPUT_FAILED' },
      );
    }
    if (!rows[0].object_key) {
      throw new BangKeError('Không tìm thấy file output', 404, 'NOT_FOUND');
    }
    const { stream, stat } = await storageService.getObjectStream(
      env.minio.bangKeBucket,
      rows[0].object_key,
    );
    return {
      stream,
      stat,
      downloadFilename: rows[0].download_filename,
    };
  },
};
