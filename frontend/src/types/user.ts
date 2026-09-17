export type ScopeType = 'all' | 'owner' | 'entity' | 'none';

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

export const UserRole = {
  ADMIN: 'ADMIN',
  ACCOUNTANT: 'ACCOUNTANT',
  VIEWER: 'VIEWER',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export interface UserPublic {
  id: number;
  email: string;
  username: string;
  full_name: string;
  role?: string;
  role_id?: number | null;
  role_name?: string;
  is_active?: boolean;
  permissions?: string[];
  created_at?: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  full_name: string;
  email: string;
  password: string;
}

export interface Role {
  id: number;
  name: string;
  code: string;
  description: string | null;
  is_active: boolean;
  is_system: boolean;
  user_count?: number;
  permission_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Permission {
  id: number;
  code: string;
  name: string;
  module: string;
  description: string | null;
  created_at?: string;
}

export interface PermissionMatrix {
  roles: Pick<Role, 'id' | 'name' | 'code' | 'is_system'>[];
  permissions: Permission[];
  matrix: Record<number, number[]>;
}

