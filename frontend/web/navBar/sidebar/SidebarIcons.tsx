'use client';

import React from 'react';

export const HomeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9.5L10 3L17 9.5V17H13V13H7V17H3V9.5Z" />
  </svg>
);

export function StarIcon({ className = '', size = 16 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m10 2.8 2.2 4.6 5 .7-3.6 3.5.9 5L10 14.7 5.5 16.6l.9-5L2.8 8.1l5-.7L10 2.8z" />
    </svg>
  );
}

export function ClockIcon({ className = '', size = 16 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="10" cy="10" r="7" /><path d="M10 6.5v4l2.5 1.5" />
    </svg>
  );
}

export const ProfileIcon = () => (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="10" cy="6" r="3" /><path d="M4 16c1.2-2.7 3.5-4 6-4s4.8 1.3 6 4" />
  </svg>
);

export const FolderIcon = () => (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2.5 6.5A1.5 1.5 0 0 1 4 5h4l1.5 2h6.5A1.5 1.5 0 0 1 17.5 8.5v6A1.5 1.5 0 0 1 16 16H4a1.5 1.5 0 0 1-1.5-1.5v-8z" />
  </svg>
);

export const UsersIcon = () => (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="7" cy="7" r="2.5" /><circle cx="13.5" cy="8" r="2" />
    <path d="M3.5 15c.8-2 2.5-3 4.7-3s3.9 1 4.7 3" />
    <path d="M12.2 14.5c.5-1.2 1.5-1.9 2.9-1.9 1.4 0 2.4.7 2.9 1.9" />
  </svg>
);

export const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3.5 5.5h13" /><path d="M7.5 5.5V4a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.5" />
    <path d="M6 5.5v10a1.5 1.5 0 0 0 1.5 1.5h5A1.5 1.5 0 0 0 14 15.5v-10" />
    <path d="M8.5 8.5v5M11.5 8.5v5" />
  </svg>
);

export const LogoutIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" />
    <path d="M10 17l5-5-5-5" /><path d="M15 12H3" />
  </svg>
);

export const InboxIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="m22 13-1.29-2.58a3 3 0 0 0-2.68-1.51H14.12l-1.42-3.12A2 2 0 0 0 10.88 4.67H5.29A3 3 0 0 0 2.61 6.25L1 9.47V17a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2Z" />
    <path d="M2 13h4.45l.91 1.82A2 2 0 0 0 9.15 16h5.7a2 2 0 0 0 1.79-1.18L17.55 13H22" />
  </svg>
);

export const MessageSquareIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

export const UserIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

export const BellIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);

export const SearchIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="#B0B8C4" strokeWidth="2" strokeLinecap="round">
    <circle cx="7" cy="7" r="5" /><path d="M11 11L14 14" />
  </svg>
);
