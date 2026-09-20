import { pool } from '../../config/database';
import { customerSurchargeService } from '../customerSurchargeService';
import { SurchargeZone, VehicleClass } from '../../types/customerSurcharge';
import { rankRouteMatches } from '../../utils/routeMatcher';
import {
  evaluateAddressMatch,
  cleanAddressForComparison,
  stripThuaDat,
  normalizeAddressKey,
  type AddressMatchCheck,
} from '../../utils/addressMatcher';

export { evaluateAddressMatch, cleanAddressForComparison, stripThuaDat, type AddressMatchCheck };

export interface CustomerLookupResult {
  diem_tra_hang: string;
  tuyen_phuong: string;
  diem_giao_hang_tinh_phi: string;
  customer_id: number | null;
  is_partial_match: boolean;
  matched_address: string;
}

export interface PricingLookupResult {
  don_gia_van_chuyen: number | null;
  phi_boc_xep: number | null;
  phi_chuyen_tai: number | null;
  phi_ghep_diem: number | null;
}

export interface ResolveTargetBookParams {
  supplierCode?: string;
  slot?: string;
  hasNdfcInTrip?: boolean;
}

/**
 * Standardizes price book resolution for MCC and NDFC based on warehouse slot and trip composition.
 */
export function resolveTargetBook(params: ResolveTargetBookParams): string | undefined {
  const { supplierCode, slot, hasNdfcInTrip } = params;
  const isMcc = supplierCode === '2000000007';
  const isNdfc = supplierCode === '2000000008';
  const slotUpper = (slot || '').toUpperCase().trim();

  if (isMcc) {
    if (slotUpper.includes('CALOFIC HP') || slotUpper === 'CLV') {
      return 'CLV';
    }
    if (slotUpper.includes('WH UNIDEPOT') || slotUpper === 'UNI') {
      return 'MCC GH';
    }
    if (slotUpper.includes('UNI 1') || slotUpper === 'TT') {
      return hasNdfcInTrip ? 'MCC (tt) GHÉP ND' : 'MCC (tt)';
    }
    return 'CLV';
  }

  if (isNdfc) {
    if (slotUpper.includes('UNI 1') || slotUpper === 'TT') {
      return 'NDFC (TT)';
    }
    return 'NDFC-naic';
  }

  return undefined;
}

function normalizeKey(str: string | null | undefined): string {
  return normalizeAddressKey(str);
}

export class BangKeThoPricingLookupService {
  private customersCache: Array<{
    id: number;
    ten_khach_hang: string;
    dia_chi_giao_hang: string | null;
    diem_tra_hang: string;
    tuyen_phuong: string | null;
    diem_giao_hang_tinh_phi: string | null;
    supplier_code: string | null;
    normTen: string;
    normDiaChi: string;
  }> | null = null;

  clearCache(): void {
    this.customersCache = null;
  }

  async initCache(): Promise<void> {
    const { rows } = await pool.query<{
      id: number;
      ten_khach_hang: string;
      dia_chi_giao_hang: string | null;
      diem_tra_hang: string;
      tuyen_phuong: string | null;
      diem_giao_hang_tinh_phi: string | null;
      supplier_code: string | null;
    }>(
      `SELECT id, ten_khach_hang, dia_chi_giao_hang, diem_tra_hang, tuyen_phuong,
              diem_giao_hang_tinh_phi, supplier_code
       FROM customers
       WHERE status = 'active'`
    );

    this.customersCache = rows.map((r) => ({
      ...r,
      normTen: normalizeKey(r.ten_khach_hang),
      normDiaChi: normalizeKey(r.dia_chi_giao_hang),
    }));
  }

  async lookupCustomer(params: {
    tenKhachHang: string;
    diaChiGiaoHang: string;
    supplierCode?: string;
    slot?: string;
  }): Promise<CustomerLookupResult | null> {
    if (!this.customersCache) {
      await this.initCache();
    }
    const normTen = normalizeKey(params.tenKhachHang);
    const inputAddr = params.diaChiGiaoHang || '';

    if (!normTen || !inputAddr.trim()) return null;

    const sameNameCusts = this.customersCache!.filter((c) => c.normTen === normTen);
    if (sameNameCusts.length === 0) return null;

    const candidates: Array<{
      cust: (typeof sameNameCusts)[0];
      match: AddressMatchCheck;
    }> = [];

    for (const c of sameNameCusts) {
      const match = evaluateAddressMatch(inputAddr, c.dia_chi_giao_hang || '');
      if (match.isMatch) {
        candidates.push({ cust: c, match });
      }
    }

    if (candidates.length === 0) return null;

    let selected = candidates;
    if (selected.length > 1 && params.supplierCode) {
      const suppMatches = selected.filter(
        (c) => c.cust.supplier_code && c.cust.supplier_code.trim() === params.supplierCode?.trim()
      );
      if (suppMatches.length > 0) {
        selected = suppMatches;
      }
    }

    selected.sort((a, b) => {
      if (a.match.isPartial !== b.match.isPartial) {
        return a.match.isPartial ? 1 : -1;
      }
      return b.match.score - a.match.score;
    });

    const hit = selected[0].cust;
    const isPartial = selected[0].match.isPartial;

    return {
      diem_tra_hang: hit.diem_tra_hang || '',
      tuyen_phuong: hit.tuyen_phuong || '',
      diem_giao_hang_tinh_phi: hit.diem_giao_hang_tinh_phi || '',
      customer_id: hit.id,
      is_partial_match: isPartial,
      matched_address: hit.dia_chi_giao_hang || '',
    };
  }

