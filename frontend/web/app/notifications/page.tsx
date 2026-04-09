'use client';

import Link from 'next/link';
import { useMemo, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { Bell, CheckCheck, ExternalLink, Trash2 } from 'lucide-react';
import { useGlobalNotifications } from '@/components/providers/GlobalNotificationProvider';
import { Notification } from '@/services/notifications-service';
import { toast } from '@/components/ui/Toast';

type NotificationFilter = 'all' | 'unread' | 'read';

type TypeTone = {
  bg: string;
  text: string;
};

const TYPE_TONES: Record<string, TypeTone> = {
  CHAT: { bg: 'bg-indigo-50', text: 'text-indigo-700' },
  TASK: { bg: 'bg-blue-50', text: 'text-blue-700' },
  PAGE: { bg: 'bg-violet-50', text: 'text-violet-700' },
  PROJECT: { bg: 'bg-cyan-50', text: 'text-cyan-700' },
  MENTION: { bg: 'bg-amber-50', text: 'text-amber-700' },
  INFO: { bg: 'bg-slate-100', text: 'text-slate-700' },
  GENERAL: { bg: 'bg-slate-100', text: 'text-slate-700' },
};

function inferNotificationType(notification: Notification): string {
  if (typeof notification.type === 'string' && notification.type.trim().length > 0) {
    return notification.type.trim().toUpperCase();
  }

  const message = String(notification.message || '').toLowerCase();
  const link = String(notification.link || '').toLowerCase();

  if (message.includes('mention')) return 'MENTION';
  if (link.includes('/chat') || message.includes('chat')) return 'CHAT';
  if (message.includes('task') || link.includes('/task')) return 'TASK';
  if (message.includes('page') || link.includes('/pages')) return 'PAGE';
  if (message.includes('project') || link.includes('/project')) return 'PROJECT';

  return 'GENERAL';
}

function toTypeLabel(type: string): string {
  return type
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatRelativeTime(iso: string): string {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return 'Unknown time';

  const diffMs = Date.now() - time;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;

  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;

  return new Date(iso).toLocaleDateString();
}

function formatFullDateTime(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return 'Invalid timestamp';
  return parsed.toLocaleString();
}

function hasActionLink(notification: Notification): boolean {
  return typeof notification.link === 'string' && notification.link.trim().length > 0;
}

export default function NotificationsPage() {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotificationById,
    deleteAllNotifications,
  } = useGlobalNotifications();

  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [pendingDeleteIds, setPendingDeleteIds] = useState<number[]>([]);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

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

  const readCount = notifications.length - unreadCount;

  const handleDeleteSingle = async (
    event: ReactMouseEvent<HTMLButtonElement>,
    notificationId: number
  ) => {
    event.preventDefault();

    const confirmed = window.confirm('Delete this notification?');
    if (!confirmed) return;

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

    const confirmed = window.confirm('Delete all notifications? This action cannot be undone.');
    if (!confirmed) return;

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
    <div className="mobile-page-padding max-w-5xl mx-auto pb-28 sm:pb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6">
        <div>
          <h1 className="font-arimo text-2xl sm:text-[32px] font-bold text-[#101828]">Notifications</h1>
          <p className="text-sm text-[#4A5565] mt-1">
            Stay updated with task changes, chat activity, and project events.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void markAllAsRead()}
            disabled={unreadCount === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-[#D0D5DD] bg-white px-3 py-2 text-xs font-semibold text-[#344054] hover:bg-[#F9FAFB] disabled:opacity-50"
          >
            <CheckCheck size={14} />
            Mark all as read
          </button>
          <button
            type="button"
            onClick={() => void handleDeleteAll()}
            disabled={notifications.length === 0 || isDeletingAll}
            className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 size={14} />
            {isDeletingAll ? 'Deleting...' : 'Delete all'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <div className="rounded-xl border border-[#E4E7EC] bg-white px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-[#667085] font-semibold">Total</p>
          <p className="text-2xl font-bold text-[#101828] mt-1">{notifications.length}</p>
        </div>
        <div className="rounded-xl border border-[#E4E7EC] bg-white px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-[#667085] font-semibold">Unread</p>
          <p className="text-2xl font-bold text-blue-700 mt-1">{unreadCount}</p>
        </div>
        <div className="rounded-xl border border-[#E4E7EC] bg-white px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-[#667085] font-semibold">Read</p>
          <p className="text-2xl font-bold text-[#344054] mt-1">{readCount}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 bg-[#F2F4F7] rounded-xl p-1 mb-4 w-full sm:w-fit">
        {([
          { key: 'all', label: 'All' },
          { key: 'unread', label: 'Unread' },
          { key: 'read', label: 'Read' },
        ] as const).map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setFilter(option.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filter === option.key
                ? 'bg-white text-[#155DFC] shadow-sm'
                : 'text-[#4A5565] hover:text-[#1D293D]'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <section className="rounded-2xl border border-[#E4E7EC] bg-white overflow-hidden">
        {visibleNotifications.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-[#EEF2FF] text-[#155DFC] flex items-center justify-center mb-4">
              <Bell size={22} />
            </div>
            <h2 className="text-lg font-semibold text-[#101828]">No notifications here</h2>
            <p className="text-sm text-[#667085] mt-1">
              {filter === 'all'
                ? 'You are all caught up.'
                : `No ${filter} notifications to show right now.`}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[#EAECF0]">
            {visibleNotifications.map((notification) => {
              const unread = !notification.read;
              const type = inferNotificationType(notification);
              const typeTone = TYPE_TONES[type] || TYPE_TONES.GENERAL;
              const isDeleting = pendingDeleteIds.includes(notification.id);
              const actionLink = hasActionLink(notification) ? (notification.link as string) : null;

              return (
                <li key={notification.id} className={`px-4 sm:px-6 py-4 ${unread ? 'bg-blue-50/30' : 'bg-white'}`}>
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden="true"
                      className={`mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 ${
                        unread ? 'bg-blue-600' : 'bg-slate-300'
                      }`}
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                        <p className={`text-sm leading-6 ${unread ? 'text-[#101828] font-semibold' : 'text-[#344054]'}`}>
                          {notification.message}
                        </p>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-semibold text-[#475467]">
                            {formatRelativeTime(notification.createdAt)}
                          </p>
                          <p className="text-[11px] text-[#98A2B3] mt-0.5">
                            {formatFullDateTime(notification.createdAt)}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            typeTone.bg
                          } ${typeTone.text}`}
                        >
                          {toTypeLabel(type)}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            unread ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {unread ? 'Unread' : 'Read'}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2 mt-3">
                        {unread && (
                          <button
                            type="button"
                            onClick={() => void markAsRead(notification.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                          >
                            <CheckCheck size={13} />
                            Mark as read
                          </button>
                        )}

                        {actionLink && (
                          <Link
                            href={actionLink}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#D0D5DD] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#344054] hover:bg-[#F9FAFB]"
                          >
                            <ExternalLink size={13} />
                            Open context
                          </Link>
                        )}

                        <button
                          type="button"
                          onClick={(event) => void handleDeleteSingle(event, notification.id)}
                          disabled={isDeleting}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          <Trash2 size={13} />
                          {isDeleting ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
