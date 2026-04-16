import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import { getValidToken } from '@/lib/auth';
import * as chatApi from '@/services/chat-service';
import type {
  ChatFeatureFlags,
  ChatMessage,
  ChatReactionSummary,
  ChatRoom,
  UnreadBadgeSummary,
} from '@/app/(project)/project/[id]/chat/components/chat';
import { buildSessionCacheKey, getSessionCache, setSessionCache } from '@/lib/session-cache';
import { isSameIdentity, mergeMessage, normalizeRoom } from './chat-utils';

export interface RoomEvent {
  action: 'CREATED' | 'UPDATED' | 'DELETED';
  roomId: number;
  room?: ChatRoom;
}

export interface PresenceEvent {
  type: 'ONLINE' | 'OFFLINE' | 'PING';
  user?: string;
  onlineUsers?: string[];
}

export interface TypingEvent {
  sender: string;
  scope: 'TEAM' | 'ROOM' | 'PRIVATE';
  roomId?: number;
  recipient?: string;
  typing: boolean;
}

export interface MentionEvent {
  type: 'MENTIONED';
  projectId: number;
  messageId?: number;
  sender: string;
  scope: 'TEAM' | 'ROOM' | 'PRIVATE' | 'THREAD' | string;
  roomId?: number;
  preview?: string;
}

export interface ChatInitCache {
  flags?: ChatFeatureFlags;
  users?: string[];
  pics?: Record<string, string>;
  rooms?: ChatRoom[];
}

export const CHAT_RECONNECT_ERROR = 'Realtime chat is reconnecting. Please wait a moment and try again.';

export const DEFAULT_FEATURE_FLAGS: ChatFeatureFlags = {
  phaseDEnabled: process.env.NEXT_PUBLIC_CHAT_PHASE_D_ENABLED !== 'false',
  phaseEEnabled: process.env.NEXT_PUBLIC_CHAT_PHASE_E_ENABLED !== 'false',
  webhooksEnabled: process.env.NEXT_PUBLIC_CHAT_WEBHOOKS_ENABLED !== 'false',
  telemetryEnabled: process.env.NEXT_PUBLIC_CHAT_TELEMETRY_ENABLED !== 'false',
};

type SetState<T> = Dispatch<SetStateAction<T>>;
type RealtimePayload = { body: string };
type RealtimeSubscription = { unsubscribe: () => void };
type RealtimeCallback = (payload: RealtimePayload) => void;

export interface SelectionRestoreArgs {
  selectionStorageKey: string;
  availableUsers: string[];
  availableRooms: ChatRoom[];
  setSelectedUser: SetState<string | null>;
  setSelectedRoomId: SetState<number | null>;
  hasRestoredSelectionRef: MutableRefObject<boolean>;
  setHasRestoredSelection: SetState<boolean>;
}

export function restoreSelectionState(args: SelectionRestoreArgs): void {
  const {
    selectionStorageKey,
    availableUsers,
    availableRooms,
    setSelectedUser,
    setSelectedRoomId,
    hasRestoredSelectionRef,
    setHasRestoredSelection,
  } = args;

  if (typeof window === 'undefined') {
    hasRestoredSelectionRef.current = true;
    setHasRestoredSelection(true);
    return;
  }

  const raw = window.sessionStorage.getItem(selectionStorageKey);
  if (!raw) {
    hasRestoredSelectionRef.current = true;
    setHasRestoredSelection(true);
    return;
  }

  try {
    const parsed = JSON.parse(raw) as { type?: string; value?: string | number | null };
    if (
      parsed.type === 'private' &&
      typeof parsed.value === 'string' &&
      availableUsers.includes(parsed.value)
    ) {
      setSelectedUser(parsed.value);
    } else if (parsed.type === 'room') {
      const rid = Number(parsed.value);
      if (Number.isFinite(rid) && availableRooms.some((room) => room.id === rid)) {
        setSelectedRoomId(rid);
      }
    }
  } catch {
    // Ignore malformed persisted selection.
  } finally {
    hasRestoredSelectionRef.current = true;
    setHasRestoredSelection(true);
  }
}

interface JwtPayload {
  username?: string;
  sub?: string;
  email?: string;
}

function decodeJwtPayload(token: string): JwtPayload {
  return JSON.parse(atob(token.split('.')[1])) as JwtPayload;
}

