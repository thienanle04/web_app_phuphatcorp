import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MapPinned, Plus, Pencil, Trash2, Search } from 'lucide-react';
import {
  useAdjustmentPeriods,
  useGroups,
  usePriceBooks,
  usePriceVersions,
  usePrices,
  useProvinces,
  useRoutePricingMutations,
  useWards,
} from '../../hooks/useRoutePricing';
import { PriceMatrixTab } from './PriceMatrixTab';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { DateInput } from '../../components/ui/DateInput';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../../components/ui/Table';
import type {
  AdjustmentPeriod,
  PriceTierInput,
  PricingMode,
  RouteGroup,
  RoutePriceVersion,
} from '../../api/routePricingApi';
import { formatDate } from '../../utils/format';
import { useI18n } from '../../i18n/useI18n';

type TabKey = 'periods' | 'groups' | 'prices' | 'manage';

function formatPercentLabel(percent: number): string {
  const abs = Math.abs(percent);
  if (percent > 0) return `tăng ${abs}%`;
  if (percent < 0) return `giảm ${abs}%`;
  return `${percent}%`;
}

function periodLabel(p: AdjustmentPeriod): string {
  const note = p.note ? ` - ${p.note}` : '';
  return `${formatDate(p.start_date)} (${formatPercentLabel(p.percent)})${note}`;
}

