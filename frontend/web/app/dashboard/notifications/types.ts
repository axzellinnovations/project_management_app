import type { Notification } from '@/services/notifications-service';

export type NotificationFilter = 'all' | 'unread' | 'read';

export type TypeTone = {
  bg: string;
  text: string;
};

export type TaskProjectLinkMap = Record<number, { projectId: number; projectName: string }>;

export type NotificationDeleteHandler = (
  event: React.MouseEvent<HTMLButtonElement>,
  notificationId: number,
) => void;

export type NotificationRow = Notification;
