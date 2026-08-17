import { act, renderHook } from '@testing-library/react';
import { useChatRooms } from './useChatRooms';
import * as chatApi from '@/services/chat-service';
import { initializeSessionCacheForCurrentAuth, clearAllSessionCacheData } from '@/lib/session-cache';

jest.mock('@/services/chat-service', () => ({
  fetchRooms: jest.fn(),
  createRoomRest: jest.fn(),
  deleteRoomRest: jest.fn(),
  updateRoomMetaRest: jest.fn(),
  pinRoomMessageRest: jest.fn(),
}));

describe('useChatRooms', () => {
  const fetchRoomsMock = chatApi.fetchRooms as jest.Mock;
  const deleteRoomRestMock = chatApi.deleteRoomRest as jest.Mock;
  const mockJwt = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(JSON.stringify({ sub: 'alice', userId: 1 }))}.sig`;

  beforeEach(() => {
    jest.clearAllMocks();
    clearAllSessionCacheData();
    initializeSessionCacheForCurrentAuth(mockJwt);
    fetchRoomsMock.mockResolvedValue([]);
    deleteRoomRestMock.mockResolvedValue(undefined);
  });

  it('deletes a room without using browser confirm dialog', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm');
    const { result } = renderHook(() => useChatRooms('42'));

    await act(async () => {
      await result.current.deleteRoom(7);
    });

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(deleteRoomRestMock).toHaveBeenCalledWith('42', 7);
    expect(fetchRoomsMock).toHaveBeenCalledTimes(1);

    confirmSpy.mockRestore();
  });

  it('creates a room and updates the room list and session cache', async () => {
    const createRoomRestMock = chatApi.createRoomRest as jest.Mock;
    createRoomRestMock.mockResolvedValue({
      id: 101,
      projectId: 42,
      name: 'engineering',
      createdBy: 'alice',
    });

    const { result } = renderHook(() => useChatRooms('42'));

    let created = null;
    await act(async () => {
      created = await result.current.createRoom('engineering', ['bob'], 'alice');
    });

    expect(created).toEqual({
      id: 101,
      projectId: 42,
      name: 'engineering',
      createdBy: 'alice',
    });
    expect(createRoomRestMock).toHaveBeenCalledWith('42', 'engineering', ['bob']);
    expect(result.current.rooms).toEqual([
      {
        id: 101,
        projectId: 42,
        name: 'engineering',
        createdBy: 'alice',
      },
    ]);
  });

  it('creates a room without any additional members', async () => {
    const createRoomRestMock = chatApi.createRoomRest as jest.Mock;
    createRoomRestMock.mockResolvedValue({
      id: 102,
      projectId: 42,
      name: 'announcements',
      createdBy: 'alice',
    });

    const { result } = renderHook(() => useChatRooms('42'));

    let created = null;
    await act(async () => {
      created = await result.current.createRoom('announcements', [], 'alice');
    });

    expect(created).toEqual({
      id: 102,
      projectId: 42,
      name: 'announcements',
      createdBy: 'alice',
    });
    expect(createRoomRestMock).toHaveBeenCalledWith('42', 'announcements', []);
    expect(result.current.rooms).toEqual([
      {
        id: 102,
        projectId: 42,
        name: 'announcements',
        createdBy: 'alice',
      },
    ]);
  });

  it('serves loadRooms from cache unless forceRefresh is true', async () => {
    fetchRoomsMock.mockResolvedValue([
      { id: 1, projectId: 42, name: 'general', createdBy: 'alice' },
    ]);

    const { result } = renderHook(() => useChatRooms('42'));

    // First load fetches from network and populates cache
    await act(async () => {
      await result.current.loadRooms();
    });
    expect(fetchRoomsMock).toHaveBeenCalledTimes(1);

    // Second load should serve from cache without calling fetchRooms again
    await act(async () => {
      await result.current.loadRooms();
    });
    expect(fetchRoomsMock).toHaveBeenCalledTimes(1);

    // With forceRefresh: true, it must re-fetch from network
    await act(async () => {
      await result.current.loadRooms({ forceRefresh: true });
    });
    expect(fetchRoomsMock).toHaveBeenCalledTimes(2);
  });

  it('keeps error handling when room deletion fails', async () => {
    const deletionError = new Error('delete failed');
    deleteRoomRestMock.mockRejectedValueOnce(deletionError);
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const { result } = renderHook(() => useChatRooms('42'));

    await act(async () => {
      await result.current.deleteRoom(8);
    });

    expect(consoleSpy).toHaveBeenCalledWith('Failed to delete room', deletionError);
    expect(fetchRoomsMock).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
