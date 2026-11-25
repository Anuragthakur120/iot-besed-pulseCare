import React, { useState } from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/utils/cn';

/**
 * Clinical Date Range Picker with quick presets
 */
export function DateRangePicker({ startDate, endDate, onChange, className }) {
  const [preset, setPreset] = useState('24h');

  const handlePreset = (type) => {
    setPreset(type);
    const now = new Date();
    let start = new Date();

    if (type === 'today') {
      start.setHours(0, 0, 0, 0);
    } else if (type === '24h') {
      start.setTime(now.getTime() - 24 * 3600 * 1000);
    } else if (type === '7d') {
      start.setTime(now.getTime() - 7 * 24 * 3600 * 1000);
    } else if (type === '30d') {
      start.setTime(now.getTime() - 30 * 24 * 3600 * 1000);
    }

    if (onChange) {
      onChange({ startDate: start.toISOString(), endDate: now.toISOString() });
    }
  };

  return (
    <div className={cn('inline-flex items-center gap-2 text-xs', className)}>
      <div className="flex items-center rounded-lg border border-[#E5EAF1] dark:border-slate-800 bg-white dark:bg-slate-900 p-0.5 shadow-sm">
        <span className="px-2 text-slate-400">
          <CalendarIcon className="w-3.5 h-3.5" />
        </span>
        {[
          { id: 'today', label: 'Today' },
          { id: '24h', label: '24 Hours' },
          { id: '7d', label: '7 Days' },
          { id: '30d', label: '30 Days' }
        ].map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => handlePreset(p.id)}
            className={cn(
              'px-2.5 py-1 rounded-md font-medium transition-colors',
              preset === p.id
                ? 'bg-teal-500 text-white font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default DateRangePicker;
