/**
 * Address matching and normalization utility.
 * Supports:
 * - Exact match after whitespace and delimiter normalization
 * - Substring matching (input contains DB address or DB contains input address)
 * - Plot / parcel prefix stripping (e.g. "THỬA ĐẤT SỐ 2132")
 * - Token / word overlap matching
 */

export function normalizeAddressKey(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\s*([-/–—,])\s*/g, '$1')
    .trim();
}

export function cleanAddressForComparison(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[,\.\-\/–—]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function stripThuaDat(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .replace(/(?:thửa\s+(?:đất\s+)?(?:số\s+)?[\w\d\/-]+[\s,]*)/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface AddressMatchCheck {
  isMatch: boolean;
  isPartial: boolean;
  score: number;
}

export function evaluateAddressMatch(inputAddr: string, dbAddr: string): AddressMatchCheck {
  const normInput = normalizeAddressKey(inputAddr);
  const normDb = normalizeAddressKey(dbAddr);

  if (!normInput || !normDb) {
    return { isMatch: false, isPartial: false, score: 0 };
  }

  // 1. Exact match after standard key normalization
  if (normInput === normDb) {
    return { isMatch: true, isPartial: false, score: 100 };
  }

  const cleanInput = cleanAddressForComparison(inputAddr);
  const cleanDb = cleanAddressForComparison(dbAddr);

  if (cleanInput === cleanDb) {
    return { isMatch: true, isPartial: false, score: 99 };
  }

  // 2. Direct substring match (one contains the other)
  if (cleanInput.includes(cleanDb)) {
    return { isMatch: true, isPartial: true, score: 90 };
  }
  if (cleanDb.includes(cleanInput)) {
    return { isMatch: true, isPartial: true, score: 85 };
  }

  // 3. Match after stripping "thửa đất số [0-9]+" (plot/parcel prefix)
  const strippedInput = cleanAddressForComparison(stripThuaDat(inputAddr));
  const strippedDb = cleanAddressForComparison(stripThuaDat(dbAddr));

  if (strippedInput && strippedDb) {
    if (strippedInput === strippedDb) {
      return { isMatch: true, isPartial: true, score: 80 };
    }
    if (strippedInput.includes(strippedDb)) {
      return { isMatch: true, isPartial: true, score: 75 };
    }
    if (strippedDb.includes(strippedInput)) {
      return { isMatch: true, isPartial: true, score: 70 };
    }
  }

  // 4. Token overlap matching: check if all/most words of DB address appear in input address
  const inputWords = cleanInput.split(' ').filter((w) => w.length >= 2);
  const dbWords = cleanDb.split(' ').filter((w) => w.length >= 2);

  if (dbWords.length >= 3) {
    const inputWordSet = new Set(inputWords);
    const commonCount = dbWords.filter((w) => inputWordSet.has(w)).length;
    const matchRatio = commonCount / dbWords.length;

    if (matchRatio >= 0.8 && commonCount >= 3) {
      return { isMatch: true, isPartial: true, score: 60 + Math.round(matchRatio * 10) };
    }
  }

  return { isMatch: false, isPartial: false, score: 0 };
}
