'use client';

import React, { useState } from 'react';
import { Search, Plus, Hash, MessageCircle, Users, X, Check } from 'lucide-react';
import { ChatMessage, ChatRoom } from './chat';
import { isFileDocument } from './chatMessage';
import { CreateChannelModal, EditChannelModal, ConfirmDeleteModal } from './chatModals';

interface ChatSidebarProps {
  currentUser: string;
  currentUserAliases: string[];
  users: string[];
  userProfilePics?: Record<string, string>;
  rooms: ChatRoom[];
  selectedUser: string | null;
  selectedRoomId: number | null;
  onSelectUser: (user: string | null) => void;
  onSelectRoom: (roomId: number | null) => void;
  privateUnseenCounts: Record<string, number>;
  roomUnseenCounts: Record<number, number>;
  privateLastMessages: Record<string, ChatMessage | null>;
  roomLastMessages: Record<number, ChatMessage | null>;
  teamUnseenCount: number;
  teamLastMessage: ChatMessage | null;
  teamTypingUsers: string[];
  roomTypingUsers: Record<number, string[]>;
  privateTypingUsers: string[];
  onCreateRoom: (name: string, members: string[]) => void;
  onDeleteRoom: (roomId: number) => void;
  onUpdateRoomMeta: (roomId: number, updates: { name?: string; topic?: string; description?: string }) => void;
  onAddTeam: (teamName: string) => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  isLoading?: boolean;
  roomMentionCounts?: Record<number, number>;
  teamMentionCount?: number;
}

const AVATAR_COLORS = [
  'from-violet-500 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-rose-500 to-pink-600',
  'from-blue-500 to-indigo-600',
  'from-orange-500 to-red-600',
  'from-purple-500 to-violet-700',
  'from-cyan-500 to-blue-600',
  'from-amber-500 to-orange-600',
];

const avatarColor = (name: string) =>
  AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];

function formatTime(timestamp?: string | null): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  if (diff < 60000) return 'now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function UnreadBadge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span className="ml-auto flex-shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-blue-500 text-white text-xs font-semibold flex items-center justify-center leading-none">
      {count > 99 ? '99+' : count}
    </span>
  );
}

function MentionBadge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span
      className="flex-shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-amber-400 text-white text-xs font-bold flex items-center justify-center leading-none gap-0.5"
      title={`${count} mention${count !== 1 ? 's' : ''}`}
    >
      🔔{count > 9 ? '9+' : count}
    </span>
  );
}

