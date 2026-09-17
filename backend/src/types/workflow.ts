export type ActorType = 'role' | 'user' | 'dynamic' | 'any';
export type DynamicActor = 'assigned_driver' | 'creator' | 'dispatcher';

export interface Workflow {
  id: number;
  feature_code: string;
  name: string;
  description: string | null;
  module: string;
  is_active: boolean;
  step_count?: number;
  created_at: string;
  updated_at: string;
}

export interface WorkflowStep {
  id?: number;
  workflow_id?: number;
  step_order: number;
  step_code: string;
  step_name: string;
  status_code: string;
  allowed_actions: string[];
  actor_type: ActorType;
  assigned_role_ids: number[];
  assigned_user_ids: number[];
  dynamic_actor: DynamicActor | null;
  is_initial: boolean;
  is_final: boolean;
  role_names?: string[];
  user_names?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface WorkflowTransition {
  id?: number;
  workflow_id?: number;
  from_step_id?: number;
  to_step_id?: number;
  from_step_code?: string;
  to_step_code?: string;
  action_code: string;
  action_name: string;
  require_note: boolean;
  created_at?: string;
}

export interface WorkflowDetail extends Workflow {
  steps: WorkflowStep[];
  transitions: WorkflowTransition[];
}

export interface UserTicketPermissions {
  can_upload: boolean;
  can_finish: boolean;
  can_request_supplement: boolean;
  current_step_name?: string;
  assignee_description?: string;
}
