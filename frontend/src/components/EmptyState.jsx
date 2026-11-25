import React from 'react';
import { Inbox } from 'lucide-react';
import { cn } from '@/utils/cn';
import Button from './Button';

/**
 * Reusable Empty State component with icon, title, description, and action button
 */
export function EmptyState({
  icon: Icon = Inbox,
  title = 'No records found',
  description = 'There is currently no data available to display here.',
  actionLabel,
  onAction,
  className
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 text-center space-y-3 rounded-card border border-dashed border-[#E5EAF1] dark:border-slate-800 bg-white/50 dark:bg-slate-900/20',
        className
      )}
    >
      <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center">
        <Icon className="w-6 h-6" />
      </div>
      <div className="space-y-1 max-w-sm">
        <h4 className="text-sm font-bold text-[#0B1F3A] dark:text-slate-100">{title}</h4>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{description}</p>
      </div>
      {actionLabel && onAction && (
        <Button variant="primary" size="sm" onClick={onAction} className="mt-2">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

export default EmptyState;
