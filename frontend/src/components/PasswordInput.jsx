import React, { useState } from 'react';
import { Eye, EyeOff, Check, X, Lock } from 'lucide-react';
import { cn } from '@/utils/cn';

/**
 * PasswordInput with Show/Hide toggle and interactive Password Strength Meter
 */
export const PasswordInput = React.forwardRef(
  (
    {
      label = 'Password',
      error,
      helperText,
      value = '',
      onChange,
      showStrengthMeter = false,
      required = true,
      className,
      id,
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const inputId = id || props.name || 'password-input';

    const pwd = typeof value === 'string' ? value : '';

    const checks = [
      { label: 'At least 10 characters', met: pwd.length >= 10 },
      { label: 'One uppercase letter (A-Z)', met: /[A-Z]/.test(pwd) },
      { label: 'One lowercase letter (a-z)', met: /[a-z]/.test(pwd) },
      { label: 'One number (0-9)', met: /[0-9]/.test(pwd) },
      { label: 'One special symbol (!@#$%)', met: /[^A-Za-z0-9]/.test(pwd) }
    ];

    const score = checks.filter((c) => c.met).length;

    const strengthLabel = {
      0: { text: 'Very Weak', color: 'bg-slate-300 dark:bg-slate-700', textCol: 'text-slate-400' },
      1: { text: 'Weak', color: 'bg-rose-500', textCol: 'text-rose-500' },
      2: { text: 'Weak', color: 'bg-rose-500', textCol: 'text-rose-500' },
      3: { text: 'Moderate', color: 'bg-amber-500', textCol: 'text-amber-500' },
      4: { text: 'Good', color: 'bg-sky-500', textCol: 'text-sky-500' },
      5: { text: 'Strong', color: 'bg-teal-500', textCol: 'text-teal-500' }
    }[score];

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
          <div className="absolute left-3 text-slate-400 dark:text-slate-500 pointer-events-none flex items-center">
            <Lock className="w-4 h-4" />
          </div>
          <input
            ref={ref}
            id={inputId}
            type={showPassword ? 'text' : 'password'}
            value={value}
            onChange={onChange}
            required={required}
            className={cn(
              'w-full bg-white dark:bg-slate-900 border border-[#E5EAF1] dark:border-slate-800 text-[#0B1F3A] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 text-sm rounded-input py-2.5 pl-9 pr-10 transition-all duration-150',
              'focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:focus:ring-teal-400/20',
              error && 'border-rose-500 text-rose-900 dark:text-rose-100',
              className
            )}
            {...props}
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-md transition-colors"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        {/* Password Strength Meter & Checklist */}
        {showStrengthMeter && pwd.length > 0 && (
          <div className="mt-2 space-y-2 p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-[#E5EAF1] dark:border-slate-800 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Strength:</span>
              <span className={cn('font-semibold', strengthLabel.textCol)}>{strengthLabel.text}</span>
            </div>
            {/* Progress Bars */}
            <div className="grid grid-cols-5 gap-1.5 h-1.5">
              {[1, 2, 3, 4, 5].map((lvl) => (
                <div
                  key={lvl}
                  className={cn(
                    'rounded-full transition-colors duration-200',
                    score >= lvl ? strengthLabel.color : 'bg-slate-200 dark:bg-slate-800'
                  )}
                />
              ))}
            </div>
            {/* Rules Checklist */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 pt-1">
              {checks.map((rule, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'flex items-center gap-1.5 text-[11px] transition-colors',
                    rule.met ? 'text-teal-600 dark:text-teal-400 font-medium' : 'text-slate-400 dark:text-slate-500'
                  )}
                >
                  {rule.met ? <Check className="w-3.5 h-3.5 shrink-0" /> : <X className="w-3.5 h-3.5 shrink-0" />}
                  <span>{rule.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-xs text-rose-500 mt-1 font-medium">{error}</p>}
        {!error && helperText && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{helperText}</p>}
      </div>
    );
  }
);

PasswordInput.displayName = 'PasswordInput';
export default PasswordInput;
