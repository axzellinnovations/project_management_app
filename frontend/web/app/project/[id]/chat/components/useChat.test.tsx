import { act, renderHook, waitFor } from '@testing-library/react';
import { useChat } from './useChat';

const pushMock = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

jest.mock('sockjs-client', () => jest.fn(() => ({})));

const subscriptions: Record<string, (payload: { body: string }) => void> = {};

const stompClient = {
  connected: true,
  debug: jest.fn(),
  reconnect_delay: 0,
  connect: jest.fn((_: unknown, onConnect: () => void) => onConnect()),
  subscribe: jest.fn((destination: string, callback: (payload: { body: string }) => void) => {
    subscriptions[destination] = callback;
    return { unsubscribe: jest.fn() };
  }),
  send: jest.fn(),
  disconnect: jest.fn(),
};

jest.mock('@stomp/stompjs', () => ({
  Stomp: {
    over: jest.fn(() => stompClient),
  },
}));

const fetchMock = jest.fn();

const jsonResponse = (data: unknown, ok = true) =>
  Promise.resolve({
    ok,
    status: ok ? 200 : 500,
    json: async () => data,
  } as Response);

const tokenPayload = { username: 'alice', email: 'alice@example.com', sub: 'alice@example.com' };
const token = `header.${btoa(JSON.stringify(tokenPayload))}.signature`;

