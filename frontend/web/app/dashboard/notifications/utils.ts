import type { Notification } from '@/services/notifications-service';
import type { TypeTone } from './types';

export const TYPE_TONES: Record<string, TypeTone> = {
  CHAT: { bg: 'bg-indigo-50', text: 'text-indigo-700' },
  TASK: { bg: 'bg-blue-50', text: 'text-blue-700' },
  PAGE: { bg: 'bg-violet-50', text: 'text-violet-700' },
  PROJECT: { bg: 'bg-cyan-50', text: 'text-cyan-700' },
  MENTION: { bg: 'bg-amber-50', text: 'text-amber-700' },
  INFO: { bg: 'bg-slate-100', text: 'text-slate-700' },
  GENERAL: { bg: 'bg-slate-100', text: 'text-slate-700' },
};

export const TASK_LOOKUP_WINDOW = 40;
export const TASK_LOOKUP_BATCH_SIZE = 6;

export function inferNotificationType(notification: Notification): string {
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

export function toTypeLabel(type: string): string {
  return type
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function formatRelativeTime(iso: string): string {
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

export function hasActionLink(notification: Notification): boolean {
  return typeof notification.link === 'string' && notification.link.trim().length > 0;
}

export function extractTaskIdFromLink(link?: string): number | null {
  if (typeof link !== 'string' || link.trim().length === 0) {
    return null;
  }

  try {
    const parsedUrl = new URL(link, 'http://localhost');
    const taskIdParam = parsedUrl.searchParams.get('taskId');
    if (taskIdParam) {
      const parsedTaskId = Number(taskIdParam);
      if (Number.isFinite(parsedTaskId) && parsedTaskId > 0) {
        return parsedTaskId;
      }
    }
  } catch {
    // Fall through to regex parsing for non-standard URLs.
  }

  const taskPathMatch = link.match(/\/tasks?\/(\d+)/i);
  if (!taskPathMatch) {
    return null;
  }

  const parsedTaskId = Number(taskPathMatch[1]);
  return Number.isFinite(parsedTaskId) && parsedTaskId > 0 ? parsedTaskId : null;
}
