import { useState, useRef, useCallback } from 'react';
import {
  Upload,
  FileSpreadsheet,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Eye,
  Download,
  X,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Pagination } from '../../../components/ui/Pagination';
import { useImportDeliveryData, useGetBatches, useDeleteBatch, useGetBatchRows } from '../../../hooks/useDeliveryData';
import { useAuth } from '../../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import type { ImportResult } from '../../../api/deliveryDataApi';
import { deliveryDataApi } from '../../../api/deliveryDataApi';
import {
  processDeliveryDataFromRows,
  buildAdjustments,
  filterExcludedRows,
  applyAdjustments,
  type ProcessResult,
  type RawRow,
  type AdjustmentRow,
} from '../../../utils/processDeliveryData';
import { weightAdjustmentApi } from '../../../api/weightAdjustmentApi';
import { customersApi, type Customer } from '../../../api/customersApi';
import { innerCityCustomerApi } from '../../../api/innerCityCustomerApi';
import { promoItemApi, type PromoItem } from '../../../api/promoItemApi';
import {
  WeightAdjustmentConfirmDialog,
} from '../../../components/delivery-data/WeightAdjustmentConfirmDialog';

type UploadState = 'idle' | 'uploading' | 'success' | 'error';
type ProcessState = 'idle' | 'verifying' | 'awaiting_confirmation' | 'processing' | 'success' | 'error';

interface Toast {
  id: number;
  message: string;
  variant: 'success' | 'error';
}

const RAW_HEADERS = [
  'Channel',
  'Sub-channel',
  'Diễn giải chi tiết (HĐ)',
  'Diễn giải',
  'Slot',
  'Waybill No',
  'Slot No',
  'User tạo Hóa đơn',
  'Usser tạo PXK',
  'PO Number',
  'Warehouse No',
  'Warehouse Name',
  'Mã PXK',
  'Số chứng từ ghi sổ',
  'Số Seri',
  'Địa chỉ giao hàng (vn)',
  'Tên hàng hóa',
  'Mã ĐVT (Bán hàng)',
  'SP - Trọng lượng Net',
  'HĐ - Trọng lượng (Net)',
  'Mã nhà cung cấp',
  'Mã khách hàng',
  'Tên khách hàng',
  'Mã hàng hóa',
  'Tên hàng hóa (En)',
  'Loại hàng',
  'Mã liên hệ giao hàng',
  'Số lượng (DVT bán hàng)',
  'Số tàu/ Số xe',
  'Tài xế',
  'Số Cont',
  'Ngày hóa đơn',
  'Số hóa đơn',
  'Thông tin bổ sung 08',
];

