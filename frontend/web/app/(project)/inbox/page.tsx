'use client';

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare, Users, UserRound, RefreshCw } from 'lucide-react';
import {
  fetchChatInbox,
  markDirectConversationAsRead,
  markRoomAsRead,
  markTeamAsRead,
  type ChatInboxActivity,
  type ChatInboxProjectGroup,
  type ChatInboxResponse,
} from '@/services/chat-service';

interface IdleDeadline {
  timeRemaining: () => number;
  didTimeout: boolean;
}

type IdleCallback = (deadline: IdleDeadline) => void;

interface IdleWindow extends Window {
  requestIdleCallback?: (callback: IdleCallback, options?: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
}

function formatRelativeTime(timestamp?: string | null): string {
  if (!timestamp) return 'No timestamp';

  const time = new Date(timestamp).getTime();
  if (Number.isNaN(time)) return 'Unknown time';

  const diffMs = Date.now() - time;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;

  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;

  return new Date(timestamp).toLocaleDateString();
}

function getChatTypeLabel(activity: ChatInboxActivity): string {
  if (activity.chatType === 'TEAM') return 'Team Chat';
  if (activity.chatType === 'ROOM') return activity.roomName || 'Channel';
  return activity.username || 'Direct Message';
}

function getChatTypeIcon(activity: ChatInboxActivity) {
  if (activity.chatType === 'TEAM') {
    return <Users size={16} className="text-blue-600" />;
  }

  if (activity.chatType === 'ROOM') {
    return <MessageSquare size={16} className="text-indigo-600" />;
  }

  return <UserRound size={16} className="text-emerald-600" />;
}

function buildChatHref(activity: ChatInboxActivity): string {
  const base = `/project/${activity.projectId}/chat`;
  if (activity.chatType === 'ROOM' && activity.roomId) {
    return `${base}?roomId=${activity.roomId}`;
  }
  if (activity.chatType === 'DIRECT' && activity.username) {
    return `${base}?with=${encodeURIComponent(activity.username)}`;
  }
  return `${base}?view=team`;
}

function markActivityAsRead(state: ChatInboxResponse | null, target: ChatInboxActivity): ChatInboxResponse | null {
  if (!state || !target.unread) return state;

  const targetUsername = (target.username || '').toLowerCase();
  const targetRoomId = target.roomId ?? null;

  const clearUnread = (activity: ChatInboxActivity): ChatInboxActivity => {
    if (!activity.unread || activity.projectId !== target.projectId || activity.chatType !== target.chatType) return activity;
    if (activity.chatType === 'ROOM' && (activity.roomId ?? null) !== targetRoomId) return activity;
    if (activity.chatType === 'DIRECT' && (activity.username || '').toLowerCase() !== targetUsername) return activity;

    return {
      ...activity,
      unread: false,
      unseenCount: 0,
      activityStatus: 'READ',
    };
  };

  const nextProjects = state.projects.map((project) => {
    if (project.projectId !== target.projectId) return project;

    let changed = false;
    const nextActivities = project.activities.map((activity) => {
      const updated = clearUnread(activity);
      if (updated !== activity) changed = true;
      return updated;
    });

    if (!changed) return project;

    const unreadCount = nextActivities.reduce((sum, activity) => sum + (activity.unread ? activity.unseenCount : 0), 0);
    return {
      ...project,
      activities: nextActivities,
      unreadCount,
    };
  });

  const nextRecent = state.recentActivities.map(clearUnread);
  const nextTotalUnread = Math.max(0, state.totalUnread - (target.unseenCount || 0));

  return {
    ...state,
    projects: nextProjects,
    recentActivities: nextRecent,
    totalUnread: nextTotalUnread,
  };
}

function markAllActivitiesAsRead(state: ChatInboxResponse | null): ChatInboxResponse | null {
  if (!state) return state;

  const clearUnread = (activity: ChatInboxActivity): ChatInboxActivity => {
    if (!activity.unread) return activity;
    return {
      ...activity,
      unread: false,
      unseenCount: 0,
      activityStatus: 'READ',
    };
  };

  return {
    ...state,
    projects: state.projects.map((project) => ({
      ...project,
      activities: project.activities.map(clearUnread),
      unreadCount: 0,
    })),
    recentActivities: state.recentActivities.map(clearUnread),
    totalUnread: 0,
  };
}

const CACHE_KEY = 'planora:chat-inbox-cache:v1';
const CACHE_TTL_MS = 45_000;

const ActivityRow = memo(function ActivityRow({
  activity,
  onActivityClick,
}: {
  activity: ChatInboxActivity;
  onActivityClick: (activity: ChatInboxActivity) => void;
}) {
  const handleClick = useCallback(() => {
    onActivityClick(activity);
  }, [activity, onActivityClick]);

  return (
    <button
      onClick={handleClick}
      className="w-full text-left px-4 py-3 rounded-xl border border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/30 transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            {getChatTypeIcon(activity)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[13px] font-semibold text-slate-900 truncate">{getChatTypeLabel(activity)}</p>
              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                {activity.chatType}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5 truncate">{activity.projectName}</p>
            <p className="text-[12px] text-slate-600 mt-1 truncate">
              {activity.lastMessageSender && <span className="font-semibold text-slate-700">{activity.lastMessageSender}: </span>}
              {activity.lastMessage || 'No messages yet'}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className="text-[11px] text-slate-500">{formatRelativeTime(activity.lastMessageTimestamp)}</span>
          {activity.unread ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white">
              {activity.unseenCount > 99 ? '99+' : activity.unseenCount}
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
              READ
            </span>
          )}
        </div>
      </div>
    </button>
  );
});