function SidebarSkeleton() {
  return (
    <div className="px-3 space-y-2 mt-2">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl">
          <div className="w-9 h-9 rounded-full bg-gray-100 animate-pulse flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className={`h-3 bg-gray-100 rounded animate-pulse ${i % 2 === 0 ? 'w-3/4' : 'w-1/2'}`} />
            <div className="h-2.5 bg-gray-100 rounded animate-pulse w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export const ChatSidebar = ({
  currentUser,
  currentUserAliases,
  users,
  userProfilePics = {},
  rooms,
  selectedUser,
  selectedRoomId,
  onSelectUser,
  onSelectRoom,
  privateUnseenCounts,
  roomUnseenCounts,
  privateLastMessages,
  roomLastMessages,
  teamUnseenCount,
  teamLastMessage,
  teamTypingUsers,
  roomTypingUsers,
  privateTypingUsers,
  onCreateRoom,
  onDeleteRoom,
  onUpdateRoomMeta,
  searchTerm,
  onSearchChange,
  isLoading,
  roomMentionCounts = {},
  teamMentionCount = 0,
}: ChatSidebarProps) => {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editRoomData, setEditRoomData] = useState<ChatRoom | null>(null);
  const [roomToDelete, setRoomToDelete] = useState<number | null>(null);

  const hasSelectedRoom = selectedRoomId !== null && Number.isFinite(selectedRoomId);
  const currentUserIdentitySet = new Set([
    currentUser.toLowerCase(),
    ...currentUserAliases.map((a) => a.toLowerCase()),
  ]);
  const isTeamSelected = !selectedUser && !hasSelectedRoom;

  const getMessagePreview = (content?: string | null): string => {
    if (!content) return '';
    if (isFileDocument(content)) return '📎 File attachment';
    return content.length > 40 ? content.slice(0, 40) + '…' : content;
  };

  return (
    <aside className="w-72 h-full bg-white border-r border-gray-100/80 flex flex-col flex-shrink-0 overflow-hidden">

      {/* Header */}
      <div className="px-4 pt-5 pb-3 flex items-center justify-between border-b border-gray-100/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
            <MessageCircle size={15} className="text-white" strokeWidth={2.5} />
          </div>
          <span className="font-semibold text-[15px] text-gray-900 tracking-tight">Messages</span>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Create channel"
          title="New channel"
        >
          <Plus size={16} strokeWidth={2.5} />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 transition-all focus-within:bg-white focus-within:border-blue-200 focus-within:ring-2 focus-within:ring-blue-50">
          <Search size={14} className="text-gray-400 flex-shrink-0" strokeWidth={2.5} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search…"
            className="flex-1 bg-transparent text-sm text-gray-700 placeholder:text-gray-400 outline-none"
            aria-label="Search conversations"
          />
          {searchTerm && (
            <button onClick={() => onSearchChange('')} className="text-gray-300 hover:text-gray-500">
              <X size={13} strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin pb-4">
        {isLoading ? (
          <SidebarSkeleton />
        ) : (
          <>
            {/* ── Team Chat ── */}
            <div className="px-3 mt-1">
              <button
                onClick={() => { onSelectUser(null); onSelectRoom(null); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group
                  ${isTeamSelected
                    ? 'bg-blue-50 border border-blue-100'
                    : 'hover:bg-gray-50 border border-transparent'}`}
                aria-label="Open Team Chat"
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all
                  ${isTeamSelected ? 'bg-blue-500 shadow-sm shadow-blue-200' : 'bg-gray-100 group-hover:bg-gray-200'}`}>
                  <Users size={16} className={isTeamSelected ? 'text-white' : 'text-gray-500'} strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between gap-1">
                    <span className={`text-[13.5px] font-semibold truncate ${isTeamSelected ? 'text-blue-700' : 'text-gray-800'}`}>
                      Team Chat
                    </span>
                    {teamLastMessage?.timestamp && (
                      <span className="text-[10px] text-gray-400 flex-shrink-0">
                        {formatTime(teamLastMessage.timestamp)}
                      </span>
                    )}
                  </div>
                  {teamTypingUsers.length > 0 && !isTeamSelected ? (
                    <p className="text-[11.5px] text-blue-500 font-medium truncate">
                      {teamTypingUsers[0]} is typing…
                    </p>
                  ) : teamLastMessage?.content ? (
                    <p className="text-[11.5px] text-gray-400 truncate">
                      {getMessagePreview(teamLastMessage.content)}
                    </p>
                  ) : (
                    <p className="text-[11.5px] text-gray-400 italic">No messages yet</p>
                  )}
                </div>
                <UnreadBadge count={teamUnseenCount} />
                <MentionBadge count={teamMentionCount} />
              </button>
            </div>

            {/* ── Group Channels ── */}
            <div className="mt-4 px-3">
              <p className="text-[10.5px] font-bold text-gray-400 uppercase tracking-widest px-1 mb-1.5">
                Channels
              </p>

              {rooms.length === 0 && (
                <p className="text-[12px] text-gray-400 italic px-1 py-1.5">
                  No channels yet — create one!
                </p>
              )}

              <div className="space-y-0.5">
                {rooms.map((room) => {
                  const isCreator = !!room.createdBy && currentUserIdentitySet.has(room.createdBy.toLowerCase());
                  const isRoomSelected = hasSelectedRoom && selectedRoomId === room.id;
                  const roomTypers = roomTypingUsers[room.id] || [];
                  const showTyping = roomTypers.length > 0 && !isRoomSelected;
                  const lastMsg = roomLastMessages[room.id];
                  const unseen = roomUnseenCounts[room.id] || 0;

                  return (
                    <div key={room.id} className="flex items-center gap-1 group/room">
                      <button
                        onClick={() => onSelectRoom(room.id)}
                        className={`flex-1 flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all duration-150
                          ${isRoomSelected
                            ? 'bg-blue-50 border border-blue-100'
                            : 'hover:bg-gray-50 border border-transparent'}`}
                        aria-label={`Open #${room.name}`}
                      >
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors
                          ${isRoomSelected ? 'bg-blue-500' : 'bg-gray-100 group-hover/room:bg-gray-200'}`}>
                          <Hash size={13} className={isRoomSelected ? 'text-white' : 'text-gray-500'} strokeWidth={2.5} />
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <div className="flex items-center gap-1">
                            <span className={`text-[13px] font-medium truncate ${isRoomSelected ? 'text-blue-700 font-semibold' : 'text-gray-700'}`}>
                              {room.name}
                            </span>
                            {lastMsg?.timestamp && (
                              <span className="text-[10px] text-gray-400 flex-shrink-0 ml-auto">
                                {formatTime(lastMsg.timestamp)}
                              </span>
                            )}
                          </div>
                          {showTyping ? (
                            <p className="text-[11px] text-blue-500 font-medium truncate">{roomTypers[0]} is typing…</p>
                          ) : (
                            <p className="text-[11px] text-gray-400 truncate">
                              {room.topic || getMessagePreview(lastMsg?.content) || `Created by ${room.createdBy}`}
                            </p>
                          )}
                        </div>
                        <UnreadBadge count={unseen} />
                        <MentionBadge count={roomMentionCounts[room.id] || 0} />
                      </button>

                      {/* Room owner actions */}
                      {isCreator && (
                        <div className="opacity-0 group-hover/room:opacity-100 transition-opacity flex gap-0.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditRoomData(room);
                            }}
                            className="w-6 h-6 rounded-lg hover:bg-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-600 text-xs"
                            aria-label={`Edit ${room.name}`}
                            title="Edit channel"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => setRoomToDelete(room.id)}
                            className="w-6 h-6 rounded-lg hover:bg-red-50 flex items-center justify-center text-gray-400 hover:text-red-500 text-xs"
                            aria-label={`Delete ${room.name}`}
                            title="Delete channel"
                          >
                            🗑️
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Direct Messages ── */}
            <div className="mt-4 px-3">
              <p className="text-[10.5px] font-bold text-gray-400 uppercase tracking-widest px-1 mb-1.5">
                Direct Messages
              </p>

              {users.length === 0 && (
                <p className="text-[12px] text-gray-400 italic px-1 py-1.5">
                  No team members found
                </p>
              )}

              <div className="space-y-0.5">
                {users.map((user) => {
                  const lastMsg = privateLastMessages[user];
                  const unseen = privateUnseenCounts[user] || 0;
                  const isTyping = privateTypingUsers.includes(user.toLowerCase());
                  const isSelectedDm = selectedUser === user;
                  const showTyping = isTyping && !isSelectedDm;
                  const isSelf = currentUserIdentitySet.has(user.toLowerCase());

                  return (
                    <button
                      key={user}
                      onClick={() => onSelectUser(user)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150
                        ${isSelectedDm
                          ? 'bg-blue-50 border border-blue-100'
                          : 'hover:bg-gray-50 border border-transparent'}`}
                      aria-label={`Open DM with ${user}`}
                    >
                      {/* Avatar */}
                      {/* Avatar */}
                      <div className="relative flex-shrink-0">
                        {userProfilePics?.[user] ? (
                          <img src={userProfilePics[user]} alt={user} className="w-9 h-9 rounded-full object-cover shadow-sm" />
                        ) : (
                          <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${avatarColor(user)} flex items-center justify-center text-white font-semibold text-[13px]`}>
                            {user.charAt(0).toUpperCase()}
                          </div>
                        )}
                        {/* Online dot — always shows for simplicity; real implementation would check onlineUsers */}
                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white" />
                      </div>

                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center justify-between gap-1">
                          <span className={`text-[13.5px] font-medium truncate ${isSelectedDm ? 'text-blue-700 font-semibold' : 'text-gray-800'}`}>
                            {user}{isSelf ? ' (you)' : ''}
                          </span>
                          {lastMsg?.timestamp && (
                            <span className="text-[10px] text-gray-400 flex-shrink-0">
                              {formatTime(lastMsg.timestamp)}
                            </span>
                          )}
                        </div>
                        {showTyping ? (
                          <p className="text-[11.5px] text-blue-500 font-medium">typing…</p>
                        ) : lastMsg?.content ? (
                          <p className="text-[11.5px] text-gray-400 truncate">
                            {getMessagePreview(lastMsg.content)}
                          </p>
                        ) : (
                          <p className="text-[11.5px] text-gray-400 italic">Start a conversation</p>
                        )}
                      </div>
                      <UnreadBadge count={unseen} />
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      <CreateChannelModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        users={users}
        onCreate={onCreateRoom}
      />
      {editRoomData && (
        <EditChannelModal
          isOpen={!!editRoomData}
          onClose={() => setEditRoomData(null)}
          initialName={editRoomData.name}
          initialTopic={editRoomData.topic || ''}
          initialDescription={editRoomData.description || ''}
          onSave={(updates) => onUpdateRoomMeta(editRoomData.id, updates)}
        />
      )}
      <ConfirmDeleteModal
        isOpen={roomToDelete !== null}
        onClose={() => setRoomToDelete(null)}
        title="Delete Channel"
        message="Are you sure you want to delete this channel? This action cannot be undone."
        onConfirm={() => {
          if (roomToDelete !== null) onDeleteRoom(roomToDelete);
          setRoomToDelete(null);
        }}
      />
    </aside>
  );
};