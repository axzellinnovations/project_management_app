'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SearchIcon, BellIcon } from './SidebarIcons';
import type { Notification } from '@/services/notifications-service';

function formatRelativeTime(timestamp?: string | null): string {
  if (!timestamp) return 'Unknown time';
  const time = new Date(timestamp).getTime();
  if (Number.isNaN(time)) return 'Unknown time';
  const diffMin = Math.floor((Date.now() - time) / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d`;
  return new Date(timestamp).toLocaleDateString();
}

function NotificationDropdownItem({ item, onClick }: { item: Notification; onClick: () => void }) {
  return (
    <div
      className={`group flex items-start gap-2.5 px-3 py-2.5 hover:bg-cu-hover transition-colors cursor-pointer ${
        !item.read ? 'bg-blue-50/30' : ''
      }`}
      onClick={onClick}
    >
      <div className="w-8 h-8 rounded-full bg-cu-primary/10 flex items-center justify-center text-cu-primary flex-shrink-0 mt-0.5">
        <BellIcon />
      </div>
      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold text-cu-text-muted uppercase tracking-wide truncate">
            {item.type}
          </span>
          <span className="text-[10px] text-cu-text-muted">{formatRelativeTime(item.createdAt)}</span>
        </div>
        <div className="mt-0.5">
          <span className="text-[12px] font-semibold text-cu-text-primary leading-tight line-clamp-2">
            {item.message}
          </span>
        </div>
      </div>
      {!item.read && (
        <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
      )}
    </div>
  );
}

export function NotificationsDropdown({
  fixedTop,
  fixedLeft,
  notifications,
  search,
  onSearch,
  onClose,
}: {
  fixedTop: number;
  fixedLeft: number;
  notifications: Notification[];
  search: string;
  onSearch: (s: string) => void;
  onClose: () => void;
}) {
  const router = useRouter();

  const displayItems = notifications
    .filter(n => {
      if (!search) return true;
      const s = search.toLowerCase();
      return (
        (n.message || '').toLowerCase().includes(s) ||
        (n.type || '').toLowerCase().includes(s)
      );
    })
    .slice(0, 4);

  const handleItemClick = (item: Notification) => {
    onClose();
    if (typeof item.link === 'string') {
      router.push(item.link);
    }
  };

  return (
    <div
      data-sidebar-dropdown
      className="bg-white rounded-xl border border-cu-border shadow-2xl shadow-black/10 overflow-hidden flex flex-col"
      style={{
        position: 'fixed',
        top: fixedTop,
        left: fixedLeft,
        width: '260px',
        zIndex: 9999,
        animation: 'dropdownIn 180ms cubic-bezier(0.4,0,0.2,1)',
        maxHeight: '400px'
      }}
    >
      <div className="px-3 pt-3 pb-2 border-b border-cu-border-light">
        <div className="relative">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <SearchIcon />
          </div>
          <input
            type="text"
            value={search}
            onChange={e => onSearch(e.target.value)}
            placeholder="Search notifications…"
            autoFocus
            className="w-full pl-8 pr-3 py-1.5 text-[12px] bg-cu-bg-tertiary border border-cu-border rounded-lg placeholder-cu-text-muted text-cu-text-primary focus:outline-none focus:ring-1 focus:ring-cu-primary/30 focus:border-cu-primary/40 transition-all"
          />
        </div>
      </div>

      <div className="overflow-y-auto flex-1 py-1 custom-scrollbar">
        {displayItems.length > 0 ? (
          <div className="mb-1">
            {displayItems.map((item) => (
              <NotificationDropdownItem
                key={item.id}
                item={item}
                onClick={() => handleItemClick(item)}
              />
            ))}
          </div>
        ) : (
          <div className="px-3 py-6 text-center">
            <div className="text-[12px] text-cu-text-muted font-medium">No notifications</div>
          </div>
        )}
      </div>

      <div className="border-t border-cu-border-light px-3 py-2 bg-cu-bg-tertiary">
        <Link
          href="/dashboard/notifications"
          onClick={onClose}
          className="flex items-center justify-between w-full text-[12px] font-medium text-cu-primary hover:text-cu-primary-dark transition-colors"
        >
          <span>View All</span>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M3 6h6M7 4l2 2-2 2" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
