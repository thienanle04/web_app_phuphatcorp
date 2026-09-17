import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workflowApi, type WorkflowStepItem } from '../api/workflowApi';

export const WORKFLOWS_KEY = ['workflows'];
export const workflowDetailKey = (featureCode: string) => ['workflows', featureCode];

export function useWorkflows() {
  return useQuery({
    queryKey: WORKFLOWS_KEY,
    queryFn: () => workflowApi.list(),
  });
}

export function useWorkflowDetail(featureCode: string) {
  return useQuery({
    queryKey: workflowDetailKey(featureCode),
    queryFn: () => workflowApi.getByFeature(featureCode),
    enabled: !!featureCode,
  });
}

export function useToggleWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ featureCode, isActive }: { featureCode: string; isActive: boolean }) =>
      workflowApi.toggleActive(featureCode, isActive),
    onSuccess: (_, { featureCode }) => {
      queryClient.invalidateQueries({ queryKey: WORKFLOWS_KEY });
      queryClient.invalidateQueries({ queryKey: workflowDetailKey(featureCode) });
    },
  });
}

export function useSaveWorkflowConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      featureCode,
      payload,
    }: {
      featureCode: string;
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
      };
    }) => workflowApi.saveConfig(featureCode, payload),
    onSuccess: (_, { featureCode }) => {
      queryClient.invalidateQueries({ queryKey: WORKFLOWS_KEY });
      queryClient.invalidateQueries({ queryKey: workflowDetailKey(featureCode) });
    },
  });
}