function resolveIdentity(payload: JwtPayload, canonicalUsername: string | null): {
  username: string;
  aliases: string[];
} {
  const username = (
    canonicalUsername ||
    payload.username ||
    payload.sub ||
    payload.email ||
    'User'
  ).toLowerCase();

  const aliases = [payload.username, payload.sub, payload.email]
    .filter((value): value is string => Boolean(value && value.trim()))
    .map((value) => value.toLowerCase());

  if (canonicalUsername) aliases.push(canonicalUsername);

  const aliasesWithLocalPart = aliases
    .flatMap((value) => (value.includes('@') ? [value, value.split('@')[0]] : [value]))
    .filter((value) => value && value.trim());

  return {
    username,
    aliases: Array.from(new Set([...aliasesWithLocalPart, username])),
  };
}

function buildProfilePicMap(profiles: chatApi.AuthUserSummary[]): Record<string, string> {
  const map: Record<string, string> = {};
  profiles.forEach((profile) => {
    const key = (profile.username || profile.email || '').toLowerCase();
    const raw = profile as Record<string, unknown>;
    if (key && raw.profilePicUrl) {
      map[key] = raw.profilePicUrl as string;
    }
  });
  return map;
}

export interface ChatInitializationArgs {
  projectId: string;
  routerPush: (href: string) => void;
  setFeatureFlags: SetState<ChatFeatureFlags>;
  setUsers: SetState<string[]>;
  setUserProfilePics: SetState<Record<string, string>>;
  setRooms: SetState<ChatRoom[]>;
  setIsLoading: SetState<boolean>;
  setError: SetState<string>;
  setCurrentUser: SetState<string>;
  setCurrentUserAliases: SetState<string[]>;
  fetchAllUsers: () => Promise<string[]>;
  loadRooms: () => Promise<ChatRoom[]>;
  loadSummaries: (
    setPrivateLastMessages: SetState<Record<string, ChatMessage | null>>,
    setRoomLastMessages: SetState<Record<number, ChatMessage | null>>,
  ) => Promise<void>;
  loadPresence: () => Promise<void>;
  loadUnreadBadge: () => Promise<void>;
  restoreSelection: (users: string[], rooms: ChatRoom[]) => void;
  loadHistory: (hydrateReactions: (messages: ChatMessage[]) => void) => Promise<void>;
  hydrateReactions: (messages: ChatMessage[]) => void;
  setPrivateLastMessages: SetState<Record<string, ChatMessage | null>>;
  setRoomLastMessages: SetState<Record<number, ChatMessage | null>>;
}

export async function initializeChatState(args: ChatInitializationArgs): Promise<void> {
  const {
    projectId,
    routerPush,
    setFeatureFlags,
    setUsers,
    setUserProfilePics,
    setRooms,
    setIsLoading,
    setError,
    setCurrentUser,
    setCurrentUserAliases,
    fetchAllUsers,
    loadRooms,
    loadSummaries,
    loadPresence,
    loadUnreadBadge,
    restoreSelection,
    loadHistory,
    hydrateReactions,
    setPrivateLastMessages,
    setRoomLastMessages,
  } = args;

  const token = getValidToken();
  if (!token) {
    console.warn('[chat-ws] No valid token found, redirecting to login.');
    routerPush('/login');
    return;
  }

  // Resolve identity before any cache short-circuit so realtime subscriptions
  // always receive a stable current user and alias set.
  const payload = decodeJwtPayload(token);
  let canonicalUsername: string | null = null;
  try {
    const me = await chatApi.fetchCurrentUser();
    canonicalUsername = me.username?.toLowerCase() || null;
  } catch {
    // Fall through to JWT payload identity.
  }

  const identity = resolveIdentity(payload, canonicalUsername);
  setCurrentUserAliases(identity.aliases);
  setCurrentUser(identity.username);

  const cacheKey = buildSessionCacheKey('chat-init', [projectId]);
  if (cacheKey) {
    const cached = getSessionCache<ChatInitCache>(cacheKey, { allowStale: true });
    if (cached.data) {
      if (cached.data.flags) setFeatureFlags(cached.data.flags);
      if (cached.data.users) setUsers(cached.data.users);
      if (cached.data.pics) setUserProfilePics(cached.data.pics);
      if (cached.data.rooms) setRooms(cached.data.rooms);
      setIsLoading(false);
      if (!cached.isStale) {
        restoreSelection(cached.data.users || [], cached.data.rooms || []);
        await loadHistory(hydrateReactions);
        return;
      }
    }
  }

  try {
    const [loadedUsers, pics, loadedRooms, flags] = await Promise.all([
      fetchAllUsers(),
      chatApi
        .fetchAllUserProfiles()
        .then((profiles) => buildProfilePicMap(profiles))
        .catch(() => ({})),
      loadRooms(),
      chatApi.fetchFeatureFlags(projectId).catch(() => DEFAULT_FEATURE_FLAGS),
    ]);

    setUsers(loadedUsers);
    setUserProfilePics(pics);
    setRooms(loadedRooms);
    setFeatureFlags(flags);
    setIsLoading(false);

    if (cacheKey) {
      setSessionCache(
        cacheKey,
        { flags, users: loadedUsers, pics, rooms: loadedRooms },
        30 * 60_000,
      );
    }

    await loadSummaries(setPrivateLastMessages, setRoomLastMessages);
    await loadPresence();
    await loadUnreadBadge();
    restoreSelection(loadedUsers, loadedRooms);
    await loadHistory(hydrateReactions);
  } catch {
    setError('Invalid authentication token.');
    routerPush('/login');
  }
}

