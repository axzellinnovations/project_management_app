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
  const [pendingDeleteIds, setPendingDeleteIds] = useState<number[]>([]);
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

    const confirmed = window.confirm(
      ids.length === 1 ? 'Delete this notification?' : 'Delete these notifications?'
    );
    if (!confirmed) return;

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

  const markRowAsRead = (ids: number[]) => {
    ids.forEach((id) => {
      void markAsRead(id);
    });
  };

  const handleDeleteAll = async () => {
    if (notifications.length === 0) return;

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
    <div className="relative" ref={rootRef}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative p-2 rounded-full hover:bg-black/5 transition-colors"
      >
        <Bell size={20} className="text-cu-text-secondary" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-cu-danger text-white text-[10px] font-bold flex items-center justify-center rounded-full border border-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
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
                onClick={markAllAsRead} 
                className="text-[11px] font-bold text-blue-600 hover:text-blue-700 transition font-outfit uppercase tracking-wider"
              >
                Mark all as read
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
                    <Link
                      href={item.link}
                      onClick={() => {
                          markRowAsRead(item.unreadIds);
                          setShowDropdown(false);
                      }}
                      className="block p-4 pr-11 hover:bg-slate-50 transition-colors"
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
