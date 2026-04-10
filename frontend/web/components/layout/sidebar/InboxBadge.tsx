import React from 'react';

interface InboxBadgeProps {
  count: number;
}

export default function InboxBadge({ count }: InboxBadgeProps) {
  if (count <= 0) return null;

  return (
    <span className="ml-auto bg-cu-primary/10 text-cu-primary text-[10px] px-1.5 py-0.5 rounded-full font-bold">
      {count > 99 ? '99+' : count}
    </span>
  );
}
