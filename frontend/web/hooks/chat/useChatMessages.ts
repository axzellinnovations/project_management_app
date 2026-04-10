import { useState, useCallback, useEffect } from 'react';
import * as chatApi from '@/services/chat-service';
import type { ChatMessage } from '@/app/(project)/project/[id]/chat/components/chat';
import { mergeMessage, isSameIdentity } from './chat-utils';

const ROOM_MESSAGES_CACHE_PREFIX = 'planora:chat-room-messages:';
const ROOM_MESSAGES_CACHE_LIMIT = 50;

interface RoomMessagesCachePayload {
  timestamp: number;
  messages: ChatMessage[];
}

function toWindowedRoomMessages(messages: ChatMessage[]): ChatMessage[] {
  if (!Array.isArray(messages)) return [];
  if (messages.length <= ROOM_MESSAGES_CACHE_LIMIT) return messages;
  return messages.slice(-ROOM_MESSAGES_CACHE_LIMIT);
}

function getRoomCacheKey(projectId: string, roomId: number): string {
  return `${ROOM_MESSAGES_CACHE_PREFIX}${projectId}:${roomId}`;
}

export function useChatMessages(projectId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [privateMessages, setPrivateMessages] = useState<Record<string, ChatMessage[]>>({});
  const [roomMessages, setRoomMessages] = useState<Record<number, ChatMessage[]>>({});
  const [teamLastMessage, setTeamLastMessage] = useState<ChatMessage | null>(null);
  const [privateLastMessages, setPrivateLastMessages] = useState<Record<string, ChatMessage | null>>({});
  const [roomLastMessages, setRoomLastMessages] = useState<Record<number, ChatMessage | null>>({});

  const readRoomMessagesCache = useCallback((roomId: number): ChatMessage[] | null => {
    if (typeof window === 'undefined') return null;
    const raw = window.sessionStorage.getItem(getRoomCacheKey(projectId, roomId));
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as RoomMessagesCachePayload;
      if (!Array.isArray(parsed.messages)) return null;
      return toWindowedRoomMessages(parsed.messages);
    } catch {
      window.sessionStorage.removeItem(getRoomCacheKey(projectId, roomId));
      return null;
    }
  }, [projectId]);

  const writeRoomMessagesCache = useCallback((roomId: number, messages: ChatMessage[]) => {
    if (typeof window === 'undefined') return;
    const payload: RoomMessagesCachePayload = {
      timestamp: Date.now(),
      messages: toWindowedRoomMessages(messages),
    };
    window.sessionStorage.setItem(getRoomCacheKey(projectId, roomId), JSON.stringify(payload));
  }, [projectId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    Object.entries(roomMessages).forEach(([roomIdRaw, list]) => {
      const roomId = Number(roomIdRaw);
      if (!Number.isFinite(roomId)) return;
      writeRoomMessagesCache(roomId, list || []);
    });
  }, [roomMessages, writeRoomMessagesCache]);

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
      try {
        const data = await chatApi.fetchTeamMessages(projectId);
        setMessages(data);
        setTeamLastMessage(data.length > 0 ? data[data.length - 1] : null);
        hydrateReactions?.(data);
      } catch (err) {
        console.error('Failed to load message history', err);
      }
    },
    [projectId],
  );

  const loadRoomHistory = useCallback(
    async (roomId: number, hydrateReactions?: (msgs: ChatMessage[]) => void) => {
      const cached = readRoomMessagesCache(roomId);
      if (cached && cached.length > 0) {
        setRoomMessages(prev => ({ ...prev, [roomId]: cached }));
        setRoomLastMessages(prev => ({ ...prev, [roomId]: cached[cached.length - 1] || null }));
        hydrateReactions?.(cached);
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

      try {
        const data = await chatApi.fetchPrivateMessages(projectId, currentUser, recipient);
        setPrivateMessages(prev => ({ ...prev, [recipient]: data }));
        setPrivateLastMessages(prev => ({
          ...prev,
          [recipient]: data.length > 0 ? data[data.length - 1] : null,
        }));
        hydrateReactions?.(data);
      } catch (err) {
        console.error('Failed to load private history', err);
      }
    },
    [projectId],
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

