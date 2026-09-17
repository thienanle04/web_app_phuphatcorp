import { pool } from '../config/database';
import {
  DataScope,
  FeatureWithRoleConfigs,
  RoleScopeConfigWithRole,
  ScopeType,
  UserEntityScopeWithDetails,
  UserDataScopeSummary,
} from '../types/dataScope';
import { UserRole } from '../types/user';

export class DataScopeError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = 'DataScopeError';
  }
}

export const dataScopeService = {
  /**
   * Resolve effective DataScope for a user accessing a specific feature
   */
  async resolveScope(
    userId: number,
    roleId: number | null,
    userRole: UserRole,
    featureCode: string,
  ): Promise<DataScope> {
    // 1. ADMIN bypasses all data scopes
    if (userRole === UserRole.ADMIN) {
      return { type: 'all', userId };
    }

    // 2. Check if feature is registered in feature_scopes
    const featureRes = await pool.query<{ is_active: boolean }>(
      'SELECT is_active FROM feature_scopes WHERE feature_code = $1',
      [featureCode],
    );

    if (!featureRes.rows[0] || !featureRes.rows[0].is_active) {
      // Feature has no active data scope configuration -> return all (backward compatible)
      return { type: 'all', userId };
    }

    // 3. Check for specific user entity assignments (User-level override / assignment)
    const entityRes = await pool.query<{ entity_type: string; entity_id: number }>(
      `SELECT entity_type, entity_id
       FROM user_entity_scopes
       WHERE user_id = $1 AND feature_code = $2`,
      [userId, featureCode],
    );

    if (entityRes.rows.length > 0) {
      const entityType = entityRes.rows[0].entity_type;
      const entityIds = entityRes.rows.map((r) => r.entity_id);
      return {
        type: 'entity',
        userId,
        entityType,
        entityIds,
      };
    }

    // 4. Check role_scope_configs
    if (roleId) {
      const roleConfigRes = await pool.query<{ scope_type: ScopeType }>(
        `SELECT scope_type
         FROM role_scope_configs
         WHERE feature_code = $1 AND role_id = $2`,
        [featureCode, roleId],
      );

      if (roleConfigRes.rows[0]) {
        const scopeType = roleConfigRes.rows[0].scope_type;
        if (scopeType === 'entity') {
          // Role is configured as entity-scoped, but user has no entity assignments -> none
          return { type: 'none', userId };
        }
        return { type: scopeType, userId };
      }
    }

    // Default fallback
    return { type: 'all', userId };
  },

  /**
   * Get all registered features along with their role scope matrix configs
   */
  async getFeaturesWithConfigs(): Promise<FeatureWithRoleConfigs[]> {
    const featuresRes = await pool.query(
      `SELECT id, feature_code, feature_name, module, allowed_scope_types, entity_types, is_active, created_at, updated_at
       FROM feature_scopes
       ORDER BY module, feature_code`,
    );

    const rolesRes = await pool.query<{ id: number; name: string; code: string }>(
      'SELECT id, name, code FROM roles ORDER BY id',
    );

    const configsRes = await pool.query<RoleScopeConfigWithRole>(
      `SELECT rsc.id, rsc.feature_code, rsc.role_id, rsc.scope_type, rsc.created_at, rsc.updated_at,
              r.name as role_name, r.code as role_code
       FROM role_scope_configs rsc
       JOIN roles r ON r.id = rsc.role_id`,
    );

    const configsMap = new Map<string, RoleScopeConfigWithRole>();
    for (const c of configsRes.rows) {
      configsMap.set(`${c.feature_code}:${c.role_id}`, c);
    }

    return featuresRes.rows.map((f) => {
      const role_configs: RoleScopeConfigWithRole[] = rolesRes.rows.map((r) => {
        const existing = configsMap.get(`${f.feature_code}:${r.id}`);
        return (
          existing || {
            id: 0,
            feature_code: f.feature_code,
            role_id: r.id,
            scope_type: r.code === 'ADMIN' ? 'all' : 'none',
            role_name: r.name,
            role_code: r.code,
            created_at: new Date(),
            updated_at: new Date(),
          }
        );
      });

      return {
        ...f,
        role_configs,
      };
    });
  },

  /**
   * Update scope type for a specific role and feature
   */
  async updateRoleScopeConfig(
    featureCode: string,
    roleId: number,
    scopeType: ScopeType,
  ): Promise<RoleScopeConfigWithRole> {
    const featureRes = await pool.query<{ allowed_scope_types: ScopeType[] }>(
      'SELECT allowed_scope_types FROM feature_scopes WHERE feature_code = $1',
      [featureCode],
    );

    if (!featureRes.rows[0]) {
      throw new DataScopeError('FEATURE_NOT_FOUND', 'Tính năng chưa đăng ký phạm vi dữ liệu', 404);
    }

    const roleRes = await pool.query<{ code: string; name: string }>(
      'SELECT code, name FROM roles WHERE id = $1',
      [roleId],
    );

    if (!roleRes.rows[0]) {
      throw new DataScopeError('ROLE_NOT_FOUND', 'Không tìm thấy vai trò', 404);
    }

    // Protect ADMIN role
    if (roleRes.rows[0].code === 'ADMIN' && scopeType !== 'all') {
      throw new DataScopeError(
        'ADMIN_SCOPE_IMMUTABLE',
        'Vai trò Quản trị viên (ADMIN) luôn có toàn quyền dữ liệu (scope: all)',
        400,
      );
    }

    if (!featureRes.rows[0].allowed_scope_types.includes(scopeType)) {
      throw new DataScopeError(
        'INVALID_SCOPE_TYPE',
        `Loại phạm vi "${scopeType}" không hợp lệ cho tính năng này. Cho phép: ${featureRes.rows[0].allowed_scope_types.join(', ')}`,
        400,
      );
    }

    const upsertRes = await pool.query<RoleScopeConfigWithRole>(
      `INSERT INTO role_scope_configs (feature_code, role_id, scope_type, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (feature_code, role_id)
       DO UPDATE SET scope_type = EXCLUDED.scope_type, updated_at = NOW()
       RETURNING id, feature_code, role_id, scope_type, created_at, updated_at,
                 $4::text as role_name, $5::text as role_code`,
      [featureCode, roleId, scopeType, roleRes.rows[0].name, roleRes.rows[0].code],
    );

    return upsertRes.rows[0];
  },

  /**
   * Get list of user entity assignments
   */
  async getUserEntityScopes(
    featureCode?: string,
    userId?: number,
  ): Promise<UserEntityScopeWithDetails[]> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (featureCode) {
      conditions.push(`ues.feature_code = $${paramIndex++}`);
      params.push(featureCode);
    }

    if (userId) {
      conditions.push(`ues.user_id = $${paramIndex++}`);
      params.push(userId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const res = await pool.query<UserEntityScopeWithDetails>(
      `SELECT ues.id, ues.user_id, ues.feature_code, ues.entity_type, ues.entity_id, ues.created_at,
              u.username, u.full_name, fs.feature_name,
              COALESCE(
                v.plate_number,
                c.ten_khach_hang,
                target_u.full_name,
                target_u.username,
                ues.entity_id::text
              ) as entity_name
       FROM user_entity_scopes ues
       JOIN users u ON u.id = ues.user_id
       JOIN feature_scopes fs ON fs.feature_code = ues.feature_code
       LEFT JOIN vehicles v ON (ues.entity_type = 'vehicle' AND v.id = ues.entity_id)
       LEFT JOIN customers c ON (ues.entity_type = 'customer' AND c.id = ues.entity_id)
       LEFT JOIN users target_u ON (ues.entity_type = 'driver' AND target_u.id = ues.entity_id)
       ${whereClause}
       ORDER BY ues.created_at DESC`,
      params,
    );

    return res.rows;
  },

  /**
   * Assign entities to a user for a feature
   */
  async assignUserEntities(
    userId: number,
    featureCode: string,
    entityType: string,
    entityIds: number[],
  ): Promise<void> {
    const featureRes = await pool.query<{ entity_types: string[] }>(
      'SELECT entity_types FROM feature_scopes WHERE feature_code = $1',
      [featureCode],
    );

    if (!featureRes.rows[0]) {
      throw new DataScopeError('FEATURE_NOT_FOUND', 'Không tìm thấy tính năng', 404);
    }

    if (
      !featureRes.rows[0].entity_types ||
      !featureRes.rows[0].entity_types.includes(entityType)
    ) {
      throw new DataScopeError(
        'INVALID_ENTITY_TYPE',
        `Loại đối tượng "${entityType}" không áp dụng cho tính năng này`,
        400,
      );
    }

    const userRes = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
    if (!userRes.rows[0]) {
      throw new DataScopeError('USER_NOT_FOUND', 'Không tìm thấy người dùng', 404);
    }

    if (!entityIds || entityIds.length === 0) {
      throw new DataScopeError('NO_ENTITIES', 'Danh sách đối tượng gán không được rỗng', 400);
    }

    // Filter valid positive integer IDs and remove duplicates
    const uniqueEntityIds = Array.from(new Set(entityIds.filter((id) => Number.isInteger(id) && id > 0)));
    if (uniqueEntityIds.length === 0) {
      throw new DataScopeError('NO_VALID_ENTITIES', 'Danh sách ID đối tượng không hợp lệ', 400);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO user_entity_scopes (user_id, feature_code, entity_type, entity_id)
         SELECT $1, $2, $3, unnest($4::int[])
         ON CONFLICT (user_id, feature_code, entity_type, entity_id) DO NOTHING`,
        [userId, featureCode, entityType, uniqueEntityIds],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Remove a user entity scope assignment by id
   */
  async removeUserEntityScope(id: number): Promise<void> {
    const res = await pool.query('DELETE FROM user_entity_scopes WHERE id = $1 RETURNING id', [
      id,
    ]);
    if (!res.rows[0]) {
      throw new DataScopeError('NOT_FOUND', 'Không tìm thấy bản ghi gán đối tượng', 404);
    }
  },

  /**
   * Summarize user's data scopes across all features (for /me/data-scopes)
   */
  async getUserScopesSummary(
    userId: number,
    roleId: number | null,
    userRole: UserRole,
  ): Promise<UserDataScopeSummary> {
    const featuresRes = await pool.query<{ feature_code: string }>(
      'SELECT feature_code FROM feature_scopes WHERE is_active = TRUE',
    );

    const summary: UserDataScopeSummary = {};

    // Parallelize scope resolution across features to prevent N+1 serial bottlenecks
    const scopesWithFeature = await Promise.all(
      featuresRes.rows.map(async (f) => {
        const scope = await this.resolveScope(userId, roleId, userRole, f.feature_code);
        return { featureCode: f.feature_code, scope };
      }),
    );

    // Batch resolve vehicle and user driver names in parallel
    const vehicleEntityIds = new Set<number>();
    const driverEntityIds = new Set<number>();

    for (const { scope } of scopesWithFeature) {
      if (scope.type === 'entity' && scope.entityIds?.length) {
        if (scope.entityType === 'vehicle') {
          scope.entityIds.forEach((id) => vehicleEntityIds.add(id));
        } else if (scope.entityType === 'driver') {
          scope.entityIds.forEach((id) => driverEntityIds.add(id));
        }
      }
    }

    const vehicleMap = new Map<number, string>();
    const driverMap = new Map<number, string>();

    const queries: Promise<void>[] = [];

    if (vehicleEntityIds.size > 0) {
      queries.push(
        pool
          .query<{ id: number; plate_number: string }>(
            'SELECT id, plate_number FROM vehicles WHERE id = ANY($1)',
            [Array.from(vehicleEntityIds)],
          )
          .then((res) => {
            res.rows.forEach((v) => vehicleMap.set(v.id, v.plate_number));
          }),
      );
    }

    if (driverEntityIds.size > 0) {
      queries.push(
        pool
          .query<{ id: number; full_name: string; username: string }>(
            'SELECT id, full_name, username FROM users WHERE id = ANY($1)',
            [Array.from(driverEntityIds)],
          )
          .then((res) => {
            res.rows.forEach((d) => driverMap.set(d.id, d.full_name || d.username));
          }),
      );
    }

    if (queries.length > 0) {
      await Promise.all(queries);
    }

    for (const { featureCode, scope } of scopesWithFeature) {
      if (scope.type === 'owner') {
        summary[featureCode] = {
          scope_type: 'owner',
        };
      } else {
        summary[featureCode] = {
          scope_type: scope.type,
          entity_type: scope.entityType,
          entity_ids: scope.entityIds,
        };

        if (scope.type === 'entity' && scope.entityIds?.length) {
          if (scope.entityType === 'vehicle') {
            summary[featureCode].entity_names = scope.entityIds
              .map((id) => vehicleMap.get(id))
              .filter(Boolean) as string[];
          } else if (scope.entityType === 'driver') {
            summary[featureCode].entity_names = scope.entityIds
              .map((id) => driverMap.get(id))
              .filter(Boolean) as string[];
          }
        }
      }
    }

    return summary;
  },
};