function parsePayload<T>(payload: RealtimePayload): T {
  return JSON.parse(payload.body) as T;
}

interface BaseRealtimeSubscriptionsArgs {
  projectId: string;
  currentUser: string;
  currentUserAliases: string[];
  selectedUserRef: MutableRefObject<string | null>;
  selectedRoomIdRef: MutableRefObject<number | null>;
  subscribeRealtime: (
    destination: string,
    callback: RealtimeCallback,
  ) => RealtimeSubscription | null;
  sendRealtime: (destination: string, body: string) => void;
  setError: SetState<string>;
  setUsers: SetState<string[]>;
  setMessages: SetState<ChatMessage[]>;
  setTeamLastMessage: SetState<ChatMessage | null>;
  setTeamUnseenCount: SetState<number>;
  markTeamAsRead: () => Promise<void>;
  loadMessageReactions: (messageId: number) => Promise<void>;
  mergePrivateMessage: (
    partner: string,
    incoming: ChatMessage,
    selectedUser: string | null,
    isFromCurrentUser: boolean,
  ) => { isFromCurrentUser: boolean };
  setPrivateLastMessages: SetState<Record<string, ChatMessage | null>>;
  setPrivateUnseenCounts: SetState<Record<string, number>>;
  setRooms: SetState<ChatRoom[]>;
  setRoomUnseenCounts: SetState<Record<number, number>>;
  setRoomLastMessages: SetState<Record<number, ChatMessage | null>>;
  setRoomMessages: SetState<Record<number, ChatMessage[]>>;
  setOnlineUsers: SetState<string[]>;
  setTeamTypingUsers: SetState<string[]>;
  setPrivateTypingUsers: SetState<string[]>;
  setUnreadBadge: SetState<UnreadBadgeSummary>;
  showCommandNotice: (message: string) => void;
  trackTelemetry: (eventName: string, scope: string, metadata?: string) => Promise<void>;
  setRoomMentionCounts: SetState<Record<number, number>>;
  setTeamMentionCount: SetState<number>;
}

