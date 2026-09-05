import { useState, useRef, useCallback } from 'react';
import {
  Upload,
  Download,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';
import { cn } from '../../utils/cn';
import {
  parseDeliveryFile,
  processDeliveryDataFromRows,
  type ProcessResult,
  type ParsedFileData,
  type RawRow,
  buildAdjustments,
  filterExcludedRows,
  applyAdjustments,
  type AdjustmentRow,
} from '../../utils/processDeliveryData';
import { weightAdjustmentApi } from '../../api/weightAdjustmentApi';
import { customersApi, type Customer } from '../../api/customersApi';
import { innerCityCustomerApi } from '../../api/innerCityCustomerApi';
import { promoItemApi, type PromoItem } from '../../api/promoItemApi';
import {
  WeightAdjustmentConfirmDialog,
} from '../../components/delivery-data/WeightAdjustmentConfirmDialog';

type PageState = 'idle' | 'verifying' | 'awaiting_confirmation' | 'processing' | 'success' | 'error';

export function DeliveryDataPage() {
  const [pageState, setPageState] = useState<PageState>('idle');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [excludedRowCount, setExcludedRowCount] = useState<number>(0);
  const [parsedFileData, setParsedFileData] = useState<ParsedFileData | null>(null);
  const [adjustments, setAdjustments] = useState<AdjustmentRow[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback((file: File) => {
    if (file.name.endsWith('.xlsx')) {
      setSelectedFile(file);
      setErrorMessage('');
    } else {
      alert('Chỉ chấp nhận file .xlsx');
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileChange(file);
    },
    [handleFileChange]
  );

  const customersRef = useRef<Customer[]>([]);
  const innerCityNamesRef = useRef<Set<string>>(new Set());
  const promoItemsRef = useRef<PromoItem[]>([]);

  const runProcess = useCallback(async (rows: RawRow[], nums: number[]) => {
    setPageState('processing');
    try {
      const processResult = await processDeliveryDataFromRows(rows, nums, customersRef.current, innerCityNamesRef.current, promoItemsRef.current);
      setResult(processResult);
      setPageState('success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lỗi xử lý file. Vui lòng thử lại.';
      setErrorMessage(msg);
      setPageState('error');
    }
  }, []);

  const handleProcess = useCallback(async () => {
    if (!selectedFile) return;
    setPageState('verifying');
    setErrorMessage('');
    try {
      const parsed = await parseDeliveryFile(selectedFile);

      // BƯỚC 1.5 — Lọc dòng có Diễn giải chứa "thay thế" hoặc "điều chỉnh"
      const { filteredRows, filteredSourceRowNums, excludedCount } = filterExcludedRows(
        parsed.rawRows,
        parsed.sourceRowNums
      );
      setExcludedRowCount(excludedCount);
      const effectiveParsed = { rawRows: filteredRows, sourceRowNums: filteredSourceRowNums };

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
      const found = buildAdjustments(effectiveParsed.rawRows, effectiveParsed.sourceRowNums, masterMap);

      if (found.length === 0) {
        await runProcess(effectiveParsed.rawRows, effectiveParsed.sourceRowNums);
      } else {
        setParsedFileData(effectiveParsed);
        setAdjustments(found);
        setPageState('awaiting_confirmation');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lỗi kiểm tra dữ liệu. Vui lòng thử lại.';
      setErrorMessage(msg);
      setPageState('error');
    }
  }, [selectedFile, runProcess]);

  const handleConfirmAdjustments = useCallback(async () => {
    if (!parsedFileData) return;
    const modifiedRows = applyAdjustments(parsedFileData.rawRows, adjustments);
    await runProcess(modifiedRows, parsedFileData.sourceRowNums);
  }, [parsedFileData, adjustments, runProcess]);

  const handleSkipAdjustments = useCallback(async () => {
    if (!parsedFileData) return;
    await runProcess(parsedFileData.rawRows, parsedFileData.sourceRowNums);
  }, [parsedFileData, runProcess]);

  const handleDownload = useCallback(() => {
    if (!result) return;
    const url = window.URL.createObjectURL(result.outputBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.outputFilename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }, [result]);

  const handleReset = useCallback(() => {
    setPageState('idle');
    setSelectedFile(null);
    setResult(null);
    setErrorMessage('');
    setExcludedRowCount(0);
    setParsedFileData(null);
    setAdjustments([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const isSpinnerState = pageState === 'verifying' || pageState === 'processing';
  const spinnerText = pageState === 'verifying' ? 'Đang kiểm tra dữ liệu...' : 'Đang xử lý...';

  return (
    <div className="p-8 max-w-3xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Xử lý Data Giao Hàng</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          Upload file Excel ERP giao hàng để phân nhóm và xuất file chuẩn.
        </p>
      </div>

      {/* Upload Zone */}
      {(pageState === 'idle' || isSpinnerState || pageState === 'error' || pageState === 'awaiting_confirmation') && (
        <Card>
          <CardContent className="pt-6">
            <div
              className={cn(
                'border-2 border-dashed rounded-lg p-10 text-center transition-colors cursor-pointer',
                isSpinnerState || pageState === 'awaiting_confirmation'
                  ? 'border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 pointer-events-none'
                  : isDragOver
                    ? 'border-neutral-800 dark:border-neutral-300 bg-neutral-50 dark:bg-neutral-800/50'
                    : 'border-neutral-300 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800/30'
              )}
              onDragOver={(e) => {
                e.preventDefault();
                if (!isSpinnerState && pageState !== 'awaiting_confirmation') setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => !isSpinnerState && pageState !== 'awaiting_confirmation' && fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileChange(file);
                }}
              />

              {isSpinnerState ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-10 h-10 text-neutral-600 dark:text-neutral-400 animate-spin" />
                  <p className="text-base font-medium text-neutral-700 dark:text-neutral-300">{spinnerText}</p>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Vui lòng đợi trong giây lát</p>
                </div>
              ) : (
                <>
                  <FileSpreadsheet
                    className={cn(
                      'w-10 h-10 mx-auto mb-3',
                      isDragOver ? 'text-neutral-800 dark:text-neutral-200' : 'text-neutral-400 dark:text-neutral-500'
                    )}
                  />
                  <p className="text-base font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Kéo thả file Excel vào đây
                  </p>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">hoặc click để chọn file</p>

                  {selectedFile ? (
                    <>
                      <div className="flex items-center justify-center gap-2 mb-4 px-4 py-2 bg-neutral-100 dark:bg-neutral-700 rounded-lg w-fit mx-auto">
                        <FileSpreadsheet className="w-4 h-4 text-neutral-700 dark:text-neutral-300 shrink-0" />
                        <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200 truncate max-w-xs">
                          {selectedFile.name}
                        </span>
                      </div>
                      <div className="flex items-center justify-center gap-3">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFile(null);
                            if (fileInputRef.current) fileInputRef.current.value = '';
                          }}
                        >
                          Đổi file
                        </Button>
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleProcess();
                          }}
                        >
                          <Upload className="w-4 h-4 mr-1.5" />
                          Xử lý
                        </Button>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-neutral-400 dark:text-neutral-500">Hỗ trợ file .xlsx</p>
                  )}
                </>
              )}
            </div>

            {pageState === 'error' && errorMessage && (
              <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-red-800 dark:text-red-300">Lỗi xử lý</p>
                    <p className="text-sm text-red-600 dark:text-red-400 mt-0.5">{errorMessage}</p>
                  </div>
                </div>
              </div>
            )}

            {pageState === 'error' && (
              <div className="mt-4 flex justify-end">
                <Button variant="outline" size="sm" onClick={handleReset}>
                  Thử lại
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Weight Adjustment Confirmation Dialog */}
      <WeightAdjustmentConfirmDialog
        isOpen={pageState === 'awaiting_confirmation'}
        adjustments={adjustments}
        onConfirm={handleConfirmAdjustments}
        onSkip={handleSkipAdjustments}
      />

      {/* Success Result */}
      {pageState === 'success' && result && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500 dark:text-green-400" />
                <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">Xử lý thành công</h2>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">Số dòng</p>
                  <p className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                    {result.processedRows.toLocaleString()}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">Số nhóm</p>
                  <p className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                    {result.groupCount.toLocaleString()}
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
                <div className={cn(
                  'p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700',
                  excludedRowCount > 0 ? '' : 'col-span-2'
                )}>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">Khoảng ngày</p>
                  <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    {result.dateRange.from} → {result.dateRange.to}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="w-8 h-8 text-green-600 dark:text-green-400 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{result.outputFilename}</p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">Sẵn sàng tải xuống</p>
                  </div>
                </div>
                <Button onClick={handleDownload} className="gap-2">
                  <Download className="w-4 h-4" />
                  Tải xuống
                </Button>
              </div>
            </CardContent>
          </Card>

          {result.warnings.length > 0 && (
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">Cảnh báo</p>
                    <ul className="mt-1 space-y-0.5">
                      {result.warnings.map((w, i) => (
                        <li key={i} className="text-sm text-neutral-600 dark:text-neutral-400">{w}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={handleReset}>
              Xử lý file mới
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
