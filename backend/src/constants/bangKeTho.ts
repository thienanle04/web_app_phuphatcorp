import path from 'path';

export const HOUSE_CODES = ['nd_mcc', 'clv', 'calofic'] as const;
export type HouseCode = (typeof HOUSE_CODES)[number];

export const HOUSE_PREFIX: Record<HouseCode, string> = {
  nd_mcc: 'ND-MCC',
  clv: 'clv',
  calofic: 'calofic',
};

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const PROCESSED_SHEET = 'Processed';

export function isHouseCode(value: string): value is HouseCode {
  return (HOUSE_CODES as readonly string[]).includes(value);
}

export function normalizeFilenameKey(originalName: string): string {
  return path.basename(originalName).trim().toLowerCase();
}

export function inputStem(originalFilename: string): string {
  const base = path.basename(originalFilename).trim();
  return base.replace(/\.xlsx$/i, '');
}

export function downloadFilename(houseCode: HouseCode, originalFilename: string): string {
  return `${HOUSE_PREFIX[houseCode]} ${inputStem(originalFilename)}.xlsx`;
}

export function inputObjectKey(batchId: string): string {
  return `batches/${batchId}/input.xlsx`;
}

export function outputObjectKey(batchId: string, houseCode: HouseCode): string {
  return `batches/${batchId}/outputs/${houseCode}.xlsx`;
}

export function truncateFilename(name: string, max = 255): string {
  if (name.length <= max) return name;
  return name.slice(0, max);
}
