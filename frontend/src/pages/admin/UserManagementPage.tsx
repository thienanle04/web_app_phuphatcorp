import { useState, useMemo } from 'react';
import { Plus, Eye, Pencil, Key, Trash } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/Table';
import { useUsers } from '../../hooks/useUsers';
import { useAuth } from '../../hooks/useAuth';
import { useI18n } from '../../i18n/useI18n';
import { UserRole } from '../../types/user';
import { CreateUserModal } from '../../components/admin/CreateUserModal';
import { EditUserModal } from '../../components/admin/EditUserModal';
import { UserDetailModal } from '../../components/admin/UserDetailModal';
import { ResetPasswordModal } from '../../components/admin/ResetPasswordModal';
import { DeleteConfirmDialog } from '../../components/admin/DeleteConfirmDialog';
import { getUserRoleLabel } from '../../utils/userRoleLabel';

type ModalState =
  | { type: 'create' }
  | { type: 'edit'; user: import('../../types/user').UserPublic }
  | { type: 'detail'; userId: number }
  | { type: 'reset'; user: import('../../types/user').UserPublic }
  | { type: 'delete'; user: import('../../types/user').UserPublic }
  | null;

export function UserManagementPage() {
  const { t } = useI18n();
  const { user: currentUser } = useAuth();

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 20;

  const [modal, setModal] = useState<ModalState>(null);

  const { data, isLoading, error, refetch } = useUsers({
    search: search || undefined,
    role: roleFilter || undefined,
    is_active: showInactive ? undefined : true,
    page,
    limit,
  });

  const users = data?.users ?? [];
  const meta = data?.meta;

  const roleOptions = [
    { value: '', label: t('users.allRoles') },
    { value: UserRole.ADMIN, label: t('users.roles.ADMIN') },
    { value: UserRole.ACCOUNTANT, label: t('users.roles.ACCOUNTANT') },
    { value: UserRole.VIEWER, label: t('users.roles.VIEWER') },
  ];

  const isOwnUser = (userId: number) => currentUser?.id === userId;

  const displayedUsers = useMemo(() => {
    return users;
  }, [users]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">{t('users.title')}</h1>
        <Button onClick={() => setModal({ type: 'create' })}>
          <Plus className="w-4 h-4 mr-2" />
          {t('users.addUser')}
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder={t('users.search')}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="w-48">
              <Select
                options={roleOptions}
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => {
                  setShowInactive(e.target.checked);
                  setPage(1);
                }}
                className="w-4 h-4 rounded border-neutral-300 dark:border-neutral-600"
              />
              {t('users.showInactive')}
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-neutral-200 dark:border-neutral-700 border-t-neutral-800 dark:border-t-neutral-200 rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-red-600 dark:text-red-400">{t('messages.error')}</p>
            </div>
          ) : displayedUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-neutral-500 dark:text-neutral-400">
              <p>{search ? t('users.noResults') : t('users.empty')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">{t('users.columns.stt')}</TableHead>
                    <TableHead>{t('users.columns.fullName')}</TableHead>
                    <TableHead>{t('users.columns.username')}</TableHead>
                    <TableHead>{t('users.columns.email')}</TableHead>
                    <TableHead>{t('users.columns.role')}</TableHead>
                    <TableHead className="w-32">{t('users.columns.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedUsers.map((user, index) => (
                    <TableRow key={user.id}>
                      <TableCell className="text-neutral-500 dark:text-neutral-400">
                        {(page - 1) * limit + index + 1}
                      </TableCell>
                      <TableCell className="font-medium text-neutral-900 dark:text-neutral-100">
                        {user.full_name}
                      </TableCell>
                      <TableCell className="text-neutral-600 dark:text-neutral-400 font-mono text-sm">
                        {user.username}
                      </TableCell>
                      <TableCell className="text-neutral-600 dark:text-neutral-400">{user.email}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge
                          className="max-w-[10rem] min-w-0 overflow-hidden"
                          variant={user.role === 'ADMIN' ? 'warning' : user.role === 'ACCOUNTANT' ? 'info' : 'default'}
                          title={getUserRoleLabel({ role: user.role ?? '', role_name: user.role_name }, t)}
                        >
                          {getUserRoleLabel({ role: user.role ?? '', role_name: user.role_name }, t)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setModal({ type: 'detail', userId: user.id })}
                            className="p-1.5 text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors"
                            title={t('users.actions.view')}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {!isOwnUser(user.id) && (
                            <>
                              <button
                                onClick={() => setModal({ type: 'edit', user })}
                                className="p-1.5 text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors"
                                title={t('users.actions.edit')}
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setModal({ type: 'reset', user })}
                                className="p-1.5 text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors"
                                title={t('users.actions.resetPassword')}
                              >
                                <Key className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setModal({ type: 'delete', user })}
                                className="p-1.5 text-neutral-400 dark:text-neutral-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                title={t('users.actions.delete')}
                              >
                                <Trash className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {t('users.pagination.showing')} {(page - 1) * limit + 1}–{Math.min(page * limit, meta.total)} {t('users.pagination.of')} {meta.total}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              ←
            </Button>
            <span className="flex items-center px-3 text-sm text-neutral-600 dark:text-neutral-400">
              {t('users.pagination.page')} {page} {t('users.pagination.of')} {meta.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              →
            </Button>
          </div>
        </div>
      )}

      {/* Modals */}
      {modal?.type === 'create' && (
        <CreateUserModal
          isOpen
          onClose={() => setModal(null)}
          onSuccess={() => refetch()}
        />
      )}
      {modal?.type === 'edit' && (
        <EditUserModal
          isOpen
          onClose={() => setModal(null)}
          user={modal.user}
          onSuccess={() => refetch()}
        />
      )}
      {modal?.type === 'detail' && (
        <UserDetailModal
          isOpen
          onClose={() => setModal(null)}
          userId={modal.userId}
        />
      )}
      {modal?.type === 'reset' && (
        <ResetPasswordModal
          isOpen
          onClose={() => setModal(null)}
          userId={modal.user.id}
          userName={modal.user.full_name}
          onSuccess={() => refetch()}
        />
      )}
      {modal?.type === 'delete' && (
        <DeleteConfirmDialog
          isOpen
          onClose={() => setModal(null)}
          userId={modal.user.id}
          userName={modal.user.full_name}
          onSuccess={() => refetch()}
        />
      )}
    </div>
  );
}
