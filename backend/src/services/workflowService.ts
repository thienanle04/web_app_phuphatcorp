import { pool } from '../config/database';
import { Workflow, WorkflowDetail, WorkflowStep, WorkflowTransition, UserTicketPermissions } from '../types/workflow';
import { DispatchSchedule } from './dispatchScheduleService';
import { InvoiceTrackingTicketWithPermissions } from './invoiceTrackingService';

export class WorkflowError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = 'WorkflowError';
  }
}

export const workflowService = {
  async listWorkflows(): Promise<Workflow[]> {
    const result = await pool.query<Workflow>(`
      SELECT w.id, w.feature_code, w.name, w.description, w.module, w.is_active,
             w.created_at, w.updated_at,
             COUNT(s.id)::int as step_count
      FROM workflows w
      LEFT JOIN workflow_steps s ON s.workflow_id = w.id
      GROUP BY w.id
      ORDER BY w.id ASC
    `);
    return result.rows;
  },

  async getWorkflowByFeature(featureCode: string): Promise<WorkflowDetail> {
    const wfRes = await pool.query<Workflow>(
      'SELECT * FROM workflows WHERE feature_code = $1',
      [featureCode],
    );

    if (!wfRes.rows[0]) {
      throw new WorkflowError('NOT_FOUND', `Không tìm thấy quy trình cho feature: ${featureCode}`, 404);
    }

    const workflow = wfRes.rows[0];

    // Fetch steps with populated role_names and user_names
    const stepsRes = await pool.query<WorkflowStep>(`
      SELECT s.*,
             COALESCE(
               ARRAY(
                 SELECT r.name FROM roles r WHERE r.id = ANY(s.assigned_role_ids)
               ),
               '{}'
             ) as role_names,
             COALESCE(
               ARRAY(
                 SELECT u.full_name FROM users u WHERE u.id = ANY(s.assigned_user_ids)
               ),
               '{}'
             ) as user_names
      FROM workflow_steps s
      WHERE s.workflow_id = $1
      ORDER BY s.step_order ASC, s.id ASC
    `, [workflow.id]);

    // Fetch transitions
    const transRes = await pool.query<WorkflowTransition>(`
      SELECT t.*,
             fs.step_code as from_step_code,
             ts.step_code as to_step_code
      FROM workflow_transitions t
      JOIN workflow_steps fs ON fs.id = t.from_step_id
      JOIN workflow_steps ts ON ts.id = t.to_step_id
      WHERE t.workflow_id = $1
      ORDER BY t.id ASC
    `, [workflow.id]);

    return {
      ...workflow,
      steps: stepsRes.rows,
      transitions: transRes.rows,
    };
  },

  async toggleWorkflowActive(featureCode: string, isActive: boolean): Promise<Workflow> {
    const result = await pool.query<Workflow>(
      `UPDATE workflows
       SET is_active = $1, updated_at = NOW()
       WHERE feature_code = $2
       RETURNING *`,
      [isActive, featureCode],
    );

    if (!result.rows[0]) {
      throw new WorkflowError('NOT_FOUND', `Không tìm thấy quy trình: ${featureCode}`, 404);
    }

    return result.rows[0];
  },

  async saveWorkflowConfig(
    featureCode: string,
    payload: {
      name?: string;
      description?: string;
      steps: Omit<WorkflowStep, 'id' | 'workflow_id' | 'role_names' | 'user_names'>[];
      transitions?: {
        from_step_code: string;
        to_step_code: string;
        action_code: string;
        action_name: string;
        require_note?: boolean;
      }[];
    },
  ): Promise<WorkflowDetail> {
    const wfRes = await pool.query<Workflow>(
      'SELECT * FROM workflows WHERE feature_code = $1',
      [featureCode],
    );

    if (!wfRes.rows[0]) {
      throw new WorkflowError('NOT_FOUND', `Không tìm thấy quy trình: ${featureCode}`, 404);
    }

    const workflowId = wfRes.rows[0].id;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      if (payload.name || payload.description !== undefined) {
        await client.query(
          `UPDATE workflows
           SET name = COALESCE($1, name),
               description = COALESCE($2, description),
               updated_at = NOW()
           WHERE id = $3`,
          [payload.name, payload.description, workflowId],
        );
      }

      // 1. Delete existing transitions and steps
      await client.query('DELETE FROM workflow_transitions WHERE workflow_id = $1', [workflowId]);
      await client.query('DELETE FROM workflow_steps WHERE workflow_id = $1', [workflowId]);

      // 2. Insert new steps
      const stepCodeToIdMap = new Map<string, number>();

      for (let i = 0; i < payload.steps.length; i++) {
        const step = payload.steps[i];
        const stepOrder = i + 1;

        const inserted = await client.query<{ id: number; step_code: string }>(
          `INSERT INTO workflow_steps (
            workflow_id, step_order, step_code, step_name, status_code,
            allowed_actions, actor_type, assigned_role_ids, assigned_user_ids,
            dynamic_actor, is_initial, is_final
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          RETURNING id, step_code`,
          [
            workflowId,
            stepOrder,
            step.step_code.trim(),
            step.step_name.trim(),
            step.status_code.trim(),
            step.allowed_actions || [],
            step.actor_type || 'role',
            step.assigned_role_ids || [],
            step.assigned_user_ids || [],
            step.dynamic_actor || null,
            step.is_initial || false,
            step.is_final || false,
          ],
        );

        stepCodeToIdMap.set(inserted.rows[0].step_code, inserted.rows[0].id);
      }

      // 3. Insert transitions if provided
      if (payload.transitions && payload.transitions.length > 0) {
        for (const tr of payload.transitions) {
          const fromId = stepCodeToIdMap.get(tr.from_step_code);
          const toId = stepCodeToIdMap.get(tr.to_step_code);

          if (fromId && toId) {
            await client.query(
              `INSERT INTO workflow_transitions (
                workflow_id, from_step_id, to_step_id, action_code, action_name, require_note
              ) VALUES ($1, $2, $3, $4, $5, $6)`,
              [workflowId, fromId, toId, tr.action_code, tr.action_name, tr.require_note || false],
            );
          }
        }
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    return this.getWorkflowByFeature(featureCode);
  },

  /**
   * Check whether a user is authorized to perform an action on a ticket based on workflow rules
   */
  async authorizeAction(
    featureCode: string,
    currentStatus: string,
    actionCode: string,
    user: { userId: number; role?: string; roleId?: number | null },
    entityContext: { driver_id?: number | null; created_by?: number | null; dispatcher_id?: number | null },
  ): Promise<{ authorized: boolean; reason?: string; stepName?: string }> {
    // 1. Check if workflow is active for this feature
    const wfRes = await pool.query<{ id: number; is_active: boolean }>(
      'SELECT id, is_active FROM workflows WHERE feature_code = $1',
      [featureCode],
    );

    // If workflow not found or inactive, fallback to legacy/standard check
    if (!wfRes.rows[0] || !wfRes.rows[0].is_active) {
      return { authorized: true };
    }

    const workflowId = wfRes.rows[0].id;

    // 2. Find matching step for current status
    const stepRes = await pool.query<WorkflowStep>(
      `SELECT * FROM workflow_steps
       WHERE workflow_id = $1 AND status_code = $2`,
      [workflowId, currentStatus],
    );

    if (!stepRes.rows[0]) {
      return {
        authorized: false,
        reason: `Không tìm thấy bước quy trình ứng với trạng thái "${currentStatus}"`,
      };
    }

    const step = stepRes.rows[0];

    // 3. Check if action is allowed in this step
    if (!step.allowed_actions.includes(actionCode)) {
      return {
        authorized: false,
        reason: `Hành động "${actionCode}" không được phép ở bước "${step.step_name}"`,
        stepName: step.step_name,
      };
    }

    // 4. ADMIN always has full override access
    if (user.role === 'ADMIN') {
      return { authorized: true, stepName: step.step_name };
    }

    // 5. Evaluate actor authorization
    if (step.actor_type === 'any') {
      return { authorized: true, stepName: step.step_name };
    }

    if (step.actor_type === 'dynamic') {
      if (step.dynamic_actor === 'assigned_driver') {
        const isDriver = entityContext.driver_id && entityContext.driver_id === user.userId;
        // Also allow if role is in assigned_role_ids (e.g. backup dispatcher/admin)
        const isAssignedRole = user.roleId && step.assigned_role_ids?.includes(user.roleId);
        if (isDriver || isAssignedRole) {
          return { authorized: true, stepName: step.step_name };
        }
        return {
          authorized: false,
          reason: `Chỉ tài xế được gán cho chuyến này (hoặc vai trò được ủy quyền) mới có quyền thực hiện.`,
          stepName: step.step_name,
        };
      }

      if (step.dynamic_actor === 'creator') {
        const isCreator = entityContext.created_by && entityContext.created_by === user.userId;
        const isAssignedRole = user.roleId && step.assigned_role_ids?.includes(user.roleId);
        if (isCreator || isAssignedRole) {
          return { authorized: true, stepName: step.step_name };
        }
        return {
          authorized: false,
          reason: `Chỉ người tạo chuyến (hoặc vai trò được ủy quyền) mới có quyền thực hiện.`,
          stepName: step.step_name,
        };
      }
    }

    if (step.actor_type === 'role') {
      if (user.roleId && step.assigned_role_ids?.includes(user.roleId)) {
        return { authorized: true, stepName: step.step_name };
      }
      return {
        authorized: false,
        reason: `Vai trò của bạn không được phân quyền xử lý ở bước "${step.step_name}".`,
        stepName: step.step_name,
      };
    }

    if (step.actor_type === 'user') {
      if (step.assigned_user_ids?.includes(user.userId)) {
        return { authorized: true, stepName: step.step_name };
      }
      return {
        authorized: false,
        reason: `Tài khoản của bạn không được chỉ định xử lý ở bước "${step.step_name}".`,
        stepName: step.step_name,
      };
    }

    return {
      authorized: false,
      reason: `Không đủ quyền thực hiện hành động này.`,
      stepName: step.step_name,
    };
  },

  /**
   * Determine target status_code based on workflow transitions, with fallback
   */
  async getNextStatus(
    featureCode: string,
    currentStatus: string,
    actionCode: string,
    fallbackStatus: string,
  ): Promise<string> {
    const wfRes = await pool.query<{ id: number; is_active: boolean }>(
      'SELECT id, is_active FROM workflows WHERE feature_code = $1',
      [featureCode],
    );

    if (!wfRes.rows[0] || !wfRes.rows[0].is_active) {
      return fallbackStatus;
    }

    const workflowId = wfRes.rows[0].id;

    const transRes = await pool.query<{ target_status: string }>(
      `SELECT ts.status_code as target_status
       FROM workflow_transitions t
       JOIN workflow_steps fs ON fs.id = t.from_step_id
       JOIN workflow_steps ts ON ts.id = t.to_step_id
       WHERE t.workflow_id = $1
         AND fs.status_code = $2
         AND t.action_code = $3
       LIMIT 1`,
      [workflowId, currentStatus, actionCode],
    );

    if (transRes.rows[0]?.target_status) {
      return transRes.rows[0].target_status;
    }

    return fallbackStatus;
  },

  /**
   * Bulk compute user permissions for multiple tickets in 1-2 DB queries
   */
  async attachUserPermissionsBulk(
    featureCode: string,
    tickets: DispatchSchedule[],
    user?: { userId: number; role?: string; roleId?: number | null },
  ): Promise<InvoiceTrackingTicketWithPermissions[]> {
    if (!user || tickets.length === 0) {
      return tickets.map((t) => ({ ...t }));
    }

    // 1. Fetch workflow detail & steps once
    const wfRes = await pool.query<{ id: number; is_active: boolean }>(
      'SELECT id, is_active FROM workflows WHERE feature_code = $1',
      [featureCode],
    );

    if (!wfRes.rows[0] || !wfRes.rows[0].is_active) {
      return tickets.map((t) => ({
        ...t,
        user_permissions: {
          can_upload: t.invoice_status === 'created' || t.invoice_status === 'request_supplement',
          can_finish: t.invoice_status === 'pending_review',
          can_request_supplement: t.invoice_status === 'pending_review',
        },
      }));
    }

    const workflowId = wfRes.rows[0].id;
    const stepsRes = await pool.query<WorkflowStep>(
      'SELECT * FROM workflow_steps WHERE workflow_id = $1',
      [workflowId],
    );
    const stepMap = new Map<string, WorkflowStep>();
    for (const st of stepsRes.rows) {
      stepMap.set(st.status_code, st);
    }

    // 2. Evaluate in memory for all tickets
    return tickets.map((ticket) => {
      const step = stepMap.get(ticket.invoice_status);
      if (!step) {
        return {
          ...ticket,
          user_permissions: {
            can_upload: false,
            can_finish: false,
            can_request_supplement: false,
          },
        };
      }

      const evalAction = (actionCode: string): boolean => {
        if (!step.allowed_actions.includes(actionCode)) return false;
        if (user.role === 'ADMIN') return true;
        if (step.actor_type === 'any') return true;

        if (step.actor_type === 'dynamic') {
          if (step.dynamic_actor === 'assigned_driver') {
            const isDriver = ticket.driver_id && ticket.driver_id === user.userId;
            const isRole = user.roleId && step.assigned_role_ids?.includes(user.roleId);
            return !!(isDriver || isRole);
          }
          if (step.dynamic_actor === 'creator') {
            const isCreator = ticket.created_by && ticket.created_by === user.userId;
            const isRole = user.roleId && step.assigned_role_ids?.includes(user.roleId);
            return !!(isCreator || isRole);
          }
        }

        if (step.actor_type === 'role') {
          return !!(user.roleId && step.assigned_role_ids?.includes(user.roleId));
        }

        if (step.actor_type === 'user') {
          return !!(step.assigned_user_ids?.includes(user.userId));
        }

        return false;
      };

      return {
        ...ticket,
        user_permissions: {
          can_upload: evalAction('upload_document'),
          can_finish: evalAction('review_finish'),
          can_request_supplement: evalAction('request_supplement'),
          current_step_name: step.step_name,
        },
      };
    });
  },
  async getUserTicketPermissions(
    featureCode: string,
    currentStatus: string,
    user: { userId: number; role?: string; roleId?: number | null },
    entityContext: { driver_id?: number | null; created_by?: number | null; dispatcher_id?: number | null },
  ): Promise<UserTicketPermissions> {
    const uploadAuth = await this.authorizeAction(featureCode, currentStatus, 'upload_document', user, entityContext);
    const finishAuth = await this.authorizeAction(featureCode, currentStatus, 'review_finish', user, entityContext);
    const reqAuth = await this.authorizeAction(featureCode, currentStatus, 'request_supplement', user, entityContext);

    return {
      can_upload: uploadAuth.authorized,
      can_finish: finishAuth.authorized,
      can_request_supplement: reqAuth.authorized,
      current_step_name: uploadAuth.stepName || finishAuth.stepName || reqAuth.stepName,
    };
  },
};
