import { Badge } from '../ui/Badge';
import { useI18n } from '../../i18n/useI18n';

interface InvoiceStatusBadgeProps {
  status: 'created' | 'pending_review' | 'completed' | 'request_supplement' | string;
}

const VARIANT_MAP: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  created: 'default',
  pending_review: 'warning',
  completed: 'success',
  request_supplement: 'danger',
};

export function InvoiceStatusBadge({ status }: InvoiceStatusBadgeProps) {
  const { t } = useI18n();

  const variant = VARIANT_MAP[status] || 'default';
  const labelKey = `invoice_tracking.status.${status}`;
  const label = t(labelKey as never) || status;

  return <Badge variant={variant}>{label}</Badge>;
}
