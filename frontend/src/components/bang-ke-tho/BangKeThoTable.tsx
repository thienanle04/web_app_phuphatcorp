import { Download, Loader2, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/Table';
import { BangKeThoHouseBadge } from './BangKeThoHouseBadge';
import type { BangKeBatch, BangKeHouseCode } from '../../api/bangKeThoApi';
import { formatDateTime } from '../../utils/format';
import { useI18n } from '../../i18n/useI18n';

const HOUSE_ORDER: BangKeHouseCode[] = ['nd_mcc', 'clv', 'calofic'];

interface BangKeThoTableProps {
  rows: BangKeBatch[];
  canManage: boolean;
  downloadingId: string | null;
  onDownload: (row: BangKeBatch) => void;
  onDelete: (row: BangKeBatch) => void;
}

function houseOf(row: BangKeBatch, code: BangKeHouseCode) {
  return row.houses.find((h) => h.house_code === code) ?? {
    house_code: code,
    status: 'pending' as const,
    download_filename: '',
    error_message: null,
  };
}

export function BangKeThoTable({
  rows,
  canManage,
  downloadingId,
  onDownload,
  onDelete,
}: BangKeThoTableProps) {
  const { t } = useI18n();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('bangKeTho.col.filename')}</TableHead>
          <TableHead>{t('bangKeTho.col.uploadedBy')}</TableHead>
          <TableHead className="tabular-nums">{t('bangKeTho.col.uploadedAt')}</TableHead>
          <TableHead>{t('bangKeTho.col.ndMcc')}</TableHead>
          <TableHead>{t('bangKeTho.col.clv')}</TableHead>
          <TableHead>{t('bangKeTho.col.calofic')}</TableHead>
          <TableHead>{t('bangKeTho.col.actions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="max-w-[220px]">
              <span className="block min-w-0 truncate" title={row.original_filename} translate="no">
                {row.original_filename}
              </span>
            </TableCell>
            <TableCell>{row.uploaded_by_name}</TableCell>
            <TableCell className="tabular-nums whitespace-nowrap">
              {formatDateTime(row.uploaded_at)}
            </TableCell>
            {HOUSE_ORDER.map((code) => (
              <TableCell key={code}>
                <BangKeThoHouseBadge house={houseOf(row, code)} />
              </TableCell>
            ))}
            <TableCell>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={t('bangKeTho.action.downloadInput') + ' ' + row.original_filename}
                  onClick={() => onDownload(row)}
                  disabled={downloadingId === row.id}
                >
                  {downloadingId === row.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Download className="h-4 w-4" aria-hidden="true" />
                  )}
                </Button>
                {canManage && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`${t('bangKeTho.action.delete')} ${row.original_filename}`}
                    onClick={() => onDelete(row)}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
