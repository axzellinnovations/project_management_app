import { useEffect } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import {
  setupBaseRealtimeSubscriptions,
  setupReactionSubscriptions,
  setupRoomRealtimeSubscriptions,
  setupThreadRealtimeSubscription,
} from './useChat.internal';
import { isSameIdentity } from './chat-utils';
import type { ChatMessage, ChatRoom, UnreadBadgeSummary } from '@/app/(project)/project/[id]/chat/components/chat';

type SetState<T> = Dispatch<SetStateAction<T>>;
type RealtimePayload = { body: string };
type RealtimeSubscription = { unsubscribe: () => void } | null;
type RealtimeSubscribe = (destination: string, callback: (payload: RealtimePayload) => void) => RealtimeSubscription;

export interface UseChatRefsArgs {
  selectedUser: string | null;
  selectedRoomId: number | null;
  selectedUserRef: MutableRefObject<string | null>;
  selectedRoomIdRef: MutableRefObject<number | null>;
}

export const useSyncSelectionRefs = ({
  selectedUser,
  selectedRoomId,
  selectedUserRef,
  selectedRoomIdRef,
}: UseChatRefsArgs): void => {
  useEffect(() => {
    selectedUserRef.current = selectedUser;
  }, [selectedUser, selectedUserRef]);

  useEffect(() => {
    selectedRoomIdRef.current = selectedRoomId;
  }, [selectedRoomId, selectedRoomIdRef]);
};

export interface UseSelectionPersistenceArgs {
  selectedUser: string | null;
  selectedRoomId: number | null;
  selectionStorageKey: string;
  hasRestoredSelection: boolean;
}

export const useSelectionPersistence = ({
  selectedUser,
  selectedRoomId,
  selectionStorageKey,
  hasRestoredSelection,
}: UseSelectionPersistenceArgs): void => {
  useEffect(() => {
    if (typeof window === 'undefined' || !hasRestoredSelection) return;
    const selection =
      selectedRoomId !== null && Number.isFinite(selectedRoomId)
        ? { type: 'room', value: selectedRoomId }
        : selectedUser
          ? { type: 'private', value: selectedUser }
          : { type: 'team', value: null };
    window.sessionStorage.setItem(selectionStorageKey, JSON.stringify(selection));
  }, [selectedRoomId, selectedUser, selectionStorageKey, hasRestoredSelection]);
};

export interface UseSelectionSideEffectsArgs {
  selectedUser: string | null;
  selectedRoomId: number | null;
  hasRestoredSelection: boolean;
  setPrivateTypingUsers: SetState<string[]>;
  clearPrivateUnread: (user: string) => void;
  setRoomTypingUsers: SetState<Record<number, string[]>>;
  clearRoomUnread: (roomId: number) => void;
  setRoomMentionCounts: SetState<Record<number, number>>;
  setTeamUnseenCount: SetState<number>;
  setTeamMentionCount: SetState<number>;
  markTeamAsRead: () => Promise<void>;
}

export const useSelectionSideEffects = ({
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
}: UseSelectionSideEffectsArgs): void => {
  useEffect(() => {
    if (!selectedUser) {
      setPrivateTypingUsers([]);
      return;
    }
    setPrivateTypingUsers((prev) => prev.filter((user) => isSameIdentity(user, selectedUser)));
    clearPrivateUnread(selectedUser);
  }, [selectedUser, setPrivateTypingUsers, clearPrivateUnread]);

  useEffect(() => {
    if (selectedRoomId === null || !Number.isFinite(selectedRoomId)) {
      setRoomTypingUsers({});
      return;
    }
    setRoomTypingUsers((prev) => ({ [selectedRoomId]: prev[selectedRoomId] || [] }));
    clearRoomUnread(selectedRoomId);
    setRoomMentionCounts((prev) => ({ ...prev, [selectedRoomId]: 0 }));
  }, [selectedRoomId, setRoomTypingUsers, clearRoomUnread, setRoomMentionCounts]);

  useEffect(() => {
    if (!hasRestoredSelection || selectedRoomId !== null || selectedUser) return;
    setTeamUnseenCount(0);
    setTeamMentionCount(0);
    void markTeamAsRead();
  }, [selectedRoomId, selectedUser, hasRestoredSelection, setTeamUnseenCount, setTeamMentionCount, markTeamAsRead]);
};

