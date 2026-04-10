import { useState, useCallback } from 'react';
import * as chatApi from '@/services/chat-service';
import type {
  ChatMessage,
  DirectChatSummary,
  RoomChatSummary,
  UnreadBadgeSummary,
} from '@/app/(project)/project/[id]/chat/components/chat';

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
    try {
      await chatApi.markTeamAsRead(projectId);
    } catch {
      // non-critical
    }
  }, [projectId]);

  const loadUnreadBadge = useCallback(async () => {
    try {
      const badge = await chatApi.fetchUnreadBadge(projectId);
      setUnreadBadge({
        teamUnread: Number(badge.teamUnread) || 0,
        roomsUnread: Number(badge.roomsUnread) || 0,
        directsUnread: Number(badge.directsUnread) || 0,
        totalUnread: Number(badge.totalUnread) || 0,
      });
    } catch {
      // silently ignore
    }
  }, [projectId]);

  const loadSummaries = useCallback(
    async (
      setPrivateLastMessages: React.Dispatch<React.SetStateAction<Record<string, ChatMessage | null>>>,
      setRoomLastMessages: React.Dispatch<React.SetStateAction<Record<number, ChatMessage | null>>>,
    ) => {
      try {
        const { directSummaries, roomSummaries, teamSummary } =
          await chatApi.fetchChatSummaries(projectId);

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
      } catch (err) {
        console.error('Error fetching chat summaries:', err);
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
    loadUnreadBadge,
    loadSummaries,
  };
}

