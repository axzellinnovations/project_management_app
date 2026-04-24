import { useState, useRef, useCallback } from 'react';
import * as chatApi from '@/services/chat-service';
import type { ChatMessage } from '@/app/(project)/project/[id]/chat/components/chat';
import { mergeMessage } from './chat-utils';

export function useChatThreads(projectId: string) {
  const [activeThreadRoot, setActiveThreadRoot] = useState<ChatMessage | null>(null);
  const [threadMessages, setThreadMessages] = useState<ChatMessage[]>([]);
  const activeThreadRootRef = useRef<ChatMessage | null>(null);

  const setActiveThreadRootWithRef = useCallback((msg: ChatMessage | null) => {
    activeThreadRootRef.current = msg;
    setActiveThreadRoot(msg);
  }, []);

  const openThread = useCallback(
    async (rootMessage: ChatMessage, hydrateReactions?: (msgs: ChatMessage[]) => void) => {
      if (!rootMessage.id) return;
      setActiveThreadRootWithRef(rootMessage);

      try {
        const data = await chatApi.fetchThreadMessages(projectId, rootMessage.id);
        setThreadMessages(data);
        hydrateReactions?.(data);
      } catch (err) {
        console.error('Failed to load thread messages', err);
        setThreadMessages([rootMessage]);
      }
    },
    [projectId, setActiveThreadRootWithRef],
  );

  const closeThread = useCallback(() => {
    setActiveThreadRootWithRef(null);
    setThreadMessages([]);
  }, [setActiveThreadRootWithRef]);

  const sendThreadReply = useCallback(
    async (
      content: string,
      currentUser: string,
      stompSend?: (dest: string, body: string) => void,
      updateMessageEverywhere?: (msg: ChatMessage, optimistic?: boolean) => void,
    ) => {
      if (!activeThreadRootRef.current?.id) return;
      const rootId = activeThreadRootRef.current.id;
      const trimmed = content.trim();
      if (!trimmed) return;

      if (stompSend) {
        const localId = `loc-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const message: ChatMessage = {
          localId,
          sender: currentUser,
          content: trimmed,
          type: 'CHAT',
          formatType: 'PLAIN',
          parentMessageId: rootId,
          timestamp: new Date().toISOString(),
        };
        stompSend(
          `/app/project/${projectId}/thread/${rootId}/send`,
          JSON.stringify(message),
        );
        updateMessageEverywhere?.(message, true);
        return;
      }

      try {
        const saved = await chatApi.postThreadReply(projectId, rootId, trimmed);
        setThreadMessages(prev => mergeMessage(prev, saved));
        updateMessageEverywhere?.(saved);
      } catch (err) {
        console.error('Failed to send thread reply', err);
      }
    },
    [projectId],
  );

  return {
    activeThreadRoot,
    activeThreadRootRef,
    threadMessages,
    setThreadMessages,
    openThread,
    closeThread,
    sendThreadReply,
  };
}

