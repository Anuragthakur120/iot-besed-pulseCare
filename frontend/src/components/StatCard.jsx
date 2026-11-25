import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/utils/cn';
import Card from './Card';
import StatusPill from './StatusPill';

/**
 * Hospital Clinical Stat Card with tabular-nums and live telemetry indicators
 */
export function StatCard({
  title,
  value,
  unit,
  icon: Icon,
  iconColor = 'text-teal-500 bg-teal-500/10 border-teal-500/20',
  trend,
  trendDirection = 'neutral', // 'up' | 'down' | 'neutral'
  status,
  timestamp,
  className
}) {
  return (
    <Card className={cn('p-5 space-y-3', className)}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {title}
          </span>
          <div className="flex items-baseline gap-1.5 pt-1">
            <span className="text-3xl font-bold text-[#0B1F3A] dark:text-white tabular-nums tracking-tight">
              {value !== undefined && value !== null ? value : '--'}
            </span>
            {unit && <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">{unit}</span>}
          </div>
        </div>

        {Icon && (
          <div className={cn('w-11 h-11 rounded-xl border flex items-center justify-center shrink-0', iconColor)}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-[#E5EAF1] dark:border-slate-800/80 text-xs">
        {trend ? (
          <div
            className={cn(
              'inline-flex items-center gap-1 font-semibold tabular-nums',
              trendDirection === 'up' && 'text-emerald-600 dark:text-emerald-400',
              trendDirection === 'down' && 'text-rose-600 dark:text-rose-400',
              trendDirection === 'neutral' && 'text-slate-500 dark:text-slate-400'
            )}
          >
            {trendDirection === 'up' && <TrendingUp className="w-3.5 h-3.5" />}
            {trendDirection === 'down' && <TrendingDown className="w-3.5 h-3.5" />}
            {trendDirection === 'neutral' && <Minus className="w-3.5 h-3.5" />}
            <span>{trend}</span>
          </div>
        ) : timestamp ? (
          <span className="text-slate-400 dark:text-slate-500 text-[11px] tabular-nums">Updated {timestamp}</span>
        ) : (
          <span />
        )}

        {status && <StatusPill status={status} />}
      </div>
    </Card>
  );
}

export default StatCard;