export function setupBaseRealtimeSubscriptions(args: BaseRealtimeSubscriptionsArgs): () => void {
  const {
    projectId,
    currentUser,
    currentUserAliases,
    selectedUserRef,
    selectedRoomIdRef,
    subscribeRealtime,
    sendRealtime,
    setError,
    setUsers,
    setMessages,
    setTeamLastMessage,
    setTeamUnseenCount,
    markTeamAsRead,
    loadMessageReactions,
    mergePrivateMessage,
    setPrivateLastMessages,
    setPrivateUnseenCounts,
    setRooms,
    setRoomUnseenCounts,
    setRoomLastMessages,
    setRoomMessages,
    setOnlineUsers,
    setTeamTypingUsers,
    setPrivateTypingUsers,
    setUnreadBadge,
    showCommandNotice,
    trackTelemetry,
    setRoomMentionCounts,
    setTeamMentionCount,
  } = args;

  setError('');

  const normalizedAliases = new Set(currentUserAliases.map((alias) => alias.toLowerCase()));
  const subscriptions: RealtimeSubscription[] = [];

  const addSubscription = (subscription: RealtimeSubscription | null): void => {
    if (subscription) subscriptions.push(subscription);
  };

  addSubscription(
    subscribeRealtime(`/topic/project/${projectId}/public`, (payload) => {
      const incoming = parsePayload<ChatMessage>(payload);
      if (incoming.type === 'JOIN' && incoming.sender !== currentUser) {
        setUsers((prev) => (prev.includes(incoming.sender) ? prev : [...prev, incoming.sender]));
        return;
      }

      if (incoming.type !== 'JOIN' && !incoming.roomId && !incoming.recipient) {
        if (incoming.parentMessageId) return;

        setMessages((prev) => mergeMessage(prev, incoming));
        setTeamLastMessage(incoming);

        if (
          incoming.sender.toLowerCase() !== currentUser &&
          selectedRoomIdRef.current === null &&
          !selectedUserRef.current
        ) {
          setTeamUnseenCount(0);
          void markTeamAsRead();
        } else if (incoming.sender.toLowerCase() !== currentUser) {
          setTeamUnseenCount((prev) => prev + 1);
        }

        if (incoming.id) {
          void loadMessageReactions(incoming.id);
        }
      }
    }),
  );

  addSubscription(
    subscribeRealtime(`/user/queue/project/${projectId}/messages`, (payload) => {
      const incoming = parsePayload<ChatMessage>(payload);
      const sender = incoming.sender?.toLowerCase() || '';
      const recipient = incoming.recipient?.toLowerCase() || '';
      const isFromCurrent = normalizedAliases.has(sender);
      const partner = isFromCurrent ? recipient : sender;
      if (!partner || incoming.parentMessageId) return;

      mergePrivateMessage(partner, incoming, selectedUserRef.current, isFromCurrent);

      const activeKey =
        selectedUserRef.current && isSameIdentity(selectedUserRef.current, partner)
          ? selectedUserRef.current.toLowerCase()
          : partner;

      setPrivateLastMessages((prev) => ({
        ...prev,
        [activeKey]: incoming,
        ...(activeKey !== partner ? { [partner]: incoming } : {}),
      }));

      if (!isFromCurrent && !(selectedUserRef.current && isSameIdentity(selectedUserRef.current, partner))) {
        const key =
          selectedUserRef.current && isSameIdentity(selectedUserRef.current, partner)
            ? selectedUserRef.current.toLowerCase()
            : partner;
        setPrivateUnseenCounts((prev) => ({ ...prev, [key]: (prev[key] || 0) + 1 }));
      }

      setUsers((prev) => (prev.some((user) => isSameIdentity(user, partner)) ? prev : [...prev, partner]));

      if (incoming.id) {
        void loadMessageReactions(incoming.id);
      }
    }),
  );

  addSubscription(
    subscribeRealtime(`/topic/project/${projectId}/rooms`, (payload) => {
      const event = parsePayload<RoomEvent>(payload);
      if ((event.action === 'CREATED' || event.action === 'UPDATED') && event.room) {
        const normalizedRoom = normalizeRoom(event.room as unknown as Record<string, unknown>);
        if (!Number.isFinite(normalizedRoom.id)) return;

        setRooms((prev) =>
          prev.some((room) => room.id === normalizedRoom.id)
            ? prev.map((room) => (room.id === normalizedRoom.id ? normalizedRoom : room))
            : [...prev, normalizedRoom],
        );
        setRoomUnseenCounts((prev) => ({ ...prev, [normalizedRoom.id]: prev[normalizedRoom.id] || 0 }));
        setRoomLastMessages((prev) => ({ ...prev, [normalizedRoom.id]: prev[normalizedRoom.id] || null }));
        return;
      }

      if (event.action === 'DELETED') {
        const roomId = Number(event.roomId);
        setRooms((prev) => prev.filter((room) => room.id !== roomId));
        setRoomMessages((prev) => {
          const next = { ...prev };
          delete next[roomId];
          return next;
        });
        setRoomUnseenCounts((prev) => {
          const next = { ...prev };
          delete next[roomId];
          return next;
        });
        setRoomLastMessages((prev) => {
          const next = { ...prev };
          delete next[roomId];
          return next;
        });
      }
    }),
  );

  addSubscription(
    subscribeRealtime(`/topic/project/${projectId}/presence`, (payload) => {
      const event = parsePayload<PresenceEvent>(payload);
      setOnlineUsers((event.onlineUsers || []).map((user) => user.toLowerCase()));
    }),
  );

  addSubscription(
    subscribeRealtime(`/topic/project/${projectId}/typing/team`, (payload) => {
      const event = parsePayload<TypingEvent>(payload);
      const sender = event.sender?.toLowerCase();
      if (!sender || sender === currentUser.toLowerCase()) return;
      setTeamTypingUsers((prev) =>
        event.typing
          ? prev.includes(sender)
            ? prev
            : [...prev, sender]
          : prev.filter((user) => user !== sender),
      );
    }),
  );

  addSubscription(
    subscribeRealtime(`/user/queue/project/${projectId}/typing/private`, (payload) => {
      const event = parsePayload<TypingEvent>(payload);
      const sender = event.sender?.toLowerCase();
      if (!sender || sender === currentUser.toLowerCase()) return;
      setPrivateTypingUsers((prev) =>
        event.typing
          ? prev.includes(sender)
            ? prev
            : [...prev, sender]
          : prev.filter((user) => user !== sender),
      );
    }),
  );

  addSubscription(
    subscribeRealtime(`/user/queue/project/${projectId}/unread-badge`, (payload) => {
      const badge = parsePayload<UnreadBadgeSummary>(payload);
      setUnreadBadge({
        teamUnread: Number(badge.teamUnread) || 0,
        roomsUnread: Number(badge.roomsUnread) || 0,
        directsUnread: Number(badge.directsUnread) || 0,
        totalUnread: Number(badge.totalUnread) || 0,
      });
    }),
  );

  addSubscription(
    subscribeRealtime(`/user/queue/project/${projectId}/mentions`, (payload) => {
      const mention = parsePayload<MentionEvent>(payload);

      const context =
        mention.scope === 'ROOM'
          ? 'group chat'
          : mention.scope === 'PRIVATE'
            ? 'direct chat'
            : mention.scope === 'THREAD'
              ? 'thread'
              : 'team chat';

      showCommandNotice(`You are mentioned by ${mention.sender} in ${context}.`);
      void trackTelemetry(
        'chat_mention_received',
        mention.scope || 'chat',
        `messageId=${mention.messageId || ''}`,
      );

      if (mention.scope === 'ROOM' && mention.roomId) {
        const roomId = Number(mention.roomId);
        if (selectedRoomIdRef.current !== roomId) {
          setRoomMentionCounts((prev) => ({ ...prev, [roomId]: (prev[roomId] || 0) + 1 }));
        }
      } else if (
        (mention.scope === 'TEAM' || !mention.scope) &&
        (selectedRoomIdRef.current !== null || selectedUserRef.current !== null)
      ) {
        setTeamMentionCount((prev) => prev + 1);
      }
    }),
  );

  sendRealtime(`/app/project/${projectId}/presence.ping`, JSON.stringify({}));

  return () => {
    subscriptions.forEach((subscription) => subscription.unsubscribe());
  };
}

