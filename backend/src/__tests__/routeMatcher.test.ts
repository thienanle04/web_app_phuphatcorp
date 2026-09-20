import {
  normalizeProvince,
  normalizeLocationItem,
  parseRoute,
  matchRouteScore,
  rankRouteMatches,
} from '../utils/routeMatcher';

describe('routeMatcher', () => {
  describe('normalizeProvince', () => {
    it('normalizes HCM variants to hồ chí minh', () => {
      expect(normalizeProvince('HCM')).toBe('hồ chí minh');
      expect(normalizeProvince('TP.HCM')).toBe('hồ chí minh');
      expect(normalizeProvince('TP. Hồ Chí Minh')).toBe('hồ chí minh');
      expect(normalizeProvince('Thành phố Hồ Chí Minh')).toBe('hồ chí minh');
      expect(normalizeProvince('Hồ Chí Minh')).toBe('hồ chí minh');
    });

    it('normalizes other provinces with prefixes', () => {
      expect(normalizeProvince('Tỉnh Bình Dương')).toBe('bình dương');
      expect(normalizeProvince('TP. Hà Nội')).toBe('hà nội');
      expect(normalizeProvince('Tỉnh Đồng Nai')).toBe('đồng nai');
      expect(normalizeProvince('Lâm Đồng')).toBe('lâm đồng');
    });
  });

  describe('normalizeLocationItem', () => {
    it('strips administrative prefixes', () => {
      expect(normalizeLocationItem('Phường Bến Cát')).toBe('bến cát');
      expect(normalizeLocationItem('Xã Hòa Lợi')).toBe('hòa lợi');
      expect(normalizeLocationItem('Thị trấn Tân Uyên')).toBe('tân uyên');
      expect(normalizeLocationItem('Thị xã Bến Cát')).toBe('bến cát');
      expect(normalizeLocationItem('TP. Thủ Dầu Một')).toBe('thủ dầu một');
      expect(normalizeLocationItem('Quận Bình Tân')).toBe('bình tân');
    });

    it('cleans whitespace and punctuation', () => {
      expect(normalizeLocationItem('  Bến Cát -  ')).toBe('bến cát');
      expect(normalizeLocationItem('Mỹ Phước...')).toBe('mỹ phước');
    });
  });

  describe('parseRoute', () => {
    it('parses hyphenated route with slash-separated points', () => {
      const parsed = parseRoute('HCM - Bến Cát/ Hòa Lợi/ Hòa Phú/ Long Nguyên/ Mỹ Phước');
      expect(parsed.province).toBe('hồ chí minh');
      expect(parsed.points).toEqual(['bến cát', 'hòa lợi', 'hòa phú', 'long nguyên', 'mỹ phước']);
      expect(parsed.isResidual).toBe(false);
    });

    it('parses residual route correctly', () => {
      const parsed = parseRoute('Các Phường/Xã khác trực thuộc TP. Hồ Chí Minh');
      expect(parsed.province).toBe('hồ chí minh');
      expect(parsed.isResidual).toBe(true);
    });
  });

  describe('matchRouteScore (User specific case)', () => {
    const inputRoute =
      'HCM - Bến Cát/ Hòa Lợi/ Hòa Phú/ Long Nguyên/ Mỹ Phước/ Tân Hiệp/ Tân Khánh/ Tân Uyên/ Tây Nam/ Thới Hòa/ Vĩnh Tân/ Bắc Tân Uyên';

    const dbClusterRoute =
      'Hồ Chí Minh - Bến Cát/ Hòa Lợi/ Long Nguyên/ Tân Hiệp/ Tân Khánh/ Tân Uyên/ Tây Nam/ Thới Hòa/ Vĩnh Tân/ Bắc Tân Uyên';

    const dbSingleRoute1 = 'Hồ Chí Minh - Bến Cát';
    const dbSingleRoute2 = 'Hồ Chí Minh - Tân Uyên';
    const dbDiffProvince = 'Đồng Nai - Bến Cát';

    it('matches db cluster route despite missing Hòa Phú and Mỹ Phước in DB', () => {
      const res = matchRouteScore(inputRoute, dbClusterRoute);
      expect(res.matched).toBe(true);
      expect(res.overlapCount).toBe(10);
      expect(res.jaccard).toBeGreaterThanOrEqual(0.8);
    });

    it('scores db cluster route much higher than single point routes', () => {
      const clusterScore = matchRouteScore(inputRoute, dbClusterRoute);
      const singleScore1 = matchRouteScore(inputRoute, dbSingleRoute1);
      const singleScore2 = matchRouteScore(inputRoute, dbSingleRoute2);

      expect(clusterScore.matched).toBe(true);
      expect(clusterScore.score).toBeGreaterThan(singleScore1.score);
      expect(clusterScore.score).toBeGreaterThan(singleScore2.score);
      expect(clusterScore.overlapCount).toBe(10);
      expect(singleScore1.overlapCount).toBe(1);
    });

    it('rejects candidate with different province', () => {
      const diffRes = matchRouteScore(inputRoute, dbDiffProvince);
      expect(diffRes.matched).toBe(false);
      expect(diffRes.reason).toBe('province_mismatch');
    });

    it('ranks cluster route as #1 candidate', () => {
      const candidates = [
        { route_name: dbSingleRoute1 },
        { route_name: 'Hồ Chí Minh - Bình Dương' },
        { route_name: dbClusterRoute },
        { route_name: dbSingleRoute2 },
        { route_name: 'Hồ Chí Minh - Dĩ An/ Thuận An' },
      ];

      const ranked = rankRouteMatches(inputRoute, candidates);
      expect(ranked.length).toBeGreaterThan(0);
      expect(ranked[0].item.route_name).toBe(dbClusterRoute);
      expect(ranked[0].match.overlapCount).toBe(10);
    });
  });

  describe('residual routes matching', () => {
    it('matches residual routes within the same province', () => {
      const target = 'Các Phường/Xã khác trực thuộc Thành phố Hồ Chí Minh (Đường nhỏ)';
      const cand = 'Các Phường/Xã khác trực thuộc TP. Hồ Chí Minh';
      const res = matchRouteScore(target, cand);
      expect(res.matched).toBe(true);
      expect(res.reason).toBe('residual_province_match');
    });

    it('does not match residual route with specific route', () => {
      const target = 'Các Phường/Xã khác trực thuộc TP. Hồ Chí Minh';
      const cand = 'Hồ Chí Minh - Bến Cát';
      const res = matchRouteScore(target, cand);
      expect(res.matched).toBe(false);
    });
  });

  describe('Lâm Đồng - Lâm Viên - Đà Lạt / Xuân Hương - Đà Lạt / Đơn Dương matching', () => {
    const dbCluster = 'Lâm Đồng - Lâm Viên - Đà Lạt/ Xuân Hương - Đà Lạt/ Đơn Dương';
    const dbSingleLamVien = 'Lâm Đồng - Lâm Viên - Đà Lạt';
    const dbSingleXuanHuong = 'Lâm Đồng - Xuân Hương - Đà Lạt';
    const dbSingleDonDuong = 'Lâm Đồng - Đơn Dương';

    it('matches exact full cluster regardless of hyphen spacing', () => {
      const input = 'Lâm Đồng - Lâm Viên-Đà Lạt/ Xuân Hương-Đà Lạt/ Đơn Dương';
      const res = matchRouteScore(input, dbCluster);
      expect(res.matched).toBe(true);
      expect(res.reason).toBe('exact_full_match');
    });

    it('matches sub-routes with province prefix to the cluster', () => {
      expect(matchRouteScore('Lâm Đồng - Lâm Viên-Đà Lạt', dbCluster).matched).toBe(true);
      expect(matchRouteScore('Lâm Đồng - Xuân Hương-Đà Lạt', dbCluster).matched).toBe(true);
      expect(matchRouteScore('Lâm Đồng - Đơn Dương', dbCluster).matched).toBe(true);
    });

    it('matches sub-routes without province prefix to the cluster', () => {
      expect(matchRouteScore('Xuân Hương-Đà Lạt', dbCluster).matched).toBe(true);
      expect(matchRouteScore('Lâm Viên-Đà Lạt', dbCluster).matched).toBe(true);
      expect(matchRouteScore('Đơn Dương', dbCluster).matched).toBe(true);
      expect(matchRouteScore('Lâm Viên - Đà Lạt', dbCluster).matched).toBe(true);
      expect(matchRouteScore('Xuân Hương - Đà Lạt', dbCluster).matched).toBe(true);
    });

    it('matches locations with administrative prefixes', () => {
      expect(matchRouteScore('Phường Lâm Viên - TP. Đà Lạt', dbCluster).matched).toBe(true);
      expect(matchRouteScore('Phường Xuân Hương - Đà Lạt', dbCluster).matched).toBe(true);
      expect(matchRouteScore('Xã Đơn Dương', dbCluster).matched).toBe(true);
    });

    it('ranks cluster correctly when input is sub-route without province', () => {
      const candidates = [
        { route_name: 'Hồ Chí Minh - Quận 1' },
        { route_name: 'Đồng Nai - Long Thành' },
        { route_name: dbCluster },
      ];
      const ranked = rankRouteMatches('Xuân Hương-Đà Lạt', candidates);
      expect(ranked.length).toBe(1);
      expect(ranked[0].item.route_name).toBe(dbCluster);
    });

    it('prefers single-point route over cluster if single-point route exists in candidate pool', () => {
      const candidates = [
        { route_name: dbCluster },
        { route_name: dbSingleXuanHuong },
      ];
      const ranked = rankRouteMatches('Xuân Hương-Đà Lạt', candidates);
      expect(ranked.length).toBe(2);
      expect(ranked[0].item.route_name).toBe(dbSingleXuanHuong);
      expect(ranked[1].item.route_name).toBe(dbCluster);
    });
  });
});
