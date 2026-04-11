'use client';

import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import Link from 'next/link';
import { Bell, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGlobalNotifications } from '@/components/providers/GlobalNotificationProvider';
import { toast } from '@/components/ui/Toast';
import { Notification } from '@/services/notifications-service';

type NotificationListItem = {
  rowKey: string;
  link: string;
  displayMessage: string;
  createdAt: string;
  isUnread: boolean;
  notificationIds: number[];
  unreadIds: number[];
};

type ChatDescriptor = {
  key: string;
  chatName: string;
};

const CHAT_LINK_REGEX = /\/project\/(\d+)\/chat(?:\/?$|\?)/i;

function getChatDescriptor(notification: Notification): ChatDescriptor | null {
  const rawLink = typeof notification.link === 'string' ? notification.link : '';
  const projectMatch = rawLink.match(CHAT_LINK_REGEX);
  if (!projectMatch) {
    return null;
  }

  const projectId = projectMatch[1];
  const message = typeof notification.message === 'string' ? notification.message.trim() : '';

  const roomMatch = message.match(/^.+? posted in #([^:]+):/i);
  if (roomMatch) {
    const roomName = roomMatch[1].trim();
    return {
      key: `chat-room:${projectId}:${roomName.toLowerCase()}`,
      chatName: `#${roomName}`,
    };
  }

  const privateMatch = message.match(/^(.+?) sent you a message in "([^"]+)"/i);
  if (privateMatch) {
    const sender = privateMatch[1].trim();
    return {
      key: `chat-private:${projectId}:${sender.toLowerCase()}`,
      chatName: sender,
    };
  }

  const teamMatch = message.match(/^.+? sent a message in "([^"]+)" team chat:/i);
  if (teamMatch) {
    const projectName = teamMatch[1].trim();
    return {
      key: `chat-team:${projectId}`,
      chatName: `${projectName} team chat`,
    };
  }

  const mentionMatch = message.match(/^.+? mentioned you in "([^"]+)" chat$/i);
  if (mentionMatch) {
    const projectName = mentionMatch[1].trim();
    return {
      key: `chat-team:${projectId}`,
      chatName: `${projectName} chat`,
    };
  }

  return {
    key: `chat-team:${projectId}`,
    chatName: 'Project chat',
  };
}