interface RoomRealtimeSubscriptionsArgs {
  projectId: string;
  rooms: ChatRoom[];
  currentUser: string;
  selectedRoomIdRef: MutableRefObject<number | null>;
  subscribeRealtime: (
    destination: string,
    callback: RealtimeCallback,
  ) => RealtimeSubscription | null;
  setRoomMessages: SetState<Record<number, ChatMessage[]>>;
  setRoomLastMessages: SetState<Record<number, ChatMessage | null>>;
  setRoomUnseenCounts: SetState<Record<number, number>>;
  loadMessageReactions: (messageId: number) => Promise<void>;
  setRoomTypingUsers: SetState<Record<number, string[]>>;
}

export function setupRoomRealtimeSubscriptions(args: RoomRealtimeSubscriptionsArgs): () => void {
  const {
    projectId,
    rooms,
    currentUser,
    selectedRoomIdRef,
    subscribeRealtime,
    setRoomMessages,
    setRoomLastMessages,
    setRoomUnseenCounts,
    loadMessageReactions,
    setRoomTypingUsers,
  } = args;

  const subscriptions = rooms.flatMap((room) => {
    const messageSubscription = subscribeRealtime(
      `/topic/project/${projectId}/room/${room.id}`,
      (payload) => {
        const incoming = parsePayload<ChatMessage>(payload);
        if (incoming.type === 'JOIN' || !incoming.roomId || incoming.parentMessageId) return;

        setRoomMessages((prev) => ({
          ...prev,
          [incoming.roomId as number]: mergeMessage(prev[incoming.roomId as number] || [], incoming),
        }));
        setRoomLastMessages((prev) => ({ ...prev, [incoming.roomId as number]: incoming }));

        if (incoming.sender.toLowerCase() !== currentUser && selectedRoomIdRef.current !== incoming.roomId) {
          setRoomUnseenCounts((prev) => ({
            ...prev,
            [incoming.roomId as number]: (prev[incoming.roomId as number] || 0) + 1,
          }));
        }

        if (incoming.id) {
          void loadMessageReactions(incoming.id);
        }
      },
    );

    const typingSubscription = subscribeRealtime(
      `/topic/project/${projectId}/typing/room/${room.id}`,
      (payload) => {
        const event = parsePayload<TypingEvent>(payload);
        const sender = event.sender?.toLowerCase();
        if (!sender || sender === currentUser.toLowerCase()) return;

        const roomId = Number(event.roomId || room.id);
        setRoomTypingUsers((prev) => {
          const existing = prev[roomId] || [];
          return {
            ...prev,
            [roomId]: event.typing
              ? existing.includes(sender)
                ? existing
                : [...existing, sender]
              : existing.filter((user) => user !== sender),
          };
        });
      },
    );

    return [messageSubscription, typingSubscription].filter(
      (subscription): subscription is RealtimeSubscription => Boolean(subscription),
    );
  });

  return () => {
    subscriptions.forEach((subscription) => subscription.unsubscribe());
  };
}

