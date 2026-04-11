import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import NotificationsPage from './page';
import type { Notification } from '@/services/notifications-service';

const apiGetMock = jest.fn();
const fetchProjectDetailsMock = jest.fn();

jest.mock('@/lib/axios', () => ({
  __esModule: true,
  default: {
    get: (...args: unknown[]) => apiGetMock(...args),
  },
}));

jest.mock('@/services/projects-service', () => ({
  fetchProjectDetails: (...args: unknown[]) => fetchProjectDetailsMock(...args),
}));

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
  beforeEach(() => {
    jest.clearAllMocks();
    apiGetMock.mockResolvedValue({ data: {} });
    fetchProjectDetailsMock.mockResolvedValue({ id: 7, name: 'Atlas' });

    useGlobalNotificationsMock.mockReturnValue({
      notifications: [],
      unreadCount: 0,
      markAsRead: jest.fn().mockResolvedValue(undefined),
      markAllAsRead: jest.fn().mockResolvedValue(undefined),
      deleteNotificationById: jest.fn().mockResolvedValue(undefined),
      deleteAllNotifications: jest.fn().mockResolvedValue({ deleted: 0, failed: 0 }),
    });
  });

  it('renders full notification details, actions, and project summary link', async () => {
    const markAsRead = jest.fn().mockResolvedValue(undefined);
    apiGetMock.mockImplementation((url: string) => {
      if (url === '/api/tasks/12') {
        return Promise.resolve({ data: { projectId: 77, projectName: 'Atlas' } });
      }
      return Promise.resolve({ data: {} });
    });

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
    expect(screen.getAllByText('New').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Open details' })).toHaveAttribute('href', '/taskcard?taskId=12');

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Atlas' })).toHaveAttribute('href', '/summary/77');
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Read' })[1]);
    await waitFor(() => {
      expect(markAsRead).toHaveBeenCalledWith(1);
    });
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

    fireEvent.click(screen.getAllByRole('button', { name: 'Read' })[0]);
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

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

    await waitFor(() => {
      expect(deleteNotificationById).toHaveBeenCalledWith(9);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Delete all' }));

    await waitFor(() => {
      expect(deleteAllNotifications).toHaveBeenCalledTimes(1);
    });
  });

  it('shows empty state when there are no notifications', () => {
    render(<NotificationsPage />);

    expect(screen.getByText('Catching up...')).toBeInTheDocument();
    expect(screen.getByText('You have no notifications yet.')).toBeInTheDocument();
  });
});