export function DeliveryImportPage() {
  const { hasPermission, user } = useAuth();
  const canManage = hasPermission('accounting_data.manage') || user?.role === 'ADMIN';
  const navigate = useNavigate();

  const importMutation = useImportDeliveryData();
  const deleteMutation = useDeleteBatch();
  const getBatchRowsMutation = useGetBatchRows();
  const [batchPage, setBatchPage] = useState(1);
  const { data: batchesData, refetch: refetchBatches } = useGetBatches(batchPage);

  // Upload state
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Batch process state
  const [selectedBatchIds, setSelectedBatchIds] = useState<Set<string>>(new Set());
  const [processState, setProcessState] = useState<ProcessState>('idle');
  const [processResult, setProcessResult] = useState<ProcessResult | null>(null);
  const [processError, setProcessError] = useState('');
  const [adjustments, setAdjustments] = useState<AdjustmentRow[]>([]);
  const [excludedRowCount, setExcludedRowCount] = useState(0);
  const [processBatchFilenames, setProcessBatchFilenames] = useState<string[]>([]);
  const parsedRowsRef = useRef<RawRow[]>([]);
  const parsedSourceRowNumsRef = useRef<number[]>([]);
  const customersRef = useRef<Customer[]>([]);
  const innerCityNamesRef = useRef<Set<string>>(new Set());
  const promoItemsRef = useRef<PromoItem[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isProcessing = processState === 'verifying' || processState === 'processing' || processState === 'awaiting_confirmation';

  const showToast = (message: string, variant: 'success' | 'error' = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  };

  // ── Upload handlers ───────────────────────────────────────

  const handleFile = useCallback((f: File) => {
    if (!f.name.endsWith('.xlsx')) {
      showToast('Vui lòng chọn file .xlsx', 'error');
      return;
    }
    setFile(f);
    setUploadState('idle');
    setImportResult(null);
    setUploadError('');
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFile(dropped);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploadState('uploading');
    setUploadError('');

    try {
      const result = await importMutation.mutateAsync(file);
      setImportResult(result);
      setUploadState('success');
      showToast('Import hoàn tất');
      refetchBatches();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi import dữ liệu';
      setUploadError(msg);
      setUploadState('error');
      showToast(msg, 'error');
    }
  };

  const handleDeleteBatch = async (batchId: string) => {
    if (!window.confirm('Xác nhận xóa batch này và toàn bộ dữ liệu liên quan?')) return;
    try {
      await deleteMutation.mutateAsync(batchId);
      showToast('Đã xóa batch');
      setSelectedBatchIds((prev) => {
        const next = new Set(prev);
        next.delete(batchId);
        return next;
      });
      refetchBatches();
      if (importResult?.batch_id === batchId) {
        setImportResult(null);
        setUploadState('idle');
        setFile(null);
      }
    } catch {
      showToast('Không thể xóa batch', 'error');
    }
  };

  const handleDownloadBatch = async (batchId: string, filename: string) => {
    try {
      const data = await deliveryDataApi.getBatchRows([batchId]);
      const ws = XLSX.utils.aoa_to_sheet([RAW_HEADERS, ...data.rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Data');
      XLSX.writeFile(wb, filename);
    } catch {
      showToast('Không thể tải dữ liệu batch', 'error');
    }
  };

  // ── Batch selection handlers ─────────────────────────────

  const toggleBatchSelect = (batchId: string) => {
    setSelectedBatchIds((prev) => {
      const next = new Set(prev);
      if (next.has(batchId)) next.delete(batchId);
      else next.add(batchId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!batchesData) return;
    const allIds = batchesData.data.map((b) => b.batch_id);
    if (allIds.every((id) => selectedBatchIds.has(id))) {
      setSelectedBatchIds(new Set());
    } else {
      setSelectedBatchIds(new Set(allIds));
    }
  };

  const clearSelection = () => setSelectedBatchIds(new Set());

  // ── Process batch handlers ───────────────────────────────

  const runProcess = useCallback(async (rows: RawRow[], nums: number[]) => {
    setProcessState('processing');
    try {
      const result = await processDeliveryDataFromRows(rows, nums, customersRef.current, innerCityNamesRef.current, promoItemsRef.current);
      setProcessResult(result);
      setProcessState('success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lỗi xử lý dữ liệu. Vui lòng thử lại.';
      setProcessError(msg);
      setProcessState('error');
    }
  }, []);

  const handleProcessBatches = useCallback(async () => {
    if (selectedBatchIds.size === 0) return;
    setProcessState('verifying');
    setProcessError('');

    try {
      const batchIds = Array.from(selectedBatchIds);
      const batchData = await getBatchRowsMutation.mutateAsync(batchIds);

      if (batchData.total_rows === 0) {
        showToast('Batch đã chọn không có dữ liệu', 'error');
        setProcessState('idle');
        return;
      }

      setProcessBatchFilenames(batchData.original_filenames);

      if (batchData.total_rows > 5000) {
        showToast(`Dữ liệu lớn (${batchData.total_rows} dòng), quá trình có thể mất vài giây`, 'error');
      }

      const rawRows = batchData.rows as RawRow[];
      const sourceRowNums = rawRows.map((_, i) => i + 1);

      const [masterdata, customers, innerCityCustomers, promoItemData] = await Promise.all([
        weightAdjustmentApi.fetchAll(),
        customersApi.fetchAll(),
        innerCityCustomerApi.fetchAll(),
        promoItemApi.fetchAll(),
      ]);
      customersRef.current = customers;
      innerCityNamesRef.current = new Set(
        innerCityCustomers.customers.map((c) => c.customer_name.trim().toLowerCase())
      );
      promoItemsRef.current = promoItemData.items;

      const masterMap = new Map(masterdata.map((m) => [m.ma_hang, m]));

      const { filteredRows, filteredSourceRowNums, excludedCount } = filterExcludedRows(rawRows, sourceRowNums);
      setExcludedRowCount(excludedCount);

      const found = buildAdjustments(filteredRows, filteredSourceRowNums, masterMap);

      if (found.length === 0) {
        parsedRowsRef.current = filteredRows;
        parsedSourceRowNumsRef.current = filteredSourceRowNums;
        await runProcess(filteredRows, filteredSourceRowNums);
      } else {
        setAdjustments(found);
        parsedRowsRef.current = filteredRows;
        parsedSourceRowNumsRef.current = filteredSourceRowNums;
        setProcessState('awaiting_confirmation');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể tải dữ liệu batch';
      setProcessError(msg);
      setProcessState('error');
      showToast(msg, 'error');
    }
  }, [selectedBatchIds, getBatchRowsMutation, runProcess, showToast]);

  const handleConfirmAdjustments = useCallback(async () => {
    const modifiedRows = applyAdjustments(parsedRowsRef.current, adjustments);
    await runProcess(modifiedRows, parsedSourceRowNumsRef.current);
  }, [adjustments, runProcess]);

  const handleSkipAdjustments = useCallback(async () => {
    await runProcess(parsedRowsRef.current, parsedSourceRowNumsRef.current);
  }, [runProcess]);

  const handleDownload = useCallback(() => {
    if (!processResult) return;
    const url = window.URL.createObjectURL(processResult.outputBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = processResult.outputFilename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }, [processResult]);

  const handleResetProcess = useCallback(() => {
    setProcessState('idle');
    setProcessResult(null);
    setProcessError('');
    setExcludedRowCount(0);
    setAdjustments([]);
    setProcessBatchFilenames([]);
    parsedRowsRef.current = [];
    parsedSourceRowNumsRef.current = [];
  }, []);

  const handleBatchPageChange = (newPage: number) => {
    setBatchPage(newPage);
  };

  const selectedCount = selectedBatchIds.size;

  return (
    <div className={`p-6 space-y-6 ${isProcessing || processState === 'success' ? '' : ''}`}>
      {/* Toast notifications */}
      <div className="fixed top-4 right-4 z-[100] space-y-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-4 py-3 rounded-lg shadow-lg text-sm font-medium max-w-xs pointer-events-auto transition-all ${
              toast.variant === 'success'
                ? 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900'
                : 'bg-red-600 text-white'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>

      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
          Import dữ liệu 5 nhà
        </h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          Upload file Excel dữ liệu giao hàng để import vào database và tự động đối chiếu hóa đơn
        </p>
      </div>

      {/* Upload Section */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            Upload file Excel
          </h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragOver
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-neutral-300 dark:border-neutral-600 hover:border-neutral-400 dark:hover:border-neutral-500'
            } ${!canManage || isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => canManage && !isProcessing && fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileSpreadsheet className="w-8 h-8 text-green-600" />
                <div className="text-left">
                  <p className="font-medium text-neutral-900 dark:text-neutral-100">{file.name}</p>
                  <p className="text-sm text-neutral-500">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <Upload className="w-12 h-12 mx-auto text-neutral-400" />
                <p className="text-neutral-600 dark:text-neutral-300 font-medium">
                  Kéo thả file Excel vào đây hoặc click để chọn
                </p>
                <p className="text-sm text-neutral-400">Chỉ hỗ trợ file .xlsx</p>
              </div>
            )}
          </div>

          {file && canManage && (
            <Button
              className="w-full"
              onClick={handleUpload}
              disabled={uploadState === 'uploading' || isProcessing}
            >
              {uploadState === 'uploading' ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Đang import...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Import vào database
                </>
              )}
            </Button>
          )}

          {uploadState === 'error' && uploadError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {uploadError}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Import Result */}
      {uploadState === 'success' && importResult && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                Import hoàn tất
              </h2>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-3">
                <p className="text-xs text-neutral-500 dark:text-neutral-400">Dòng mới</p>
                <p className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                  {importResult.new_rows.toLocaleString()}
                </p>
              </div>
              <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-3">
                <p className="text-xs text-neutral-500 dark:text-neutral-400">HĐ mới</p>
                <p className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                  {importResult.new_invoices.toLocaleString()}
                </p>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                <p className="text-xs text-green-600 dark:text-green-400">Đã có</p>
                <p className="text-lg font-bold text-green-700 dark:text-green-300">
                  {importResult.matched_count.toLocaleString()}
                </p>
              </div>
              <div className="bg-neutral-100 dark:bg-neutral-700 rounded-lg p-3">
                <p className="text-xs text-neutral-500 dark:text-neutral-400">Không có</p>
                <p className="text-lg font-bold text-neutral-600 dark:text-neutral-300">
                  {importResult.unmatched_count.toLocaleString()}
                </p>
              </div>
            </div>
            {(importResult.duplicate_rows > 0 || importResult.duplicate_invoices > 0) && (
              <div className="flex flex-wrap gap-2 mb-3">
                {importResult.duplicate_rows > 0 && (
                  <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded">
                    Bỏ qua {importResult.duplicate_rows} dòng trùng (delivery_data)
                  </span>
                )}
                {importResult.duplicate_invoices > 0 && (
                  <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded">
                    Bỏ qua {importResult.duplicate_invoices} hóa đơn trùng (accountant_invoices)
                  </span>
                )}
              </div>
            )}
            {importResult.min_date && (
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">
                Khoảng ngày: {importResult.min_date} → {importResult.max_date}
              </p>
            )}
            <Button
              variant="outline"
              onClick={() =>
                navigate(`/accounting-data/invoice-matching?batch_id=${importResult.batch_id}`)
              }
            >
              <Eye className="w-4 h-4 mr-2" />
              Xem danh sách hóa đơn
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Batch History */}
      {batchesData && batchesData.data.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              Lịch sử import
            </h2>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-700">
                    <th className="text-left py-3 px-2 font-medium text-neutral-500 w-10">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-neutral-300 dark:border-neutral-600 text-neutral-800 dark:text-neutral-200 focus:ring-neutral-500"
                        checked={
                          batchesData.data.length > 0 &&
                          batchesData.data.every((b) => selectedBatchIds.has(b.batch_id))
                        }
                        onChange={toggleSelectAll}
                        disabled={isProcessing}
                      />
                    </th>
                    <th className="text-left py-3 px-2 font-medium text-neutral-500">File</th>
                    <th className="text-left py-3 px-2 font-medium text-neutral-500">Dòng</th>
                    <th className="text-left py-3 px-2 font-medium text-neutral-500">Hóa đơn</th>
                    <th className="text-left py-3 px-2 font-medium text-neutral-500">Đã có</th>
                    <th className="text-left py-3 px-2 font-medium text-neutral-500">Không có</th>
                    <th className="text-left py-3 px-2 font-medium text-neutral-500">Ngày import</th>
                    <th className="text-right py-3 px-2 font-medium text-neutral-500">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {batchesData.data.map((batch) => (
                    <tr
                      key={batch.batch_id}
                      className="border-b border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                    >
                      <td className="py-3 px-2">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-neutral-300 dark:border-neutral-600 text-neutral-800 dark:text-neutral-200 focus:ring-neutral-500"
                          checked={selectedBatchIds.has(batch.batch_id)}
                          onChange={() => toggleBatchSelect(batch.batch_id)}
                          disabled={isProcessing}
                        />
                      </td>
                      <td className="py-3 px-2">
                        <span className="text-neutral-900 dark:text-neutral-100">{batch.original_filename}</span>
                      </td>
                      <td className="py-3 px-2 text-neutral-600 dark:text-neutral-400">{batch.total_rows}</td>
                      <td className="py-3 px-2 text-neutral-600 dark:text-neutral-400">{batch.total_invoices}</td>
                      <td className="py-3 px-2 text-green-600 dark:text-green-400 font-medium">{batch.matched_count}</td>
                      <td className="py-3 px-2 text-neutral-500">{batch.unmatched_count}</td>
                      <td className="py-3 px-2 text-neutral-500 text-xs">
                        {new Date(batch.uploaded_at).toLocaleString('vi-VN')}
                      </td>
                      <td className="py-3 px-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              navigate(`/accounting-data/invoice-matching?batch_id=${batch.batch_id}`)
                            }
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownloadBatch(batch.batch_id, batch.original_filename)}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          {canManage && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteBatch(batch.batch_id)}
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {batchesData.pagination.totalPages > 1 && (
              <div className="mt-4">
                <Pagination
                  currentPage={batchesData.pagination.page}
                  totalPages={batchesData.pagination.totalPages}
                  totalItems={batchesData.pagination.total}
                  pageSize={batchesData.pagination.limit}
                  onPageChange={handleBatchPageChange}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Processing Overlay */}
      {(processState === 'verifying' || processState === 'processing') && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
          <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl p-8 flex flex-col items-center gap-4 max-w-sm mx-4">
            <Loader2 className="w-12 h-12 text-neutral-600 dark:text-neutral-400 animate-spin" />
            <div className="text-center">
              <p className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                {processState === 'verifying' ? 'Đang kiểm tra dữ liệu...' : 'Đang xử lý...'}
              </p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                Vui lòng đợi trong giây lát
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Weight Adjustment Confirmation Dialog */}
      <WeightAdjustmentConfirmDialog
        isOpen={processState === 'awaiting_confirmation'}
        adjustments={adjustments}
        onConfirm={handleConfirmAdjustments}
        onSkip={handleSkipAdjustments}
      />

      {/* Process Error */}
      {processState === 'error' && processError && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800 dark:text-red-300">Lỗi xử lý</p>
                <p className="text-sm text-red-600 dark:text-red-400 mt-0.5">{processError}</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleResetProcess}>
                Thử lại
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Process Success Result */}
      {processState === 'success' && processResult && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500 dark:text-green-400" />
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                Xử lý thành công
              </h2>
            </div>
          </CardHeader>
          <CardContent>
            {/* Stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">Tổng số dòng</p>
                <p className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                  {processResult.processedRows.toLocaleString()}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">Số nhóm</p>
                <p className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                  {processResult.groupCount.toLocaleString()}
                </p>
              </div>
              {excludedRowCount > 0 && (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <p className="text-xs text-amber-600 dark:text-amber-400 mb-1">Dòng bị loại</p>
                  <p className="text-xl font-semibold text-amber-700 dark:text-amber-300">
                    {excludedRowCount.toLocaleString()}
                  </p>
                  <p className="text-xs text-amber-500 dark:text-amber-500 mt-0.5">thay thế / điều chỉnh</p>
                </div>
              )}
              <div className={`p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 ${excludedRowCount > 0 ? '' : 'col-span-2'}`}>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">Khoảng ngày</p>
                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  {processResult.dateRange.from} → {processResult.dateRange.to}
                </p>
              </div>
            </div>

            {/* Batch list */}
            {processBatchFilenames.length > 0 && (
              <div className="mb-4 p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">
                  Danh sách batch đã xử lý ({processBatchFilenames.length})
                </p>
                <ul className="space-y-0.5">
                  {processBatchFilenames.map((name) => (
                    <li key={name} className="text-sm text-neutral-700 dark:text-neutral-300 flex items-center gap-2">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
                      {name}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Download */}
            <div className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-8 h-8 text-green-600 dark:text-green-400 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{processResult.outputFilename}</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">Sẵn sàng tải xuống</p>
                </div>
              </div>
              <Button onClick={handleDownload} className="gap-2">
                <Download className="w-4 h-4" />
                Tải xuống
              </Button>
            </div>

            {/* Warnings */}
            {processResult.warnings.length > 0 && (
              <div className="mt-4 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">Cảnh báo</p>
                  <ul className="mt-1 space-y-0.5">
                    {processResult.warnings.map((w, i) => (
                      <li key={i} className="text-sm text-neutral-600 dark:text-neutral-400">{w}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Reset */}
            <div className="mt-4 flex justify-end">
              <Button variant="outline" size="sm" onClick={handleResetProcess}>
                Xử lý batch khác
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Floating Action Bar */}
      {selectedCount > 0 && !isProcessing && processState !== 'success' && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 shadow-lg px-6 py-3 flex items-center justify-between transition-all">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Đã chọn: {selectedCount} batch
            </span>
            {processState === 'error' && (
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                <X className="w-4 h-4 mr-1" />
                Bỏ chọn
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={clearSelection}>
              <X className="w-4 h-4 mr-1" />
              Bỏ chọn
            </Button>
            <Button size="sm" onClick={handleProcessBatches} disabled={isProcessing}>
              <Loader2 className="w-4 h-4 mr-1.5" />
              Xử lý {selectedCount} batch đã chọn
            </Button>
          </div>
        </div>
      )}

      {/* Bottom padding when floating bar is visible */}
      {selectedCount > 0 && !isProcessing && processState !== 'success' && (
        <div className="h-16" />
      )}
    </div>
  );
}
