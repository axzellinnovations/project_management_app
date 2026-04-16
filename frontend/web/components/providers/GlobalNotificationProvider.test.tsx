import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  GlobalNotificationProvider,
  useGlobalNotifications,
} from '@/components/providers/GlobalNotificationProvider';
import type { Notification } from '@/services/notifications-service';
import * as notificationsApi from '@/services/notifications-service';
import { toast } from '@/components/ui/Toast';
import { AUTH_TOKEN_CHANGED_EVENT } from '@/lib/auth';

let currentPathname = '/dashboard';
let currentQueryString = '';

jest.mock('next/navigation', () => ({
  usePathname: () => currentPathname,
  useSearchParams: () => new URLSearchParams(currentQueryString),
}));

jest.mock('sockjs-client', () => jest.fn(() => ({})));

type SubscriptionPayload = { body: string };
let notificationHandler: ((payload: SubscriptionPayload) => void) | null = null;

let stompClientOnConnect: (() => void) | null = null;
const stompClient = {
  connected: true,
  debug: jest.fn(),
  reconnect_delay: 0,
  subscribe: jest.fn((_: string, callback: (payload: SubscriptionPayload) => void) => {
    notificationHandler = callback;
    return { unsubscribe: jest.fn() };
  }),
  disconnect: jest.fn(),
  activate: jest.fn(function () {
    if (stompClientOnConnect) stompClientOnConnect();
  }),
  deactivate: jest.fn(),
};

const ClientMock = function (options: Record<string, unknown>) {
  stompClientOnConnect = options.onConnect;
  return stompClient;
};

jest.mock('@stomp/stompjs', () => ({
  Client: jest.fn((options) => ClientMock(options)),
}));

jest.mock('@/services/notifications-service', () => ({
  fetchNotifications: jest.fn(),
  fetchUnreadCount: jest.fn(),
  markNotificationRead: jest.fn(),
  markAllNotificationsRead: jest.fn(),
  deleteNotification: jest.fn(),
  deleteAllNotifications: jest.fn(),
}));

jest.mock('@/components/ui/Toast', () => ({
  toast: jest.fn(),
}));

const mockedApi = notificationsApi as jest.Mocked<typeof notificationsApi>;
const mockedToast = toast as jest.MockedFunction<typeof toast>;

function setRoute(pathname: string, query = '') {
  currentPathname = pathname;
  currentQueryString = query;
  const suffix = query ? `?${query}` : '';
  window.history.replaceState({}, '', `${pathname}${suffix}`);
}

const buildMockJwt = (overrides: Record<string, unknown> = {}) => {
  const header = window.btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = window.btoa(
    JSON.stringify({
      sub: 'tester@example.com',
      username: 'tester',
      exp: Math.floor(Date.now() / 1000) + 3600,
      ...overrides,
    })
  );
  return `${header}.${payload}.signature`;
};

const buildNotification = (
  id: number,
  read = false,
  link = '/project/8/chat',
  message = 'Notification'
): Notification => ({
  id,
  message,
  type: 'INFO',
  read,
  createdAt: '2026-04-04T10:00:00.000Z',
  link,
});

function TestConsumer() {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotificationById,
    deleteAllNotifications,
  } = useGlobalNotifications();

  return (
    <div>
      <div data-testid="unread-count">{unreadCount}</div>
      <div data-testid="notification-count">{notifications.length}</div>
      <ul>
        {notifications.map((item) => (
          <li key={item.id}>{`${item.id}:${item.read ? 'read' : 'unread'}`}</li>
        ))}
      </ul>
      <button onClick={() => void markAsRead(1)}>mark-one</button>
      <button onClick={() => void markAllAsRead()}>mark-all</button>
      <button onClick={() => void deleteNotificationById(1)}>delete-one</button>
      <button onClick={() => void deleteAllNotifications()}>delete-all</button>
    </div>
  );
}

