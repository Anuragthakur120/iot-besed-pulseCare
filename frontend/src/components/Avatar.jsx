import React, { useState } from 'react';
import { cn } from '@/utils/cn';

function getInitials(name = '') {
  if (!name) return 'U';
  const parts = name.trim().replace(/^(Dr\.|Mr\.|Mrs\.|Ms\.)\s*/i, '').split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return parts[0].substring(0, 2).toUpperCase();
}

const colorPalettes = [
  'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/30',
  'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
  'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
  'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30',
  'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
];

function getDeterministicColor(str = '') {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colorPalettes.length;
  return colorPalettes[index];
}

/**
 * Avatar with Image Support & Accessible Initials Fallback
 */
export function Avatar({ src, name, size = 'md', className, ...props }) {
  const [imageError, setImageError] = useState(false);

  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base font-semibold',
    xl: 'w-16 h-16 text-xl font-bold'
  };

  const initials = getInitials(name);
  const colorClass = getDeterministicColor(name);

  return (
    <div
      className={cn(
        'relative rounded-full shrink-0 flex items-center justify-center border select-none overflow-hidden',
        sizes[size],
        colorClass,
        className
      )}
      {...props}
    >
      {src && !imageError ? (
        <img
          src={src}
          alt={name || 'User Avatar'}
          onError={() => setImageError(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <span className="font-semibold tracking-wider">{initials}</span>
      )}
    </div>
  );
}

export default Avatar;
