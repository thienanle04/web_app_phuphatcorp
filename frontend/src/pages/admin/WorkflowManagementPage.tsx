import React, { useState } from 'react';
import { useWorkflows, useToggleWorkflow } from '../../hooks/useWorkflows';
import { useAuth } from '../../hooks/useAuth';
import { useI18n } from '../../i18n/useI18n';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { GitMerge, Settings2, RefreshCw, CheckCircle2, XCircle, Layers } from 'lucide-react';
import { WorkflowStepBuilderModal } from '../../components/admin/workflows/WorkflowStepBuilderModal';
import type { WorkflowItem } from '../../api/workflowApi';

export function WorkflowManagementPage() {
  const { t } = useI18n();
  const { hasPermission } = useAuth();
  const { data: workflows = [], isLoading, isError, refetch } = useWorkflows();
  const toggleWorkflowMutation = useToggleWorkflow();

  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowItem | null>(null);

  const canManage = hasPermission('workflows.manage');

  const handleToggle = async (wf: WorkflowItem, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await toggleWorkflowMutation.mutateAsync({
        featureCode: wf.feature_code,
        isActive: !wf.is_active,
      });
    } catch {
      // handled
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2.5">
            <GitMerge className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            {t('workflows.title' as never) || 'Cấu hình quy trình'}
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Định nghĩa các bước tuần tự và phân quyền thực hiện theo từng bước cho các tính năng hệ thống.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
            className="min-h-[38px]"
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Làm mới
          </Button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-44 rounded-xl bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-neutral-500 mb-3">Không thể tải danh sách quy trình.</p>
            <Button variant="outline" onClick={() => refetch()}>
              Thử lại
            </Button>
          </CardContent>
        </Card>
      ) : workflows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-neutral-500">
            Chưa có quy trình nào được khai báo.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {workflows.map((wf) => (
            <Card
              key={wf.id}
              className={`border transition-all duration-200 hover:shadow-md ${
                wf.is_active
                  ? 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900'
                  : 'border-neutral-200/60 dark:border-neutral-800/60 bg-neutral-50/50 dark:bg-neutral-900/40 opacity-80'
              }`}
            >
              <CardContent className="p-5 sm:p-6 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-base sm:text-lg text-neutral-900 dark:text-neutral-100">
                        {wf.name}
                      </h3>
                    </div>
                    <p className="text-xs font-mono text-neutral-500 dark:text-neutral-400">
                      Mã: {wf.feature_code} • Phân hệ: {wf.module}
                    </p>
                  </div>

                  <Badge variant={wf.is_active ? 'success' : 'default'} className="shrink-0">
                    {wf.is_active ? (
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Đang áp dụng
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <XCircle className="w-3 h-3" /> Tạm dừng
                      </span>
                    )}
                  </Badge>
                </div>

                <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2">
                  {wf.description || 'Chưa có mô tả chi tiết cho quy trình này.'}
                </p>

                <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-neutral-500 font-medium">
                    <Layers className="w-4 h-4 text-neutral-400" />
                    <span>{wf.step_count || 0} bước xử lý</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {canManage && (
                      <button
                        onClick={(e) => handleToggle(wf, e)}
                        className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-colors ${
                          wf.is_active
                            ? 'border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300'
                            : 'border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300'
                        }`}
                      >
                        {wf.is_active ? 'Tắt quy trình' : 'Bật quy trình'}
                      </button>
                    )}

                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => setSelectedWorkflow(wf)}
                      className="h-8 text-xs font-medium"
                    >
                      <Settings2 className="w-3.5 h-3.5 mr-1" />
                      Cấu hình bước
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Workflow Step Builder Modal */}
      {selectedWorkflow && (
        <WorkflowStepBuilderModal
          isOpen={!!selectedWorkflow}
          onClose={() => setSelectedWorkflow(null)}
          featureCode={selectedWorkflow.feature_code}
          workflowName={selectedWorkflow.name}
          canManage={canManage}
        />
      )}
    </div>
  );
}
