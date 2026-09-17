import { useState, useRef, useCallback } from 'react';
import {
  Download,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Filter,
  XCircle,
  Info,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';
import { cn } from '../../utils/cn';
import {
  parseRiceFile,
  filterRiceData,
  buildMasterPlateMap,
  exportRiceResult,
  type RiceDataRow,
  type FilterResult,
} from '../../utils/processRiceData';
import { riceDeliveryApi } from '../../api/riceDeliveryApi';

// ─── Types ────────────────────────────────────────────────────────────────────

type PageState =
  | 'idle'
  | 'parsing'
  | 'fetching_master'
  | 'filtering'
  | 'success'
  | 'error';

type ViewTab = 'matched' | 'unmatched' | 'unknown_plates';

// ─── Helper ───────────────────────────────────────────────────────────────────

function formatDate(d: string) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function formatTon(n: number) {
  return n.toLocaleString('vi-VN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: 'green' | 'red' | 'neutral';
}) {
  const colors = {
    green: 'text-green-600 dark:text-green-400',
    red: 'text-red-500 dark:text-red-400',
    neutral: 'text-neutral-900 dark:text-neutral-100',
  };
  return (
    <div className="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
      <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">{label}</p>
      <p className={cn('text-2xl font-bold', colors[accent ?? 'neutral'])}>{value}</p>
      {sub && <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function ResultTable({ rows, emptyText }: { rows: RiceDataRow[]; emptyText: string }) {
  if (rows.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-neutral-400 dark:text-neutral-500">
        {emptyText}
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-neutral-50 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
            <th className="text-left px-3 py-2 font-medium text-neutral-600 dark:text-neutral-400 whitespace-nowrap">STT</th>
            <th className="text-left px-3 py-2 font-medium text-neutral-600 dark:text-neutral-400 whitespace-nowrap">Ngày</th>
            <th className="text-left px-3 py-2 font-medium text-neutral-600 dark:text-neutral-400 whitespace-nowrap">Số xe</th>
            <th className="text-left px-3 py-2 font-medium text-neutral-600 dark:text-neutral-400 whitespace-nowrap">Mã SP</th>
            <th className="text-left px-3 py-2 font-medium text-neutral-600 dark:text-neutral-400 min-w-[180px]">Tên sản phẩm</th>
            <th className="text-left px-3 py-2 font-medium text-neutral-600 dark:text-neutral-400 min-w-[120px]">Đại lý</th>
            <th className="text-right px-3 py-2 font-medium text-neutral-600 dark:text-neutral-400 whitespace-nowrap">Số tấn</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={r.sourceRowNum}
              className={cn(
                'border-b border-neutral-100 dark:border-neutral-800',
                i % 2 === 0
                  ? 'bg-white dark:bg-neutral-900'
                  : 'bg-neutral-50/50 dark:bg-neutral-800/30'
              )}
            >
              <td className="px-3 py-1.5 text-neutral-400 dark:text-neutral-600 text-xs">{r.sourceRowNum}</td>
              <td className="px-3 py-1.5 whitespace-nowrap text-neutral-700 dark:text-neutral-300">{formatDate(r.ngay)}</td>
              <td className="px-3 py-1.5 font-mono text-xs whitespace-nowrap text-neutral-800 dark:text-neutral-200">{r.soXeRaw}</td>
              <td className="px-3 py-1.5 text-neutral-600 dark:text-neutral-400 text-xs whitespace-nowrap">{r.maSanPham}</td>
              <td className="px-3 py-1.5 text-neutral-800 dark:text-neutral-200">{r.tenSanPham}</td>
              <td className="px-3 py-1.5 text-neutral-600 dark:text-neutral-400">{r.daiLy}</td>
              <td className="px-3 py-1.5 text-right text-neutral-800 dark:text-neutral-200 tabular-nums">
                {r.soTan !== null ? r.soTan.toLocaleString('vi-VN', { minimumFractionDigits: 3 }) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function RiceDeliveryDataPage() {
  const [pageState, setPageState] = useState<PageState>('idle');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [filterResult, setFilterResult] = useState<FilterResult | null>(null);
  const [_originalHeaders, setOriginalHeaders] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<{ from: string; to: string } | null>(null);
  const [masterCount, setMasterCount] = useState(0);
  const [activeTab, setActiveTab] = useState<ViewTab>('matched');
  const [exportBlob, setExportBlob] = useState<{ blob: Blob; filename: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── File handling ──────────────────────────────────────────────────────

  const handleFileChange = useCallback((file: File) => {
    if (file.name.endsWith('.xlsx')) {
      setSelectedFile(file);
      setErrorMessage('');
      setFilterResult(null);
      setExportBlob(null);
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

  // ─── Process ────────────────────────────────────────────────────────────

  const handleProcess = useCallback(async () => {
    if (!selectedFile) return;

    try {
      // Step 1: Parse file
      setPageState('parsing');
      const parsed = await parseRiceFile(selectedFile);
      setOriginalHeaders(parsed.headers);
      setDateRange(parsed.dateRange);

      if (parsed.rows.length === 0) {
        setErrorMessage('File không có dữ liệu hợp lệ (kiểm tra ngày và biển số).');
        setPageState('error');
        return;
      }

      if (!parsed.dateRange) {
        setErrorMessage('Không xác định được khoảng ngày trong file.');
        setPageState('error');
        return;
      }

      // Step 2: Fetch master data from DB
      setPageState('fetching_master');
      const masterResult = await riceDeliveryApi.fetchPlatesForRange(
        parsed.dateRange.from,
        parsed.dateRange.to
      );
      setMasterCount(masterResult.totalFetched);

      if (masterResult.totalFetched === 0) {
        setErrorMessage(
          `Không tìm thấy hóa đơn tài xế nào trong khoảng ${formatDate(parsed.dateRange.from)} – ${formatDate(parsed.dateRange.to)}. ` +
          `Vui lòng upload hóa đơn tài xế trước tại mục "Hóa đơn tài xế".`
        );
        setPageState('error');
        return;
      }

      // Step 3: Filter
      setPageState('filtering');
      const masterMap = buildMasterPlateMap(masterResult.schedules);
      const result = filterRiceData(parsed.rows, masterMap);
      setFilterResult(result);

      // Step 4: Build export blob
      const exported = await exportRiceResult(result, parsed.headers, parsed.rows);
      setExportBlob(exported);

      setPageState('success');
      setActiveTab('matched');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lỗi xử lý. Vui lòng thử lại.';
      setErrorMessage(msg);
      setPageState('error');
    }
  }, [selectedFile]);

  const handleDownload = useCallback(() => {
    if (!exportBlob) return;
    const url = window.URL.createObjectURL(exportBlob.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = exportBlob.filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }, [exportBlob]);

  const handleReset = useCallback(() => {
    setPageState('idle');
    setSelectedFile(null);
    setFilterResult(null);
    setExportBlob(null);
    setErrorMessage('');
    setDateRange(null);
    setMasterCount(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  // ─── Spinner text ────────────────────────────────────────────────────────

  const spinnerMap: Record<string, string> = {
    parsing: 'Đang đọc file dữ liệu...',
    fetching_master: 'Đang tải hóa đơn tài xế từ hệ thống...',
    filtering: 'Đang lọc và so khớp biển số...',
  };
  const isSpinner = pageState in spinnerMap;

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
            Xử lý Data Gạo
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Upload file <code className="bg-neutral-100 dark:bg-neutral-800 px-1 rounded text-xs">data_gao.xlsx</code> để lọc ra những xe có biển số + ngày chạy nằm trong hóa đơn tài xế.
          </p>
        </div>

        {/* Info banner */}
        <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
          <p className="text-sm text-blue-700 dark:text-blue-300">
            Hệ thống sẽ tự động đọc <strong>hóa đơn tài xế</strong> từ DB (theo khoảng ngày trong file upload) và so khớp biển số.
            Đảm bảo đã upload hóa đơn tài xế đầy đủ tại <strong>Dữ liệu xe &gt; Hóa đơn tài xế</strong>.
          </p>
        </div>

        {/* Upload Card */}
        {(pageState === 'idle' || isSpinner || pageState === 'error') && (
          <Card>
            <CardContent className="pt-6">
              <div
                className={cn(
                  'border-2 border-dashed rounded-lg p-10 text-center transition-colors cursor-pointer',
                  isSpinner
                    ? 'border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 pointer-events-none'
                    : isDragOver
                      ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/10'
                      : 'border-neutral-300 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800/30'
                )}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (!isSpinner) setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => !isSpinner && fileInputRef.current?.click()}
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

                {isSpinner ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-10 h-10 text-neutral-500 dark:text-neutral-400 animate-spin" />
                    <p className="text-base font-medium text-neutral-700 dark:text-neutral-300">
                      {spinnerMap[pageState]}
                    </p>
                    <p className="text-sm text-neutral-400 dark:text-neutral-500">
                      Vui lòng đợi trong giây lát
                    </p>
                  </div>
                ) : (
                  <>
                    <FileSpreadsheet
                      className={cn(
                        'w-10 h-10 mx-auto mb-3',
                        isDragOver
                          ? 'text-blue-500 dark:text-blue-400'
                          : 'text-neutral-400 dark:text-neutral-500'
                      )}
                    />
                    <p className="text-base font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      Kéo thả file <code className="text-sm">data_gao.xlsx</code> vào đây
                    </p>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
                      hoặc click để chọn file
                    </p>

                    {selectedFile ? (
                      <>
                        <div className="inline-flex items-center gap-2 mb-4 px-4 py-2 bg-neutral-100 dark:bg-neutral-700 rounded-lg">
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
                              setFilterResult(null);
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
                            <Filter className="w-4 h-4 mr-1.5" />
                            Xử lý &amp; Lọc
                          </Button>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-neutral-400 dark:text-neutral-500">
                        Hỗ trợ file .xlsx — Sheet "Data xuất"
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Error message */}
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

        {/* Success Result */}
        {pageState === 'success' && filterResult && (
          <div className="space-y-4">

            {/* Summary stats */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-500 dark:text-green-400" />
                    <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                      Kết quả lọc
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    {exportBlob && (
                      <Button size="sm" onClick={handleDownload} className="gap-1.5">
                        <Download className="w-4 h-4" />
                        Xuất Excel
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={handleReset}>
                      Xử lý file mới
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Meta info */}
                <div className="flex flex-wrap gap-3 mb-5 text-sm text-neutral-500 dark:text-neutral-400">
                  {dateRange && (
                    <span>
                      📅 Khoảng ngày trong file:{' '}
                      <strong className="text-neutral-700 dark:text-neutral-300">
                        {formatDate(dateRange.from)} – {formatDate(dateRange.to)}
                      </strong>
                    </span>
                  )}
                  <span>
                    📋 Hóa đơn tài xế đã tải:{' '}
                    <strong className="text-neutral-700 dark:text-neutral-300">
                      {masterCount.toLocaleString()} xe/ngày
                    </strong>
                  </span>
                </div>

                {/* Stat cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <StatCard
                    label="Dòng khớp lịch"
                    value={filterResult.totalMatched.toLocaleString()}
                    sub={`${formatTon(filterResult.totalTonMatched)} tấn`}
                    accent="green"
                  />
                  <StatCard
                    label="Dòng không khớp"
                    value={filterResult.totalUnmatched.toLocaleString()}
                    sub={`${formatTon(filterResult.totalTonUnmatched)} tấn`}
                    accent="red"
                  />
                  <StatCard
                    label="Tổng dòng"
                    value={(filterResult.totalMatched + filterResult.totalUnmatched).toLocaleString()}
                    accent="neutral"
                  />
                  <StatCard
                    label="Biển số không có trong lịch"
                    value={filterResult.unknownPlates.length}
                    accent={filterResult.unknownPlates.length > 0 ? 'red' : 'neutral'}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Tab result table */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-1">
                  {[
                    {
                      id: 'matched' as ViewTab,
                      label: `Khớp lịch (${filterResult.totalMatched.toLocaleString()})`,
                    },
                    {
                      id: 'unmatched' as ViewTab,
                      label: `Không khớp (${filterResult.totalUnmatched.toLocaleString()})`,
                    },
                    {
                      id: 'unknown_plates' as ViewTab,
                      label: `Biển số lạ (${filterResult.unknownPlates.length})`,
                    },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
                        activeTab === tab.id
                          ? 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900'
                          : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {activeTab === 'matched' && (
                  <ResultTable
                    rows={filterResult.matched}
                    emptyText="Không có dòng nào khớp lịch."
                  />
                )}
                {activeTab === 'unmatched' && (
                  <ResultTable
                    rows={filterResult.unmatched}
                    emptyText="Tất cả dòng đều khớp lịch."
                  />
                )}
                {activeTab === 'unknown_plates' && (
                  <div className="p-6">
                    {filterResult.unknownPlates.length === 0 ? (
                      <p className="text-center text-sm text-neutral-400 dark:text-neutral-500 py-6">
                        Tất cả biển số đều có trong hóa đơn tài xế. ✅
                      </p>
                    ) : (
                      <>
                        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
                          Những biển số này xuất hiện trong file data gạo nhưng <strong>không có trong hóa đơn tài xế</strong> của bất kỳ ngày nào trong khoảng{' '}
                          {dateRange ? `${formatDate(dateRange.from)} – ${formatDate(dateRange.to)}` : ''}.
                          Cần kiểm tra lại.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {filterResult.unknownPlates.map((p) => (
                            <span
                              key={p}
                              className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm font-mono text-red-700 dark:text-red-400"
                            >
                              <XCircle className="w-3 h-3" />
                              {p}
                            </span>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Export reminder */}
            {exportBlob && (
              <div className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="w-8 h-8 text-green-600 dark:text-green-400 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                      {exportBlob.filename}
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      3 sheets: Khớp lịch · Không khớp · Thống kê
                    </p>
                  </div>
                </div>
                <Button onClick={handleDownload} className="gap-2">
                  <Download className="w-4 h-4" />
                  Tải xuống
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
