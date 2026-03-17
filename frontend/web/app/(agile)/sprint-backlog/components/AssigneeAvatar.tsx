'use client';

import Image from 'next/image';
import { UserCircle2 } from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';

interface AssigneeAvatarProps {
  name?: string | null;
  profilePicUrl?: string | null;
  size?: number;
  className?: string;
  fallbackClassName?: string;
}

const joinClasses = (...values: Array<string | undefined>) => values.filter(Boolean).join(' ');

const resolveProfilePic = (url?: string | null) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_BASE_URL}${url}`;
};

const getInitials = (name?: string | null) => {
  if (!name) return '';

  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('');
};

export default function AssigneeAvatar({
  name,
  profilePicUrl,
  size = 20,
  className,
  fallbackClassName,
}: AssigneeAvatarProps) {
  const resolvedProfilePic = resolveProfilePic(profilePicUrl);
  const initials = getInitials(name);
  const showInitials = !resolvedProfilePic && !!initials && name !== 'Unassigned';
  const iconSize = Math.max(12, Math.round(size * 0.7));

  return (
    <span
      className={joinClasses(
        'inline-flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#DCE8F8] text-[#175CD3]',
        fallbackClassName,
        className
      )}
      style={{ width: size, height: size }}
    >
      {resolvedProfilePic ? (
        <Image
          src={resolvedProfilePic}
          alt={name || 'Assignee avatar'}
          width={size}
          height={size}
          className="h-full w-full object-cover"
          unoptimized
        />
      ) : showInitials ? (
        <span
          className="font-semibold leading-none"
          style={{ fontSize: Math.max(10, Math.round(size * 0.38)) }}
        >
          {initials}
        </span>
      ) : (
        <UserCircle2 size={iconSize} strokeWidth={1.5} className="text-[#98A2B3]" />
      )}
    </span>
  );
}