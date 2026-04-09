'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { Bell, CheckCheck, CheckCircle2, Circle, ExternalLink, Trash2 } from 'lucide-react';
import { useGlobalNotifications } from '@/components/providers/GlobalNotificationProvider';
import { Notification } from '@/services/notifications-service';
import { fetchProjectDetails } from '@/services/projects-service';
import api from '@/lib/axios';
import { toast } from '@/components/ui/Toast';

type NotificationFilter = 'all' | 'unread' | 'read';

type TypeTone = {
  bg: string;
  text: string;
};

type NotificationProjectContext = {
  projectId: number | null;
  projectName: string | null;
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

function parseProjectIdFromLink(link?: string): number | null {
  if (!link || typeof link !== 'string') return null;

  const summaryMatch = link.match(/\/summary\/(\d+)/i);
  if (summaryMatch) return Number(summaryMatch[1]);

  const membersMatch = link.match(/\/members\/(\d+)/i);
  if (membersMatch) return Number(membersMatch[1]);

  const projectChatMatch = link.match(/\/project\/(\d+)\/chat/i);
  if (projectChatMatch) return Number(projectChatMatch[1]);

  try {
    const params = new URL(link, 'http://localhost').searchParams;
    const projectId = params.get('projectId');
    if (projectId && /^\d+$/.test(projectId)) {
      return Number(projectId);
    }
  } catch {
    // Ignore malformed links and fall back to other extraction strategies.
  }

  return null;
}

function parseTaskIdFromLink(link?: string): number | null {
  if (!link || typeof link !== 'string') return null;
  const taskMatch = link.match(/[?&]taskId=(\d+)/i);
  if (!taskMatch) return null;
  return Number(taskMatch[1]);
}

function getHttpStatusCode(error: unknown): number | null {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const maybeResponse = (error as { response?: { status?: unknown } }).response;
  if (!maybeResponse) {
    return null;
  }

  const maybeStatus = maybeResponse.status;
  return typeof maybeStatus === 'number' ? maybeStatus : null;
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
  const [pendingReadIds, setPendingReadIds] = useState<number[]>([]);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<number[]>([]);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [projectContexts, setProjectContexts] = useState<Record<number, NotificationProjectContext>>({});
  const taskProjectCacheRef = useRef<Map<number, NotificationProjectContext>>(new Map());
  const projectNameCacheRef = useRef<Map<number, string>>(new Map());

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
  const isEmptyState = visibleNotifications.length === 0;

  useEffect(() => {
    let cancelled = false;

    const resolveProjectContexts = async () => {
      const draft: Record<number, NotificationProjectContext> = {};
      const taskIdsToLookup = new Set<number>();
      const projectIdsToLookup = new Set<number>();

      sortedNotifications.forEach((notification) => {
        const link = typeof notification.link === 'string' ? notification.link : '';
        const directProjectId = parseProjectIdFromLink(link);

        if (directProjectId) {
          const cachedProjectName = projectNameCacheRef.current.get(directProjectId) ?? null;
          draft[notification.id] = { projectId: directProjectId, projectName: cachedProjectName };
          if (!cachedProjectName) {
            projectIdsToLookup.add(directProjectId);
          }
          return;
        }

        const taskId = parseTaskIdFromLink(link);
        if (taskId) {
          const cachedTaskContext = taskProjectCacheRef.current.get(taskId);
          if (cachedTaskContext) {
            draft[notification.id] = cachedTaskContext;
          } else {
            draft[notification.id] = { projectId: null, projectName: null };
            taskIdsToLookup.add(taskId);
          }
          return;
        }

        draft[notification.id] = { projectId: null, projectName: null };
      });

      if (taskIdsToLookup.size > 0) {
        const taskLookups = await Promise.allSettled(
          Array.from(taskIdsToLookup).map(async (taskId) => {
            try {
              const { data } = await api.get<{ projectId?: number; projectName?: string }>(`/api/tasks/${taskId}`);
              const rawProjectId = Number(data?.projectId);
              if (!Number.isFinite(rawProjectId) || rawProjectId <= 0) {
                taskProjectCacheRef.current.set(taskId, { projectId: null, projectName: null });
                return;
              }

              let projectName =
                typeof data?.projectName === 'string' && data.projectName.trim().length > 0
                  ? data.projectName.trim()
                  : null;

              if (!projectName) {
                projectName = projectNameCacheRef.current.get(rawProjectId) ?? null;
                if (!projectName) {
                  projectIdsToLookup.add(rawProjectId);
                }
              }

              if (projectName) {
                projectNameCacheRef.current.set(rawProjectId, projectName);
              }

              taskProjectCacheRef.current.set(taskId, {
                projectId: rawProjectId,
                projectName,
              });
            } catch (error) {
              const statusCode = getHttpStatusCode(error);
              if (statusCode === 404 || statusCode === 403) {
                taskProjectCacheRef.current.set(taskId, { projectId: null, projectName: null });
                return;
              }
              throw error;
            }
          })
        );

        taskLookups.forEach((result) => {
          if (result.status === 'rejected') {
            console.error('Failed to resolve task project context', result.reason);
          }
        });
      }

      if (projectIdsToLookup.size > 0) {
        const projectLookups = await Promise.allSettled(
          Array.from(projectIdsToLookup).map(async (projectId) => {
            const project = await fetchProjectDetails(String(projectId));
            if (typeof project?.name === 'string' && project.name.trim().length > 0) {
              projectNameCacheRef.current.set(projectId, project.name.trim());
            }
          })
        );

        projectLookups.forEach((result) => {
          if (result.status === 'rejected') {
            console.error('Failed to resolve project name for notification', result.reason);
          }
        });
      }

      sortedNotifications.forEach((notification) => {
        const link = typeof notification.link === 'string' ? notification.link : '';
        const directProjectId = parseProjectIdFromLink(link);

        if (directProjectId) {
          draft[notification.id] = {
            projectId: directProjectId,
            projectName: projectNameCacheRef.current.get(directProjectId) ?? draft[notification.id]?.projectName ?? null,
          };
          return;
        }

        const taskId = parseTaskIdFromLink(link);
        if (!taskId) {
          return;
        }

        const cachedTaskContext = taskProjectCacheRef.current.get(taskId);
        if (!cachedTaskContext) {
          return;
        }

        const resolvedProjectName =
          cachedTaskContext.projectId != null
            ? projectNameCacheRef.current.get(cachedTaskContext.projectId) ?? cachedTaskContext.projectName
            : cachedTaskContext.projectName;

        draft[notification.id] = {
          projectId: cachedTaskContext.projectId,
          projectName: resolvedProjectName,
        };
      });

      if (!cancelled) {
        setProjectContexts(draft);
      }
    };

    void resolveProjectContexts();

    return () => {
      cancelled = true;
    };
  }, [sortedNotifications]);

  const syncCurrentProject = (projectId: number, projectName: string) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('currentProjectId', String(projectId));
    localStorage.setItem('currentProjectName', projectName);
    window.dispatchEvent(new CustomEvent('planora:project-accessed'));
  };

  const handleMarkAsRead = async (notificationId: number) => {
    if (pendingReadIds.includes(notificationId)) {
      return;
    }

    setPendingReadIds((prev) => (prev.includes(notificationId) ? prev : [...prev, notificationId]));

    try {
      await markAsRead(notificationId);
    } catch (error) {
      console.error('Failed to mark notification as read', error);
      toast('Failed to mark notification as read', 'error');
    } finally {
      setPendingReadIds((prev) => prev.filter((id) => id !== notificationId));
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
    <div
      className={`mobile-page-padding max-w-5xl mx-auto flex flex-col ${
        isEmptyState
          ? 'h-full overflow-hidden pb-4 sm:pb-6'
          : 'pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] sm:pb-8 min-h-full'
      }`}
    >
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
            onClick={() => void handleMarkAllAsRead()}
            disabled={unreadCount === 0 || isMarkingAllRead}
            className="inline-flex items-center gap-2 rounded-xl border border-[#D0D5DD] bg-white px-3 py-2 text-xs font-semibold text-[#344054] hover:bg-[#F9FAFB] disabled:opacity-50"
          >
            <CheckCheck size={14} />
            {isMarkingAllRead ? 'Marking...' : 'Mark all as read'}
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

      <section
        className={`rounded-2xl border border-[#E4E7EC] bg-white overflow-hidden flex-1 ${
          isEmptyState ? 'min-h-0' : 'min-h-[360px]'
        }`}
      >
        {isEmptyState ? (
          <div className="h-full min-h-[280px] px-6 py-10 text-center flex flex-col items-center justify-center">
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
              const isMarkingRead = pendingReadIds.includes(notification.id);
              const type = inferNotificationType(notification);
              const typeTone = TYPE_TONES[type] || TYPE_TONES.GENERAL;
              const isDeleting = pendingDeleteIds.includes(notification.id);
              const actionLink = hasActionLink(notification) ? (notification.link as string) : null;
              const projectContext = projectContexts[notification.id] ?? { projectId: null, projectName: null };
              const projectId = projectContext.projectId ?? parseProjectIdFromLink(actionLink ?? undefined);
              const projectName =
                projectContext.projectName?.trim() || (projectId ? `Project ${projectId}` : 'General');
              const projectSummaryLink = projectId ? `/summary/${projectId}` : null;
              const statusLabel = unread ? 'Unread' : 'Read';

              return (
                <li
                  key={notification.id}
                  className={`relative px-4 sm:px-6 py-4 transition-colors ${
                    unread ? 'bg-blue-50/45' : 'bg-white'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`absolute inset-y-0 left-0 w-1 ${unread ? 'bg-blue-600' : 'bg-transparent'}`}
                  />
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden="true"
                      className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-1 ${
                        unread
                          ? 'bg-blue-100 text-blue-700 ring-blue-200'
                          : 'bg-slate-100 text-slate-500 ring-slate-200'
                      }`}
                    >
                      {unread ? (
                        <Circle size={10} fill="currentColor" />
                      ) : (
                        <CheckCircle2 size={14} />
                      )}
                    </span>
                    <span className="sr-only">{statusLabel} notification</span>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                        <div className="min-w-0">
                          <p
                            className={`text-sm leading-6 ${
                              unread ? 'text-[#101828] font-semibold' : 'text-[#344054] font-medium'
                            }`}
                          >
                            {notification.message}
                          </p>
                          <div className="mt-1">
                            {projectSummaryLink ? (
                              <Link
                                href={projectSummaryLink}
                                onClick={() => {
                                  syncCurrentProject(projectId, projectName);
                                }}
                                className="inline-flex items-center text-sm font-semibold text-[#155DFC] hover:text-[#0E4ACF] hover:underline underline-offset-2"
                              >
                                {projectName}
                              </Link>
                            ) : (
                              <span className="inline-flex items-center text-sm font-semibold text-[#155DFC]/90">
                                {projectName}
                              </span>
                            )}
                          </div>
                        </div>
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
                          aria-label={`Status: ${statusLabel}`}
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                            unread
                              ? 'border-blue-200 bg-blue-100 text-blue-800'
                              : 'border-slate-200 bg-slate-100 text-slate-700'
                          }`}
                        >
                          {unread ? (
                            <Circle size={10} fill="currentColor" aria-hidden="true" />
                          ) : (
                            <CheckCircle2 size={12} aria-hidden="true" />
                          )}
                          {statusLabel}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2 mt-3">
                        {unread && (
                          <button
                            type="button"
                            onClick={() => void handleMarkAsRead(notification.id)}
                            disabled={isMarkingRead}
                            className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                          >
                            <CheckCheck size={13} />
                            {isMarkingRead ? 'Marking...' : 'Read'}
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
