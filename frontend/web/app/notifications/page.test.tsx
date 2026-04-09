import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import NotificationsPage from './page';
import type { Notification } from '@/services/notifications-service';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

const useGlobalNotificationsMock = jest.fn();

jest.mock('@/components/providers/GlobalNotificationProvider', () => ({
  useGlobalNotifications: () => useGlobalNotificationsMock(),
}));

const buildNotification = (
  overrides: Partial<Notification> & Pick<Notification, 'id' | 'message' | 'read' | 'createdAt'>
): Notification => ({
  id: overrides.id,
  message: overrides.message,
  read: overrides.read,
  createdAt: overrides.createdAt,
  type: overrides.type,
  link: overrides.link,
});

describe('NotificationsPage', () => {
  let confirmSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);

    useGlobalNotificationsMock.mockReturnValue({
      notifications: [],
      unreadCount: 0,
      markAsRead: jest.fn().mockResolvedValue(undefined),
      markAllAsRead: jest.fn().mockResolvedValue(undefined),
      deleteNotificationById: jest.fn().mockResolvedValue(undefined),
      deleteAllNotifications: jest.fn().mockResolvedValue({ deleted: 0, failed: 0 }),
    });
  });

  afterEach(() => {
    confirmSpy.mockRestore();
  });

  it('renders full notification details and actions', () => {
    const markAsRead = jest.fn().mockResolvedValue(undefined);

    useGlobalNotificationsMock.mockReturnValue({
      notifications: [
        buildNotification({
          id: 1,
          message: 'Alice assigned a task to you',
          type: 'TASK',
          read: false,
          createdAt: '2026-04-09T10:00:00.000Z',
          link: '/taskcard?taskId=12',
        }),
      ],
      unreadCount: 1,
      markAsRead,
      markAllAsRead: jest.fn().mockResolvedValue(undefined),
      deleteNotificationById: jest.fn().mockResolvedValue(undefined),
      deleteAllNotifications: jest.fn().mockResolvedValue({ deleted: 1, failed: 0 }),
    });

    render(<NotificationsPage />);

    expect(screen.getByRole('heading', { name: 'Notifications' })).toBeInTheDocument();
    expect(screen.getByText('Alice assigned a task to you')).toBeInTheDocument();
    expect(screen.getByText('Task')).toBeInTheDocument();
    expect(screen.getAllByText('Unread').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Open context' })).toHaveAttribute('href', '/taskcard?taskId=12');

    fireEvent.click(screen.getByRole('button', { name: 'Mark as read' }));
    expect(markAsRead).toHaveBeenCalledWith(1);
  });

  it('filters unread/read notifications', () => {
    useGlobalNotificationsMock.mockReturnValue({
      notifications: [
        buildNotification({
          id: 1,
          message: 'Unread item',
          read: false,
          createdAt: '2026-04-09T11:00:00.000Z',
          link: '/project/7/chat',
        }),
        buildNotification({
          id: 2,
          message: 'Read item',
          read: true,
          createdAt: '2026-04-08T08:00:00.000Z',
          link: '/project/7/chat',
        }),
      ],
      unreadCount: 1,
      markAsRead: jest.fn().mockResolvedValue(undefined),
      markAllAsRead: jest.fn().mockResolvedValue(undefined),
      deleteNotificationById: jest.fn().mockResolvedValue(undefined),
      deleteAllNotifications: jest.fn().mockResolvedValue({ deleted: 2, failed: 0 }),
    });

    render(<NotificationsPage />);

    expect(screen.getByText('Unread item')).toBeInTheDocument();
    expect(screen.getByText('Read item')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Unread' }));
    expect(screen.getByText('Unread item')).toBeInTheDocument();
    expect(screen.queryByText('Read item')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Read' }));
    expect(screen.getByText('Read item')).toBeInTheDocument();
    expect(screen.queryByText('Unread item')).not.toBeInTheDocument();
  });

  it('deletes a single notification and deletes all notifications', async () => {
    const deleteNotificationById = jest.fn().mockResolvedValue(undefined);
    const deleteAllNotifications = jest.fn().mockResolvedValue({ deleted: 2, failed: 0 });

    useGlobalNotificationsMock.mockReturnValue({
      notifications: [
        buildNotification({
          id: 9,
          message: 'Delete this',
          read: false,
          createdAt: '2026-04-09T11:00:00.000Z',
          link: '/project/10/chat',
        }),
      ],
      unreadCount: 1,
      markAsRead: jest.fn().mockResolvedValue(undefined),
      markAllAsRead: jest.fn().mockResolvedValue(undefined),
      deleteNotificationById,
      deleteAllNotifications,
    });

    render(<NotificationsPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalledWith('Delete this notification?');
      expect(deleteNotificationById).toHaveBeenCalledWith(9);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Delete all' }));

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalledWith('Delete all notifications? This action cannot be undone.');
      expect(deleteAllNotifications).toHaveBeenCalledTimes(1);
    });
  });

  it('shows empty state when there are no notifications', () => {
    render(<NotificationsPage />);

    expect(screen.getByText('No notifications here')).toBeInTheDocument();
    expect(screen.getByText('You are all caught up.')).toBeInTheDocument();
  });
});
