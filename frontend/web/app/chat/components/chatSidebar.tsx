import React from 'react';
import { ChatMessage } from './chat';

interface ChatSidebarProps {
  currentUser: string;
  users: string[];
  selectedUser: string | null;
  onSelectUser: (user: string | null) => void;
  lastPrivateMessages: Record<string, ChatMessage[]>;
}

export const ChatSidebar = ({ users, selectedUser, onSelectUser, currentUser, lastPrivateMessages }: ChatSidebarProps) => {
  return (
    <aside className="w-72 bg-white border-r border-slate-200 flex flex-col h-full">
      <div className="p-4 border-b border-slate-200">
        <h2 className="text-lg font-semibold text-slate-900">Chats</h2>
        <p className="text-xs text-slate-500 mt-1">Logged in as {currentUser}</p>
      </div>

      <div className="p-3 space-y-1 overflow-y-auto flex-1">
        {/* Team Chat Button */}
        <button
          onClick={() => onSelectUser(null)}
          className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
            selectedUser === null ? 'bg-blue-600 text-white' : 'bg-slate-50 hover:bg-slate-100 text-slate-900'
          }`}
        >
          Team Chat
        </button>

        <p className="text-xs font-semibold text-slate-500 uppercase px-3 pt-4 pb-2">Direct Messages</p>
        
        {users.length === 0 && <p className="text-xs text-slate-400 px-3">No active users</p>}

        {users.map(user => {
            const lastMsg = lastPrivateMessages[user]?.slice(-1)[0]?.content;
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
                <div className="overflow-hidden">
                <p className="text-sm font-medium text-slate-900 truncate">{user}</p>
                {lastMsg && <p className="text-xs text-slate-500 truncate">{lastMsg}</p>}
                </div>
            </button>
            );
        })}
      </div>
    </aside>
  );
};