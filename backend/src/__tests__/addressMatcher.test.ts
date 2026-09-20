import {
  evaluateAddressMatch,
  cleanAddressForComparison,
  stripThuaDat,
  normalizeAddressKey,
} from '../utils/addressMatcher';

describe('addressMatcher', () => {
  const inputAddr = 'THỬA ĐẤT SỐ 2132, TỜ BẢN ĐỒ SỐ 9, ĐƯỜNG CÙ CHÍNH LAN, PHƯỜNG LÂM VIÊN-ĐÀ LẠT, TỈNH LÂM ĐỒNG, VIỆT NAM';
  const dbAddr = 'TỜ BẢN ĐỒ SỐ 9, ĐƯỜNG CÙ CHÍNH LAN, PHƯỜNG LÂM VIÊN-ĐÀ LẠT, TỈNH LÂM ĐỒNG, VIỆT NAM';

  it('evaluates exact match correctly', () => {
    const res = evaluateAddressMatch(inputAddr, inputAddr);
    expect(res.isMatch).toBe(true);
    expect(res.isPartial).toBe(false);
  });

  it('evaluates partial match when DB is missing THUA DAT SO 2132', () => {
    const res = evaluateAddressMatch(inputAddr, dbAddr);
    expect(res.isMatch).toBe(true);
    expect(res.isPartial).toBe(true);
  });

  it('evaluates partial match with delimiter variations (dash vs space)', () => {
    const dbWithSpace = 'TỜ BẢN ĐỒ SỐ 9, ĐƯỜNG CÙ CHÍNH LAN, PHƯỜNG LÂM VIÊN - ĐÀ LẠT, TỈNH LÂM ĐỒNG, VIỆT NAM';
    const res = evaluateAddressMatch(inputAddr, dbWithSpace);
    expect(res.isMatch).toBe(true);
    expect(res.isPartial).toBe(true);
  });
});
