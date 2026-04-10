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
  if (!incoming.id) {
    return [...list, incoming];
  }

  const index = list.findIndex(item => item.id === incoming.id);
  if (index !== -1) {
    const next = [...list];
    next[index] = { ...next[index], ...incoming };
    return next;
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
