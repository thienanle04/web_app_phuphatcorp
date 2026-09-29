import { Fragment, useMemo, useState } from 'react';
import { usePermissionMatrix, useUpdateRolePermissions } from '../../hooks/usePermissions';
import { useI18n } from '../../i18n/useI18n';
import { Button } from '../../components/ui/Button';
import {
  Save,
  RotateCcw,
  Info,
  LayoutDashboard,
  MapPinned,
  Truck,
  Car,
  BookOpen,
  Settings,
  FolderOpen,
  RefreshCw,
} from 'lucide-react';
import type { PermissionMatrix as PermissionMatrixType, Permission } from '../../types/user';

interface MenuGroupDefinition {
  id: string;
  icon: React.ElementType;
  titleKey: string;
  defaultTitle: string;
  subMenus: {
    id: string;
    titleKey?: string;
    defaultTitle: string;
    permCodes: string[];
  }[];
}

const SIDEBAR_PERMISSION_STRUCTURE: MenuGroupDefinition[] = [
  {
    id: 'dashboard',
    icon: LayoutDashboard,
    titleKey: 'permissions.groups.dashboard',
    defaultTitle: 'Dashboard',
    subMenus: [
      {
        id: 'dashboard_overview',
        titleKey: 'permissions.subMenus.dashboard',
        defaultTitle: 'Dashboard',
        permCodes: ['dashboard.view'],
      },
    ],
  },
  {
    id: 'route_pricing',
    icon: MapPinned,
    titleKey: 'permissions.groups.route_pricing',
    defaultTitle: 'Quản lý giá cước vận tải',
    subMenus: [
      {
        id: 'route_pricing_matrix',
        titleKey: 'permissions.subMenus.route_pricing',
        defaultTitle: 'Kỳ điều chỉnh, Bộ giá, Quản lý tuyến, Bảng giá, Phụ phí KH',
        permCodes: ['route_pricing.view', 'route_pricing.manage'],
      },
    ],
  },
  {
    id: 'delivery_data',
    icon: Truck,
    titleKey: 'permissions.groups.delivery_data',
    defaultTitle: 'Xử lý Data Giao Hàng',
    subMenus: [
      {
        id: 'delivery_data_all',
        titleKey: 'permissions.subMenus.delivery_5_houses',
        defaultTitle: 'Xử lý 5 nhà & Gạo',
        permCodes: ['delivery_data.view', 'delivery_data.manage'],
      },
    ],
  },
  {
    id: 'vehicle_data',
    icon: Car,
    titleKey: 'permissions.groups.vehicle_data',
    defaultTitle: 'Quản lý dữ liệu xe',
    subMenus: [
      {
        id: 'inspections_oil_insurance_repairs',
        titleKey: 'permissions.subMenus.inspections_oil_insurance_repairs',
        defaultTitle: 'Đăng kiểm, Thay nhớt, Bảo hiểm, Sửa xe',
        permCodes: ['vehicle_data.view', 'vehicle_data.manage'],
      },
      {
        id: 'fuel',
        titleKey: 'permissions.subMenus.fuel',
        defaultTitle: 'Quản lý dữ liệu dầu & Thống kê',
        permCodes: ['fuel.view', 'fuel.manage'],
      },
    ],
  },
  {
    id: 'dispatch',
    icon: Truck,
    titleKey: 'permissions.groups.dispatch',
    defaultTitle: 'Điều hành vận tải',
    subMenus: [
      {
        id: 'schedule',
        titleKey: 'permissions.subMenus.schedule',
        defaultTitle: 'Lịch điều phối xe',
        permCodes: ['dispatch.view', 'dispatch.manage'],
      },
      {
        id: 'invoice_tracking',
        titleKey: 'permissions.subMenus.invoice_tracking',
        defaultTitle: 'Theo dõi hóa đơn',
        permCodes: ['invoice_tracking.view', 'invoice_tracking.manage'],
      },
    ],
  },
  {
    id: 'accounting_data',
    icon: BookOpen,
    titleKey: 'permissions.groups.accounting_data',
    defaultTitle: 'Quản lý dữ liệu kế toán',
    subMenus: [
      {
        id: 'accounting',
        titleKey: 'permissions.subMenus.accounting',
        defaultTitle: 'ĐK Trọng lượng, Khách hàng, Import, Bảng kê thô, Đối chiếu',
        permCodes: ['accounting_data.view', 'accounting_data.manage'],
      },
    ],
  },
  {
    id: 'user_settings',
    icon: Settings,
    titleKey: 'permissions.groups.user_settings',
    defaultTitle: 'Thiết lập người dùng',
    subMenus: [
      {
        id: 'users',
        titleKey: 'permissions.subMenus.users',
        defaultTitle: 'Quản lý người dùng',
        permCodes: ['users.view', 'users.manage'],
      },
      {
        id: 'roles',
        titleKey: 'permissions.subMenus.roles',
        defaultTitle: 'Quản lý vai trò',
        permCodes: ['roles.view', 'roles.manage'],
      },
      {
        id: 'permissions',
        titleKey: 'permissions.subMenus.permissions',
        defaultTitle: 'Quản lý quyền',
        permCodes: ['permissions.manage'],
      },
      {
        id: 'data_scopes',
        titleKey: 'permissions.subMenus.data_scopes',
        defaultTitle: 'Phạm vi dữ liệu',
        permCodes: ['data_scopes.view', 'data_scopes.manage'],
      },
      {
        id: 'workflows',
        titleKey: 'permissions.subMenus.workflows',
        defaultTitle: 'Cấu hình quy trình',
        permCodes: ['workflows.view', 'workflows.manage'],
      },
      {
        id: 'logs',
        titleKey: 'permissions.subMenus.logs',
        defaultTitle: 'Nhật ký hệ thống',
        permCodes: ['logs.view'],
      },
    ],
  },
  {
    id: 'catalog',
    icon: FolderOpen,
    titleKey: 'permissions.groups.catalog',
    defaultTitle: 'Quản lý danh mục',
    subMenus: [
      {
        id: 'catalog',
        titleKey: 'permissions.subMenus.catalog',
        defaultTitle: 'Xe, Tài xế, KH nội thành, Nhà cung cấp, Mặt hàng KM, Điểm giao',
        permCodes: ['catalog.view', 'catalog.manage'],
      },
    ],
  },
  {
    id: 'jobs',
    icon: RefreshCw,
    titleKey: 'permissions.groups.jobs',
    defaultTitle: 'Quản lý Job',
    subMenus: [
      {
        id: 'jobs',
        titleKey: 'permissions.subMenus.jobs',
        defaultTitle: 'Cấu hình Job & Lịch sử',
        permCodes: ['jobs.view', 'jobs.manage'],
      },
    ],
  },
];

