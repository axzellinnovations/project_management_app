'use client';

import { ArrowLeft, Search, Users, X } from 'lucide-react';

interface ChatHeaderProps {
  selectedRoom: { name?: string | null; topic?: string | null } | null;
  selectedUser: string | null;
  userProfilePics: Record<string, string>;
  onlineUsers: string[];
  isConnected: boolean;
  phaseDEnabled: boolean;
  showSearch: boolean;
  onToggleSearch: () => void;
  onShowSidebar: () => void;
}

const AVATAR_COLORS = [
  'from-blue-500 to-blue-600',
  'from-emerald-500 to-teal-600',
  'from-sky-400 to-blue-500',
  'from-indigo-500 to-blue-600',
  'from-teal-400 to-emerald-500',
  'from-cyan-500 to-blue-600',
  'from-blue-400 to-indigo-500',
  'from-slate-400 to-slate-500',
];

function avatarColor(name: string): string {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

export function ChatHeader({
  selectedRoom,
  selectedUser,
  userProfilePics,
  onlineUsers,
  isConnected,
  phaseDEnabled,
  showSearch,
  onToggleSearch,
  onShowSidebar,
}: ChatHeaderProps) {
  const headerIcon = selectedRoom
    ? (
      <div className={`w-8 h-8 rounded-full flex-shrink-0 bg-gradient-to-br ${avatarColor(selectedRoom?.name || 'G')} flex items-center justify-center text-white text-[13px] font-bold shadow-sm ring-2 ring-white`}>
        {(selectedRoom?.name || 'G').charAt(0).toUpperCase()}
      </div>
    )
    : selectedUser && userProfilePics[selectedUser]
      // eslint-disable-next-line @next/next/no-img-element
      ? <img src={userProfilePics[selectedUser]} alt={selectedUser} className="w-8 h-8 rounded-full flex-shrink-0 object-cover shadow-sm ring-2 ring-white" />
      : selectedUser
        ? (
          <div className={`w-8 h-8 rounded-full flex-shrink-0 bg-gradient-to-br ${avatarColor(selectedUser)} flex items-center justify-center text-white text-[13px] font-bold shadow-sm ring-2 ring-white`}>
            {(selectedUser || '?').charAt(0).toUpperCase()}
          </div>
        )
        : (
          <div className="w-8 h-8 rounded-full flex-shrink-0 bg-blue-100 flex items-center justify-center text-blue-600 shadow-sm ring-2 ring-white">
            <Users size={16} strokeWidth={2.5} />
          </div>
        );

  const headerTitle = selectedRoom
    ? selectedRoom.name ?? 'Group Chat'
    : selectedUser ?? 'Team Chat';

  const headerSub = selectedRoom
    ? selectedRoom.topic || 'Group channel'
    : selectedUser
      ? 'Private message'
      : onlineUsers.length > 0
        ? `${onlineUsers.length} member${onlineUsers.length !== 1 ? 's' : ''} online`
        : 'Team workspace';

  return (
    <div className="h-14 sm:h-16 px-3 sm:px-5 flex items-center justify-between border-b border-gray-100 flex-shrink-0 sticky top-0 z-30 bg-white/95 supports-[backdrop-filter]:backdrop-blur backdrop-blur">
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        <button
          className="lg:hidden h-11 w-11 -ml-1 rounded-full hover:bg-gray-100 text-gray-600 flex items-center justify-center flex-shrink-0"
          onClick={onShowSidebar}
          aria-label="Back to conversations"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="w-10 h-10 sm:w-9 sm:h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
          {headerIcon}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-semibold text-gray-900 truncate">{headerTitle}</h2>
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors ${isConnected ? 'bg-emerald-400' : 'bg-amber-400'}`}
              title={isConnected ? 'Connected' : 'Disconnected'}
            />
          </div>
          <p className="text-[12px] text-gray-400 truncate">{headerSub}</p>
        </div>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        {onlineUsers.length > 0 && (
          <div className="hidden sm:flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-[11.5px] font-semibold rounded-xl px-3 py-1.5 border border-emerald-100">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            {onlineUsers.length} online
          </div>
        )}

        {phaseDEnabled && (
          <button
            onClick={onToggleSearch}
            className="w-11 h-11 sm:w-9 sm:h-9 rounded-xl hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
            title="Search messages"
            aria-label="Toggle message search"
          >
            {showSearch ? <X size={17} strokeWidth={2.5} /> : <Search size={17} strokeWidth={2.5} />}
          </button>
        )}
      </div>
    </div>
  );
}
