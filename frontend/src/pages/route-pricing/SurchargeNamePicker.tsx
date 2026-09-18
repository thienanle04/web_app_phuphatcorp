import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, X } from 'lucide-react';
import { useI18n } from '../../i18n/useI18n';
import { cn } from '../../utils/cn';

interface Props {
  label: string;
  names: string[];
  selected: string[];
  onChange: (names: string[]) => void;
  placeholder: string;
  error?: string;
  disabled?: boolean;
}

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
}

const POPOVER_MAX_HEIGHT = 320;

export function SurchargeNamePicker({ label, names, selected, onChange, placeholder, error, disabled }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const queryText = query.trim();
  const filtered = useMemo(
    () => (queryText ? names.filter((name) => normalize(name).includes(normalize(queryText))) : []),
    [names, queryText],
  );

  const updatePosition = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < POPOVER_MAX_HEIGHT && rect.top > spaceBelow;
    const width = Math.max(rect.width, 240);
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
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
    if (!open) return;
    updatePosition();
    searchRef.current?.focus();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
      setQuery('');
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  function toggle(name: string) {
    if (disabled) return;
    onChange(selected.includes(name) ? selected.filter((item) => item !== name) : [...selected, name]);
  }

  function close() {
    setOpen(false);
    setQuery('');
  }

  const popover = open && !disabled && (
    <div
      ref={popoverRef}
      style={popoverStyle}
      className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-xl overflow-hidden"
    >
      <div className="p-2 border-b border-neutral-100 dark:border-neutral-700">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 pointer-events-none" aria-hidden="true" />
          <input
            ref={searchRef}
            id="surcharge-customer"
            name="ten_khach_hang"
            autoComplete="off"
            value={query}
            placeholder={t('customerSurcharges.placeholder.search')}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full pl-8 pr-8 py-1.5 text-sm rounded-lg border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-neutral-400/60"
          />
          {query.length > 0 && (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-neutral-400 hover:text-neutral-700"
              aria-label={t('customerSurcharges.action.clearSearch')}
              onClick={() => setQuery('')}
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
      {queryText.length > 0 && (
        <ul className="max-h-60 overflow-y-auto py-1" role="listbox" aria-multiselectable="true">
          {filtered.length === 0 && (
            <li className="px-3 py-2 text-sm text-neutral-500">{t('customerSurcharges.emptySearch')}</li>
          )}
          {filtered.map((name) => (
            <li key={name}>
              <label className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-700/80">
                <input
                  type="checkbox"
                  name="ten_khach_hangs"
                  checked={selected.includes(name)}
                  onChange={() => toggle(name)}
                />
                <span className="truncate" title={name}>{name}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div>
      <label htmlFor="surcharge-customer" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
        {label}
      </label>
      <div ref={containerRef} className="relative">
        <button
          type="button"
          disabled={disabled}
          aria-expanded={open}
          onClick={() => {
            if (disabled) return;
            if (open) close();
            else setOpen(true);
          }}
          className={cn(
            'w-full flex items-center gap-2 px-3 py-2 pr-9 text-left border rounded-lg text-sm',
            'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100',
            'focus:outline-none focus:ring-1 focus:ring-neutral-400/60 focus:border-neutral-400',
            'disabled:bg-neutral-100 dark:disabled:bg-neutral-700 disabled:cursor-not-allowed',
            error ? 'border-red-500' : 'border-neutral-300 dark:border-neutral-600',
          )}
        >
          <span className="flex-1 truncate text-neutral-400">{placeholder}</span>
        </button>
        <ChevronDown className={cn('absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none', open && 'rotate-180')} aria-hidden="true" />
      </div>
      {selected.length > 0 && (
        <ul className="mt-2 space-y-1">
          {selected.map((name) => (
            <li key={name} className="flex w-full items-center gap-1 px-2 py-1 text-sm bg-neutral-100 dark:bg-neutral-800">
              <span className="min-w-0 flex-1 truncate" title={name}>{name}</span>
              <button
                type="button"
                className="p-0.5 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
                aria-label={t('customerSurcharges.action.removeName', { name })}
                disabled={disabled}
                onClick={() => toggle(name)}
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      {popover && createPortal(popover, document.body)}
    </div>
  );
}
