import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { copyToClipboard } from '../../utils/clipboard';
import { Share2, Check, Copy, ExternalLink, Globe } from 'lucide-react';

interface ShareTicketDialogProps {
  isOpen: boolean;
  onClose: () => void;
  shareUrl: string;
  plateNumber?: string;
}

export function ShareTicketDialog({
  isOpen,
  onClose,
  shareUrl,
  plateNumber,
}: ShareTicketDialogProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!shareUrl) return;
    const ok = await copyToClipboard(shareUrl);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleOpenLink = () => {
    if (!shareUrl) return;
    window.open(shareUrl, '_blank');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Chia sẻ chứng từ chuyến xe" size="md">
      <div className="space-y-4 py-1">
        <div className="flex items-start gap-3 p-3.5 bg-neutral-50 dark:bg-neutral-800/60 rounded-xl border border-neutral-200/80 dark:border-neutral-700/80 text-xs sm:text-sm text-neutral-600 dark:text-neutral-300">
          <Globe className="w-5 h-5 text-sky-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-neutral-900 dark:text-neutral-100">
              Liên kết xem công khai {plateNumber ? `(${plateNumber})` : ''}
            </p>
            <p className="text-neutral-500 dark:text-neutral-400 text-xs mt-0.5">
              Bất kỳ ai có liên kết này đều có thể xem toàn bộ hình ảnh và thông tin chuyến xe mà không cần đăng nhập.
            </p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
            Đường link chia sẻ:
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              onFocus={(e) => e.target.select()}
              className="flex-1 px-3 py-2 text-xs sm:text-sm font-mono bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-neutral-400 select-all"
            />
            <Button
              type="button"
              variant={copied ? 'primary' : 'outline'}
              size="sm"
              onClick={handleCopy}
              className="h-9 px-3 text-xs font-medium shrink-0"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 mr-1 text-emerald-500" />
                  <span>Đã chép</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 mr-1" />
                  <span>Sao chép</span>
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-center gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleOpenLink}
            className="w-full sm:w-auto h-9 text-xs text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300"
          >
            <ExternalLink className="w-3.5 h-3.5 mr-1" />
            Mở xem trang public
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="w-full sm:w-auto h-9 text-xs"
          >
            Đóng
          </Button>
        </div>
      </div>
    </Modal>
  );
}
