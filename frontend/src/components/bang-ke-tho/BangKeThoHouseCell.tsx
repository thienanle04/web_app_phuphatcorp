import { AlertCircle, Download, Loader2, Play, RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';
import { BangKeThoHouseBadge } from './BangKeThoHouseBadge';
import type { BangKeHouse } from '../../api/bangKeThoApi';
import { useI18n } from '../../i18n/useI18n';

interface BangKeThoHouseCellProps {
  batchId: string;
  house: BangKeHouse;
  canManage: boolean;
  isProcessing: boolean;
  isDownloading: boolean;
  onProcess: (batchId: string) => void;
  onDownloadOutput: (batchId: string, houseCode: string, fallbackName: string) => void;
}

export function BangKeThoHouseCell({
  batchId,
  house,
  canManage,
  isProcessing,
  isDownloading,
  onProcess,
  onDownloadOutput,
}: BangKeThoHouseCellProps) {
  const { t } = useI18n();

  // For houses other than ND-MCC (clv, calofic), keep standard badge
  if (house.house_code !== 'nd_mcc') {
    return <BangKeThoHouseBadge house={house} />;
  }

  // Processing state
  if (isProcessing) {
    return (
      <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 py-1" title={t('bangKeTho.house.processing')}>
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        <span className="text-xs font-medium">
          {t('bangKeTho.house.processing')}
        </span>
      </div>
    );
  }

  // Ready state: download icon button + reload icon button (no text badge)
  if (house.status === 'ready') {
    return (
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          title={t('bangKeTho.action.downloadNdMcc')}
          aria-label={t('bangKeTho.action.downloadNdMcc')}
          onClick={() => onDownloadOutput(batchId, 'nd_mcc', house.download_filename)}
          disabled={isDownloading}
        >
          {isDownloading ? (
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
            title={t('bangKeTho.action.reprocessNdMcc')}
            aria-label={t('bangKeTho.action.reprocessNdMcc')}
            onClick={() => onProcess(batchId)}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}
      </div>
    );
  }

  // Failed state: reload button + red warning icon with error tooltip to the right (no text badge)
  if (house.status === 'failed') {
    return (
      <div className="flex items-center gap-1">
        {canManage ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            title={t('bangKeTho.action.reprocessNdMcc')}
            aria-label={t('bangKeTho.action.retryNdMcc')}
            onClick={() => onProcess(batchId)}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled
            className="opacity-40 cursor-not-allowed"
            title={t('bangKeTho.house.failed')}
            aria-label={t('bangKeTho.house.failed')}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}
        <div
          className="p-1.5 flex items-center justify-center text-red-500 hover:text-red-600 cursor-help transition-colors"
          title={house.error_message || t('bangKeTho.house.failed')}
          aria-label={house.error_message || t('bangKeTho.house.failed')}
        >
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
        </div>
      </div>
    );
  }

  // Pending state: if canManage show "Xử lý" button (Play icon + text); if viewer show disabled download icon
  if (!canManage) {
    return (
      <div className="flex items-center">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled
          className="opacity-40 cursor-not-allowed"
          title={t('bangKeTho.house.pending')}
          aria-label={t('bangKeTho.house.pending')}
        >
          <Download className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-[34px] px-3 text-xs gap-1.5 font-medium text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800 rounded-lg"
        aria-label={t('bangKeTho.action.processNdMcc')}
        onClick={() => onProcess(batchId)}
      >
        <Play className="w-4 h-4 fill-current" aria-hidden="true" />
        <span>{t('bangKeTho.action.process')}</span>
      </Button>
    </div>
  );
}
