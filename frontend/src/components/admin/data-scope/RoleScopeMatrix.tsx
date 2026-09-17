import React, { useState } from 'react';
import type { FeatureWithRoleConfigs, ScopeType } from '../../../types/user';
import { DataScopeBadge } from './DataScopeBadge';
import { Button } from '../../ui/Button';
import { useI18n } from '../../../i18n/useI18n';
import { Shield, Save, RotateCcw, AlertCircle } from 'lucide-react';

interface RoleScopeMatrixProps {
  features: FeatureWithRoleConfigs[];
  onSave: (updates: { featureCode: string; roleId: number; scopeType: ScopeType }[]) => Promise<void>;
  isSaving: boolean;
}

export const RoleScopeMatrix: React.FC<RoleScopeMatrixProps> = ({
  features,
  onSave,
  isSaving,
}) => {
  const { t } = useI18n();
  // Dirty state tracker: key = `${featureCode}:${roleId}`, value = scopeType
  const [dirtyConfigs, setDirtyConfigs] = useState<Record<string, ScopeType>>({});

  const handleScopeChange = (featureCode: string, roleId: number, scopeType: ScopeType) => {
    setDirtyConfigs((prev) => ({
      ...prev,
      [`${featureCode}:${roleId}`]: scopeType,
    }));
  };

  const handleReset = () => {
    setDirtyConfigs({});
  };

  const handleSave = async () => {
    const updates = Object.entries(dirtyConfigs).map(([key, scopeType]) => {
      const [featureCode, roleIdStr] = key.split(':');
      return {
        featureCode,
        roleId: parseInt(roleIdStr, 10),
        scopeType,
      };
    });
    await onSave(updates);
    setDirtyConfigs({});
  };

  const hasDirty = Object.keys(dirtyConfigs).length > 0;

  // Extract all distinct roles from the first feature (or all features)
  const roles = features.length > 0 ? features[0].role_configs : [];

  if (features.length === 0) {
    return (
      <div className="text-center py-12 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl">
        <Shield className="w-10 h-10 mx-auto text-neutral-300 dark:text-neutral-600 mb-3" />
        <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium">
          {t('data_scopes.messages.empty_matrix' as never) ||
            'Chưa có tính năng nào được đăng ký cấu hình phân quyền dữ liệu'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {hasDirty && (
        <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-800 dark:text-amber-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>Có {Object.keys(dirtyConfigs).length} thay đổi cấu hình chưa được lưu.</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleReset} disabled={isSaving}>
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              {t('data_scopes.actions.reset' as never) || 'Hoàn tác'}
            </Button>
            <Button size="sm" onClick={handleSave} isLoading={isSaving}>
              <Save className="w-3.5 h-3.5 mr-1" />
              {t('data_scopes.actions.save_changes' as never) || 'Lưu thay đổi'}
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-800 rounded-xl bg-white dark:bg-neutral-900">
        <table className="w-full text-sm text-left">
          <thead className="bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-800 text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
            <tr>
              <th className="px-6 py-4 min-w-[240px]">Tính năng</th>
              <th className="px-6 py-4 min-w-[140px]">Phân hệ</th>
              {roles.map((role) => (
                <th key={role.role_id} className="px-6 py-4 text-center min-w-[180px]">
                  <div className="flex items-center justify-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-neutral-400" />
                    <span>{role.role_name}</span>
                  </div>
                  {role.role_code === 'ADMIN' && (
                    <span className="text-[10px] text-blue-500 font-normal lowercase">(toàn quyền)</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {features.map((feature) => (
              <tr key={feature.feature_code} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30 transition-colors">
                <td className="px-6 py-4">
                  <div className="font-medium text-neutral-900 dark:text-white">
                    {feature.feature_name}
                  </div>
                  <div className="text-xs text-neutral-400 font-mono mt-0.5">
                    {feature.feature_code}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex px-2 py-0.5 rounded text-xs bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 font-medium">
                    {feature.module}
                  </span>
                </td>
                {feature.role_configs.map((config) => {
                  const dirtyKey = `${feature.feature_code}:${config.role_id}`;
                  const currentScope = dirtyConfigs[dirtyKey] !== undefined ? dirtyConfigs[dirtyKey] : config.scope_type;
                  const isAdmin = config.role_code === 'ADMIN';

                  return (
                    <td key={config.role_id} className="px-6 py-4 text-center">
                      {isAdmin ? (
                        <div className="flex justify-center">
                          <DataScopeBadge type="all" />
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1.5">
                          <select
                            value={currentScope}
                            onChange={(e) =>
                              handleScopeChange(
                                feature.feature_code,
                                config.role_id,
                                e.target.value as ScopeType,
                              )
                            }
                            className={`w-full max-w-[150px] px-2.5 py-1.5 text-xs font-medium rounded-lg border focus:ring-2 focus:ring-offset-0 transition-colors cursor-pointer dark:bg-neutral-800 dark:text-neutral-200 ${
                              dirtyConfigs[dirtyKey] !== undefined
                                ? 'border-amber-400 bg-amber-50/30 text-amber-900 focus:ring-amber-400'
                                : 'border-neutral-200 dark:border-neutral-700 focus:ring-neutral-400'
                            }`}
                          >
                            {feature.allowed_scope_types.map((type) => (
                              <option key={type} value={type}>
                                {t(`data_scopes.types.${type}` as never) || type}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
