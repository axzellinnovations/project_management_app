import { act, renderHook } from '@testing-library/react';
import { useChatRooms } from './useChatRooms';
import * as chatApi from '@/services/chat-service';

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

  beforeEach(() => {
    jest.clearAllMocks();
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
