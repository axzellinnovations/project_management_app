'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useChat } from './components/useChat';
import { ChatSidebar } from './components/chatSidebar';
import { ChatMessages } from './components/chatMessage';
import { ChatInput } from './components/chatInput';
import { ThreadPanel } from './components/threadPanel';
import { ChatLoadingSkeleton } from './components/chatLoadingSkeleton';
import { ChatConnectionBanners } from './components/chatConnectionBanners';
import { ChatHeader } from './components/chatHeader';
import { ChatSearchPanel } from './components/chatSearchPanel';

export default function ChatInterface() {
  const params = useParams();
  const searchParams = useSearchParams();
  const projectId = params.id as string;
  const roomIdParam = searchParams.get('roomId');
  const withParam = searchParams.get('with');
  const viewParam = searchParams.get('view');
  const handledQueryRef = useRef<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const {
    currentUser,
    currentUserAliases,
    users,
    userProfilePics,
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
    commandNotice: _commandNotice,
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
    isSocketConnected,
    error,
    retryConnection,
    roomMentionCounts,
    teamMentionCount,
  } = useChat(projectId);

  const [showChatSidebar, setShowChatSidebar] = useState(true);

  const handleSelectUser = (u: string | null) => {
    selectPrivateUser(u);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) setShowChatSidebar(false);
  };

  const handleSelectRoom = (id: number | null) => {
    selectRoom(id);
    if (id !== null && typeof window !== 'undefined' && window.innerWidth < 1024) setShowChatSidebar(false);
  };

  const hasSelectedRoom = selectedRoomId !== null && Number.isFinite(selectedRoomId);
  const selectedRoom = hasSelectedRoom ? rooms.find((r) => r.id === selectedRoomId) ?? null : null;
  const isPrivateChat = !!selectedUser && !hasSelectedRoom;

  const displayMessages = hasSelectedRoom
    ? roomMessages[selectedRoomId as number] || []
    : selectedUser
    ? privateMessages[selectedUser] || []
    : messages;

  const filteredUsers = users.filter(
    (u) => u !== currentUser && u.toLowerCase().includes(searchTerm.trim().toLowerCase())
  );
  const mentionCandidates = users.filter((u) => u !== currentUser);

  const filteredMessages = displayMessages.filter((msg) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.trim().toLowerCase();
    return (
      msg.sender.toLowerCase().includes(term) ||
      (msg.content && msg.content.toLowerCase().includes(term))
    );
  });

  const executeSearch = async () => { await searchMessages(searchQuery); };

  const jumpToSearchResult = async (result: {
    context: string;
    roomId?: number | null;
    sender?: string;
    recipient?: string | null;
  }) => {
    const aliases = new Set(currentUserAliases.map((a) => a.toLowerCase()));
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
  const privateTyping = selectedUser
    ? privateTypingUsers.filter((u) => u === selectedUser.toLowerCase())
    : [];
  const activeTypingUser = hasSelectedRoom
    ? roomTyping[0]
    : selectedUser
    ? privateTyping[0]
    : teamTypingUsers[0];

  useEffect(() => {
    if (selectedUser) loadPrivateHistory(selectedUser);
  }, [selectedUser, loadPrivateHistory]);

  useEffect(() => {
    if (featureFlags.phaseEEnabled && featureFlags.telemetryEnabled) {
      trackTelemetry('chat_screen_opened', 'chat', `project=${projectId}`);
    }
  }, [featureFlags.phaseEEnabled, featureFlags.telemetryEnabled, projectId, trackTelemetry]);

  useEffect(() => {
    const key = `${roomIdParam || ''}|${withParam || ''}|${viewParam || ''}`;
    if (!key || handledQueryRef.current === key) return;

    if (roomIdParam) {
      const parsedRoomId = Number(roomIdParam);
      if (Number.isFinite(parsedRoomId) && parsedRoomId > 0) {
        selectRoom(parsedRoomId);
        handledQueryRef.current = key;
        return;
      }
    }

    if (withParam) {
      selectPrivateUser(withParam.toLowerCase());
      handledQueryRef.current = key;
      return;
    }

    if (viewParam === 'team') {
      selectRoom(null);
      selectPrivateUser(null);
      handledQueryRef.current = key;
    }
  }, [roomIdParam, withParam, viewParam, selectRoom, selectPrivateUser]);

  useEffect(() => {
    if (hasSelectedRoom) loadRoomHistory(selectedRoomId as number);
  }, [selectedRoomId, hasSelectedRoom, loadRoomHistory]);

  const handleSendMessage = (content: string) => {
    if (hasSelectedRoom) sendRoomMessage(content, selectedRoomId as number);
    else sendMessage(content, selectedUser);
  };

  const handleCreateRoom = async (name: string, members: string[]) => {
    const createdRoom = await createRoom(name, members);
    if (!createdRoom) return;
    selectRoom(createdRoom.id);
    await loadRoomHistory(createdRoom.id);
  };

  const isConnected = isSocketConnected;
  const isReconnectError = error.toLowerCase().includes('reconnect');
  const shouldShowErrorBanner = Boolean(error) && !isReconnectError;

  /* ── Loading skeleton ── */
  if (isLoading) {
    return <ChatLoadingSkeleton />;
  }

  return (
    <div className="flex bg-[#F7F8FA] overflow-hidden h-full min-h-0">

      {/* ── Sidebar ── */}
      <div className={showChatSidebar ? 'flex w-full lg:w-auto' : 'hidden lg:flex'}>
        <ChatSidebar
          currentUser={currentUser}
          currentUserAliases={currentUserAliases}
          users={filteredUsers}
          userProfilePics={userProfilePics}
          rooms={rooms}
          selectedUser={selectedUser}
          selectedRoomId={selectedRoomId}
          onSelectUser={handleSelectUser}
          onSelectRoom={handleSelectRoom}
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
          isLoading={false}
          roomMentionCounts={roomMentionCounts}
          teamMentionCount={teamMentionCount}
        />
      </div>

      {/* ── Main chat area ── */}
      <div className={`flex-1 min-h-0 flex flex-col min-w-0 bg-white border-l-0 lg:border-l border-gray-100/60 shadow-sm ${!showChatSidebar ? 'flex w-full' : 'hidden lg:flex'}`}>
        <ChatConnectionBanners
          isConnected={isConnected}
          shouldShowErrorBanner={shouldShowErrorBanner}
          error={error}
          onRetry={retryConnection}
        />

        <ChatHeader
          selectedRoom={selectedRoom}
          selectedUser={selectedUser}
          userProfilePics={userProfilePics}
          onlineUsers={onlineUsers}
          isConnected={isConnected}
          phaseDEnabled={featureFlags.phaseDEnabled}
          showSearch={showSearch}
          onToggleSearch={() => setShowSearch((prev) => !prev)}
          onShowSidebar={() => setShowChatSidebar(true)}
        />

        <ChatSearchPanel
          showSearch={showSearch}
          phaseDEnabled={featureFlags.phaseDEnabled}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          onExecuteSearch={executeSearch}
          isSearchLoading={isSearchLoading}
          searchResults={searchResults}
          onOpenResult={jumpToSearchResult}
        />

        <div className="flex-1 min-h-0 flex flex-col">
          {/* No conversation selected — empty state */}
          {!selectedUser && !hasSelectedRoom && displayMessages.length === 0 && !isLoading ? null : null}

          {/* Messages */}
          <ChatMessages
            projectId={projectId}
            messages={filteredMessages}
            currentUser={currentUser}
            currentUserAliases={currentUserAliases}
            isPrivateChat={isPrivateChat}
            userProfilePics={userProfilePics}
            activeRoomId={selectedRoomId}
            pinnedMessageId={selectedRoom?.pinnedMessageId ?? null}
            reactionsByMessageId={messageReactions}
            onOpenThread={openThread}
            onEditMessage={editMessage}
            onDeleteMessage={deleteMessage}
            onToggleReaction={toggleReaction}
            onPinRoomMessage={
              selectedRoomId ? (messageId) => pinRoomMessage(selectedRoomId, messageId) : undefined
            }
            typingUser={activeTypingUser}
          />

          {/* Input */}
          <ChatInput
            onSendMessage={handleSendMessage}
            onTypingChange={sendTyping}
            disabled={isLoading || !isConnected || shouldShowErrorBanner}
            placeholder={
              hasSelectedRoom
                ? `Message #${selectedRoom?.name ?? 'channel'}…`
                : selectedUser
                ? `Message ${selectedUser}…`
                : 'Message team…'
            }
            enableMentions={!selectedUser}
            mentionCandidates={mentionCandidates}
          />
        </div>
      </div>

      {/* ── Thread panel ── */}
      <AnimatePresence>
        {activeThreadRoot && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 340, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden flex-shrink-0 hidden lg:flex"
          >
            <ThreadPanel
              rootMessage={activeThreadRoot}
              threadMessages={threadMessages}
              userProfilePics={userProfilePics}
              reactionsByMessageId={messageReactions}
              onClose={closeThread}
              onSendReply={sendThreadReply}
              onToggleReaction={toggleReaction}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
