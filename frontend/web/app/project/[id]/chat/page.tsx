'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { useChat } from './components/useChat';
import { ChatSidebar } from './components/chatSidebar';
import { ChatMessages } from './components/chatMessage';
import { ChatInput } from './components/chatInput';
import styles from './chat.module.css';

export default function ChatInterface() {
  const params = useParams();
  const projectId = params.id as string;
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { currentUser, users, messages, privateMessages, sendMessage, loadPrivateHistory, addTeam, isLoading, error, retryConnection } = useChat(projectId);

  const displayMessages = selectedUser ? privateMessages[selectedUser] || [] : messages;
  const filteredUsers = users.filter((u) => u.toLowerCase().includes(searchTerm.trim().toLowerCase()));
  const filteredMessages = displayMessages.filter((msg) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.trim().toLowerCase();
    return (
      msg.sender.toLowerCase().includes(term) ||
      (msg.content && msg.content.toLowerCase().includes(term))
    );
  });

  React.useEffect(() => {
    if (selectedUser) {
      loadPrivateHistory(selectedUser);
    }
  }, [selectedUser, loadPrivateHistory]);

  if (isLoading) {
    return (
      <div className={styles.main}>
        <div className={styles.container}>
          <p className="text-slate-600">Loading chat...</p>
        </div>
      </div>
    );
  }

  const handleSendMessage = (content: string) => {
    sendMessage(content, selectedUser);
  };

  return (
    <div className={styles.main}>
      <div className={styles.container}>
        <ChatSidebar
          currentUser={currentUser}
          users={filteredUsers}
          selectedUser={selectedUser}
          onSelectUser={setSelectedUser}
          lastPrivateMessages={privateMessages}
          onAddTeam={addTeam}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
        />

        <div className={styles.chatArea}>
          <div className={styles.chatHeader}>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                {selectedUser ? `Chat with ${selectedUser}` : 'Team Chat'}
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                {selectedUser
                  ? 'Private message'
                  : users.length > 0
                  ? `Members online: ${users.join(', ')}`
                  : 'No team member online'}
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-3 p-4 bg-red-50 rounded-lg border border-red-200">
              <p className="text-red-700 text-sm font-medium">{error}</p>
              <p className="text-red-600 text-xs mt-1">
                Ensure backend is running at: <code className="bg-red-100 px-2 py-1 rounded">http://localhost:8080</code>
              </p>
              <button
                onClick={retryConnection}
                className="mt-2 text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded transition-colors"
              >
                Retry Connection
              </button>
            </div>
          )}

          <ChatMessages messages={filteredMessages} currentUser={currentUser} />
          <ChatInput onSendMessage={handleSendMessage} disabled={isLoading || !!error} />
        </div>
      </div>
    </div>
  );
}


