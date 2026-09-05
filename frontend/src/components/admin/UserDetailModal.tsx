import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Loader2 } from 'lucide-react';
import { useI18n } from '../../i18n/useI18n';
import { useUserById } from '../../hooks/useUsers';
import { getUserRoleLabel } from '../../utils/userRoleLabel';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  userId: number | null;
}

export function UserDetailModal({ isOpen, onClose, userId }: Props) {
  const { t } = useI18n();
  const { data: user, isLoading } = useUserById(userId ?? 0);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('userDetail.title')} size="sm">
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
        </div>
      ) : user ? (
        <div className="space-y-3">
          <DetailRow label={t('userDetail.fullName')} value={user.full_name} />
          <DetailRow label={t('userDetail.email')} value={user.email} />
          <DetailRow
            label={t('userDetail.role')}
            value={
              <Badge variant="default">
                {getUserRoleLabel(user, t)}
              </Badge>
            }
          />
        </div>
      ) : null}

      <div className="mt-6 flex justify-end">
        <Button variant="outline" onClick={onClose}>
          {t('userDetail.close')}
        </Button>
      </div>
    </Modal>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-neutral-500 dark:text-neutral-400">{label}</span>
      {typeof value === 'string' ? (
        <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{value}</span>
      ) : (
        value
      )}
    </div>
  );
}
