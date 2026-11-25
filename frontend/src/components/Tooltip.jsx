import React, { useState } from 'react';
import { cn } from '@/utils/cn';

/**
 * Accessible Hover / Focus Tooltip
 */
export function Tooltip({ text, children, position = 'top', className }) {
  const [visible, setVisible] = useState(false);

  const positions = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2'
  };

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && text && (
        <div
          role="tooltip"
          className={cn(
            'absolute z-50 px-2.5 py-1 text-[11px] font-medium text-white bg-slate-900 dark:bg-slate-800 border border-slate-700/80 rounded-md shadow-lg whitespace-nowrap pointer-events-none transition-opacity duration-150',
            positions[position],
            className
          )}
        >
          {text}
        </div>
      )}
    </div>
  );
}

export default Tooltip;
