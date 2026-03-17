'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useChat } from './components/useChat';
import { ChatSidebar } from './components/chatSidebar';
import { ChatMessages } from './components/chatMessage';
import { ChatInput } from './components/chatInput';
import { ThreadPanel } from './components/threadPanel';
import styles from './chat.module.css';

export default function ChatInterface() {
  const params = useParams();
  const projectId = params.id as string;
  const [searchTerm, setSearchTerm] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const {
    currentUser,
    currentUserAliases,
    users,
    rooms,
    roomMessages,
    messages,
    privateMessages,
    selectedUser,
    selectedRoomId,
    privateUnseenCounts,
    roomUnseenCounts,
    privateLastMessages,
    roomLastMessages,
    teamUnseenCount,
    teamLastMessage,
    onlineUsers,
    teamTypingUsers,
    roomTypingUsers,
    privateTypingUsers,
    featureFlags,
    searchResults,
    isSearchLoading,
    commandNotice,
    messageReactions,
    activeThreadRoot,
    threadMessages,
    selectPrivateUser,
    selectRoom,
    sendMessage,
    sendRoomMessage,
    sendThreadReply,
    openThread,
    closeThread,
    editMessage,
    deleteMessage,
    toggleReaction,
    loadPrivateHistory,
    loadRoomHistory,
    createRoom,
    deleteRoom,
    updateRoomMeta,
    pinRoomMessage,
    sendTyping,
    searchMessages,
    trackTelemetry,
    addTeam,
    isLoading,
    error,
    retryConnection
  } = useChat(projectId);

  const hasSelectedRoom = selectedRoomId !== null && Number.isFinite(selectedRoomId);
  const selectedRoom = hasSelectedRoom ? rooms.find(r => r.id === selectedRoomId) : null;

  const displayMessages = hasSelectedRoom
    ? roomMessages[selectedRoomId as number] || []
    : selectedUser
    ? privateMessages[selectedUser] || []
    : messages;

  const filteredUsers = users.filter((u) => u !== currentUser && u.toLowerCase().includes(searchTerm.trim().toLowerCase()));
  const mentionCandidates = users.filter((u) => u !== currentUser);
  const filteredMessages = displayMessages.filter((msg) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.trim().toLowerCase();
    return (
      msg.sender.toLowerCase().includes(term) ||
      (msg.content && msg.content.toLowerCase().includes(term))
    );
  });

  const executeSearch = async () => {
    await searchMessages(searchQuery);
  };

  const jumpToSearchResult = async (result: { context: string; roomId?: number | null; sender?: string; recipient?: string | null }) => {
    const aliases = new Set(currentUserAliases.map(alias => alias.toLowerCase()));
    aliases.add(currentUser.toLowerCase());

    if (result.context === 'ROOM' && result.roomId) {
      selectRoom(result.roomId);
      await loadRoomHistory(result.roomId);
      trackTelemetry('chat_search_result_opened', 'room', `roomId=${result.roomId}`);
      return;
    }

    if (result.context === 'PRIVATE') {
      const sender = (result.sender || '').toLowerCase();
      const recipient = (result.recipient || '').toLowerCase();
      const partner = aliases.has(sender) ? recipient : sender;
      if (partner) {
        selectPrivateUser(partner);
        await loadPrivateHistory(partner);
        trackTelemetry('chat_search_result_opened', 'private', `partner=${partner}`);
      }
      return;
    }

    selectRoom(null);
    selectPrivateUser(null);
    trackTelemetry('chat_search_result_opened', 'team');
  };

  const roomTyping = hasSelectedRoom && selectedRoomId !== null ? (roomTypingUsers[selectedRoomId] || []) : [];
  const privateTyping = selectedUser ? privateTypingUsers.filter(user => user === selectedUser.toLowerCase()) : [];
  const activeTypingLabel = hasSelectedRoom
    ? (roomTyping.length > 0 ? `${roomTyping[0]} is typing...` : '')
    : selectedUser
    ? (privateTyping.length > 0 ? `${privateTyping[0]} is typing...` : '')
    : (teamTypingUsers.length > 0 ? `${teamTypingUsers[0]} is typing...` : '');

  useEffect(() => {
    if (selectedUser) {
      loadPrivateHistory(selectedUser);
    }
  }, [selectedUser, loadPrivateHistory]);

  useEffect(() => {
    if (featureFlags.phaseEEnabled && featureFlags.telemetryEnabled) {
      trackTelemetry('chat_screen_opened', 'chat', `project=${projectId}`);
    }
  }, [featureFlags.phaseEEnabled, featureFlags.telemetryEnabled, projectId, trackTelemetry]);

  useEffect(() => {
    if (hasSelectedRoom) {
      loadRoomHistory(selectedRoomId as number);
    }
  }, [selectedRoomId, hasSelectedRoom, loadRoomHistory]);

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
    if (hasSelectedRoom) {
      sendRoomMessage(content, selectedRoomId as number);
    } else {
      sendMessage(content, selectedUser);
    }
  };

  const handleCreateRoom = async () => {
    const createdRoom = await createRoom();
    if (!createdRoom) {
      return;
    }

    selectRoom(createdRoom.id);
    await loadRoomHistory(createdRoom.id);
  };

  return (
    <div className={styles.main}>
      <div className={styles.container}>
        <ChatSidebar
          currentUser={currentUser}
          currentUserAliases={currentUserAliases}
          users={filteredUsers}
          rooms={rooms}
          selectedUser={selectedUser}
          selectedRoomId={selectedRoomId}
          onSelectUser={selectPrivateUser}
          onSelectRoom={selectRoom}
          privateUnseenCounts={privateUnseenCounts}
          roomUnseenCounts={roomUnseenCounts}
          privateLastMessages={privateLastMessages}
          roomLastMessages={roomLastMessages}
          teamUnseenCount={teamUnseenCount}
          teamLastMessage={teamLastMessage}
          teamTypingUsers={teamTypingUsers}
          roomTypingUsers={roomTypingUsers}
          privateTypingUsers={privateTypingUsers}
          onCreateRoom={handleCreateRoom}
          onDeleteRoom={deleteRoom}
          onUpdateRoomMeta={updateRoomMeta}
          onAddTeam={addTeam}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
        />

        <div className={styles.chatArea}>
          <div className={styles.chatHeader}>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                {hasSelectedRoom
                  ? `Group: ${selectedRoom?.name ?? 'Group Chat'}`
                  : selectedUser
                  ? `Chat with ${selectedUser}`
                  : 'Team Chat'}
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                {hasSelectedRoom
                  ? selectedRoom?.topic || 'Group message'
                  : selectedUser
                  ? 'Private message'
                  : onlineUsers.length > 0
                  ? `Members online: ${onlineUsers.join(', ')}`
                  : 'No team member online'}
              </p>
            </div>
          </div>

          {featureFlags.phaseDEnabled && (
            <div className="px-3 pt-2 pb-1 border-b border-slate-200 bg-slate-50">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && executeSearch()}
                  placeholder="Search all chat messages..."
                  className="flex-1 px-3 py-2 rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={executeSearch}
                  className="px-3 py-2 rounded-md bg-slate-900 text-white text-sm hover:bg-slate-800"
                  disabled={isSearchLoading}
                >
                  {isSearchLoading ? 'Searching...' : 'Search'}
                </button>
              </div>
              {searchResults.length > 0 && (
                <div className="mt-2 max-h-40 overflow-auto rounded-md border border-slate-200 bg-white">
                  {searchResults.slice(0, 10).map(result => (
                    <button
                      key={result.messageId}
                      onClick={() => jumpToSearchResult(result)}
                      className="w-full text-left px-3 py-2 border-b border-slate-100 last:border-b-0 hover:bg-slate-50"
                    >
                      <p className="text-xs text-slate-500">{result.context} • {result.sender}</p>
                      <p className="text-sm text-slate-800 truncate">{result.content}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

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

          {!error && commandNotice && (
            <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-blue-700 text-sm font-medium">{commandNotice}</p>
            </div>
          )}

          <ChatMessages
            projectId={projectId}
            messages={filteredMessages}
            currentUser={currentUser}
            currentUserAliases={currentUserAliases}
            activeRoomId={selectedRoomId}
            pinnedMessageId={selectedRoom?.pinnedMessageId ?? null}
            reactionsByMessageId={messageReactions}
            onOpenThread={openThread}
            onEditMessage={editMessage}
            onDeleteMessage={deleteMessage}
            onToggleReaction={toggleReaction}
            onPinRoomMessage={selectedRoomId ? (messageId) => pinRoomMessage(selectedRoomId, messageId) : undefined}
          />
          {activeTypingLabel && (
            <div className="px-3 pt-2 pb-1">
              <p className="text-xs text-green-600">{activeTypingLabel}</p>
            </div>
          )}
          <ChatInput
            onSendMessage={handleSendMessage}
            onTypingChange={sendTyping}
            disabled={isLoading || !!error}
            placeholder='Type a message...'
            enableMentions={!selectedUser}
            mentionCandidates={mentionCandidates}
          />
        </div>

        {activeThreadRoot && (
          <ThreadPanel
            rootMessage={activeThreadRoot}
            threadMessages={threadMessages}
            reactionsByMessageId={messageReactions}
            onClose={closeThread}
            onSendReply={sendThreadReply}
            onToggleReaction={toggleReaction}
          />
        )}
      </div>
    </div>
  );
}


