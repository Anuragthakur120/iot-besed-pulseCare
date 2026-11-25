import React from 'react';
import { cn } from '@/utils/cn';

/**
 * Hardware / Telemetry Status Pill
 * States: LIVE (green pulse), STALE (amber), DISCONNECTED (red), NO DATA (grey)
 */
export function StatusPill({ status = 'NO DATA', label, className }) {
  const normalized = status.toUpperCase().replace('_', ' ');

  const config = {
    LIVE: {
      bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300',
      dot: 'bg-emerald-500',
      ping: true,
      defaultLabel: 'LIVE'
    },
    STALE: {
      bg: 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300',
      dot: 'bg-amber-500',
      ping: false,
      defaultLabel: 'STALE'
    },
    DISCONNECTED: {
      bg: 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300',
      dot: 'bg-rose-500',
      ping: false,
      defaultLabel: 'DISCONNECTED'
    },
    OFFLINE: {
      bg: 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300',
      dot: 'bg-rose-500',
      ping: false,
      defaultLabel: 'OFFLINE'
    },
    'NO DATA': {
      bg: 'bg-slate-500/10 border-slate-500/30 text-slate-600 dark:text-slate-400',
      dot: 'bg-slate-400',
      ping: false,
      defaultLabel: 'NO DATA'
    }
  }[normalized] || {
    bg: 'bg-slate-500/10 border-slate-500/30 text-slate-600 dark:text-slate-400',
    dot: 'bg-slate-400',
    ping: false,
    defaultLabel: normalized
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide border tabular-nums',
        config.bg,
        className
      )}
    >
      <span className="relative flex h-2 w-2 shrink-0">
        {config.ping && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        )}
        <span className={cn('relative inline-flex rounded-full h-2 w-2', config.dot)}></span>
      </span>
      <span>{label || config.defaultLabel}</span>
    </span>
  );
}

export default StatusPill;
