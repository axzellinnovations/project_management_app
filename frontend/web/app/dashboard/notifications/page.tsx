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
    <div className="max-w-5xl mx-auto px-4 sm:px-0 pb-10">
      {/* Mobile Top Header */}
      <div className="flex items-center gap-3 py-4 md:hidden">
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('planora:sidebar:toggle'))}
          className="p-2 -ml-2 text-slate-500 hover:bg-slate-50 rounded-lg transition-colors border border-slate-100"
          aria-label="Toggle Sidebar"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <div className="font-outfit text-xl font-extrabold tracking-tight text-[#101828] flex items-center gap-2">
          <span className="w-2 h-5 bg-blue-600 rounded-full"></span>
          PLANORA
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6">
        <div>
          <h1 className="font-outfit text-2xl sm:text-[32px] font-bold text-[#101828]">Notifications</h1>
          <p className="text-xs sm:text-sm text-[#4A5565] mt-1 font-outfit leading-relaxed">
            Stay updated with task changes, chat activity, and project events.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void markAllAsRead()}
            disabled={unreadCount === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-[#D0D5DD] bg-white px-3 py-2 text-xs font-bold text-[#344054] hover:bg-[#F9FAFB] disabled:opacity-50 transition-all active:scale-95 font-outfit"
          >
            <CheckCheck size={14} />
            Mark all as read
          </button>
          <button
            type="button"
            onClick={() => void handleDeleteAll()}
            disabled={notifications.length === 0 || isDeletingAll}
            className="inline-flex items-center gap-2 rounded-xl border border-red-100 bg-white px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50 transition-all active:scale-95 font-outfit"
          >
            <Trash2 size={14} />
            {isDeletingAll ? 'Deleting...' : 'Delete all'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <div className="rounded-2xl border border-slate-100 bg-white px-5 py-4 shadow-sm">
          <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold font-outfit">Total</p>
          <p className="text-2xl font-bold text-[#101828] mt-1 font-outfit">{notifications.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white px-5 py-4 shadow-sm">
          <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold font-outfit">Unread</p>
          <p className="text-2xl font-bold text-blue-600 mt-1 font-outfit">{unreadCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white px-5 py-4 shadow-sm">
          <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold font-outfit">Read</p>
          <p className="text-2xl font-bold text-slate-600 mt-1 font-outfit">{readCount}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 bg-slate-50/80 rounded-xl p-1 mb-4 w-full sm:w-fit border border-slate-100">
        {([
          { key: 'all', label: 'All' },
          { key: 'unread', label: 'Unread' },
          { key: 'read', label: 'Read' },
        ] as const).map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setFilter(option.key)}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all font-outfit ${
              filter === option.key
                ? 'bg-white text-blue-600 shadow-sm ring-1 ring-slate-200'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <section className="rounded-2xl border border-slate-100 bg-white overflow-hidden shadow-sm">
        {visibleNotifications.length === 0 ? (
          <div className="px-6 py-20 text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center mb-4">
              <Bell size={24} />
            </div>
            <h2 className="text-lg font-bold text-[#101828] font-outfit">Catching up...</h2>
            <p className="text-sm text-slate-500 mt-1 font-outfit">
              {filter === 'all'
                ? 'You have no notifications yet.'
                : `No ${filter} notifications found.`}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-50">
            {visibleNotifications.map((notification) => {
              const unread = !notification.read;
              const type = inferNotificationType(notification);
              const typeTone = TYPE_TONES[type] || TYPE_TONES.GENERAL;
              const isDeleting = pendingDeleteIds.includes(notification.id);
              const actionLink = hasActionLink(notification) ? (notification.link as string) : null;

              return (
                <li key={notification.id} className={`px-4 sm:px-6 py-5 transition-colors ${unread ? 'bg-blue-50/20' : 'hover:bg-slate-50/50'}`}>
                  <div className="flex items-start gap-4">
                    <span
                      aria-hidden="true"
                      className={`mt-2 h-2 w-2 rounded-full shrink-0 ${
                        unread ? 'bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.4)]' : 'bg-slate-200'
                      }`}
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <p className={`text-[13px] sm:text-[14px] leading-relaxed font-outfit ${unread ? 'text-slate-900 font-bold' : 'text-slate-600 font-medium'}`}>
                          {notification.message}
                        </p>
                        <div className="text-right shrink-0">
                          <p className="text-[11px] font-bold text-slate-400 font-outfit uppercase tracking-wider">
                            {formatRelativeTime(notification.createdAt)}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        <span
                          className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider font-outfit ${
                            typeTone.bg
                          } ${typeTone.text}`}
                        >
                          {toTypeLabel(type)}
                        </span>
                        {unread && (
                             <span className="inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider font-outfit bg-blue-100 text-blue-700">
                                New
                             </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2 mt-4">
                        {unread && (
                          <button
                            type="button"
                            onClick={() => void markAsRead(notification.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-100 bg-blue-50 px-3 py-1.5 text-[11px] font-bold text-blue-700 hover:bg-blue-100 transition-all active:scale-95 font-outfit"
                          >
                            <CheckCheck size={13} />
                            Mark as read
                          </button>
                        )}

                        {actionLink && (
                          <Link
                            href={actionLink}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition-all active:scale-95 font-outfit"
                          >
                            <ExternalLink size={13} />
                            Open details
                          </Link>
                        )}

                        <button
                          type="button"
                          onClick={(event) => void handleDeleteSingle(event, notification.id)}
                          disabled={isDeleting}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-red-50 bg-white px-3 py-1.5 text-[11px] font-bold text-red-600 hover:bg-red-50 transition-all active:scale-95 disabled:opacity-50 font-outfit ml-auto sm:ml-0"
                        >
                          <Trash2 size={13} />
                          {isDeleting ? 'Removing...' : 'Remove'}
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