interface ThreadRealtimeSubscriptionArgs {
  projectId: string;
  rootMessageId: number;
  subscribeRealtime: (
    destination: string,
    callback: RealtimeCallback,
  ) => RealtimeSubscription | null;
  setThreadMessages: SetState<ChatMessage[]>;
  loadMessageReactions: (messageId: number) => Promise<void>;
}

export function setupThreadRealtimeSubscription(
  args: ThreadRealtimeSubscriptionArgs,
): (() => void) | undefined {
  const {
    projectId,
    rootMessageId,
    subscribeRealtime,
    setThreadMessages,
    loadMessageReactions,
  } = args;

  const subscription = subscribeRealtime(
    `/topic/project/${projectId}/thread/${rootMessageId}`,
    (payload) => {
      const incoming = parsePayload<ChatMessage>(payload);
      setThreadMessages((prev) => mergeMessage(prev, incoming));
      if (incoming.id) {
        void loadMessageReactions(incoming.id);
      }
    },
  );

  if (!subscription) return undefined;
  return () => subscription.unsubscribe();
}

interface ReactionSubscriptionsArgs {
  projectId: string;
  subscribeRealtime: (
    destination: string,
    callback: RealtimeCallback,
  ) => RealtimeSubscription | null;
  messages: ChatMessage[];
  privateMessages: Record<string, ChatMessage[]>;
  roomMessages: Record<number, ChatMessage[]>;
  threadMessages: ChatMessage[];
  setMessageReactions: SetState<Record<number, ChatReactionSummary[]>>;
}

function collectReactionMessageIds(args: {
  messages: ChatMessage[];
  privateMessages: Record<string, ChatMessage[]>;
  roomMessages: Record<number, ChatMessage[]>;
  threadMessages: ChatMessage[];
}): number[] {
  const { messages, privateMessages, roomMessages, threadMessages } = args;
  const ids = new Set<number>();

  messages.forEach((message) => {
    if (message.id) ids.add(message.id);
  });

  Object.values(privateMessages).forEach((list) =>
    list.forEach((message) => {
      if (message.id) ids.add(message.id);
    }),
  );

  Object.values(roomMessages).forEach((list) =>
    list.forEach((message) => {
      if (message.id) ids.add(message.id);
    }),
  );

  threadMessages.forEach((message) => {
    if (message.id) ids.add(message.id);
  });

  return Array.from(ids);
}

export function setupReactionSubscriptions(args: ReactionSubscriptionsArgs): () => void {
  const {
    projectId,
    subscribeRealtime,
    messages,
    privateMessages,
    roomMessages,
    threadMessages,
    setMessageReactions,
  } = args;

  const subscriptions = collectReactionMessageIds({
    messages,
    privateMessages,
    roomMessages,
    threadMessages,
  })
    .map((id) =>
      subscribeRealtime(`/topic/project/${projectId}/messages/${id}/reactions`, (payload) => {
        const reactions = parsePayload<ChatReactionSummary[]>(payload);
        setMessageReactions((prev) => ({ ...prev, [id]: reactions }));
      }),
    )
    .filter((subscription): subscription is RealtimeSubscription => Boolean(subscription));

  return () => {
    subscriptions.forEach((subscription) => subscription.unsubscribe());
  };
}
