import React from 'react';
import { cn } from '@/utils/cn';

/**
 * Reusable Accessible Tabs Component
 */
export function Tabs({ tabs = [], activeTab, onChange, variant = 'underline', className }) {
  return (
    <div
      role="tablist"
      className={cn(
        'flex items-center gap-1 select-none',
        variant === 'underline' && 'border-b border-[#E5EAF1] dark:border-slate-800',
        variant === 'pills' && 'p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-[#E5EAF1] dark:border-slate-800',
        className
      )}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={cn(
              'inline-flex items-center gap-2 text-xs font-semibold px-4 py-2.5 transition-all duration-150',
              variant === 'underline' && [
                'border-b-2 -mb-px',
                isActive
                  ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              ],
              variant === 'pills' && [
                'rounded-lg',
                isActive
                  ? 'bg-white dark:bg-[#0c1626] text-teal-600 dark:text-teal-400 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              ]
            )}
          >
            {Icon && <Icon className="w-4 h-4 shrink-0" />}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={cn(
                  'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                  isActive
                    ? 'bg-teal-500/10 text-teal-600 dark:text-teal-300'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                )}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default Tabs;
