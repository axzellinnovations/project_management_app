import React from 'react';
import { ChatMessage } from './chat';
import styles from '../chat.module.css';

interface ChatSidebarProps {
  currentUser: string;
  users: string[];
  selectedUser: string | null;
  onSelectUser: (user: string | null) => void;
  lastPrivateMessages: Record<string, ChatMessage[]>;
  onAddTeam: (teamName: string) => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
}

export const ChatSidebar = ({ users, selectedUser, onSelectUser, currentUser, lastPrivateMessages, onAddTeam, searchTerm, onSearchChange }: ChatSidebarProps) => {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarHeader}>
        <h2 className="text-lg font-semibold text-slate-900">Chats</h2>
        <button
          onClick={() => {
            const teamName = prompt('Enter new team name');
            if (teamName) onAddTeam(teamName.trim());
          }}
          className="h-8 w-8 rounded-full bg-blue-600 text-white text-sm font-bold leading-[1.9] hover:bg-blue-700 transition-colors"
          aria-label="Add new team"
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