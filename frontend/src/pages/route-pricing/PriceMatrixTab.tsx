import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { formatDate } from '../../utils/format';
import { Select } from '../../components/ui/Select';
import { usePriceMatrix } from '../../hooks/useRoutePricing';
import type {
  PriceMatrixCell,
  PriceMatrixPeriod,
  PriceMatrixTripsRow,
  PriceMatrixWeightColumn,
  PriceMatrixWeightRow,
  PriceMatrixWeightTable,
} from '../../api/routePricingApi';
import { useI18n } from '../../i18n/useI18n';
import { formatPriceDisplay } from './priceDisplay';

function formatPercentLabel(percent: number): string {
  const abs = Math.abs(percent);
  if (percent > 0) return `tăng ${abs}%`;
  if (percent < 0) return `giảm ${abs}%`;
  return `${percent}%`;
}

function periodHeader(p: PriceMatrixPeriod): string {
  const pct = ` (${formatPercentLabel(p.percent)})`;
  const note = p.note ? ` - ${p.note}` : '';
  return `${formatDate(p.start_date)}${pct}${note}`;
}

function periodTone(index: number): string {
  return index % 2 === 0
    ? 'bg-amber-50/80 dark:bg-amber-950/30'
    : 'bg-lime-50/80 dark:bg-lime-950/30';
}

function readCell(cell: PriceMatrixCell | number | null | undefined): {
  value: number | null;
  manual: boolean;
} {
  if (cell == null) return { value: null, manual: false };
  if (typeof cell === 'number') return { value: cell, manual: false };
  return { value: cell.value, manual: Boolean(cell.manual_adjusted) };
}

function formatMoneyCell(cell: PriceMatrixCell | number | null | undefined): string {
  return formatPriceDisplay(readCell(cell).value);
}

function cellClass(manual: boolean): string {
  return manual
    ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-950 dark:text-amber-200 font-medium border border-neutral-200 dark:border-neutral-700 px-2 py-1.5 text-right tabular-nums whitespace-nowrap transition-colors'
    : 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 border border-neutral-200 dark:border-neutral-700 px-2 py-1.5 text-right tabular-nums whitespace-nowrap group-hover:bg-neutral-50 dark:group-hover:bg-neutral-800/60 transition-colors';
}

/** Kỳ đang mở (end_date null); fallback = start_date lớn nhất. */
function resolveCurrentPeriod(periods: PriceMatrixPeriod[]): PriceMatrixPeriod | null {
  if (periods.length === 0) return null;
  const open = periods.find((p) => p.end_date == null);
  if (open) return open;
  return [...periods].sort((a, b) => b.start_date.localeCompare(a.start_date))[0] ?? null;
}

/** Các kỳ từ kỳ chọn (inclusive) đến hiện tại — so sánh theo start_date. */
function visiblePeriodsFrom(
  periods: PriceMatrixPeriod[],
  fromPeriodId: string,
): PriceMatrixPeriod[] {
  if (!fromPeriodId || periods.length === 0) return periods;
  const from = periods.find((p) => String(p.id) === fromPeriodId);
  if (!from) return periods;
  return periods.filter((p) => p.start_date >= from.start_date);
}

function stickyCellClass(extra = ''): string {
  return `sticky z-20 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 group-hover:bg-neutral-50 dark:group-hover:bg-neutral-800/60 transition-colors ${extra}`.trim();
}

const STICKY_EDGE_SHADOW = 'shadow-[2px_0_4px_-2px_rgba(0,0,0,0.18)]';
const ROUTE_COLUMN_WIDTH = 'w-[160px] max-w-[160px] sm:w-[220px] sm:max-w-[220px]';

function RouteNameCell({ name }: { name: string }) {
  return (
    <span className="block whitespace-normal break-words text-neutral-900 dark:text-neutral-100">
      {name}
    </span>
  );
}

/**
 * Tables use min-w-max so leading columns size to their content — left offsets must be
 * measured at runtime instead of hardcoded.
 */
