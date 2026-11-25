import React from 'react';
import { cn } from '@/utils/cn';

/**
 * Skeleton Loader with shimmer pulse effect
 */
export function Skeleton({ className, variant = 'rect', ...props }) {
  const variants = {
    rect: 'rounded-input',
    circle: 'rounded-full',
    text: 'h-4 rounded'
  };

  return (
    <div
      className={cn(
        'animate-pulse bg-slate-200 dark:bg-slate-800/80',
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="p-5 rounded-card border border-[#E5EAF1] dark:border-slate-800 bg-white dark:bg-[#0c1626] space-y-3">
      <div className="flex justify-between items-center">
        <Skeleton variant="text" className="w-24" />
        <Skeleton variant="circle" className="w-8 h-8" />
      </div>
      <Skeleton variant="text" className="w-36 h-8" />
      <Skeleton variant="text" className="w-28 h-3" />
    </div>
  );
}

export default Skeleton;
