import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/utils/cn';

/**
 * Slide-over Drawer panel from the right with ESC key listener
 */
export function Drawer({ isOpen, onClose, title, subtitle, children, footer, className }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-[#0B1F3A]/60 dark:bg-black/80 backdrop-blur-sm transition-opacity"
      />

      <div className="fixed inset-y-0 right-0 pl-10 max-w-full flex">
        <div
          className={cn(
            'w-screen max-w-md bg-white dark:bg-[#0c1626] border-l border-[#E5EAF1] dark:border-slate-800 shadow-2xl flex flex-col',
            className
          )}
        >
          {/* Header */}
          <div className="p-5 border-b border-[#E5EAF1] dark:border-slate-800 flex items-center justify-between">
            <div>
              {title && (
                <h3 className="text-base font-bold text-[#0B1F3A] dark:text-slate-100">{title}</h3>
              )}
              {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              aria-label="Close drawer"
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 p-5 overflow-y-auto space-y-4">{children}</div>

          {/* Footer */}
          {footer && (
            <div className="p-4 border-t border-[#E5EAF1] dark:border-slate-800 flex items-center justify-end gap-3 bg-slate-50/50 dark:bg-slate-900/40">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Drawer;
