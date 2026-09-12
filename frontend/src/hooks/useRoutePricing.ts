import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type PriceTierInput,
  type PricingMode,
  routePricingApi,
} from '../api/routePricingApi';

export function useProvinces() {
  return useQuery({
    queryKey: ['route-pricing', 'provinces'],
    queryFn: () => routePricingApi.listProvinces(),
  });
}

export function useWards(provinceCode?: string) {
  return useQuery({
    queryKey: ['route-pricing', 'wards', provinceCode],
    queryFn: () => routePricingApi.listWards(provinceCode!),
    enabled: Boolean(provinceCode),
  });
}

export function usePriceBooks() {
  return useQuery({
    queryKey: ['route-pricing', 'price-books'],
    queryFn: () => routePricingApi.listPriceBooks(),
  });
}

export function useRoutes(priceBookId?: number, search?: string) {
  return useQuery({
    queryKey: ['route-pricing', 'routes', priceBookId, search],
    queryFn: () => routePricingApi.listRoutes({ price_book_id: priceBookId!, search }),
    enabled: Boolean(priceBookId),
  });
}

export function useGroups(priceBookId?: number) {
  return useQuery({
    queryKey: ['route-pricing', 'groups', priceBookId],
    queryFn: () => routePricingApi.listGroups({ price_book_id: priceBookId! }),
    enabled: Boolean(priceBookId),
  });
}

export function usePrices(priceBookId?: number, routeGroupId?: number) {
  return useQuery({
    queryKey: ['route-pricing', 'prices', priceBookId, routeGroupId],
    queryFn: () =>
      routePricingApi.listPrices({
        price_book_id: priceBookId!,
        route_group_id: routeGroupId,
      }),
    enabled: Boolean(priceBookId),
  });
}

export function usePriceVersions(configId?: number) {
  return useQuery({
    queryKey: ['route-pricing', 'price-versions', configId],
    queryFn: () => routePricingApi.listVersions(configId!),
    enabled: Boolean(configId && configId > 0),
  });
}

export function usePriceMatrix(priceBookId?: number) {
  return useQuery({
    queryKey: ['route-pricing', 'prices-matrix', priceBookId],
    queryFn: () => routePricingApi.getPriceMatrix(priceBookId!),
    enabled: Boolean(priceBookId),
  });
}

export function useAdjustmentPeriods() {
  return useQuery({
    queryKey: ['route-pricing', 'adjustment-periods'],
    queryFn: () => routePricingApi.listAdjustmentPeriods(),
  });
}

export function useRoutePricingMutations(priceBookId?: number) {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['route-pricing'] });
  };

  return {
    createRoute: useMutation({
      mutationFn: routePricingApi.createRoute,
      onSuccess: invalidate,
    }),
    updateRoute: useMutation({
      mutationFn: ({ id, ...body }: { id: number; province_code: string; ward_code: string }) =>
        routePricingApi.updateRoute(id, body),
      onSuccess: invalidate,
    }),
    deleteRoute: useMutation({
      mutationFn: (id: number) => routePricingApi.deleteRoute(id),
      onSuccess: invalidate,
    }),
    createGroup: useMutation({
      mutationFn: routePricingApi.createGroup,
      onSuccess: invalidate,
    }),
    updateGroup: useMutation({
      mutationFn: ({
        id,
        ...body
      }: {
        id: number;
        ward_codes?: string[];
        location_text?: string | null;
        note?: string | null;
      }) => routePricingApi.updateGroup(id, body),
      onSuccess: invalidate,
    }),
    deleteGroup: useMutation({
      mutationFn: (id: number) => routePricingApi.deleteGroup(id),
      onSuccess: invalidate,
    }),
    createPrice: useMutation({
      mutationFn: (body: {
        route_group_id: number;
        adjustment_period_id: number;
        pricing_mode: PricingMode;
        pallet_trip_price: number;
        tiers: PriceTierInput[];
      }) => routePricingApi.createPrice(body),
      onSuccess: invalidate,
    }),
    updateAbsolutePrice: useMutation({
      mutationFn: ({
        routeGroupId,
        ...body
      }: {
        routeGroupId: number;
        pricing_mode: PricingMode;
        pallet_trip_price: number;
        tiers: PriceTierInput[];
      }) => routePricingApi.updateAbsolutePrice(routeGroupId, body),
      onSuccess: invalidate,
    }),
    createPeriod: useMutation({
      mutationFn: routePricingApi.createAdjustmentPeriod,
      onSuccess: invalidate,
    }),
    deletePeriod: useMutation({
      mutationFn: (id: number) => routePricingApi.deleteAdjustmentPeriod(id),
      onSuccess: invalidate,
    }),
    createPriceBook: useMutation({
      mutationFn: (name: string) => routePricingApi.createPriceBook(name),
      onSuccess: invalidate,
    }),
    updatePriceBook: useMutation({
      mutationFn: ({ id, name }: { id: number; name: string }) =>
        routePricingApi.updatePriceBook(id, name),
      onSuccess: invalidate,
    }),
    deletePriceBook: useMutation({
      mutationFn: (id: number) => routePricingApi.deletePriceBook(id),
      onSuccess: invalidate,
    }),
    priceBookId,
  };
}
