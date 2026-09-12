import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { formatDate } from '../../utils/format';
import { Select } from '../../components/ui/Select';
import { usePriceMatrix } from '../../hooks/useRoutePricing';
import type {
  PriceMatrixPeriod,
  PriceMatrixTripsRow,
  PriceMatrixWeightColumn,
  PriceMatrixWeightRow,
  PriceMatrixWeightTable,
} from '../../api/routePricingApi';

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
    ? 'bg-amber-50 dark:bg-amber-950/40'
    : 'bg-lime-50 dark:bg-lime-950/40';
}

function formatMoney(value: number | null | undefined): string {
  if (value == null) return '';
  return Number(value).toLocaleString('vi-VN');
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
  return `sticky z-20 bg-white dark:bg-neutral-900 ${extra}`.trim();
}

const STICKY_EDGE_SHADOW = 'shadow-[2px_0_4px_-2px_rgba(0,0,0,0.18)]';
const ROUTE_COLUMN_WIDTH = 'w-[160px] max-w-[160px] sm:w-[220px] sm:max-w-[220px]';

function RouteNameCell({ name }: { name: string }) {
  return (
    <span className="block whitespace-normal break-words">
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
  const { data, isLoading, isError, refetch } = usePriceMatrix(priceBookId);
  const [fromPeriodId, setFromPeriodId] = useState('');

  if (isLoading) {
    return <p className="text-sm text-neutral-500">Đang tải bảng giá…</p>;
  }
  if (isError) {
    return (
      <p className="text-sm text-red-600">
        Không tải được bảng giá.{' '}
        <button type="button" className="underline" onClick={() => void refetch()}>
          Thử lại
        </button>
      </p>
    );
  }

  const periods = data?.periods ?? [];
  const weightTables = data?.weight_tables ?? [];
  const truckTables = data?.truck_tables ?? [];
  const tripsRows = data?.trips.rows ?? [];

  if (periods.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        Chưa có kỳ điều chỉnh — vào tab Kỳ điều chỉnh để tạo.
      </p>
    );
  }

  if (weightTables.length === 0 && truckTables.length === 0 && tripsRows.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        Chưa có nhóm tuyến nào có bảng giá. Tạo giá ở tab Quản lý giá.
      </p>
    );
  }

  return (
    <PriceMatrixContent
      periods={periods}
      weightTables={weightTables}
      truckTables={truckTables}
      tripsRows={tripsRows}
      fromPeriodId={fromPeriodId}
      onFromPeriodChange={setFromPeriodId}
    />
  );
}

