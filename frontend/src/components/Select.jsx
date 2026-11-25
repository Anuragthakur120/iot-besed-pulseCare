import React from 'react';
import { ChevronDown, AlertCircle } from 'lucide-react';
import { cn } from '@/utils/cn';

/**
 * Reusable Accessible Select Component
 */
export const Select = React.forwardRef(
  (
    {
      label,
      error,
      helperText,
      options = [],
      className,
      id,
      required,
      children,
      ...props
    },
    ref
  ) => {
    const selectId = id || props.name || Math.random().toString(36).substring(2, 9);

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-xs font-semibold text-[#0B1F3A] dark:text-slate-200 tracking-wide"
          >
            {label} {required && <span className="text-rose-500">*</span>}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            required={required}
            className={cn(
              'w-full bg-white dark:bg-slate-900 border border-[#E5EAF1] dark:border-slate-800 text-[#0B1F3A] dark:text-slate-100 text-sm rounded-input py-2.5 px-3.5 pr-10 appearance-none transition-all duration-150 cursor-pointer',
              'focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:focus:ring-teal-400/20',
              error && 'border-rose-500 text-rose-900 dark:text-rose-100',
              className
            )}
            {...props}
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
            {children}
          </select>
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>
        {error && (
          <p className="text-xs text-rose-500 flex items-center gap-1 mt-1 font-medium">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{error}</span>
          </p>
        )}
        {!error && helperText && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{helperText}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';
export default Select;
