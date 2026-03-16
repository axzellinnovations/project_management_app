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
  const filteredMessages = displayMessages.filter((msg) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.trim().toLowerCase();
    return (
      msg.sender.toLowerCase().includes(term) ||
      (msg.content && msg.content.toLowerCase().includes(term))
    );
  });

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

          <ChatMessages
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
          <ChatInput onSendMessage={handleSendMessage} onTypingChange={sendTyping} disabled={isLoading || !!error} />
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


