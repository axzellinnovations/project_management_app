import { fireEvent, render, screen } from '@testing-library/react';
import { NotificationBell } from '@/components/layout/topbar/NotificationBell';
import type { Notification } from '@/services/notifications-service';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, onClick, className, children }: { href: string; onClick?: () => void; className?: string; children: React.ReactNode }) => (
    <a href={href} onClick={onClick} className={className}>
      {children}
    </a>
  ),
}));

const useGlobalNotificationsMock = jest.fn();

jest.mock('@/components/providers/GlobalNotificationProvider', () => ({
  useGlobalNotifications: () => useGlobalNotificationsMock(),
}));

const buildNotification = (id: number, read = false, message = 'Notice'): Notification => ({
  id,
  message,
  type: 'INFO',
  read,
  createdAt: '2026-04-04T10:00:00.000Z',
  link: '/project/8/chat',
});

describe('NotificationBell', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useGlobalNotificationsMock.mockReturnValue({
      notifications: [],
      unreadCount: 0,
      markAsRead: jest.fn().mockResolvedValue(undefined),
      markAllAsRead: jest.fn().mockResolvedValue(undefined),
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
    });

    render(<NotificationBell />);

    expect(screen.getByText('9+')).toBeInTheDocument();
  });

  it('opens dropdown and shows empty state when there are no notifications', () => {
    render(<NotificationBell />);

    fireEvent.click(screen.getAllByRole('button')[0]);

    expect(screen.getByText('Notifications')).toBeInTheDocument();
    expect(screen.getByText('You have no notifications')).toBeInTheDocument();
  });

  it('marks a notification as read when notification link is clicked', () => {
    const markAsRead = jest.fn().mockResolvedValue(undefined);
    useGlobalNotificationsMock.mockReturnValue({
      notifications: [buildNotification(8, false, 'New mention')],
      unreadCount: 1,
      markAsRead,
      markAllAsRead: jest.fn().mockResolvedValue(undefined),
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
    });

    render(<NotificationBell />);

    fireEvent.click(screen.getAllByRole('button')[0]);
    fireEvent.click(screen.getByText('Mark all as read'));

    expect(markAllAsRead).toHaveBeenCalledTimes(1);
  });
});
