import { Badge } from '../ui/Badge';
import type { BangKeHouse } from '../../api/bangKeThoApi';
import { useI18n } from '../../i18n/useI18n';

interface BangKeThoHouseBadgeProps {
  house: BangKeHouse;
}

export function BangKeThoHouseBadge({ house }: BangKeThoHouseBadgeProps) {
  const { t } = useI18n();

  if (house.status === 'ready') {
    return <Badge variant="success">{t('bangKeTho.house.ready')}</Badge>;
  }
  if (house.status === 'failed') {
    return (
      <Badge variant="danger" title={house.error_message ?? undefined}>
        {t('bangKeTho.house.failed')}
      </Badge>
    );
  }
  return <Badge variant="default">{t('bangKeTho.house.pending')}</Badge>;
}
