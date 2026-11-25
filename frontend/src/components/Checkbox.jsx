import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/utils/cn';

/**
 * Reusable Accessible Checkbox Component
 */
export const Checkbox = React.forwardRef(
  ({ label, checked, onChange, error, className, id, disabled, ...props }, ref) => {
    const boxId = id || props.name || Math.random().toString(36).substring(2, 9);

    return (
      <div className="flex flex-col text-left">
        <label
          htmlFor={boxId}
          className={cn(
            'inline-flex items-start gap-2.5 cursor-pointer select-none group',
            disabled && 'opacity-50 pointer-events-none cursor-not-allowed',
            className
          )}
        >
          <div className="relative flex items-center justify-center shrink-0 mt-0.5">
            <input
              ref={ref}
              id={boxId}
              type="checkbox"
              checked={checked}
              onChange={onChange}
              disabled={disabled}
              className="sr-only peer"
              {...props}
            />
            <div
              className={cn(
                'w-4 h-4 rounded-md border border-[#E5EAF1] dark:border-slate-700 bg-white dark:bg-slate-900 transition-all duration-150',
                'peer-checked:bg-teal-500 peer-checked:border-teal-500 peer-focus-visible:ring-2 peer-focus-visible:ring-teal-500/20',
                error && 'border-rose-500'
              )}
            >
              <Check className={cn('w-3.5 h-3.5 text-white transition-opacity', checked ? 'opacity-100' : 'opacity-0')} />
            </div>
          </div>
          {label && (
            <span className="text-xs text-[#0B1F3A] dark:text-slate-300 leading-normal">
              {label}
            </span>
          )}
        </label>
        {error && <p className="text-xs text-rose-500 mt-1 font-medium">{error}</p>}
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';
export default Checkbox;
