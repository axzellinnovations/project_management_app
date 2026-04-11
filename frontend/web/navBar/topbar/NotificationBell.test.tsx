import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NotificationBell } from '@/navBar/topbar/NotificationBell';
import type { Notification } from '@/services/notifications-service';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, onClick, className, children }: { href: string; onClick?: () => void; className?: string; children: React.ReactNode }) => (
    <a
      href={href}
      onClick={(event) => {
        event.preventDefault();
        onClick?.();
      }}
      className={className}
    >
      {children}
    </a>
  ),
}));

const useGlobalNotificationsMock = jest.fn();

jest.mock('@/components/providers/GlobalNotificationProvider', () => ({
  useGlobalNotifications: () => useGlobalNotificationsMock(),
}));

const buildNotification = (
  id: number,
  read = false,
  message = 'Notice',
  link = '/project/8/tasks'
): Notification => ({
  id,
  message,
  type: 'INFO',
  read,
  createdAt: '2026-04-04T10:00:00.000Z',
  link,
});

describe('NotificationBell', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useGlobalNotificationsMock.mockReturnValue({
      notifications: [],
      unreadCount: 0,
      markAsRead: jest.fn().mockResolvedValue(undefined),
      markAllAsRead: jest.fn().mockResolvedValue(undefined),
      deleteNotificationById: jest.fn().mockResolvedValue(undefined),
      deleteAllNotifications: jest.fn().mockResolvedValue({ deleted: 0, failed: 0 }),
    });
  });

  it('does not render unread badge when unread count is zero', () => {
    render(<NotificationBell />);

    expect(screen.queryByText('9+')).not.toBeInTheDocument();
  });

  it('renders unread badge as 9+ when unread count is above nine', () => {
    useGlobalNotificationsMock.mockReturnValue({
      notifications: [buildNotification(1, false)],
      unreadCount: 12,
      markAsRead: jest.fn().mockResolvedValue(undefined),
      markAllAsRead: jest.fn().mockResolvedValue(undefined),
      deleteNotificationById: jest.fn().mockResolvedValue(undefined),
      deleteAllNotifications: jest.fn().mockResolvedValue({ deleted: 1, failed: 0 }),
    });

    render(<NotificationBell />);

    expect(screen.getByText('9+')).toBeInTheDocument();
  });

  it('opens dropdown and shows empty state when there are no notifications', () => {
    render(<NotificationBell />);

    fireEvent.click(screen.getAllByRole('button')[0]);

    expect(screen.getByText('Notifications')).toBeInTheDocument();
    expect(screen.getByText('You have no notifications')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View all notifications' })).toHaveAttribute(
      'href',
      '/dashboard/notifications'
    );
  });

  it('closes dropdown when view all notifications is clicked', async () => {
    render(<NotificationBell />);

    fireEvent.click(screen.getAllByRole('button')[0]);
    fireEvent.click(screen.getByRole('link', { name: 'View all notifications' }));

    await waitFor(() => {
      expect(screen.queryByText('Notifications')).not.toBeInTheDocument();
    });
  });

  it('toggles dropdown closed when bell is clicked again', async () => {
    render(<NotificationBell />);

    fireEvent.click(screen.getAllByRole('button')[0]);
    expect(screen.getByText('Notifications')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button')[0]);

    await waitFor(() => {
      expect(screen.queryByText('Notifications')).not.toBeInTheDocument();
    });
  });

  it('closes dropdown when clicking outside', async () => {
    render(<NotificationBell />);

    fireEvent.click(screen.getAllByRole('button')[0]);
    expect(screen.getByText('Notifications')).toBeInTheDocument();

    fireEvent.mouseDown(document.body);

    await waitFor(() => {
      expect(screen.queryByText('Notifications')).not.toBeInTheDocument();
    });
  });

  it('aggregates room chat notifications into a single row with count', () => {
    useGlobalNotificationsMock.mockReturnValue({
      notifications: [
        buildNotification(1, false, 'Alice posted in #design: First update', '/project/8/chat'),
        buildNotification(2, true, 'Bob posted in #design: Second update', '/project/8/chat'),
      ],
      unreadCount: 1,
      markAsRead: jest.fn().mockResolvedValue(undefined),
      markAllAsRead: jest.fn().mockResolvedValue(undefined),
      deleteNotificationById: jest.fn().mockResolvedValue(undefined),
      deleteAllNotifications: jest.fn().mockResolvedValue({ deleted: 0, failed: 0 }),
    });

    render(<NotificationBell />);

    fireEvent.click(screen.getAllByRole('button')[0]);

    expect(screen.getByText('1 message from #design')).toBeInTheDocument();
    expect(screen.queryByText('Alice posted in #design: First update')).not.toBeInTheDocument();
    expect(screen.queryByText('Bob posted in #design: Second update')).not.toBeInTheDocument();
  });

  it('shows count as one when only the newest chat message is unread', () => {
    useGlobalNotificationsMock.mockReturnValue({
      notifications: [
        buildNotification(30, false, 'Alice sent you a message in "Apollo"', '/project/8/chat'),
        buildNotification(29, true, 'Alice sent you a message in "Apollo"', '/project/8/chat'),
        buildNotification(28, true, 'Alice sent you a message in "Apollo"', '/project/8/chat'),
      ],
      unreadCount: 1,
      markAsRead: jest.fn().mockResolvedValue(undefined),
      markAllAsRead: jest.fn().mockResolvedValue(undefined),
      deleteNotificationById: jest.fn().mockResolvedValue(undefined),
      deleteAllNotifications: jest.fn().mockResolvedValue({ deleted: 0, failed: 0 }),
    });

    render(<NotificationBell />);

    fireEvent.click(screen.getAllByRole('button')[0]);

    expect(screen.getByText('1 message from Alice')).toBeInTheDocument();
  });

  it('marks all unread notifications in an aggregated row as read when clicked', () => {
    const markAsRead = jest.fn().mockResolvedValue(undefined);
    useGlobalNotificationsMock.mockReturnValue({
      notifications: [
        buildNotification(10, false, 'Alice sent you a message in "Apollo"', '/project/8/chat'),
        buildNotification(11, false, 'Alice sent you a message in "Apollo"', '/project/8/chat'),
        buildNotification(12, true, 'Alice sent you a message in "Apollo"', '/project/8/chat'),
      ],
      unreadCount: 2,
      markAsRead,
      markAllAsRead: jest.fn().mockResolvedValue(undefined),
      deleteNotificationById: jest.fn().mockResolvedValue(undefined),
      deleteAllNotifications: jest.fn().mockResolvedValue({ deleted: 0, failed: 0 }),
    });

    render(<NotificationBell />);

    fireEvent.click(screen.getAllByRole('button')[0]);
    fireEvent.click(screen.getByText('2 messages from Alice'));

    expect(markAsRead).toHaveBeenCalledWith(10);
    expect(markAsRead).toHaveBeenCalledWith(11);
    expect(markAsRead).toHaveBeenCalledTimes(2);
  });

  it('marks a notification as read when notification link is clicked', () => {
    const markAsRead = jest.fn().mockResolvedValue(undefined);
    useGlobalNotificationsMock.mockReturnValue({
      notifications: [buildNotification(8, false, 'New mention')],
      unreadCount: 1,
      markAsRead,
      markAllAsRead: jest.fn().mockResolvedValue(undefined),
      deleteNotificationById: jest.fn().mockResolvedValue(undefined),
      deleteAllNotifications: jest.fn().mockResolvedValue({ deleted: 1, failed: 0 }),
    });

    render(<NotificationBell />);

    fireEvent.click(screen.getAllByRole('button')[0]);
    fireEvent.click(screen.getByText('New mention'));

    expect(markAsRead).toHaveBeenCalledWith(8);
  });

  it('marks all notifications as read when the header action is clicked', () => {
    const markAllAsRead = jest.fn().mockResolvedValue(undefined);
    useGlobalNotificationsMock.mockReturnValue({
      notifications: [buildNotification(2, false, 'Task updated'), buildNotification(3, true, 'Already read')],
      unreadCount: 1,
      markAsRead: jest.fn().mockResolvedValue(undefined),
      markAllAsRead,
      deleteNotificationById: jest.fn().mockResolvedValue(undefined),
      deleteAllNotifications: jest.fn().mockResolvedValue({ deleted: 2, failed: 0 }),
    });

    render(<NotificationBell />);

    fireEvent.click(screen.getAllByRole('button')[0]);
    fireEvent.click(screen.getByText('Mark all as read'));

    expect(markAllAsRead).toHaveBeenCalledTimes(1);
  });

  it('deletes one notification when confirmed', async () => {
    const deleteNotificationById = jest.fn().mockResolvedValue(undefined);
    useGlobalNotificationsMock.mockReturnValue({
      notifications: [buildNotification(21, false, 'Delete me')],
      unreadCount: 1,
      markAsRead: jest.fn().mockResolvedValue(undefined),
      markAllAsRead: jest.fn().mockResolvedValue(undefined),
      deleteNotificationById,
      deleteAllNotifications: jest.fn().mockResolvedValue({ deleted: 1, failed: 0 }),
    });

    render(<NotificationBell />);

    fireEvent.click(screen.getAllByRole('button')[0]);
    fireEvent.click(screen.getByLabelText('Delete notification'));

    await waitFor(() => {
      expect(deleteNotificationById).toHaveBeenCalledWith(21);
    });
  });

  it('deletes all notifications when confirmed', async () => {
    const deleteAllNotifications = jest.fn().mockResolvedValue({ deleted: 2, failed: 0 });
    useGlobalNotificationsMock.mockReturnValue({
      notifications: [buildNotification(4, false, 'One'), buildNotification(5, false, 'Two')],
      unreadCount: 2,
      markAsRead: jest.fn().mockResolvedValue(undefined),
      markAllAsRead: jest.fn().mockResolvedValue(undefined),
      deleteNotificationById: jest.fn().mockResolvedValue(undefined),
      deleteAllNotifications,
    });

    render(<NotificationBell />);

    fireEvent.click(screen.getAllByRole('button')[0]);
    fireEvent.click(screen.getByText('Delete all'));

    await waitFor(() => {
      expect(deleteAllNotifications).toHaveBeenCalledTimes(1);
    });
  });

  it('deletes all notifications represented by an aggregated row when confirmed', async () => {
    const deleteNotificationById = jest.fn().mockResolvedValue(undefined);
    useGlobalNotificationsMock.mockReturnValue({
      notifications: [
        buildNotification(41, false, 'Alice posted in #dev: One', '/project/8/chat'),
        buildNotification(42, true, 'Bob posted in #dev: Two', '/project/8/chat'),
      ],
      unreadCount: 1,
      markAsRead: jest.fn().mockResolvedValue(undefined),
      markAllAsRead: jest.fn().mockResolvedValue(undefined),
      deleteNotificationById,
      deleteAllNotifications: jest.fn().mockResolvedValue({ deleted: 0, failed: 0 }),
    });

    render(<NotificationBell />);

    fireEvent.click(screen.getAllByRole('button')[0]);
    fireEvent.click(screen.getByLabelText('Delete notification'));

    await waitFor(() => {
      expect(deleteNotificationById).toHaveBeenCalledWith(41);
      expect(deleteNotificationById).toHaveBeenCalledWith(42);
      expect(deleteNotificationById).toHaveBeenCalledTimes(2);
    });
  });
});
