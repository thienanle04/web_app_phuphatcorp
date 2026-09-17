import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dataScopeApi } from '../api/dataScopeApi';
import type { AssignUserEntitiesRequest, ScopeType } from '../types/user';

export function useFeatureScopes() {
  return useQuery({
    queryKey: ['data-scopes', 'features'],
    queryFn: () => dataScopeApi.getFeatures(),
  });
}

export function useUpdateRoleScope() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      featureCode,
      roleId,
      scopeType,
    }: {
      featureCode: string;
      roleId: number;
      scopeType: ScopeType;
    }) => dataScopeApi.updateRoleScope(featureCode, roleId, scopeType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data-scopes', 'features'] });
      queryClient.invalidateQueries({ queryKey: ['data-scopes', 'me'] });
    },
  });
}

export function useUserEntityScopes(featureCode?: string, userId?: number) {
  return useQuery({
    queryKey: ['data-scopes', 'user-entities', { featureCode, userId }],
    queryFn: () => dataScopeApi.getUserEntityScopes(featureCode, userId),
  });
}

export function useAssignUserEntities() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AssignUserEntitiesRequest) => dataScopeApi.assignUserEntities(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data-scopes', 'user-entities'] });
      queryClient.invalidateQueries({ queryKey: ['data-scopes', 'me'] });
    },
  });
}

export function useRemoveUserEntity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => dataScopeApi.removeUserEntity(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data-scopes', 'user-entities'] });
      queryClient.invalidateQueries({ queryKey: ['data-scopes', 'me'] });
    },
  });
}

export function useMyDataScopes() {
  return useQuery({
    queryKey: ['data-scopes', 'me'],
    queryFn: () => dataScopeApi.getMyDataScopes(),
    staleTime: 5 * 60 * 1000,
  });
}