/** Bỏ dấu tiếng Việt — "ha tie" khớp "Hà Tiên" */
function normalizeVn(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

function matchesVn(haystack: string, needle: string): boolean {
  const q = normalizeVn(needle);
  if (!q) return true;
  return normalizeVn(haystack).includes(q);
}

function toast(msg: string, isError = false) {
  if (isError) console.error(msg);
  window.alert(msg);
}

function apiError(err: unknown, fallback: string) {
  const ax = err as { response?: { data?: { message?: string } } };
  return ax?.response?.data?.message || fallback;
}

export function RoutePricingPage() {
  const { t } = useI18n();
  const { hasPermission, user } = useAuth();
  const canManage =
    hasPermission('route_pricing.manage') || user?.role === 'ADMIN';
  const [params, setParams] = useSearchParams();
  const priceBookId = params.get('priceBookId')
    ? parseInt(params.get('priceBookId')!, 10)
    : undefined;
  const tabParam = params.get('tab');
  const tab: TabKey =
    tabParam === 'prices' ||
    tabParam === 'groups' ||
    tabParam === 'periods' ||
    tabParam === 'manage'
      ? tabParam
      : 'groups';

  const setTab = (t: TabKey) => {
    const next = new URLSearchParams(params);
    next.set('tab', t);
    setParams(next);
  };
  const setPriceBook = (id: string) => {
    const next = new URLSearchParams(params);
    if (id) next.set('priceBookId', id);
    else next.delete('priceBookId');
    next.delete('supplierId');
    setParams(next);
  };

  const {
    data: priceBooks = [],
    isLoading: booksLoading,
    isError: booksError,
    refetch: refetchBooks,
  } = usePriceBooks();
  const bookMutations = useRoutePricingMutations();
  const [bookModal, setBookModal] = useState<'create' | 'rename' | null>(null);
  const [bookName, setBookName] = useState('');
  const [bookNameError, setBookNameError] = useState('');

  const selectedBook = priceBooks.find((b) => b.id === priceBookId);

  useEffect(() => {
    if (tab === 'periods') return;
    if (priceBookId || priceBooks.length === 0) return;
    const sorted = [...priceBooks].sort((a, b) =>
      a.name.localeCompare(b.name, 'vi', { numeric: true }),
    );
    setPriceBook(String(sorted[0].id));
  }, [priceBooks, priceBookId, tab]);

  useEffect(() => {
    if (!priceBookId || booksLoading) return;
    if (priceBooks.length > 0 && !selectedBook) {
      toast(t('routePricing.priceBook.notFound'), true);
      setPriceBook('');
    }
  }, [priceBookId, booksLoading, priceBooks, selectedBook]);

  const submittingBook =
    bookMutations.createPriceBook.isPending || bookMutations.updatePriceBook.isPending;

  async function submitBook() {
    const name = bookName.trim();
    if (!name) {
      setBookNameError(t('routePricing.priceBook.nameRequired'));
      return;
    }
    setBookNameError('');
    try {
      if (bookModal === 'create') {
        const created = await bookMutations.createPriceBook.mutateAsync(name);
        toast(t('routePricing.message.success.createBook'));
        setPriceBook(String(created.id));
      } else if (bookModal === 'rename' && priceBookId) {
        await bookMutations.updatePriceBook.mutateAsync({ id: priceBookId, name });
        toast(t('routePricing.message.success.renameBook'));
      }
      setBookModal(null);
    } catch (err) {
      const msg = apiError(err, t('routePricing.priceBook.saveError'));
      if (/đã tồn tại|exist/i.test(msg)) setBookNameError(t('routePricing.priceBook.duplicate'));
      else toast(msg, true);
    }
  }

  async function confirmDeleteBook() {
    if (!priceBookId || !selectedBook) return;
    if (!window.confirm(t('routePricing.priceBook.confirmDelete', { name: selectedBook.name }))) {
      return;
    }
    try {
      await bookMutations.deletePriceBook.mutateAsync(priceBookId);
      toast(t('routePricing.message.success.deleteBook'));
      const remaining = priceBooks.filter((b) => b.id !== priceBookId);
      if (remaining[0]) setPriceBook(String(remaining[0].id));
      else setPriceBook('');
    } catch (err) {
      toast(apiError(err, t('routePricing.message.error.deleteBook')), true);
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2 text-pretty">
            <MapPinned className="w-6 h-6" aria-hidden="true" />
            {t('routePricing.page.title')}
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            {t('routePricing.page.subtitle')}
          </p>
        </div>
        <div
          className={`min-w-0 w-full max-w-xl sm:w-auto flex flex-wrap items-end gap-2 ${
            tab === 'periods' ? 'invisible pointer-events-none' : ''
          }`}
          aria-hidden={tab === 'periods'}
        >
          <div className="min-w-[220px] flex-1">
            <Select
              id="priceBookId"
              label={t('routePricing.priceBook.label')}
              name="priceBookId"
              autoComplete="off"
              className="h-9 py-0 text-sm"
              value={priceBookId ? String(priceBookId) : ''}
              onChange={(e) => setPriceBook(e.target.value)}
              options={[
                { value: '', label: t('routePricing.priceBook.placeholder') },
                ...priceBooks.map((b) => ({
                  value: String(b.id),
                  label: b.name,
                })),
              ]}
            />
          </div>
          {canManage && (
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 w-9 p-0"
                aria-label={t('routePricing.priceBook.create')}
                title={t('routePricing.priceBook.create')}
                onClick={() => {
                  setBookName('');
                  setBookNameError('');
                  setBookModal('create');
                }}
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 w-9 p-0"
                aria-label={t('routePricing.priceBook.rename')}
                title={t('routePricing.priceBook.rename')}
                disabled={!priceBookId}
                onClick={() => {
                  setBookName(selectedBook?.name ?? '');
                  setBookNameError('');
                  setBookModal('rename');
                }}
              >
                <Pencil className="w-4 h-4" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                className="h-9 w-9 p-0"
                aria-label={t('routePricing.priceBook.delete')}
                title={t('routePricing.priceBook.delete')}
                disabled={!priceBookId || bookMutations.deletePriceBook.isPending}
                onClick={() => void confirmDeleteBook()}
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-1 border-b border-neutral-200 dark:border-neutral-700">
        {(
          [
            ['periods', t('routePricing.tab.periods')],
            ['groups', t('routePricing.tab.groups')],
            ['manage', t('routePricing.tab.manage')],
            ['prices', t('routePricing.tab.matrix')],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px ${
              tab === k
                ? 'border-neutral-900 dark:border-neutral-100 text-neutral-900 dark:text-neutral-100'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'periods' && <PeriodsTab canManage={canManage} />}

      {tab !== 'periods' && booksLoading ? (
        <div className="rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 p-10 text-center text-neutral-500">
          {t('routePricing.priceBook.loading')}
        </div>
      ) : null}

      {tab !== 'periods' && booksError ? (
        <div className="rounded-lg border border-dashed border-red-300 p-10 text-center text-red-600 space-y-3">
          <p>{t('routePricing.priceBook.loadError')}</p>
          <Button type="button" variant="outline" onClick={() => void refetchBooks()}>
            {t('routePricing.priceBook.retry')}
          </Button>
        </div>
      ) : null}

      {tab !== 'periods' && !booksLoading && !booksError && priceBooks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 p-10 text-center text-neutral-500 space-y-3">
          <p>{t('routePricing.priceBook.empty')}</p>
          {canManage && (
            <Button
              type="button"
              onClick={() => {
                setBookName('');
                setBookNameError('');
                setBookModal('create');
              }}
            >
              {t('routePricing.priceBook.emptyCta')}
            </Button>
          )}
        </div>
      ) : null}

      {tab === 'groups' && priceBookId && (
        <GroupsTab priceBookId={priceBookId} canManage={canManage} />
      )}
      {tab === 'prices' && priceBookId && <PriceMatrixTab priceBookId={priceBookId} />}
      {tab === 'manage' && priceBookId && (
        <PricesTab priceBookId={priceBookId} canManage={canManage} />
      )}

      <Modal
        isOpen={bookModal !== null}
        onClose={() => setBookModal(null)}
        title={
          bookModal === 'rename'
            ? t('routePricing.priceBook.renameTitle')
            : t('routePricing.priceBook.createTitle')
        }
        size="sm"
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submitBook();
          }}
        >
          <Input
            id="priceBookName"
            label={t('routePricing.priceBook.name')}
            name="priceBookName"
            autoComplete="off"
            spellCheck={false}
            maxLength={255}
            value={bookName}
            error={bookNameError}
            placeholder={t('routePricing.priceBook.namePlaceholder')}
            onChange={(e) => setBookName(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setBookModal(null)}>
              {t('routePricing.action.cancel')}
            </Button>
            <Button type="submit" disabled={submittingBook} isLoading={submittingBook}>
              {t('routePricing.action.save')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function GroupsTab({
  priceBookId,
  canManage,
}: {
  priceBookId: number;
  canManage: boolean;
}) {
  const [, setParams] = useSearchParams();
  const { data: groups = [], isLoading } = useGroups(priceBookId);
  const { data: provinces = [] } = useProvinces();
  const mutations = useRoutePricingMutations(priceBookId);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RouteGroup | null>(null);
  const [search, setSearch] = useState('');
  const [provinceFilter, setProvinceFilter] = useState('');

  const openPrices = (groupId: number) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', 'manage');
      next.set('groupId', String(groupId));
      return next;
    });
  };

  const filteredGroups = useMemo(() => {
    return groups.filter((g) => {
      if (provinceFilter && g.province_code !== provinceFilter) return false;
      if (!search.trim()) return true;
      // Không search chuỗi UI "Phường chưa thuộc nhóm khác" — "hà" khớp nhầm trong "khác"
      const destinationText = g.is_residual
        ? ''
        : g.members.map((m) => m.phuong || m.location_text || '').join(' ');
      const haystack = [g.name, g.tinh, destinationText, g.note || ''].join(' ');
      return matchesVn(haystack, search);
    });
  }, [groups, search, provinceFilter]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
          <Input
            placeholder="Tìm tên nhóm, tỉnh, phường…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="min-w-[180px]">
          <Select
            label="Lọc theo tỉnh"
            value={provinceFilter}
            onChange={(e) => setProvinceFilter(e.target.value)}
            options={[
              { value: '', label: 'Tất cả tỉnh' },
              ...provinces.map((p) => ({ value: p.code, label: p.name })),
            ]}
          />
        </div>
        <div className="ml-auto">
          {canManage && (
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-1" /> Tạo nhóm
            </Button>
          )}
        </div>
      </div>
      <p className="text-xs text-neutral-500">Bấm vào một nhóm để xem bảng giá và lịch sử</p>
      {isLoading && <p className="text-sm text-neutral-500">Đang tải…</p>}
      {!isLoading && groups.length === 0 && (
        <p className="text-sm text-neutral-500">Chưa có nhóm tuyến</p>
      )}
      {!isLoading && groups.length > 0 && filteredGroups.length === 0 && (
        <p className="text-sm text-neutral-500">Không tìm thấy nhóm phù hợp</p>
      )}
      {filteredGroups.length > 0 && (
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tên nhóm</TableHead>
                <TableHead>Tỉnh</TableHead>
                <TableHead>Đích</TableHead>
                {canManage && <TableHead className="text-right">Hành động</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredGroups.map((g) => (
                <TableRow
                  key={g.id}
                  className="cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/60"
                  onClick={() => openPrices(g.id)}
                >
                  <TableCell>
                    <span className="inline-flex items-center gap-2 flex-wrap">
                      <span className="text-neutral-900 dark:text-neutral-100 font-medium underline-offset-2 group-hover:underline">
                        {g.name}
                      </span>
                      {g.is_residual && <Badge variant="warning">Còn lại</Badge>}
                    </span>
                  </TableCell>
                  <TableCell>{g.tinh}</TableCell>
                  <TableCell>
                    {g.is_residual
                      ? 'Phường/địa điểm chưa thuộc nhóm khác'
                      : g.members.map((m) => m.phuong || m.location_text).filter(Boolean).join(' · ') || '—'}
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right space-x-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="p-1"
                        title="Sửa"
                        onClick={() => {
                          setEditing(g);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil className="w-4 h-4 inline" />
                      </button>
                      <button
                        type="button"
                        className="p-1 text-red-600"
                        title="Xóa"
                        onClick={() => {
                          if (!window.confirm('Xóa nhóm này?')) return;
                          mutations.deleteGroup.mutate(g.id, {
                            onError: (e) => toast(apiError(e, 'Không xóa được'), true),
                          });
                        }}
                      >
                        <Trash2 className="w-4 h-4 inline" />
                      </button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {formOpen && (
        <GroupFormModal
          priceBookId={priceBookId}
          group={editing}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function GroupFormModal({
  priceBookId,
  group,
  onClose,
}: {
  priceBookId: number;
  group: RouteGroup | null;
  onClose: () => void;
}) {
  const { data: provinces = [] } = useProvinces();
  const [provinceCode, setProvinceCode] = useState(group?.province_code || '');
  const [destinationMode, setDestinationMode] = useState<'ward' | 'location' | 'residual'>(
    group?.is_residual
      ? 'residual'
      : group?.members.some((member) => member.location_text)
        ? 'location'
        : 'ward',
  );
  const [wardCodes, setWardCodes] = useState<string[]>(
    group?.members.map((m) => m.ward_code).filter((code): code is string => Boolean(code)) || [],
  );
  const [locationText, setLocationText] = useState(
    group?.members.find((member) => member.location_text)?.location_text || '',
  );
  const [note, setNote] = useState(group?.note || '');
  const [wardSearch, setWardSearch] = useState('');
  const { data: wards = [] } = useWards(provinceCode || undefined);
  const mutations = useRoutePricingMutations(priceBookId);
  const { data: provincesAll = [] } = useProvinces();

  const filteredWards = useMemo(() => {
    if (!wardSearch.trim()) return wards;
    return wards.filter(
      (w) => matchesVn(w.name, wardSearch) || matchesVn(w.full_name || '', wardSearch),
    );
  }, [wards, wardSearch]);

  const previewName = useMemo(() => {
    const p = provincesAll.find((x) => x.code === provinceCode);
    if (!p) return '—';
    const noteSuffix = note.trim() ? ` (${note.trim()})` : '';
    if (destinationMode === 'residual') return `${p.name}${noteSuffix}`;
    if (destinationMode === 'location') {
      const loc = locationText.trim();
      return loc ? `${p.name} - ${loc}${noteSuffix}` : `${p.name}${noteSuffix}`;
    }
    const destinations = wardCodes
      .map((code) => wards.find((ward) => ward.code === code)?.name)
      .filter(Boolean);
    return destinations.length
      ? `${p.name} - ${destinations.join('/ ')}${noteSuffix}`
      : `${p.name}${noteSuffix}`;
  }, [provinceCode, destinationMode, wardCodes, locationText, wards, provincesAll, note]);

  const toggleWard = (code: string) => {
    setWardCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  };

  const switchDestinationMode = (mode: 'ward' | 'location' | 'residual') => {
    setDestinationMode(mode);
    if (mode !== 'ward') setWardCodes([]);
    if (mode !== 'location') setLocationText('');
  };

  const payloadDest = () => {
    if (destinationMode === 'ward') {
      return { ward_codes: wardCodes, location_text: null as string | null };
    }
    if (destinationMode === 'location') {
      return { ward_codes: [] as string[], location_text: locationText.trim() || null };
    }
    return { ward_codes: [] as string[], location_text: null as string | null };
  };

  return (
    <Modal isOpen onClose={onClose} title={group ? 'Sửa nhóm tuyến' : 'Tạo nhóm tuyến'} size="lg">
      <div className="space-y-3 max-h-[70vh] overflow-y-auto">
        <Select
          label="Tỉnh *"
          value={provinceCode}
          disabled={Boolean(group)}
          onChange={(e) => {
            setProvinceCode(e.target.value);
            setWardCodes([]);
            setLocationText('');
            setWardSearch('');
          }}
          options={[
            { value: '', label: 'Chọn tỉnh' },
            ...provinces.map((p) => ({ value: p.code, label: p.name })),
          ]}
        />
        <div>
          <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            Đích *
          </p>
          <div className="flex flex-wrap gap-4 mb-3 text-sm">
            {([
              ['ward', 'Phường / Xã'],
              ['location', 'Địa điểm tự do'],
              ['residual', 'Phần còn lại'],
            ] as const).map(([mode, label]) => (
              <label key={mode} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="destination-mode"
                  checked={destinationMode === mode}
                  onChange={() => switchDestinationMode(mode)}
                />
                {label}
              </label>
            ))}
          </div>
          {destinationMode === 'ward' && (
            <>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
                <Input
                  placeholder="Tìm phường/xã…"
                  value={wardSearch}
                  onChange={(e) => setWardSearch(e.target.value)}
                  disabled={!provinceCode}
                  className="pl-9"
                />
              </div>
              {wardCodes.length > 0 && (
                <p className="text-xs text-neutral-500 mb-1">
                  Đã chọn {wardCodes.length} phường
                  {wardSearch.trim() ? ` · lọc: ${filteredWards.length}` : ''}
                </p>
              )}
              <div className="max-h-48 overflow-y-auto border border-neutral-200 dark:border-neutral-700 rounded-md p-2 space-y-1">
                {!provinceCode && <p className="text-xs text-neutral-500">Chọn tỉnh trước</p>}
                {provinceCode && filteredWards.length === 0 && (
                  <p className="text-xs text-neutral-500">Không tìm thấy phường phù hợp</p>
                )}
                {filteredWards.map((ward) => (
                  <label key={ward.code} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={wardCodes.includes(ward.code)}
                      onChange={() => toggleWard(ward.code)}
                    />
                    {ward.name}
                  </label>
                ))}
              </div>
            </>
          )}
          {destinationMode === 'location' && (
            <div className="space-y-1">
              <Input
                label="Địa điểm *"
                placeholder="Vd. KCN Hiệp Phước"
                value={locationText}
                disabled={!provinceCode}
                onChange={(e) => setLocationText(e.target.value)}
              />
              <p className="text-xs text-neutral-500">
                Mỗi nhóm chỉ có đúng 1 địa điểm text
              </p>
            </div>
          )}
          {destinationMode === 'residual' && (
            <p className="text-xs text-neutral-500">Áp dụng cho phường/địa điểm chưa thuộc nhóm khác trong tỉnh.</p>
          )}
        </div>
        <div>
          <p className="text-sm font-medium mb-1">Tên nhóm (chỉ xem)</p>
          <p className="text-sm px-3 py-2 rounded-md bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
            {previewName}
          </p>
          <p className="text-xs text-neutral-500 mt-1">
            Tự sinh theo tỉnh và đích — không chỉnh sửa
          </p>
        </div>
        <Input
          label="Ghi chú"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <p className="-mt-2 text-xs text-neutral-500">Vd. Đường nhỏ — gắn vào tên nhóm</p>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button
            disabled={
              !provinceCode ||
              (destinationMode === 'location' && !locationText.trim()) ||
              mutations.createGroup.isPending ||
              mutations.updateGroup.isPending
            }
            onClick={() => {
              const dest = payloadDest();
              if (group) {
                mutations.updateGroup.mutate(
                  {
                    id: group.id,
                    ward_codes: dest.ward_codes,
                    location_text: dest.location_text,
                    note,
                  },
                  {
                    onSuccess: () => {
                      toast('Đã lưu thành công');
                      onClose();
                    },
                    onError: (e) => toast(apiError(e, 'Không lưu được'), true),
                  },
                );
              } else {
                mutations.createGroup.mutate(
                  {
                    price_book_id: priceBookId,
                    province_code: provinceCode,
                    ward_codes: dest.ward_codes,
                    location_text: dest.location_text,
                    note,
                  },
                  {
                    onSuccess: () => {
                      toast('Đã lưu thành công');
                      onClose();
                    },
                    onError: (e) => toast(apiError(e, 'Không lưu được'), true),
                  },
                );
              }
            }}
          >
            Lưu
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function PricesTab({
  priceBookId,
  canManage,
}: {
  priceBookId: number;
  canManage: boolean;
}) {
  const [params, setParams] = useSearchParams();
  const groupId = params.get('groupId')
    ? parseInt(params.get('groupId')!, 10)
    : undefined;

  const setGroupId = (id: number | undefined) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (id) next.set('groupId', String(id));
      else next.delete('groupId');
      return next;
    });
  };

  const { data: groups = [] } = useGroups(priceBookId);
  const { data: prices = [], isLoading } = usePrices(priceBookId, groupId);
  const selected = prices.find((p) => p.route_group_id === groupId);
  const configId = selected && selected.id > 0 ? selected.id : undefined;
  const {
    data: versions = [],
    isLoading: versionsLoading,
  } = usePriceVersions(configId);
  const [formOpen, setFormOpen] = useState(false);
  const [editAbsolute, setEditAbsolute] = useState(false);

  const groupMeta = groups.find((g) => g.id === groupId);
  const absoluteVersion = versions.find(
    (v) => v.adjustment_percent == null && (v.base_version_id == null || v.base_version_id === undefined),
  );

  return (
    <div className="space-y-4">
      <SearchableSelect
        label="Nhóm tuyến *"
        value={groupId ? String(groupId) : ''}
        onChange={(v) => setGroupId(v ? parseInt(v, 10) : undefined)}
        placeholder="Chọn nhóm tuyến"
        searchPlaceholder="Tìm tên nhóm…"
        clearable
        options={groups.map((g) => ({
          value: String(g.id),
          label: g.is_residual ? `${g.name} · Còn lại` : g.name,
        }))}
      />
      {!groupId && (
        <p className="text-sm text-neutral-500">
          Chọn nhóm tuyến để xem giá và lịch sử — hoặc bấm một nhóm ở tab Nhóm tuyến
        </p>
      )}
      {groupId && isLoading && <p className="text-sm text-neutral-500">Đang tải…</p>}
      {groupId && !isLoading && (
        <div className="space-y-4">
          <div className="flex justify-between items-start gap-3">
            <div>
              <p className="font-medium text-neutral-900 dark:text-neutral-100">
                {selected?.group_name || groupMeta?.name || 'Nhóm tuyến'}
              </p>
              <p className="text-xs text-neutral-500 mt-0.5">
                {configId
                  ? `${versions.length || selected?.version_count || 0} phiên bản`
                  : 'Chưa có bảng giá'}
              </p>
            </div>
            <div className="flex gap-2">
              {canManage && !configId && (
                <Button onClick={() => setFormOpen(true)}>
                  <Plus className="w-4 h-4 mr-1" /> Thêm bảng giá gốc
                </Button>
              )}
              {canManage && configId && absoluteVersion && (
                <Button variant="outline" onClick={() => setEditAbsolute(true)}>
                  <Pencil className="w-4 h-4 mr-1" /> Sửa bảng giá gốc
                </Button>
              )}
            </div>
          </div>

          {!configId && (
            <p className="text-sm text-neutral-500">Chưa có bảng giá gốc cho nhóm này</p>
          )}

          {configId && versionsLoading && (
            <p className="text-sm text-neutral-500">Đang tải lịch sử giá…</p>
          )}

          {configId && !versionsLoading && versions.length === 0 && (
            <p className="text-sm text-neutral-500">Chưa có phiên bản giá</p>
          )}

          {configId && versions.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Lịch sử thay đổi giá
              </p>
              {versions.map((v, idx) => (
                <PriceVersionCard
                  key={v.id}
                  version={v}
                  isCurrent={v.effective_to == null}
                  isOldest={idx === versions.length - 1}
                />
              ))}
            </div>
          )}
        </div>
      )}
      {formOpen && groupId && (
        <PriceFormModal
          routeGroupId={groupId}
          onClose={() => setFormOpen(false)}
        />
      )}
      {editAbsolute && groupId && absoluteVersion && (
        <PriceFormModal
          routeGroupId={groupId}
          editVersion={absoluteVersion}
          onClose={() => setEditAbsolute(false)}
        />
      )}
    </div>
  );
}

function PriceVersionCard({
  version,
  isCurrent,
  isOldest,
}: {
  version: RoutePriceVersion;
  isCurrent: boolean;
  isOldest: boolean;
}) {
  const showPallet = Number(version.pallet_trip_price) > 0;
  const mode: PricingMode = version.pricing_mode ?? 'by_weight';
  const rangeHeader =
    mode === 'by_trips' ? 'Chuyến/xe/ngày' : mode === 'by_truck' ? 'Loại xe' : 'Trọng lượng';

  return (
    <div
      className={`rounded-lg border p-4 space-y-3 bg-white dark:bg-neutral-900 ${
        isCurrent
          ? 'border-neutral-300 dark:border-neutral-600 shadow-sm'
          : 'border-neutral-200 dark:border-neutral-700'
      }`}
    >
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {isCurrent ? (
            <Badge variant="success">Đang hiệu lực</Badge>
          ) : (
            <Badge variant="default">Đã đóng</Badge>
          )}
          {isOldest && version.adjustment_percent == null && (
            <Badge variant="info">Giá gốc</Badge>
          )}
          <Badge variant={mode === 'by_weight' ? 'default' : 'info'}>
            {mode === 'by_trips'
              ? 'Theo chuyến/xe/ngày'
              : mode === 'by_truck'
                ? 'Theo loại xe'
                : 'Theo trọng lượng'}
          </Badge>
          {version.adjustment_percent != null && (
            <Badge variant="warning">
              Điều chỉnh {version.adjustment_percent > 0 ? '+' : ''}
              {version.adjustment_percent}%
            </Badge>
          )}
        </div>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {formatDate(version.effective_from)}
          {' → '}
          {version.effective_to ? formatDate(version.effective_to) : 'hiện tại'}
        </p>
      </div>

      {showPallet && (
        <p className="text-sm">
          Giá Pallet (chuyến):{' '}
          <strong>{Number(version.pallet_trip_price).toLocaleString('vi-VN')}</strong>
        </p>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-neutral-500 border-b border-neutral-200 dark:border-neutral-700">
            <th className="py-1.5 pr-3 font-medium">{rangeHeader}</th>
            <th className="py-1.5 pr-3 font-medium">Đơn vị</th>
            <th className="py-1.5 font-medium text-right">Đơn giá</th>
          </tr>
        </thead>
        <tbody>
          {version.tiers.map((t, i) => (
            <tr
              key={i}
              className="border-t border-neutral-100 dark:border-neutral-800 align-top"
            >
              <td className="py-2 pr-3 whitespace-pre-line break-words">{formatTierRangeLabel(mode, t)}</td>
              <td className="py-2 pr-3 text-neutral-700 dark:text-neutral-300">
                {t.pricing_unit === 'chuyen' ? 'vnđ/chuyến' : 'vnđ/tấn'}
              </td>
              <td className="py-2 text-right font-medium tabular-nums">
                {Number(t.price).toLocaleString('vi-VN')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatTonNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : String(n);
}

/** Hiển thị khoảng tấn `(from, to]`: `≤ 2.5 tấn`, `>8-16`, `>16` */
function formatTonRange(fromTon: number, toTon: number | null | undefined): string {
  const from = Number(fromTon);
  if (toTon == null) {
    return from <= 0 ? 'Mọi trọng lượng' : `>${formatTonNumber(from)}`;
  }
  const to = Number(toTon);
  if (from <= 0) return `≤ ${formatTonNumber(to)} tấn`;
  return `>${formatTonNumber(from)}-${formatTonNumber(to)}`;
}

function formatTripsRange(fromTrips: number, toTrips: number | null | undefined): string {
  const from = Number(fromTrips);
  if (toTrips == null) return `Áp dụng từ ${formatTonNumber(from)} chuyến trở lên`;
  const to = Number(toTrips);
  if (from === to) return `Áp dụng cho ${formatTonNumber(from)} chuyến`;
  return `Áp dụng từ ${formatTonNumber(from)} đến ${formatTonNumber(to)} chuyến`;
}

function formatTierRangeLabel(mode: PricingMode, t: PriceTierInput): string {
  if (mode === 'by_truck') {
    return (t.label ?? '').trim();
  }
  if (mode === 'by_trips') {
    return formatTripsRange(t.range_from ?? 0, t.range_to ?? null);
  }
  let line = formatTonRange(t.range_from ?? 0, t.range_to ?? null);
  if (
    t.pricing_unit === 'tan' &&
    t.min_billable_ton != null &&
    Number(t.min_billable_ton) > 0
  ) {
    line += ` (cước tối thiểu ${formatTonNumber(Number(t.min_billable_ton))} tấn)`;
  }
  return line;
}

function truckTemplate(): PriceTierInput[] {
  return [{ label: '', pricing_unit: 'chuyen', price: 0, range_from: 0, range_to: null }];
}

const WEIGHT_TEMPLATE: PriceTierInput[] = [
  { range_from: 0, range_to: 2.5, pricing_unit: 'chuyen', price: 0 },
  { range_from: 2.5, range_to: 8, pricing_unit: 'tan', price: 0, min_billable_ton: 5 },
  { range_from: 8, range_to: 16, pricing_unit: 'tan', price: 0 },
  { range_from: 16, range_to: 23, pricing_unit: 'tan', price: 0 },
  { range_from: 23, range_to: null, pricing_unit: 'tan', price: 0 },
];

function tripsTemplate(firstTo = 2): PriceTierInput[] {
  return [
    { range_from: 1, range_to: firstTo, pricing_unit: 'chuyen', price: 0 },
    { range_from: firstTo + 1, range_to: null, pricing_unit: 'chuyen', price: 0 },
  ];
}

/** Re-chain trips tiers so from[0]=1, from[i]=to[i-1]+1, last to=null */
function rechainTrips(tiers: PriceTierInput[]): PriceTierInput[] {
  if (tiers.length === 0) return tripsTemplate();
  const next = tiers.map((t) => ({ ...t, pricing_unit: 'chuyen' as const, min_billable_ton: null }));
  next[0] = { ...next[0], range_from: 1 };
  for (let i = 1; i < next.length; i++) {
    const prevTo = next[i - 1].range_to;
    const from = prevTo == null ? next[i - 1].range_from + 1 : Number(prevTo) + 1;
    next[i] = { ...next[i], range_from: from };
  }
  next[next.length - 1] = { ...next[next.length - 1], range_to: null };
  return next;
}

function PriceFormModal({
  routeGroupId,
  editVersion,
  onClose,
}: {
  routeGroupId: number;
  editVersion?: RoutePriceVersion;
  onClose: () => void;
}) {
  const mutations = useRoutePricingMutations();
  const { data: periods = [], isLoading: periodsLoading } = useAdjustmentPeriods();
  const isEdit = Boolean(editVersion);
  const [periodId, setPeriodId] = useState(
    editVersion?.adjustment_period_id ? String(editVersion.adjustment_period_id) : '',
  );
  const [pallet, setPallet] = useState(String(editVersion?.pallet_trip_price ?? '0'));
  const [pricingMode, setPricingMode] = useState<PricingMode>(
    editVersion?.pricing_mode ?? 'by_weight',
  );
  const [tiers, setTiers] = useState<PriceTierInput[]>(() =>
    editVersion
      ? editVersion.tiers.map((t) => ({ ...t }))
      : WEIGHT_TEMPLATE.map((t) => ({ ...t })),
  );

  const earliestPeriodId = useMemo(() => {
    if (periods.length === 0) return '';
    const earliest = [...periods].sort((a, b) => a.start_date.localeCompare(b.start_date))[0];
    return earliest ? String(earliest.id) : '';
  }, [periods]);

  // Derive default kỳ gốc when periods load — avoid setState-in-effect.
  const effectivePeriodId = isEdit ? periodId : periodId || earliestPeriodId;
  const selectedPeriod = periods.find((p) => String(p.id) === effectivePeriodId);

  const switchMode = (mode: PricingMode) => {
    if (mode === pricingMode) return;
    if (!window.confirm('Đổi chế độ sẽ xóa các bậc đang nhập. Tiếp tục?')) return;
    setPricingMode(mode);
    setTiers(
      mode === 'by_weight'
        ? WEIGHT_TEMPLATE.map((t) => ({ ...t }))
        : mode === 'by_trips'
          ? tripsTemplate()
          : truckTemplate(),
    );
  };

  const updateTripsTo = (idx: number, toValue: string) => {
    setTiers((prev) => {
      const next = prev.map((t) => ({ ...t }));
      if (idx === next.length - 1) {
        next[idx] = { ...next[idx], range_to: null };
        return rechainTrips(next);
      }
      next[idx] = {
        ...next[idx],
        range_to: toValue === '' ? next[idx].range_from : Number(toValue),
      };
      return rechainTrips(next);
    });
  };

  const addTripsTier = () => {
    setTiers((prev) => {
      if (prev.length === 0) return tripsTemplate();
      if (prev.length === 1) {
        const price = prev[0].price;
        return rechainTrips([
          { range_from: 1, range_to: 1, pricing_unit: 'chuyen', price },
          { range_from: 2, range_to: null, pricing_unit: 'chuyen', price: 0 },
        ]);
      }
      const copy = prev.map((t) => ({ ...t }));
      const lastIdx = copy.length - 1;
      const prevIdx = lastIdx - 1;
      const prevTo = Number(copy[prevIdx].range_to ?? copy[prevIdx].range_from);
      const midFrom = prevTo + 1;
      const midTo = midFrom;
      copy[prevIdx] = { ...copy[prevIdx], range_to: prevTo };
      copy.splice(lastIdx, 0, {
        range_from: midFrom,
        range_to: midTo,
        pricing_unit: 'chuyen',
        price: 0,
      });
      copy[copy.length - 1] = {
        ...copy[copy.length - 1],
        range_from: midTo + 1,
        range_to: null,
        pricing_unit: 'chuyen',
        price: copy[copy.length - 1].price,
      };
      return rechainTrips(copy);
    });
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={isEdit ? 'Sửa bảng giá gốc' : 'Thêm bảng giá gốc'}
      size="lg"
    >
      <div className="space-y-3 max-h-[70vh] overflow-y-auto">
        {!isEdit && (
          <div>
            <Select
              label="Kỳ gốc *"
              value={effectivePeriodId}
              onChange={(e) => setPeriodId(e.target.value)}
              options={[
                {
                  value: '',
                  label: periodsLoading
                    ? 'Đang tải kỳ…'
                    : periods.length
                      ? 'Chọn kỳ gốc'
                      : 'Chưa có kỳ — vào tab Kỳ điều chỉnh để tạo',
                },
                ...[...periods]
                  .sort((a, b) => a.start_date.localeCompare(b.start_date))
                  .map((p) => ({
                    value: String(p.id),
                    label: periodLabel(p),
                  })),
              ]}
            />
            {selectedPeriod && (
              <p className="mt-1 text-xs text-neutral-500">
                Ngày hiệu lực gốc: {formatDate(selectedPeriod.start_date)}. Hệ thống sẽ tự tạo
                bảng giá cho các kỳ tiếp theo (sau kỳ gốc), nhân % từng kỳ.
              </p>
            )}
          </div>
        )}
        {isEdit && (
          <p className="text-sm text-neutral-500">
            Sửa giá gốc sẽ tính lại các kỳ tiếp theo theo %.
          </p>
        )}
        <Input
          label="Giá Pallet (chuyến) *"
          type="number"
          min={0}
          value={pallet}
          onChange={(e) => setPallet(e.target.value)}
        />
        <p className="-mt-2 text-xs text-neutral-500">Cho phép 0 nếu nhóm không dùng giá pallet</p>

        <div>
          <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            Chế độ áp giá *
          </p>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="pricing-mode"
                checked={pricingMode === 'by_weight'}
                onChange={() => switchMode('by_weight')}
              />
              Theo trọng lượng
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="pricing-mode"
                checked={pricingMode === 'by_trips'}
                onChange={() => switchMode('by_trips')}
              />
              Theo số chuyến/xe/ngày
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="pricing-mode"
                checked={pricingMode === 'by_truck'}
                onChange={() => switchMode('by_truck')}
              />
              Theo loại xe
            </label>
          </div>
          {pricingMode === 'by_truck' && (
            <p className="mt-1 text-xs text-neutral-500">
              Nhãn bậc copy từ Excel (loại / tải xe, ví dụ Truck 0,5mt hoặc 8 &lt; Truck ≤16). Không
              dùng tấn hàng trên phiếu.
            </p>
          )}
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium">Bậc điều kiện *</p>
          {pricingMode === 'by_weight' &&
            tiers.map((t, idx) => {
              const isChuyen = t.pricing_unit === 'chuyen';
              return (
                <div
                  key={idx}
                  className="flex flex-wrap gap-2 items-end rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-3"
                >
                  <div className="w-[7.5rem] shrink-0">
                    <Select
                      label="Đơn vị"
                      value={t.pricing_unit}
                      onChange={(e) => {
                        const unit = e.target.value as 'chuyen' | 'tan';
                        const next = [...tiers];
                        next[idx] = {
                          ...t,
                          pricing_unit: unit,
                          min_billable_ton: unit === 'chuyen' ? null : t.min_billable_ton,
                        };
                        setTiers(next);
                      }}
                      options={[
                        { value: 'chuyen', label: 'Chuyến' },
                        { value: 'tan', label: 'Tấn' },
                      ]}
                    />
                  </div>
                  <div className="w-24 shrink-0">
                    <Input
                      label="Từ (tấn)"
                      type="number"
                      value={String(t.range_from)}
                      onChange={(e) => {
                        const next = [...tiers];
                        next[idx] = { ...t, range_from: Number(e.target.value) };
                        setTiers(next);
                      }}
                    />
                  </div>
                  <div className="w-24 shrink-0">
                    <Input
                      label="Đến (tấn)"
                      type="number"
                      value={t.range_to == null ? '' : String(t.range_to)}
                      onChange={(e) => {
                        const next = [...tiers];
                        next[idx] = {
                          ...t,
                          range_to: e.target.value === '' ? null : Number(e.target.value),
                        };
                        setTiers(next);
                      }}
                    />
                  </div>
                  {!isChuyen && (
                    <div className="w-24 shrink-0">
                      <Input
                        label="Tối thiểu (tấn)"
                        type="number"
                        value={t.min_billable_ton == null ? '' : String(t.min_billable_ton)}
                        onChange={(e) => {
                          const next = [...tiers];
                          next[idx] = {
                            ...t,
                            min_billable_ton:
                              e.target.value === '' ? null : Number(e.target.value),
                          };
                          setTiers(next);
                        }}
                      />
                    </div>
                  )}
                  <div className="w-36 min-w-[8rem] flex-1">
                    <Input
                      label="Giá"
                      type="number"
                      value={String(t.price)}
                      onChange={(e) => {
                        const next = [...tiers];
                        next[idx] = { ...t, price: Number(e.target.value) };
                        setTiers(next);
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    className="p-2 text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                    title="Xóa bậc"
                    aria-label="Xóa bậc"
                    disabled={tiers.length === 1}
                    onClick={() => setTiers((previous) => previous.filter((_, i) => i !== idx))}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}

          {pricingMode === 'by_trips' &&
            tiers.map((t, idx) => {
              const isLast = idx === tiers.length - 1;
              return (
                <div
                  key={idx}
                  className="flex flex-wrap gap-2 items-end rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-3"
                >
                  <div className="w-28 shrink-0">
                    <Input
                      label="Từ (≥)"
                      type="number"
                      value={String(t.range_from)}
                      disabled
                      onChange={() => undefined}
                    />
                  </div>
                  <div className="w-32 shrink-0">
                    <Input
                      label={isLast ? 'Đến (∞)' : 'Đến (≤)'}
                      type="number"
                      value={t.range_to == null ? '' : String(t.range_to)}
                      disabled={isLast}
                      onChange={(e) => updateTripsTo(idx, e.target.value)}
                    />
                  </div>
                  <div className="w-36 min-w-[8rem] flex-1">
                    <Input
                      label="Giá (vnđ/chuyến)"
                      type="number"
                      value={String(t.price)}
                      onChange={(e) => {
                        const next = [...tiers];
                        next[idx] = { ...t, price: Number(e.target.value) };
                        setTiers(next);
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    className="p-2 text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                    title="Xóa bậc"
                    aria-label="Xóa bậc"
                    disabled={tiers.length <= 1}
                    onClick={() =>
                      setTiers((previous) => rechainTrips(previous.filter((_, i) => i !== idx)))
                    }
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}

          {pricingMode === 'by_truck' &&
            tiers.map((t, idx) => (
              <div
                key={idx}
                className="flex flex-wrap gap-2 items-end rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-3"
              >
                <div className="min-w-0 flex-1 basis-48">
                  <Input
                    id={`truck-tier-label-${idx}`}
                    name={`truck-tier-label-${idx}`}
                    label="Nhãn loại xe"
                    value={t.label ?? ''}
                    spellCheck={false}
                    autoComplete="off"
                    placeholder="vd. Truck 0,5mt…"
                    onChange={(e) => {
                      const next = [...tiers];
                      next[idx] = { ...t, label: e.target.value };
                      setTiers(next);
                    }}
                  />
                </div>
                <div className="w-[7.5rem] shrink-0">
                  <Select
                    label="Đơn vị"
                    value={t.pricing_unit}
                    onChange={(e) => {
                      const next = [...tiers];
                      next[idx] = { ...t, pricing_unit: e.target.value as 'chuyen' | 'tan' };
                      setTiers(next);
                    }}
                    options={[
                      { value: 'chuyen', label: 'Chuyến' },
                      { value: 'tan', label: 'Tấn' },
                    ]}
                  />
                </div>
                <div className="w-36 min-w-[8rem] flex-1">
                  <Input
                    id={`truck-tier-price-${idx}`}
                    name={`truck-tier-price-${idx}`}
                    label="Đơn giá"
                    type="number"
                    value={String(t.price)}
                    onChange={(e) => {
                      const next = [...tiers];
                      next[idx] = { ...t, price: Number(e.target.value) };
                      setTiers(next);
                    }}
                  />
                </div>
                <button
                  type="button"
                  className="p-2 text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                  title="Xóa bậc"
                  aria-label="Xóa bậc"
                  disabled={tiers.length === 1}
                  onClick={() => setTiers((previous) => previous.filter((_, i) => i !== idx))}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}

          <Button
            variant="outline"
            type="button"
            onClick={() => {
              if (pricingMode === 'by_weight') {
                setTiers((prev) => [
                  ...prev,
                  { range_from: 0, range_to: null, pricing_unit: 'tan', price: 0 },
                ]);
                return;
              }
              if (pricingMode === 'by_truck') {
                setTiers((prev) => [
                  ...prev,
                  { label: '', pricing_unit: 'chuyen', price: 0, range_from: 0, range_to: null },
                ]);
                return;
              }
              addTripsTier();
            }}
          >
            + Thêm bậc
          </Button>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button
            disabled={
              mutations.createPrice.isPending ||
              mutations.updateAbsolutePrice.isPending ||
              (!isEdit && !effectivePeriodId)
            }
            onClick={() => {
              const normalizedTiers =
                pricingMode === 'by_trips'
                  ? rechainTrips(tiers).map((tier) => ({
                      ...tier,
                      pricing_unit: 'chuyen' as const,
                      min_billable_ton: null,
                    }))
                  : pricingMode === 'by_truck'
                    ? tiers.map((tier) => ({
                        label: (tier.label ?? '').trim(),
                        pricing_unit: tier.pricing_unit,
                        price: tier.price,
                      }))
                    : tiers.map((tier) => ({
                      ...tier,
                      min_billable_ton:
                        tier.pricing_unit === 'tan' ? tier.min_billable_ton ?? null : null,
                    }));
              if (isEdit) {
                mutations.updateAbsolutePrice.mutate(
                  {
                    routeGroupId,
                    pricing_mode: pricingMode,
                    pallet_trip_price: Number(pallet),
                    tiers: normalizedTiers,
                  },
                  {
                    onSuccess: () => {
                      toast('Đã cập nhật bảng giá gốc');
                      onClose();
                    },
                    onError: (e) => toast(apiError(e, 'Không cập nhật được'), true),
                  },
                );
                return;
              }
              mutations.createPrice.mutate(
                {
                  route_group_id: routeGroupId,
                  adjustment_period_id: Number(effectivePeriodId),
                  pricing_mode: pricingMode,
                  pallet_trip_price: Number(pallet),
                  tiers: normalizedTiers,
                },
                {
                  onSuccess: () => {
                    toast('Đã lưu thành công');
                    onClose();
                  },
                  onError: (e) => toast(apiError(e, 'Không lưu được'), true),
                },
              );
            }}
          >
            Lưu
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function PeriodsTab({ canManage }: { canManage: boolean }) {
  const { data: periods = [], isLoading, isError, refetch } = useAdjustmentPeriods();
  const mutations = useRoutePricingMutations();
  const [formOpen, setFormOpen] = useState(false);
  const latestId = periods[0]?.id;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <p className="text-xs text-neutral-500 flex-1 min-w-[200px]">
          Kỳ điều chỉnh áp dụng mọi bảng giá — chỉ xóa được kỳ gần nhất (rollback)
        </p>
        <div className="ml-auto">
          {canManage && (
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="w-4 h-4 mr-1" /> Thêm kỳ
            </Button>
          )}
        </div>
      </div>

      {isLoading && <p className="text-sm text-neutral-500">Đang tải…</p>}
      {isError && (
        <p className="text-sm text-red-600">
          Không tải được kỳ điều chỉnh.{' '}
          <button type="button" className="underline" onClick={() => void refetch()}>
            Thử lại
          </button>
        </p>
      )}
      {!isLoading && !isError && periods.length === 0 && (
        <p className="text-sm text-neutral-500">Chưa có kỳ điều chỉnh</p>
      )}

      {periods.length > 0 && (
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ngày bắt đầu</TableHead>
                <TableHead>%</TableHead>
                <TableHead>Ghi chú</TableHead>
                {canManage && <TableHead className="text-right">Hành động</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {periods.map((p) => (
                <TableRow
                  key={p.id}
                  className="hover:bg-neutral-50 dark:hover:bg-neutral-800/60"
                >
                  <TableCell>
                    <span className="text-neutral-900 dark:text-neutral-100 font-medium">
                      {formatDate(p.start_date)}
                    </span>
                  </TableCell>
                  <TableCell>{formatPercentLabel(p.percent)}</TableCell>
                  <TableCell className="max-w-xs truncate">{p.note || '—'}</TableCell>
                  {canManage && (
                    <TableCell className="text-right space-x-1">
                      {p.id === latestId ? (
                        <button
                          type="button"
                          className="p-1 text-red-600"
                          title="Xóa"
                          onClick={() => {
                            if (
                              !window.confirm(
                                'Xóa kỳ sẽ gỡ mọi bảng giá sinh từ kỳ này và mở lại kỳ trước. Tiếp tục?',
                              )
                            ) {
                              return;
                            }
                            mutations.deletePeriod.mutate(p.id, {
                              onSuccess: () => toast('Đã xóa kỳ điều chỉnh'),
                              onError: (e) => toast(apiError(e, 'Không xóa được'), true),
                            });
                          }}
                        >
                          <Trash2 className="w-4 h-4 inline" />
                        </button>
                      ) : (
                        <span className="text-xs text-neutral-400">—</span>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {formOpen && <PeriodFormModal onClose={() => setFormOpen(false)} />}
    </div>
  );
}

function PeriodFormModal({ onClose }: { onClose: () => void }) {
  const mutations = useRoutePricingMutations();
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [percent, setPercent] = useState('8');
  const [note, setNote] = useState('');

  return (
    <Modal isOpen onClose={onClose} title="Thêm kỳ điều chỉnh" size="md">
      <div className="space-y-4">
        <p className="text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-md">
          Thêm kỳ sẽ áp dụng % cho mọi bảng giá đang có giá hiệu lực.
        </p>
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
            Ngày bắt đầu *
          </label>
          <DateInput value={startDate} onChange={setStartDate} />
        </div>
        <Input
          label="Phần trăm (%) *"
          type="number"
          value={percent}
          onChange={(e) => setPercent(e.target.value)}
        />
        <p className="-mt-2 text-xs text-neutral-500">VD 8 = tăng 8%; -5 = giảm 5%</p>
        <Input
          label="Ghi chú"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
          <Button variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button
            disabled={mutations.createPeriod.isPending}
            onClick={() => {
              if (!startDate || Number(percent) === 0 || Number.isNaN(Number(percent))) {
                toast('Ngày bắt đầu và % (khác 0) là bắt buộc', true);
                return;
              }
              if (!window.confirm('Xác nhận thêm kỳ và áp dụng toàn hệ thống?')) {
                return;
              }
              mutations.createPeriod.mutate(
                {
                  start_date: startDate,
                  percent: Number(percent),
                  note: note.trim() || null,
                },
                {
                  onSuccess: (data) => {
                    toast(
                      data.adjusted > 0
                        ? `Đã tạo kỳ và điều chỉnh ${data.adjusted} bảng giá`
                        : 'Đã tạo kỳ điều chỉnh',
                    );
                    onClose();
                  },
                  onError: (e) => toast(apiError(e, 'Không tạo được kỳ'), true),
                },
              );
            }}
          >
            Lưu
          </Button>
        </div>
      </div>
    </Modal>
  );
}
