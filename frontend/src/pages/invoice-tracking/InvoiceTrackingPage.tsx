import { useState, useMemo, useEffect } from 'react';
import { useI18n } from '../../i18n/useI18n';
import {
  Search,
  RefreshCw,
  Shield,
  User,
  Calendar,
  MapPin,
  ChevronRight,
  FileCheck,
  FileText,
  X,
  List,
  BarChart3,
} from 'lucide-react';
import { useInvoiceTracking } from '../../hooks/useInvoiceTracking';
import { useMyDataScopes } from '../../hooks/useDataScopes';
import { InvoiceStatusBadge } from '../../components/invoice-tracking/InvoiceStatusBadge';
import { TicketDetailModal } from '../../components/invoice-tracking/TicketDetailModal';
import { InvoiceTrackingStatsTab } from '../../components/invoice-tracking/InvoiceTrackingStatsTab';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../../components/ui/Table';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';
import { formatDate } from '../../utils/format';
import type { InvoiceTrackingTicket } from '../../api/invoiceTrackingApi';

const PAGE_SIZE = 20;

export default function InvoiceTrackingPage() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<'list' | 'stats'>('list');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [selectedTicket, setSelectedTicket] = useState<InvoiceTrackingTicket | null>(null);

  // Debounce search input by 350ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 350);

    return () => clearTimeout(handler);
  }, [searchInput]);

  const { data: myScopes } = useMyDataScopes();
  const invoiceScope = myScopes?.invoice_tracking;

  const filters = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      status: statusFilter.length > 0 ? statusFilter : undefined,
      page,
      limit: PAGE_SIZE,
    }),
    [debouncedSearch, statusFilter, page],
  );

  const { data, isLoading, isError, refetch, isFetching } = useInvoiceTracking(filters);

  const statusOptions = useMemo(
    () => [
      { value: '', label: t('invoice_tracking.filter.statusAll') },
      { value: 'created', label: t('invoice_tracking.filter.statusCreated') },
      { value: 'pending_review', label: t('invoice_tracking.filter.statusPendingReview') },
      { value: 'completed', label: t('invoice_tracking.filter.statusCompleted') },
      { value: 'request_supplement', label: t('invoice_tracking.filter.statusRequestSupplement') },
    ],
    [t],
  );

  const handleStatusChange = (value: string) => {
    setStatusFilter(value ? [value] : []);
    setPage(1);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setDebouncedSearch('');
    setPage(1);
  };

  if (isError) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-center py-16 text-center">
        <p className="text-neutral-600 dark:text-neutral-400 font-medium">{t('invoice_tracking.page.error')}</p>
        <Button variant="outline" onClick={() => refetch()} className="mt-4 min-h-[44px]">
          <RefreshCw className="mr-2 h-4 w-4" />
          {t('invoice_tracking.page.retry')}
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 w-full">
      {/* Header & Data Scope Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-neutral-100">
              {t('invoice_tracking.page.title')}
            </h1>
            {isFetching && !isLoading && (
              <RefreshCw className="w-4 h-4 text-neutral-400 animate-spin" />
            )}
          </div>
          <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
            Quản lý và tra cứu trạng thái chứng từ / hóa đơn chuyến hàng
          </p>
        </div>

        {invoiceScope && invoiceScope.scope_type === 'owner' && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-purple-800 dark:text-purple-300 rounded-lg text-xs font-medium self-start sm:self-auto">
            <User className="w-3.5 h-3.5 shrink-0" />
            <span>Phạm vi: Dữ liệu cá nhân (Chuyến của tôi)</span>
          </div>
        )}

        {invoiceScope && invoiceScope.scope_type === 'entity' && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-300 rounded-lg text-xs font-medium self-start sm:self-auto">
            <User className="w-3.5 h-3.5 shrink-0" />
            <span>
              Phạm vi: {invoiceScope.entity_names?.join(', ') || `${invoiceScope.entity_ids?.length || 0} đối tượng`}
            </span>
          </div>
        )}
      </div>

      {/* Tabs Switcher Navigation */}
      {(!invoiceScope || invoiceScope.scope_type !== 'none') && (
        <div className="flex items-center gap-2 border-b border-neutral-200 dark:border-neutral-800">
          <button
            type="button"
            onClick={() => setActiveTab('list')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'list'
                ? 'border-neutral-900 dark:border-neutral-100 text-neutral-900 dark:text-neutral-100'
                : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200'
            }`}
          >
            <List className="w-4 h-4" />
            <span>{t('invoice_tracking.tabs.list')}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('stats')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'stats'
                ? 'border-neutral-900 dark:border-neutral-100 text-neutral-900 dark:text-neutral-100'
                : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>{t('invoice_tracking.tabs.statistics')}</span>
          </button>
        </div>
      )}

      {invoiceScope && invoiceScope.scope_type === 'none' ? (
        <Card>
          <CardContent className="py-12 px-4 text-center text-neutral-500">
            <Shield className="w-10 h-10 mx-auto text-neutral-400 mb-2" />
            <p className="font-medium text-sm text-neutral-800 dark:text-neutral-200">
              Bạn không có quyền xem dữ liệu của tính năng này.
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              Vui lòng liên hệ Quản trị viên để được phân quyền dữ liệu.
            </p>
          </CardContent>
        </Card>
      ) : activeTab === 'stats' ? (
        <InvoiceTrackingStatsTab />
      ) : (
        <Card className="overflow-hidden border border-neutral-200 dark:border-neutral-800 shadow-sm">
          {/* Responsive Filter Toolbar */}
          <CardHeader className="p-4 sm:p-5 border-b border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-900">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="flex-1 relative">
                <Input
                  placeholder={t('invoice_tracking.filter.searchPlaceholder')}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  prefix={<Search className="h-4 w-4 text-neutral-400" />}
                  className="w-full text-base sm:text-sm h-11 sm:h-10 pr-8"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                    title="Xóa tìm kiếm"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="w-full sm:w-56">
                <Select
                  value={statusFilter[0] || ''}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  options={statusOptions}
                  className="w-full text-base sm:text-sm h-11 sm:h-10"
                />
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0 sm:p-4">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-16 sm:h-12 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-800" />
                ))}
              </div>
            ) : !data?.items.length ? (
              <div className="py-16 px-4 text-center">
                <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-3">
                  <FileCheck className="w-6 h-6 text-neutral-400" />
                </div>
                <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">{t('invoice_tracking.page.empty')}</p>
                <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
                  Thử tìm kiếm với từ khóa khác hoặc thay đổi bộ lọc trạng thái
                </p>
              </div>
            ) : (
              <>
                {/* Mobile View: Card List (< md) */}
                <div className="md:hidden divide-y divide-neutral-100 dark:divide-neutral-800">
                  {data.items.map((ticket, idx) => (
                    <div
                      key={ticket.id}
                      onClick={() => setSelectedTicket(ticket)}
                      className="p-4 active:bg-neutral-50 dark:active:bg-neutral-800/60 transition-colors cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                            #{ (page - 1) * PAGE_SIZE + idx + 1 }
                          </span>
                          <span className="font-semibold text-base text-neutral-900 dark:text-neutral-100">
                            {ticket.bien_so}
                          </span>
                        </div>
                        <InvoiceStatusBadge status={ticket.invoice_status} />
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs text-neutral-600 dark:text-neutral-400 mt-2.5">
                        <div className="flex items-center gap-1.5 truncate">
                          <Calendar className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                          <span className="truncate">{formatDate(ticket.ngay)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 truncate">
                          <User className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                          <span className="truncate font-medium text-neutral-800 dark:text-neutral-200">
                            {ticket.tai_xe || 'Chưa gán'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 truncate col-span-2">
                          <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                          <span className="truncate">{ticket.diem_nhan || '—'}</span>
                        </div>
                        {ticket.ghi_chu && (
                          <div className="flex items-start gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 col-span-2 mt-0.5">
                            <FileText className="w-3.5 h-3.5 text-neutral-400 shrink-0 mt-0.5" />
                            <span className="truncate italic">Ghi chú: {ticket.ghi_chu}</span>
                          </div>
                        )}
                      </div>

                      <div className="mt-3 pt-2 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between text-xs text-neutral-500">
                        <span>{ticket.documents?.length ? `${ticket.documents.length} chứng từ đính kèm` : 'Chưa có chứng từ'}</span>
                        <div className="flex items-center text-primary font-medium gap-0.5">
                          <span>Chi tiết</span>
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop View: Full Table (>= md) */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12 text-center">{t('invoice_tracking.table.stt')}</TableHead>
                        <TableHead className="whitespace-nowrap">{t('invoice_tracking.table.date')}</TableHead>
                        <TableHead className="whitespace-nowrap">{t('invoice_tracking.table.bienSo')}</TableHead>
                        <TableHead className="whitespace-nowrap">{t('invoice_tracking.table.taiXe')}</TableHead>
                        <TableHead className="min-w-[140px]">{t('invoice_tracking.table.diemNhan')}</TableHead>
                        <TableHead className="min-w-[150px] max-w-[220px]">{t('invoice_tracking.table.ghiChu')}</TableHead>
                        <TableHead className="whitespace-nowrap">{t('invoice_tracking.table.status')}</TableHead>
                        <TableHead className="w-20 text-center">{t('invoice_tracking.table.actions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.items.map((ticket, idx) => (
                        <TableRow
                          key={ticket.id}
                          className="cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
                          onClick={() => setSelectedTicket(ticket)}
                        >
                          <TableCell className="text-center text-neutral-500 font-mono text-xs">{(page - 1) * PAGE_SIZE + idx + 1}</TableCell>
                          <TableCell className="whitespace-nowrap">{formatDate(ticket.ngay)}</TableCell>
                          <TableCell className="font-semibold text-neutral-900 dark:text-neutral-100 whitespace-nowrap">
                            {ticket.bien_so}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{ticket.tai_xe || '—'}</TableCell>
                          <TableCell className="max-w-[200px] truncate" title={ticket.diem_nhan}>{ticket.diem_nhan}</TableCell>
                          <TableCell className="max-w-[220px] truncate text-neutral-600 dark:text-neutral-400 text-xs" title={ticket.ghi_chu || undefined}>
                            {ticket.ghi_chu || '—'}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <InvoiceStatusBadge status={ticket.invoice_status} />
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7.5 px-3 text-xs font-medium"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTicket(ticket);
                              }}
                            >
                              {t('invoice_tracking.action.view')}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Responsive Pagination */}
                {data.pagination.total_pages > 1 && (
                  <div className="p-4 border-t border-neutral-100 dark:border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 text-center sm:text-left">
                      Hiển thị <span className="font-medium text-neutral-700 dark:text-neutral-300">{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, data.pagination.total)}</span> trên <span className="font-medium text-neutral-700 dark:text-neutral-300">{data.pagination.total}</span> chuyến
                    </p>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 px-3 min-w-[36px]"
                        disabled={page === 1}
                        onClick={() => setPage((p) => p - 1)}
                      >
                        Trước
                      </Button>
                      <span className="text-xs sm:hidden px-2 text-neutral-600 dark:text-neutral-400 font-medium">
                        Trang {page}/{data.pagination.total_pages}
                      </span>
                      <div className="hidden sm:flex items-center gap-1">
                        {Array.from({ length: Math.min(5, data.pagination.total_pages) }).map((_, i) => {
                          const pageNum = i + 1;
                          return (
                            <Button
                              key={pageNum}
                              variant={page === pageNum ? 'primary' : 'outline'}
                              size="sm"
                              className="h-9 w-9 p-0"
                              onClick={() => setPage(pageNum)}
                            >
                              {pageNum}
                            </Button>
                          );
                        })}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 px-3 min-w-[36px]"
                        disabled={page === data.pagination.total_pages}
                        onClick={() => setPage((p) => p + 1)}
                      >
                        Sau
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      <TicketDetailModal
        ticket={selectedTicket}
        isOpen={!!selectedTicket}
        onClose={() => setSelectedTicket(null)}
      />
    </div>
  );
}
