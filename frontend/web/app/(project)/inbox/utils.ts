// Pure utility functions for formatting and transforming chat inbox data.
import type { ChatInboxActivity, ChatInboxResponse } from '@/services/chat-service';

// =====================================================
// FORMATTING & UI HELPERS
// =====================================================

// Formats an ISO timestamp into a human-readable relative time string (e.g., "5m ago").
export function formatRelativeTime(timestamp?: string | null): string {
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

// Returns a human-friendly display label for a chat activity based on its type.
export function getChatTypeLabel(activity: ChatInboxActivity): string {
  if (activity.chatType === 'TEAM') return 'Team Chat';
  if (activity.chatType === 'ROOM') return activity.roomName || 'Channel';
  return activity.username || 'Direct Message';
}

// Constructs the URL path for navigating to a specific chat activity.
export function buildChatHref(activity: ChatInboxActivity): string {
  const base = `/project/${activity.projectId}/chat`;
  if (activity.chatType === 'ROOM' && activity.roomId) {
    return `${base}?roomId=${activity.roomId}`;
  }
  if (activity.chatType === 'DIRECT' && activity.username) {
    return `${base}?with=${encodeURIComponent(activity.username)}`;
  }
  return `${base}?view=team`;
}

// =====================================================
// STATE MUTATION HELPERS (OPTIMISTIC UPDATES)
// =====================================================

// Returns a new state object with a specific activity marked as read, preventing mutation of the original state.
export function markActivityAsRead(state: ChatInboxResponse | null, target: ChatInboxActivity): ChatInboxResponse | null {
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

// Returns a new state object with all activities marked as read.
export function markAllActivitiesAsRead(state: ChatInboxResponse | null): ChatInboxResponse | null {
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
