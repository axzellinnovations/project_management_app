import { useState, useCallback } from 'react';
import * as chatApi from '@/services/chat-service';
import { buildSessionCacheKey, getSessionCache, setSessionCache } from '@/lib/session-cache';
import type {
  ChatMessage,
  DirectChatSummary,
  RoomChatSummary,
  UnreadBadgeSummary,
} from '@/app/(project)/project/[id]/chat/components/chat';

const CHAT_SUMMARIES_TTL_MS = 5 * 60_000;
const chatSummariesCache = new Map<string, { timestamp: number; data: chatApi.ChatSummaries }>();
const CHAT_UNREAD_BADGE_TTL_MS = 60_000;

function updateCachedSummaries(
  projectId: string,
  updater: (summaries: chatApi.ChatSummaries) => chatApi.ChatSummaries,
) {
  const cached = chatSummariesCache.get(projectId);
  if (!cached?.data) return;
  const next = updater(cached.data);
  chatSummariesCache.set(projectId, { timestamp: Date.now(), data: next });
  const summariesCacheKey = buildSessionCacheKey('chat-summaries', [projectId]);
  if (summariesCacheKey) {
    setSessionCache(summariesCacheKey, next, CHAT_SUMMARIES_TTL_MS);
  }
}

function applySummariesState(
  summaries: chatApi.ChatSummaries,
  setTeamUnseenCount: React.Dispatch<React.SetStateAction<number>>,
  setPrivateUnseenCounts: React.Dispatch<React.SetStateAction<Record<string, number>>>,
  setRoomUnseenCounts: React.Dispatch<React.SetStateAction<Record<number, number>>>,
  setUnreadBadge: React.Dispatch<React.SetStateAction<UnreadBadgeSummary>>,
  setPrivateLastMessages: React.Dispatch<React.SetStateAction<Record<string, ChatMessage | null>>>,
  setRoomLastMessages: React.Dispatch<React.SetStateAction<Record<number, ChatMessage | null>>>,
) {
  const { directSummaries, roomSummaries, teamSummary } = summaries;

  setTeamUnseenCount(Number(teamSummary?.unseenCount) || 0);
  setPrivateUnseenCounts(
    Object.fromEntries(
      directSummaries.map((s: DirectChatSummary) => [s.username.toLowerCase(), Number(s.unseenCount) || 0]),
    ),
  );
  setRoomUnseenCounts(
    Object.fromEntries(
      roomSummaries.map((s: RoomChatSummary) => [Number(s.roomId), Number(s.unseenCount) || 0]),
    ),
  );

  const directUnread = directSummaries.reduce((a: number, s: DirectChatSummary) => a + (Number(s.unseenCount) || 0), 0);
  const roomUnread = roomSummaries.reduce((a: number, s: RoomChatSummary) => a + (Number(s.unseenCount) || 0), 0);
  const teamUnread = Number(teamSummary?.unseenCount) || 0;
  setUnreadBadge({
    teamUnread,
    roomsUnread: roomUnread,
    directsUnread: directUnread,
    totalUnread: teamUnread + roomUnread + directUnread,
  });

  setPrivateLastMessages(
    Object.fromEntries(
      directSummaries.map((s: DirectChatSummary) => [
        s.username.toLowerCase(),
        s.lastMessage
          ? {
              sender: s.lastMessageSender || s.username.toLowerCase(),
              content: s.lastMessage,
              timestamp: s.lastMessageTimestamp || undefined,
            }
          : null,
      ]),
    ),
  );

  setRoomLastMessages(
    Object.fromEntries(
      roomSummaries.map((s: RoomChatSummary) => [
        Number(s.roomId),
        s.lastMessage
          ? {
              sender: s.lastMessageSender || '',
              content: s.lastMessage,
              timestamp: s.lastMessageTimestamp || undefined,
              roomId: Number(s.roomId),
            }
          : null,
      ]),
    ),
  );
}

