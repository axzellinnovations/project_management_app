import { useState, useCallback, useRef } from 'react';
import * as chatApi from '@/services/chat-service';
import type { ChatReactionSummary, ChatMessage } from '@/app/(project)/project/[id]/chat/components/chat';
import { MAX_REACTION_HYDRATION_MESSAGES, REACTION_RETRY_BACKOFF_MS } from './chat-utils';

export function useChatReactions(projectId: string) {
  const [messageReactions, setMessageReactions] = useState<Record<number, ChatReactionSummary[]>>({});
  const lastReactionRetryRef = useRef<Record<number, number>>({});

  const loadMessageReactions = useCallback(
    async (messageId: number) => {
      const now = Date.now();
      const lastRetry = lastReactionRetryRef.current[messageId] || 0;
      if (now - lastRetry < REACTION_RETRY_BACKOFF_MS) return;
      lastReactionRetryRef.current[messageId] = now;

      try {
        const reactions = await chatApi.fetchMessageReactions(projectId, messageId);
        setMessageReactions(prev => ({ ...prev, [messageId]: reactions }));
      } catch {
        // silently ignore failed reaction loads
      }
    },
    [projectId],
  );

  const hydrateReactions = useCallback(
    (messages: ChatMessage[]) => {
      const targets = messages.filter(m => m.id).slice(-MAX_REACTION_HYDRATION_MESSAGES);
      targets.forEach(msg => {
        if (msg.id) loadMessageReactions(msg.id);
      });
    },
    [loadMessageReactions],
  );

  const toggleReaction = useCallback(
    async (
      messageId: number,
      emoji: string,
      stompSend?: (dest: string, body: string) => void,
    ) => {
      const trimmed = emoji.trim();
      if (!trimmed) return;

      if (stompSend) {
        stompSend(
          `/app/project/${projectId}/messages/${messageId}/reaction.toggle`,
          JSON.stringify({ emoji: trimmed }),
        );
        return;
      }

      try {
        const reactions = await chatApi.toggleReactionRest(projectId, messageId, trimmed);
        setMessageReactions(prev => ({ ...prev, [messageId]: reactions }));
      } catch (err) {
        console.error('Failed to toggle reaction', err);
      }
    },
    [projectId],
  );

  return {
    messageReactions,
    setMessageReactions,
    toggleReaction,
    loadMessageReactions,
    hydrateReactions,
  };
}

