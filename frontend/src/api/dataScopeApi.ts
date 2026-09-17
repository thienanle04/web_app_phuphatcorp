import axiosClient from './axiosClient';
import type {
  FeatureWithRoleConfigs,
  RoleScopeConfig,
  UserEntityScope,
  UserDataScopeSummary,
  AssignUserEntitiesRequest,
  ScopeType,
} from '../types/user';
import type { ApiResponse } from '../types/api';

export const dataScopeApi = {
  async getFeatures(): Promise<FeatureWithRoleConfigs[]> {
    const res = await axiosClient.get<ApiResponse<FeatureWithRoleConfigs[]>>(
      '/data-scopes/features',
    );
    return res.data.data;
  },

  async updateRoleScope(
    featureCode: string,
    roleId: number,
    scopeType: ScopeType,
  ): Promise<RoleScopeConfig> {
    const res = await axiosClient.put<ApiResponse<RoleScopeConfig>>(
      `/data-scopes/features/${featureCode}/roles/${roleId}`,
      { scope_type: scopeType },
    );
    return res.data.data;
  },

  async getUserEntityScopes(
    featureCode?: string,
    userId?: number,
  ): Promise<UserEntityScope[]> {
    const params: Record<string, string | number> = {};
    if (featureCode) params.feature_code = featureCode;
    if (userId) params.user_id = userId;

    const res = await axiosClient.get<ApiResponse<UserEntityScope[]>>(
      '/data-scopes/user-entities',
      { params },
    );
    return res.data.data;
  },

  async assignUserEntities(data: AssignUserEntitiesRequest): Promise<void> {
    await axiosClient.post<ApiResponse<void>>('/data-scopes/user-entities', data);
  },

  async removeUserEntity(id: number): Promise<void> {
    await axiosClient.delete<ApiResponse<void>>(`/data-scopes/user-entities/${id}`);
  },

  async getMyDataScopes(): Promise<UserDataScopeSummary> {
    const res = await axiosClient.get<ApiResponse<UserDataScopeSummary>>(
      '/data-scopes/me',
    );
    return res.data.data;
  },
};