const ProjectSection = memo(function ProjectSection({
  group,
  onActivityClick,
}: {
  group: ChatInboxProjectGroup;
  onActivityClick: (activity: ChatInboxActivity) => void;
}) {
  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h2 className="text-[16px] font-bold text-slate-900">{group.projectName}</h2>
          <p className="text-[12px] text-slate-500 mt-0.5">{group.totalItems} chats · {group.unreadCount} unread</p>
        </div>
        <span className="text-[10px] uppercase tracking-wide font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">
          Project {group.projectId}
        </span>
      </div>

      <div className="flex flex-col gap-2.5">
        {group.activities.map((activity) => (
          <ActivityRow
            key={`${activity.chatType}-${activity.projectId}-${activity.roomId || activity.username || 'team'}`}
            activity={activity}
            onActivityClick={onActivityClick}
          />
        ))}
      </div>
    </section>
  );
});

export default function InboxPage() {
  const router = useRouter();
  const [data, setData] = useState<ChatInboxResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const refreshInbox = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) {
      setLoading(true);
      setError(null);
    }

    try {
      const result = await fetchChatInbox({
        projectLimit: 40,
        activityLimit: 120,
        status: 'all',
      });
      setData(result);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data: result }));
      }
      setError(null);
    } catch (err) {
      console.error('Failed to load chat inbox:', err);
      if (!silent) {
        setError('Failed to load chat activity. Please try again.');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let restored = false;

    if (typeof window !== 'undefined') {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as { timestamp?: number; data?: ChatInboxResponse };
          if (parsed.timestamp && parsed.data && Date.now() - parsed.timestamp < CACHE_TTL_MS) {
            setData(parsed.data);
            setLoading(false);
            restored = true;
          }
        } catch {
          sessionStorage.removeItem(CACHE_KEY);
        }
      }
    }

    void refreshInbox({ silent: restored });
  }, [refreshInbox]);

  const groupedProjects = useMemo(() => {
    const projects = data?.projects || [];
    if (filter === 'all') return projects;

    return projects
      .map((project) => {
        const activities = project.activities.filter((activity) => activity.unread);
        const unreadCount = activities.reduce((sum, activity) => sum + activity.unseenCount, 0);
        return {
          ...project,
          activities,
          unreadCount,
          totalItems: activities.length,
        };
      })
      .filter((project) => project.activities.length > 0);
  }, [data, filter]);

  const prefetchTargets = useMemo(
    () => groupedProjects.flatMap((group) => group.activities).slice(0, 8),
    [groupedProjects],
  );

  useEffect(() => {
    if (prefetchTargets.length === 0) return;

    const currentWindow = typeof window !== 'undefined' ? (window as IdleWindow) : null;
    const prefetch = () => {
      prefetchTargets.forEach((activity) => {
        router.prefetch(buildChatHref(activity));
      });
    };

    if (currentWindow?.requestIdleCallback) {
      const handle = currentWindow.requestIdleCallback(() => {
        prefetch();
      }, { timeout: 1000 });

      return () => {
        if (currentWindow.cancelIdleCallback) {
          currentWindow.cancelIdleCallback(handle);
        }
      };
    }

    const timeoutHandle = window.setTimeout(prefetch, 120);
    return () => {
      window.clearTimeout(timeoutHandle);
    };
  }, [prefetchTargets, router]);

  const unreadActivities = useMemo(() => {
    const all = (data?.projects || []).flatMap((project) => project.activities);
    return all.filter((activity) => activity.unread);
  }, [data]);

  const openActivity = useCallback((activity: ChatInboxActivity) => {
    setData((current) => markActivityAsRead(current, activity));

    if (activity.chatType === 'TEAM' && activity.unread) {
      void markTeamAsRead(String(activity.projectId)).catch((err) => {
        console.error('Failed to mark team chat as read from inbox:', err);
      });
    }

    const href = buildChatHref(activity);
    router.prefetch(href);

    if (typeof window !== 'undefined') {
      localStorage.setItem('currentProjectId', String(activity.projectId));
      localStorage.setItem('currentProjectName', activity.projectName || `Project ${activity.projectId}`);
      window.dispatchEvent(new CustomEvent('planora:project-accessed'));
    }
    router.push(href);
  }, [router]);

  const markAllAsRead = async () => {
    if (unreadActivities.length === 0 || isMarkingAllRead) return;

    setIsMarkingAllRead(true);
    const uniqueActivities = Array.from(
      new Map(
        unreadActivities.map((activity) => [
          `${activity.chatType}-${activity.projectId}-${activity.roomId || activity.username || 'team'}`,
          activity,
        ]),
      ).values(),
    );

    setData((current) => markAllActivitiesAsRead(current));

    try {
      const results = await Promise.allSettled(
        uniqueActivities.map(async (activity) => {
          const projectId = String(activity.projectId);

          if (activity.chatType === 'TEAM') {
            await markTeamAsRead(projectId);
            return;
          }

          if (activity.chatType === 'ROOM' && activity.roomId) {
            await markRoomAsRead(projectId, activity.roomId);
            return;
          }

          if (activity.chatType === 'DIRECT' && activity.username) {
            await markDirectConversationAsRead(projectId, activity.username);
          }
        }),
      );

      const failures = results.filter((result) => result.status === 'rejected').length;
      if (failures > 0) {
        setError(`Marked most chats as read, but ${failures} conversation(s) could not be updated.`);
      }

      void refreshInbox({ silent: true });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('planora:chat-inbox-updated'));
      }
    } catch {
      setError('Failed to mark all chats as read. Please try again.');
      void refreshInbox({ silent: true });
    } finally {
      setIsMarkingAllRead(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-8 flex flex-col gap-5">
      <div className="flex items-start gap-3">
        <div>
          <h1 className="text-[22px] md:text-[26px] font-bold text-slate-900 tracking-tight">Chat Inbox</h1>
          <p className="text-[13px] text-slate-600 mt-1">
            All chat activity grouped by project. Open any conversation directly from here.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${
            filter === 'all' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
          }`}
        >
          All Activity
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${
            filter === 'unread' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
          }`}
        >
          Unread Only
        </button>

        <button
          onClick={() => void markAllAsRead()}
          disabled={unreadActivities.length === 0 || loading || isMarkingAllRead}
          className="px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isMarkingAllRead ? 'Marking…' : 'Mark All Read'}
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((row) => (
            <div key={row} className="bg-white border border-slate-200 rounded-2xl p-4 animate-pulse">
              <div className="h-4 w-48 bg-slate-200 rounded" />
              <div className="h-3 w-32 bg-slate-100 rounded mt-2" />
              <div className="h-12 w-full bg-slate-100 rounded-xl mt-4" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="bg-white border border-red-200 rounded-2xl p-6 text-center">
          <p className="text-[14px] font-semibold text-red-600">{error}</p>
          <button
            onClick={() => void refreshInbox()}
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-50 text-red-700 text-[12px] font-semibold hover:bg-red-100"
          >
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      ) : groupedProjects.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
          <h2 className="text-[16px] font-bold text-slate-800">No chat activity yet</h2>
          <p className="text-[13px] text-slate-500 mt-1">Start a team, room, or direct conversation to populate your inbox.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {groupedProjects.map((group) => (
            <ProjectSection
              key={group.projectId}
              group={group}
              onActivityClick={openActivity}
            />
          ))}
        </div>
      )}
    </div>
  );
}
