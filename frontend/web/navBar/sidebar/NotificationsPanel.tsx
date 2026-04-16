'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import type { Notification } from '@/services/notifications-service';

function formatRelativeTime(ts?: string | null): string {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

function NotificationItem({ n, onClick }: { n: Notification; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-start gap-2.5 px-3 py-2.5 hover:bg-cu-hover transition-colors ${!n.read ? 'bg-blue-50/40' : ''}`}
    >
      {/* Unread dot */}
      <span className={`mt-[5px] w-2 h-2 rounded-full shrink-0 ${!n.read ? 'bg-blue-500' : 'bg-transparent'}`} />
      <div className="flex flex-col flex-1 min-w-0">
        <span className="text-[12px] font-semibold text-cu-text-primary leading-snug line-clamp-2">
          {n.message}
        </span>
        {n.type && (
          <span className="text-[10px] text-cu-text-muted mt-0.5 uppercase tracking-wide leading-snug">
            {n.type}
          </span>
        )}
        <span className="text-[10px] text-cu-text-muted mt-1">
          {formatRelativeTime(n.createdAt)}
        </span>
      </div>
    </button>
  );
}

interface NotificationsPanelContentProps {
  notifications: Notification[];
  onClose: () => void;
}

export function NotificationsPanelContent({ notifications, onClose }: NotificationsPanelContentProps) {
  const router = useRouter();
  const recent = notifications.slice(0, 6);

  const handleClick = (n: Notification) => {
    onClose();
    if (n.link) {
      router.push(n.link);
    } else {
      router.push('/dashboard/notifications');
    }
  };

  if (recent.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
        </div>
        <span className="text-[12px] font-medium text-cu-text-muted">No new notifications</span>
      </div>
    );
  }

  return (
    <div className="py-1">
      {recent.map((n) => (
        <NotificationItem key={n.id} n={n} onClick={() => handleClick(n)} />
      ))}
    </div>
  );
}
