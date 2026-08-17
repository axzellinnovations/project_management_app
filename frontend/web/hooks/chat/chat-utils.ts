import type { ChatMessage } from '@/app/(project)/project/[id]/chat/components/chat';
import { parseInstant } from '@/lib/date-time';

// ── Identity helpers ──

export const normalizeIdentity = (value?: string | null): string =>
  (value || '').trim().toLowerCase();

export const localPart = (value: string): string => {
  const normalized = normalizeIdentity(value);
  return normalized.includes('@') ? normalized.split('@')[0] : normalized;
};

export const isSameIdentity = (left?: string | null, right?: string | null): boolean => {
  const a = normalizeIdentity(left);
  const b = normalizeIdentity(right);
  if (!a && !b) return true;
  if (!a || !b) return false;
  if (a === b) return true;
  return localPart(a) === localPart(b);
};

// ── Message merge ──

export const mergeMessage = (list: ChatMessage[], incoming: ChatMessage): ChatMessage[] => {
  if (incoming.id) {
    const index = list.findIndex(item => item.id === incoming.id);
    if (index !== -1) {
      const next = [...list];
      next[index] = { ...next[index], ...incoming };
      return next;
    }
  }

  if (incoming.localId) {
    const optimisticIndex = list.findIndex(item => item.localId === incoming.localId);
    if (optimisticIndex !== -1) {
      const next = [...list];
      next[optimisticIndex] = { ...next[optimisticIndex], ...incoming };
      return next;
    }
  }

  // Fallback: match by content and timestamp window (~3s)
  if (incoming.id) {
    const ts = parseInstant(incoming.timestamp)?.getTime() ?? 0;
    if (!isNaN(ts)) {
      const dup = list.findIndex(m => 
        !m.id && 
        m.content === incoming.content &&
        isSameIdentity(m.sender, incoming.sender) &&
        Number(m.roomId || 0) === Number(incoming.roomId || 0) &&
        Math.abs((parseInstant(m.timestamp)?.getTime() ?? 0) - ts) < 3000
      );
      if (dup !== -1) {
        const next = [...list];
        next[dup] = { ...next[dup], ...incoming };
        return next;
      }
    }
  }

  const optimistic = list.findIndex(
    item =>
      !item.id &&
      isSameIdentity(item.sender, incoming.sender) &&
      item.content === incoming.content &&
      isSameIdentity(item.recipient, incoming.recipient) &&
      Number(item.roomId || 0) === Number(incoming.roomId || 0),
  );
  if (optimistic !== -1) {
    const next = [...list];
    next[optimistic] = { ...next[optimistic], ...incoming };
    return next;
  }

  return [...list, incoming];
};

// ── Room normalizer ──

export interface NormalizedRoom {
  id: number;
  name: string;
  projectId: number;
  createdBy: string;
  topic?: string;
  description?: string;
  archived?: boolean;
  pinnedMessageId?: number | null;
  updatedAt?: string;
}

export const normalizeRoom = (raw: Record<string, unknown>): NormalizedRoom => ({
  ...(raw as unknown as NormalizedRoom),
  id: Number(raw.id),
  projectId: Number(raw.projectId),
});

// ── Constants ──

export const MAX_REACTION_HYDRATION_MESSAGES = 20;
export const REACTION_RETRY_BACKOFF_MS = 10_000;

export const AVATAR_COLORS = [
  'from-blue-500 to-blue-600',
  'from-emerald-500 to-teal-600',
  'from-sky-400 to-blue-500',
  'from-indigo-500 to-blue-600',
  'from-teal-400 to-emerald-500',
  'from-cyan-500 to-blue-600',
  'from-blue-400 to-indigo-500',
  'from-slate-400 to-slate-500',
];

export const avatarColor = (name: string): string =>
  AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
