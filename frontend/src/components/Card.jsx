import React from 'react';
import { cn } from '@/utils/cn';

/**
 * Reusable Card component with 14px radius and soft shadow
 */
export function Card({ children, className, hover = false, ...props }) {
  return (
    <div
      className={cn(
        'bg-white dark:bg-[#0c1626] border border-[#E5EAF1] dark:border-slate-800 rounded-card shadow-soft p-5 transition-all duration-200',
        hover && 'hover:shadow-soft-hover hover:border-teal-500/30 cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className, action, title, subtitle, ...props }) {
  return (
    <div
      className={cn('flex items-center justify-between pb-4 mb-4 border-b border-[#E5EAF1] dark:border-slate-800/80', className)}
      {...props}
    >
      <div>
        {title && <h3 className="text-base font-semibold text-[#0B1F3A] dark:text-slate-100">{title}</h3>}
        {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
        {children}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardContent({ children, className, ...props }) {
  return (
    <div className={cn('space-y-4', className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className, ...props }) {
  return (
    <div
      className={cn('pt-4 mt-4 border-t border-[#E5EAF1] dark:border-slate-800/80 flex items-center justify-between', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export default Card;
