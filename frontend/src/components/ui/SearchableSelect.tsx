import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useMemo,
  useCallback,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, X } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface SearchableSelectOption {
  value: string;
  label: string;
  content?: ReactNode;
}

interface SearchableSelectProps {
  label?: string;
  error?: string;
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
  /** Cho phép xóa lựa chọn (về value rỗng) */
  clearable?: boolean;
}

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

const POPOVER_MAX_HEIGHT = 320;

export function SearchableSelect({
  label,
  error,
  options,
  value,
  onChange,
  placeholder = 'Chọn…',
  searchPlaceholder = 'Tìm kiếm…',
  disabled,
  className,
  clearable = false,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    return options.filter((o) => matchesVn(o.label, query));
  }, [options, query]);

  const updatePosition = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < POPOVER_MAX_HEIGHT && rect.top > spaceBelow;
    const width = Math.max(rect.width, 240);
    const left = Math.min(
      Math.max(8, rect.left),
      window.innerWidth - width - 8,
    );

    setPopoverStyle({
      position: 'fixed',
      left,
      width,
      zIndex: 80,
      ...(openUp
        ? { bottom: window.innerHeight - rect.top + 4, top: 'auto' }
        : { top: rect.bottom + 4, bottom: 'auto' }),
    });
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) return;
    updatePosition();
    searchRef.current?.focus();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setIsOpen(false);
      setQuery('');
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen]);

  const pick = (v: string) => {
    onChange(v);
    setIsOpen(false);
    setQuery('');
  };

  const popover = isOpen && !disabled && (
    <div
      ref={popoverRef}
      style={popoverStyle}
      className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-xl overflow-hidden"
    >
      <div className="p-2 border-b border-neutral-100 dark:border-neutral-700">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 pointer-events-none" />
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className={cn(
              'w-full pl-8 pr-3 py-1.5 text-sm rounded-md border',
              'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100',
              'border-neutral-200 dark:border-neutral-600',
              'focus:outline-none focus:ring-1 focus:ring-neutral-400/60 focus:border-neutral-400',
            )}
          />
        </div>
      </div>
      <ul className="max-h-60 overflow-y-auto py-1">
        {filtered.length === 0 && (
          <li className="px-3 py-2 text-sm text-neutral-500">Không tìm thấy</li>
        )}
        {filtered.map((o) => (
          <li key={o.value || '__empty'}>
            <button
              type="button"
              title={o.label}
              onClick={() => pick(o.value)}
              className={cn(
                'w-full text-left px-3 py-2 text-sm transition-colors',
                o.value === value
                  ? 'bg-neutral-100 dark:bg-neutral-700 font-medium text-neutral-900 dark:text-neutral-100'
                  : 'text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-700/80',
              )}
            >
              {o.content ?? o.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className={cn('w-full', className)}>
      {label && (
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
          {label}
        </label>
      )}
      <div ref={containerRef} className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            if (disabled) return;
            setIsOpen((o) => !o);
            setQuery('');
          }}
          className={cn(
            'w-full flex items-center gap-2 px-3 py-2 pr-9 text-left border rounded-lg',
            'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100',
            'focus:outline-none focus:ring-1 focus:ring-neutral-400/60 focus:border-neutral-400',
            'dark:focus:ring-neutral-500 dark:focus:border-neutral-500',
            'disabled:bg-neutral-100 dark:disabled:bg-neutral-700 disabled:cursor-not-allowed',
            error
              ? 'border-red-500 focus:ring-red-400 focus:border-red-500'
              : 'border-neutral-300 dark:border-neutral-600',
          )}
        >
          <span
            className={cn(
              'flex-1 min-w-0 truncate text-sm text-left',
              !selected && 'text-neutral-400',
            )}
            title={selected?.label}
          >
            {selected?.label || placeholder}
          </span>
        </button>
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
          {clearable && value && !disabled && (
            <button
              type="button"
              tabIndex={-1}
              className="p-0.5 text-neutral-400 hover:text-neutral-600 rounded"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
                setQuery('');
              }}
              title="Xóa chọn"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown
            className={cn(
              'w-4 h-4 text-neutral-400 pointer-events-none transition-transform',
              isOpen && 'rotate-180',
            )}
          />
        </div>
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      {popover && createPortal(popover, document.body)}
    </div>
  );
}
