import type { ChatMessage } from '@/app/(project)/project/[id]/chat/components/chat';

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
    const ts = new Date(incoming.timestamp || '').getTime();
    if (!isNaN(ts)) {
      const dup = list.findIndex(m => 
        !m.id && 
        m.content === incoming.content &&
        isSameIdentity(m.sender, incoming.sender) &&
        m.roomId === incoming.roomId &&
        Math.abs(new Date(m.timestamp || '').getTime() - ts) < 3000
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
      item.roomId === incoming.roomId,
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
