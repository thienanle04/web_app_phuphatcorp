import React from 'react';
import type { ScopeType } from '../../../types/user';
import { useI18n } from '../../../i18n/useI18n';

interface DataScopeBadgeProps {
  type: ScopeType;
  className?: string;
}

export const DataScopeBadge: React.FC<DataScopeBadgeProps> = ({ type, className = '' }) => {
  const { t } = useI18n();

  const styles: Record<ScopeType, string> = {
    all: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
    entity: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800',
    owner: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
    none: 'bg-neutral-100 text-neutral-600 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:border-neutral-700',
  };

  const label = t(`data_scopes.types.${type}` as never) || type;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${styles[type]} ${className}`}
    >
      {label}
    </span>
  );
};
