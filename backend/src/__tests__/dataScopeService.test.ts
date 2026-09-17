import { dataScopeService, DataScopeError } from '../services/dataScopeService';
import { UserRole } from '../types/user';
import { pool } from './__mocks__/database';

const mockPool = pool as jest.Mocked<typeof pool>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('dataScopeService.resolveScope', () => {
  it('returns scope "all" immediately for ADMIN role', async () => {
    const scope = await dataScopeService.resolveScope(1, 1, UserRole.ADMIN, 'invoice_tracking');
    expect(scope).toEqual({ type: 'all', userId: 1 });
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  it('returns scope "all" if feature is not registered or inactive', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] } as never); // feature not found

    const scope = await dataScopeService.resolveScope(2, 2, UserRole.ACCOUNTANT, 'unknown_feature');
    expect(scope).toEqual({ type: 'all', userId: 2 });
    expect(mockPool.query).toHaveBeenCalledTimes(1);
  });

  it('returns scope "entity" when user has explicit entity assignments', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ is_active: true }] } as never); // feature active
    mockPool.query.mockResolvedValueOnce({
      rows: [
        { entity_type: 'driver', entity_id: 10 },
        { entity_type: 'driver', entity_id: 11 },
      ],
    } as never); // user entities

    const scope = await dataScopeService.resolveScope(5, 3, UserRole.VIEWER, 'invoice_tracking');
    expect(scope).toEqual({
      type: 'entity',
      userId: 5,
      entityType: 'driver',
      entityIds: [10, 11],
    });
  });

  it('returns scope from role config when no user entity assignment exists', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ is_active: true }] } as never); // feature active
    mockPool.query.mockResolvedValueOnce({ rows: [] } as never); // no user entities
    mockPool.query.mockResolvedValueOnce({ rows: [{ scope_type: 'all' }] } as never); // role config = all

    const scope = await dataScopeService.resolveScope(2, 2, UserRole.ACCOUNTANT, 'invoice_tracking');
    expect(scope).toEqual({ type: 'all', userId: 2 });
  });

  it('returns scope "owner" when role is configured as owner', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ is_active: true }] } as never); // feature active
    mockPool.query.mockResolvedValueOnce({ rows: [] } as never); // no user entities
    mockPool.query.mockResolvedValueOnce({ rows: [{ scope_type: 'owner' }] } as never); // role config = owner

    const scope = await dataScopeService.resolveScope(7, 3, UserRole.VIEWER, 'invoice_tracking');
    expect(scope).toEqual({ type: 'owner', userId: 7 });
  });

  it('returns scope "none" if role is entity-scoped but user has no entity assigned', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ is_active: true }] } as never); // feature active
    mockPool.query.mockResolvedValueOnce({ rows: [] } as never); // no user entities
    mockPool.query.mockResolvedValueOnce({ rows: [{ scope_type: 'entity' }] } as never); // role config = entity

    const scope = await dataScopeService.resolveScope(6, 3, UserRole.VIEWER, 'invoice_tracking');
    expect(scope).toEqual({ type: 'none', userId: 6 });
  });
});

describe('dataScopeService.updateRoleScopeConfig', () => {
  it('throws error when updating ADMIN role to anything other than "all"', async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [{ allowed_scope_types: ['all', 'entity', 'none'] }],
    } as never); // feature
    mockPool.query.mockResolvedValueOnce({ rows: [{ code: 'ADMIN', name: 'Admin' }] } as never); // role

    await expect(
      dataScopeService.updateRoleScopeConfig('invoice_tracking', 1, 'none'),
    ).rejects.toThrow(DataScopeError);
  });

  it('throws error if scopeType is not allowed for the feature', async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [{ allowed_scope_types: ['all', 'entity'] }],
    } as never); // feature
    mockPool.query.mockResolvedValueOnce({ rows: [{ code: 'ACCOUNTANT', name: 'Accountant' }] } as never); // role

    await expect(
      dataScopeService.updateRoleScopeConfig('invoice_tracking', 2, 'none' as any),
    ).rejects.toThrow(DataScopeError);
  });

  it('updates role scope config successfully', async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [{ allowed_scope_types: ['all', 'entity', 'none'] }],
    } as never); // feature
    mockPool.query.mockResolvedValueOnce({ rows: [{ code: 'VIEWER', name: 'Viewer' }] } as never); // role
    mockPool.query.mockResolvedValueOnce({
      rows: [
        {
          id: 10,
          feature_code: 'invoice_tracking',
          role_id: 3,
          scope_type: 'entity',
          role_name: 'Viewer',
          role_code: 'VIEWER',
        },
      ],
    } as never); // upsert result

    const result = await dataScopeService.updateRoleScopeConfig('invoice_tracking', 3, 'entity');
    expect(result.scope_type).toBe('entity');
  });
});

describe('dataScopeService.assignUserEntities', () => {
  it('throws error when feature is not found', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] } as never);

    await expect(
      dataScopeService.assignUserEntities(1, 'invalid_feature', 'vehicle', [1, 2]),
    ).rejects.toThrow(DataScopeError);
  });

  it('throws error when entity_type is not allowed for the feature', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ entity_types: ['vehicle'] }] } as never);

    await expect(
      dataScopeService.assignUserEntities(1, 'invoice_tracking', 'unsupported_entity', [1, 2]),
    ).rejects.toThrow(DataScopeError);
  });

  it('throws error when user is not found', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ entity_types: ['vehicle'] }] } as never);
    mockPool.query.mockResolvedValueOnce({ rows: [] } as never); // user not found

    await expect(
      dataScopeService.assignUserEntities(999, 'invoice_tracking', 'vehicle', [1, 2]),
    ).rejects.toThrow(DataScopeError);
  });

  it('assigns entities in bulk via transaction query', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ entity_types: ['vehicle'] }] } as never); // feature
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] } as never); // user exists

    const mockClient = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn(),
    };
    mockPool.connect.mockResolvedValueOnce(mockClient as any);

    await dataScopeService.assignUserEntities(1, 'invoice_tracking', 'vehicle', [10, 20]);
    expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });
});

describe('dataScopeService.removeUserEntityScope', () => {
  it('deletes assignment by id', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: 5 }] } as never);

    await expect(dataScopeService.removeUserEntityScope(5)).resolves.toBeUndefined();
  });

  it('throws NOT_FOUND when assignment id does not exist', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] } as never);

    await expect(dataScopeService.removeUserEntityScope(999)).rejects.toThrow(DataScopeError);
  });
});
