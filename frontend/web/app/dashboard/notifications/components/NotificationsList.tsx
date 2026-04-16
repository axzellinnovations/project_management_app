import Link from 'next/link';
import { Bell, CheckCheck, ExternalLink, Trash2 } from 'lucide-react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import type { Notification } from '@/services/notifications-service';
import type { NotificationFilter, TaskProjectLinkMap } from '../types';
import {
  extractTaskIdFromLink,
  formatRelativeTime,
  hasActionLink,
  inferNotificationType,
  toTypeLabel,
  TYPE_TONES,
} from '../utils';

interface NotificationsListProps {
  notifications: Notification[];
  filter: NotificationFilter;
  pendingDeleteIds: number[];
  taskProjectLinks: TaskProjectLinkMap;
  onMarkAsRead: (notificationId: number) => void;
  onDeleteSingle: (event: ReactMouseEvent<HTMLButtonElement>, notificationId: number) => void;
}

export function NotificationsList({
  notifications,
  filter,
  pendingDeleteIds,
  taskProjectLinks,
  onMarkAsRead,
  onDeleteSingle,
}: NotificationsListProps) {
  return (
    <section className="rounded-2xl border border-slate-100 bg-white overflow-hidden shadow-sm">
      {notifications.length === 0 ? (
        <div className="px-6 py-16 sm:py-20 text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center mb-4">
            <Bell size={24} />
          </div>
          <h2 className="text-lg font-bold text-[#101828] font-outfit">Catching up...</h2>
          <p className="text-sm text-slate-500 mt-1 font-outfit">
            {filter === 'all' ? 'You have no notifications yet.' : `No ${filter} notifications found.`}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-50">
          {notifications.map((notification) => {
            const unread = !notification.read;
            const type = inferNotificationType(notification);
            const typeTone = TYPE_TONES[type] || TYPE_TONES.GENERAL;
            const isDeleting = pendingDeleteIds.includes(notification.id);
            const actionLink = hasActionLink(notification) ? (notification.link as string) : null;
            const taskId = extractTaskIdFromLink(notification.link);
            const relatedProject = taskId !== null ? taskProjectLinks[taskId] : undefined;

            return (
              <li key={notification.id} className={`px-4 sm:px-6 py-4 sm:py-5 transition-colors ${unread ? 'bg-blue-50/20' : 'hover:bg-slate-50/50'}`}>
                <div className="flex items-start gap-4">
                  <span
                    aria-hidden="true"
                    className={`mt-2 h-2 w-2 rounded-full shrink-0 ${
                      unread ? 'bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.4)]' : 'bg-slate-200'
                    }`}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2.5 sm:gap-3">
                      <p className={`text-[13px] sm:text-[14px] leading-relaxed font-outfit ${unread ? 'text-slate-900 font-bold' : 'text-slate-600 font-medium'}`}>
                        {notification.message}
                      </p>
                      <div className="sm:text-right shrink-0">
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

                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-3.5 sm:mt-4">
                      {unread && (
                        <button
                          type="button"
                          onClick={() => onMarkAsRead(notification.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 sm:py-1.5 min-h-[44px] sm:min-h-0 text-[11px] font-bold text-blue-700 hover:bg-blue-100 transition-all active:scale-95 font-outfit"
                        >
                          <CheckCheck size={13} />
                          Read
                        </button>
                      )}

                      {actionLink && (
                        <Link
                          href={actionLink}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 sm:py-1.5 min-h-[44px] sm:min-h-0 text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition-all active:scale-95 font-outfit"
                        >
                          <ExternalLink size={13} />
                          Open details
                        </Link>
                      )}

                      {relatedProject && (
                        <Link
                          href={`/summary/${relatedProject.projectId}`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 sm:py-1.5 min-h-[44px] sm:min-h-0 text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition-all active:scale-95 font-outfit"
                        >
                          {relatedProject.projectName}
                        </Link>
                      )}

                      <button
                        type="button"
                        onClick={(event) => onDeleteSingle(event, notification.id)}
                        disabled={isDeleting}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-50 bg-white px-3 py-2 sm:py-1.5 min-h-[44px] sm:min-h-0 text-[11px] font-bold text-red-600 hover:bg-red-50 transition-all active:scale-95 disabled:opacity-50 font-outfit sm:ml-auto"
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
  );
}
