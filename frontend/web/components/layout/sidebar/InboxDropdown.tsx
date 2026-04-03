'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { UserIcon, MessageSquareIcon, SearchIcon } from './SidebarIcons';

/* ── Types ── */
interface ChatRoomSummary {
  roomId: number;
  roomName?: string;
  lastMessage?: string;
  lastMessageSender?: string;
  unseenCount?: number;
}

interface DirectMessageSummary {
  username: string;
  lastMessage?: string;
  lastMessageSender?: string;
  unseenCount?: number;
}

interface ChatSummaries {
  rooms: ChatRoomSummary[];
  directMessages: DirectMessageSummary[];
}

/* ── Inbox Dropdown Item ── */
function InboxDropdownItem({
  item, icon, label, onClick
}: {
  item: ChatRoomSummary | DirectMessageSummary;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <div
      className="group flex items-start gap-2.5 px-3 py-2 hover:bg-cu-hover transition-colors cursor-pointer"
      onClick={onClick}
    >
      <div className="w-8 h-8 rounded-full bg-cu-primary/10 flex items-center justify-center text-cu-primary flex-shrink-0 mt-0.5">
        {icon}
      </div>
      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span className="text-[12px] font-semibold text-cu-text-primary truncate">{label}</span>
          {(item.unseenCount ?? 0) > 0 && (
            <div className="w-1.5 h-1.5 rounded-full bg-cu-success flex-shrink-0" />
          )}
        </div>
        <div className="text-[10.5px] text-cu-text-secondary truncate leading-normal">
          {item.lastMessageSender && <span className="font-medium mr-1 text-cu-text-primary">{item.lastMessageSender}:</span>}
          {item.lastMessage || 'No messages yet'}
        </div>
      </div>
    </div>
  );
}

/* ── Inbox Dropdown ── */
export function InboxDropdown({
  fixedTop, fixedLeft, summaries, loading, search, onSearch, onClose
}: {
  fixedTop: number;
  fixedLeft: number;
  summaries: ChatSummaries | null;
  loading: boolean;
  search: string;
  onSearch: (v: string) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const pid = typeof window !== 'undefined' ? localStorage.getItem('currentProjectId') : null;

  const filteredRooms = (summaries?.rooms || []).filter((r: ChatRoomSummary) =>
    (r.roomName || '').toLowerCase().includes(search.toLowerCase())
  ).slice(0, 3);

  const filteredDirects = (summaries?.directMessages || []).filter((d: DirectMessageSummary) =>
    d.username.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 3);

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
      {/* Search bar */}
      <div className="px-3 pt-3 pb-2 border-b border-cu-border-light">
        <div className="relative">
          <div className="absolute inset-y-0 left-2.5 flex items-center pointer-events-none">
            <SearchIcon />
          </div>
          <input
            type="text"
            value={search}
            onChange={e => onSearch(e.target.value)}
            placeholder="Search messages…"
            autoFocus
            className="w-full pl-7 pr-3 py-1.5 text-[12px] bg-cu-bg-tertiary border border-cu-border rounded-lg placeholder-cu-text-muted text-cu-text-primary focus:outline-none focus:ring-1 focus:ring-cu-primary/30 focus:border-cu-primary/40 transition-all"
          />
        </div>
      </div>

      {/* Content list */}
      <div className="overflow-y-auto flex-1 py-1 custom-scrollbar">
        {loading && !summaries ? (
          <div className="px-3 py-3 flex flex-col gap-3 animate-pulse">
            <div className="h-3 w-32 bg-gray-100 rounded" />
            <div className="h-3 w-24 bg-gray-100 rounded" />
            <div className="h-3 w-28 bg-gray-100 rounded" />
          </div>
        ) : (
          <>
            {filteredDirects.length > 0 && (
              <div className="mb-2">
                <div className="px-3 pt-2 pb-1 text-[10px] font-bold text-cu-text-muted uppercase tracking-wider">Direct Messages</div>
                {filteredDirects.map((dm: DirectMessageSummary) => (
                  <InboxDropdownItem
                    key={`dm-${dm.username}`}
                    item={dm}
                    icon={<UserIcon size={14} />}
                    label={dm.username}
                    onClick={() => {
                      router.push(`/projects/${pid}/chat?with=${dm.username}`);
                      onClose();
                    }}
                  />
                ))}
              </div>
            )}
            {filteredRooms.length > 0 && (
              <div>
                <div className="px-3 pt-1 pb-1 text-[10px] font-bold text-cu-text-muted uppercase tracking-wider">Group Chats</div>
                {filteredRooms.map((room: ChatRoomSummary) => (
                  <InboxDropdownItem
                    key={`room-${room.roomId}`}
                    item={room}
                    icon={<MessageSquareIcon size={14} />}
                    label={room.roomName || 'General'}
                    onClick={() => {
                      router.push(`/projects/${pid}/chat?roomId=${room.roomId}`);
                      onClose();
                    }}
                  />
                ))}
              </div>
            )}
            {filteredRooms.length === 0 && filteredDirects.length === 0 && (
              <div className="px-3 py-6 text-center">
                <div className="text-[12px] text-cu-text-muted font-medium">No recent messages</div>
                <div className="text-[10px] text-cu-text-muted mt-0.5">Start a conversation in your project chat</div>
              </div>
            )}
          </>
        )}
      </div>

      {/* View all footer */}
      <div className="border-t border-cu-border-light px-3 py-2 bg-cu-bg-tertiary">
        <Link
          href={`/projects/${pid}/chat`}
          onClick={onClose}
          className="flex items-center justify-between w-full text-[12px] font-medium text-cu-primary hover:text-cu-primary-dark transition-colors"
        >
          <span>Go to project chat</span>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M3 6h6M7 4l2 2-2 2" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
