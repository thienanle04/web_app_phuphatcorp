import React, { useState, useEffect } from 'react';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Select } from '../../ui/Select';
import { Badge } from '../../ui/Badge';
import {
  useWorkflowDetail,
  useSaveWorkflowConfig,
} from '../../../hooks/useWorkflows';
import { useRoles } from '../../../hooks/useRoles';
import { useQuery } from '@tanstack/react-query';
import axiosClient from '../../../api/axiosClient';
import type { ApiResponse } from '../../../types/api';
import type { WorkflowStepItem, WorkflowTransitionItem, ActorType, DynamicActor } from '../../../api/workflowApi';
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Layers,
  Shield,
  UserCheck,
  Info,
  GitBranch,
  CornerDownLeft,
  ArrowRight,
} from 'lucide-react';

interface WorkflowStepBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureCode: string;
  workflowName: string;
  canManage: boolean;
}

interface SimpleUser {
  id: number;
  username: string;
  full_name: string;
  role_name?: string;
}

const ACTION_OPTIONS = [
  { value: 'upload_document', label: 'Tải chứng từ (Upload)' },
  { value: 'review_finish', label: 'Duyệt hoàn thành (Finish)' },
  { value: 'request_supplement', label: 'Yêu cầu bổ sung / Trả lại (Request Supplement / Return)' },
];

const DYNAMIC_ACTOR_OPTIONS = [
  { value: 'assigned_driver', label: 'Tài xế được gán cho chuyến (Assigned Driver)' },
  { value: 'creator', label: 'Người tạo phiếu (Creator)' },
  { value: 'dispatcher', label: 'Người điều phối đã xử lý (Dispatcher)' },
];

