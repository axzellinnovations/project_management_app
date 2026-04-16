import type { ChatInboxActivity, ChatInboxResponse } from '@/services/chat-service';
import { buildChatHref, markActivityAsRead, markAllActivitiesAsRead } from './utils';

function createActivity(overrides: Partial<ChatInboxActivity> = {}): ChatInboxActivity {
  return {
    projectId: 12,
    projectName: 'Alpha',
    chatType: 'TEAM',
    unseenCount: 3,
    unread: true,
    activityStatus: 'UNREAD',
    ...overrides,
  };
}

function createState(activities: ChatInboxActivity[]): ChatInboxResponse {
  return {
    projects: [
      {
        projectId: 12,
        projectName: 'Alpha',
        unreadCount: activities.reduce((sum, item) => sum + (item.unread ? item.unseenCount : 0), 0),
        totalItems: activities.length,
        activities,
      },
    ],
    recentActivities: activities,
    totalProjects: 1,
    totalActivities: activities.length,
    totalUnread: activities.reduce((sum, item) => sum + (item.unread ? item.unseenCount : 0), 0),
  };
}

describe('inbox utils', () => {
  it('builds chat href for team, room, and direct chats', () => {
    expect(buildChatHref(createActivity({ chatType: 'TEAM' }))).toBe('/project/12/chat?view=team');
    expect(buildChatHref(createActivity({ chatType: 'ROOM', roomId: 5 }))).toBe('/project/12/chat?roomId=5');
    expect(buildChatHref(createActivity({ chatType: 'DIRECT', username: 'jane doe' }))).toBe('/project/12/chat?with=jane%20doe');
  });

  it('marks only the target activity as read', () => {
    const team = createActivity({ chatType: 'TEAM', unseenCount: 2 });
    const room = createActivity({ chatType: 'ROOM', roomId: 7, unseenCount: 4 });
    const state = createState([team, room]);

    const next = markActivityAsRead(state, room);

    expect(next?.projects[0].activities[0].unread).toBe(true);
    expect(next?.projects[0].activities[1].unread).toBe(false);
    expect(next?.projects[0].activities[1].unseenCount).toBe(0);
  });

  it('marks all activities as read', () => {
    const team = createActivity({ chatType: 'TEAM', unseenCount: 2 });
    const direct = createActivity({ chatType: 'DIRECT', username: 'sara', unseenCount: 1 });
    const state = createState([team, direct]);

    const next = markAllActivitiesAsRead(state);

    expect(next?.totalUnread).toBe(0);
    expect(next?.projects[0].unreadCount).toBe(0);
    expect(next?.projects[0].activities.every((item) => !item.unread)).toBe(true);
  });
});