  mapKhungGiaToVehicleClass(khungGia: string | null | undefined): VehicleClass {
    const k = (khungGia || '').toLowerCase();
    if (k.includes('pallet') && !k.includes('8-16') && !k.includes('16-23') && !k.includes('2.5') && !k.includes('2,5') && !k.includes('23')) {
      return 'pallet';
    }
    if ((k.includes('≤2.5') || k.includes('<=2.5') || k.includes('2.5') || k.includes('2,5')) && !k.includes('2.5-8') && !k.includes('2.5 - 8') && !k.includes('2,5-8')) {
      return 'le_2_5';
    }
    if (k.includes('2.5-8') || k.includes('2.5 - 8') || k.includes('2,5-8') || k.includes('8-16') || k.includes('8 - 16')) {
      return 'gt_8_16';
    }
    if (k.includes('16-23') || k.includes('16 - 23')) {
      return 'gt_16_23';
    }
    if (k.includes('>23') || k.includes('>=23') || k.includes('23')) {
      return 'gt_16_23';
    }
    if (k.includes('pallet')) {
      return 'pallet';
    }
    return 'gt_8_16'; // default fallback
  }

  mapKhuVucToZone(khuVuc: string | null | undefined): SurchargeZone {
    const kv = (khuVuc || '').toUpperCase();
    if (kv === 'ST' || kv === 'NOI_THANH') return 'noi_thanh';
    return 'tinh';
  }

