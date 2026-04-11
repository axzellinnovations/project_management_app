import { useState, useCallback } from 'react';
import * as chatApi from '@/services/chat-service';
import type { ChatRoom } from '@/app/(project)/project/[id]/chat/components/chat';
import { normalizeRoom } from './chat-utils';

export function useChatRooms(projectId: string) {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);

  const loadRooms = useCallback(async (): Promise<ChatRoom[]> => {
    try {
      const raw = await chatApi.fetchRooms(projectId);
      const normalized = raw
        .map((r) => normalizeRoom(r as unknown as Record<string, unknown>))
        .filter(r => Number.isFinite(r.id));
      setRooms(normalized);
      return normalized;
    } catch (err) {
      console.error('Failed to load rooms', err);
      return [];
    }
  }, [projectId]);

  const createRoom = useCallback(
    async (name: string, members: string[], currentUser: string, users: string[]): Promise<ChatRoom | null> => {
      if (!name?.trim()) return null;

      const chosenMembers = members
        .map(u => u.trim().toLowerCase())
        .filter(u => u && u !== currentUser && users.includes(u));
      if (chosenMembers.length === 0) {
        console.error('Please include at least one valid member.');
        return null;
      }

      try {
        const rawRoom = await chatApi.createRoomRest(projectId, name.trim(), chosenMembers);
        const rawObj = rawRoom as unknown as Record<string, unknown>;
        const created: ChatRoom = {
          ...(rawObj as unknown as ChatRoom),
          id: Number(rawObj.id),
          projectId: Number(rawObj.projectId),
        };
        if (!Number.isFinite(created.id)) return null;

        setRooms(prev => (prev.some(r => r.id === created.id) ? prev : [...prev, created]));
        return created;
      } catch (err) {
        console.error('Failed to create room', err);
        return null;
      }
    },
    [projectId],
  );

  const deleteRoom = useCallback(
    async (roomId: number) => {
      try {
        await chatApi.deleteRoomRest(projectId, roomId);
        await loadRooms();
      } catch (err) {
        console.error('Failed to delete room', err);
      }
    },
    [projectId, loadRooms],
  );

  const updateRoomMeta = useCallback(
    async (roomId: number, updates: { name?: string; topic?: string; description?: string }) => {
      try {
        const raw = await chatApi.updateRoomMetaRest(projectId, roomId, updates);
        const updated = normalizeRoom(raw as unknown as Record<string, unknown>);
        setRooms(prev => prev.map(r => (r.id === updated.id ? updated : r)));
        return updated;
      } catch (err) {
        console.error('Failed to update room metadata', err);
        return null;
      }
    },
    [projectId],
  );

  const pinRoomMessage = useCallback(
    async (roomId: number, messageId: number | null) => {
      try {
        const raw = await chatApi.pinRoomMessageRest(projectId, roomId, messageId);
        const updated = normalizeRoom(raw as unknown as Record<string, unknown>);
        setRooms(prev => prev.map(r => (r.id === updated.id ? updated : r)));
        return updated;
      } catch (err) {
        console.error('Failed to pin room message', err);
        return null;
      }
    },
    [projectId],
  );

  return {
    rooms,
    setRooms,
    loadRooms,
    createRoom,
    deleteRoom,
    updateRoomMeta,
    pinRoomMessage,
  };
}

