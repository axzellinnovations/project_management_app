'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, WifiOff, RefreshCw, Search, X, ArrowLeft } from 'lucide-react';
import { useChat } from './components/useChat';
import { ChatSidebar } from './components/chatSidebar';
import { ChatMessages } from './components/chatMessage';
import { ChatInput } from './components/chatInput';
import { ThreadPanel } from './components/threadPanel';

export default function ChatInterface() {
  const params = useParams();
  const projectId = params.id as string;
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
  const selectedRoom = hasSelectedRoom ? rooms.find((r) => r.id === selectedRoomId) : null;

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

  /* ── Header info ── */
  const AVATAR_COLORS = [
    'from-violet-500 to-indigo-600', 'from-emerald-500 to-teal-600', 'from-rose-500 to-pink-600',
    'from-blue-500 to-indigo-600', 'from-orange-500 to-red-600', 'from-purple-500 to-violet-700',
    'from-cyan-500 to-blue-600', 'from-amber-500 to-orange-600',
  ];
  const avatarColor = (name: string) => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];

  const headerIcon = hasSelectedRoom
    ? <div className={`w-8 h-8 rounded-full flex-shrink-0 bg-gradient-to-br ${avatarColor(selectedRoom?.name || 'G')} flex items-center justify-center text-white text-[13px] font-bold shadow-sm ring-2 ring-white`}>{(selectedRoom?.name || 'G').charAt(0).toUpperCase()}</div>
    : selectedUser && userProfilePics[selectedUser]
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={userProfilePics[selectedUser]} alt={selectedUser} className="w-8 h-8 rounded-full flex-shrink-0 object-cover shadow-sm ring-2 ring-white" />
    : selectedUser
    ? <div className={`w-8 h-8 rounded-full flex-shrink-0 bg-gradient-to-br ${avatarColor(selectedUser)} flex items-center justify-center text-white text-[13px] font-bold shadow-sm ring-2 ring-white`}>{(selectedUser || '?').charAt(0).toUpperCase()}</div>
    : <div className="w-8 h-8 rounded-full flex-shrink-0 bg-blue-100 flex items-center justify-center text-blue-600 shadow-sm ring-2 ring-white"><Users size={16} strokeWidth={2.5} /></div>;

  const headerTitle = hasSelectedRoom
    ? selectedRoom?.name ?? 'Group Chat'
    : selectedUser ?? 'Team Chat';

  const headerSub = hasSelectedRoom
    ? selectedRoom?.topic || 'Group channel'
    : selectedUser
    ? 'Private message'
    : onlineUsers.length > 0
    ? `${onlineUsers.length} member${onlineUsers.length !== 1 ? 's' : ''} online`
    : 'Team workspace';

  /* ── Loading skeleton ── */
  if (isLoading) {
    return (
      <div className="flex bg-[#F7F8FA] h-full min-h-0">
        {/* Sidebar skeleton */}
        <div className="w-72 h-full bg-white border-r border-gray-100 flex flex-col">
          <div className="px-4 pt-5 pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gray-100 animate-pulse" />
              <div className="h-4 w-24 bg-gray-100 rounded-lg animate-pulse" />
            </div>
          </div>
          <div className="px-3 pt-3">
            <div className="h-9 bg-gray-100 rounded-xl animate-pulse" />
          </div>
          <div className="flex-1 px-3 mt-4 space-y-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-2">
                <div className="w-9 h-9 rounded-full bg-gray-100 animate-pulse" />
                <div className="flex-1 space-y-1.5">
                  <div className={`h-3 bg-gray-100 rounded animate-pulse ${i % 3 === 0 ? 'w-3/4' : i % 3 === 1 ? 'w-1/2' : 'w-2/3'}`} />
                  <div className="h-2.5 bg-gray-100 rounded animate-pulse w-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Main area skeleton */}
        <div className="flex-1 flex flex-col">
          <div className="h-16 border-b border-gray-100 bg-white px-6 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gray-100 animate-pulse" />
            <div className="space-y-1.5">
              <div className="h-3.5 w-32 bg-gray-100 rounded animate-pulse" />
              <div className="h-2.5 w-20 bg-gray-100 rounded animate-pulse" />
            </div>
          </div>
          <div className="flex-1 px-6 py-4 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className={`flex items-end gap-2 ${i % 2 === 0 ? '' : 'flex-row-reverse'}`}>
                <div className="w-7 h-7 rounded-full bg-gray-100 animate-pulse flex-shrink-0" />
                <div className={`h-12 bg-gray-100 animate-pulse rounded-2xl ${i % 3 === 0 ? 'w-48' : i % 3 === 1 ? 'w-64' : 'w-40'}`} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex bg-[#F7F8FA] overflow-hidden h-full min-h-0">

      {/* ── Sidebar ── */}
      <div className={showChatSidebar ? 'flex' : 'hidden lg:flex'}>
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
      <div className={`flex-1 flex flex-col min-w-0 bg-white border-l border-gray-100/60 shadow-sm ${!showChatSidebar ? 'flex' : 'hidden lg:flex'}`}>

        {/* Reconnect / disconnect banner */}
        <AnimatePresence>
          {!isConnected && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="bg-amber-50 border-b border-amber-100 px-4 py-2.5 flex items-center justify-between gap-3" role="alert">
                <div className="flex items-center gap-2 text-amber-700">
                  <WifiOff size={14} strokeWidth={2.5} />
                  <span className="text-[12.5px] font-medium">Disconnected — messages may not be delivered</span>
                </div>
                <button
                  onClick={retryConnection}
                  className="flex items-center gap-1.5 text-[12px] font-semibold text-amber-700 hover:text-amber-800 bg-amber-100 hover:bg-amber-200 rounded-lg px-3 py-1 transition-colors"
                >
                  <RefreshCw size={12} strokeWidth={2.5} />
                  Reconnect
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error banner */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-red-50 border-b border-red-100 px-4 py-2.5 flex items-center justify-between gap-3" role="alert">
                <div className="flex-1">
                  <p className="text-[12.5px] font-semibold text-red-700">{error}</p>
                  <p className="text-[11px] text-red-500 mt-0.5">
                    Ensure backend is running at <code className="font-mono bg-red-100 px-1.5 py-0.5 rounded">http://localhost:8080</code>
                  </p>
                </div>
                <button
                  onClick={retryConnection}
                  className="flex items-center gap-1.5 text-[12px] font-semibold text-red-700 hover:text-red-800 bg-red-100 hover:bg-red-200 rounded-lg px-3 py-1.5 transition-colors whitespace-nowrap"
                >
                  <RefreshCw size={12} strokeWidth={2.5} />
                  Retry
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <div className="h-16 px-5 flex items-center justify-between border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {/* Back to sidebar on mobile */}
            <button
              className="lg:hidden p-1.5 -ml-1 rounded-lg hover:bg-gray-100 text-gray-500 flex-shrink-0"
              onClick={() => setShowChatSidebar(true)}
              aria-label="Back to conversations"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              {headerIcon}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-[15px] font-semibold text-gray-900 truncate">{headerTitle}</h2>
                {/* Connection status dot */}
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors ${isConnected ? 'bg-emerald-400' : 'bg-amber-400'}`}
                  title={isConnected ? 'Connected' : 'Disconnected'}
                />
              </div>
              <p className="text-[12px] text-gray-400 truncate">{headerSub}</p>
            </div>
          </div>

          {/* Top-right actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Online members count */}
            {onlineUsers.length > 0 && (
              <div className="hidden sm:flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-[11.5px] font-semibold rounded-xl px-3 py-1.5 border border-emerald-100">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                {onlineUsers.length} online
              </div>
            )}

            {/* Search toggle (phaseDEnabled) */}
            {featureFlags.phaseDEnabled && (
              <button
                onClick={() => setShowSearch((prev) => !prev)}
                className="w-9 h-9 rounded-xl hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
                title="Search messages"
                aria-label="Toggle message search"
              >
                {showSearch ? <X size={17} strokeWidth={2.5} /> : <Search size={17} strokeWidth={2.5} />}
              </button>
            )}
          </div>
        </div>

        {/* Message search bar */}
        <AnimatePresence>
          {featureFlags.phaseDEnabled && showSearch && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-b border-gray-100"
            >
              <div className="px-5 py-3 flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus-within:border-blue-200 focus-within:ring-2 focus-within:ring-blue-50 transition-all">
                  <Search size={14} className="text-gray-400 flex-shrink-0" strokeWidth={2.5} />
                  <input
                    type="text"
                    id="chat-search-input"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && executeSearch()}
                    placeholder="Search all messages…"
                    className="flex-1 bg-transparent text-[13px] text-gray-700 placeholder:text-gray-400 outline-none"
                    aria-label="Search all chat messages"
                    autoFocus
                  />
                </div>
                <button
                  onClick={executeSearch}
                  disabled={isSearchLoading || !searchQuery.trim()}
                  className="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-[12.5px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  aria-label="Submit search"
                >
                  {isSearchLoading ? '…' : 'Search'}
                </button>
              </div>

              {/* Search results */}
              {searchResults.length > 0 && (
                <div className="px-5 pb-3 space-y-1 max-h-56 overflow-y-auto" role="listbox" aria-label="Search results">
                  {searchResults.slice(0, 10).map((result) => (
                    <button
                      key={result.messageId}
                      onClick={() => jumpToSearchResult(result)}
                      className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100"
                      role="option"
                      aria-selected="false"
                      aria-label={`${result.context} message from ${result.sender}`}
                    >
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500 bg-blue-50 border border-blue-100 rounded-full px-2 py-0.5">
                          {result.context}
                        </span>
                        <span className="text-[11px] font-semibold text-gray-600">{result.sender}</span>
                      </div>
                      <p className="text-[12.5px] text-gray-700 truncate">{result.content}</p>
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* No conversation selected — empty state */}
        {!selectedUser && !hasSelectedRoom && displayMessages.length === 0 && !isLoading ? null : null}

        {/* Messages */}
        <ChatMessages
          projectId={projectId}
          messages={filteredMessages}
          currentUser={currentUser}
          currentUserAliases={currentUserAliases}
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
          disabled={isLoading || !!error}
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
        {/* Spacer for mobile BottomNav */}
        <div className="h-20 flex-shrink-0 lg:hidden" aria-hidden="true" />
      </div>

      {/* ── Thread panel ── */}
      <AnimatePresence>
        {activeThreadRoot && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 340, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden flex-shrink-0"
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
