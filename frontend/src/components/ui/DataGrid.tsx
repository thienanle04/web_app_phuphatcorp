import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../utils/cn';

export type DataGridDensity = 'compact' | 'default' | 'comfortable';
export type DataGridAlign = 'left' | 'center' | 'right';

export interface DataGridColumn<T> {
  id: string;
  header: ReactNode;
  pin?: boolean;
  align?: DataGridAlign;
  numeric?: boolean;
  truncate?: boolean;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  hiddenClassName?: string;
  className?: string;
  headerClassName?: string;
  accessor?: (row: T) => string | number | null | undefined;
  cell?: (row: T, ctx: { index: number }) => ReactNode;
}

export const DATA_GRID_EMPTY = '-';

const STRIPE_MIN_COLS = 12;
const TIP_DELAY_MS = 80;

const ROW_H: Record<DataGridDensity, string> = {
  compact: 'h-[40px] max-h-[40px]',
  default: 'h-[48px] max-h-[48px]',
  comfortable: 'h-[56px] max-h-[56px]',
};

const thBase =
  'px-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-300 whitespace-nowrap';
const tdBase = 'px-3 text-xs text-neutral-900 dark:text-neutral-100';
const pinHead = 'bg-neutral-50 dark:bg-neutral-800';
const pinBody =
  'data-grid-pin bg-white dark:bg-neutral-900 group-hover:bg-neutral-50 dark:group-hover:bg-neutral-800';
const pinEdge = 'border-r border-neutral-200 dark:border-neutral-700';

export function formatDataGridValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return DATA_GRID_EMPTY;
  if (typeof value === 'number' && Number.isNaN(value)) return DATA_GRID_EMPTY;
  const text = String(value).trim();
  return text ? text : DATA_GRID_EMPTY;
}

export function DataGridTip({
  text,
  onlyIfTruncated = false,
  className,
  children,
}: {
  text: string;
  onlyIfTruncated?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const timer = useRef<number>(0);

  const hide = () => {
    window.clearTimeout(timer.current);
    setPos(null);
  };

  const show = () => {
    const el = ref.current;
    if (!el || !text || text === '-') return;
    if (onlyIfTruncated && el.scrollWidth <= el.clientWidth + 1) return;
    const r = el.getBoundingClientRect();
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setPos({ x: r.left, y: r.bottom + 4 });
    }, TIP_DELAY_MS);
  };

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <>
      <span
        ref={ref}
        className={className}
        onMouseEnter={show}
        onMouseLeave={hide}
      >
        {children}
      </span>
      {pos &&
        createPortal(
          <div
            role="tooltip"
            className="pointer-events-none fixed z-[200] max-w-sm rounded bg-neutral-900 px-2 py-1 text-xs text-white shadow-none dark:bg-neutral-100 dark:text-neutral-900"
            style={{ left: pos.x, top: pos.y }}
          >
            {text}
          </div>,
          document.body
        )}
    </>
  );
}

function colWidthStyle<T>(col: DataGridColumn<T>): CSSProperties {
  const style: CSSProperties = {};
  if (col.width != null) {
    style.width = col.width;
    style.minWidth = col.width;
    style.maxWidth = col.maxWidth ?? col.width;
  } else {
    if (col.minWidth != null) style.minWidth = col.minWidth;
    if (col.maxWidth != null) style.maxWidth = col.maxWidth;
  }
  return style;
}

function pinOffsets<T>(columns: DataGridColumn<T>[]): Map<string, number> {
  const map = new Map<string, number>();
  let left = 0;
  for (const col of columns) {
    if (!col.pin) continue;
    map.set(col.id, left);
    left += col.width ?? col.minWidth ?? 0;
  }
  return map;
}

function DefaultCell<T>({
  col,
  row,
  index,
}: {
  col: DataGridColumn<T>;
  row: T;
  index: number;
}) {
  if (col.cell) return <>{col.cell(row, { index })}</>;

  const raw = col.accessor ? col.accessor(row) : undefined;
  const text = formatDataGridValue(raw);
  const truncate = col.truncate !== false && !col.numeric;

  if (!truncate || col.numeric) {
    return <span className="whitespace-nowrap">{text}</span>;
  }

  return (
    <DataGridTip text={text} onlyIfTruncated className="block truncate">
      {text}
    </DataGridTip>
  );
}

interface DataGridProps<T> {
  columns: DataGridColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string | number;
  density?: DataGridDensity;
  minWidth?: number;
  maxHeight?: string;
  footer?: ReactNode;
  className?: string;
}

export function DataGrid<T>({
  columns,
  rows,
  getRowId,
  density = 'default',
  minWidth,
  maxHeight = 'calc(100vh - 18rem)',
  footer,
  className,
}: DataGridProps<T>) {
  const rowH = ROW_H[density];
  const striped = columns.length >= STRIPE_MIN_COLS;
  const lefts = useMemo(() => pinOffsets(columns), [columns]);
  const lastPinId = [...columns].reverse().find((c) => c.pin)?.id;
  const tableMinWidth =
    minWidth ??
    columns.reduce((sum, col) => sum + (col.width ?? col.minWidth ?? 0), 0);

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900',
        className
      )}
    >
      <div className="cursor-default overflow-auto" style={{ maxHeight }}>
        <table
          className="w-full cursor-default caption-bottom border-collapse text-xs [&_td]:cursor-default [&_th]:cursor-default"
          style={tableMinWidth ? { minWidth: tableMinWidth } : undefined}
        >
          <thead className="border-b border-neutral-200 dark:border-neutral-700">
            <tr>
              {columns.map((col) => {
                const pinned = Boolean(col.pin);
                const style = {
                  ...colWidthStyle(col),
                  ...(pinned ? { left: lefts.get(col.id) ?? 0 } : {}),
                };
                return (
                  <th
                    key={col.id}
                    className={cn(
                      thBase,
                      rowH,
                      'sticky top-0',
                      pinHead,
                      pinned ? 'z-30' : 'z-20',
                      col.align === 'right' && 'text-right',
                      col.align === 'center' && 'text-center',
                      col.id === lastPinId && pinEdge,
                      col.hiddenClassName,
                      col.headerClassName
                    )}
                    style={style}
                  >
                    {col.header}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
            {rows.map((row, index) => (
              <tr
                key={getRowId(row)}
                className={cn(
                  'group hover:bg-neutral-50 dark:hover:bg-neutral-800',
                  rowH,
                  striped && 'even:bg-neutral-50 dark:even:bg-neutral-800/60',
                  striped &&
                    'even:[&_.data-grid-pin]:bg-neutral-50 dark:even:[&_.data-grid-pin]:bg-neutral-800/60'
                )}
              >
                {columns.map((col) => {
                  const pinned = Boolean(col.pin);
                  const style = {
                    ...colWidthStyle(col),
                    ...(pinned ? { left: lefts.get(col.id) ?? 0 } : {}),
                  };
                  return (
                    <td
                      key={col.id}
                      className={cn(
                        tdBase,
                        rowH,
                        'overflow-hidden',
                        pinned && `sticky z-10 ${pinBody}`,
                        col.id === lastPinId && pinEdge,
                        col.align === 'right' && 'text-right tabular-nums',
                        col.align === 'center' && 'text-center',
                        col.numeric && 'whitespace-nowrap',
                        col.hiddenClassName,
                        col.className
                      )}
                      style={style}
                    >
                      <DefaultCell col={col} row={row} index={index} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footer}
    </div>
  );
}
