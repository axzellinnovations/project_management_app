'use client';

import { useMemo, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { useGlobalNotifications } from '@/components/providers/GlobalNotificationProvider';
import { toast } from '@/components/ui/Toast';
import { NotificationFilters } from './components/NotificationFilters';
import { NotificationHeader } from './components/NotificationHeader';
import { NotificationsList } from './components/NotificationsList';
import { NotificationStats } from './components/NotificationStats';
import { useNotificationTaskProjectLinks } from './hooks/useNotificationTaskProjectLinks';
import type { NotificationFilter } from './types';

export default function DashboardNotificationsPage() {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotificationById,
    deleteAllNotifications,
  } = useGlobalNotifications();

  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<number[]>([]);

  const sortedNotifications = useMemo(
    () =>
      [...notifications].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [notifications]
  );

  const visibleNotifications = useMemo(() => {
    if (filter === 'all') return sortedNotifications;
    if (filter === 'unread') return sortedNotifications.filter((item) => !item.read);
    return sortedNotifications.filter((item) => item.read);
  }, [filter, sortedNotifications]);
  const taskProjectLinks = useNotificationTaskProjectLinks(sortedNotifications);

  const readCount = notifications.length - unreadCount;

  const handleDeleteSingle = async (
    event: ReactMouseEvent<HTMLButtonElement>,
    notificationId: number
  ) => {
    event.preventDefault();

    setPendingDeleteIds((prev) => (prev.includes(notificationId) ? prev : [...prev, notificationId]));

    try {
      await deleteNotificationById(notificationId);
      toast('Notification deleted', 'success');
    } catch (error) {
      console.error('Failed to delete notification', error);
      toast('Failed to delete notification', 'error');
    } finally {
      setPendingDeleteIds((prev) => prev.filter((id) => id !== notificationId));
    }
  };

  const handleDeleteAll = async () => {
    if (notifications.length === 0 || isDeletingAll) return;

    setIsDeletingAll(true);

    try {
      const result = await deleteAllNotifications();
      if (result.failed === 0) {
        toast(`Deleted ${result.deleted} notification${result.deleted === 1 ? '' : 's'}`, 'success');
      } else if (result.deleted > 0) {
        toast(
          `Deleted ${result.deleted} notification${result.deleted === 1 ? '' : 's'}. ${result.failed} failed.`,
          'warning'
        );
      } else {
        toast('Failed to delete notifications', 'error');
      }
    } catch (error) {
      console.error('Failed to delete all notifications', error);
      toast('Failed to delete notifications', 'error');
    } finally {
      setIsDeletingAll(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto pb-8 sm:pb-10 space-y-5 sm:space-y-6">
      <NotificationHeader
        unreadCount={unreadCount}
        totalCount={notifications.length}
        isDeletingAll={isDeletingAll}
        onMarkAllAsRead={() => void markAllAsRead()}
        onDeleteAll={() => void handleDeleteAll()}
      />

      <NotificationStats
        total={notifications.length}
        unread={unreadCount}
        read={readCount}
      />

      <NotificationFilters
        filter={filter}
        onFilterChange={setFilter}
      />

      <NotificationsList
        notifications={visibleNotifications}
        filter={filter}
        pendingDeleteIds={pendingDeleteIds}
        taskProjectLinks={taskProjectLinks}
        onMarkAsRead={(notificationId) => void markAsRead(notificationId)}
        onDeleteSingle={(event, notificationId) => void handleDeleteSingle(event, notificationId)}
      />
    </div>
  );
}
