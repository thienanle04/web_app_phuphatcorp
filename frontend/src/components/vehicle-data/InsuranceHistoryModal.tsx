import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, FileText, Pencil } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { vehicleInsuranceApi, type InsuranceRecord, type InsuranceImage } from '../../api/vehicleInsuranceApi';
import type { VehicleInsuranceSummary } from '../../api/vehicleInsuranceApi';
import { Button } from '../ui/Button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../ui/Table';
import { cn } from '../../utils/cn';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  vehicle: VehicleInsuranceSummary;
  onError: (message: string) => void;
  onSuccess?: (message: string) => void;
}

function isImageFile(mimeType: string | null): boolean {
  return mimeType ? mimeType.startsWith('image/') : false;
}

export function InsuranceHistoryModal({ isOpen, onClose, vehicle, onError, onSuccess }: Props) {
  const [records, setRecords] = useState<InsuranceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [imagesMap, setImagesMap] = useState<Record<number, InsuranceImage[]>>({});
  const [loadingImages, setLoadingImages] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ purchase_date: '', expiry_date: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const r = await vehicleInsuranceApi.fetchAll({ vehicle_id: vehicle.vehicle_id, status: 'all', limit: 100 });
      setRecords(r.insurances);
    } catch {
      onError('Không thể tải lịch sử bảo hiểm');
    } finally {
      setLoading(false);
    }
  }, [vehicle.vehicle_id, onError]);

  useEffect(() => {
    if (isOpen) {
      setExpandedId(null);
      setImagesMap({});
      setEditingId(null);
      fetchHistory();
    }
  }, [isOpen, vehicle.vehicle_id, fetchHistory]);

  const toggleExpand = useCallback(async (recordId: number) => {
    if (expandedId === recordId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(recordId);
    if (!imagesMap[recordId]) {
      setLoadingImages(true);
      try {
        const r = await vehicleInsuranceApi.fetchById(recordId);
        setImagesMap((prev) => ({ ...prev, [recordId]: r.images ?? [] }));
      } catch {
        setImagesMap((prev) => ({ ...prev, [recordId]: [] }));
      } finally {
        setLoadingImages(false);
      }
    }
  }, [expandedId, imagesMap]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return 'Còn hạn';
      case 'expired': return 'Hết hạn';
      case 'superseded': return 'Đã thay thế';
      case 'deleted': return 'Đã xóa';
      default: return status;
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
      case 'expired': return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
      default: return 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400';
    }
  };

  const latestActiveId = records
    .filter((r) => r.status === 'active')
    .sort((a, b) => new Date(b.expiry_date).getTime() - new Date(a.expiry_date).getTime())[0]?.id ?? null;

  const startEdit = (r: InsuranceRecord) => {
    setEditingId(r.id);
    setEditForm({
      purchase_date: r.purchase_date ? r.purchase_date.split('T')[0] : '',
      expiry_date: r.expiry_date ? r.expiry_date.split('T')[0] : '',
      notes: r.notes ?? '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ purchase_date: '', expiry_date: '', notes: '' });
  };

  const submitEdit = async () => {
    if (!editingId) return;
    if (new Date(editForm.expiry_date) <= new Date(editForm.purchase_date)) {
      onError('Ngày hết hạn phải sau ngày mua');
      return;
    }
    setSaving(true);
    try {
      await vehicleInsuranceApi.update(editingId, {
        purchase_date: editForm.purchase_date,
        expiry_date: editForm.expiry_date,
        notes: editForm.notes || undefined,
      });
      onSuccess?.('Đã cập nhật bảo hiểm');
      cancelEdit();
      await fetchHistory();
    } catch {
      onError('Không thể cập nhật bảo hiểm');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Lịch sử bảo hiểm: ${vehicle.plate_number} - ${vehicle.driver_name}`} size="xl">
      <div className="overflow-x-auto">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-10 bg-neutral-100 dark:bg-neutral-800 rounded animate-pulse" />
            ))}
          </div>
        ) : records.length === 0 ? (
          <div className="py-12 text-center text-sm text-neutral-500">
            Chưa có lịch sử bảo hiểm
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead className="w-14">STT</TableHead>
                <TableHead className="w-32">Ngày mua</TableHead>
                <TableHead className="w-32">Ngày hết hạn</TableHead>
                <TableHead className="w-28 text-center">Trạng thái</TableHead>
                <TableHead>Ghi chú</TableHead>
                <TableHead className="w-20 text-center">File</TableHead>
                <TableHead className="w-24 text-center">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((r, idx) => {
                const isExpanded = expandedId === r.id;
                const isEditing = editingId === r.id;
                const images = imagesMap[r.id] ?? [];
                const hasFiles = (r.images && r.images.length > 0) || images.length > 0;
                const totalFiles = images.length > 0 ? images.length : (r.images?.length ?? 0);
                const canEdit = r.id === latestActiveId;

                return (
                  <TableRow key={r.id}>
                    <TableCell className="py-2">
                      <button
                        onClick={() => toggleExpand(r.id)}
                        className="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 rounded transition-colors"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </TableCell>
                    <TableCell className="text-neutral-500 dark:text-neutral-400 text-sm">{idx + 1}</TableCell>
                    <TableCell className="text-neutral-700 dark:text-neutral-300 text-sm">
                      {isEditing ? (
                        <input
                          type="date"
                          value={editForm.purchase_date}
                          onChange={(e) => setEditForm((f) => ({ ...f, purchase_date: e.target.value }))}
                          className="px-2 py-1 text-sm border border-neutral-200 dark:border-neutral-700 rounded bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100"
                        />
                      ) : (
                        new Date(r.purchase_date).toLocaleDateString('vi-VN')
                      )}
                    </TableCell>
                    <TableCell className="text-neutral-700 dark:text-neutral-300 text-sm font-medium">
                      {isEditing ? (
                        <input
                          type="date"
                          value={editForm.expiry_date}
                          onChange={(e) => setEditForm((f) => ({ ...f, expiry_date: e.target.value }))}
                          className="px-2 py-1 text-sm border border-neutral-200 dark:border-neutral-700 rounded bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100"
                        />
                      ) : (
                        new Date(r.expiry_date).toLocaleDateString('vi-VN')
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={cn('inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium', getStatusClass(r.status))}>
                        {getStatusBadge(r.status)}
                      </span>
                    </TableCell>
                    <TableCell className="text-neutral-500 dark:text-neutral-400 text-sm max-w-48 truncate">
                      {isEditing ? (
                        <textarea
                          value={editForm.notes}
                          onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                          rows={1}
                          className="w-full px-2 py-1 text-sm border border-neutral-200 dark:border-neutral-700 rounded bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100 resize-none"
                        />
                      ) : (
                        r.notes || '-'
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {hasFiles ? (
                        <span className="text-xs text-neutral-500">{totalFiles} file</span>
                      ) : (
                        <span className="text-xs text-neutral-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {isEditing ? (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={submitEdit}
                            disabled={saving}
                            className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors disabled:opacity-50"
                            title="Lưu"
                          >
                            {saving ? (
                              <div className="w-4 h-4 border-2 border-green-300 border-t-green-600 rounded-full animate-spin" />
                            ) : (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            )}
                          </button>
                          <button
                            onClick={cancelEdit}
                            disabled={saving}
                            className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
                            title="Hủy"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      ) : canEdit ? (
                        <button
                          onClick={() => startEdit(r)}
                          className="p-1.5 text-neutral-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                          title="Sửa"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {expandedId !== null && (
        <div className="mt-4 border-t border-neutral-200 dark:border-neutral-700 pt-4">
          {loadingImages ? (
            <div className="flex items-center gap-2 text-sm text-neutral-400 py-4">
              <div className="w-4 h-4 border-2 border-neutral-300 border-t-neutral-600 rounded-full animate-spin" />
              Đang tải file...
            </div>
          ) : (
            <>
              <h4 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">
                File đính kèm ({imagesMap[expandedId]?.length ?? 0} file)
              </h4>
              {(imagesMap[expandedId]?.length ?? 0) === 0 ? (
                <p className="text-sm text-neutral-400 py-4">Không có file đính kèm</p>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3">
                  {imagesMap[expandedId].map((img) => (
                    <div key={img.id} className="group">
                      {isImageFile(img.mime_type) ? (
                        <a href={`/api/vehicle-insurances/files/${img.filename}`} target="_blank" rel="noopener noreferrer">
                          <img
                            src={`/api/vehicle-insurances/files/${img.filename}`}
                            alt={img.original_filename}
                            className="w-full aspect-square object-cover rounded-lg border border-neutral-200 dark:border-neutral-700 hover:opacity-80 transition-opacity"
                          />
                        </a>
                      ) : (
                        <a
                          href={`/api/vehicle-insurances/files/${img.filename}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full aspect-square rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 flex flex-col items-center justify-center gap-1 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                        >
                          <FileText className="w-8 h-8 text-neutral-400" />
                          <span className="text-[10px] text-neutral-400">Xem</span>
                        </a>
                      )}
                      <p className="text-[10px] text-neutral-400 mt-1 truncate" title={img.original_filename}>
                        {img.original_filename.length > 12 ? img.original_filename.slice(0, 10) + '..' : img.original_filename}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className="flex justify-end pt-4">
        <Button variant="outline" onClick={onClose}>Đóng</Button>
      </div>
    </Modal>
  );
}