export function WorkflowStepBuilderModal({
  isOpen,
  onClose,
  featureCode,
  workflowName,
  canManage,
}: WorkflowStepBuilderModalProps) {
  const { data: workflowDetail, isLoading } = useWorkflowDetail(featureCode);
  const { data: roles = [] } = useRoles();
  const saveMutation = useSaveWorkflowConfig();

  const [activeTab, setActiveTab] = useState<'steps' | 'transitions'>('steps');
  const [steps, setSteps] = useState<WorkflowStepItem[]>([]);
  const [transitions, setTransitions] = useState<WorkflowTransitionItem[]>([]);
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  // Fetch users for assignment
  const { data: users = [] } = useQuery({
    queryKey: ['users', 'all-simple'],
    queryFn: async () => {
      const res = await axiosClient.get<ApiResponse<{ users: SimpleUser[] }>>('/users?limit=100');
      return res.data.data.users || [];
    },
    enabled: isOpen,
  });

  useEffect(() => {
    if (isOpen && workflowDetail) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSteps(workflowDetail.steps || []);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTransitions(workflowDetail.transitions || []);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveStepIndex(0);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError(null);
    }
  }, [isOpen, workflowDetail]);

  const activeStep = steps[activeStepIndex];

  const handleAddStep = () => {
    const newStepNumber = steps.length + 1;
    const newStep: WorkflowStepItem = {
      step_order: newStepNumber,
      step_code: `STEP_${newStepNumber}`,
      step_name: `Bước ${newStepNumber}`,
      status_code: `status_${newStepNumber}`,
      allowed_actions: ['upload_document'],
      actor_type: 'role',
      assigned_role_ids: [],
      assigned_user_ids: [],
      dynamic_actor: null,
      is_initial: steps.length === 0,
      is_final: false,
    };
    setSteps([...steps, newStep]);
    setActiveStepIndex(steps.length);
  };

  const handleRemoveStep = (indexToRemove: number) => {
    if (steps.length <= 1) {
      setError('Quy trình phải có ít nhất 1 bước.');
      return;
    }
    const removedCode = steps[indexToRemove].step_code;
    const updated = steps
      .filter((_, i) => i !== indexToRemove)
      .map((st, i) => ({ ...st, step_order: i + 1 }));
    
    // Also remove any transitions referencing this step
    setTransitions((prev) =>
      prev.filter(
        (t) => t.from_step_code !== removedCode && t.to_step_code !== removedCode,
      ),
    );
    setSteps(updated);
    setActiveStepIndex(Math.max(0, indexToRemove - 1));
  };

  const handleMoveStep = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === steps.length - 1)
    ) {
      return;
    }
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const newSteps = [...steps];
    const temp = newSteps[index];
    newSteps[index] = newSteps[targetIndex];
    newSteps[targetIndex] = temp;

    const reordered = newSteps.map((st, i) => ({ ...st, step_order: i + 1 }));
    setSteps(reordered);
    setActiveStepIndex(targetIndex);
  };

  const updateActiveStep = (partial: Partial<WorkflowStepItem>) => {
    const oldCode = activeStep?.step_code;
    setSteps((prev) =>
      prev.map((s, i) => (i === activeStepIndex ? { ...s, ...partial } : s)),
    );

    // If step_code changed, update transitions referencing it
    if (partial.step_code && oldCode && partial.step_code !== oldCode) {
      setTransitions((prev) =>
        prev.map((t) => ({
          ...t,
          from_step_code: t.from_step_code === oldCode ? partial.step_code! : t.from_step_code,
          to_step_code: t.to_step_code === oldCode ? partial.step_code! : t.to_step_code,
        })),
      );
    }
  };

  const handleToggleRole = (roleId: number) => {
    if (!activeStep) return;
    const currentRoles = activeStep.assigned_role_ids || [];
    const nextRoles = currentRoles.includes(roleId)
      ? currentRoles.filter((id) => id !== roleId)
      : [...currentRoles, roleId];
    updateActiveStep({ assigned_role_ids: nextRoles });
  };

  const handleToggleUser = (userId: number) => {
    if (!activeStep) return;
    const currentUsers = activeStep.assigned_user_ids || [];
    const nextUsers = currentUsers.includes(userId)
      ? currentUsers.filter((id) => id !== userId)
      : [...currentUsers, userId];
    updateActiveStep({ assigned_user_ids: nextUsers });
  };

  const handleToggleAction = (actionCode: string) => {
    if (!activeStep) return;
    const currentActions = activeStep.allowed_actions || [];
    const nextActions = currentActions.includes(actionCode)
      ? currentActions.filter((a) => a !== actionCode)
      : [...currentActions, actionCode];
    updateActiveStep({ allowed_actions: nextActions });
  };

  // Transitions Management
  const handleAddTransition = () => {
    if (steps.length < 2) {
      setError('Cần có ít nhất 2 bước để thiết lập luồng chuyển tiếp.');
      return;
    }
    const fromCode = activeStep?.step_code || steps[0].step_code;
    const otherSteps = steps.filter((s) => s.step_code !== fromCode);
    const toCode = otherSteps[0]?.step_code || steps[0].step_code;

    const newTr: WorkflowTransitionItem = {
      from_step_code: fromCode,
      to_step_code: toCode,
      action_code: 'review_finish',
      action_name: 'Duyệt chuyển bước',
      require_note: false,
    };
    setTransitions([...transitions, newTr]);
  };

  const handleUpdateTransition = (index: number, partial: Partial<WorkflowTransitionItem>) => {
    setTransitions((prev) =>
      prev.map((t, i) => (i === index ? { ...t, ...partial } : t)),
    );
  };

  const handleRemoveTransition = (index: number) => {
    setTransitions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setError(null);
    if (steps.length === 0) {
      setError('Vui lòng thêm ít nhất 1 bước vào quy trình');
      return;
    }

    // Validate unique step codes
    const stepCodes = steps.map((s) => s.step_code.trim());
    if (new Set(stepCodes).size !== stepCodes.length) {
      setError('Mã bước (step_code) không được trùng lặp.');
      return;
    }

    try {
      await saveMutation.mutateAsync({
        featureCode,
        payload: {
          steps: steps.map((st, idx) => ({
            step_order: idx + 1,
            step_code: st.step_code.trim(),
            step_name: st.step_name.trim(),
            status_code: st.status_code.trim(),
            allowed_actions: st.allowed_actions,
            actor_type: st.actor_type,
            assigned_role_ids: st.assigned_role_ids || [],
            assigned_user_ids: st.assigned_user_ids || [],
            dynamic_actor: st.dynamic_actor || null,
            is_initial: st.is_initial || false,
            is_final: st.is_final || false,
          })),
          transitions: transitions
            .filter((t) => t.from_step_code && t.to_step_code)
            .map((t) => ({
              from_step_code: t.from_step_code!,
              to_step_code: t.to_step_code!,
              action_code: t.action_code.trim(),
              action_name: t.action_name.trim() || 'Thao tác',
              require_note: !!t.require_note,
            })),
        },
      });
      onClose();
    } catch (err: unknown) {
      const errorMsg = (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message
        || (err as Error)?.message
        || 'Lỗi khi lưu quy trình';
      setError(errorMsg);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Cấu hình quy trình: ${workflowName}`}
      size="2/3"
    >
      <div className="space-y-4 max-h-[82vh] flex flex-col">
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs rounded-lg">
            {error}
          </div>
        )}

        {/* Top Tabs */}
        <div className="flex border-b border-neutral-200 dark:border-neutral-800">
          <button
            onClick={() => setActiveTab('steps')}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors -mb-px flex items-center gap-1.5 ${
              activeTab === 'steps'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:text-neutral-400'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Cấu hình các bước ({steps.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('transitions')}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors -mb-px flex items-center gap-1.5 ${
              activeTab === 'transitions'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:text-neutral-400'
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span>Luồng chuyển tiếp / Quay lại bước trước ({transitions.length})</span>
          </button>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-neutral-400">Đang tải cấu hình...</div>
        ) : activeTab === 'steps' ? (
          /* TAB 1: STEPS CONFIGURATION */
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 flex-1 overflow-hidden">
            {/* Left: Steps List & Re-order */}
            <div className="md:col-span-5 border border-neutral-200 dark:border-neutral-800 rounded-xl p-3 bg-neutral-50/50 dark:bg-neutral-900/50 flex flex-col">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-neutral-200 dark:border-neutral-800">
                <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-indigo-500" />
                  Danh sách bước ({steps.length})
                </span>
                {canManage && (
                  <Button size="sm" variant="ghost" onClick={handleAddStep} className="h-7 text-xs px-2">
                    <Plus className="w-3.5 h-3.5 mr-1" /> Thêm bước
                  </Button>
                )}
              </div>

              <div className="space-y-1.5 overflow-y-auto flex-1 pr-1 max-h-[420px]">
                {steps.map((st, idx) => {
                  const isSelected = idx === activeStepIndex;
                  return (
                    <div
                      key={idx}
                      onClick={() => setActiveStepIndex(idx)}
                      className={`group p-2.5 rounded-lg border text-xs cursor-pointer transition-all flex items-center justify-between ${
                        isSelected
                          ? 'bg-white dark:bg-neutral-800 border-indigo-500 shadow-xs'
                          : 'bg-white/60 dark:bg-neutral-800/40 border-neutral-200 dark:border-neutral-800 hover:bg-white dark:hover:bg-neutral-800'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-5 h-5 rounded-full bg-neutral-100 dark:bg-neutral-700 flex items-center justify-center font-bold text-[10px] text-neutral-600 dark:text-neutral-300 shrink-0">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                            {st.step_name}
                          </p>
                          <p className="text-[10px] font-mono text-neutral-400 truncate">
                            {st.status_code}
                          </p>
                        </div>
                      </div>

                      {canManage && (
                        <div className="flex items-center gap-0.5 opacity-80 group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMoveStep(idx, 'up');
                            }}
                            disabled={idx === 0}
                            className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 disabled:opacity-30"
                            title="Di chuyển lên"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMoveStep(idx, 'down');
                            }}
                            disabled={idx === steps.length - 1}
                            className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 disabled:opacity-30"
                            title="Di chuyển xuống"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveStep(idx);
                            }}
                            className="p-1 text-red-400 hover:text-red-600 dark:hover:text-red-300 ml-1"
                            title="Xóa bước"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Step Editor Form */}
            <div className="md:col-span-7 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 bg-white dark:bg-neutral-900 overflow-y-auto max-h-[460px] space-y-4">
              {activeStep ? (
                <>
                  <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-neutral-800">
                    <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                      <span>Cấu hình chi tiết: Bước {activeStepIndex + 1}</span>
                    </h4>
                    <div className="flex items-center gap-2">
                      {activeStep.is_initial && <Badge variant="info">Khởi đầu</Badge>}
                      {activeStep.is_final && <Badge variant="success">Kết thúc</Badge>}
                    </div>
                  </div>

                  {/* Basic Step Meta */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                        Tên bước <span className="text-red-500">*</span>
                      </label>
                      <Input
                        value={activeStep.step_name}
                        onChange={(e) => updateActiveStep({ step_name: e.target.value })}
                        disabled={!canManage}
                        className="text-xs h-8"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                        Mã bước (step_code) <span className="text-red-500">*</span>
                      </label>
                      <Input
                        value={activeStep.step_code}
                        onChange={(e) => updateActiveStep({ step_code: e.target.value })}
                        disabled={!canManage}
                        className="text-xs h-8 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                        Mã trạng thái dữ liệu (status_code) <span className="text-red-500">*</span>
                      </label>
                      <Input
                        value={activeStep.status_code}
                        onChange={(e) => updateActiveStep({ status_code: e.target.value })}
                        disabled={!canManage}
                        className="text-xs h-8 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                        Loại đối tượng phụ trách (Actor Type)
                      </label>
                      <Select
                        value={activeStep.actor_type}
                        onChange={(e) =>
                          updateActiveStep({ actor_type: e.target.value as ActorType })
                        }
                        disabled={!canManage}
                        options={[
                          { value: 'dynamic', label: 'Đối tượng động (Dynamic Actor)' },
                          { value: 'role', label: 'Theo Vai trò (Role-based)' },
                          { value: 'user', label: 'Chỉ định Người dùng (User-based)' },
                          { value: 'any', label: 'Tất cả mọi người (Any authenticated)' },
                        ]}
                        className="text-xs h-8"
                      />
                    </div>
                  </div>

                  {/* Dynamic Actor Selection */}
                  {activeStep.actor_type === 'dynamic' && (
                    <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-lg space-y-2">
                      <label className="block text-xs font-semibold text-amber-900 dark:text-amber-300">
                        Đối tượng động phụ trách bước này:
                      </label>
                      <Select
                        value={activeStep.dynamic_actor || ''}
                        onChange={(e) =>
                          updateActiveStep({ dynamic_actor: (e.target.value || null) as DynamicActor })
                        }
                        disabled={!canManage}
                        options={DYNAMIC_ACTOR_OPTIONS}
                        className="text-xs h-8 bg-white dark:bg-neutral-900"
                      />
                      <p className="text-[11px] text-amber-700 dark:text-amber-400">
                        Hệ thống sẽ tự động đối chiếu ID của người dùng đăng nhập với trường tương ứng trên chuyến xe.
                      </p>
                    </div>
                  )}

                  {/* Role Assignment (Multi-select) */}
                  {(activeStep.actor_type === 'role' || activeStep.actor_type === 'dynamic') && (
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <Shield className="w-3.5 h-3.5 text-indigo-500" />
                          {activeStep.actor_type === 'dynamic'
                            ? 'Vai trò dự phòng / được ủy quyền thao tác cùng:'
                            : 'Các vai trò được phép thao tác ở bước này:'}
                        </span>
                      </label>
                      <div className="grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto border border-neutral-200 dark:border-neutral-800 rounded-lg p-2 bg-neutral-50 dark:bg-neutral-900/40">
                        {roles.map((r) => {
                          const isChecked = activeStep.assigned_role_ids?.includes(r.id);
                          return (
                            <label
                              key={r.id}
                              className={`flex items-center gap-2 p-1.5 rounded cursor-pointer text-xs transition-colors ${
                                isChecked
                                  ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 font-medium'
                                  : 'hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleRole(r.id)}
                                disabled={!canManage}
                                className="rounded text-indigo-600 focus:ring-indigo-500"
                              />
                              <span className="truncate">{r.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* User Assignment (Multi-select) */}
                  {activeStep.actor_type === 'user' && (
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
                        <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                        Chỉ định người dùng cụ thể:
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto border border-neutral-200 dark:border-neutral-800 rounded-lg p-2 bg-neutral-50 dark:bg-neutral-900/40">
                        {users.map((u) => {
                          const isChecked = activeStep.assigned_user_ids?.includes(u.id);
                          return (
                            <label
                              key={u.id}
                              className={`flex items-center gap-2 p-1.5 rounded cursor-pointer text-xs transition-colors ${
                                isChecked
                                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-medium'
                                  : 'hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleUser(u.id)}
                                disabled={!canManage}
                                className="rounded text-emerald-600 focus:ring-emerald-500"
                              />
                              <span className="truncate">{u.full_name || u.username}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Allowed Actions */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                      Hành động được phép thực hiện ở bước này:
                    </label>
                    <div className="space-y-1 border border-neutral-200 dark:border-neutral-800 rounded-lg p-2 bg-neutral-50 dark:bg-neutral-900/40">
                      {ACTION_OPTIONS.map((act) => {
                        const isChecked = activeStep.allowed_actions?.includes(act.value);
                        return (
                          <label
                            key={act.value}
                            className={`flex items-center gap-2 p-1.5 rounded cursor-pointer text-xs transition-colors ${
                              isChecked
                                ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 font-medium'
                                : 'hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleAction(act.value)}
                              disabled={!canManage}
                              className="rounded text-blue-600 focus:ring-blue-500"
                            />
                            <span>{act.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-12 text-center text-neutral-400 text-xs">
                  Chọn một bước bên trái để chỉnh sửa cấu hình
                </div>
              )}
            </div>
          </div>
        ) : (
          /* TAB 2: TRANSITIONS MATRIX & ROLLBACK CONFIGURATION */
          <div className="space-y-3 overflow-y-auto max-h-[460px] p-1">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-200 dark:border-neutral-800">
              <div>
                <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                  <GitBranch className="w-4 h-4 text-indigo-500" />
                  Định nghĩa các luồng chuyển bước (Tiến bước / Quay lại bước trước)
                </h4>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  Cho phép chuyển tiếp hoặc trả ngược ticket về bất kỳ bước nào trong danh sách.
                </p>
              </div>

              {canManage && (
                <Button size="sm" onClick={handleAddTransition} className="h-8 text-xs font-medium">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Thêm luồng chuyển tiếp
                </Button>
              )}
            </div>

            {transitions.length === 0 ? (
              <div className="py-12 text-center text-neutral-400 text-xs">
                Chưa có luồng chuyển bước nào được thiết lập.
              </div>
            ) : (
              <div className="space-y-2">
                {transitions.map((tr, tIdx) => {
                  const fromStep = steps.find((s) => s.step_code === tr.from_step_code);
                  const toStep = steps.find((s) => s.step_code === tr.to_step_code);
                  const isRollback = (fromStep?.step_order || 0) > (toStep?.step_order || 0);

                  return (
                    <div
                      key={tIdx}
                      className={`p-3 rounded-xl border text-xs grid grid-cols-1 md:grid-cols-12 gap-3 items-center transition-all ${
                        isRollback
                          ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50'
                          : 'bg-white dark:bg-neutral-800/60 border-neutral-200 dark:border-neutral-800'
                      }`}
                    >
                      {/* From Step */}
                      <div className="md:col-span-3">
                        <label className="block text-[10px] font-semibold text-neutral-500 mb-1">
                          Từ bước nguồn:
                        </label>
                        <Select
                          value={tr.from_step_code || ''}
                          onChange={(e) =>
                            handleUpdateTransition(tIdx, { from_step_code: e.target.value })
                          }
                          disabled={!canManage}
                          options={steps.map((s) => ({
                            value: s.step_code,
                            label: `${s.step_order}. ${s.step_name}`,
                          }))}
                          className="text-xs h-8"
                        />
                      </div>

                      {/* Direction Icon & Action Name */}
                      <div className="md:col-span-3">
                        <label className="block text-[10px] font-semibold text-neutral-500 mb-1 flex items-center gap-1">
                          {isRollback ? (
                            <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                              <CornerDownLeft className="w-3 h-3" /> Quay lại (Rollback)
                            </span>
                          ) : (
                            <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                              <ArrowRight className="w-3 h-3" /> Tiến bước
                            </span>
                          )}
                        </label>
                        <Input
                          value={tr.action_name}
                          onChange={(e) =>
                            handleUpdateTransition(tIdx, { action_name: e.target.value })
                          }
                          disabled={!canManage}
                          placeholder="Tên hành động..."
                          className="text-xs h-8 font-medium"
                        />
                      </div>

                      {/* To Step */}
                      <div className="md:col-span-3">
                        <label className="block text-[10px] font-semibold text-neutral-500 mb-1">
                          Chuyển đến bước đích:
                        </label>
                        <Select
                          value={tr.to_step_code || ''}
                          onChange={(e) =>
                            handleUpdateTransition(tIdx, { to_step_code: e.target.value })
                          }
                          disabled={!canManage}
                          options={steps.map((s) => ({
                            value: s.step_code,
                            label: `${s.step_order}. ${s.step_name}`,
                          }))}
                          className="text-xs h-8"
                        />
                      </div>

                      {/* Options & Delete */}
                      <div className="md:col-span-3 flex items-center justify-between pt-2 md:pt-4">
                        <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-neutral-700 dark:text-neutral-300">
                          <input
                            type="checkbox"
                            checked={tr.require_note}
                            onChange={(e) =>
                              handleUpdateTransition(tIdx, { require_note: e.target.checked })
                            }
                            disabled={!canManage}
                            className="rounded text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>Bắt buộc ghi chú</span>
                        </label>

                        {canManage && (
                          <button
                            type="button"
                            onClick={() => handleRemoveTransition(tIdx)}
                            className="p-1 text-red-400 hover:text-red-600 dark:hover:text-red-300"
                            title="Xóa luồng chuyển tiếp"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-1 text-[11px] text-neutral-400">
            <Info className="w-3.5 h-3.5 shrink-0" />
            <span>Quản trị viên (ADMIN) luôn có toàn quyền ghi đè tất cả các bước.</span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose} disabled={saveMutation.isPending}>
              Đóng
            </Button>
            {canManage && (
              <Button onClick={handleSave} isLoading={saveMutation.isPending}>
                Lưu cấu hình quy trình
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