function PermissionMatrix({
  data,
  localMatrix,
  onToggle,
}: {
  data: PermissionMatrixType;
  localMatrix: Record<number, Set<number>>;
  onToggle: (roleId: number, permId: number) => void;
}) {
  const { t } = useI18n();

  // Create quick lookup maps for permissions
  const permByCode = useMemo(() => {
    const map = new Map<string, Permission>();
    for (const p of data.permissions) {
      map.set(p.code, p);
    }
    return map;
  }, [data.permissions]);

  // Find any ungrouped permissions to display safely at the end
  const structuredCodes = useMemo(() => {
    const set = new Set<string>();
    for (const group of SIDEBAR_PERMISSION_STRUCTURE) {
      for (const sub of group.subMenus) {
        for (const code of sub.permCodes) {
          set.add(code);
        }
      }
    }
    return set;
  }, []);

  const otherPerms = useMemo(() => {
    return data.permissions.filter((p) => !structuredCodes.has(p.code));
  }, [data.permissions, structuredCodes]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50">
            <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase min-w-[280px] sticky left-0 bg-neutral-50 dark:bg-neutral-800/50 z-10">
              {t('permissions.title')}
            </th>
            {data.roles.map((role) => (
              <th
                key={role.id}
                className="text-center px-4 py-3 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase min-w-[120px]"
              >
                <div>{role.name}</div>
                {role.is_system && role.code === 'ADMIN' && (
                  <div className="text-xs font-normal text-blue-500 normal-case">(admin)</div>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SIDEBAR_PERMISSION_STRUCTURE.map((group) => {
            const GroupIcon = group.icon;
            const groupTitle = t(group.titleKey as never) || group.defaultTitle;

            // Collect all permissions for this group
            const groupPerms = group.subMenus.flatMap((sub) =>
              sub.permCodes
                .map((code) => permByCode.get(code))
                .filter((p): p is Permission => Boolean(p)),
            );

            if (groupPerms.length === 0) return null;

            return (
              <Fragment key={`group-${group.id}`}>
                {/* Main Menu Group Header Row */}
                <tr className="bg-neutral-100/90 dark:bg-neutral-800/80 border-t-2 border-b border-neutral-200 dark:border-neutral-700">
                  <td
                    colSpan={data.roles.length + 1}
                    className="px-4 py-2.5 text-xs font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider sticky left-0 bg-neutral-100/90 dark:bg-neutral-800/80"
                  >
                    <div className="flex items-center gap-2">
                      <GroupIcon className="w-4 h-4 text-neutral-600 dark:text-neutral-300" />
                      <span>{groupTitle}</span>
                    </div>
                  </td>
                </tr>

                {/* Submenus & Permissions */}
                {group.subMenus.map((sub) => {
                  const subPerms = sub.permCodes
                    .map((code) => permByCode.get(code))
                    .filter((p): p is Permission => Boolean(p));

                  if (subPerms.length === 0) return null;

                  const subTitle = (sub.titleKey && t(sub.titleKey as never)) || sub.defaultTitle;
                  const showSubHeader = group.subMenus.length > 1;

                  return (
                    <Fragment key={`sub-${group.id}-${sub.id}`}>
                      {showSubHeader && (
                        <tr className="bg-neutral-50/60 dark:bg-neutral-800/30 border-b border-neutral-100 dark:border-neutral-800">
                          <td
                            colSpan={data.roles.length + 1}
                            className="px-6 py-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400 sticky left-0 bg-neutral-50/60 dark:bg-neutral-800/30"
                          >
                            ↳ {subTitle}
                          </td>
                        </tr>
                      )}

                      {subPerms.map((perm) => (
                        <tr
                          key={perm.id}
                          className="border-b border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50/80 dark:hover:bg-neutral-800/20 transition-colors"
                        >
                          <td
                            className={`px-4 py-2.5 text-neutral-700 dark:text-neutral-300 sticky left-0 bg-white dark:bg-neutral-900 z-10 ${
                              showSubHeader ? 'pl-8' : 'pl-6'
                            }`}
                          >
                            <div className="font-medium text-sm text-neutral-900 dark:text-neutral-100">
                              {t(`permissions.permCodes.${perm.code.replace(/\./g, '_')}` as never) || perm.name}
                            </div>
                            <div className="text-xs text-neutral-400 font-mono">{perm.code}</div>
                          </td>
                          {data.roles.map((role) => {
                            const isAdmin = role.code === 'ADMIN';
                            const checked = isAdmin
                              ? true
                              : (localMatrix[role.id]?.has(perm.id) ?? false);

                            return (
                              <td key={role.id} className="px-4 py-2.5 text-center">
                                <div className="relative inline-flex">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    disabled={isAdmin}
                                    onChange={() => !isAdmin && onToggle(role.id, perm.id)}
                                    className="w-4 h-4 accent-neutral-800 dark:accent-neutral-200 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                                    title={
                                      isAdmin
                                        ? t('permissions.adminReadonly')
                                        : `${t(`permissions.permCodes.${perm.code.replace(/\./g, '_')}` as never) || perm.name} — ${role.name}`
                                    }
                                  />
                                  {isAdmin && (
                                    <span
                                      className="absolute -top-1 -right-1 text-blue-400 cursor-help"
                                      title={t('permissions.adminReadonly')}
                                    >
                                      <Info className="w-3 h-3" />
                                    </span>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}
              </Fragment>
            );
          })}

          {/* Ungrouped Permissions if any */}
          {otherPerms.length > 0 && (
            <Fragment key="group-other">
              <tr className="bg-neutral-100/90 dark:bg-neutral-800/80 border-t-2 border-b border-neutral-200 dark:border-neutral-700">
                <td
                  colSpan={data.roles.length + 1}
                  className="px-4 py-2.5 text-xs font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider sticky left-0 bg-neutral-100/90 dark:bg-neutral-800/80"
                >
                  Khác
                </td>
              </tr>
              {otherPerms.map((perm) => (
                <tr
                  key={perm.id}
                  className="border-b border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50/80 dark:hover:bg-neutral-800/20 transition-colors"
                >
                  <td className="px-6 py-2.5 text-neutral-700 dark:text-neutral-300 sticky left-0 bg-white dark:bg-neutral-900 z-10">
                    <div className="font-medium text-sm text-neutral-900 dark:text-neutral-100">
                      {t(`permissions.permCodes.${perm.code.replace(/\./g, '_')}` as never) || perm.name}
                    </div>
                    <div className="text-xs text-neutral-400 font-mono">{perm.code}</div>
                  </td>
                  {data.roles.map((role) => {
                    const isAdmin = role.code === 'ADMIN';
                    const checked = isAdmin
                      ? true
                      : (localMatrix[role.id]?.has(perm.id) ?? false);

                    return (
                      <td key={role.id} className="px-4 py-2.5 text-center">
                        <div className="relative inline-flex">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={isAdmin}
                            onChange={() => !isAdmin && onToggle(role.id, perm.id)}
                            className="w-4 h-4 accent-neutral-800 dark:accent-neutral-200 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                            title={
                              isAdmin
                                ? t('permissions.adminReadonly')
                                : `${t(`permissions.permCodes.${perm.code.replace(/\./g, '_')}` as never) || perm.name} — ${role.name}`
                            }
                          />
                          {isAdmin && (
                            <span
                              className="absolute -top-1 -right-1 text-blue-400 cursor-help"
                              title={t('permissions.adminReadonly')}
                            >
                              <Info className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </Fragment>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function PermissionManagementPage() {
  const { t } = useI18n();
  const { data, isLoading, isError, refetch } = usePermissionMatrix();
  const updatePerms = useUpdateRolePermissions();

  // Local dirty state: clone matrix to track unsaved changes
  const [localMatrix, setLocalMatrix] = useState<Record<number, Set<number>> | null>(null);

  const effectiveMatrix = useMemo(() => {
    if (localMatrix) return localMatrix;
    if (!data) return {};
    const m: Record<number, Set<number>> = {};
    for (const [roleId, permIds] of Object.entries(data.matrix)) {
      m[Number(roleId)] = new Set(permIds);
    }
    return m;
  }, [data, localMatrix]);

  const isDirty = localMatrix !== null;

  const handleToggle = (roleId: number, permId: number) => {
    setLocalMatrix((prev) => {
      const base = prev ?? (() => {
        const m: Record<number, Set<number>> = {};
        for (const [id, ids] of Object.entries(data!.matrix)) {
          m[Number(id)] = new Set(ids);
        }
        return m;
      })();
      const updated = { ...base };
      updated[roleId] = new Set(base[roleId] ?? []);
      if (updated[roleId].has(permId)) {
        updated[roleId].delete(permId);
      } else {
        updated[roleId].add(permId);
      }
      return updated;
    });
  };

  const handleDiscard = () => setLocalMatrix(null);

  const handleSave = async () => {
    if (!data || !localMatrix) return;
    const nonAdminRoles = data.roles.filter((r) => r.code !== 'ADMIN');
    for (const role of nonAdminRoles) {
      const permIds = [...(localMatrix[role.id] ?? [])];
      await updatePerms.mutateAsync({ roleId: role.id, permission_ids: permIds });
    }
    setLocalMatrix(null);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
            {t('permissions.title')}
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            {t('permissions.subtitle')}
          </p>
        </div>
        {isDirty && (
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              {t('permissions.unsavedChanges')}
            </span>
            <Button variant="outline" onClick={handleDiscard}>
              <RotateCcw className="w-4 h-4 mr-2" />
              {t('permissions.discardChanges')}
            </Button>
            <Button onClick={handleSave} isLoading={updatePerms.isPending}>
              <Save className="w-4 h-4 mr-2" />
              {t('permissions.saveAll')}
            </Button>
          </div>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-8 flex justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-neutral-300 border-t-neutral-800 rounded-full animate-spin" />
            <p className="text-sm text-neutral-500">Đang tải...</p>
          </div>
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <p className="text-neutral-500 dark:text-neutral-400">{t('permissions.loadError')}</p>
          <Button variant="outline" onClick={() => refetch()}>
            Thử lại
          </Button>
        </div>
      )}

      {/* Matrix */}
      {!isLoading && !isError && data && (
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
          <PermissionMatrix
            data={data}
            localMatrix={effectiveMatrix}
            onToggle={handleToggle}
          />
        </div>
      )}

      {/* Save error */}
      {updatePerms.isError && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
          {t('permissions.saveError')}
        </div>
      )}
    </div>
  );
}