  async lookupTransportRate(params: {
    diemTinhPhi: string;
    khungGia: string;
    invoiceDateIso: string;
    supplierCode?: string;
    slot?: string;
    targetBook?: string;
    hasNdfcInTrip?: boolean;
  }): Promise<number | null> {
    if (!params.diemTinhPhi || !params.invoiceDateIso) return null;

    const kGia = (params.khungGia || '').toLowerCase();

    // Query candidate route groups matching the name
    const { rows } = await pool.query<{
      route_name: string;
      book_name: string;
      price: string;
      pricing_unit: string;
      range_from: string;
      range_to: string | null;
      tier_label: string | null;
      set_label: string | null;
    }>(
      `
      SELECT rg.name as route_name, pb.name as book_name, t.price, t.pricing_unit,
             t.range_from, t.range_to, t.label as tier_label, pst.label as set_label
      FROM route_price_tiers t
      JOIN route_price_versions v ON v.id = t.price_version_id
      JOIN route_price_configs c ON c.id = v.price_config_id
      JOIN route_groups rg ON rg.id = c.route_group_id
      JOIN price_books pb ON pb.id = rg.price_book_id
      JOIN route_pricing_adjustment_periods p ON p.id = v.adjustment_period_id
      LEFT JOIN price_set_tiers pst ON pst.id = t.price_set_tier_id
      WHERE rg.status = 'active'
        AND p.start_date <= $1::date
        AND (p.end_date IS NULL OR p.end_date >= $1::date)
      `,
      [params.invoiceDateIso]
    );

    // Rank candidate route groups by intelligent route matching
    const rankedCandidates = rankRouteMatches(params.diemTinhPhi, rows);
    if (rankedCandidates.length === 0) return null;

    // Filter by weight / truck tier
    const matchesTier = (r: (typeof rows)[0]): boolean => {
      const from = parseFloat(r.range_from || '0');
      const to = r.range_to ? parseFloat(r.range_to) : null;
      const lbl = (r.tier_label || r.set_label || '').toLowerCase();

      if ((kGia.includes('≤2.5') || kGia.includes('<=2.5')) && !kGia.includes('2.5-8')) {
        if (to !== null && to <= 2.5) return true;
        if (lbl.includes('2,5') || lbl.includes('2.5')) return true;
      } else if (kGia.includes('2.5-8') || kGia.includes('2.5 - 8') || kGia.includes('2,5-8')) {
        if (from >= 2.5 && (to === null || to <= 8)) return true;
        if (lbl.includes('2.5') && lbl.includes('8')) return true;
      } else if (kGia.includes('8-16') || kGia.includes('8 - 16')) {
        if (from >= 8 && (to === null || to <= 16)) return true;
        if (lbl.includes('8<') || (lbl.includes('8') && lbl.includes('16'))) return true;
      } else if (kGia.includes('16-23') || kGia.includes('16 - 23')) {
        if (from >= 16 && (to === null || to <= 23)) return true;
        if (lbl.includes('16<') || (lbl.includes('16') && lbl.includes('23'))) return true;
      } else if (kGia.includes('>23') || kGia.includes('>=23')) {
        if (from >= 23) return true;
        if (lbl.includes('>23') || lbl.includes('23')) return true;
      }
      return false;
    };

    const tierMatches = rankedCandidates
      .filter((rc) => matchesTier(rc.item))
      .map((rc) => ({
        ...rc.item,
        routeScore: rc.match.score,
      }));

    if (tierMatches.length === 0) return null;

    let targetBook = params.targetBook;
    if (!targetBook) {
      targetBook = resolveTargetBook({
        supplierCode: params.supplierCode,
        slot: params.slot,
        hasNdfcInTrip: params.hasNdfcInTrip,
      });
    }

    const isMcc = params.supplierCode === '2000000007';
    const isNdfc = params.supplierCode === '2000000008';
    const slotUpper = (params.slot || '').toUpperCase().trim();

    const normTarget = targetBook ? normalizeKey(targetBook) : '';

    const score = (book: string) => {
      const bnNorm = normalizeKey(book);
      const bnUpper = book.toUpperCase();

      if (normTarget) {
        if (bnNorm === normTarget) return 1000;
        if (normTarget.includes('ghep nd') && bnNorm.includes('ghep nd')) return 900;
        if (normTarget === 'mcc (tt)' && bnNorm === 'mcc (tt)') return 900;
      }

      if (isMcc) {
        if (slotUpper.includes('UNI 1') || slotUpper === 'TT') {
          if (params.hasNdfcInTrip) {
            if (bnUpper.includes('MCC (TT) GHÉP ND')) return 100;
            if (bnUpper.includes('MCC (TT)')) return 80;
          } else {
            if (bnUpper.includes('MCC (TT)')) return 100;
            if (bnUpper.includes('MCC (TT) GHÉP ND')) return 80;
          }
        } else if (slotUpper.includes('CALOFIC HP') || slotUpper === 'CLV') {
          if (bnUpper === 'CLV') return 100;
        } else {
          if (bnUpper.includes('MCC GH')) return 100;
          if (bnUpper.includes('VP-HIEP PHUOC')) return 80;
          if (bnUpper.includes('CLF')) return 70;
        }
      } else if (isNdfc) {
        if (slotUpper.includes('UNI 1') || slotUpper === 'TT') {
          if (bnUpper.includes('NDFC (TT)')) return 100;
        } else {
          if (bnUpper.includes('NDFC-NAIC')) return 100;
          if (bnUpper.includes('VP-HIEP PHUOC')) return 80;
          if (bnUpper.includes('CLF')) return 70;
        }
      }
      return 0;
    };

    tierMatches.sort((a, b) => {
      const scoreDiff = score(b.book_name) - score(a.book_name);
      if (scoreDiff !== 0) return scoreDiff;
      return b.routeScore - a.routeScore;
    });

    const best = tierMatches[0];
    const bestScore = score(best.book_name);
    if (bestScore === 0) return null;

    const priceNum = Math.round(parseFloat(best.price));
    return isNaN(priceNum) ? null : priceNum;
  }

  async lookupSurcharges(params: {
    tenKhachHang: string;
    customerId: number | null;
    khuVuc: string;
    khungGia: string;
    invoiceDateIso: string;
  }): Promise<{
    phi_boc_xep: number | null;
    phi_chuyen_tai: number | null;
    phi_ghep_diem: number | null;
  }> {
    try {
      const zone = this.mapKhuVucToZone(params.khuVuc);
      const vehicleClass = this.mapKhungGiaToVehicleClass(params.khungGia);

      const fees = await customerSurchargeService.resolveFees(
        params.tenKhachHang,
        params.customerId,
        zone,
        vehicleClass,
        params.invoiceDateIso
      );

      return {
        phi_boc_xep: fees.boc_xep?.rate ?? null,
        phi_chuyen_tai: fees.chuyen_tai?.rate ?? null,
        phi_ghep_diem: fees.phu_phi_giao_hang?.rate ?? null,
      };
    } catch {
      return {
        phi_boc_xep: null,
        phi_chuyen_tai: null,
        phi_ghep_diem: null,
      };
    }
  }
}

export const bangKeThoPricingLookup = new BangKeThoPricingLookupService();
