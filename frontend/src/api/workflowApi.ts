import axiosClient from './axiosClient';

export type ActorType = 'role' | 'user' | 'dynamic' | 'any';
export type DynamicActor = 'assigned_driver' | 'creator' | 'dispatcher';

export interface WorkflowItem {
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

export interface WorkflowStepItem {
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

export interface WorkflowTransitionItem {
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

export interface WorkflowDetailData extends WorkflowItem {
  steps: WorkflowStepItem[];
  transitions: WorkflowTransitionItem[];
}

export const workflowApi = {
  async list(): Promise<WorkflowItem[]> {
    const res = await axiosClient.get('/workflows');
    return res.data.data;
  },

  async getByFeature(featureCode: string): Promise<WorkflowDetailData> {
    const res = await axiosClient.get(`/workflows/${featureCode}`);
    return res.data.data;
  },

  async toggleActive(featureCode: string, is_active: boolean): Promise<WorkflowItem> {
    const res = await axiosClient.patch(`/workflows/${featureCode}/toggle`, { is_active });
    return res.data.data;
  },

  async saveConfig(
    featureCode: string,
    payload: {
      name?: string;
      description?: string;
      steps: Omit<WorkflowStepItem, 'id' | 'workflow_id' | 'role_names' | 'user_names'>[];
      transitions?: {
        from_step_code: string;
        to_step_code: string;
        action_code: string;
        action_name: string;
        require_note?: boolean;
      }[];
    },
  ): Promise<WorkflowDetailData> {
    const res = await axiosClient.put(`/workflows/${featureCode}`, payload);
    return res.data.data;
  },
};
