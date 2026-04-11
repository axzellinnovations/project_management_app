import { useState, useCallback, useEffect } from 'react';
import * as chatApi from '@/services/chat-service';
import type { ChatMessage } from '@/app/(project)/project/[id]/chat/components/chat';
import { mergeMessage, isSameIdentity } from './chat-utils';
import { buildSessionCacheKey, getSessionCache, setSessionCache } from '@/lib/session-cache';

const ROOM_MESSAGES_CACHE_LIMIT = 50;
const TEAM_MESSAGES_CACHE_LIMIT = 80;
const PRIVATE_MESSAGES_CACHE_LIMIT = 80;
const ROOM_MESSAGES_CACHE_TTL_MS = 120_000;
const TEAM_MESSAGES_CACHE_TTL_MS = 90_000;
const PRIVATE_MESSAGES_CACHE_TTL_MS = 90_000;

function toWindowedRoomMessages(messages: ChatMessage[]): ChatMessage[] {
  if (!Array.isArray(messages)) return [];
  if (messages.length <= ROOM_MESSAGES_CACHE_LIMIT) return messages;
  return messages.slice(-ROOM_MESSAGES_CACHE_LIMIT);
}

function toWindowedMessages(messages: ChatMessage[], limit: number): ChatMessage[] {
  if (!Array.isArray(messages)) return [];
  if (messages.length <= limit) return messages;
  return messages.slice(-limit);
}

function getRoomCacheKey(projectId: string, roomId: number): string | null {
  return buildSessionCacheKey('chat-room-messages', [projectId, roomId]);
}

function getTeamCacheKey(projectId: string): string | null {
  return buildSessionCacheKey('chat-team-messages', [projectId]);
}

function getPrivateCacheKey(projectId: string, recipient: string): string | null {
  return buildSessionCacheKey('chat-private-messages', [projectId, recipient.toLowerCase()]);
}