export function useChatUnread(projectId: string) {
  const [teamUnseenCount, setTeamUnseenCount] = useState(0);
  const [privateUnseenCounts, setPrivateUnseenCounts] = useState<Record<string, number>>({});
  const [roomUnseenCounts, setRoomUnseenCounts] = useState<Record<number, number>>({});
  const [roomMentionCounts, setRoomMentionCounts] = useState<Record<number, number>>({});
  const [teamMentionCount, setTeamMentionCount] = useState(0);
  const [unreadBadge, setUnreadBadge] = useState<UnreadBadgeSummary>({
    teamUnread: 0,
    roomsUnread: 0,
    directsUnread: 0,
    totalUnread: 0,
  });

  const markTeamAsRead = useCallback(async () => {
    setTeamUnseenCount(0);
    setUnreadBadge((prev) => {
      const roomsUnread = Number(prev.roomsUnread) || 0;
      const directsUnread = Number(prev.directsUnread) || 0;
      return {
        teamUnread: 0,
        roomsUnread,
        directsUnread,
        totalUnread: roomsUnread + directsUnread,
      };
    });
    try {
      await chatApi.markTeamAsRead(projectId);
    } catch {
      // non-critical
    }
  }, [projectId]);

  const clearRoomUnread = useCallback((roomId: number) => {
    setRoomUnseenCounts((prev) => {
      const current = Number(prev[roomId]) || 0;
      if (current <= 0) return prev;
      const next = { ...prev, [roomId]: 0 };
      setUnreadBadge((badgePrev) => {
        const teamUnread = Number(badgePrev.teamUnread) || 0;
        const directsUnread = Number(badgePrev.directsUnread) || 0;
        const roomsUnread = Math.max(0, (Number(badgePrev.roomsUnread) || 0) - current);
        return {
          teamUnread,
          roomsUnread,
          directsUnread,
          totalUnread: teamUnread + roomsUnread + directsUnread,
        };
      });
      updateCachedSummaries(projectId, (summaries) => ({
        ...summaries,
        roomSummaries: summaries.roomSummaries.map((room) =>
          Number(room.roomId) === roomId ? { ...room, unseenCount: 0 } : room,
        ),
      }));
      return next;
    });
  }, [projectId]);

  const clearPrivateUnread = useCallback((participant: string) => {
    const key = participant.toLowerCase();
    setPrivateUnseenCounts((prev) => {
      const current = Number(prev[key]) || 0;
      if (current <= 0) return prev;
      const next = { ...prev, [key]: 0 };
      setUnreadBadge((badgePrev) => {
        const teamUnread = Number(badgePrev.teamUnread) || 0;
        const roomsUnread = Number(badgePrev.roomsUnread) || 0;
        const directsUnread = Math.max(0, (Number(badgePrev.directsUnread) || 0) - current);
        return {
          teamUnread,
          roomsUnread,
          directsUnread,
          totalUnread: teamUnread + roomsUnread + directsUnread,
        };
      });
      const normalizedParticipant = participant.toLowerCase();
      updateCachedSummaries(projectId, (summaries) => ({
        ...summaries,
        directSummaries: summaries.directSummaries.map((direct) =>
          direct.username.toLowerCase() === normalizedParticipant
            ? { ...direct, unseenCount: 0 }
            : direct,
        ),
      }));
      return next;
    });
  }, [projectId]);

  const loadUnreadBadge = useCallback(async () => {
    const badgeCacheKey = buildSessionCacheKey('chat-unread-badge', [projectId]);
    if (badgeCacheKey) {
      const cachedBadge = getSessionCache<UnreadBadgeSummary>(badgeCacheKey, { allowStale: true });
      if (cachedBadge.data) {
        setUnreadBadge({
          teamUnread: Number(cachedBadge.data.teamUnread) || 0,
          roomsUnread: Number(cachedBadge.data.roomsUnread) || 0,
          directsUnread: Number(cachedBadge.data.directsUnread) || 0,
          totalUnread: Number(cachedBadge.data.totalUnread) || 0,
        });
        if (!cachedBadge.isStale) {
          return;
        }
      }
    }

    try {
      const badge = await chatApi.fetchUnreadBadge(projectId);
      const normalizedBadge = {
        teamUnread: Number(badge.teamUnread) || 0,
        roomsUnread: Number(badge.roomsUnread) || 0,
        directsUnread: Number(badge.directsUnread) || 0,
        totalUnread: Number(badge.totalUnread) || 0,
      };
      setUnreadBadge(normalizedBadge);
      if (badgeCacheKey) {
        setSessionCache(badgeCacheKey, normalizedBadge, CHAT_UNREAD_BADGE_TTL_MS);
      }
    } catch {
      // silently ignore
    }
  }, [projectId]);

  const loadSummaries = useCallback(
    async (
      setPrivateLastMessages: React.Dispatch<React.SetStateAction<Record<string, ChatMessage | null>>>,
      setRoomLastMessages: React.Dispatch<React.SetStateAction<Record<number, ChatMessage | null>>>,
    ) => {
      const cached = chatSummariesCache.get(projectId);
      const isCacheFresh = Boolean(cached && Date.now() - cached.timestamp < CHAT_SUMMARIES_TTL_MS);
      const summariesCacheKey = buildSessionCacheKey('chat-summaries', [projectId]);

      if (!cached && summariesCacheKey) {
        const persisted = getSessionCache<chatApi.ChatSummaries>(summariesCacheKey, { allowStale: true });
        if (persisted.data) {
          chatSummariesCache.set(projectId, {
            timestamp: persisted.isStale ? 0 : Date.now(),
            data: persisted.data,
          });
        }
      }

      const activeCache = chatSummariesCache.get(projectId);
      const hasFreshCache = Boolean(activeCache && Date.now() - activeCache.timestamp < CHAT_SUMMARIES_TTL_MS);

      if (activeCache) {
        applySummariesState(
          activeCache.data,
          setTeamUnseenCount,
          setPrivateUnseenCounts,
          setRoomUnseenCounts,
          setUnreadBadge,
          setPrivateLastMessages,
          setRoomLastMessages,
        );
      }

      if (isCacheFresh || hasFreshCache) {
        return;
      }

      try {
        const summaries = await chatApi.fetchChatSummaries(projectId);
        chatSummariesCache.set(projectId, { timestamp: Date.now(), data: summaries });
        if (summariesCacheKey) {
          setSessionCache(summariesCacheKey, summaries, CHAT_SUMMARIES_TTL_MS);
        }
        applySummariesState(
          summaries,
          setTeamUnseenCount,
          setPrivateUnseenCounts,
          setRoomUnseenCounts,
          setUnreadBadge,
          setPrivateLastMessages,
          setRoomLastMessages,
        );
      } catch (err) {
        if (!activeCache) {
          console.error('Error fetching chat summaries:', err);
        }
      }
    },
    [projectId],
  );

  return {
    teamUnseenCount,
    setTeamUnseenCount,
    privateUnseenCounts,
    setPrivateUnseenCounts,
    roomUnseenCounts,
    setRoomUnseenCounts,
    roomMentionCounts,
    setRoomMentionCounts,
    teamMentionCount,
    setTeamMentionCount,
    unreadBadge,
    setUnreadBadge,
    markTeamAsRead,
    clearRoomUnread,
    clearPrivateUnread,
    loadUnreadBadge,
    loadSummaries,
  };
}

