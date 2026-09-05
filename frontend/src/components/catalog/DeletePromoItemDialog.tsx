import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useDeletePromoItem } from '../../hooks/usePromoItems';
import type { PromoItem } from '../../api/promoItemApi';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  item: PromoItem | null;
}

export function DeletePromoItemDialog({ isOpen, onClose, onSuccess, onError, item }: Props) {
  const deleteMutation = useDeletePromoItem();

  if (!item) return null;

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(item.id);
      onSuccess(`Đã xóa hàng khuyến mãi ${item.code}.`);
      onClose();
    } catch {
      onError('Không thể xóa. Vui lòng thử lại.');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Xác nhận xóa" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Bạn có chắc muốn xóa hàng khuyến mãi{' '}
          <span className="font-medium text-neutral-900 dark:text-neutral-100">{item.code}</span>
          {' — '}{item.product_name}? Hành động này sẽ deactivate bản ghi.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button variant="danger" isLoading={deleteMutation.isPending} onClick={handleDelete}>Xóa</Button>
        </div>
      </div>
    </Modal>
  );
}
