import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle, FileSpreadsheet, ChevronDown, ChevronRight, Truck, ShieldCheck, ShieldQuestion, CalendarDays, X, MapPin, Building2, Pencil, AlertTriangle, Ban, HelpCircle } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Pagination } from '../../../components/ui/Pagination';
import { useGetAccountantInvoices, useGetMissingSummary, useUpdateAccountantInvoice } from '../../../hooks/useAccountantInvoices';
import { useGetBatches } from '../../../hooks/useDeliveryData';
import type { AccountantInvoiceFilters, AccountantInvoice, MissingInvoice } from '../../../api/accountantInvoiceApi';

type TabId = 'all' | 'missing';

export function InvoiceMatchingPage() {
  const [searchParams] = useSearchParams();
  const initialBatchId = searchParams.get('batch_id') || '';

  const [tab, setTab] = useState<TabId>(initialBatchId ? 'all' : 'all');
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<AccountantInvoiceFilters>({
    page: 1,
    limit: 30,
    batch_id: initialBatchId || undefined,
  });
  const [editingInvoice, setEditingInvoice] = useState<AccountantInvoice | null>(null);

  useEffect(() => {
    if (initialBatchId) {
      setFilters((prev) => ({ ...prev, batch_id: initialBatchId, page: 1 }));
      setPage(1);
    }
  }, [initialBatchId]);

  const { data: batchesData } = useGetBatches(1, 100);
  const { data, isLoading, isError } = useGetAccountantInvoices(filters);
  const selectedBatchId = (filters.batch_id || batchesData?.data?.[0]?.batch_id) || '';

  const batchOptions = [
    { value: '', label: 'Tất cả batch' },
    ...(batchesData?.data.map((b) => ({
      value: b.batch_id,
      label: `${b.original_filename} (${b.total_rows} dòng)`,
    })) || []),
  ];

  const statusOptions = [
    { value: '', label: 'Tất cả trạng thái' },
    { value: 'đã có', label: 'Đã có' },
    { value: 'không có', label: 'Không có' },
    { value: 'xe không chạy', label: 'Xe không chạy' },
    { value: 'data sai', label: 'Data sai' },
    { value: 'data khác', label: 'Data khác' },
  ];

  const handleFilterChange = (key: keyof AccountantInvoiceFilters, value: string) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, [key]: value || undefined, page: 1 }));
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    setFilters((prev) => ({ ...prev, page: newPage }));
  };

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
          Đối chiếu hóa đơn
        </h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          Danh sách hóa đơn bóc tách từ dữ liệu import và kết quả đối chiếu với driver_invoices
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-neutral-200 dark:border-neutral-700">
        <button
          onClick={() => setTab('all')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'all'
              ? 'border-neutral-900 dark:border-neutral-100 text-neutral-900 dark:text-neutral-100'
              : 'border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-700'
          }`}
        >
          Tất cả hóa đơn
        </button>
        <button
          onClick={() => setTab('missing')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'missing'
              ? 'border-neutral-900 dark:border-neutral-100 text-neutral-900 dark:text-neutral-100'
              : 'border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-700'
          }`}
        >
          Hóa đơn thiếu
        </button>
      </div>

      {/* Tab: All Invoices */}
      {tab === 'all' && (
        <>
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <Select
                  options={batchOptions}
                  value={filters.batch_id || ''}
                  onChange={(e) => handleFilterChange('batch_id', e.target.value)}
                />
                <Input
                  placeholder="Từ ngày (YYYY-MM-DD)"
                  value={filters.ngay_from || ''}
                  onChange={(e) => handleFilterChange('ngay_from', e.target.value)}
                />
                <Input
                  placeholder="Đến ngày (YYYY-MM-DD)"
                  value={filters.ngay_to || ''}
                  onChange={(e) => handleFilterChange('ngay_to', e.target.value)}
                />
                <Input
                  placeholder="Số xe"
                  value={filters.so_xe || ''}
                  onChange={(e) => handleFilterChange('so_xe', e.target.value)}
                />
                <Input
                  placeholder="Số hóa đơn"
                  value={filters.so_hoa_don || ''}
                  onChange={(e) => handleFilterChange('so_hoa_don', e.target.value)}
                />
                <Select
                  options={statusOptions}
                  value={filters.trang_thai || ''}
                  onChange={(e) => handleFilterChange('trang_thai', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                  Danh sách hóa đơn
                </h2>
                {data && (
                  <span className="text-sm text-neutral-500">
                    {data.pagination.total.toLocaleString()} kết quả
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="py-12 text-center text-neutral-500">
                  <div className="animate-spin w-8 h-8 border-2 border-neutral-300 border-t-neutral-600 rounded-full mx-auto mb-3" />
                  Đang tải dữ liệu...
                </div>
              ) : isError ? (
                <div className="py-12 text-center text-red-500">Lỗi tải dữ liệu</div>
              ) : !data || data.data.length === 0 ? (
                <div className="py-12 text-center">
                  <FileSpreadsheet className="w-12 h-12 mx-auto text-neutral-300 dark:text-neutral-600 mb-3" />
                  <p className="text-neutral-500 dark:text-neutral-400">Chưa có dữ liệu hóa đơn</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-neutral-200 dark:border-neutral-700">
                          <th className="text-left py-3 px-2 font-medium text-neutral-500">Ngày</th>
                          <th className="text-left py-3 px-2 font-medium text-neutral-500">Số xe</th>
                          <th className="text-left py-3 px-2 font-medium text-neutral-500">Số HĐ</th>
                          <th className="text-left py-3 px-2 font-medium text-neutral-500">Khách hàng</th>
                          <th className="text-left py-3 px-2 font-medium text-neutral-500">Địa chỉ giao hàng</th>
                          <th className="text-left py-3 px-2 font-medium text-neutral-500">Nhà cung cấp</th>
                          <th className="text-left py-3 px-2 font-medium text-neutral-500">Trạng thái</th>
                          <th className="text-left py-3 px-2 font-medium text-neutral-500">Ghi chú</th>
                          <th className="text-left py-3 px-2 font-medium text-neutral-500 w-16"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.data.map((invoice) => (
                          <tr key={invoice.id} className="border-b border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                            <td className="py-2.5 px-2 text-neutral-900 dark:text-neutral-100 font-mono text-xs">{invoice.ngay}</td>
                            <td className="py-2.5 px-2 text-neutral-700 dark:text-neutral-300 font-mono">{invoice.so_xe}</td>
                            <td className="py-2.5 px-2 text-neutral-900 dark:text-neutral-100 font-mono">{invoice.so_hoa_don}</td>
                            <td className="py-2.5 px-2 text-neutral-600 dark:text-neutral-400 text-xs max-w-48 truncate" title={invoice.ten_kh || ''}>
                              {invoice.ten_kh || '—'}
                            </td>
                            <td className="py-2.5 px-2 text-neutral-600 dark:text-neutral-400 text-xs max-w-48 truncate" title={invoice.dia_chi || ''}>
                              {invoice.dia_chi || '—'}
                            </td>
                            <td className="py-2.5 px-2">
                              {invoice.nha_cung_cap ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400">
                                  {invoice.nha_cung_cap}
                                </span>
                              ) : (
                                <span className="text-neutral-400 dark:text-neutral-500 text-xs">—</span>
                              )}
                            </td>
                            <td className="py-2.5 px-2">
                              {invoice.trang_thai === 'đã có' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                                  <CheckCircle2 className="w-3 h-3" />Đã có
                                </span>
                              )}
                              {invoice.trang_thai === 'không có' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400">
                                  <XCircle className="w-3 h-3" />Không có
                                </span>
                              )}
                              {invoice.trang_thai === 'xe không chạy' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                                  <Ban className="w-3 h-3" />Xe không chạy
                                </span>
                              )}
                              {invoice.trang_thai === 'data sai' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                                  <AlertTriangle className="w-3 h-3" />Data sai
                                </span>
                              )}
                              {invoice.trang_thai === 'data khác' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
                                  <HelpCircle className="w-3 h-3" />Data khác
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-2 text-neutral-500 dark:text-neutral-400 text-xs max-w-32 truncate" title={invoice.ghi_chu || ''}>
                              {invoice.ghi_chu || '—'}
                            </td>
                            <td className="py-2.5 px-2">
                              {invoice.trang_thai !== 'đã có' && (
                                <button
                                  onClick={() => setEditingInvoice(invoice)}
                                  className="p-1 text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 rounded transition-colors"
                                  title="Sửa"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {data.pagination.totalPages > 1 && (
                    <div className="mt-4">
                      <Pagination
                        currentPage={data.pagination.page}
                        totalPages={data.pagination.totalPages}
                        totalItems={data.pagination.total}
                        pageSize={data.pagination.limit}
                        onPageChange={handlePageChange}
                      />
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Tab: Missing Invoices */}
      {tab === 'missing' && (
        <MissingInvoicesTab />
      )}

      {/* Edit Modal */}
      {editingInvoice && (
        <EditInvoiceModal
          invoice={editingInvoice}
          onClose={() => setEditingInvoice(null)}
          onSuccess={() => setEditingInvoice(null)}
        />
      )}
    </div>
  );
}

function MissingInvoicesTab() {
  const [viewMode, setViewMode] = useState<'vehicle' | 'month'>('vehicle');
  const [batchFilter, setBatchFilter] = useState<string>('');
  const [inCatalogFilter, setInCatalogFilter] = useState<string>('');
  const [expandedVehicles, setExpandedVehicles] = useState<Set<string>>(new Set());
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [selectedInvoice, setSelectedInvoice] = useState<MissingInvoice | null>(null);

  const { data: batchesData } = useGetBatches(1, 100);

  const catalogFilterValue = inCatalogFilter === ''
    ? undefined
    : inCatalogFilter === 'true';

  const batchId = batchFilter || undefined;
  const { data, isLoading } = useGetMissingSummary(batchId, catalogFilterValue);

  const toggle = (soXe: string) => {
    setExpandedVehicles((prev) => {
      const next = new Set(prev);
      if (next.has(soXe)) next.delete(soXe);
      else next.add(soXe);
      return next;
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-neutral-500">
          <div className="animate-spin w-8 h-8 border-2 border-neutral-300 border-t-neutral-600 rounded-full mx-auto mb-3" />
          Đang tải dữ liệu...
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <CheckCircle2 className="w-12 h-12 mx-auto text-green-400 mb-3" />
          <p className="text-neutral-500 dark:text-neutral-400">
            {inCatalogFilter !== ''
              ? 'Không có hóa đơn thiếu nào với bộ lọc này'
              : 'Tất cả hóa đơn đã có — không còn hóa đơn nào thiếu'}
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalMissing = data.reduce((s, v) => s + v.missing_count, 0);

  const catalogOptions = [
    { value: '', label: 'Tất cả danh mục' },
    { value: 'true', label: 'Có trong danh mục' },
    { value: 'false', label: 'Ngoài danh mục' },
  ];

  const batchOptions = [
    { value: '', label: 'Tất cả batch' },
    ...(batchesData?.data.map((b) => ({
      value: b.batch_id,
      label: `${b.original_filename} (${b.total_rows} dòng)`,
    })) || []),
  ];

  return (
    <Card>
      {/* View toggle + filters */}
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('vehicle')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                viewMode === 'vehicle'
                  ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-700'
              }`}
            >
              <Truck className="w-3.5 h-3.5 inline mr-1" />
              Theo số xe
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                viewMode === 'month'
                  ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-700'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5 inline mr-1" />
              Theo tháng
            </button>
          </div>
          <span className="text-sm text-neutral-500">
            {data.length} xe &middot; {totalMissing} hóa đơn thiếu
          </span>
        </div>
      </CardHeader>
      <CardHeader className="pt-2">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            {viewMode === 'vehicle' ? 'Hóa đơn thiếu theo số xe' : 'Hóa đơn thiếu theo tháng'}
          </h2>
          <div className="flex items-center gap-3">
            <Select
              options={batchOptions}
              value={batchFilter}
              onChange={(e) => setBatchFilter(e.target.value)}
              className="w-52"
            />
            <Select
              options={catalogOptions}
              value={inCatalogFilter}
              onChange={(e) => setInCatalogFilter(e.target.value)}
              className="w-48"
            />
          </div>
        </div>
      </CardHeader>

      {/* Vehicle View */}
      {viewMode === 'vehicle' && (
        <CardContent className="space-y-1">
          {data.map((vehicle) => (
            <div key={vehicle.so_xe} className="border border-neutral-200 dark:border-neutral-700 rounded-lg">
              <button
                onClick={() => toggle(vehicle.so_xe)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/50 rounded-lg transition-colors"
              >
                {expandedVehicles.has(vehicle.so_xe) ? (
                  <ChevronDown className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                )}
                <Truck className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                <span className="font-mono font-medium text-neutral-900 dark:text-neutral-100 flex-1">
                  {vehicle.so_xe}
                </span>
                {vehicle.in_catalog ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                    <ShieldCheck className="w-3 h-3" />Có trong DM
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                    <ShieldQuestion className="w-3 h-3" />Ngoài DM
                  </span>
                )}
                <span className="text-sm text-red-600 dark:text-red-400 font-medium">
                  {vehicle.missing_count} thiếu
                </span>
              </button>
              {expandedVehicles.has(vehicle.so_xe) && (
                <div className="border-t border-neutral-100 dark:border-neutral-800 px-4 py-2 bg-neutral-50 dark:bg-neutral-800/30 rounded-b-lg">
                  <div className="space-y-2">
                    {vehicle.dates.map((d) => (
                      <div key={d.ngay} className="pl-7">
                        <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">{d.ngay}</p>
                        <div className="space-y-1">
                          {d.invoices.map((inv) => (
                            <div key={inv.so_hoa_don} className="flex items-center gap-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); setSelectedInvoice(inv); }}
                                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-white dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition-colors"
                              >
                                {inv.so_hoa_don}
                              </button>
                              {inv.ten_kh && (
                                <span className="text-xs text-neutral-400 dark:text-neutral-500 truncate max-w-[300px]" title={inv.ten_kh}>
                                  {inv.ten_kh}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      )}

      {/* Month View */}
      {viewMode === 'month' && (
        <MonthView data={data} setSelectedInvoice={setSelectedInvoice} />
      )}

      {/* Invoice Detail Popup */}
      {selectedInvoice && (
        <InvoicePopup invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} />
      )}
    </Card>
  );
}

function MonthView({ data, setSelectedInvoice }: { data: MissingVehicle[]; setSelectedInvoice: (inv: MissingInvoice | null) => void }) {
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [expandedInMonth, setExpandedInMonth] = useState<Set<string>>(new Set());

  const toggleMonth = (key: string, setter: typeof setExpandedMonths) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const monthMap = new Map<string, { vehicles: Map<string, MissingVehicle>; totalMissing: number }>();

  for (const vehicle of data) {
    for (const d of vehicle.dates) {
      const month = d.ngay.substring(0, 7);
      if (!monthMap.has(month)) {
        monthMap.set(month, { vehicles: new Map(), totalMissing: 0 });
      }
      const entry = monthMap.get(month)!;
      if (!entry.vehicles.has(vehicle.so_xe)) {
        entry.vehicles.set(vehicle.so_xe, { ...vehicle, dates: [] });
      }
      entry.vehicles.get(vehicle.so_xe)!.dates.push(d);
      entry.totalMissing += d.invoices.length;
    }
  }

  const sortedMonths = Array.from(monthMap.entries()).sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <CardContent className="space-y-2">
      {sortedMonths.map(([month, entry]) => (
        <div key={month} className="border border-neutral-200 dark:border-neutral-700 rounded-lg">
          <button
            onClick={() => toggleMonth(month, setExpandedMonths)}
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/50 rounded-lg transition-colors"
          >
            {expandedMonths.has(month) ? (
              <ChevronDown className="w-4 h-4 text-neutral-400 flex-shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 text-neutral-400 flex-shrink-0" />
            )}
            <CalendarDays className="w-4 h-4 text-neutral-400 flex-shrink-0" />
            <span className="font-medium text-neutral-900 dark:text-neutral-100 flex-1">
              {month}
            </span>
            <span className="text-sm text-neutral-500">
              {entry.vehicles.size} xe &middot;
            </span>
            <span className="text-sm text-red-600 dark:text-red-400 font-medium">
              {entry.totalMissing} thiếu
            </span>
          </button>
          {expandedMonths.has(month) && (
            <div className="border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/30 rounded-b-lg">
              {Array.from(entry.vehicles.entries()).map(([soXe, vehicle]) => (
                <div key={soXe}>
                  <button
                    onClick={() => toggleMonth(month + '|' + soXe, setExpandedInMonth)}
                    className="w-full flex items-center gap-3 pl-8 pr-4 py-2 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-sm"
                  >
                    <Truck className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
                    <span className="font-mono text-neutral-700 dark:text-neutral-300 flex-1">{soXe}</span>
                    {vehicle.in_catalog ? (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                        <ShieldCheck className="w-2.5 h-2.5" />DM
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                        <ShieldQuestion className="w-2.5 h-2.5" />DM
                      </span>
                    )}
                    <span className="text-xs text-red-600 dark:text-red-400">
                      {vehicle.dates.reduce((s, d) => s + d.invoices.length, 0)} thiếu
                    </span>
                  </button>
                  {expandedInMonth.has(month + '|' + soXe) && (
                    <div className="pl-12 pr-4 py-1 space-y-1.5">
                      {vehicle.dates.map((d) => (
                        <div key={d.ngay}>
                          <p className="text-[11px] font-medium text-neutral-400 mb-0.5">{d.ngay}</p>
                          <div className="space-y-0.5">
                            {d.invoices.map((inv) => (
                              <div key={inv.so_hoa_don} className="flex items-center gap-2">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setSelectedInvoice(inv); }}
                                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono bg-white dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 text-neutral-600 dark:text-neutral-400 hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition-colors"
                                >
                                  {inv.so_hoa_don}
                                </button>
                                {inv.ten_kh && (
                                  <span className="text-[11px] text-neutral-400 dark:text-neutral-500 truncate max-w-[200px]" title={inv.ten_kh}>
                                    {inv.ten_kh}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </CardContent>
  );
}

function EditInvoiceModal({ invoice, onClose, onSuccess }: { invoice: AccountantInvoice; onClose: () => void; onSuccess: () => void }) {
  const updateMutation = useUpdateAccountantInvoice();
  const [trangThai, setTrangThai] = useState(invoice.trang_thai);
  const [ghiChu, setGhiChu] = useState(invoice.ghi_chu || '');
  const [soXe, setSoXe] = useState(invoice.so_xe);

  const statusOptionsEdit = [
    { value: 'không có', label: 'Không có' },
    { value: 'xe không chạy', label: 'Xe không chạy' },
    { value: 'data sai', label: 'Data sai' },
    { value: 'data khác', label: 'Data khác' },
  ];

  const handleSubmit = async () => {
    try {
      await updateMutation.mutateAsync({
        id: invoice.id,
        data: { trang_thai: trangThai, ghi_chu: ghiChu || null, so_xe: soXe },
      });
      onSuccess();
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">Sửa hóa đơn</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-neutral-400 dark:text-neutral-500">Số HĐ</span>
              <p className="font-mono font-medium text-neutral-900 dark:text-neutral-100">{invoice.so_hoa_don}</p>
            </div>
            <div>
              <span className="text-neutral-400 dark:text-neutral-500">Ngày</span>
              <p className="text-neutral-700 dark:text-neutral-300">{invoice.ngay}</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Số xe</label>
            <Input
              placeholder="Nhập số xe..."
              value={soXe}
              onChange={(e) => setSoXe(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Trạng thái</label>
            <select
              value={trangThai}
              onChange={(e) => setTrangThai(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100"
            >
              {statusOptionsEdit.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Ghi chú</label>
            <Input
              placeholder="Nhập ghi chú..."
              value={ghiChu}
              onChange={(e) => setGhiChu(e.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-neutral-200 dark:border-neutral-800">
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button onClick={handleSubmit} isLoading={updateMutation.isPending}>Lưu</Button>
        </div>
      </div>
    </div>
  );
}

function InvoicePopup({ invoice, onClose }: { invoice: MissingInvoice; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-700 w-full max-w-md mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 dark:border-neutral-800">
          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
            Số hóa đơn: <span className="font-mono text-blue-600 dark:text-blue-400">{invoice.so_hoa_don}</span>
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          {invoice.ten_kh && (
            <div className="flex items-start gap-3">
              <Building2 className="w-4 h-4 text-neutral-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-neutral-400 dark:text-neutral-500">Khách hàng</p>
                <p className="text-sm text-neutral-900 dark:text-neutral-100">{invoice.ten_kh}</p>
              </div>
            </div>
          )}
          {invoice.dia_chi && (
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-neutral-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-neutral-400 dark:text-neutral-500">Địa chỉ giao hàng</p>
                <p className="text-sm text-neutral-900 dark:text-neutral-100">{invoice.dia_chi}</p>
              </div>
            </div>
          )}
          {invoice.nha_cung_cap && (
            <div className="flex items-start gap-3">
              <Truck className="w-4 h-4 text-neutral-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-neutral-400 dark:text-neutral-500">Nhà cung cấp</p>
                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{invoice.nha_cung_cap}</p>
              </div>
            </div>
          )}
          {!invoice.ten_kh && !invoice.dia_chi && !invoice.nha_cung_cap && (
            <p className="text-sm text-neutral-400 text-center py-4">Không có thông tin chi tiết</p>
          )}
        </div>
      </div>
    </div>
  );
}
