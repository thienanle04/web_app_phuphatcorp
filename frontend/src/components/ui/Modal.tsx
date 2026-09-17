import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '2/3' | 'full';
}

export function Modal({ isOpen, onClose, title, children, className, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizes = {
    sm: 'sm:max-w-sm',
    md: 'sm:max-w-md',
    lg: 'sm:max-w-lg',
    xl: 'sm:max-w-xl',
    '2xl': 'sm:max-w-2xl',
    '3xl': 'sm:max-w-3xl',
    '4xl': 'sm:max-w-4xl',
    '5xl': 'sm:max-w-5xl',
    '2/3': 'sm:max-w-[95vw] md:max-w-[85vw] lg:w-2/3 lg:max-w-[66.666667vw]',
    full: 'sm:max-w-[92vw]',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 transition-opacity" onClick={onClose} />
      
      {/* Responsive Sheet/Modal Box */}
      <div
        className={cn(
          'relative w-full bg-white dark:bg-neutral-900 rounded-t-2xl sm:rounded-xl shadow-2xl max-h-[92vh] sm:max-h-[90vh] flex flex-col z-10 transition-transform duration-200 ease-out',
          sizes[size],
          className
        )}
      >
        {title && (
          <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-neutral-200 dark:border-neutral-800 shrink-0">
            <h3 className="text-base sm:text-lg font-semibold text-neutral-900 dark:text-neutral-100 pr-2 leading-snug">
              {title}
            </h3>
            <button
              onClick={onClose}
              aria-label="Close"
              className="p-1.5 text-neutral-400 dark:text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        <div className="p-4 sm:p-6 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>
  );
}