function buildNotificationListItems(notifications: Notification[]): NotificationListItem[] {
  const grouped = new Map<string, { ids: number[]; unreadIds: number[]; link: string; createdAt: string; chatName: string }>();
  const rows: NotificationListItem[] = [];

  notifications.forEach((notification) => {
    const descriptor = getChatDescriptor(notification);
    const link = typeof notification.link === 'string' && notification.link ? notification.link : '#';

    if (!descriptor) {
      rows.push({
        rowKey: `notification-${notification.id}`,
        link,
        displayMessage: notification.message,
        createdAt: notification.createdAt,
        isUnread: !notification.read,
        notificationIds: [notification.id],
        unreadIds: notification.read ? [] : [notification.id],
      });
      return;
    }

    const existing = grouped.get(descriptor.key);
    if (!existing) {
      grouped.set(descriptor.key, {
        ids: [notification.id],
        unreadIds: notification.read ? [] : [notification.id],
        link,
        createdAt: notification.createdAt,
        chatName: descriptor.chatName,
      });
      return;
    }

    existing.ids.push(notification.id);
    if (!notification.read) {
      existing.unreadIds.push(notification.id);
    }

    if (new Date(notification.createdAt).getTime() > new Date(existing.createdAt).getTime()) {
      existing.createdAt = notification.createdAt;
      existing.link = link;
    }
  });

  grouped.forEach((group, key) => {
    const count = group.unreadIds.length > 0 ? group.unreadIds.length : group.ids.length;
    rows.push({
      rowKey: key,
      link: group.link,
      displayMessage: `${count} ${count === 1 ? 'message' : 'messages'} from ${group.chatName}`,
      createdAt: group.createdAt,
      isUnread: group.unreadIds.length > 0,
      notificationIds: group.ids,
      unreadIds: group.unreadIds,
    });
  });

  return rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function NotificationBell() {
  const [showDropdown, setShowDropdown] = useState(false);
  const [pendingReadIds, setPendingReadIds] = useState<number[]>([]);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<number[]>([]);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotificationById,
    deleteAllNotifications,
  } = useGlobalNotifications();

  const listItems = useMemo(() => buildNotificationListItems(notifications), [notifications]);

  useEffect(() => {
    if (!showDropdown) {
      return;
    }

    const handleDocumentMouseDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleDocumentMouseDown);
    return () => {
      document.removeEventListener('mousedown', handleDocumentMouseDown);
    };
  }, [showDropdown]);

  const handleDeleteSingle = async (event: ReactMouseEvent<HTMLButtonElement>, ids: number[]) => {
    event.preventDefault();
    event.stopPropagation();

    if (ids.length === 0) {
      return;
    }

    setPendingDeleteIds((prev) => Array.from(new Set([...prev, ...ids])));

    try {
      const results = await Promise.allSettled(ids.map((id) => deleteNotificationById(id)));
      const deleted = results.filter((result) => result.status === 'fulfilled').length;
      const failed = ids.length - deleted;

      if (failed === 0) {
        toast(`Deleted ${deleted} notification${deleted === 1 ? '' : 's'}`, 'success');
      } else if (deleted > 0) {
        toast(
          `Deleted ${deleted} notification${deleted === 1 ? '' : 's'}. ${failed} failed.`,
          'warning'
        );
      } else {
        toast('Failed to delete notification', 'error');
      }
    } catch (error) {
      console.error('Failed to delete notification', error);
      toast('Failed to delete notification', 'error');
    } finally {
      setPendingDeleteIds((prev) => prev.filter((itemId) => !ids.includes(itemId)));
    }
  };

  const markRowAsRead = async (ids: number[]) => {
    if (ids.length === 0) {
      return;
    }

    setPendingReadIds((prev) => Array.from(new Set([...prev, ...ids])));

    try {
      const results = await Promise.allSettled(ids.map((id) => markAsRead(id)));
      const failedCount = results.filter((result) => result.status === 'rejected').length;
      if (failedCount > 0) {
        toast(`Failed to mark ${failedCount} notification${failedCount === 1 ? '' : 's'} as read`, 'warning');
      }
    } finally {
      setPendingReadIds((prev) => prev.filter((id) => !ids.includes(id)));
    }
  };

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0 || isMarkingAllRead) {
      return;
    }

    setIsMarkingAllRead(true);
    try {
      await markAllAsRead();
    } catch (error) {
      console.error('Failed to mark all notifications as read', error);
      toast('Failed to mark all notifications as read', 'error');
    } finally {
      setIsMarkingAllRead(false);
    }
  };

  const handleDeleteAll = async () => {
    if (notifications.length === 0) return;

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
    <div className="relative" ref={rootRef}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-600 hover:text-slate-800 hover:bg-black/5 transition-colors max-sm:h-9 max-sm:w-9"
      >
        <span className="relative inline-flex items-center justify-center leading-none">
          <Bell size={20} strokeWidth={2.2} className="block text-current" />
          {unreadCount > 0 && (
            <span
              className="pointer-events-none absolute -right-1.5 -top-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-cu-danger px-1 text-[10px] font-bold leading-none text-white shadow-sm"
              aria-label={`${unreadCount} unread notifications`}
            >
              <span className="tabular-nums">{unreadCount > 9 ? '9+' : unreadCount}</span>
            </span>
          )}
        </span>
      </button>

      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute right-0 mt-3 w-80 bg-white border border-slate-200 shadow-2xl rounded-2xl overflow-hidden z-50 origin-top-right transition-all"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-white/50">
              <span className="font-bold text-slate-900 text-[14px] font-outfit">Notifications</span>
              <button 
                onClick={() => void handleMarkAllAsRead()}
                disabled={unreadCount === 0 || isMarkingAllRead}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-700 transition font-outfit uppercase tracking-wider disabled:opacity-50"
              >
                {isMarkingAllRead ? 'Marking...' : 'Mark all as read'}
              </button>
            </div>
            {notifications.length > 0 && (
              <div className="flex justify-end px-4 py-2 border-b border-slate-100 bg-slate-50/40">
                <button
                  onClick={handleDeleteAll}
                  disabled={isDeletingAll}
                  className="text-[11px] font-semibold text-slate-500 hover:text-red-600 transition font-outfit uppercase tracking-wider disabled:opacity-50"
                >
                  {isDeletingAll ? 'Deleting...' : 'Delete all'}
                </button>
              </div>
            )}
            <div className="max-h-[320px] overflow-y-auto no-scrollbar">
              {listItems.length === 0 ? (
                <div className="p-10 text-center text-slate-400 text-sm italic">You have no notifications</div>
              ) : (
                listItems.map((item) => (
                  <div
                    key={item.rowKey}
                    className={`group relative border-b last:border-0 border-slate-50 ${item.isUnread ? 'bg-blue-50/30' : ''}`}
                  >
                    {(() => {
                      const isRowReadPending = item.unreadIds.some((id) => pendingReadIds.includes(id));
                      return (
                    <Link
                      href={item.link}
                      onClick={() => {
                          if (isRowReadPending) {
                            return;
                          }
                          void markRowAsRead(item.unreadIds);
                          setShowDropdown(false);
                      }}
                      className={`block p-4 pr-11 hover:bg-slate-50 transition-colors ${
                        isRowReadPending ? 'pointer-events-none opacity-70' : ''
                      }`}
                    >
                      <div className="flex gap-3">
                        <div className={`w-2 h-2 mt-1.5 rounded-full shrink-0 ${item.isUnread ? 'bg-blue-600' : 'bg-transparent'}`} />
                        <div>
                          <p className={`text-[13px] leading-relaxed ${item.isUnread ? 'text-slate-900 font-bold' : 'text-slate-600 font-medium'} font-outfit`}>
                            {item.displayMessage}
                          </p>
                          <span className="text-[10px] text-slate-400 mt-1.5 block font-bold uppercase tracking-wider font-outfit">
                            {new Date(item.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </Link>
                      );
                    })()}
                    <button
                      type="button"
                      aria-label="Delete notification"
                      onClick={(event) => void handleDeleteSingle(event, item.notificationIds)}
                      disabled={item.notificationIds.some((id) => pendingDeleteIds.includes(id))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-slate-400 hover:text-red-600 hover:bg-red-50 transition opacity-0 group-hover:opacity-100 focus:opacity-100 disabled:opacity-50"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="border-t border-slate-100 bg-white px-4 py-2.5">
              <Link
                href="/dashboard/notifications"
                onClick={() => setShowDropdown(false)}
                className="block text-center text-[12px] font-semibold text-blue-600 hover:text-blue-700 transition font-outfit"
              >
                View all notifications
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
