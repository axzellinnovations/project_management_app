import { useState, useCallback } from 'react';
import * as chatApi from '@/services/chat-service';
import type { ChatMessage } from '@/app/(project)/project/[id]/chat/components/chat';
import { mergeMessage, isSameIdentity } from './chat-utils';

export function useChatMessages(projectId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [privateMessages, setPrivateMessages] = useState<Record<string, ChatMessage[]>>({});
  const [roomMessages, setRoomMessages] = useState<Record<number, ChatMessage[]>>({});
  const [teamLastMessage, setTeamLastMessage] = useState<ChatMessage | null>(null);
  const [privateLastMessages, setPrivateLastMessages] = useState<Record<string, ChatMessage | null>>({});
  const [roomLastMessages, setRoomLastMessages] = useState<Record<number, ChatMessage | null>>({});

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
      try {
        const data = await chatApi.fetchRoomMessages(projectId, roomId);
        setRoomMessages(prev => ({ ...prev, [roomId]: data }));
        setRoomLastMessages(prev => ({ ...prev, [roomId]: data.length > 0 ? data[data.length - 1] : null }));
        hydrateReactions?.(data);
      } catch (err) {
        console.error('Failed to load room history', err);
      }
    },
    [projectId],
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

