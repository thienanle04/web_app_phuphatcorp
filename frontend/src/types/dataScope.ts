export type ScopeType = 'all' | 'owner' | 'entity' | 'none';

export const ScopeTypes = ['all', 'owner', 'entity', 'none'] as const;

export interface FeatureScope {
  id: number;
  feature_code: string;
  feature_name: string;
  module: string;
  allowed_scope_types: ScopeType[];
  entity_types: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RoleScopeConfig {
  id: number;
  feature_code: string;
  role_id: number;
  scope_type: ScopeType;
  role_name: string;
  role_code: string;
  created_at: string;
  updated_at: string;
}

export interface FeatureWithRoleConfigs extends FeatureScope {
  role_configs: RoleScopeConfig[];
}

export interface UserEntityScope {
  id: number;
  user_id: number;
  feature_code: string;
  entity_type: string;
  entity_id: number;
  username: string;
  full_name: string;
  feature_name: string;
  entity_name?: string;
  created_at: string;
}

export interface UserDataScopeSummary {
  [feature_code: string]: {
    scope_type: ScopeType;
    entity_type?: string;
    entity_ids?: number[];
    entity_names?: string[];
  };
}

export interface AssignUserEntitiesRequest {
  user_id: number;
  feature_code: string;
  entity_type: string;
  entity_ids: number[];
}

// Dummy export object so bundler sees named runtime exports
export const DataScopeSchema = {
  ScopeTypes,
};
