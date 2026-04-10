import { useState, useCallback } from 'react';
import * as chatApi from '@/services/chat-service';

export function useChatPresence(projectId: string) {
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [teamTypingUsers, setTeamTypingUsers] = useState<string[]>([]);
  const [privateTypingUsers, setPrivateTypingUsers] = useState<string[]>([]);
  const [roomTypingUsers, setRoomTypingUsers] = useState<Record<number, string[]>>({});

  const loadPresence = useCallback(async () => {
    try {
      const data = await chatApi.fetchPresence(projectId);
      setOnlineUsers((data.onlineUsers || []).map(u => u.toLowerCase()));
    } catch (err) {
      console.error('Failed to load presence', err);
    }
  }, [projectId]);

  const sendTyping = useCallback(
    (
      scope: 'TEAM' | 'ROOM' | 'PRIVATE',
      typing: boolean,
      stompSend: (dest: string, body: string) => void,
      currentUser: string,
      opts?: { recipientUsername?: string; roomId?: number },
    ) => {
      stompSend(
        `/app/project/${projectId}/typing.notify`,
        JSON.stringify({
          sender: currentUser,
          scope,
          typing,
          roomId: opts?.roomId ?? null,
          recipient: opts?.recipientUsername ?? null,
        }),
      );
    },
    [projectId],
  );

  return {
    onlineUsers,
    setOnlineUsers,
    teamTypingUsers,
    setTeamTypingUsers,
    privateTypingUsers,
    setPrivateTypingUsers,
    roomTypingUsers,
    setRoomTypingUsers,
    loadPresence,
    sendTyping,
  };
}
