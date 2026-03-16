import React from 'react';
import { ChatMessage, ChatRoom } from './chat';
import styles from '../chat.module.css';

interface ChatSidebarProps {
  currentUser: string;
  users: string[];
  rooms: ChatRoom[];
  selectedUser: string | null;
  selectedRoomId: number | null;
  onSelectUser: (user: string | null) => void;
  onSelectRoom: (roomId: number | null) => void;
  privateUnseenCounts: Record<string, number>;
  roomUnseenCounts: Record<number, number>;
  privateLastMessages: Record<string, ChatMessage | null>;
  roomLastMessages: Record<number, ChatMessage | null>;
  onCreateRoom: () => void;
  onDeleteRoom: (roomId: number) => void;
  onAddTeam: (teamName: string) => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
}

export const ChatSidebar = ({
  users,
  rooms,
  selectedUser,
  selectedRoomId,
  onSelectUser,
  onSelectRoom,
  currentUser,
  privateUnseenCounts,
  roomUnseenCounts,
  privateLastMessages,
  roomLastMessages,
  onCreateRoom,
  onDeleteRoom,
  onAddTeam,
  searchTerm,
  onSearchChange
}: ChatSidebarProps) => {
  const hasSelectedRoom = selectedRoomId !== null && Number.isFinite(selectedRoomId);

  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarHeader}>
        <h2 className="text-lg font-semibold text-slate-900">Chats</h2>
        <button
          onClick={onCreateRoom}
          className="h-8 w-8 rounded-full bg-blue-600 text-white text-sm font-bold leading-[1.9] hover:bg-blue-700 transition-colors"
          aria-label="Create new group"
        >
          +
        </button>
      </div>

      <div className="px-3 py-2">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search users or messages"
          className="w-full px-3 py-2 rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className={styles.userList}>
        {/* Team Chat Button */}
        <button
          onClick={() => { onSelectUser(null); onSelectRoom(null); }}
          className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
            !selectedUser && !hasSelectedRoom ? 'bg-blue-600 text-white' : 'bg-slate-50 hover:bg-slate-100 text-slate-900'
          }`}
        >
          Team Chat
        </button>

        <p className="text-xs font-semibold text-slate-500 uppercase px-3 pt-4 pb-2">Group Chats</p>
        {rooms.length === 0 && <p className="text-xs text-slate-400 px-3">No group chats yet</p>}
        {rooms.map(room => (
          <div key={room.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
            <button
              onClick={() => {
                onSelectRoom(room.id);
              }}
              className={`flex-1 text-left rounded-lg px-2 py-2 transition-colors ${
                hasSelectedRoom && selectedRoomId === room.id ? 'bg-blue-50 border-blue-200' : 'hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-900 truncate">{room.name}</p>
                {(roomUnseenCounts[room.id] || 0) > 0 && (
                  <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-blue-600 text-white text-[11px] font-semibold flex items-center justify-center">
                    {roomUnseenCounts[room.id] > 99 ? '99+' : roomUnseenCounts[room.id]}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 truncate">
                {roomLastMessages[room.id]?.content || `Created by ${room.createdBy}`}
              </p>
            </button>
            <button
              onClick={() => onDeleteRoom(room.id)}
              className="text-xs px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Delete
            </button>
          </div>
        ))}

        <p className="text-xs font-semibold text-slate-500 uppercase px-3 pt-4 pb-2">Direct Messages</p>

        {users.length === 0 && <p className="text-xs text-slate-400 px-3">No active users</p>}

        {users.map(user => {
      const lastMsg = privateLastMessages[user]?.content;
      const unseen = privateUnseenCounts[user] || 0;
            return (
            <button
                key={user}
                onClick={() => onSelectUser(user)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${
                selectedUser === user ? 'bg-blue-50 border-blue-200' : 'hover:bg-slate-100'
                }`}
            >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-bold">
                {user.charAt(0).toUpperCase()}
                </div>
                <div className="overflow-hidden flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-900 truncate">{user}</p>
                  {unseen > 0 && (
                    <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-green-600 text-white text-[11px] font-semibold flex items-center justify-center">
                      {unseen > 99 ? '99+' : unseen}
                    </span>
                  )}
                </div>
                {lastMsg && <p className="text-xs text-slate-500 truncate">{lastMsg}</p>}
                </div>
            </button>
            );
        })}
      </div>
    </aside>
  );
};