function useStickyLeftOffsets(columnCount: number) {
  const cellRefs = useRef<(HTMLTableCellElement | null)[]>([]);
  const [lefts, setLefts] = useState<number[]>(() => new Array(columnCount).fill(0));

  const measure = useCallback(() => {
    let acc = 0;
    const next: number[] = [];
    for (let i = 0; i < columnCount; i++) {
      next.push(acc);
      acc += cellRefs.current[i]?.getBoundingClientRect().width ?? 0;
    }
    setLefts((prev) =>
      prev.length === next.length && prev.every((v, i) => Math.abs(v - next[i]) < 0.5) ? prev : next,
    );
  }, [columnCount]);

  useLayoutEffect(() => {
    // ResizeObserver fires once per element on observe(), giving the initial measurement.
    const observer = new ResizeObserver(measure);
    cellRefs.current.slice(0, columnCount).forEach((el) => {
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [columnCount, measure]);

  const registerCell = useCallback(
    (index: number) => (el: HTMLTableCellElement | null) => {
      cellRefs.current[index] = el;
    },
    [],
  );

  return { lefts, registerCell };
}

export function PriceMatrixTab({ priceBookId }: { priceBookId: number }) {
  const { t } = useI18n();
  const { data, isLoading, isError, refetch } = usePriceMatrix(priceBookId);
  const [fromPeriodId, setFromPeriodId] = useState('');

  if (isLoading) {
    return (
      <div className="rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 p-8 text-center text-neutral-500 dark:text-neutral-400 bg-neutral-50/50 dark:bg-neutral-800/20">
        <p className="text-sm">{t('routePricing.priceSet.loading')}</p>
      </div>
    );
  }
  if (isError) {
    return (
      <div className="rounded-lg border border-dashed border-red-300 dark:border-red-800/60 p-8 text-center text-red-600 dark:text-red-400 bg-red-50/50 dark:bg-red-950/20 space-y-2">
        <p className="text-sm">{t('routePricing.matrix.loadError')}</p>
        <button
          type="button"
          className="text-sm font-medium underline hover:text-red-700 dark:hover:text-red-300"
          onClick={() => void refetch()}
        >
          {t('routePricing.priceSet.retry')}
        </button>
      </div>
    );
  }

  const periods = data?.periods ?? [];
  const setTables = data?.set_tables ?? [];

  if (periods.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 p-8 text-center text-neutral-500 dark:text-neutral-400 bg-neutral-50/50 dark:bg-neutral-800/20">
        <p className="text-sm">{t('routePricing.matrix.noPeriods')}</p>
      </div>
    );
  }

  if (setTables.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 p-8 text-center text-neutral-500 dark:text-neutral-400 bg-neutral-50/50 dark:bg-neutral-800/20">
        <p className="text-sm">{t('routePricing.matrix.emptyBook')}</p>
      </div>
    );
  }

  return (
    <PriceMatrixContent
      periods={periods}
      setTables={setTables}
      fromPeriodId={fromPeriodId}
      onFromPeriodChange={setFromPeriodId}
    />
  );
}
function PriceMatrixContent({
  periods,
  setTables,
  fromPeriodId,
  onFromPeriodChange,
}: {
  periods: PriceMatrixPeriod[];
  setTables: PriceMatrixWeightTable[];
  fromPeriodId: string;
  onFromPeriodChange: (id: string) => void;
}) {
  const { t } = useI18n();
  const currentPeriod = useMemo(() => resolveCurrentPeriod(periods), [periods]);
  const currentPeriodId = currentPeriod ? String(currentPeriod.id) : '';
  const effectiveFromId = fromPeriodId || currentPeriodId;
  const visiblePeriods = useMemo(
    () => visiblePeriodsFrom(periods, effectiveFromId),
    [periods, effectiveFromId],
  );

  const periodOptions = useMemo(
    () =>
      [...periods]
        .sort((a, b) => b.start_date.localeCompare(a.start_date))
        .map((p) => ({ value: String(p.id), label: periodHeader(p) })),
    [periods],
  );

  return (
    <div className="space-y-8">
      <div className="max-w-md">
        <Select
          id="matrix-from-period"
          label={t('routePricing.matrix.fromPeriod')}
          value={effectiveFromId}
          onChange={(e) => onFromPeriodChange(e.target.value)}
          options={periodOptions}
        />
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{t('routePricing.matrix.fromPeriodHint')}</p>
      </div>

      {setTables.map((table) => (
        <section key={table.schema_key} className="space-y-3">
          <h2 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
            {table.schema_label}
          </h2>
          <PriceMatrixWeightTableView periods={visiblePeriods} table={table} />
        </section>
      ))}
    </div>
  );
}
function PriceMatrixWeightTableView({
  periods,
  table,
}: {
  periods: PriceMatrixPeriod[];
  table: PriceMatrixWeightTable;
}) {
  const cols = table.columns;
  const hideCaption = cols.some((c) => c.kind === 'truck') || !table.schema_label;
  const { lefts, registerCell } = useStickyLeftOffsets(2);
  return (
    <div className="space-y-2">
      {!hideCaption && (
        <p className="text-xs text-neutral-500 dark:text-neutral-400">{table.schema_label}</p>
      )}
      <div className="overflow-auto rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 max-h-[70vh] shadow-sm">
        <table className="min-w-max border-separate border-spacing-0 text-xs">
          <thead>
            <tr>
              <th
                ref={registerCell(0)}
                rowSpan={3}
                style={{ left: lefts[0] }}
                className={`${stickyCellClass('min-w-[48px]')} border border-neutral-200 dark:border-neutral-700 px-2 py-1.5 text-left font-medium text-neutral-700 dark:text-neutral-300`}
              >
                STT
              </th>
              <th
                ref={registerCell(1)}
                rowSpan={3}
                style={{ left: lefts[1] }}
                className={`${stickyCellClass(`${ROUTE_COLUMN_WIDTH} ${STICKY_EDGE_SHADOW}`)} border border-neutral-200 dark:border-neutral-700 px-2 py-1.5 text-left font-medium text-neutral-700 dark:text-neutral-300`}
              >
                Tuyến
              </th>
              {periods.map((p, i) => (
                <th
                  key={p.id}
                  colSpan={cols.length}
                  className={`border border-neutral-200 dark:border-neutral-700 px-2 py-1.5 text-center font-medium text-neutral-900 dark:text-neutral-100 ${periodTone(i)}`}
                >
                  {periodHeader(p)}
                </th>
              ))}
            </tr>
            <tr>
              {periods.map((p, i) =>
                cols.map((col) => (
                  <th
                    key={`${p.id}-${col.key}-label`}
                    className={`border border-neutral-200 dark:border-neutral-700 px-2 py-1 min-w-[88px] font-medium text-neutral-800 dark:text-neutral-200 ${
                      col.kind === 'truck'
                        ? 'max-w-[10rem] break-words whitespace-normal'
                        : 'whitespace-pre-line'
                    } ${periodTone(i)}`}
                  >
                    {col.label}
                    {col.hint ? (
                      <>
                        <br />
                        <span className="font-normal text-[10px] text-neutral-500 dark:text-neutral-400">({col.hint})</span>
                      </>
                    ) : null}
                  </th>
                )),
              )}
            </tr>
            <tr>
              {periods.map((p, i) =>
                cols.map((col) => (
                  <th
                    key={`${p.id}-${col.key}-unit`}
                    className={`border border-neutral-200 dark:border-neutral-700 px-2 py-1 font-normal text-neutral-600 dark:text-neutral-400 ${periodTone(i)}`}
                  >
                    {col.unit_label}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <WeightRow
                key={row.route_group_id}
                row={row}
                periods={periods}
                columns={cols}
                stickyLefts={lefts}
                virtualize={table.rows.length > 50}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WeightRow({
  row,
  periods,
  columns,
  stickyLefts,
  virtualize,
}: {
  row: PriceMatrixWeightRow;
  periods: PriceMatrixPeriod[];
  columns: PriceMatrixWeightColumn[];
  stickyLefts: number[];
  virtualize: boolean;
}) {
  return (
    <tr
      className="group hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
      style={virtualize ? { contentVisibility: 'auto' } : undefined}
    >
      <td
        style={{ left: stickyLefts[0] }}
        className={`${stickyCellClass()} border border-neutral-200 dark:border-neutral-700 px-2 py-1.5 text-center text-neutral-500 dark:text-neutral-400 tabular-nums`}
      >
        {row.stt}
      </td>
      <td
        style={{ left: stickyLefts[1] }}
        className={`${stickyCellClass(`${ROUTE_COLUMN_WIDTH} ${STICKY_EDGE_SHADOW}`)} border border-neutral-200 dark:border-neutral-700 px-2 py-1.5`}
      >
        <RouteNameCell name={row.group_name} />
      </td>
      {periods.map((p) =>
        columns.map((col) => {
          const cell = row.cells[String(p.id)]?.[col.key];
          const { value, manual } = readCell(cell);
          return (
            <td
              key={`${p.id}-${col.key}`}
              className={cellClass(manual)}
              title={manual ? 'Đã điều chỉnh' : undefined}
            >
              {value == null ? '-' : formatMoneyCell(cell)}
            </td>
          );
        }),
      )}
    </tr>
  );
}

export function PriceMatrixTripsTableView({
  periods,
  rows,
}: {
  periods: PriceMatrixPeriod[];
  rows: PriceMatrixTripsRow[];
}) {
  const { lefts, registerCell } = useStickyLeftOffsets(3);
  return (
    <div className="overflow-auto rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 max-h-[70vh] shadow-sm">
      <table className="min-w-max border-separate border-spacing-0 text-xs">
        <thead>
          <tr>
            <th
              ref={registerCell(0)}
              style={{ left: lefts[0] }}
              className={`${stickyCellClass('min-w-[48px]')} border border-neutral-200 dark:border-neutral-700 px-2 py-1.5 text-left font-medium text-neutral-700 dark:text-neutral-300`}
            >
              STT
            </th>
            <th
              ref={registerCell(1)}
              style={{ left: lefts[1] }}
              className={`${stickyCellClass(ROUTE_COLUMN_WIDTH)} border border-neutral-200 dark:border-neutral-700 px-2 py-1.5 text-left font-medium text-neutral-700 dark:text-neutral-300`}
            >
              Tuyến
            </th>
            <th
              ref={registerCell(2)}
              style={{ left: lefts[2] }}
              className={`${stickyCellClass(`min-w-[140px] ${STICKY_EDGE_SHADOW}`)} border border-neutral-200 dark:border-neutral-700 px-2 py-1.5 text-left font-medium text-neutral-700 dark:text-neutral-300`}
            >
              Số chuyến
            </th>
            {periods.map((p, i) => (
              <th
                key={p.id}
                className={`border border-neutral-200 dark:border-neutral-700 px-2 py-1.5 text-center font-medium min-w-[100px] text-neutral-900 dark:text-neutral-100 ${periodTone(i)}`}
              >
                {periodHeader(p)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.route_group_id}-${row.row_kind}-${row.trips_label}-${row.stt}`} className="group hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
              <td
                style={{ left: lefts[0] }}
                className={`${stickyCellClass()} border border-neutral-200 dark:border-neutral-700 px-2 py-1.5 text-center text-neutral-500 dark:text-neutral-400 tabular-nums`}
              >
                {row.stt}
              </td>
              <td
                style={{ left: lefts[1] }}
                className={`${stickyCellClass(ROUTE_COLUMN_WIDTH)} border border-neutral-200 dark:border-neutral-700 px-2 py-1.5`}
              >
                <RouteNameCell name={row.group_name} />
              </td>
              <td
                style={{ left: lefts[2] }}
                className={`${stickyCellClass(STICKY_EDGE_SHADOW)} border border-neutral-200 dark:border-neutral-700 px-2 py-1.5 text-neutral-700 dark:text-neutral-300`}
              >
                {row.trips_label}
              </td>
              {periods.map((p) => {
                const cell = row.cells[String(p.id)];
                const { manual } = readCell(cell);
                return (
                  <td
                    key={p.id}
                    className={cellClass(manual)}
                    title={manual ? 'Đã điều chỉnh' : undefined}
                  >
                    {formatMoneyCell(cell)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
