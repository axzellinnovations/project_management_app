import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  GlobalNotificationProvider,
  useGlobalNotifications,
} from '@/components/providers/GlobalNotificationProvider';
import type { Notification } from '@/services/notifications-service';
import * as notificationsApi from '@/services/notifications-service';
import { toast } from '@/components/ui/Toast';

let currentPathname = '/dashboard';

jest.mock('next/navigation', () => ({
  usePathname: () => currentPathname,
}));

jest.mock('sockjs-client', () => jest.fn(() => ({})));

type SubscriptionPayload = { body: string };
let notificationHandler: ((payload: SubscriptionPayload) => void) | null = null;

const stompClient = {
  connected: true,
  debug: jest.fn(),
  reconnect_delay: 0,
  connect: jest.fn((_: unknown, onConnect: () => void) => onConnect()),
  subscribe: jest.fn((_: string, callback: (payload: SubscriptionPayload) => void) => {
    notificationHandler = callback;
    return { unsubscribe: jest.fn() };
  }),
  disconnect: jest.fn(),
};

jest.mock('@stomp/stompjs', () => ({
  Stomp: {
    over: jest.fn(() => stompClient),
  },
}));

jest.mock('@/services/notifications-service', () => ({
  fetchNotifications: jest.fn(),
  fetchUnreadCount: jest.fn(),
  markNotificationRead: jest.fn(),
  markAllNotificationsRead: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  getValidToken: jest.fn(),
}));

jest.mock('@/components/ui/Toast', () => ({
  toast: jest.fn(),
}));

import { getValidToken } from '@/lib/auth';

const mockedApi = notificationsApi as jest.Mocked<typeof notificationsApi>;
const mockedToast = toast as jest.MockedFunction<typeof toast>;
const mockedGetValidToken = getValidToken as jest.Mock;

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
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useGlobalNotifications();

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
    </div>
  );
}

describe('GlobalNotificationProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    notificationHandler = null;
    currentPathname = '/dashboard';
    window.localStorage.clear();
    mockedGetValidToken.mockReturnValue('fake-token');

    mockedApi.fetchNotifications.mockResolvedValue([]);
    mockedApi.fetchUnreadCount.mockResolvedValue(0);
    mockedApi.markNotificationRead.mockResolvedValue(undefined);
    mockedApi.markAllNotificationsRead.mockResolvedValue(undefined);
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

    expect(stompClient.connect).toHaveBeenCalledWith(
      { Authorization: 'Bearer fake-token' },
      expect.any(Function),
      expect.any(Function)
    );
    expect(stompClient.subscribe).toHaveBeenCalledWith('/user/queue/notifications', expect.any(Function));
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
    currentPathname = '/project/8/chat';

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
});