describe('GlobalNotificationProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    notificationHandler = null;
    setRoute('/dashboard', '');
    window.localStorage.clear();
    window.localStorage.setItem('token', buildMockJwt());

    mockedApi.fetchNotifications.mockResolvedValue([]);
    mockedApi.fetchUnreadCount.mockResolvedValue(0);
    mockedApi.markNotificationRead.mockResolvedValue(undefined);
    mockedApi.markAllNotificationsRead.mockResolvedValue(undefined);
    mockedApi.deleteNotification.mockResolvedValue(undefined);
    mockedApi.deleteAllNotifications.mockResolvedValue([]);
  });

  it('hydrates initial notifications and unread count then subscribes for realtime updates', async () => {
    mockedApi.fetchNotifications.mockResolvedValue([
      buildNotification(1, false),
      buildNotification(2, true, '/members/8'),
    ]);
    mockedApi.fetchUnreadCount.mockResolvedValue(1);

    render(
      <GlobalNotificationProvider>
        <TestConsumer />
      </GlobalNotificationProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('unread-count')).toHaveTextContent('1');
      expect(screen.getByTestId('notification-count')).toHaveTextContent('2');
    });

    expect(stompClient.activate).toHaveBeenCalled();
    expect(stompClient.subscribe).toHaveBeenCalledWith('/user/queue/notifications', expect.any(Function));
  });

  it('connects when token becomes available after mount', async () => {
    window.localStorage.removeItem('token');

    render(
      <GlobalNotificationProvider>
        <TestConsumer />
      </GlobalNotificationProvider>
    );



    act(() => {
      window.localStorage.setItem('token', buildMockJwt({ sub: 'late@example.com', username: 'late' }));
      window.dispatchEvent(new Event(AUTH_TOKEN_CHANGED_EVENT));
    });

    await waitFor(() => {
      expect(stompClient.activate).toHaveBeenCalled();
    });
  });

  it('adds incoming notification, increments unread, and shows toast when user is on another page', async () => {
    render(
      <GlobalNotificationProvider>
        <TestConsumer />
      </GlobalNotificationProvider>
    );

    await waitFor(() => {
      expect(notificationHandler).not.toBeNull();
    });

    act(() => {
      notificationHandler?.({ body: JSON.stringify(buildNotification(10, false, '/project/8/chat', 'New chat message')) });
    });

    await waitFor(() => {
      expect(screen.getByTestId('notification-count')).toHaveTextContent('1');
      expect(screen.getByTestId('unread-count')).toHaveTextContent('1');
      expect(screen.getByText('10:unread')).toBeInTheDocument();
    });

    expect(mockedToast).toHaveBeenCalledWith('New chat message', 'info', 5000);
    expect(mockedApi.markNotificationRead).not.toHaveBeenCalled();
  });

  it('marks notification as read immediately when user is already on the linked page', async () => {
    setRoute('/project/8/chat', '');

    render(
      <GlobalNotificationProvider>
        <TestConsumer />
      </GlobalNotificationProvider>
    );

    await waitFor(() => {
      expect(notificationHandler).not.toBeNull();
    });

    act(() => {
      notificationHandler?.({ body: JSON.stringify(buildNotification(11, false, '/project/8/chat', 'In-page event')) });
    });

    await waitFor(() => {
      expect(screen.getByText('11:read')).toBeInTheDocument();
      expect(screen.getByTestId('unread-count')).toHaveTextContent('0');
    });

    expect(mockedApi.markNotificationRead).toHaveBeenCalledWith(11);
    expect(mockedToast).not.toHaveBeenCalled();
  });

  it('does not auto-read generic chat notification when user is on a scoped chat query', async () => {
    setRoute('/project/8/chat', 'with=bob');

    render(
      <GlobalNotificationProvider>
        <TestConsumer />
      </GlobalNotificationProvider>
    );

    await waitFor(() => {
      expect(notificationHandler).not.toBeNull();
    });

    act(() => {
      notificationHandler?.({ body: JSON.stringify(buildNotification(12, false, '/project/8/chat', 'Generic chat event')) });
    });

    await waitFor(() => {
      expect(screen.getByText('12:unread')).toBeInTheDocument();
      expect(screen.getByTestId('unread-count')).toHaveTextContent('1');
    });

    expect(mockedApi.markNotificationRead).not.toHaveBeenCalledWith(12);
    expect(mockedToast).toHaveBeenCalledWith('Generic chat event', 'info', 5000);
  });

  it('auto-reads chat notification when query-scoped link matches active conversation', async () => {
    setRoute('/project/8/chat', 'with=bob');

    render(
      <GlobalNotificationProvider>
        <TestConsumer />
      </GlobalNotificationProvider>
    );

    await waitFor(() => {
      expect(notificationHandler).not.toBeNull();
    });

    act(() => {
      notificationHandler?.({ body: JSON.stringify(buildNotification(13, false, '/project/8/chat?with=bob', 'Matched private chat event')) });
    });

    await waitFor(() => {
      expect(screen.getByText('13:read')).toBeInTheDocument();
    });

    expect(mockedApi.markNotificationRead).toHaveBeenCalledWith(13);
    expect(mockedToast).not.toHaveBeenCalled();
  });

  it('prevents duplicate notification entries by id', async () => {
    render(
      <GlobalNotificationProvider>
        <TestConsumer />
      </GlobalNotificationProvider>
    );

    await waitFor(() => {
      expect(notificationHandler).not.toBeNull();
    });

    act(() => {
      notificationHandler?.({ body: JSON.stringify(buildNotification(25, false, '/project/8/chat', 'Duplicate test')) });
      notificationHandler?.({ body: JSON.stringify(buildNotification(25, false, '/project/8/chat', 'Duplicate test')) });
    });

    await waitFor(() => {
      expect(screen.getByTestId('notification-count')).toHaveTextContent('1');
    });
  });

  it('supports markAsRead and markAllAsRead actions via context', async () => {
    mockedApi.fetchNotifications.mockResolvedValue([
      buildNotification(1, false, '/project/8/chat', 'First'),
      buildNotification(2, false, '/members/8', 'Second'),
    ]);
    mockedApi.fetchUnreadCount.mockResolvedValue(2);

    render(
      <GlobalNotificationProvider>
        <TestConsumer />
      </GlobalNotificationProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('unread-count')).toHaveTextContent('2');
      expect(screen.getByText('1:unread')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('mark-one'));

    await waitFor(() => {
      expect(mockedApi.markNotificationRead).toHaveBeenCalledWith(1);
      expect(screen.getByText('1:read')).toBeInTheDocument();
      expect(screen.getByTestId('unread-count')).toHaveTextContent('1');
    });

    fireEvent.click(screen.getByText('mark-all'));

    await waitFor(() => {
      expect(mockedApi.markAllNotificationsRead).toHaveBeenCalledTimes(1);
      expect(screen.getByText('2:read')).toBeInTheDocument();
      expect(screen.getByTestId('unread-count')).toHaveTextContent('0');
    });
  });

  it('supports deleting one notification via context', async () => {
    mockedApi.fetchNotifications.mockResolvedValue([
      buildNotification(1, false, '/project/8/chat', 'First'),
      buildNotification(2, true, '/members/8', 'Second'),
    ]);
    mockedApi.fetchUnreadCount.mockResolvedValue(1);

    render(
      <GlobalNotificationProvider>
        <TestConsumer />
      </GlobalNotificationProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('notification-count')).toHaveTextContent('2');
      expect(screen.getByTestId('unread-count')).toHaveTextContent('1');
    });

    fireEvent.click(screen.getByText('delete-one'));

    await waitFor(() => {
      expect(mockedApi.deleteNotification).toHaveBeenCalledWith(1);
      expect(screen.getByTestId('notification-count')).toHaveTextContent('1');
      expect(screen.getByTestId('unread-count')).toHaveTextContent('0');
    });
  });

  it('supports deleting all notifications via context', async () => {
    mockedApi.fetchNotifications.mockResolvedValue([
      buildNotification(1, false, '/project/8/chat', 'First'),
      buildNotification(2, true, '/members/8', 'Second'),
      buildNotification(3, false, '/project/8/tasks', 'Third'),
    ]);
    mockedApi.fetchUnreadCount.mockResolvedValue(2);
    mockedApi.deleteAllNotifications.mockResolvedValue([
      { status: 'fulfilled', value: undefined },
      { status: 'fulfilled', value: undefined },
      { status: 'rejected', reason: new Error('Delete failed') },
    ]);

    render(
      <GlobalNotificationProvider>
        <TestConsumer />
      </GlobalNotificationProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('notification-count')).toHaveTextContent('3');
    });

    fireEvent.click(screen.getByText('delete-all'));

    await waitFor(() => {
      expect(mockedApi.deleteAllNotifications).toHaveBeenCalledWith([1, 2, 3]);
      expect(screen.getByTestId('notification-count')).toHaveTextContent('1');
      expect(screen.getByTestId('unread-count')).toHaveTextContent('1');
      expect(screen.getByText('3:unread')).toBeInTheDocument();
    });
  });
});
