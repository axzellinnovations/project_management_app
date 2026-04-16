import React from 'react';

interface InboxBadgeProps {
  count: number;
  size?: 'overlay' | 'inline';
  cap?: number;
  className?: string;
}

export default function InboxBadge({
  count,
  size = 'overlay',
  cap = 99,
  className = '',
}: InboxBadgeProps) {
  if (count <= 0) return null;

  const displayCount = count > cap ? `${cap}+` : String(count);

  const baseClassName =
    'inline-flex items-center justify-center rounded-full font-bold leading-none text-white whitespace-nowrap';

  const sizeClassName =
    size === 'overlay'
      ? 'pointer-events-none h-5 min-w-[1.25rem] border-2 border-white bg-cu-primary px-1 text-[10px] shadow-sm'
      : 'h-[18px] min-w-[18px] border border-white/70 bg-cu-primary px-1.5 text-[9px] shadow-sm';

  return (
    <span className={`${baseClassName} ${sizeClassName} ${className}`.trim()}>
      {displayCount}
    </span>
  );
}
