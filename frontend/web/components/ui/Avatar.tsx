'use client';

import React from 'react';
import Image from 'next/image';

const sizeClasses: Record<string, { container: string; text: string; pixels: number }> = {
  xs: { container: 'w-5 h-5', text: 'text-[8px]', pixels: 20 },
  sm: { container: 'w-6 h-6', text: 'text-2xs', pixels: 24 },
  md: { container: 'w-8 h-8', text: 'text-xs', pixels: 32 },
  lg: { container: 'w-10 h-10', text: 'text-sm', pixels: 40 },
  xl: { container: 'w-12 h-12', text: 'text-base', pixels: 48 },
};

const FALLBACK_COLORS = [
  'bg-cu-purple', 'bg-cu-success', 'bg-cu-warning', 'bg-cu-info',
  'bg-[#E91E63]', 'bg-[#9C27B0]', 'bg-[#00BCD4]', 'bg-[#FF5722]',
];

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function getColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
}

export interface AvatarProps {
  src?: string | null;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function Avatar({ src, name = '?', size = 'md', className = '' }: AvatarProps) {
  const s = sizeClasses[size];

  if (src) {
    return (
      <div className={`${s.container} rounded-full overflow-hidden shrink-0 ${className}`}>
        <Image
          src={src}
          alt={name}
          width={s.pixels}
          height={s.pixels}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={`${s.container} rounded-full shrink-0 flex items-center justify-center text-white font-medium ${getColor(name)} ${className}`}
    >
      <span className={s.text}>{getInitials(name)}</span>
    </div>
  );
}

// Avatar stack for showing multiple assignees
export interface AvatarStackProps {
  users: Array<{ name: string; src?: string | null }>;
  max?: number;
  size?: 'xs' | 'sm' | 'md';
}

export function AvatarStack({ users, max = 3, size = 'sm' }: AvatarStackProps) {
  const visible = users.slice(0, max);
  const remaining = users.length - max;

  return (
    <div className="flex items-center -space-x-1.5">
      {visible.map((user, i) => (
        <Avatar
          key={i}
          src={user.src}
          name={user.name}
          size={size}
          className="ring-2 ring-white"
        />
      ))}
      {remaining > 0 && (
        <div
          className={`${sizeClasses[size].container} rounded-full bg-cu-bg-tertiary border-2 border-white flex items-center justify-center shrink-0`}
        >
          <span className={`${sizeClasses[size].text} text-cu-text-secondary font-medium`}>
            +{remaining}
          </span>
        </div>
      )}
    </div>
  );
}
