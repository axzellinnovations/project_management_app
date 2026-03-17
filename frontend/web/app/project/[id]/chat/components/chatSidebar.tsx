import React from 'react';
import { ChatMessage, ChatRoom } from './chat';
import { isFileDocument } from './chatMessage';
import styles from '../chat.module.css';

interface ChatSidebarProps {
  currentUser: string;
  currentUserAliases: string[];
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
  teamUnseenCount: number;
  teamLastMessage: ChatMessage | null;
  teamTypingUsers: string[];
  roomTypingUsers: Record<number, string[]>;
  privateTypingUsers: string[];
  onCreateRoom: () => void;
  onDeleteRoom: (roomId: number) => void;
  onUpdateRoomMeta: (roomId: number, updates: { name?: string; topic?: string; description?: string }) => void;
  onAddTeam: (teamName: string) => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
}

export const ChatSidebar = ({
  currentUser,
  currentUserAliases,
  users,
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
  onAddTeam,
  searchTerm,
  onSearchChange
}: ChatSidebarProps) => {
  const hasSelectedRoom = selectedRoomId !== null && Number.isFinite(selectedRoomId);
  const currentUserIdentitySet = new Set([currentUser.toLowerCase(), ...currentUserAliases.map(alias => alias.toLowerCase())]);
  const isTeamSelected = !selectedUser && !hasSelectedRoom;

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
          <div className="flex items-center justify-between gap-2">
            <span className="truncate">Team Chat</span>
            {teamUnseenCount > 0 && (
              <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-green-600 text-white text-[11px] font-semibold flex items-center justify-center">
                {teamUnseenCount > 99 ? '99+' : teamUnseenCount}
              </span>
            )}
          </div>
          {teamTypingUsers.length > 0 && !isTeamSelected ? (
            <p className="text-xs truncate text-green-600 mt-1">
              {teamTypingUsers[0]} is typing...
            </p>
          ) : teamLastMessage?.content && (
            <p className="text-xs truncate opacity-80 mt-1">
              {isFileDocument(teamLastMessage.content) ? '📄 File' : teamLastMessage.content}
            </p>
          )}
        </button>

        <p className="text-xs font-semibold text-slate-500 uppercase px-3 pt-4 pb-2">Group Chats</p>
        {rooms.length === 0 && <p className="text-xs text-slate-400 px-3">No group chats yet</p>}
        {rooms.map(room => {
          const isCreator = !!room.createdBy && currentUserIdentitySet.has(room.createdBy.toLowerCase());
          const isRoomSelected = hasSelectedRoom && selectedRoomId === room.id;
          const roomTypers = roomTypingUsers[room.id] || [];
          const showRoomTypingInSidebar = roomTypers.length > 0 && !isRoomSelected;

          return (
            <div key={room.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
              <button
                onClick={() => {
                  onSelectRoom(room.id);
                }}
                className={`flex-1 text-left rounded-lg px-2 py-2 transition-colors ${
                  isRoomSelected ? 'bg-blue-50 border-blue-200' : 'hover:bg-slate-100'
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
                  {showRoomTypingInSidebar
                    ? `${roomTypers[0]} is typing...`
                    : room.topic || (roomLastMessages[room.id]?.content ? (isFileDocument(roomLastMessages[room.id]!.content) ? '📄 File' : roomLastMessages[room.id]!.content) : null) || `Created by ${room.createdBy}`}
                </p>
              </button>
              {isCreator && (
                <>
                  <button
                    onClick={() => {
                      const nextName = window.prompt('Channel name', room.name);
                      if (nextName === null) {
                        return;
                      }
                      const nextTopic = window.prompt('Channel topic (optional)', room.topic || '');
                      if (nextTopic === null) {
                        return;
                      }
                      const nextDescription = window.prompt('Channel description (optional)', room.description || '');
                      if (nextDescription === null) {
                        return;
                      }
                      onUpdateRoomMeta(room.id, {
                        name: nextName.trim() || room.name,
                        topic: nextTopic,
                        description: nextDescription
                      });
                    }}
                    className="text-xs px-2 py-1 bg-slate-500 text-white rounded hover:bg-slate-600"
                  >
                    Manage
                  </button>
                  <button
                    onClick={() => onDeleteRoom(room.id)}
                    className="text-xs px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          );
        })}

        <p className="text-xs font-semibold text-slate-500 uppercase px-3 pt-4 pb-2">Direct Messages</p>

        {users.length === 0 && <p className="text-xs text-slate-400 px-3">No active users</p>}

        {users.map(user => {
      const lastMsg = privateLastMessages[user]?.content;
      const unseen = privateUnseenCounts[user] || 0;
      const isTyping = privateTypingUsers.includes(user.toLowerCase());
      const isSelectedDm = selectedUser === user;
      const showTypingInSidebar = isTyping && !isSelectedDm;
            return (
            <button
                key={user}
                onClick={() => onSelectUser(user)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${
                isSelectedDm ? 'bg-blue-50 border-blue-200' : 'hover:bg-slate-100'
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
                {showTypingInSidebar
                  ? <p className="text-xs text-green-600 truncate">typing...</p>
                  : lastMsg && <p className="text-xs text-slate-500 truncate">{isFileDocument(lastMsg) ? '📄 File' : lastMsg}</p>}
                </div>
            </button>
            );
        })}
      </div>
    </aside>
  );
};