import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import * as chatApi from '@/services/chat-service';
import { useGlobalNotifications } from '@/components/providers/GlobalNotificationProvider';
import { normalizeIdentity, isSameIdentity } from './chat-utils';
import { useChatMessages } from './useChatMessages';
import { useChatRooms } from './useChatRooms';
import { useChatPresence } from './useChatPresence';
import { useChatThreads } from './useChatThreads';
import { useChatReactions } from './useChatReactions';
import { useChatSearch } from './useChatSearch';
import { useChatUnread } from './useChatUnread';
import {
  CHAT_RECONNECT_ERROR,
  DEFAULT_FEATURE_FLAGS,
  initializeChatState,
  restoreSelectionState,
} from './useChat.internal';
import {
  useRealtimeLifecycle,
  useSelectionPersistence,
  useSelectionSideEffects,
  useSyncSelectionRefs,
} from './useChat.lifecycle';
import type { ChatMessage, ChatFeatureFlags, ChatRoom } from '@/app/(project)/project/[id]/chat/components/chat';

export const useChat = (projectId: string) => {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState('');
  const [currentUserAliases, setCurrentUserAliases] = useState<string[]>([]);
  const [users, setUsers] = useState<string[]>([]);
  const [userProfilePics, setUserProfilePics] = useState<Record<string, string>>({});
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const selectedUserRef = useRef<string | null>(null);
  const selectedRoomIdRef = useRef<number | null>(null);
  const loadingRoomRef = useRef<number | null>(null);
  const loadingPrivateRef = useRef<string | null>(null);
  const [featureFlags, setFeatureFlags] = useState<ChatFeatureFlags>(DEFAULT_FEATURE_FLAGS);
  const [commandNotice, setCommandNotice] = useState('');
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasRestoredSelection, setHasRestoredSelection] = useState(false);
  const hasRestoredSelectionRef = useRef(false);
  const { realtimeConnected, subscribeRealtime, sendRealtime } = useGlobalNotifications();
  const msg = useChatMessages(projectId);
  const rm = useChatRooms(projectId);
  const presence = useChatPresence(projectId);
  const threads = useChatThreads(projectId);
  const reactions = useChatReactions(projectId);
  const search = useChatSearch(projectId);
  const unread = useChatUnread(projectId);
  const {
    setMessages,
    setPrivateMessages,
    setRoomMessages,
    setTeamLastMessage,
    setPrivateLastMessages,
    setRoomLastMessages,
    mergePrivateMessage,
    sendMessage: msgSend,
    sendRoomMessage: msgSendRoom,
    editMessage: msgEdit,
    deleteMessage: msgDelete,
    loadRoomHistory: msgLoadRoom,
    loadPrivateHistory: msgLoadPrivate,
  } = msg;

  const { setRooms, createRoom: rmCreate, deleteRoom: rmDelete, updateRoomMeta: rmUpdateMeta, pinRoomMessage: rmPin } = rm;
  const { setOnlineUsers, setTeamTypingUsers, setPrivateTypingUsers, setRoomTypingUsers } = presence;
  const {
    setTeamUnseenCount,
    setPrivateUnseenCounts,
    setRoomUnseenCounts,
    setRoomMentionCounts,
    setTeamMentionCount,
    setUnreadBadge,
    markTeamAsRead,
    clearRoomUnread,
    clearPrivateUnread,
  } = unread;
  const { setMessageReactions, loadMessageReactions: loadMsgReactions, toggleReaction: reactionsToggle, hydrateReactions } = reactions;
  const { setThreadMessages, sendThreadReply: threadsSendReply, openThread: threadsOpenThread, closeThread: threadsClose } = threads;
  useSyncSelectionRefs({ selectedUser, selectedRoomId, selectedUserRef, selectedRoomIdRef });
  const selectionStorageKey = `chat-selection:${projectId}`;
  const isStompConnected = useCallback(() => realtimeConnected, [realtimeConnected]);
  const stompSend = useCallback(
    (destination: string, body: string) => {
      sendRealtime(destination, body);
    },
    [sendRealtime],
  );

  const showCommandNotice = useCallback((message: string) => {
    setCommandNotice(message);
    window.setTimeout(() => setCommandNotice(''), 4500);
  }, []);

  const addTeam = useCallback((teamName: string) => {
    setUsers((prev) => (prev.includes(teamName) ? prev : [...prev, teamName]));
  }, []);

  const featureFlagsRef = useRef(featureFlags);
  useEffect(() => {
    featureFlagsRef.current = featureFlags;
  }, [featureFlags]);

  const trackTelemetry = useCallback(
    async (eventName: string, scope: string, metadata?: string) => {
      const flags = featureFlagsRef.current;
      if (!flags.phaseEEnabled || !flags.telemetryEnabled) return;
      try {
        await chatApi.postTelemetry(projectId, eventName, scope, metadata);
      } catch {
        // Telemetry should never break chat UX.
      }
    },
    [projectId],
  );

  const updateMessageEverywhere = useCallback(
    (incoming: ChatMessage, isOptimistic = false) => {
      const mergeTopLevel = (list: ChatMessage[], item: ChatMessage): ChatMessage[] => {
        if (item.parentMessageId) return list;
        if (!item.id) return isOptimistic ? [...list, item] : list;

        const index = list.findIndex((message) => message.id === item.id);
        if (index !== -1) {
          const next = [...list];
          next[index] = { ...next[index], ...item };
          return next;
        }

        return isOptimistic ? [...list, item] : list;
      };

      if (!incoming.roomId && !incoming.recipient && !incoming.parentMessageId) {
        setMessages((prev) => mergeTopLevel(prev, incoming));
      }

      if (incoming.roomId) {
        setRoomMessages((prev) => {
          const roomId = Number(incoming.roomId);
          return { ...prev, [roomId]: mergeTopLevel(prev[roomId] || [], incoming) };
        });
      }

      if (incoming.recipient) {
        setPrivateMessages((prev) => {
          const partner =
            [incoming.sender, incoming.recipient].find((user) => user && !isSameIdentity(user, currentUser)) ||
            incoming.recipient;
          if (!partner) return prev;

          const normalizedPartner = normalizeIdentity(partner);
          return { ...prev, [normalizedPartner]: mergeTopLevel(prev[normalizedPartner] || [], incoming) };
        });
      }

      setThreadMessages((prev) => {
        if (!incoming.id) {
          return isOptimistic && incoming.parentMessageId ? [...prev, incoming] : prev;
        }

        const index = prev.findIndex((message) => message.id === incoming.id);
        if (index !== -1) {
          const next = [...prev];
          next[index] = { ...next[index], ...incoming };
          return next;
        }

        return isOptimistic && incoming.parentMessageId ? [...prev, incoming] : prev;
      });
    },
    [currentUser, setMessages, setRoomMessages, setPrivateMessages, setThreadMessages],
  );

  const sendMessage = useCallback(
    (content: string, recipient?: string | null) => {
      if (!isStompConnected()) {
        setError(CHAT_RECONNECT_ERROR);
        return;
      }
      msgSend(content, currentUser, stompSend, trackTelemetry, recipient);
    },
    [currentUser, msgSend, stompSend, trackTelemetry, isStompConnected],
  );

  const sendRoomMessage = useCallback(
    (content: string, roomId: number) => {
      if (!isStompConnected()) {
        setError(CHAT_RECONNECT_ERROR);
        return;
      }
      msgSendRoom(content, roomId, currentUser, stompSend, trackTelemetry);
    },
    [currentUser, msgSendRoom, stompSend, trackTelemetry, isStompConnected],
  );

  const editMessage = useCallback(
    async (messageId: number, content: string) => {
      await msgEdit(messageId, content, isStompConnected() ? stompSend : undefined);
    },
    [msgEdit, stompSend, isStompConnected],
  );

  const deleteMessage = useCallback(
    async (messageId: number) => {
      await msgDelete(messageId, isStompConnected() ? stompSend : undefined);
    },
    [msgDelete, stompSend, isStompConnected],
  );

  const toggleReaction = useCallback(
    async (messageId: number, emoji: string) => {
      await reactionsToggle(messageId, emoji, isStompConnected() ? stompSend : undefined);
    },
    [reactionsToggle, stompSend, isStompConnected],
  );

  const searchMessages = useCallback(
    async (query: string) => {
      if (!featureFlagsRef.current.phaseDEnabled) return;
      await search.searchMessages(query);
    },
    [search],
  );

  const sendThreadReply = useCallback(
    async (content: string) => {
      await threadsSendReply(content, currentUser, isStompConnected() ? stompSend : undefined, updateMessageEverywhere);
    },
    [currentUser, threadsSendReply, stompSend, updateMessageEverywhere, isStompConnected],
  );

  const openThread = useCallback(
    async (rootMessage: ChatMessage) => {
      await threadsOpenThread(rootMessage, hydrateReactions);
    },
    [threadsOpenThread, hydrateReactions],
  );

  const createRoom = useCallback(
    async (name: string, members: string[]) => rmCreate(name, members, currentUser, users),
    [rmCreate, currentUser, users],
  );

  const loadRoomHistory = useCallback(
    async (roomId: number) => {
      if (loadingRoomRef.current === roomId) return;
      loadingRoomRef.current = roomId;

      await msgLoadRoom(roomId, hydrateReactions);
      clearRoomUnread(roomId);
      try {
        await chatApi.markRoomAsRead(projectId, roomId);
      } catch {
        // Read-state sync failure should not block UI.
      } finally {
        loadingRoomRef.current = null;
      }
    },
    [msgLoadRoom, hydrateReactions, clearRoomUnread, projectId],
  );

  const loadPrivateHistory = useCallback(
    async (recipient: string) => {
      const normalizedRecipient = recipient.toLowerCase();
      if (loadingPrivateRef.current === normalizedRecipient) return;
      loadingPrivateRef.current = normalizedRecipient;

      await msgLoadPrivate(recipient, currentUser, hydrateReactions);
      clearPrivateUnread(recipient);
      try {
        await chatApi.markDirectConversationAsRead(projectId, recipient);
      } catch {
        // Read-state sync failure should not block UI.
      } finally {
        loadingPrivateRef.current = null;
      }
    },
    [msgLoadPrivate, currentUser, hydrateReactions, clearPrivateUnread, projectId],
  );

  const sendTyping = useCallback(
    (isTyping: boolean) => {
      if (!isStompConnected()) return;

      const roomId = selectedRoomIdRef.current;
      if (roomId !== null && Number.isFinite(roomId)) {
        stompSend(`/app/project/${projectId}/typing`, JSON.stringify({ scope: 'ROOM', roomId, isTyping }));
        return;
      }

      if (selectedUserRef.current) {
        stompSend(
          `/app/project/${projectId}/typing`,
          JSON.stringify({ scope: 'PRIVATE', recipient: selectedUserRef.current, isTyping }),
        );
        return;
      }

      stompSend(`/app/project/${projectId}/typing`, JSON.stringify({ scope: 'TEAM', isTyping }));
    },
    [projectId, stompSend, isStompConnected],
  );

  const selectPrivateUser = useCallback((user: string | null) => {
    setSelectedRoomId(null);
    setSelectedUser(user);
  }, []);

  const selectRoom = useCallback((roomId: number | null) => {
    setSelectedUser(null);
    if (roomId === null) {
      setSelectedRoomId(null);
      return;
    }

    const normalizedRoomId = Number(roomId);
    setSelectedRoomId(Number.isFinite(normalizedRoomId) ? normalizedRoomId : null);
  }, []);

  useSelectionPersistence({ selectedUser, selectedRoomId, selectionStorageKey, hasRestoredSelection });

  const restoreSelection = useCallback(
    (availableUsers: string[], availableRooms: ChatRoom[]) => {
      restoreSelectionState({
        selectionStorageKey,
        availableUsers,
        availableRooms,
        setSelectedUser,
        setSelectedRoomId,
        hasRestoredSelectionRef,
        setHasRestoredSelection,
      });
    },
    [selectionStorageKey],
  );

  const fetchAllUsers = useCallback(async () => {
    try {
      const data = await chatApi.fetchChatMembers(projectId);
      const currentAliasSet = new Set(currentUserAliases.map((alias) => alias.toLowerCase()));
      currentAliasSet.add(currentUser.toLowerCase());
      const normalized = data
        .map((user: string) => user.toLowerCase())
        .filter((user: string) => !currentAliasSet.has(user));
      setUsers(normalized);
      return normalized;
    } catch {
      return [] as string[];
    }
  }, [projectId, currentUserAliases, currentUser]);

  useEffect(() => {
    void initializeChatState({
      projectId,
      routerPush: (href) => router.push(href),
      setFeatureFlags,
      setUsers,
      setUserProfilePics,
      setRooms,
      setIsLoading,
      setError,
      setCurrentUser,
      setCurrentUserAliases,
      fetchAllUsers,
      loadRooms: rm.loadRooms,
      loadSummaries: unread.loadSummaries,
      loadPresence: presence.loadPresence,
      loadUnreadBadge: unread.loadUnreadBadge,
      restoreSelection,
      loadHistory: msg.loadHistory,
      hydrateReactions: reactions.hydrateReactions,
      setPrivateLastMessages: msg.setPrivateLastMessages,
      setRoomLastMessages: msg.setRoomLastMessages,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useRealtimeLifecycle({
    projectId,
    realtimeConnected,
    currentUser,
    currentUserAliases,
    selectedUserRef,
    selectedRoomIdRef,
    subscribeRealtime,
    sendRealtime,
    setError,
    setUsers,
    setMessages,
    setTeamLastMessage,
    setTeamUnseenCount,
    markTeamAsRead,
    loadMessageReactions: loadMsgReactions,
    mergePrivateMessage,
    setPrivateLastMessages,
    setPrivateUnseenCounts,
    setRooms,
    setRoomUnseenCounts,
    setRoomLastMessages,
    setRoomMessages,
    setOnlineUsers,
    setTeamTypingUsers,
    setPrivateTypingUsers,
    setUnreadBadge,
    showCommandNotice,
    trackTelemetry,
    setRoomMentionCounts,
    setTeamMentionCount,
    isSocketConnected,
    setIsSocketConnected,
    rooms: rm.rooms,
    setRoomTypingUsers,
    activeThreadRootId: threads.activeThreadRoot?.id,
    threadMessages: threads.threadMessages,
    privateMessages: msg.privateMessages,
    roomMessages: msg.roomMessages,
    messages: msg.messages,
    setMessageReactions,
    setThreadMessages,
  });

  useSelectionSideEffects({
    selectedUser,
    selectedRoomId,
    hasRestoredSelection,
    setPrivateTypingUsers,
    clearPrivateUnread,
    setRoomTypingUsers,
    clearRoomUnread,
    setRoomMentionCounts,
    setTeamUnseenCount,
    setTeamMentionCount,
    markTeamAsRead,
  });

  return {
    currentUser,
    currentUserAliases,
    users,
    messages: msg.messages,
    privateMessages: msg.privateMessages,
    rooms: rm.rooms,
    roomMessages: msg.roomMessages,
    selectedUser,
    selectedRoomId,
    privateUnseenCounts: unread.privateUnseenCounts,
    roomUnseenCounts: unread.roomUnseenCounts,
    privateLastMessages: msg.privateLastMessages,
    roomLastMessages: msg.roomLastMessages,
    teamUnseenCount: unread.teamUnseenCount,
    teamLastMessage: msg.teamLastMessage,
    userProfilePics,
    onlineUsers: presence.onlineUsers,
    teamTypingUsers: presence.teamTypingUsers,
    roomTypingUsers: presence.roomTypingUsers,
    privateTypingUsers: presence.privateTypingUsers,
    unreadBadge: unread.unreadBadge,
    featureFlags,
    searchResults: search.searchResults,
    isSearchLoading: search.isSearchLoading,
    commandNotice,
    messageReactions: reactions.messageReactions,
    activeThreadRoot: threads.activeThreadRoot,
    threadMessages: threads.threadMessages,
    selectPrivateUser,
    selectRoom,
    sendMessage,
    sendRoomMessage,
    sendThreadReply,
    openThread,
    closeThread: threadsClose,
    editMessage,
    deleteMessage,
    toggleReaction,
    loadRoomHistory,
    loadPrivateHistory,
    createRoom,
    deleteRoom: rmDelete,
    updateRoomMeta: rmUpdateMeta,
    pinRoomMessage: rmPin,
    sendTyping,
    searchMessages,
    trackTelemetry,
    addTeam,
    isLoading,
    isSocketConnected,
    error,
    roomMentionCounts: unread.roomMentionCounts,
    teamMentionCount: unread.teamMentionCount,
    retryConnection: () => window.location.reload(),
  };
};
