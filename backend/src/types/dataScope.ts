export type ScopeType = 'all' | 'owner' | 'entity' | 'none';

export interface DataScope {
  type: ScopeType;
  userId?: number;
  entityType?: string;
  entityIds?: number[];
}

export interface FeatureScope {
  id: number;
  feature_code: string;
  feature_name: string;
  module: string;
  allowed_scope_types: ScopeType[];
  entity_types: string[];
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface RoleScopeConfig {
  id: number;
  feature_code: string;
  role_id: number;
  scope_type: ScopeType;
  created_at: Date;
  updated_at: Date;
}

export interface RoleScopeConfigWithRole extends RoleScopeConfig {
  role_name: string;
  role_code: string;
}

export interface FeatureWithRoleConfigs extends FeatureScope {
  role_configs: RoleScopeConfigWithRole[];
}

export interface UserEntityScope {
  id: number;
  user_id: number;
  feature_code: string;
  entity_type: string;
  entity_id: number;
  created_at: Date;
}

export interface UserEntityScopeWithDetails extends UserEntityScope {
  username: string;
  full_name: string;
  feature_name: string;
  entity_name?: string;
}

export interface UserDataScopeSummary {
  [feature_code: string]: {
    scope_type: ScopeType;
    entity_type?: string;
    entity_ids?: number[];
    entity_names?: string[];
  };
}