describe('useChat hook', () => {
  let phaseDEnabled = true;
  let consoleErrorSpy: jest.SpyInstance;

  jest.setTimeout(15000);

  const defaultFetchImplementation = (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();

    if (url.includes('/api/auth/me')) {
      return jsonResponse({ username: 'alice' });
    }

    if (url.includes('/api/projects/42/chat/members')) {
      return jsonResponse(['alice', 'bob', 'carol']);
    }

    if (url.includes('/api/auth/users')) {
      return jsonResponse([{ username: 'bob', profilePicUrl: '/avatars/bob.png' }]);
    }

    if (url.includes('/api/projects/42/chat/rooms')) {
      return jsonResponse([{ id: 1, name: 'engineering', projectId: 42, createdBy: 'alice' }]);
    }

    if (url.includes('/api/projects/42/chat/summaries')) {
      return jsonResponse({
        directMessages: [],
        rooms: [],
        team: { unseenCount: 0, lastMessage: null },
      });
    }

    if (url.includes('/api/projects/42/chat/presence')) {
      return jsonResponse({ onlineUsers: ['alice', 'bob'], onlineCount: 2 });
    }

    if (url.includes('/api/projects/42/chat/unread-badge')) {
      return jsonResponse({ teamUnread: 0, roomsUnread: 0, directsUnread: 0, totalUnread: 0 });
    }

    if (url.includes('/api/projects/42/chat/features')) {
      return jsonResponse({
        phaseDEnabled,
        phaseEEnabled: true,
        webhooksEnabled: true,
        telemetryEnabled: true,
      });
    }

    if (url.includes('/api/projects/42/chat/messages?') || url.endsWith('/api/projects/42/chat/messages')) {
      return jsonResponse([]);
    }

    if (url.includes('/api/projects/42/chat/messages/1/thread')) {
      return jsonResponse([{ id: 1, sender: 'bob', content: 'root message', type: 'CHAT' }]);
    }

    if (url.includes('/api/projects/42/chat/messages/1/thread/replies')) {
      return jsonResponse({ id: 51, sender: 'alice', content: 'thread reply', parentMessageId: 1 });
    }

    if (url.includes('/chat/search?')) {
      return jsonResponse([
        {
          messageId: 10,
          sender: 'bob',
          content: 'backend deploy complete',
          context: 'TEAM',
        },
      ]);
    }

    if (url.includes('/chat/messages/') && url.includes('/reactions')) {
      return jsonResponse([]);
    }

    if (url.includes('/chat/telemetry') || url.includes('/chat/team/read')) {
      return jsonResponse({});
    }

    return jsonResponse({});
  };

  const publish = (destination: string, body: unknown) => {
    const handler = subscriptions[destination];
    expect(handler).toBeDefined();
    act(() => {
      handler({ body: JSON.stringify(body) });
    });
  };

  const renderInitializedHook = async () => {
    const hook = renderHook(() => useChat('42'));
    await waitFor(() => {
      expect(hook.result.current.isLoading).toBe(false);
    }, { timeout: 10000 });
    return hook;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(subscriptions).forEach((key) => delete subscriptions[key]);
    stompClient.connected = true;
    phaseDEnabled = true;

    fetchMock.mockImplementation(defaultFetchImplementation);
    global.fetch = fetchMock as unknown as typeof fetch;

    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('token', token);

    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('redirects to login when token is missing', async () => {
    window.localStorage.removeItem('token');

    renderHook(() => useChat('42'));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/login');
    });
  });

  it('sends team, private, and room messages to expected realtime endpoints', async () => {
    const { result } = await renderInitializedHook();

    stompClient.send.mockClear();

    act(() => {
      result.current.sendMessage('  hello team  ');
      result.current.sendMessage('ping bob', 'bob');
      result.current.sendRoomMessage('room update', 1);
    });

    expect(stompClient.send).toHaveBeenCalledTimes(3);

    const [teamDestination, teamHeaders, teamBody] = stompClient.send.mock.calls[0];
    expect(teamDestination).toBe('/app/project/42/chat.sendMessage');
    expect(teamHeaders).toEqual({});
    expect(JSON.parse(teamBody)).toMatchObject({
      sender: 'alice',
      content: 'hello team',
      type: 'CHAT',
      formatType: 'PLAIN',
    });
    expect(JSON.parse(teamBody).timestamp).toBeTruthy();

    const [privateDestination, privateHeaders, privateBody] = stompClient.send.mock.calls[1];
    expect(privateDestination).toBe('/app/project/42/chat.sendPrivateMessage');
    expect(privateHeaders).toEqual({});
    expect(JSON.parse(privateBody)).toMatchObject({
      sender: 'alice',
      content: 'ping bob',
      recipient: 'bob',
      type: 'CHAT',
      formatType: 'PLAIN',
    });
    expect(JSON.parse(privateBody).timestamp).toBeTruthy();

    const [roomDestination, roomHeaders, roomBody] = stompClient.send.mock.calls[2];
    expect(roomDestination).toBe('/app/project/42/room/1/send');
    expect(roomHeaders).toEqual({});
    expect(JSON.parse(roomBody)).toMatchObject({
      sender: 'alice',
      content: 'room update',
      roomId: 1,
      type: 'CHAT',
      formatType: 'PLAIN',
    });
    expect(JSON.parse(roomBody).timestamp).toBeTruthy();
  });

  it('rejects blank messages and sets reconnect error when socket is unavailable', async () => {
    const { result } = await renderInitializedHook();

    stompClient.send.mockClear();

    act(() => {
      result.current.sendMessage('   ');
    });
    expect(stompClient.send).not.toHaveBeenCalled();

    stompClient.connected = false;

    act(() => {
      result.current.sendMessage('message while reconnecting');
    });

    expect(result.current.error).toBe('Realtime chat is reconnecting. Please wait a moment and try again.');
    expect(stompClient.send).not.toHaveBeenCalled();
  });

  it('receives realtime team and private messages and updates local collections', async () => {
    const { result } = await renderInitializedHook();

    publish('/topic/project/42/public', {
      id: 100,
      sender: 'bob',
      content: 'team update',
      type: 'CHAT',
      timestamp: '2026-04-02T12:00:00.000Z',
    });

    publish('/user/queue/project/42/messages', {
      id: 101,
      sender: 'bob',
      recipient: 'alice',
      content: 'private ping',
      type: 'CHAT',
      timestamp: '2026-04-02T12:01:00.000Z',
    });

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].content).toBe('team update');
      expect(result.current.privateMessages.bob).toHaveLength(1);
      expect(result.current.privateMessages.bob[0].content).toBe('private ping');
    });
  });

  it('applies room lifecycle events from realtime subscriptions', async () => {
    const { result } = await renderInitializedHook();

    publish('/topic/project/42/rooms', {
      action: 'CREATED',
      roomId: 9,
      room: { id: 9, name: 'incident-room', projectId: 42, createdBy: 'alice' },
    });

    await waitFor(() => {
      expect(result.current.rooms.some((room) => room.id === 9)).toBe(true);
    });

    publish('/topic/project/42/rooms', {
      action: 'DELETED',
      roomId: 9,
    });

    await waitFor(() => {
      expect(result.current.rooms.some((room) => room.id === 9)).toBe(false);
    });
  });

  it('tracks mention counters when user is outside the mentioned context', async () => {
    const { result } = await renderInitializedHook();

    act(() => {
      result.current.selectPrivateUser('bob');
    });

    publish('/user/queue/project/42/mentions', {
      type: 'MENTIONED',
      scope: 'TEAM',
      sender: 'carol',
      projectId: 42,
      messageId: 700,
    });

    publish('/user/queue/project/42/mentions', {
      type: 'MENTIONED',
      scope: 'ROOM',
      sender: 'carol',
      roomId: 15,
      projectId: 42,
      messageId: 701,
    });

    await waitFor(() => {
      expect(result.current.teamMentionCount).toBe(1);
      expect(result.current.roomMentionCounts[15]).toBe(1);
    });
  });

  it('searches messages when phase D is enabled', async () => {
    const { result } = await renderInitializedHook();

    await result.current.searchMessages('backend');

    await waitFor(() => {
      expect(result.current.searchResults).toHaveLength(1);
      expect(result.current.searchResults[0].content).toContain('backend');
    });
  });

  it('skips remote search requests when phase D is disabled', async () => {
    phaseDEnabled = false;
    const { result } = await renderInitializedHook();

    fetchMock.mockClear();
    await result.current.searchMessages('backend');

    expect(result.current.searchResults).toEqual([]);
    const searchCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes('/chat/search?'));
    expect(searchCalls).toHaveLength(0);
  });

  it('falls back to HTTP thread reply when realtime socket is disconnected', async () => {
    const { result } = await renderInitializedHook();

    await result.current.openThread({ id: 1, sender: 'bob', content: 'root message', type: 'CHAT' });
    await waitFor(() => {
      expect(result.current.activeThreadRoot?.id).toBe(1);
    });

    stompClient.connected = false;

    await result.current.sendThreadReply('  fallback reply  ');

    const threadReplyCalls = fetchMock.mock.calls.filter(([url, options]) =>
      String(url).includes('/chat/messages/1/thread/replies') && (options as RequestInit)?.method === 'POST'
    );

    expect(threadReplyCalls).toHaveLength(1);
  });
});
