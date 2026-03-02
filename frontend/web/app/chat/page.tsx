'use client';

import React, { useState } from 'react';
import { useChat } from './components/useChat';
import { ChatSidebar } from './components/chatSidebar';
import { ChatMessages } from './components/chatMessage';
import { ChatInput } from './components/chatInput';

export default function ChatInterface() {
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const { currentUser, users, messages, privateMessages, sendMessage, loadPrivateHistory, isLoading, error, retryConnection } = useChat();

  const displayMessages = selectedUser ? privateMessages[selectedUser] || [] : messages;

  // when user switches to a private chat, load history if we haven't
  React.useEffect(() => {
    if (selectedUser) {
      loadPrivateHistory(selectedUser);
    }
  }, [selectedUser, loadPrivateHistory]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <p className="text-slate-600">Loading chat...</p>
      </div>
    );
  }

  const handleSendMessage = (content: string) => {
    sendMessage(content, selectedUser);
  };

  return (
    <div className="flex h-screen w-full bg-slate-50">
      <ChatSidebar
        currentUser={currentUser}
        users={users}
        selectedUser={selectedUser}
        onSelectUser={setSelectedUser}
        lastPrivateMessages={privateMessages}
      />

      <div className="flex-1 flex flex-col bg-white min-w-0">
        {/* Header */}
        <div className="p-4 lg:p-6 border-b border-slate-200 flex items-center justify-between bg-white/50 backdrop-blur-sm">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              {selectedUser ? `Chat with ${selectedUser}` : 'Team Chat'}
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              {selectedUser ? 'Private message' : 'All team members'}
            </p>
          </div>
        </div>

        {/* Messages */}
        <ChatMessages messages={displayMessages} currentUser={currentUser} />

        {/* Input Area */}
        <div className="p-4 lg:p-6 bg-white border-t border-slate-200">
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
          <ChatInput onSendMessage={handleSendMessage} disabled={isLoading || !!error} />
        </div>
      </div>
    </div>
  );
}


