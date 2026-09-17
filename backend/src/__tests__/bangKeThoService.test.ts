import * as XLSX from 'xlsx';
import { pool } from '../config/database';
import { bangKeThoService } from '../services/bangKeThoService';
import { storageService } from '../services/storageService';
import {
  downloadFilename,
  normalizeFilenameKey,
  inputObjectKey,
  outputObjectKey,
} from '../constants/bangKeTho';

jest.mock('../services/storageService', () => ({
  storageService: {
    putObject: jest.fn().mockResolvedValue(undefined),
    deleteObject: jest.fn().mockResolvedValue(undefined),
    getObjectStream: jest.fn(),
  },
}));

const mockPool = pool as jest.Mocked<typeof pool>;
const mockStorage = storageService as jest.Mocked<typeof storageService>;

const mockClient = {
  query: jest.fn(),
  release: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPool.connect.mockResolvedValue(mockClient as never);
  mockClient.query.mockResolvedValue({ rows: [] });
});

function xlsxBuffer(sheetNames: string[]): Buffer {
  const wb = XLSX.utils.book_new();
  for (const name of sheetNames) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['h'], [1]]), name);
  }
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer);
}

describe('bangKeTho helpers', () => {
  it('normalizes filename key basename trim lowercase', () => {
    expect(normalizeFilenameKey(' 1-8.7.XLSX ')).toBe('1-8.7.xlsx');
  });

  it('builds sample download names from input stem', () => {
    expect(downloadFilename('nd_mcc', '1-8.7.xlsx')).toBe('ND-MCC 1-8.7.xlsx');
    expect(downloadFilename('clv', '1-8.7.xlsx')).toBe('clv 1-8.7.xlsx');
    expect(downloadFilename('calofic', '1-8.7.xlsx')).toBe('calofic 1-8.7.xlsx');
  });

  it('builds object keys', () => {
    expect(inputObjectKey('abc')).toBe('batches/abc/input.xlsx');
    expect(outputObjectKey('abc', 'nd_mcc')).toBe('batches/abc/outputs/nd_mcc.xlsx');
  });
});

describe('bangKeThoService.createBatch', () => {
  it('rejects file without Processed sheet', async () => {
    await expect(
      bangKeThoService.createBatch({
        buffer: xlsxBuffer(['Sheet1']),
        originalFilename: '1-8.7.xlsx',
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        userId: 1,
        overwrite: false,
      }),
    ).rejects.toMatchObject({ statusCode: 400, code: 'MISSING_PROCESSED_SHEET' });
    expect(mockStorage.putObject).not.toHaveBeenCalled();
  });

  it('rejects non-xlsx name', async () => {
    await expect(
      bangKeThoService.createBatch({
        buffer: Buffer.from('x'),
        originalFilename: 'note.csv',
        mimetype: 'text/csv',
        userId: 1,
        overwrite: false,
      }),
    ).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_TYPE' });
  });

  it('throws 409 when filename exists and overwrite is false', async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [{ id: 'old-id', original_filename: '1-8.7.xlsx', input_object_key: 'batches/old-id/input.xlsx' }],
    } as never);

    await expect(
      bangKeThoService.createBatch({
        buffer: xlsxBuffer(['Processed']),
        originalFilename: '1-8.7.xlsx',
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        userId: 1,
        overwrite: false,
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'BANG_KE_DUPLICATE',
    });
    expect(mockStorage.putObject).not.toHaveBeenCalled();
  });

  it('overwrites by deleting old batch then inserting new', async () => {
    mockPool.query
      .mockResolvedValueOnce({
        rows: [{ id: 'old-id', original_filename: '1-8.7.xlsx', input_object_key: 'batches/old-id/input.xlsx' }],
      } as never)
      .mockResolvedValueOnce({ rows: [] } as never) // DELETE
      .mockResolvedValueOnce({
        rows: [{
          id: 'new-id',
          original_filename: '1-8.7.xlsx',
          filename_key: '1-8.7.xlsx',
          input_size_bytes: 10,
          uploaded_by_name: 'Admin',
          uploaded_at: '2026-09-13T00:00:00.000Z',
          houses: [
            { house_code: 'nd_mcc', status: 'pending', download_filename: 'ND-MCC 1-8.7.xlsx', error_message: null },
            { house_code: 'clv', status: 'pending', download_filename: 'clv 1-8.7.xlsx', error_message: null },
            { house_code: 'calofic', status: 'pending', download_filename: 'calofic 1-8.7.xlsx', error_message: null },
          ],
        }],
      } as never);

    mockClient.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({}) // INSERT batch
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({}); // COMMIT

    const result = await bangKeThoService.createBatch({
      buffer: xlsxBuffer(['Processed']),
      originalFilename: '1-8.7.xlsx',
      mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      userId: 1,
      overwrite: true,
    });

    expect(mockStorage.deleteObject).toHaveBeenCalled();
    expect(mockStorage.putObject).toHaveBeenCalled();
    expect(result.houses).toHaveLength(3);
    expect(result.houses[0].status).toBe('pending');
  });
});

describe('bangKeThoService.listBatches', () => {
  it('returns pagination and q filter', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ total: '1' }] } as never)
      .mockResolvedValueOnce({
        rows: [{
          id: 'id-1',
          original_filename: '1-8.7.xlsx',
          filename_key: '1-8.7.xlsx',
          input_size_bytes: 100,
          uploaded_by_name: 'A',
          uploaded_at: '2026-09-13T00:00:00.000Z',
          houses: [],
        }],
      } as never);

    const result = await bangKeThoService.listBatches({ page: 1, limit: 20, q: '1-8' });
    expect(result.pagination.total).toBe(1);
    expect(result.data[0].houses).toHaveLength(3);
    expect(mockPool.query.mock.calls[0][1]).toEqual(['1-8']);
  });
});

describe('bangKeThoService.deleteBatch', () => {
  it('throws 404 when missing', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] } as never);
    await expect(bangKeThoService.deleteBatch('11111111-1111-1111-1111-111111111111')).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe('bangKeThoService.getOutputStream', () => {
  it('throws pending 409', async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [{
        status: 'pending',
        download_filename: 'clv 1-8.7.xlsx',
        object_key: null,
        error_message: null,
      }],
    } as never);

    await expect(
      bangKeThoService.getOutputStream('11111111-1111-1111-1111-111111111111', 'clv'),
    ).rejects.toMatchObject({ statusCode: 409, code: 'BANG_KE_OUTPUT_PENDING' });
  });
});
