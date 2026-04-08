import api from '@/lib/axios';

// ── Types ──

export interface Notification {
  id: number;
  message: string;
  type: string;
  read: boolean;
  createdAt: string;
  [key: string]: unknown;
}

// ── API ──

export async function fetchNotifications(): Promise<Notification[]> {
  const { data } = await api.get<Notification[]>('/api/notifications');
  return data;
}

export async function fetchUnreadCount(): Promise<number> {
  const { data } = await api.get<{ count: number }>('/api/notifications/unread-count');
  return data.count;
}

export async function markNotificationRead(id: number): Promise<void> {
  await api.patch(`/api/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.patch('/api/notifications/read-all');
}

export async function deleteNotification(id: number): Promise<void> {
  await api.delete(`/api/notifications/${id}`);
}

export async function deleteAllNotifications(ids: number[]): Promise<PromiseSettledResult<void>[]> {
  return Promise.allSettled(ids.map((id) => deleteNotification(id)));
}
