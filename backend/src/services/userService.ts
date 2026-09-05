import { pool } from '../config/database';
import { hashPassword } from '../utils/password';
import { UserPublic, UserRole } from '../types/user';
import { PaginationMeta } from '../types/api';

export class ServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

export interface CreateUserData {
  email: string;
  password: string;
  full_name: string;
  role?: UserRole;
  role_id?: number;
  username: string;
  created_by: number;
}

export interface UpdateUserData {
  full_name?: string;
  username?: string;
  role?: UserRole;
  role_id?: number;
  is_active?: boolean;
  updated_by: number;
  actor_id: number;
}

export interface GetUsersParams {
  search?: string;
  role?: UserRole;
  is_active?: boolean;
  page?: number;
  limit?: number;
}

export interface UserWithMeta {
  users: UserPublic[];
  meta: PaginationMeta;
}

interface UserRow {
  id: number;
  email: string;
  username: string;
  password_hash?: string;
  full_name: string;
  role: UserRole;
  role_id?: number | null;
  role_name?: string | null;
  is_active: boolean;
  created_at?: Date;
  updated_at?: Date;
}

function toPublicUser(row: UserRow): UserPublic {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    full_name: row.full_name,
    role: row.role,
    role_id: row.role_id ?? null,
    role_name: row.role_name ?? undefined,
    is_active: row.is_active,
  };
}

