// Custom React hook managing the state, data fetching, caching, and interactions for the Chat Inbox.
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  fetchChatInbox,
  markDirectConversationAsRead,
  markRoomAsRead,
  markTeamAsRead,
  type ChatInboxActivity,
  type ChatInboxResponse,
} from '@/services/chat-service';
import { PROJECT_BATCH_SIZE } from '../constants';
import { buildChatHref, markActivityAsRead, markAllActivitiesAsRead } from '../utils';
import { buildSessionCacheKey, getSessionCache, setSessionCache } from '@/lib/session-cache';

const INBOX_CACHE_TTL_MS = 60_000;

// =====================================================
// USE INBOX DATA HOOK
// =====================================================
export function useInboxData() {
  const router = useRouter();
  const [data, setData] = useState<ChatInboxResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [visibleProjectCount, setVisibleProjectCount] = useState(PROJECT_BATCH_SIZE);
  const inboxCacheKey = buildSessionCacheKey('inbox', ['overview']);

  // Refreshes inbox data from the server, optionally in the background (silent mode) without triggering loading states.
  const refreshInbox = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) {
      setLoading(true);
      setError(null);
    }

    try {
      const result = await fetchChatInbox({
        projectLimit: 0,
        activityLimit: 1,
        status: 'all',
      });
      setData(result);
      if (inboxCacheKey) {
        setSessionCache(inboxCacheKey, result, INBOX_CACHE_TTL_MS);
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
  }, [inboxCacheKey]);

  // Restores cached inbox data on initial mount to provide instant perceived load times.
  useEffect(() => {
    let restored = false;

    if (inboxCacheKey) {
      const cached = getSessionCache<ChatInboxResponse>(inboxCacheKey, { allowStale: true });
      if (cached.data) {
        setData(cached.data);
        setLoading(false);
        restored = true;

        if (cached.isStale) {
          void refreshInbox({ silent: true });
        }
      }
    }

    void refreshInbox({ silent: restored });
  }, [inboxCacheKey, refreshInbox]);

  // Listens for cross-tab or global events to invalidate and refresh the inbox.
  useEffect(() => {
    const handleInboxInvalidation = () => {
      void refreshInbox({ silent: true });
    };

    window.addEventListener('planora:chat-inbox-updated', handleInboxInvalidation);
    return () => {
      window.removeEventListener('planora:chat-inbox-updated', handleInboxInvalidation);
    };
  }, [refreshInbox]);

  // Computes the project groups based on the active filter ('all' or 'unread').
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

  // Identifies the top few activities to aggressively prefetch their chat routes.
  const prefetchTargets = useMemo(() => {
    const targets: ChatInboxActivity[] = [];
    for (const group of groupedProjects) {
      for (const activity of group.activities) {
        targets.push(activity);
        if (targets.length === 8) {
          return targets;
        }
      }
    }
    return targets;
  }, [groupedProjects]);

  // Schedules a low-priority background prefetch for the top activities to speed up navigation.
  useEffect(() => {
    if (prefetchTargets.length === 0) return;

    const currentWindow = typeof window !== 'undefined' ? window : null;
    const prefetch = () => {
      prefetchTargets.forEach((activity) => {
        router.prefetch(buildChatHref(activity));
      });
    };

    if (currentWindow && typeof currentWindow.requestIdleCallback === 'function') {
      const handle = currentWindow.requestIdleCallback(() => {
        prefetch();
      }, { timeout: 1000 });

      return () => {
        if (typeof currentWindow.cancelIdleCallback === 'function') {
          currentWindow.cancelIdleCallback(handle);
        }
      };
    }

    const timeoutHandle = window.setTimeout(prefetch, 120);
    return () => {
      window.clearTimeout(timeoutHandle);
    };
  }, [prefetchTargets, router]);

  const allActivities = useMemo(
    () => (data?.projects || []).flatMap((project) => project.activities),
    [data],
  );

  // Calculates the total unread message count across all projects to show in the UI.
  const unreadCount = useMemo(
    () => allActivities.reduce((sum, activity) => sum + (activity.unread ? activity.unseenCount : 0), 0),
    [allActivities],
  );

  useEffect(() => {
    setVisibleProjectCount(PROJECT_BATCH_SIZE);
  }, [filter, groupedProjects.length]);

  // Limits the number of projects rendered at once to improve performance.
  const visibleProjects = useMemo(
    () => groupedProjects.slice(0, visibleProjectCount),
    [groupedProjects, visibleProjectCount],
  );

  const hasMoreProjects = visibleProjects.length < groupedProjects.length;

  // =====================================================
  // ACTIONS: OPEN ACTIVITY & MARK READ
  // =====================================================

  // Optimistically marks a specific activity as read and navigates the user to its corresponding chat view.
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

  // Optimistically marks all unread activities as read locally, then syncs with the server.
  const markAllAsRead = useCallback(async () => {
    if (unreadCount === 0 || isMarkingAllRead) return;

    setIsMarkingAllRead(true);
    const unreadActivities = allActivities.filter((activity) => activity.unread);
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
  }, [allActivities, isMarkingAllRead, refreshInbox, unreadCount]);

  return {
    loading,
    error,
    filter,
    setFilter,
    isMarkingAllRead,
    unreadCount,
    groupedProjects,
    visibleProjects,
    hasMoreProjects,
    setVisibleProjectCount,
    openActivity,
    markAllAsRead,
    refreshInbox,
  };
}
