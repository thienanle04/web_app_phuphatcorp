import React, { useState } from 'react';
import {
  useFeatureScopes,
  useUpdateRoleScope,
  useUserEntityScopes,
  useAssignUserEntities,
  useRemoveUserEntity,
} from '../../hooks/useDataScopes';
import { RoleScopeMatrix } from '../../components/admin/data-scope/RoleScopeMatrix';
import { UserEntityScopeList } from '../../components/admin/data-scope/UserEntityScopeList';
import { AssignEntityModal } from '../../components/admin/data-scope/AssignEntityModal';
import { Button } from '../../components/ui/Button';
import { Shield, Plus, RefreshCw } from 'lucide-react';
import { useI18n } from '../../i18n/useI18n';
import type { ScopeType } from '../../types/user';

export function DataScopeManagementPage() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<'matrix' | 'user_entities'>('matrix');
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

  const {
    data: features = [],
    isLoading: isFeaturesLoading,
    refetch: refetchFeatures,
  } = useFeatureScopes();

  const updateRoleScopeMutation = useUpdateRoleScope();

  const {
    data: userEntities = [],
    isLoading: isEntitiesLoading,
    refetch: refetchEntities,
  } = useUserEntityScopes();

  const assignEntitiesMutation = useAssignUserEntities();
  const removeEntityMutation = useRemoveUserEntity();

  const handleSaveMatrix = async (
    updates: { featureCode: string; roleId: number; scopeType: ScopeType }[],
  ) => {
    for (const update of updates) {
      await updateRoleScopeMutation.mutateAsync(update);
    }
  };

  const handleAssignSubmit = async (data: {
    user_id: number;
    feature_code: string;
    entity_type: string;
    entity_ids: number[];
  }) => {
    await assignEntitiesMutation.mutateAsync(data);
  };

  const handleDeleteEntity = async (id: number) => {
    const confirmMsg =
      t('data_scopes.messages.delete_confirm' as never) ||
      'Bạn có chắc muốn xóa phân quyền đối tượng này không?';
    if (window.confirm(confirmMsg)) {
      await removeEntityMutation.mutateAsync(id);
    }
  };

  const isLoading = isFeaturesLoading || isEntitiesLoading;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white flex items-center gap-2.5">
            <Shield className="w-7 h-7 text-neutral-700 dark:text-neutral-300" />
            {t('data_scopes.title' as never) || 'Quản lý phạm vi dữ liệu'}
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Cấu hình quyền hiển thị và truy cập dữ liệu chi tiết theo từng vai trò và người dùng.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchFeatures();
              refetchEntities();
            }}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Làm mới
          </Button>

          {activeTab === 'user_entities' && (
            <Button size="sm" onClick={() => setIsAssignModalOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" />
              {t('data_scopes.actions.assign_entity' as never) || 'Gán đối tượng'}
            </Button>
          )}
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-neutral-200 dark:border-neutral-800">
        <button
          onClick={() => setActiveTab('matrix')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-2 ${
            activeTab === 'matrix'
              ? 'border-neutral-900 dark:border-white text-neutral-900 dark:text-white'
              : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200'
          }`}
        >
          <span>{t('data_scopes.tabs.matrix' as never) || 'Ma trận vai trò'}</span>
          <span className="px-1.5 py-0.5 rounded-full text-xs bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
            {features.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('user_entities')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-2 ${
            activeTab === 'user_entities'
              ? 'border-neutral-900 dark:border-white text-neutral-900 dark:text-white'
              : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200'
          }`}
        >
          <span>{t('data_scopes.tabs.user_entities' as never) || 'Gán đối tượng người dùng'}</span>
          <span className="px-1.5 py-0.5 rounded-full text-xs bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
            {userEntities.length}
          </span>
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'matrix' ? (
        <RoleScopeMatrix
          features={features}
          onSave={handleSaveMatrix}
          isSaving={updateRoleScopeMutation.isPending}
        />
      ) : (
        <UserEntityScopeList
          items={userEntities}
          onDelete={handleDeleteEntity}
          isDeleting={removeEntityMutation.isPending}
        />
      )}

      {/* Assign Modal */}
      <AssignEntityModal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        features={features}
        onSubmit={handleAssignSubmit}
        isSubmitting={assignEntitiesMutation.isPending}
      />
    </div>
  );
}
