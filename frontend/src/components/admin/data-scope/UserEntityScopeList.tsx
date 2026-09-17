import React from 'react';
import type { UserEntityScope } from '../../../types/user';
import { Button } from '../../ui/Button';
import { Trash2, User, Truck, Building2, Car } from 'lucide-react';
import { useI18n } from '../../../i18n/useI18n';

interface UserEntityScopeListProps {
  items: UserEntityScope[];
  onDelete: (id: number) => Promise<void>;
  isDeleting: boolean;
}

export const UserEntityScopeList: React.FC<UserEntityScopeListProps> = ({
  items,
  onDelete,
  isDeleting,
}) => {
  const { t } = useI18n();

  const getEntityIcon = (entityType: string) => {
    switch (entityType) {
      case 'driver':
        return <Truck className="w-3.5 h-3.5 text-sky-500" />;
      case 'vehicle':
        return <Car className="w-3.5 h-3.5 text-emerald-500" />;
      case 'customer':
        return <Building2 className="w-3.5 h-3.5 text-purple-500" />;
      default:
        return <User className="w-3.5 h-3.5 text-neutral-500" />;
    }
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-12 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl">
        <User className="w-10 h-10 mx-auto text-neutral-300 dark:text-neutral-600 mb-3" />
        <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium">
          {t('data_scopes.messages.empty_user_entities' as never) ||
            'Chưa có phân quyền đối tượng nào được thiết lập'}
        </p>
        <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
          {t('data_scopes.messages.empty_user_entities_hint' as never) ||
            'Bấm nút "Gán đối tượng" để chỉ định dữ liệu cho người dùng cụ thể.'}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-800 rounded-xl bg-white dark:bg-neutral-900">
      <table className="w-full text-sm text-left">
        <thead className="bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-800 text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
          <tr>
            <th className="px-6 py-4">Người dùng</th>
            <th className="px-6 py-4">Tính năng áp dụng</th>
            <th className="px-6 py-4">Loại đối tượng</th>
            <th className="px-6 py-4">Đối tượng được gán</th>
            <th className="px-6 py-4 text-right">Thao tác</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30 transition-colors">
              <td className="px-6 py-4">
                <div className="font-medium text-neutral-900 dark:text-white">
                  {item.full_name || item.username}
                </div>
                <div className="text-xs text-neutral-400 font-mono mt-0.5">
                  @{item.username}
                </div>
              </td>
              <td className="px-6 py-4 font-medium text-neutral-700 dark:text-neutral-300">
                {item.feature_name}
              </td>
              <td className="px-6 py-4">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">
                  {getEntityIcon(item.entity_type)}
                  {t(`data_scopes.entities.${item.entity_type}` as never) || item.entity_type}
                </span>
              </td>
              <td className="px-6 py-4">
                <div className="font-semibold text-neutral-800 dark:text-neutral-200">
                  {item.entity_name || `ID: ${item.entity_id}`}
                </div>
              </td>
              <td className="px-6 py-4 text-right">
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => onDelete(item.id)}
                  disabled={isDeleting}
                  className="px-2 py-1"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Xóa
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