export function useChatMessages(projectId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [privateMessages, setPrivateMessages] = useState<Record<string, ChatMessage[]>>({});
  const [roomMessages, setRoomMessages] = useState<Record<number, ChatMessage[]>>({});
  const [teamLastMessage, setTeamLastMessage] = useState<ChatMessage | null>(null);
  const [privateLastMessages, setPrivateLastMessages] = useState<Record<string, ChatMessage | null>>({});
  const [roomLastMessages, setRoomLastMessages] = useState<Record<number, ChatMessage | null>>({});

  const readRoomMessagesCache = useCallback((roomId: number): { data: ChatMessage[]; isStale: boolean } | null => {
    const cacheKey = getRoomCacheKey(projectId, roomId);
    if (!cacheKey) return null;

    const cached = getSessionCache<ChatMessage[]>(cacheKey, { allowStale: true });
    if (!cached.data || !Array.isArray(cached.data)) return null;

    return {
      data: toWindowedRoomMessages(cached.data),
      isStale: cached.isStale,
    };
  }, [projectId]);

  const readTeamMessagesCache = useCallback((): { data: ChatMessage[]; isStale: boolean } | null => {
    const cacheKey = getTeamCacheKey(projectId);
    if (!cacheKey) return null;

    const cached = getSessionCache<ChatMessage[]>(cacheKey, { allowStale: true });
    if (!cached.data || !Array.isArray(cached.data)) return null;

    return {
      data: toWindowedMessages(cached.data, TEAM_MESSAGES_CACHE_LIMIT),
      isStale: cached.isStale,
    };
  }, [projectId]);

  const readPrivateMessagesCache = useCallback((recipient: string): { data: ChatMessage[]; isStale: boolean } | null => {
    const cacheKey = getPrivateCacheKey(projectId, recipient);
    if (!cacheKey) return null;

    const cached = getSessionCache<ChatMessage[]>(cacheKey, { allowStale: true });
    if (!cached.data || !Array.isArray(cached.data)) return null;

    return {
      data: toWindowedMessages(cached.data, PRIVATE_MESSAGES_CACHE_LIMIT),
      isStale: cached.isStale,
    };
  }, [projectId]);

  const writeRoomMessagesCache = useCallback((roomId: number, messages: ChatMessage[]) => {
    const cacheKey = getRoomCacheKey(projectId, roomId);
    if (!cacheKey) return;
    setSessionCache(cacheKey, toWindowedRoomMessages(messages), ROOM_MESSAGES_CACHE_TTL_MS);
  }, [projectId]);

  const writeTeamMessagesCache = useCallback((messages: ChatMessage[]) => {
    const cacheKey = getTeamCacheKey(projectId);
    if (!cacheKey) return;
    setSessionCache(cacheKey, toWindowedMessages(messages, TEAM_MESSAGES_CACHE_LIMIT), TEAM_MESSAGES_CACHE_TTL_MS);
  }, [projectId]);

  const writePrivateMessagesCache = useCallback((recipient: string, messages: ChatMessage[]) => {
    const cacheKey = getPrivateCacheKey(projectId, recipient);
    if (!cacheKey) return;
    setSessionCache(cacheKey, toWindowedMessages(messages, PRIVATE_MESSAGES_CACHE_LIMIT), PRIVATE_MESSAGES_CACHE_TTL_MS);
  }, [projectId]);

  useEffect(() => {
    Object.entries(roomMessages).forEach(([roomIdRaw, list]) => {
      const roomId = Number(roomIdRaw);
      if (!Number.isFinite(roomId)) return;
      writeRoomMessagesCache(roomId, list || []);
    });
  }, [roomMessages, writeRoomMessagesCache]);

  useEffect(() => {
    writeTeamMessagesCache(messages);
  }, [messages, writeTeamMessagesCache]);

  useEffect(() => {
    Object.entries(privateMessages).forEach(([partner, list]) => {
      writePrivateMessagesCache(partner, list || []);
    });
  }, [privateMessages, writePrivateMessagesCache]);

  const updateMessageEverywhere = useCallback(
    (incoming: ChatMessage, optimistic = false) => {
      if (!incoming.deleted && incoming.type === 'JOIN') return;

      if (incoming.roomId) {
        const rid = incoming.roomId;
        setRoomMessages(prev => ({
          ...prev,
          [rid]: mergeMessage(prev[rid] || [], incoming),
        }));
        if (!optimistic) {
          setRoomLastMessages(prev => ({ ...prev, [rid]: incoming }));
        }
        return;
      }

      if (incoming.recipient) {
        const partner = incoming.recipient.toLowerCase();
        setPrivateMessages(prev => ({
          ...prev,
          [partner]: mergeMessage(prev[partner] || [], incoming),
        }));
        if (!optimistic) {
          setPrivateLastMessages(prev => ({ ...prev, [partner]: incoming }));
        }
        return;
      }

      if (incoming.parentMessageId) {
        return;
      }

      setMessages(prev => mergeMessage(prev, incoming));
      if (!optimistic) {
        setTeamLastMessage(incoming);
      }
    },
    [],
  );

  const loadHistory = useCallback(
    async (hydrateReactions?: (msgs: ChatMessage[]) => void) => {
      const cached = readTeamMessagesCache();
      if (cached?.data.length) {
        setMessages(cached.data);
        setTeamLastMessage(cached.data[cached.data.length - 1] || null);
        hydrateReactions?.(cached.data);
        if (!cached.isStale) {
          return;
        }
      }

      try {
        const data = await chatApi.fetchTeamMessages(projectId);
        const windowed = toWindowedMessages(data, TEAM_MESSAGES_CACHE_LIMIT);
        setMessages(windowed);
        setTeamLastMessage(windowed.length > 0 ? windowed[windowed.length - 1] : null);
        writeTeamMessagesCache(windowed);
        hydrateReactions?.(windowed);
      } catch (err) {
        console.error('Failed to load message history', err);
      }
    },
    [projectId, readTeamMessagesCache, writeTeamMessagesCache],
  );

  const loadRoomHistory = useCallback(
    async (roomId: number, hydrateReactions?: (msgs: ChatMessage[]) => void) => {
      const cached = readRoomMessagesCache(roomId);
      if (cached?.data.length) {
        setRoomMessages(prev => ({ ...prev, [roomId]: cached.data }));
        setRoomLastMessages(prev => ({ ...prev, [roomId]: cached.data[cached.data.length - 1] || null }));
        hydrateReactions?.(cached.data);
        if (!cached.isStale) {
          return;
        }
      }

      try {
        const data = await chatApi.fetchRoomMessages(projectId, roomId);
        const windowed = toWindowedRoomMessages(data);
        setRoomMessages(prev => ({ ...prev, [roomId]: windowed }));
        setRoomLastMessages(prev => ({ ...prev, [roomId]: windowed.length > 0 ? windowed[windowed.length - 1] : null }));
        writeRoomMessagesCache(roomId, windowed);
        hydrateReactions?.(windowed);
      } catch (err) {
        console.error('Failed to load room history', err);
      }
    },
    [projectId, readRoomMessagesCache, writeRoomMessagesCache],
  );

  const loadPrivateHistory = useCallback(
    async (
      recipient: string,
      currentUser: string,
      hydrateReactions?: (msgs: ChatMessage[]) => void,
    ) => {
      if (!recipient || !currentUser) return;

      const cached = readPrivateMessagesCache(recipient);
      if (cached?.data.length) {
        setPrivateMessages(prev => ({ ...prev, [recipient]: cached.data }));
        setPrivateLastMessages(prev => ({
          ...prev,
          [recipient]: cached.data[cached.data.length - 1] || null,
        }));
        hydrateReactions?.(cached.data);
        if (!cached.isStale) {
          return;
        }
      }

      try {
        const data = await chatApi.fetchPrivateMessages(projectId, currentUser, recipient);
        const windowed = toWindowedMessages(data, PRIVATE_MESSAGES_CACHE_LIMIT);
        setPrivateMessages(prev => ({ ...prev, [recipient]: windowed }));
        setPrivateLastMessages(prev => ({
          ...prev,
          [recipient]: windowed.length > 0 ? windowed[windowed.length - 1] : null,
        }));
        writePrivateMessagesCache(recipient, windowed);
        hydrateReactions?.(windowed);
      } catch (err) {
        console.error('Failed to load private history', err);
      }
    },
    [projectId, readPrivateMessagesCache, writePrivateMessagesCache],
  );

  const sendMessage = useCallback(
    (
      content: string,
      currentUser: string,
      stompSend: (dest: string, body: string) => void,
      trackTelemetry: (action: string, target: string) => void,
      recipient?: string | null,
    ) => {
      const trimmed = content.trim();
      if (!trimmed) return;

      if (recipient) {
        const msg: ChatMessage = {
          sender: currentUser,
          content: trimmed,
          recipient,
          type: 'CHAT',
          formatType: 'PLAIN',
          timestamp: new Date().toISOString(),
        };
        stompSend(
          `/app/project/${projectId}/chat.sendPrivateMessage`,
          JSON.stringify(msg),
        );
        trackTelemetry('chat_private_message_sent', 'private');
        updateMessageEverywhere(msg, true);
        return;
      }

      const msg: ChatMessage = {
        sender: currentUser,
        content: trimmed,
        type: 'CHAT',
        formatType: 'PLAIN',
        timestamp: new Date().toISOString(),
      };
      stompSend(
        `/app/project/${projectId}/chat.sendMessage`,
        JSON.stringify(msg),
      );
      trackTelemetry('chat_team_message_sent', 'team');
      updateMessageEverywhere(msg, true);
    },
    [projectId, updateMessageEverywhere],
  );

  const sendRoomMessage = useCallback(
    (
      content: string,
      roomId: number,
      currentUser: string,
      stompSend: (dest: string, body: string) => void,
      trackTelemetry: (action: string, target: string, details?: string) => void,
    ) => {
      const trimmed = content.trim();
      if (!trimmed) return;

      const msg: ChatMessage = {
        sender: currentUser,
        content: trimmed,
        roomId,
        type: 'CHAT',
        formatType: 'PLAIN',
        timestamp: new Date().toISOString(),
      };
      stompSend(
        `/app/project/${projectId}/room/${roomId}/send`,
        JSON.stringify(msg),
      );
      trackTelemetry('chat_room_message_sent', 'room', `roomId=${roomId}`);
      updateMessageEverywhere(msg, true);
    },
    [projectId, updateMessageEverywhere],
  );

  const editMessage = useCallback(
    async (
      messageId: number,
      content: string,
      stompSend?: (dest: string, body: string) => void,
    ) => {
      const trimmed = content.trim();
      if (!trimmed) return;

      if (stompSend) {
        stompSend(
          `/app/project/${projectId}/messages/${messageId}/edit`,
          JSON.stringify({ content: trimmed, formatType: 'PLAIN' }),
        );
        return;
      }

      try {
        const updated = await chatApi.editMessageRest(projectId, messageId, trimmed);
        updateMessageEverywhere(updated);
      } catch (err) {
        console.error('Failed to edit message', err);
      }
    },
    [projectId, updateMessageEverywhere],
  );

  const deleteMessage = useCallback(
    async (
      messageId: number,
      stompSend?: (dest: string, body: string) => void,
    ) => {
      if (!window.confirm('Delete this message?')) return;

      if (stompSend) {
        stompSend(
          `/app/project/${projectId}/messages/${messageId}/delete`,
          JSON.stringify({}),
        );
        return;
      }

      try {
        const deleted = await chatApi.deleteMessageRest(projectId, messageId);
        updateMessageEverywhere(deleted);
      } catch (err) {
        console.error('Failed to delete message', err);
      }
    },
    [projectId, updateMessageEverywhere],
  );

  // Internal helper for STOMP handler: merge incoming private message
  const mergePrivateMessage = useCallback(
    (
      partner: string,
      incoming: ChatMessage,
      selectedUser: string | null,
      isFromCurrentUser: boolean,
    ) => {
      setPrivateMessages(prev => {
        const candidateKeys = new Set<string>([
          partner,
          ...(selectedUser ? [selectedUser.toLowerCase()] : []),
          ...Object.keys(prev),
        ]);
        const matchedKey =
          Array.from(candidateKeys).find(k => isSameIdentity(k, partner)) || partner;
        const updated = mergeMessage(prev[matchedKey] || [], incoming);
        return {
          ...prev,
          [matchedKey]: updated,
          ...(matchedKey !== partner ? { [partner]: updated } : {}),
        };
      });

      const activeKey =
        selectedUser && isSameIdentity(selectedUser, partner)
          ? selectedUser.toLowerCase()
          : partner;
      setPrivateLastMessages(prev => ({
        ...prev,
        [activeKey]: incoming,
        ...(activeKey !== partner ? { [partner]: incoming } : {}),
      }));

      return { isFromCurrentUser };
    },
    [],
  );

  return {
    messages,
    setMessages,
    privateMessages,
    setPrivateMessages,
    roomMessages,
    setRoomMessages,
    teamLastMessage,
    setTeamLastMessage,
    privateLastMessages,
    setPrivateLastMessages,
    roomLastMessages,
    setRoomLastMessages,
    updateMessageEverywhere,
    mergePrivateMessage,
    loadHistory,
    loadRoomHistory,
    loadPrivateHistory,
    sendMessage,
    sendRoomMessage,
    editMessage,
    deleteMessage,
  };
}