export const userService = {
  async createUser(data: CreateUserData): Promise<UserPublic> {
    const existingResult = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [data.email.toLowerCase()],
    );
    if (existingResult.rows.length > 0) {
      throw new ServiceError('EMAIL_EXISTS', 'Email already registered', 409);
    }

    // Check username uniqueness
    const existingUsername = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [data.username],
    );
    if (existingUsername.rows.length > 0) {
      throw new ServiceError('USERNAME_EXISTS', 'Tên đăng nhập đã được sử dụng', 409);
    }

    // Validate role_id is active if provided; also load code to sync legacy `role` column
    let resolvedRoleId: number | null = data.role_id ?? null;
    let roleFromId: string | null = null;
    if (resolvedRoleId) {
      const roleCheck = await pool.query<{ is_active: boolean; code: string }>(
        'SELECT is_active, code FROM roles WHERE id = $1',
        [resolvedRoleId],
      );
      if (!roleCheck.rows[0]) throw new ServiceError('ROLE_NOT_FOUND', 'Vai trò không tồn tại', 404);
      if (!roleCheck.rows[0].is_active) {
        throw new ServiceError('ROLE_INACTIVE', 'Vai trò không hoạt động, không thể gán cho người dùng', 400);
      }
      roleFromId = roleCheck.rows[0].code;
    }

    // Resolve legacy role to role_id if no role_id provided
    if (!resolvedRoleId && data.role) {
      const roleByCode = await pool.query<{ id: number }>(
        'SELECT id FROM roles WHERE code = $1',
        [data.role],
      );
      if (roleByCode.rows[0]) resolvedRoleId = roleByCode.rows[0].id;
    }

    const passwordHash = hashPassword(data.password);
    // Prefer roles.code from role_id (FE create sends only role_id); else legacy role / VIEWER
    const role = roleFromId || data.role || UserRole.VIEWER;

    const result = await pool.query<UserRow>(
      `INSERT INTO users (email, username, password_hash, full_name, role, role_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, email, username, full_name, role, role_id, is_active`,
      [data.email.toLowerCase(), data.username, passwordHash, data.full_name, role, resolvedRoleId, data.created_by],
    );

    const user = result.rows[0];

    this.logActivity(data.created_by, user.id, 'CREATE_USER', {
      new_user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role },
    });

    return toPublicUser(user);
  },

  async updateUser(id: number, data: UpdateUserData): Promise<UserPublic> {
    const existingResult = await pool.query<UserRow>(
      'SELECT id, email, full_name, role, role_id, is_active FROM users WHERE id = $1',
      [id],
    );
    if (existingResult.rows.length === 0) {
      throw new ServiceError('USER_NOT_FOUND', 'User not found', 404);
    }

    const oldUser = existingResult.rows[0];

    // Validate new role_id if provided
    if (data.role_id !== undefined) {
      const roleCheck = await pool.query<{ is_active: boolean }>(
        'SELECT is_active FROM roles WHERE id = $1',
        [data.role_id],
      );
      if (!roleCheck.rows[0]) throw new ServiceError('ROLE_NOT_FOUND', 'Vai trò không tồn tại', 404);
      if (!roleCheck.rows[0].is_active) {
        throw new ServiceError('ROLE_INACTIVE', 'Vai trò không hoạt động, không thể gán cho người dùng', 400);
      }
    }

    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (data.username !== undefined) {
      // Check username uniqueness (exclude current user)
      const existingUsername = await pool.query(
        'SELECT id FROM users WHERE username = $1 AND id != $2',
        [data.username, id],
      );
      if (existingUsername.rows.length > 0) {
        throw new ServiceError('USERNAME_EXISTS', 'Tên đăng nhập đã được sử dụng', 409);
      }
      updates.push(`username = $${paramIndex++}`);
      values.push(data.username);
    }
    if (data.full_name !== undefined) {
      updates.push(`full_name = $${paramIndex++}`);
      values.push(data.full_name);
    }
    if (data.role !== undefined) {
      updates.push(`role = $${paramIndex++}`);
      values.push(data.role);
    }
    if (data.role_id !== undefined) {
      updates.push(`role_id = $${paramIndex++}`);
      values.push(data.role_id);
      // Sync legacy role column from roles table
      const roleCodeResult = await pool.query<{ code: string }>(
        'SELECT code FROM roles WHERE id = $1',
        [data.role_id],
      );
      if (roleCodeResult.rows[0]) {
        updates.push(`role = $${paramIndex++}`);
        values.push(roleCodeResult.rows[0].code);
      }
    }
    if (data.is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(data.is_active);
    }

    updates.push(`updated_by = $${paramIndex++}`);
    values.push(data.updated_by);
    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    if (updates.length === 2) {
      // Only updated_by and updated_at — nothing changed
      return toPublicUser(oldUser);
    }

    values.push(id);
    const result = await pool.query<UserRow>(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}
       RETURNING id, email, full_name, role, role_id, is_active`,
      values,
    );

    const updatedUser = result.rows[0];

    this.logActivity(data.updated_by, id, 'UPDATE_USER', {
      old: { full_name: oldUser.full_name, role: oldUser.role, role_id: oldUser.role_id, is_active: oldUser.is_active },
      new: { full_name: updatedUser.full_name, role: updatedUser.role, role_id: updatedUser.role_id },
    });

    return toPublicUser(updatedUser);
  },

  async deleteUser(id: number, actorId: number): Promise<void> {
    const existingResult = await pool.query<UserRow>(
      'SELECT id, email, full_name, role FROM users WHERE id = $1',
      [id],
    );
    if (existingResult.rows.length === 0) {
      throw new ServiceError('USER_NOT_FOUND', 'User not found', 404);
    }

    const user = existingResult.rows[0];

    if (actorId === id) {
      throw new ServiceError('CANNOT_DELETE_SELF', 'Cannot delete your own account', 403);
    }

    const adminCountResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM users WHERE role = $1 AND is_active = true AND id != $2`,
      [UserRole.ADMIN, id],
    );
    const remainingAdmins = parseInt(adminCountResult.rows[0].count, 10);
    if (remainingAdmins <= 0) {
      throw new ServiceError('LAST_ADMIN', 'Cannot delete the last admin user', 400);
    }

    // Clear FK references before deleting to avoid constraint violations
    await pool.query('DELETE FROM user_activities WHERE target_user_id = $1 OR actor_id = $2', [id, id]);
    await pool.query('UPDATE users SET created_by = NULL WHERE created_by = $1', [id]);
    await pool.query('UPDATE users SET updated_by = NULL WHERE updated_by = $1', [id]);
    await pool.query('DELETE FROM users WHERE id = $1', [id]);

    this.logActivity(actorId, id, 'DELETE_USER', {
      deleted_user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role },
    });
  },

  async resetPassword(id: number, newPassword: string): Promise<void> {
    const existingResult = await pool.query(
      'SELECT id FROM users WHERE id = $1',
      [id],
    );
    if (existingResult.rows.length === 0) {
      throw new ServiceError('USER_NOT_FOUND', 'User not found', 404);
    }

    const passwordHash = hashPassword(newPassword);
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [passwordHash, id],
    );
  },

  async getUsers(params: GetUsersParams): Promise<UserWithMeta> {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 100);
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (params.search) {
      conditions.push(`(u.full_name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`);
      values.push(`%${params.search}%`);
      paramIndex++;
    }
    if (params.role) {
      conditions.push(`u.role = $${paramIndex++}`);
      values.push(params.role);
    }
    if (params.is_active !== undefined) {
      conditions.push(`u.is_active = $${paramIndex++}`);
      values.push(params.is_active);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM users u ${whereClause}`,
      values,
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await pool.query<UserRow>(
      `SELECT u.id, u.email, u.username, u.full_name, u.role, u.role_id, u.is_active,
              r.name AS role_name, u.created_at, u.updated_at
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       ${whereClause}
       ORDER BY u.id ASC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...values, limit, offset],
    );

    const meta: PaginationMeta = {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };

    return {
      users: result.rows.map(toPublicUser),
      meta,
    };
  },

  async getUserById(id: number): Promise<UserPublic | null> {
    const result = await pool.query<UserRow>(
      `SELECT u.id, u.email, u.full_name, u.role, u.role_id, u.is_active, r.name AS role_name
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.id = $1`,
      [id],
    );
    return result.rows[0] ? toPublicUser(result.rows[0]) : null;
  },

  async logActivity(
    actorId: number,
    targetUserId: number,
    action: string,
    details?: Record<string, unknown>,
    ipAddress?: string,
  ): Promise<void> {
    pool
      .query(
        `INSERT INTO user_activities (actor_id, target_user_id, action, details, ip_address)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          actorId,
          targetUserId,
          action,
          details ? JSON.stringify(details) : null,
          ipAddress ?? null,
        ],
      )
      .catch((err) => {
        console.error('[userService] Failed to log activity:', err.message);
      });
  },
};
