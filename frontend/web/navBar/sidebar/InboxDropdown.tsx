'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { UserIcon, MessageSquareIcon, SearchIcon } from './SidebarIcons';
import type { ChatInboxActivity } from '@/services/chat-service';
import InboxBadge from '@/components/layout/sidebar/InboxBadge';

function formatRelativeTime(timestamp?: string | null): string {
  if (!timestamp) return 'No timestamp';

  const time = new Date(timestamp).getTime();
  if (Number.isNaN(time)) return 'Unknown time';

  const diffMs = Date.now() - time;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;

  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d`;

  return new Date(timestamp).toLocaleDateString();
}

function InboxDropdownItem({ item, onClick }: { item: ChatInboxActivity; onClick: () => void }) {
  const label = item.chatType === 'ROOM'
    ? (item.roomName || 'Channel')
    : item.chatType === 'DIRECT'
      ? (item.username || 'Direct Message')
      : 'Team Chat';

  const icon = item.chatType === 'DIRECT'
    ? <UserIcon size={14} />
    : <MessageSquareIcon size={14} />;

  return (
    <div
      className="group flex items-start gap-2.5 px-3 py-2.5 hover:bg-cu-hover transition-colors cursor-pointer"
      onClick={onClick}
    >
      <div className="w-8 h-8 rounded-full bg-cu-primary/10 flex items-center justify-center text-cu-primary flex-shrink-0 mt-0.5">
        {icon}
      </div>
      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold text-cu-text-muted uppercase tracking-wide truncate">
            {item.projectName}
          </span>
          <span className="text-[10px] text-cu-text-muted">{formatRelativeTime(item.lastMessageTimestamp)}</span>
        </div>
        <div className="flex items-center justify-between gap-1 mt-0.5">
          <span className="text-[12px] font-semibold text-cu-text-primary truncate">{label}</span>
          {item.unread && <InboxBadge count={item.unseenCount} size="inline" cap={99} />}
        </div>
        <div className="text-[10.5px] text-cu-text-secondary truncate leading-normal mt-0.5">
          {item.lastMessageSender && <span className="font-medium mr-1 text-cu-text-primary">{item.lastMessageSender}:</span>}
          {item.lastMessage || 'No messages yet'}
        </div>
      </div>
    </div>
  );
}

export function InboxDropdown({
  fixedTop,
  fixedLeft,
  activities,
  loading,
  error,
  search,
  onSearch,
  onRetry,
  onClose,
}: {
  fixedTop: number;
  fixedLeft: number;
  activities: ChatInboxActivity[];
  loading: boolean;
  error: string | null;
  search: string;
  onSearch: (s: string) => void;
  onRetry: () => void;
  onClose: () => void;
}) {
  const router = useRouter();

  const displayItems = activities
    .filter(a => {
      if (!search) return true;
      const s = search.toLowerCase();
      return (
        (a.projectName || '').toLowerCase().includes(s) ||
        (a.roomName || '').toLowerCase().includes(s) ||
        (a.username || '').toLowerCase().includes(s) ||
        (a.lastMessage || '').toLowerCase().includes(s)
      );
    })
    .slice(0, 4);

  const openActivity = (item: ChatInboxActivity) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('currentProjectId', String(item.projectId));
      localStorage.setItem('currentProjectName', item.projectName || `Project ${item.projectId}`);
      window.dispatchEvent(new CustomEvent('planora:project-accessed'));
    }

    const basePath = `/project/${item.projectId}/chat`;
    if (item.chatType === 'ROOM' && item.roomId) {
      router.push(`${basePath}?roomId=${item.roomId}`);
      onClose();
      return;
    }

    if (item.chatType === 'DIRECT' && item.username) {
      router.push(`${basePath}?with=${encodeURIComponent(item.username)}`);
      onClose();
      return;
    }

    router.push(`${basePath}?view=team`);
    onClose();
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
            placeholder="Search messages…"
            autoFocus
            className="w-full pl-8 pr-3 py-1.5 text-[12px] bg-cu-bg-tertiary border border-cu-border rounded-lg placeholder-cu-text-muted text-cu-text-primary focus:outline-none focus:ring-1 focus:ring-cu-primary/30 focus:border-cu-primary/40 transition-all"
          />
        </div>
      </div>

      <div className="overflow-y-auto flex-1 py-1 custom-scrollbar">
        {loading ? (
          <div className="px-3 py-3 flex flex-col gap-3 animate-pulse">
            <div className="h-3 w-32 bg-gray-100 rounded" />
            <div className="h-3 w-24 bg-gray-100 rounded" />
            <div className="h-3 w-28 bg-gray-100 rounded" />
            <div className="h-3 w-20 bg-gray-100 rounded" />
          </div>
        ) : error ? (
          <div className="px-3 py-5 text-center">
            <p className="text-[12px] text-cu-text-secondary">{error}</p>
            <button
              onClick={onRetry}
              className="mt-2 text-[11px] font-semibold text-cu-primary hover:text-cu-primary-dark"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            {displayItems.length > 0 ? (
              <div className="mb-1">
                {displayItems.map((item) => (
                  <InboxDropdownItem
                    key={`${item.chatType}-${item.projectId}-${item.roomId || item.username || 'team'}`}
                    item={item}
                    onClick={() => openActivity(item)}
                  />
                ))}
              </div>
            ) : (
              <div className="px-3 py-6 text-center">
                <div className="text-[12px] text-cu-text-muted font-medium">No recent messages</div>
                <div className="text-[10px] text-cu-text-muted mt-0.5">Start a conversation in your project chat</div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="border-t border-cu-border-light px-3 py-2 bg-cu-bg-tertiary">
        <Link
          href="/inbox"
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