function PriceMatrixContent({
  periods,
  weightTables,
  truckTables,
  tripsRows,
  fromPeriodId,
  onFromPeriodChange,
}: {
  periods: PriceMatrixPeriod[];
  weightTables: PriceMatrixWeightTable[];
  truckTables: PriceMatrixWeightTable[];
  tripsRows: PriceMatrixTripsRow[];
  fromPeriodId: string;
  onFromPeriodChange: (id: string) => void;
}) {
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
          label="Từ kỳ"
          value={effectiveFromId}
          onChange={(e) => onFromPeriodChange(e.target.value)}
          options={periodOptions}
        />
        <p className="mt-1 text-xs text-neutral-500">
          Hiện giá từ kỳ đã chọn đến kỳ hiện tại. Mặc định chỉ kỳ hiện tại.
        </p>
      </div>

      {weightTables.length > 0 && (
        <section className="space-y-6">
          <h2 className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
            Theo trọng lượng
          </h2>
          {weightTables.map((table) => (
            <PriceMatrixWeightTableView
              key={table.schema_key}
              periods={visiblePeriods}
              table={table}
            />
          ))}
        </section>
      )}

      {truckTables.length > 0 && (
        <section className="space-y-6">
          <h2 className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
            Theo loại xe
          </h2>
          {truckTables.map((table) => (
            <PriceMatrixWeightTableView
              key={table.schema_key}
              periods={visiblePeriods}
              table={table}
            />
          ))}
        </section>
      )}

      {tripsRows.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
            Theo chuyến / xe / ngày
          </h2>
          <PriceMatrixTripsTableView periods={visiblePeriods} rows={tripsRows} />
        </section>
      )}
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
  const { lefts, registerCell } = useStickyLeftOffsets(2);
  return (
    <div className="space-y-2">
      <p className="text-xs text-neutral-500">{table.schema_label}</p>
      <div className="overflow-auto rounded-lg border border-neutral-200 dark:border-neutral-700 max-h-[70vh]">
        <table className="min-w-max border-separate border-spacing-0 text-xs">
          <thead>
            <tr>
              <th
                ref={registerCell(0)}
                rowSpan={3}
                style={{ left: lefts[0] }}
                className={`${stickyCellClass('min-w-[48px]')} border border-neutral-200 dark:border-neutral-700 px-2 py-1.5 text-left`}
              >
                STT
              </th>
              <th
                ref={registerCell(1)}
                rowSpan={3}
                style={{ left: lefts[1] }}
                className={`${stickyCellClass(`${ROUTE_COLUMN_WIDTH} ${STICKY_EDGE_SHADOW}`)} border border-neutral-200 dark:border-neutral-700 px-2 py-1.5 text-left`}
              >
                Tuyến
              </th>
              {periods.map((p, i) => (
                <th
                  key={p.id}
                  colSpan={cols.length}
                  className={`border border-neutral-200 dark:border-neutral-700 px-2 py-1.5 text-center font-medium ${periodTone(i)}`}
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
                    className={`border border-neutral-200 dark:border-neutral-700 px-2 py-1 min-w-[88px] ${
                      col.kind === 'truck'
                        ? 'max-w-[10rem] break-words whitespace-normal'
                        : 'whitespace-pre-line'
                    } ${periodTone(i)}`}
                  >
                    {col.label}
                    {col.hint ? (
                      <>
                        <br />
                        <span className="font-normal text-[10px]">({col.hint})</span>
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
                    className={`border border-neutral-200 dark:border-neutral-700 px-2 py-1 font-normal text-neutral-600 dark:text-neutral-300 ${periodTone(i)}`}
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
}: {
  row: PriceMatrixWeightRow;
  periods: PriceMatrixPeriod[];
  columns: PriceMatrixWeightColumn[];
  stickyLefts: number[];
}) {
  return (
    <tr className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
      <td
        style={{ left: stickyLefts[0] }}
        className={`${stickyCellClass()} border border-neutral-200 dark:border-neutral-700 px-2 py-1.5 text-center`}
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
        columns.map((col) => (
          <td
            key={`${p.id}-${col.key}`}
            className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 px-2 py-1.5 text-right tabular-nums whitespace-nowrap"
          >
            {formatMoney(row.cells[String(p.id)]?.[col.key] ?? null)}
          </td>
        )),
      )}
    </tr>
  );
}

function PriceMatrixTripsTableView({
  periods,
  rows,
}: {
  periods: PriceMatrixPeriod[];
  rows: PriceMatrixTripsRow[];
}) {
  const { lefts, registerCell } = useStickyLeftOffsets(3);
  return (
    <div className="overflow-auto rounded-lg border border-neutral-200 dark:border-neutral-700 max-h-[70vh]">
      <table className="min-w-max border-separate border-spacing-0 text-xs">
        <thead>
          <tr>
            <th
              ref={registerCell(0)}
              style={{ left: lefts[0] }}
              className={`${stickyCellClass('min-w-[48px]')} border border-neutral-200 dark:border-neutral-700 px-2 py-1.5 text-left`}
            >
              STT
            </th>
            <th
              ref={registerCell(1)}
              style={{ left: lefts[1] }}
              className={`${stickyCellClass(ROUTE_COLUMN_WIDTH)} border border-neutral-200 dark:border-neutral-700 px-2 py-1.5 text-left`}
            >
              Tuyến
            </th>
            <th
              ref={registerCell(2)}
              style={{ left: lefts[2] }}
              className={`${stickyCellClass(`min-w-[140px] ${STICKY_EDGE_SHADOW}`)} border border-neutral-200 dark:border-neutral-700 px-2 py-1.5 text-left`}
            >
              Số chuyến
            </th>
            {periods.map((p, i) => (
              <th
                key={p.id}
                className={`border border-neutral-200 dark:border-neutral-700 px-2 py-1.5 text-center font-medium min-w-[100px] ${periodTone(i)}`}
              >
                {periodHeader(p)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.route_group_id}-${row.row_kind}-${row.trips_label}-${row.stt}`} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
              <td
                style={{ left: lefts[0] }}
                className={`${stickyCellClass()} border border-neutral-200 dark:border-neutral-700 px-2 py-1.5 text-center`}
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
                className={`${stickyCellClass(STICKY_EDGE_SHADOW)} border border-neutral-200 dark:border-neutral-700 px-2 py-1.5`}
              >
                {row.trips_label}
              </td>
              {periods.map((p) => (
                <td
                  key={p.id}
                  className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 px-2 py-1.5 text-right tabular-nums whitespace-nowrap"
                >
                  {formatMoney(row.cells[String(p.id)] ?? null)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
