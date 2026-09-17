import { workflowService } from '../services/workflowService';
import { pool } from './__mocks__/database';

const mockPool = pool as jest.Mocked<typeof pool>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('workflowService.listWorkflows', () => {
  it('returns list of workflows with step count', async () => {
    const mockWorkflows = [
      {
        id: 1,
        feature_code: 'invoice_tracking',
        name: 'Quy trình theo dõi hóa đơn',
        description: 'Test description',
        module: 'dispatch',
        is_active: true,
        step_count: 4,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    mockPool.query.mockResolvedValueOnce({ rows: mockWorkflows } as never);

    const result = await workflowService.listWorkflows();
    expect(result).toHaveLength(1);
    expect(result[0].feature_code).toBe('invoice_tracking');
    expect(result[0].step_count).toBe(4);
  });
});

describe('workflowService.getNextStatus', () => {
  it('returns target status from workflow transitions', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ id: 1, is_active: true }] } as never) // workflow
      .mockResolvedValueOnce({ rows: [{ target_status: 'completed' }] } as never); // transition

    const next = await workflowService.getNextStatus(
      'invoice_tracking',
      'pending_review',
      'review_finish',
      'fallback_status',
    );
    expect(next).toBe('completed');
  });

  it('returns fallback status when workflow transition not found', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ id: 1, is_active: true }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);

    const next = await workflowService.getNextStatus(
      'invoice_tracking',
      'pending_review',
      'unknown_action',
      'fallback_status',
    );
    expect(next).toBe('fallback_status');
  });
});

describe('workflowService.authorizeAction', () => {
  it('allows any action if workflow is inactive', async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [{ id: 1, is_active: false }],
    } as never);

    const result = await workflowService.authorizeAction(
      'invoice_tracking',
      'created',
      'upload_document',
      { userId: 10, role: 'DRIVER', roleId: 3 },
      { driver_id: 99 },
    );

    expect(result.authorized).toBe(true);
  });

  it('allows ADMIN regardless of assigned actors', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ id: 1, is_active: true }] } as never) // workflow
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            step_name: 'Tạo mới',
            status_code: 'created',
            allowed_actions: ['upload_document'],
            actor_type: 'dynamic',
            dynamic_actor: 'assigned_driver',
          },
        ],
      } as never); // step

    const result = await workflowService.authorizeAction(
      'invoice_tracking',
      'created',
      'upload_document',
      { userId: 1, role: 'ADMIN', roleId: 1 },
      { driver_id: 99 },
    );

    expect(result.authorized).toBe(true);
  });

  it('allows assigned driver when dynamic_actor is assigned_driver', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ id: 1, is_active: true }] } as never)
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            step_name: 'Tải chứng từ',
            status_code: 'created',
            allowed_actions: ['upload_document'],
            actor_type: 'dynamic',
            dynamic_actor: 'assigned_driver',
            assigned_role_ids: [1],
          },
        ],
      } as never);

    const result = await workflowService.authorizeAction(
      'invoice_tracking',
      'created',
      'upload_document',
      { userId: 5, role: 'DRIVER', roleId: 3 },
      { driver_id: 5 },
    );

    expect(result.authorized).toBe(true);
  });

  it('rejects unassigned driver when dynamic_actor is assigned_driver', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ id: 1, is_active: true }] } as never)
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            step_name: 'Tải chứng từ',
            status_code: 'created',
            allowed_actions: ['upload_document'],
            actor_type: 'dynamic',
            dynamic_actor: 'assigned_driver',
            assigned_role_ids: [1],
          },
        ],
      } as never);

    const result = await workflowService.authorizeAction(
      'invoice_tracking',
      'created',
      'upload_document',
      { userId: 10, role: 'DRIVER', roleId: 3 },
      { driver_id: 5 },
    );

    expect(result.authorized).toBe(false);
    expect(result.reason).toContain('Chỉ tài xế được gán cho chuyến này');
  });

  it('allows user with matching role for role actor_type', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ id: 1, is_active: true }] } as never)
      .mockResolvedValueOnce({
        rows: [
          {
            id: 2,
            step_name: 'Chờ duyệt',
            status_code: 'pending_review',
            allowed_actions: ['review_finish', 'request_supplement'],
            actor_type: 'role',
            assigned_role_ids: [2],
          },
        ],
      } as never);

    const result = await workflowService.authorizeAction(
      'invoice_tracking',
      'pending_review',
      'review_finish',
      { userId: 8, role: 'ACCOUNTANT', roleId: 2 },
      { driver_id: 5 },
    );

    expect(result.authorized).toBe(true);
  });
});

describe('workflowService.attachUserPermissionsBulk', () => {
  it('efficiently attaches permissions to list of tickets without N+1 queries', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ id: 1, is_active: true }] } as never)
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            step_name: 'Tạo mới',
            status_code: 'created',
            allowed_actions: ['upload_document'],
            actor_type: 'dynamic',
            dynamic_actor: 'assigned_driver',
            assigned_role_ids: [1],
          },
          {
            id: 2,
            step_name: 'Chờ duyệt',
            status_code: 'pending_review',
            allowed_actions: ['review_finish', 'request_supplement'],
            actor_type: 'role',
            assigned_role_ids: [2],
          },
        ],
      } as never);

    const mockTickets: any[] = [
      { id: 1, invoice_status: 'created', driver_id: 24 },
      { id: 2, invoice_status: 'pending_review', driver_id: 25 },
    ];

    const results = await workflowService.attachUserPermissionsBulk(
      'invoice_tracking',
      mockTickets,
      { userId: 24, role: 'TAI_XE', roleId: 37 },
    );

    expect(results).toHaveLength(2);
    // Ticket 1: driver 24 -> can_upload true
    expect(results[0].user_permissions?.can_upload).toBe(true);
    expect(results[0].user_permissions?.can_finish).toBe(false);

    // Ticket 2: status pending_review (requires role 2) -> can_finish false for driver 24
    expect(results[1].user_permissions?.can_upload).toBe(false);
    expect(results[1].user_permissions?.can_finish).toBe(false);
  });
});
