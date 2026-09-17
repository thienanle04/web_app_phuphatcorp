import type { PriceSetTierInput, PricingMode } from '../../api/routePricingApi';

export type DraftTier = {
  key: string;
  range_from: string;
  range_to: string;
  pricing_unit: 'chuyen' | 'tan';
  min_billable_ton: string;
  label: string;
};

let draftKey = 0;

function nextKey(): string {
  draftKey += 1;
  return `tier-${draftKey}`;
}

export function newDraftTier(mode: PricingMode): DraftTier {
  return {
    key: nextKey(),
    range_from: mode === 'by_trips' ? '1' : mode === 'by_truck' ? '0' : '',
    range_to: '',
    pricing_unit: mode === 'by_weight' ? 'tan' : 'chuyen',
    min_billable_ton: '',
    label: '',
  };
}

function draftTier(partial: Omit<DraftTier, 'key'>): DraftTier {
  return { key: nextKey(), ...partial };
}

/** Same starter rows as the old price form: 5 weight bands, or 2 chained trip bands. */
export function defaultDraftTiers(mode: PricingMode): DraftTier[] {
  if (mode === 'by_truck') return [newDraftTier('by_truck')];
  if (mode === 'by_trips') {
    return rechainTrips([
      draftTier({
        range_from: '1',
        range_to: '2',
        pricing_unit: 'chuyen',
        min_billable_ton: '',
        label: '',
      }),
      draftTier({
        range_from: '3',
        range_to: '',
        pricing_unit: 'chuyen',
        min_billable_ton: '',
        label: '',
      }),
    ]);
  }
  return [
    draftTier({ range_from: '0', range_to: '2.5', pricing_unit: 'chuyen', min_billable_ton: '', label: '' }),
    draftTier({ range_from: '2.5', range_to: '8', pricing_unit: 'tan', min_billable_ton: '5', label: '' }),
    draftTier({ range_from: '8', range_to: '16', pricing_unit: 'tan', min_billable_ton: '', label: '' }),
    draftTier({ range_from: '16', range_to: '23', pricing_unit: 'tan', min_billable_ton: '', label: '' }),
    draftTier({ range_from: '23', range_to: '', pricing_unit: 'tan', min_billable_ton: '', label: '' }),
  ];
}

/** from[0]=1, from[i]=to[i-1]+1, last to empty (∞). */
export function rechainTrips(tiers: DraftTier[]): DraftTier[] {
  if (tiers.length === 0) return defaultDraftTiers('by_trips');
  const next = tiers.map((tier) => ({ ...tier, pricing_unit: 'chuyen' as const, min_billable_ton: '' }));
  next[0] = { ...next[0], range_from: '1' };
  for (let i = 1; i < next.length; i++) {
    const prevTo = next[i - 1].range_to.trim();
    const from = prevTo === '' ? Number(next[i - 1].range_from) + 1 : Number(prevTo) + 1;
    next[i] = { ...next[i], range_from: Number.isFinite(from) ? String(from) : next[i].range_from };
  }
  next[next.length - 1] = { ...next[next.length - 1], range_to: '' };
  return next;
}

export function updateTripsTo(tiers: DraftTier[], idx: number, toValue: string): DraftTier[] {
  const next = tiers.map((tier) => ({ ...tier }));
  if (idx === next.length - 1) {
    next[idx] = { ...next[idx], range_to: '' };
    return rechainTrips(next);
  }
  next[idx] = {
    ...next[idx],
    range_to: toValue.trim() === '' ? next[idx].range_from : toValue,
  };
  return rechainTrips(next);
}

export function addTripsTier(tiers: DraftTier[]): DraftTier[] {
  if (tiers.length <= 1) {
    const first = tiers[0] ?? newDraftTier('by_trips');
    return rechainTrips([
      { ...first, range_from: '1', range_to: '1', pricing_unit: 'chuyen' },
      { ...newDraftTier('by_trips'), range_from: '2', range_to: '' },
    ]);
  }
  const copy = tiers.map((tier) => ({ ...tier }));
  const lastIdx = copy.length - 1;
  const prevIdx = lastIdx - 1;
  const prevToRaw = copy[prevIdx].range_to.trim();
  const prevTo = prevToRaw === '' ? Number(copy[prevIdx].range_from) : Number(prevToRaw);
  const midFrom = Number.isFinite(prevTo) ? prevTo + 1 : 1;
  copy[prevIdx] = { ...copy[prevIdx], range_to: String(Number.isFinite(prevTo) ? prevTo : midFrom - 1) };
  copy.splice(lastIdx, 0, {
    ...newDraftTier('by_trips'),
    range_from: String(midFrom),
    range_to: String(midFrom),
  });
  copy[copy.length - 1] = {
    ...copy[copy.length - 1],
    range_from: String(midFrom + 1),
    range_to: '',
    pricing_unit: 'chuyen',
  };
  return rechainTrips(copy);
}

export function draftFromSetTier(tier: {
  range_from: number | null;
  range_to: number | null;
  pricing_unit: 'chuyen' | 'tan';
  min_billable_ton: number | null;
  label: string | null;
}): DraftTier {
  draftKey += 1;
  return {
    key: `tier-${draftKey}`,
    range_from: tier.range_from == null ? '' : String(tier.range_from),
    range_to: tier.range_to == null ? '' : String(tier.range_to),
    pricing_unit: tier.pricing_unit,
    min_billable_ton: tier.min_billable_ton == null ? '' : String(tier.min_billable_ton),
    label: tier.label ?? '',
  };
}

export function draftToInput(mode: PricingMode, tier: DraftTier): PriceSetTierInput {
  if (mode === 'by_truck') {
    return {
      label: tier.label.trim(),
      pricing_unit: tier.pricing_unit,
      range_from: 0,
      range_to: null,
    };
  }
  const from = Number(tier.range_from);
  const to = tier.range_to.trim() === '' ? null : Number(tier.range_to);
  const min =
    mode === 'by_weight' && tier.pricing_unit === 'tan' && tier.min_billable_ton.trim() !== ''
      ? Number(tier.min_billable_ton)
      : null;
  return {
    range_from: from,
    range_to: to,
    pricing_unit: tier.pricing_unit,
    min_billable_ton: min,
    label: null,
  };
}

export function apiErrorCode(err: unknown): string | undefined {
  const ax = err as { response?: { data?: { error?: string } } };
  return ax?.response?.data?.error;
}

export function parsePositivePrice(raw: string): number | null {
  const trimmed = raw.trim().replace(/,/g, '');
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (Number.isNaN(n)) return null;
  return n;
}
