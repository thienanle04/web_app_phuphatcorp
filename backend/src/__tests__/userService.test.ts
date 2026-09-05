import { userService } from '../services/userService';
import { pool } from './__mocks__/database';
import { UserRole } from '../types/user';

jest.mock('../utils/password', () => ({
  hashPassword: jest.fn(() => 'hashed-password'),
}));

const mockPool = pool as jest.Mocked<typeof pool>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('userService.createUser — sync legacy role from role_id', () => {
  const basePayload = {
    email: 'new.user@example.com',
    username: 'newuser',
    password: 'Secret1',
    full_name: 'New User',
    created_by: 1,
  };

  it('sets users.role from roles.code when only role_id is provided (regression VIEWER bug)', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [] } as never) // email unique
      .mockResolvedValueOnce({ rows: [] } as never) // username unique
      .mockResolvedValueOnce({
        rows: [{ is_active: true, code: 'ACCOUNTANT' }],
      } as never) // role check
      .mockResolvedValueOnce({
        rows: [
          {
            id: 10,
            email: 'new.user@example.com',
            username: 'newuser',
            full_name: 'New User',
            role: UserRole.ACCOUNTANT,
            role_id: 2,
            is_active: true,
          },
        ],
      } as never) // INSERT RETURNING
      .mockResolvedValueOnce({ rows: [] } as never); // logActivity (fire-and-forget)

    const user = await userService.createUser({
      ...basePayload,
      role_id: 2,
    });

    expect(user.role).toBe(UserRole.ACCOUNTANT);
    expect(user.role_id).toBe(2);

    const insertCall = mockPool.query.mock.calls.find(
      (c) => typeof c[0] === 'string' && (c[0] as string).includes('INSERT INTO users'),
    );
    expect(insertCall).toBeDefined();
    const insertParams = insertCall![1] as unknown[];
    // VALUES: email, username, password_hash, full_name, role, role_id, created_by
    expect(insertParams[4]).toBe('ACCOUNTANT');
    expect(insertParams[5]).toBe(2);
  });

  it('defaults role to VIEWER when neither role_id nor role is provided', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [] } as never) // email
      .mockResolvedValueOnce({ rows: [] } as never) // username
      .mockResolvedValueOnce({
        rows: [
          {
            id: 11,
            email: 'new.user@example.com',
            username: 'newuser',
            full_name: 'New User',
            role: UserRole.VIEWER,
            role_id: null,
            is_active: true,
          },
        ],
      } as never) // INSERT
      .mockResolvedValueOnce({ rows: [] } as never); // logActivity

    const user = await userService.createUser(basePayload);

    expect(user.role).toBe(UserRole.VIEWER);

    const insertCall = mockPool.query.mock.calls.find(
      (c) => typeof c[0] === 'string' && (c[0] as string).includes('INSERT INTO users'),
    );
    const insertParams = insertCall![1] as unknown[];
    expect(insertParams[4]).toBe(UserRole.VIEWER);
  });
});