export interface UseRealtimeLifecycleArgs {
  projectId: string;
  realtimeConnected: boolean;
  currentUser: string;
  currentUserAliases: string[];
  selectedUserRef: MutableRefObject<string | null>;
  selectedRoomIdRef: MutableRefObject<number | null>;
  subscribeRealtime: RealtimeSubscribe;
  sendRealtime: (destination: string, body: string) => void;
  setError: SetState<string>;
  setUsers: SetState<string[]>;
  setMessages: SetState<ChatMessage[]>;
  setTeamLastMessage: SetState<ChatMessage | null>;
  setTeamUnseenCount: SetState<number>;
  markTeamAsRead: () => Promise<void>;
  loadMessageReactions: (messageId: number) => Promise<void>;
  mergePrivateMessage: (
    partner: string,
    incoming: ChatMessage,
    selectedUser: string | null,
    isFromCurrentUser: boolean,
  ) => { isFromCurrentUser: boolean };
  setPrivateLastMessages: SetState<Record<string, ChatMessage | null>>;
  setPrivateUnseenCounts: SetState<Record<string, number>>;
  setRooms: SetState<ChatRoom[]>;
  setRoomUnseenCounts: SetState<Record<number, number>>;
  setRoomLastMessages: SetState<Record<number, ChatMessage | null>>;
  setRoomMessages: SetState<Record<number, ChatMessage[]>>;
  setOnlineUsers: SetState<string[]>;
  setTeamTypingUsers: SetState<string[]>;
  setPrivateTypingUsers: SetState<string[]>;
  setUnreadBadge: SetState<UnreadBadgeSummary>;
  showCommandNotice: (message: string) => void;
  trackTelemetry: (eventName: string, scope: string, metadata?: string) => Promise<void>;
  setRoomMentionCounts: SetState<Record<number, number>>;
  setTeamMentionCount: SetState<number>;
  isSocketConnected: boolean;
  setIsSocketConnected: SetState<boolean>;
  rooms: ChatRoom[];
  setRoomTypingUsers: SetState<Record<number, string[]>>;
  activeThreadRootId: number | undefined;
  threadMessages: ChatMessage[];
  privateMessages: Record<string, ChatMessage[]>;
  roomMessages: Record<number, ChatMessage[]>;
  messages: ChatMessage[];
  setMessageReactions: SetState<Record<number, import('@/app/(project)/project/[id]/chat/components/chat').ChatReactionSummary[]>>;
  setThreadMessages: SetState<ChatMessage[]>;
}

export const useRealtimeLifecycle = ({
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
  loadMessageReactions,
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
  rooms,
  setRoomTypingUsers,
  activeThreadRootId,
  threadMessages,
  privateMessages,
  roomMessages,
  messages,
  setMessageReactions,
  setThreadMessages,
}: UseRealtimeLifecycleArgs): void => {
  useEffect(() => {
    setIsSocketConnected(realtimeConnected);
  }, [realtimeConnected, setIsSocketConnected]);

  useEffect(() => {
    if (!realtimeConnected || !currentUser || currentUserAliases.length === 0) return;
    return setupBaseRealtimeSubscriptions({
      projectId,
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
      loadMessageReactions,
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
    });
  }, [
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
    loadMessageReactions,
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
  ]);

  useEffect(() => {
    if (!isSocketConnected) return;
    const interval = window.setInterval(() => {
      sendRealtime(`/app/project/${projectId}/presence.ping`, JSON.stringify({}));
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [projectId, isSocketConnected, sendRealtime]);

  useEffect(() => {
    if (!isSocketConnected) return;
    return setupRoomRealtimeSubscriptions({
      projectId,
      rooms,
      currentUser,
      selectedRoomIdRef,
      subscribeRealtime,
      setRoomMessages,
      setRoomLastMessages,
      setRoomUnseenCounts,
      loadMessageReactions,
      setRoomTypingUsers,
    });
  }, [
    projectId,
    rooms,
    isSocketConnected,
    currentUser,
    selectedRoomIdRef,
    subscribeRealtime,
    setRoomMessages,
    setRoomLastMessages,
    setRoomUnseenCounts,
    loadMessageReactions,
    setRoomTypingUsers,
  ]);

  useEffect(() => {
    if (!isSocketConnected || !activeThreadRootId) return;
    return setupThreadRealtimeSubscription({
      projectId,
      rootMessageId: activeThreadRootId,
      subscribeRealtime,
      setThreadMessages,
      loadMessageReactions,
    });
  }, [projectId, isSocketConnected, activeThreadRootId, subscribeRealtime, setThreadMessages, loadMessageReactions]);

  useEffect(() => {
    if (!isSocketConnected) return;
    return setupReactionSubscriptions({
      projectId,
      subscribeRealtime,
      messages,
      privateMessages,
      roomMessages,
      threadMessages,
      setMessageReactions,
    });
  }, [
    projectId,
    isSocketConnected,
    subscribeRealtime,
    messages,
    privateMessages,
    roomMessages,
    threadMessages,
    setMessageReactions,
  ]);
};
