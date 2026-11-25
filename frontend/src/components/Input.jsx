import React from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/utils/cn';

/**
 * Reusable Accessible Input Component with 10px radius
 */
export const Input = React.forwardRef(
  (
    {
      label,
      error,
      helperText,
      leftIcon: LeftIcon,
      rightIcon: RightIcon,
      className,
      id,
      required,
      type = 'text',
      ...props
    },
    ref
  ) => {
    const inputId = id || props.name || Math.random().toString(36).substring(2, 9);

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold text-[#0B1F3A] dark:text-slate-200 tracking-wide"
          >
            {label} {required && <span className="text-rose-500">*</span>}
          </label>
        )}
        <div className="relative flex items-center">
          {LeftIcon && (
            <div className="absolute left-3 text-slate-400 dark:text-slate-500 pointer-events-none flex items-center">
              <LeftIcon className="w-4 h-4" />
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            type={type}
            required={required}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-help` : undefined}
            className={cn(
              'w-full bg-white dark:bg-slate-900 border border-[#E5EAF1] dark:border-slate-800 text-[#0B1F3A] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 text-sm rounded-input py-2.5 px-3.5 transition-all duration-150',
              'focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:focus:ring-teal-400/20',
              LeftIcon && 'pl-9',
              RightIcon && 'pr-9',
              error && 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20 text-rose-900 dark:text-rose-100',
              className
            )}
            {...props}
          />
          {RightIcon && (
            <div className="absolute right-3 text-slate-400 dark:text-slate-500 flex items-center">
              <RightIcon className="w-4 h-4" />
            </div>
          )}
        </div>
        {error && (
          <p
            id={`${inputId}-error`}
            role="alert"
            className="text-xs text-rose-500 flex items-center gap-1 mt-1 font-medium"
          >
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{error}</span>
          </p>
        )}
        {!error && helperText && (
          <p id={`${inputId}-help`} className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
export default Input;
